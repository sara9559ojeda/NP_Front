// Server-only proxy. No database credentials or proxy secret reach Vite.
import { isIP } from 'node:net';

export function createProxy(env = process.env, upstreamFetch = fetch) {
  return async function handler(req, res) {
    res.setHeader('Cache-Control', 'private, no-store');
    res.setHeader('Vercel-CDN-Cache-Control', 'no-store');
    const problem = (status, code) => {
      res.statusCode = status;
      res.setHeader('Content-Type', 'application/problem+json');
      res.end(JSON.stringify({ status, code, title: code }));
    };
    let origin;
    try {
      origin = new URL(env.NP_BACKEND_ORIGIN);
      if (origin.protocol !== 'https:' || origin.username || origin.password || origin.search || origin.hash || origin.pathname !== '/') throw new Error();
      if (!env.NP_PROXY_SECRET || env.NP_PROXY_SECRET.length < 32) throw new Error();
    } catch { return problem(503, 'SERVER_ERROR'); }
    const method = req.method ?? 'GET';
    if (!['GET', 'POST', 'PATCH', 'PUT', 'DELETE', 'OPTIONS', 'HEAD'].includes(method)) return problem(405, 'METHOD_NOT_ALLOWED');
    const input = new URL(req.url, 'https://proxy.local');
    const rawPath = req.query?.np_path ?? input.searchParams.get('np_path');
    if (typeof rawPath !== 'string' || /[\\?#]/.test(rawPath)) return problem(400, 'BAD_REQUEST');
    let path;
    try {
      path = decodeURIComponent(rawPath);
      if (path.split('/').some(p => p === '.' || p === '..') || /[\\?#%]/.test(path)) throw new Error();
    } catch { return problem(400, 'BAD_REQUEST'); }
    const target = new URL('/api/v1/' + path.replace(/^\/+/, ''), origin);
    input.searchParams.delete('np_path');
    target.search = input.search;
    // Vercel overwrites x-forwarded-for; do not use a client-supplied custom IP.
    const forwarded = req.headers['x-vercel-forwarded-for'] ?? req.headers['x-forwarded-for'];
    const ip = env.VERCEL === '1' ? forwarded : req.socket?.remoteAddress;
    if (typeof ip !== 'string' || !isIP(ip)) return problem(502, 'SERVER_ERROR');
    const headers = new Headers();
    for (const key of ['accept', 'content-type', 'authorization', 'cookie', 'origin']) {
      const value = req.headers[key];
      if (typeof value === 'string') headers.set(key, value);
    }
    headers.set('x-np-client-ip', ip);
    headers.set('x-np-proxy-secret', env.NP_PROXY_SECRET);
    let body;
    if (!['GET', 'HEAD'].includes(method)) {
      if (req.body !== undefined) {
        body = Buffer.isBuffer(req.body) ? req.body : Buffer.from(typeof req.body === 'string' ? req.body : JSON.stringify(req.body));
      } else {
        const chunks = [];
        let length = 0;
        for await (const chunk of req) {
          length += Buffer.byteLength(chunk);
          if (length > 256 * 1024) return problem(413, 'PAYLOAD_TOO_LARGE');
          chunks.push(Buffer.from(chunk));
        }
        body = Buffer.concat(chunks);
      }
      if (body.length > 256 * 1024) return problem(413, 'PAYLOAD_TOO_LARGE');
    }
    try {
      const result = await upstreamFetch(target, { method, headers, body, redirect: 'manual', signal: AbortSignal.timeout(25000) });
      res.statusCode = result.status;
      for (const key of ['content-type', 'content-disposition', 'retry-after', 'x-request-id']) {
        const value = result.headers.get(key);
        if (value) res.setHeader(key, value);
      }
      const cookies = result.headers.getSetCookie();
      if (cookies.length) res.setHeader('Set-Cookie', cookies);
      res.end(method === 'HEAD' ? undefined : Buffer.from(await result.arrayBuffer()));
    } catch { problem(502, 'NETWORK_ERROR'); }
  };
}

export default createProxy();

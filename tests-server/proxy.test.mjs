import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createProxy } from '../api/proxy.mjs';

const env = { VERCEL: '1', NP_BACKEND_ORIGIN: 'https://api.example.test', NP_PROXY_SECRET: 'fixture-only-'.repeat(4) };
function response() {
  return { headers: {}, statusCode: 200, setHeader(k, v) { this.headers[k] = v; }, end(body) { this.body = body; } };
}
function request(overrides = {}) {
  return { url: '/api/proxy?np_path=auth/login', method: 'POST', headers: { 'x-vercel-forwarded-for': '192.0.2.10', 'content-type': 'application/json' }, body: { email: 'fixture@example.test', password: 'fixture' }, ...overrides };
}
test('preserves bodies, status and secure cookies; authenticates provider IP', async () => {
  let received;
  const handler = createProxy(env, async (url, options) => {
    received = { url, ...options };
    return new Response('{}', { status: 200, headers: { 'set-cookie': 'np_refresh=fixture; HttpOnly; Secure; SameSite=Strict; Path=/api/v1/auth' } });
  });
  const res = response();
  await handler(request(), res);
  assert.equal(received.url.href, 'https://api.example.test/api/v1/auth/login');
  assert.equal(received.headers.get('x-np-client-ip'), '192.0.2.10');
  assert.equal(received.headers.get('x-np-proxy-secret'), env.NP_PROXY_SECRET);
  assert.deepEqual(JSON.parse(received.body), request().body);
  assert.match(res.headers['Set-Cookie'][0], /HttpOnly; Secure; SameSite=Strict/);
  assert.equal(res.headers['Cache-Control'], 'private, no-store');
});
test('forwards refresh cookie, authorization, query and does not follow redirects', async () => {
  const handler = createProxy(env, async (url, options) => {
    assert.equal(url.search, '?limit=20&cursor=2');
    assert.equal(options.headers.get('cookie'), 'np_refresh=fixture');
    assert.equal(options.headers.get('authorization'), 'Bearer fixture');
    assert.equal(options.redirect, 'manual');
    return new Response(null, { status: 204 });
  });
  const res = response();
  await handler(request({ url: '/api/proxy?np_path=me/sessions&limit=20&cursor=2', method: 'GET', headers: { 'x-vercel-forwarded-for': '192.0.2.10', cookie: 'np_refresh=fixture', authorization: 'Bearer fixture' } }), res);
  assert.equal(res.statusCode, 204);
});
test('invalid config, IP, traversal and oversized payload are rejected without upstream calls', async () => {
  for (const [settings, req, status] of [
    [{ ...env, NP_BACKEND_ORIGIN: '' }, request(), 503],
    [env, request({ headers: {} }), 502],
    [env, request({ url: '/api/proxy?np_path=..%2Fadmin' }), 400],
    [env, request({ body: 'x'.repeat(262145) }), 413],
  ]) {
    const res = response();
    await createProxy(settings, () => { throw new Error('must not call upstream'); })(req, res);
    assert.equal(res.statusCode, status);
  }
});
test('upstream error is neutral and never exposes origin or secrets', async () => {
  const res = response();
  await createProxy(env, () => { throw new Error(env.NP_PROXY_SECRET); })(request(), res);
  assert.equal(res.statusCode, 502);
  assert.equal(JSON.parse(res.body).code, 'NETWORK_ERROR');
  assert.ok(!res.body.includes(env.NP_PROXY_SECRET));
});

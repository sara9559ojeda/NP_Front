import type { ErrorCode, FieldError, Problem, RefreshResponse } from './types';

// The access token lives only in this module's memory (contract §2.2). It is never
// written to localStorage, sessionStorage or a readable cookie; a reload loses it and
// the session is restored through POST /auth/refresh with the HttpOnly cookie.
let accessToken: string | null = null;
let refreshInFlight: Promise<boolean> | null = null;
let onSessionLost: (() => void) | null = null;

export function setAccessToken(token: string | null): void {
  accessToken = token;
}

export function hasAccessToken(): boolean {
  return accessToken !== null;
}

export function setSessionLostHandler(handler: (() => void) | null): void {
  onSessionLost = handler;
}

export class ApiError extends Error {
  readonly status: number;
  readonly code: ErrorCode | 'NETWORK_ERROR';
  readonly fieldErrors: FieldError[];

  constructor(status: number, code: ErrorCode | 'NETWORK_ERROR', fieldErrors: FieldError[] = []) {
    super(code);
    this.name = 'ApiError';
    this.status = status;
    this.code = code;
    this.fieldErrors = fieldErrors;
  }
}

function baseUrl(): string {
  const configured = import.meta.env.VITE_API_BASE_URL || '/api/v1';
  return new URL(configured, window.location.origin).toString().replace(/\/$/, '');
}

export function apiUrl(path: string, query?: Record<string, string | number | boolean | null | undefined>): string {
  const url = new URL(baseUrl() + path);
  if (query) {
    for (const [key, value] of Object.entries(query)) {
      if (value !== undefined && value !== null && value !== '') url.searchParams.set(key, String(value));
    }
  }
  return url.toString();
}

const FALLBACK_CODE_BY_STATUS: Record<number, ErrorCode> = {
  400: 'BAD_REQUEST',
  401: 'UNAUTHENTICATED',
  403: 'FORBIDDEN',
  404: 'NOT_FOUND',
  413: 'PAYLOAD_TOO_LARGE',
  422: 'VALIDATION_ERROR',
  423: 'ACCOUNT_DISABLED',
  429: 'RATE_LIMITED',
  503: 'STORAGE_UNAVAILABLE',
};

async function toApiError(response: Response): Promise<ApiError> {
  let problem: Partial<Problem> = {};
  try {
    problem = (await response.json()) as Partial<Problem>;
  } catch {
    // Body is not JSON; fall back to the status code.
  }
  const code = problem.code ?? FALLBACK_CODE_BY_STATUS[response.status] ?? 'SERVER_ERROR';
  return new ApiError(response.status, code, problem.errors ?? []);
}

interface RequestOptions {
  method?: string;
  body?: unknown;
  query?: Record<string, string | number | boolean | null | undefined>;
  accept?: string;
  /** Public routes (login, register) skip the token and the refresh retry. */
  anonymous?: boolean;
}

async function send(path: string, options: RequestOptions): Promise<Response> {
  const headers: Record<string, string> = { Accept: options.accept ?? 'application/json' };
  if (options.body !== undefined) headers['Content-Type'] = 'application/json';
  if (!options.anonymous && accessToken) headers.Authorization = `Bearer ${accessToken}`;
  try {
    return await fetch(apiUrl(path, options.query), {
      method: options.method ?? 'GET',
      headers,
      body: options.body === undefined ? undefined : JSON.stringify(options.body),
      credentials: 'include',
    });
  } catch {
    throw new ApiError(0, 'NETWORK_ERROR');
  }
}

/** POST /auth/refresh with the HttpOnly cookie. Only one refresh runs at a time. */
export function refreshAccessToken(): Promise<boolean> {
  if (!refreshInFlight) {
    refreshInFlight = (async () => {
      try {
        const response = await send('/auth/refresh', { method: 'POST', anonymous: true });
        if (!response.ok) return false;
        const data = (await response.json()) as RefreshResponse;
        accessToken = data.accessToken;
        return true;
      } catch {
        return false;
      } finally {
        refreshInFlight = null;
      }
    })();
  }
  return refreshInFlight;
}

export async function requestRaw(path: string, options: RequestOptions = {}): Promise<Response> {
  let response = await send(path, options);
  if (response.status === 401 && !options.anonymous) {
    const refreshed = await refreshAccessToken();
    if (refreshed) {
      response = await send(path, options);
      if (response.status === 401) {
        accessToken = null;
        onSessionLost?.();
      }
    } else {
      accessToken = null;
      onSessionLost?.();
    }
  }
  if (!response.ok) throw await toApiError(response);
  return response;
}

export async function request<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const response = await requestRaw(path, options);
  if (response.status === 204 || response.status === 202) {
    const text = await response.text();
    return (text ? JSON.parse(text) : undefined) as T;
  }
  return (await response.json()) as T;
}

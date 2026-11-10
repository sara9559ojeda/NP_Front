import '@testing-library/jest-dom/vitest';
import { afterAll, afterEach, beforeAll } from 'vitest';
import { cleanup } from '@testing-library/react';
import { server } from '../mocks/server';
import { resetDb } from '../mocks/handlers';
import { setAccessToken, setSessionLostHandler } from '../api/client';

// Node 25+ defines its own global localStorage/sessionStorage (undefined without
// --localstorage-file), which hides jsdom's. Use the jsdom storages instead.
const dom = (globalThis as { jsdom?: { window: Window } }).jsdom;
for (const name of ['localStorage', 'sessionStorage'] as const) {
  if (dom && globalThis[name] === undefined) {
    Object.defineProperty(globalThis, name, { value: dom.window[name], configurable: true });
  }
}

beforeAll(() => server.listen({ onUnhandledRequest: 'error' }));
afterEach(() => {
  cleanup();
  server.resetHandlers();
  resetDb();
  setAccessToken(null);
  setSessionLostHandler(null);
  document.cookie = 'np_refresh=; Max-Age=0; Path=/';
});
afterAll(() => server.close());

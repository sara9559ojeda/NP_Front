import '@testing-library/jest-dom/vitest';
import { afterAll, afterEach, beforeAll } from 'vitest';
import { cleanup } from '@testing-library/react';
import { server } from '../mocks/server';
import { resetDb } from '../mocks/handlers';
import { setAccessToken, setSessionLostHandler } from '../api/client';

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

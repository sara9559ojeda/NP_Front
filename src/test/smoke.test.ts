import { expect, test } from 'vitest';
import { auth, me } from '../api/endpoints';
import { setAccessToken } from '../api/client';
import { DEMO_PASSWORD } from '../mocks/fixtures';

test('el simulador autentica y devuelve únicamente el progreso propio', async () => {
  const session = await auth.login({ email: 'ana@example.com', password: DEMO_PASSWORD });
  setAccessToken(session.accessToken);
  expect((await me.get()).role).toBe('patient');
  expect((await me.progress()).sessionsCount).toBeGreaterThan(0);
});

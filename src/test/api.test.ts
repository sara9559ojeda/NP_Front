import { describe, expect, test, vi } from 'vitest';
import { http, HttpResponse } from 'msw';
import { server } from '../mocks/server';
import { auth, me, patients, admin, publicInfo } from '../api/endpoints';
import { hasAccessToken, request, setAccessToken, setSessionLostHandler } from '../api/client';
import { DEMO_PASSWORD, IDS } from '../mocks/fixtures';

async function login(email = 'ana@example.com') {
  const data = await auth.login({ email, password: DEMO_PASSWORD });
  setAccessToken(data.accessToken);
}
test('401 concurrentes comparten un refresco y reintentan una vez', async () => {
  let refreshes = 0;
  server.use(
    http.post('*/api/v1/auth/refresh', async () => {
      refreshes++;
      await new Promise(resolve => setTimeout(resolve, 30));
      return HttpResponse.json({ accessToken: 'renovado', expiresIn: 900 });
    }),
    http.get('*/api/v1/me', ({ request }) => request.headers.get('Authorization') === 'Bearer renovado'
      ? HttpResponse.json({ id: IDS.ana, role: 'patient' })
      : HttpResponse.json({ code: 'TOKEN_EXPIRED' }, { status: 401 })),
  );
  setAccessToken('caducado');
  await Promise.all([me.get(), me.get(), me.get()]);
  expect(refreshes).toBe(1);
});
test('un segundo 401 elimina el token y notifica la pérdida de sesión', async () => {
  const lost = vi.fn();
  setSessionLostHandler(lost);
  server.use(
    http.post('*/api/v1/auth/refresh', () => HttpResponse.json({ accessToken: 'rechazado', expiresIn: 900 })),
    http.get('*/api/v1/me', () => HttpResponse.json({ code: 'UNAUTHENTICATED' }, { status: 401 })),
  );
  await expect(me.get()).rejects.toMatchObject({ status: 401 });
  expect(hasAccessToken()).toBe(false);
  expect(lost).toHaveBeenCalledOnce();
});
test('un refresco fallido termina la sesión y no crea un bucle', async () => {
  const lost = vi.fn();
  setSessionLostHandler(lost);
  setAccessToken('inválido');
  await expect(me.get()).rejects.toMatchObject({ status: 401 });
  expect(hasAccessToken()).toBe(false);
  expect(lost).toHaveBeenCalledOnce();
});
test('login anónimo fallido nunca intenta refrescar', async () => {
  const refresh = vi.fn(() => HttpResponse.json({}, { status: 401 }));
  server.use(http.post('*/api/v1/auth/refresh', refresh));
  await expect(auth.login({ email: 'ana@example.com', password: 'incorrecta' })).rejects.toMatchObject({ code: 'INVALID_CREDENTIALS' });
  expect(refresh).not.toHaveBeenCalled();
});
test('el token solo vive en memoria y las peticiones incluyen credenciales', async () => {
  let credentials: RequestCredentials | undefined;
  server.use(http.get('*/api/v1/me', ({ request }) => {
    credentials = request.credentials;
    return HttpResponse.json({});
  }));
  await login();
  await me.get();
  expect(credentials).toBe('include');
  // MSW persists its simulated cookie jar in localStorage; that jar may hold
  // mock-refresh, but must never contain the access token.
  for (const storage of [localStorage, sessionStorage]) {
    for (let i = 0; i < storage.length; i++) {
      expect(storage.getItem(storage.key(i)!)).not.toContain('mock-access');
    }
  }
  expect(document.cookie).not.toContain('mock-access');
});
test('matriz de roles: paciente y administrador no leen datos clínicos ajenos', async () => {
  await login();
  await expect(patients.list()).rejects.toMatchObject({ status: 403 });
  await expect(admin.users()).rejects.toMatchObject({ status: 403 });
  await login('admin@neurophobia.test');
  await expect(patients.progress(IDS.ana)).rejects.toMatchObject({ status: 403 });
  await expect(me.progress()).rejects.toMatchObject({ status: 403 });
});
test('profesional recibe 404 para un paciente de otro profesional', async () => {
  await login('profesional@neurophobia.test');
  await expect(patients.progress(IDS.lucia)).rejects.toMatchObject({ status: 404 });
  await expect(patients.notes(IDS.lucia)).rejects.toMatchObject({ status: 404 });
});
test('paginación devuelve cursores y permite recorrer las sesiones', async () => {
  await login();
  const first = await me.sessions({ limit: 2 });
  const second = await me.sessions({ limit: 2, cursor: first.nextCursor });
  expect(first.items).toHaveLength(2);
  expect(second.items).toHaveLength(2);
  expect(second.items[0]?.sessionId).not.toBe(first.items[0]?.sessionId);
});
test.each([
  ['inactivo@neurophobia.test', DEMO_PASSWORD, 423, 'ACCOUNT_DISABLED'],
  ['error@neurophobia.test', DEMO_PASSWORD, 500, 'SERVER_ERROR'],
] as const)('errores simulados %s', async (email, password, status, code) => {
  await expect(auth.login({ email, password })).rejects.toMatchObject({ status, code });
});
test('cinco fallos activan el límite de intentos del simulador', async () => {
  for (let i = 0; i < 5; i++) await expect(auth.login({ email: 'ana@example.com', password: 'incorrecta' })).rejects.toMatchObject({ status: 401 });
  await expect(auth.login({ email: 'ana@example.com', password: DEMO_PASSWORD })).rejects.toMatchObject({ status: 429 });
});
test('registro sin consentimiento devuelve CONSENT_REQUIRED', async () => {
  await expect(auth.register({ fullName: 'Prueba', email: 'nueva@neurophobia.test', password: DEMO_PASSWORD, consent: { accepted: false, consentVersion: '2026-10-v1' } })).rejects.toMatchObject({ code: 'CONSENT_REQUIRED' });
});
test('no se puede desactivar el último administrador', async () => {
  await login('admin@neurophobia.test');
  await expect(admin.updateUser(IDS.admin, { active: false })).rejects.toMatchObject({ code: 'LAST_ADMIN' });
});
test('la exportación no contiene identidad y cambia los identificadores', async () => {
  await login('admin@neurophobia.test');
  const first = await request<unknown[]>('/admin/exports/analysis-dataset');
  const second = await request<unknown[]>('/admin/exports/analysis-dataset');
  const json = JSON.stringify(first);
  expect(json).not.toContain(IDS.ana);
  expect(json).not.toContain('ana@example.com');
  expect(json).not.toContain('Ana Pérez');
  expect(json).not.toContain('pseudonym');
  expect(first).not.toEqual(second);
});

describe('contrato v1.1.0', () => {
  test('la información del producto es pública y declara su estado de aprobación', async () => {
    const info = await publicInfo.product();
    expect(info.howItWorks.map(step => step.order)).toEqual([1, 2, 3, 4, 5]);
    expect(info.contentStatus).toBe('pendiente_de_aprobacion');
  });
  test('el paciente ajusta el grado de fobia y lo ve en el estado de la terapia', async () => {
    await login();
    const before = await me.therapy();
    expect(before).toMatchObject({ phobiaGrade: 3, pairedDevices: 1, openSession: null });
    expect(before.lastFeedback?.analysis.clinicalStatus).toBe('pendiente_de_validar');
    await expect(me.setPhobiaGrade({ phobiaGrade: 4 })).resolves.toMatchObject({ phobiaGrade: 4 });
    expect((await me.therapy()).phobiaGrade).toBe(4);
  });
  test.each([
    [6, 'out_of_range'],
    [2.5, 'invalid_type'],
    ['3', 'invalid_type'],
  ] as const)('el grado %s se rechaza con %s', async (value, code) => {
    await login();
    await expect(me.setPhobiaGrade({ phobiaGrade: value as number })).rejects.toMatchObject({
      status: 422,
      fieldErrors: [{ field: 'phobiaGrade', code }],
    });
  });
  test('solo el paciente consulta su terapia', async () => {
    await login('profesional@neurophobia.test');
    await expect(me.therapy()).rejects.toMatchObject({ status: 403 });
    await expect(me.setPhobiaGrade({ phobiaGrade: 2 })).rejects.toMatchObject({ status: 403 });
  });
  test('el profesional lee la retroalimentación de sus pacientes, sin sesiones de prueba', async () => {
    await login('profesional@neurophobia.test');
    const page = await patients.feedback(IDS.ana);
    expect(page.items).toHaveLength(5);
    expect(page.items[0]).toMatchObject({ notesCount: 1, analysis: { clinicalStatus: 'pendiente_de_validar' } });
    await expect(patients.feedback(IDS.lucia)).rejects.toMatchObject({ status: 404 });
    await login();
    await expect(patients.feedback(IDS.ana)).rejects.toMatchObject({ status: 403 });
  });
  test('la nota creada vuelve completa y las notas se filtran por sesión', async () => {
    await login('profesional@neurophobia.test');
    const sessionId = 'a3b9e2c4-0001-4d5e-8f60-000000000005';
    const created = await patients.createNote(IDS.ana, { text: 'Nota ficticia.', sessionId });
    expect(created).toMatchObject({ text: 'Nota ficticia.', sessionId, authorUserId: IDS.professional, authorName: 'Marta Gómez' });
    const filtered = await patients.notes(IDS.ana, { sessionId });
    expect(filtered.items.map(n => n.noteId)).toContain(created.noteId);
    expect(filtered.items.every(n => n.sessionId === sessionId)).toBe(true);
  });
  test('el administrador edita el perfil completo y asigna una contraseña temporal', async () => {
    await login('admin@neurophobia.test');
    expect(await admin.user(IDS.carlos)).toMatchObject({ fullName: 'Carlos Ruiz', role: 'patient' });
    await expect(admin.updateUser(IDS.carlos, { email: 'ana@example.com' })).rejects.toMatchObject({ status: 409, code: 'EMAIL_TAKEN' });
    await expect(admin.updateUser(IDS.carlos, { fullName: 'Carlos R.', email: 'carlos.r@neurophobia.test' })).resolves.toMatchObject({ fullName: 'Carlos R.' });
    await expect(admin.resetPassword(IDS.carlos, { temporaryPassword: 'corta' })).rejects.toMatchObject({ status: 422 });
    await admin.resetPassword(IDS.carlos, { temporaryPassword: 'temporal-2026' });
    await expect(auth.login({ email: 'carlos.r@neurophobia.test', password: 'temporal-2026' })).resolves.toMatchObject({ user: { id: IDS.carlos } });
  });
  test('un 503 STORAGE_UNAVAILABLE es temporal y no cierra la sesión', async () => {
    const lost = vi.fn();
    setSessionLostHandler(lost);
    await login();
    server.use(http.get('*/api/v1/me/therapy', () => HttpResponse.json(
      { type: 'https://neurophobia/errors/storage-unavailable', title: 'Almacenamiento no disponible', status: 503, code: 'STORAGE_UNAVAILABLE' },
      { status: 503, headers: { 'Content-Type': 'application/problem+json', 'Retry-After': '5' } },
    )));
    await expect(me.therapy()).rejects.toMatchObject({ status: 503, code: 'STORAGE_UNAVAILABLE' });
    expect(hasAccessToken()).toBe(true);
    expect(lost).not.toHaveBeenCalled();
  });
});

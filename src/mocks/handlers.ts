// Simulated API v1 server (MSW). Follows docs/api/CONTRATO_API_v1.md (contract v1.1.0):
// routes, role matrix (§2.3, including 404 for patients that are not assigned), pagination
// (§1) and the problem+json errors of §8.
import { http, HttpResponse, type HttpHandler } from 'msw';
import type {
  ErrorCode,
  FieldError,
  Page,
  PatientFeedback,
  PatientListItem,
  Progress,
  Role,
  SessionDetail,
  SessionFeedback,
  SessionSummary,
  TherapyState,
} from '../api/types';
import { CONSENT_VERSION, createDb, PRODUCT_INFO, type MockDb, type MockNote, type MockUser } from './fixtures';

const BASE = '*/api/v1';
const ACCESS_TTL_SECONDS = 900;
const MAX_FAILED_LOGINS = 5;
const PAIRING_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

let db: MockDb = createDb();
let counter = 0;
let persistentRefresh = false;

export function resetDb(): void {
  db = createDb();
  counter = 0;
}

const TITLES: Record<number, string> = {
  400: 'Solicitud mal formada',
  401: 'No autenticado',
  403: 'Sin permiso',
  404: 'No encontrado',
  409: 'Conflicto',
  410: 'Caducado',
  422: 'Datos no válidos',
  423: 'Cuenta desactivada',
  429: 'Demasiados intentos',
  500: 'Error interno',
  503: 'Almacenamiento no disponible',
};

function problem(status: number, code: ErrorCode, errors?: FieldError[]) {
  return HttpResponse.json(
    {
      type: `https://neurophobia/errors/${code.toLowerCase().replace(/_/g, '-')}`,
      title: TITLES[status] ?? 'Error',
      status,
      code,
      ...(errors ? { detail: 'Revisa los campos marcados.', errors } : {}),
    },
    { status, headers: { 'Content-Type': 'application/problem+json' } },
  );
}

function uuid(): string {
  return crypto.randomUUID();
}

function now(): string {
  return new Date().toISOString().replace(/\.\d{3}Z$/, 'Z');
}

function paginate<T>(items: T[], url: URL): Page<T> {
  const limit = Math.min(Math.max(Number(url.searchParams.get('limit') ?? 20) || 20, 1), 100);
  const start = Number(url.searchParams.get('cursor') ?? 0) || 0;
  const slice = items.slice(start, start + limit);
  const next = start + limit < items.length ? String(start + limit) : null;
  return { items: slice, nextCursor: next };
}

async function readJson<T>(request: Request): Promise<T | null> {
  try {
    return (await request.json()) as T;
  } catch {
    return null;
  }
}

type AuthResult = { user: MockUser } | { response: Response };

function authenticate(request: Request, roles?: Role[]): AuthResult {
  const header = request.headers.get('Authorization') ?? '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : '';
  const userId = db.accessTokens.get(token);
  const user = db.users.find((u) => u.id === userId);
  if (!user || !user.active) return { response: problem(401, token ? 'TOKEN_EXPIRED' : 'UNAUTHENTICATED') };
  if (roles && !roles.includes(user.role)) return { response: problem(403, 'FORBIDDEN') };
  return { user };
}

function issueAccessToken(userId: string): string {
  counter += 1;
  const token = `mock-access.${userId}.${counter}`;
  db.accessTokens.set(token, userId);
  return token;
}

function issueRefreshCookie(userId: string): string {
  counter += 1;
  const token = `mock-refresh.${userId}.${counter}`;
  db.refreshTokens.add(token);
  // The real backend sets HttpOnly; Secure; SameSite=Strict; Path=/api/v1/auth (§2.2).
  // In the browser mock the cookie has to be readable by MSW, so it is a plain cookie.
  return `np_refresh=${token}; Path=/; SameSite=Strict`;
}

function isAssigned(professionalId: string, patientId: string): boolean {
  return db.assignments.some((a) => a.professionalId === professionalId && a.patientId === patientId);
}

/** Patient visible to the caller, or 404 (never 403, to avoid revealing it exists). */
function patientFor(caller: MockUser, patientId: string): MockUser | null {
  const patient = db.users.find((u) => u.id === patientId && u.role === 'patient');
  if (!patient) return null;
  if (caller.role === 'professional' && isAssigned(caller.id, patientId)) return patient;
  return null;
}

function summary(s: SessionDetail): SessionSummary {
  return {
    sessionId: s.sessionId,
    startedAt: s.startedAt,
    levelReached: s.levelReached,
    totalDurationSeconds: s.totalDurationSeconds,
    recommendation: s.analysis?.recommendation ?? null,
    toleranceIndex: s.analysis?.toleranceIndex ?? null,
  };
}

function sessionsNewestFirst(patientId: string): SessionDetail[] {
  return [...(db.sessions[patientId] ?? [])].sort((a, b) => (b.startedAt ?? '').localeCompare(a.startedAt ?? ''));
}

function progress(patient: MockUser): Progress {
  const sessions = sessionsNewestFirst(patient.id);
  return {
    sessionsCount: sessions.length,
    levelReached: sessions.reduce((max, s) => Math.max(max, s.levelReached ?? 0), 0),
    lastSessions: sessions.slice(0, 10).map(summary),
    allowedStartLevel: patient.allowedStartLevel ?? 1,
  };
}

/** Closed, non-test sessions that already have their analysis saved (newest first). */
function analysedSessions(patientId: string): (SessionDetail & { analysis: NonNullable<SessionDetail['analysis']> })[] {
  return sessionsNewestFirst(patientId).filter(
    (s): s is SessionDetail & { analysis: NonNullable<SessionDetail['analysis']> } => !s.testSession && s.analysis !== null,
  );
}

function sessionFeedback(s: SessionDetail & { analysis: NonNullable<SessionDetail['analysis']> }): SessionFeedback {
  return {
    sessionId: s.sessionId,
    startedAt: s.startedAt,
    endedAt: s.endedAt,
    phobiaGrade: s.phobiaGrade,
    levelReached: s.levelReached,
    endReason: s.endReason,
    analysis: { ...s.analysis, createdAt: s.analysis.createdAt ?? s.endedAt ?? now() },
  };
}

function therapy(patient: MockUser): TherapyState {
  const closed = sessionsNewestFirst(patient.id).filter((s) => !s.testSession);
  const last = closed[0];
  const lastAnalysed = analysedSessions(patient.id)[0];
  return {
    phobiaGrade: patient.phobiaGrade ?? null,
    phobiaGradeUpdatedAt: patient.phobiaGradeUpdatedAt ?? null,
    allowedStartLevel: patient.allowedStartLevel ?? 1,
    pairedDevices: (db.devices[patient.id] ?? []).filter((d) => !d.revokedAt).length,
    openSession: db.openSessions[patient.id] ?? null,
    lastSession: last
      ? {
          sessionId: last.sessionId,
          startedAt: last.startedAt,
          levelReached: last.levelReached,
          totalDurationSeconds: last.totalDurationSeconds,
          recommendation: last.analysis?.recommendation ?? null,
        }
      : null,
    lastFeedback: lastAnalysed ? sessionFeedback(lastAnalysed) : null,
  };
}

function adminView({ id, fullName, email, role, active }: MockUser) {
  return { id, fullName, email, role, active };
}

function pairingCode() {
  const pick = () => PAIRING_ALPHABET[Math.floor(Math.random() * PAIRING_ALPHABET.length)];
  const code = `${pick()}${pick()}${pick()}-${pick()}${pick()}${pick()}`;
  return { code, expiresAt: new Date(Date.now() + 10 * 60 * 1000).toISOString() };
}

function validateProfile(body: { fullName?: unknown; email?: unknown }, required: boolean): FieldError[] {
  const errors: FieldError[] = [];
  if (body.fullName !== undefined || required) {
    if (typeof body.fullName !== 'string' || body.fullName.trim().length === 0) errors.push({ field: 'fullName', code: 'required' });
    else if (body.fullName.length > 120) errors.push({ field: 'fullName', code: 'too_long' });
  }
  if (body.email !== undefined || required) {
    if (typeof body.email !== 'string' || body.email.length === 0) errors.push({ field: 'email', code: 'required' });
    else if (!EMAIL_RE.test(body.email)) errors.push({ field: 'email', code: 'invalid_format' });
  }
  return errors;
}

function emailTaken(email: string, exceptId?: string): boolean {
  const normalized = email.trim().toLowerCase();
  return db.users.some((u) => u.email.toLowerCase() === normalized && u.id !== exceptId);
}

export const handlers: HttpHandler[] = [
  http.get(`${BASE}/health`, () => HttpResponse.json({ status: 'ok', version: 'mock-0.2.0' })),

  // v1.1.0 product information, public
  http.get(`${BASE}/public/product-info`, () =>
    HttpResponse.json(PRODUCT_INFO, { headers: { 'Cache-Control': 'public, max-age=300' } }),
  ),

  // §4.1
  http.post(`${BASE}/auth/register`, async ({ request }) => {
    const body = await readJson<{ fullName?: string; email?: string; password?: string; consent?: { accepted?: boolean; consentVersion?: string } }>(request);
    if (!body) return problem(400, 'BAD_REQUEST');
    if (body.consent?.accepted !== true) return problem(422, 'CONSENT_REQUIRED');
    const errors = validateProfile(body, true);
    if (typeof body.password !== 'string' || body.password.length < 8) errors.push({ field: 'password', code: 'too_short' });
    if (errors.length) return problem(422, 'VALIDATION_ERROR', errors);
    if (emailTaken(body.email!)) return problem(409, 'EMAIL_TAKEN');
    const user: MockUser = {
      id: uuid(),
      email: body.email!.trim(),
      fullName: body.fullName!.trim(),
      role: 'patient',
      active: true,
      password: body.password!,
      consents: [{ consentVersion: body.consent.consentVersion ?? CONSENT_VERSION, grantedAt: now(), withdrawnAt: null }],
      allowedStartLevel: 1,
    };
    db.users.push(user);
    db.sessions[user.id] = [];
    return HttpResponse.json({ userId: user.id, role: user.role }, { status: 201 });
  }),

  // §4.2
  http.post(`${BASE}/auth/login`, async ({ request }) => {
    const body = await readJson<{ email?: string; password?: string }>(request);
    if (!body) return problem(400, 'BAD_REQUEST');
    const email = (body.email ?? '').trim().toLowerCase();
    if (email === 'error@neurophobia.test') return problem(500, 'SERVER_ERROR');
    if ((db.failedLogins.get(email) ?? 0) >= MAX_FAILED_LOGINS) return problem(429, 'RATE_LIMITED');
    const user = db.users.find((u) => u.email.toLowerCase() === email);
    if (!user || user.password !== body.password) {
      db.failedLogins.set(email, (db.failedLogins.get(email) ?? 0) + 1);
      return problem(401, 'INVALID_CREDENTIALS');
    }
    if (!user.active) return problem(423, 'ACCOUNT_DISABLED');
    db.failedLogins.delete(email);
    return HttpResponse.json(
      { accessToken: issueAccessToken(user.id), expiresIn: ACCESS_TTL_SECONDS, user: { id: user.id, role: user.role } },
      { headers: { 'Set-Cookie': issueRefreshCookie(user.id) } },
    );
  }),

  http.post(`${BASE}/auth/refresh`, ({ cookies }) => {
    const token = cookies.np_refresh ?? '';
    const userId = token.split('.')[1];
    const user = db.users.find((u) => u.id === userId && u.active);
    // Tokens issued before a page reload are accepted while the user stays active,
    // because the in-memory mock database is rebuilt on every reload.
    const known = db.refreshTokens.has(token) || (persistentRefresh && token.startsWith('mock-refresh.'));
    if (!user || !known) return problem(401, 'UNAUTHENTICATED');
    db.refreshTokens.delete(token);
    return HttpResponse.json(
      { accessToken: issueAccessToken(user.id), expiresIn: ACCESS_TTL_SECONDS },
      { headers: { 'Set-Cookie': issueRefreshCookie(user.id) } },
    );
  }),

  http.post(`${BASE}/auth/logout`, ({ cookies }) => {
    if (cookies.np_refresh) db.refreshTokens.delete(cookies.np_refresh);
    return new HttpResponse(null, { status: 204, headers: { 'Set-Cookie': 'np_refresh=; Path=/; Max-Age=0; SameSite=Strict' } });
  }),

  // §4.3
  http.get(`${BASE}/me`, ({ request }) => {
    const auth = authenticate(request);
    if ('response' in auth) return auth.response;
    const { id, role, fullName, email, consents } = auth.user;
    return HttpResponse.json({ id, role, fullName, email, consents });
  }),

  http.patch(`${BASE}/me`, async ({ request }) => {
    const auth = authenticate(request);
    if ('response' in auth) return auth.response;
    const body = await readJson<{ fullName?: string; email?: string }>(request);
    if (!body) return problem(400, 'BAD_REQUEST');
    const errors = validateProfile(body, false);
    if (errors.length) return problem(422, 'VALIDATION_ERROR', errors);
    if (body.email && emailTaken(body.email, auth.user.id)) return problem(409, 'EMAIL_TAKEN');
    if (body.fullName !== undefined) auth.user.fullName = body.fullName.trim();
    if (body.email !== undefined) auth.user.email = body.email.trim();
    const { id, role, fullName, email, consents } = auth.user;
    return HttpResponse.json({ id, role, fullName, email, consents });
  }),

  http.put(`${BASE}/me/password`, async ({ request }) => {
    const auth = authenticate(request);
    if ('response' in auth) return auth.response;
    const body = await readJson<{ currentPassword?: string; newPassword?: string }>(request);
    if (!body) return problem(400, 'BAD_REQUEST');
    const errors: FieldError[] = [];
    if (body.currentPassword !== auth.user.password) errors.push({ field: 'currentPassword', code: 'wrong_password' });
    if (typeof body.newPassword !== 'string' || body.newPassword.length < 8) errors.push({ field: 'newPassword', code: 'too_short' });
    if (errors.length) return problem(422, 'VALIDATION_ERROR', errors);
    auth.user.password = body.newPassword!;
    return new HttpResponse(null, { status: 204 });
  }),

  http.post(`${BASE}/me/consents/withdraw`, ({ request }) => {
    const auth = authenticate(request);
    if ('response' in auth) return auth.response;
    const user = auth.user;
    user.consents = user.consents.map((c) => (c.withdrawnAt ? c : { ...c, withdrawnAt: now() }));
    user.active = false;
    user.fullName = '';
    for (const [token, owner] of db.accessTokens) if (owner === user.id) db.accessTokens.delete(token);
    db.assignments = db.assignments.filter((a) => a.patientId !== user.id);
    return new HttpResponse(null, { status: 202 });
  }),

  // §5.2 and §6.1 (patient)
  http.get(`${BASE}/me/progress`, ({ request }) => {
    const auth = authenticate(request, ['patient']);
    if ('response' in auth) return auth.response;
    return HttpResponse.json(progress(auth.user));
  }),

  // v1.1.0 therapy state and phobia grade (BPMN "Ajustar grado de fobia" before "Comenzar")
  http.get(`${BASE}/me/therapy`, ({ request }) => {
    const auth = authenticate(request, ['patient']);
    if ('response' in auth) return auth.response;
    return HttpResponse.json(therapy(auth.user));
  }),

  http.put(`${BASE}/me/phobia-grade`, async ({ request }) => {
    const auth = authenticate(request, ['patient']);
    if ('response' in auth) return auth.response;
    const body = await readJson<{ phobiaGrade?: unknown }>(request);
    if (!body) return problem(400, 'BAD_REQUEST');
    const grade = body.phobiaGrade;
    if (grade === undefined || grade === null) return problem(422, 'VALIDATION_ERROR', [{ field: 'phobiaGrade', code: 'required' }]);
    if (typeof grade !== 'number' || !Number.isInteger(grade)) {
      return problem(422, 'VALIDATION_ERROR', [{ field: 'phobiaGrade', code: 'invalid_type' }]);
    }
    if (grade < 1 || grade > 5) return problem(422, 'VALIDATION_ERROR', [{ field: 'phobiaGrade', code: 'out_of_range' }]);
    auth.user.phobiaGrade = grade;
    auth.user.phobiaGradeUpdatedAt = now();
    return HttpResponse.json({ phobiaGrade: grade, updatedAt: auth.user.phobiaGradeUpdatedAt });
  }),

  http.get(`${BASE}/me/sessions`, ({ request }) => {
    const auth = authenticate(request, ['patient']);
    if ('response' in auth) return auth.response;
    return HttpResponse.json(paginate(sessionsNewestFirst(auth.user.id).map(summary), new URL(request.url)));
  }),

  http.get(`${BASE}/me/sessions/:sessionId`, ({ request, params }) => {
    const auth = authenticate(request, ['patient']);
    if ('response' in auth) return auth.response;
    const found = (db.sessions[auth.user.id] ?? []).find((s) => s.sessionId === params.sessionId);
    return found ? HttpResponse.json(found) : problem(404, 'NOT_FOUND');
  }),

  http.get(`${BASE}/me/devices`, ({ request }) => {
    const auth = authenticate(request, ['patient']);
    if ('response' in auth) return auth.response;
    return HttpResponse.json(paginate(db.devices[auth.user.id] ?? [], new URL(request.url)));
  }),

  http.delete(`${BASE}/me/devices/:deviceId`, ({ request, params }) => {
    const auth = authenticate(request, ['patient']);
    if ('response' in auth) return auth.response;
    const device = (db.devices[auth.user.id] ?? []).find((d) => d.deviceId === params.deviceId);
    if (!device) return problem(404, 'NOT_FOUND');
    device.revokedAt = device.revokedAt ?? now();
    return new HttpResponse(null, { status: 204 });
  }),

  http.post(`${BASE}/pairing-codes`, ({ request }) => {
    const auth = authenticate(request, ['patient']);
    if ('response' in auth) return auth.response;
    return HttpResponse.json(pairingCode(), { status: 201 });
  }),

  // §5.1 (professional)
  http.get(`${BASE}/patients`, ({ request }) => {
    const auth = authenticate(request, ['professional']);
    if ('response' in auth) return auth.response;
    const items: PatientListItem[] = db.assignments
      .filter((a) => a.professionalId === auth.user.id)
      .map((a) => db.users.find((u) => u.id === a.patientId))
      .filter((u): u is MockUser => Boolean(u && u.active))
      .map((u) => {
        const last = sessionsNewestFirst(u.id)[0];
        return {
          patientId: u.id,
          fullName: u.fullName,
          lastSessionAt: last?.startedAt ?? null,
          levelReached: last ? progress(u).levelReached : null,
          lastRecommendation: sessionsNewestFirst(u.id).find((s) => s.analysis)?.analysis?.recommendation ?? null,
          phobiaGrade: u.phobiaGrade ?? null,
        };
      });
    return HttpResponse.json(paginate(items, new URL(request.url)));
  }),

  http.get(`${BASE}/patients/:patientId/progress`, ({ request, params }) => {
    const auth = authenticate(request, ['professional']);
    if ('response' in auth) return auth.response;
    const patient = patientFor(auth.user, String(params.patientId));
    return patient ? HttpResponse.json(progress(patient)) : problem(404, 'NOT_FOUND');
  }),

  http.get(`${BASE}/patients/:patientId/sessions`, ({ request, params }) => {
    const auth = authenticate(request, ['professional']);
    if ('response' in auth) return auth.response;
    const patient = patientFor(auth.user, String(params.patientId));
    if (!patient) return problem(404, 'NOT_FOUND');
    return HttpResponse.json(paginate(sessionsNewestFirst(patient.id).map(summary), new URL(request.url)));
  }),

  http.get(`${BASE}/patients/:patientId/sessions/:sessionId`, ({ request, params }) => {
    const auth = authenticate(request, ['professional']);
    if ('response' in auth) return auth.response;
    const patient = patientFor(auth.user, String(params.patientId));
    const found = patient && (db.sessions[patient.id] ?? []).find((s) => s.sessionId === params.sessionId);
    return found ? HttpResponse.json(found) : problem(404, 'NOT_FOUND');
  }),

  // v1.1.0 AI feedback per session, newest first; only sessions with a saved analysis
  http.get(`${BASE}/patients/:patientId/feedback`, ({ request, params }) => {
    const auth = authenticate(request, ['professional']);
    if ('response' in auth) return auth.response;
    const patient = patientFor(auth.user, String(params.patientId));
    if (!patient) return problem(404, 'NOT_FOUND');
    const notes = db.notes[patient.id] ?? [];
    const items: PatientFeedback[] = analysedSessions(patient.id).map((s) => ({
      ...sessionFeedback(s),
      notesCount: notes.filter((n) => n.sessionId === s.sessionId).length,
    }));
    return HttpResponse.json(paginate(items, new URL(request.url)));
  }),

  http.put(`${BASE}/patients/:patientId/plan`, async ({ request, params }) => {
    const auth = authenticate(request, ['professional']);
    if ('response' in auth) return auth.response;
    const patient = patientFor(auth.user, String(params.patientId));
    if (!patient) return problem(404, 'NOT_FOUND');
    const body = await readJson<{ allowedStartLevel?: number }>(request);
    const level = body?.allowedStartLevel;
    if (typeof level !== 'number' || !Number.isInteger(level) || level < 1 || level > 5) {
      return problem(422, 'VALIDATION_ERROR', [{ field: 'allowedStartLevel', code: 'out_of_range' }]);
    }
    patient.allowedStartLevel = level;
    return HttpResponse.json({ patientId: patient.id, allowedStartLevel: level, updatedAt: now() });
  }),

  http.get(`${BASE}/patients/:patientId/notes`, ({ request, params }) => {
    const auth = authenticate(request, ['professional']);
    if ('response' in auth) return auth.response;
    const patient = patientFor(auth.user, String(params.patientId));
    if (!patient) return problem(404, 'NOT_FOUND');
    const url = new URL(request.url);
    const sessionId = url.searchParams.get('sessionId');
    const notes = [...(db.notes[patient.id] ?? [])]
      .filter((n) => !sessionId || n.sessionId === sessionId)
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    return HttpResponse.json(paginate(notes, url));
  }),

  http.post(`${BASE}/patients/:patientId/notes`, async ({ request, params }) => {
    const auth = authenticate(request, ['professional']);
    if ('response' in auth) return auth.response;
    const patient = patientFor(auth.user, String(params.patientId));
    if (!patient) return problem(404, 'NOT_FOUND');
    const body = await readJson<{ text?: string; sessionId?: string }>(request);
    if (!body) return problem(400, 'BAD_REQUEST');
    const errors: FieldError[] = [];
    if (typeof body.text !== 'string' || body.text.trim().length === 0) errors.push({ field: 'text', code: 'required' });
    if (body.sessionId && !(db.sessions[patient.id] ?? []).some((s) => s.sessionId === body.sessionId)) {
      errors.push({ field: 'sessionId', code: 'invalid_format' });
    }
    if (errors.length) return problem(422, 'VALIDATION_ERROR', errors);
    const note: MockNote = {
      noteId: uuid(),
      text: body.text!.trim(),
      sessionId: body.sessionId ?? null,
      authorId: auth.user.id,
      authorName: auth.user.fullName,
      createdAt: now(),
      editedAt: null,
    };
    (db.notes[patient.id] ??= []).push(note);
    // v1.1.0: 201 returns the whole stored note.
    return HttpResponse.json(note, { status: 201 });
  }),

  http.patch(`${BASE}/patients/:patientId/notes/:noteId`, async ({ request, params }) => {
    const auth = authenticate(request, ['professional']);
    if ('response' in auth) return auth.response;
    const patient = patientFor(auth.user, String(params.patientId));
    const note = patient && (db.notes[patient.id] ?? []).find((n) => n.noteId === params.noteId);
    if (!note) return problem(404, 'NOT_FOUND');
    if (note.authorId !== auth.user.id) return problem(403, 'FORBIDDEN');
    const body = await readJson<{ text?: string }>(request);
    if (typeof body?.text !== 'string' || body.text.trim().length === 0) {
      return problem(422, 'VALIDATION_ERROR', [{ field: 'text', code: 'required' }]);
    }
    note.text = body.text.trim();
    note.editedAt = now();
    return HttpResponse.json(note);
  }),

  http.post(`${BASE}/patients/:patientId/pairing-codes`, ({ request, params }) => {
    const auth = authenticate(request, ['professional']);
    if ('response' in auth) return auth.response;
    const patient = patientFor(auth.user, String(params.patientId));
    return patient ? HttpResponse.json(pairingCode(), { status: 201 }) : problem(404, 'NOT_FOUND');
  }),

  // §4.4 (admin: profiles only, no clinical data)
  http.get(`${BASE}/admin/users`, ({ request }) => {
    const auth = authenticate(request, ['admin']);
    if ('response' in auth) return auth.response;
    const url = new URL(request.url);
    const role = url.searchParams.get('role');
    const active = url.searchParams.get('active');
    const q = (url.searchParams.get('q') ?? '').trim().toLowerCase();
    const items = db.users
      .filter((u) => u.fullName || u.active)
      .filter((u) => !role || u.role === role)
      .filter((u) => active === null || String(u.active) === active)
      .filter((u) => !q || u.fullName.toLowerCase().includes(q) || u.email.toLowerCase().includes(q))
      .map(adminView);
    return HttpResponse.json(paginate(items, url));
  }),

  http.post(`${BASE}/admin/users`, async ({ request }) => {
    const auth = authenticate(request, ['admin']);
    if ('response' in auth) return auth.response;
    const body = await readJson<{ fullName?: string; email?: string; role?: Role; temporaryPassword?: string }>(request);
    if (!body) return problem(400, 'BAD_REQUEST');
    const errors = validateProfile(body, true);
    if (!body.role || !['patient', 'professional', 'admin'].includes(body.role)) errors.push({ field: 'role', code: 'required' });
    if (typeof body.temporaryPassword !== 'string' || body.temporaryPassword.length < 8) errors.push({ field: 'temporaryPassword', code: 'too_short' });
    if (errors.length) return problem(422, 'VALIDATION_ERROR', errors);
    if (emailTaken(body.email!)) return problem(409, 'EMAIL_TAKEN');
    const user: MockUser = {
      id: uuid(),
      email: body.email!.trim(),
      fullName: body.fullName!.trim(),
      role: body.role!,
      active: true,
      password: body.temporaryPassword!,
      consents: [],
      allowedStartLevel: body.role === 'patient' ? 1 : undefined,
    };
    db.users.push(user);
    if (user.role === 'patient') db.sessions[user.id] = [];
    return HttpResponse.json(adminView(user), { status: 201 });
  }),

  // v1.1.0 full profile for "Gestionar perfiles"
  http.get(`${BASE}/admin/users/:userId`, ({ request, params }) => {
    const auth = authenticate(request, ['admin']);
    if ('response' in auth) return auth.response;
    const user = db.users.find((u) => u.id === params.userId);
    return user ? HttpResponse.json(adminView(user)) : problem(404, 'NOT_FOUND');
  }),

  // v1.1.0 temporary password; closes every web session of that user
  http.put(`${BASE}/admin/users/:userId/password`, async ({ request, params }) => {
    const auth = authenticate(request, ['admin']);
    if ('response' in auth) return auth.response;
    const user = db.users.find((u) => u.id === params.userId);
    if (!user) return problem(404, 'NOT_FOUND');
    if (user.consents.some((c) => c.withdrawnAt)) return problem(422, 'VALIDATION_ERROR', [{ field: 'userId', code: 'withdrawn' }]);
    const body = await readJson<{ temporaryPassword?: unknown }>(request);
    const password = body?.temporaryPassword;
    if (typeof password !== 'string' || password.length < 8) {
      return problem(422, 'VALIDATION_ERROR', [{ field: 'temporaryPassword', code: 'too_short' }]);
    }
    if (password.length > 128) return problem(422, 'VALIDATION_ERROR', [{ field: 'temporaryPassword', code: 'too_long' }]);
    user.password = password;
    for (const [token, owner] of db.accessTokens) if (owner === user.id) db.accessTokens.delete(token);
    for (const token of db.refreshTokens) if (token.split('.')[1] === user.id) db.refreshTokens.delete(token);
    return new HttpResponse(null, { status: 204 });
  }),

  http.patch(`${BASE}/admin/users/:userId`, async ({ request, params }) => {
    const auth = authenticate(request, ['admin']);
    if ('response' in auth) return auth.response;
    const user = db.users.find((u) => u.id === params.userId);
    if (!user) return problem(404, 'NOT_FOUND');
    const body = await readJson<{ role?: Role; active?: boolean; fullName?: string; email?: string }>(request);
    if (!body) return problem(400, 'BAD_REQUEST');
    const errors = validateProfile(body, false);
    if (body.role !== undefined && !['patient', 'professional', 'admin'].includes(body.role)) {
      errors.push({ field: 'role', code: 'invalid_format' });
    }
    if (errors.length) return problem(422, 'VALIDATION_ERROR', errors);
    if (body.email && emailTaken(body.email, user.id)) return problem(409, 'EMAIL_TAKEN');
    const losesAdmin = user.role === 'admin' && user.active && ((body.role && body.role !== 'admin') || body.active === false);
    const activeAdmins = db.users.filter((u) => u.role === 'admin' && u.active).length;
    if (losesAdmin && activeAdmins <= 1) return problem(409, 'LAST_ADMIN');
    if (body.role !== undefined) user.role = body.role;
    if (body.active !== undefined) user.active = body.active;
    if (body.fullName !== undefined) user.fullName = body.fullName.trim();
    if (body.email !== undefined) user.email = body.email.trim();
    return HttpResponse.json(adminView(user));
  }),

  http.get(`${BASE}/admin/assignments`, ({ request }) => {
    const auth = authenticate(request, ['admin']);
    if ('response' in auth) return auth.response;
    const url = new URL(request.url);
    const professionalId = url.searchParams.get('professionalId');
    const items = db.assignments.filter((a) => !professionalId || a.professionalId === professionalId);
    return HttpResponse.json(paginate(items, url));
  }),

  http.post(`${BASE}/admin/assignments`, async ({ request }) => {
    const auth = authenticate(request, ['admin']);
    if ('response' in auth) return auth.response;
    const body = await readJson<{ professionalId?: string; patientId?: string }>(request);
    if (!body) return problem(400, 'BAD_REQUEST');
    const errors: FieldError[] = [];
    if (!db.users.some((u) => u.id === body.professionalId && u.role === 'professional')) errors.push({ field: 'professionalId', code: 'invalid_format' });
    if (!db.users.some((u) => u.id === body.patientId && u.role === 'patient')) errors.push({ field: 'patientId', code: 'invalid_format' });
    if (!errors.length && isAssigned(body.professionalId!, body.patientId!)) errors.push({ field: 'patientId', code: 'already_assigned' });
    if (errors.length) return problem(422, 'VALIDATION_ERROR', errors);
    const assignment = { assignmentId: uuid(), professionalId: body.professionalId!, patientId: body.patientId!, createdAt: now() };
    db.assignments.push(assignment);
    return HttpResponse.json(assignment, { status: 201 });
  }),

  http.delete(`${BASE}/admin/assignments/:assignmentId`, ({ request, params }) => {
    const auth = authenticate(request, ['admin']);
    if ('response' in auth) return auth.response;
    const before = db.assignments.length;
    db.assignments = db.assignments.filter((a) => a.assignmentId !== params.assignmentId);
    return db.assignments.length < before ? new HttpResponse(null, { status: 204 }) : problem(404, 'NOT_FOUND');
  }),

  http.get(`${BASE}/admin/exports/analysis-dataset`, ({ request }) => {
    const auth = authenticate(request, ['admin']);
    if ('response' in auth) return auth.response;
    // Anonymous: no pseudonym, new identifiers on every export, no test sessions (§4.4).
    const rows = Object.values(db.sessions)
      .flat()
      .filter((s) => !s.testSession)
      .map((s) => ({
        rowId: uuid(),
        levelReached: s.levelReached,
        totalDurationSeconds: s.totalDurationSeconds,
        phobiaGrade: s.phobiaGrade,
        toleranceIndex: s.analysis?.toleranceIndex ?? null,
        recommendation: s.analysis?.recommendation ?? null,
      }));
    if ((request.headers.get('Accept') ?? '').includes('text/csv')) {
      const header = 'rowId,levelReached,totalDurationSeconds,phobiaGrade,toleranceIndex,recommendation';
      const lines = rows.map((r) => [r.rowId, r.levelReached, r.totalDurationSeconds, r.phobiaGrade, r.toleranceIndex ?? '', r.recommendation ?? ''].join(','));
      return new HttpResponse([header, ...lines].join('\n'), { headers: { 'Content-Type': 'text/csv; charset=utf-8' } });
    }
    return HttpResponse.json({ generatedAt: now(), items: rows });
  }),
];

/** Browser mode only: keep accepting refresh cookies issued before a reload. */
export function setPersistentRefresh(value: boolean): void {
  persistentRefresh = value;
}

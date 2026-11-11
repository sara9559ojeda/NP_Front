import { ApiError, request, requestRaw } from './client';
import { named, mapPage, note, device, session, type WireMe, type WireNote, type WireDevice, type WireSession } from './adapters';
import type {
  AdminPasswordResetRequest,
  AdminUser,
  AppRelease,
  AdminUserQuery,
  Assignment,
  ChangePasswordRequest,
  CreateAssignmentRequest,
  CreateNoteRequest,
  CreateUserRequest,
  LoginRequest,
  LoginResponse,
  NoteQuery,
  Page,
  PageQuery,
  PairingCode,
  PatientFeedback,
  PatientListItem,
  PhobiaGradeRequest,
  PhobiaGradeResponse,
  PlanRequest,
  ProductInfo,
  Progress,
  RegisterRequest,
  RegisterResponse,
  SessionSummary,
  TherapyState,
  UpdateMeRequest,
  UpdateUserRequest,
  Uuid,
} from './types';

const id = (value: Uuid) => encodeURIComponent(value);
const page = (query?: PageQuery) => ({ limit: query?.limit, cursor: query?.cursor ?? undefined });

// v1.1.0 Public product information (no session)
export const publicInfo = {
  product: () => request<ProductInfo>('/public/product-info', { anonymous: true }),
  appRelease: (): Promise<AppRelease> => request<AppRelease>('/public/app-release', { anonymous: true }).catch((error: unknown) => {
    if (error instanceof ApiError && error.code === 'NOT_FOUND') return { status: 'unavailable', downloadRole: 'admin', headsetTested: false } satisfies AppRelease;
    throw error;
  }),
};

// §4.1–4.2 Accounts
export const auth = {
  register: (body: RegisterRequest) =>
    request<RegisterResponse>('/auth/register', { method: 'POST', body, anonymous: true }),
  login: (body: LoginRequest) => request<LoginResponse>('/auth/login', { method: 'POST', body, anonymous: true }),
  logout: () => request<void>('/auth/logout', { method: 'POST', anonymous: true }),
};

// §4.3, §5.2, §6.1 Own data
export const me = {
  get: () => request<WireMe>('/me').then(named),
  update: (body: UpdateMeRequest) => request<WireMe>('/me', { method: 'PATCH', body }).then(named),
  changePassword: (body: ChangePasswordRequest) => request<void>('/me/password', { method: 'PUT', body }),
  withdrawConsent: () => request<void>('/me/consents/withdraw', { method: 'POST' }),
  progress: async () => {
    const [progress, history] = await Promise.all([request<Progress>('/me/progress'), request<Page<SessionSummary>>('/me/sessions', { query: { limit: 5 } })]);
    return { ...progress, lastSessions: history.items };
  },
  sessions: (query?: PageQuery) => request<Page<SessionSummary>>('/me/sessions', { query: page(query) }),
  session: (sessionId: Uuid) => request<WireSession>(`/me/sessions/${id(sessionId)}`).then(session),
  devices: () => request<Page<WireDevice>>('/me/devices').then(value => mapPage(value, device)),
  revokeDevice: (deviceId: Uuid) => request<void>(`/me/devices/${id(deviceId)}`, { method: 'DELETE' }),
  createPairingCode: () => request<PairingCode>('/pairing-codes', { method: 'POST' }),
  therapy: () => request<TherapyState>('/me/therapy'),
  setPhobiaGrade: (body: PhobiaGradeRequest) =>
    request<PhobiaGradeResponse>('/me/phobia-grade', { method: 'PUT', body }),
};

// §5.1 Professional
export const patients = {
  list: (query?: PageQuery) => request<Page<Omit<PatientListItem, 'fullName'> & { fullName: string | null }>>('/patients', { query: page(query) }).then(value => mapPage(value, named)),
  progress: async (patientId: Uuid) => {
    const [progress, history] = await Promise.all([
      request<Progress>(`/patients/${id(patientId)}/progress`),
      request<Page<SessionSummary>>(`/patients/${id(patientId)}/sessions`, { query: { limit: 5 } }),
    ]);
    return { ...progress, lastSessions: history.items };
  },
  sessions: (patientId: Uuid, query?: PageQuery) =>
    request<Page<SessionSummary>>(`/patients/${id(patientId)}/sessions`, { query: page(query) }),
  session: (patientId: Uuid, sessionId: Uuid) =>
    request<WireSession>(`/patients/${id(patientId)}/sessions/${id(sessionId)}`).then(session),
  setPlan: (patientId: Uuid, body: PlanRequest) =>
    request<void>(`/patients/${id(patientId)}/plan`, { method: 'PUT', body }),
  notes: (patientId: Uuid, query?: NoteQuery) =>
    request<Page<WireNote>>(`/patients/${id(patientId)}/notes`, {
      query: { ...page(query), sessionId: query?.sessionId },
    }).then(value => mapPage(value, note)),
  createNote: (patientId: Uuid, body: CreateNoteRequest) =>
    request<WireNote>(`/patients/${id(patientId)}/notes`, { method: 'POST', body }).then(note),
  feedback: (patientId: Uuid, query?: PageQuery) =>
    request<Page<PatientFeedback>>(`/patients/${id(patientId)}/feedback`, { query: page(query) }).then(value => mapPage(value, item => item)),
  updateNote: (patientId: Uuid, noteId: Uuid, text: string) =>
    request<WireNote>(`/patients/${id(patientId)}/notes/${id(noteId)}`, { method: 'PATCH', body: { text } }).then(note),
  createPairingCode: (patientId: Uuid) =>
    request<PairingCode>(`/patients/${id(patientId)}/pairing-codes`, { method: 'POST' }),
};

// §4.4 Administration (no clinical data)
export const admin = {
  users: (query?: AdminUserQuery) =>
    request<Page<Omit<AdminUser, 'fullName'> & { fullName: string | null }>>('/admin/users', {
      query: { ...page(query), role: query?.role, active: query?.active, q: query?.q },
    }).then(value => mapPage(value, named)),
  user: (userId: Uuid) =>
    request<Omit<AdminUser, 'fullName'> & { fullName: string | null }>(`/admin/users/${id(userId)}`).then(named),
  createUser: (body: CreateUserRequest) => request<AdminUser>('/admin/users', { method: 'POST', body }),
  updateUser: (userId: Uuid, body: UpdateUserRequest) =>
    request<AdminUser>(`/admin/users/${id(userId)}`, { method: 'PATCH', body }),
  resetPassword: (userId: Uuid, body: AdminPasswordResetRequest) =>
    request<void>(`/admin/users/${id(userId)}/password`, { method: 'PUT', body }),
  assignments: (professionalId?: Uuid) =>
    request<Page<Assignment>>('/admin/assignments', { query: { professionalId } }),
  createAssignment: (body: CreateAssignmentRequest) =>
    request<Assignment>('/admin/assignments', { method: 'POST', body }),
  deleteAssignment: (assignmentId: Uuid) =>
    request<void>(`/admin/assignments/${id(assignmentId)}`, { method: 'DELETE' }),
  exportDataset: async (format: 'json' | 'csv'): Promise<Blob> => {
    const response = await requestRaw('/admin/exports/analysis-dataset', {
      accept: format === 'csv' ? 'text/csv' : 'application/json',
    });
    return response.blob();
  },
};

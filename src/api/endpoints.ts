import { request, requestRaw } from './client';
import type {
  AdminUser,
  AdminUserQuery,
  Assignment,
  ChangePasswordRequest,
  CreateAssignmentRequest,
  CreateNoteRequest,
  CreateNoteResponse,
  CreateUserRequest,
  Device,
  LoginRequest,
  LoginResponse,
  Me,
  Note,
  Page,
  PageQuery,
  PairingCode,
  PatientListItem,
  PlanRequest,
  Progress,
  RegisterRequest,
  RegisterResponse,
  SessionDetail,
  SessionSummary,
  UpdateMeRequest,
  UpdateUserRequest,
  Uuid,
} from './types';

const id = (value: Uuid) => encodeURIComponent(value);
const page = (query?: PageQuery) => ({ limit: query?.limit, cursor: query?.cursor ?? undefined });

// §4.1–4.2 Accounts
export const auth = {
  register: (body: RegisterRequest) =>
    request<RegisterResponse>('/auth/register', { method: 'POST', body, anonymous: true }),
  login: (body: LoginRequest) => request<LoginResponse>('/auth/login', { method: 'POST', body, anonymous: true }),
  logout: () => request<void>('/auth/logout', { method: 'POST', anonymous: true }),
};

// §4.3, §5.2, §6.1 Own data
export const me = {
  get: () => request<Me>('/me'),
  update: (body: UpdateMeRequest) => request<Me>('/me', { method: 'PATCH', body }),
  changePassword: (body: ChangePasswordRequest) => request<void>('/me/password', { method: 'PUT', body }),
  withdrawConsent: () => request<void>('/me/consents/withdraw', { method: 'POST' }),
  progress: () => request<Progress>('/me/progress'),
  sessions: (query?: PageQuery) => request<Page<SessionSummary>>('/me/sessions', { query: page(query) }),
  session: (sessionId: Uuid) => request<SessionDetail>(`/me/sessions/${id(sessionId)}`),
  devices: () => request<Page<Device>>('/me/devices'),
  revokeDevice: (deviceId: Uuid) => request<void>(`/me/devices/${id(deviceId)}`, { method: 'DELETE' }),
  createPairingCode: () => request<PairingCode>('/pairing-codes', { method: 'POST' }),
};

// §5.1 Professional
export const patients = {
  list: (query?: PageQuery) => request<Page<PatientListItem>>('/patients', { query: page(query) }),
  progress: (patientId: Uuid) => request<Progress>(`/patients/${id(patientId)}/progress`),
  sessions: (patientId: Uuid, query?: PageQuery) =>
    request<Page<SessionSummary>>(`/patients/${id(patientId)}/sessions`, { query: page(query) }),
  session: (patientId: Uuid, sessionId: Uuid) =>
    request<SessionDetail>(`/patients/${id(patientId)}/sessions/${id(sessionId)}`),
  setPlan: (patientId: Uuid, body: PlanRequest) =>
    request<void>(`/patients/${id(patientId)}/plan`, { method: 'PUT', body }),
  notes: (patientId: Uuid, query?: PageQuery) =>
    request<Page<Note>>(`/patients/${id(patientId)}/notes`, { query: page(query) }),
  createNote: (patientId: Uuid, body: CreateNoteRequest) =>
    request<CreateNoteResponse>(`/patients/${id(patientId)}/notes`, { method: 'POST', body }),
  updateNote: (patientId: Uuid, noteId: Uuid, text: string) =>
    request<Note>(`/patients/${id(patientId)}/notes/${id(noteId)}`, { method: 'PATCH', body: { text } }),
  createPairingCode: (patientId: Uuid) =>
    request<PairingCode>(`/patients/${id(patientId)}/pairing-codes`, { method: 'POST' }),
};

// §4.4 Administration (no clinical data)
export const admin = {
  users: (query?: AdminUserQuery) =>
    request<Page<AdminUser>>('/admin/users', {
      query: { ...page(query), role: query?.role, active: query?.active, q: query?.q },
    }),
  createUser: (body: CreateUserRequest) => request<AdminUser>('/admin/users', { method: 'POST', body }),
  updateUser: (userId: Uuid, body: UpdateUserRequest) =>
    request<AdminUser>(`/admin/users/${id(userId)}`, { method: 'PATCH', body }),
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

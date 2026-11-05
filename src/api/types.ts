// Types for API v1. Routes added in contract v1.1.0 alias the schemas generated from
// docs/api/openapi.json (`npm run gen:api-types`). The older view models below were
// written by hand from docs/api/CONTRATO_API_v1.md; src/api/adapters.ts maps the wire
// shapes onto them. Fields marked "assumed" are not spelled out in the contract.
import type { components } from './generated/openapi';

type Schemas = components['schemas'];

export type Uuid = string;
/** ISO 8601 in UTC with Z. */
export type IsoDate = string;

export type Role = 'patient' | 'professional' | 'admin';

export interface Page<T> {
  items: T[];
  nextCursor: string | null;
}

export interface PageQuery {
  limit?: number;
  cursor?: string | null;
}

// §8 — RFC 9457 problem details
export type ErrorCode =
  | 'BAD_REQUEST'
  | 'UNAUTHENTICATED'
  | 'TOKEN_EXPIRED'
  | 'INVALID_CREDENTIALS'
  | 'DEVICE_REVOKED'
  | 'FORBIDDEN'
  | 'NOT_FOUND'
  | 'PAIRING_CODE_INVALID'
  | 'EMAIL_TAKEN'
  | 'RECORD_CONFLICT'
  | 'LAST_ADMIN'
  | 'PAIRING_CODE_EXPIRED'
  | 'PAYLOAD_TOO_LARGE'
  | 'VALIDATION_ERROR'
  | 'CONSENT_REQUIRED'
  | 'ACCOUNT_DISABLED'
  | 'RATE_LIMITED'
  | 'SERVER_ERROR'
  | 'STORAGE_UNAVAILABLE';

export interface FieldError {
  field: string;
  code: string;
}

export interface Problem {
  type: string;
  title: string;
  status: number;
  code: ErrorCode;
  detail?: string;
  errors?: FieldError[];
}

// §4.1
export interface ConsentInput {
  accepted: boolean;
  consentVersion: string;
}

export interface RegisterRequest {
  fullName: string;
  email: string;
  password: string;
  consent: ConsentInput;
}

export interface RegisterResponse {
  userId: Uuid;
  role: Role;
}

// §4.2
export interface LoginRequest {
  email: string;
  password: string;
}

export interface LoginResponse {
  accessToken: string;
  expiresIn: number;
  user: { id: Uuid; role: Role };
}

export interface RefreshResponse {
  accessToken: string;
  expiresIn: number;
}

// §4.3
/** Assumed shape of each item in `consents`. */
export interface Consent {
  consentVersion: string;
  grantedAt: IsoDate;
  withdrawnAt: IsoDate | null;
}

export interface Me {
  id: Uuid;
  role: Role;
  fullName: string;
  email: string;
  consents: Consent[];
}

export interface UpdateMeRequest {
  fullName?: string;
  email?: string;
}

export interface ChangePasswordRequest {
  currentPassword: string;
  newPassword: string;
}

// §4.4
export interface AdminUser {
  id: Uuid;
  fullName: string;
  email: string;
  role: Role;
  active: boolean;
}

export interface AdminUserQuery extends PageQuery {
  role?: Role;
  active?: boolean;
  q?: string;
}

export interface CreateUserRequest {
  fullName: string;
  email: string;
  role: Role;
  temporaryPassword: string;
}

/** v1.1.0: role, status, name and email are all optional. */
export interface UpdateUserRequest {
  role?: Role;
  active?: boolean;
  fullName?: string;
  email?: string;
}

export type AdminPasswordResetRequest = Schemas['AdminPasswordReset'];

/** Assumed shape: the contract only names the route. */
export interface Assignment {
  assignmentId: Uuid;
  professionalId: Uuid;
  patientId: Uuid;
  createdAt: IsoDate;
}

export interface CreateAssignmentRequest {
  professionalId: Uuid;
  patientId: Uuid;
}

// §7
export type RecommendationValue = 'advance' | 'repeat' | 'step_back';
/** One variable behind a recommendation; `value` may be a count, a flag or missing. */
export type AnalysisBasis = Schemas['BasisItem'];

export interface Analysis {
  toleranceIndex: number;
  recommendation: RecommendationValue;
  method: string;
  methodVersion: string;
  basis: AnalysisBasis[];
  /** "pendiente_de_validar" until a professional validates the method. */
  clinicalStatus: string;
  /** v1.1.0. */
  createdAt?: IsoDate;
}

// §5.2
export interface SessionSummary {
  sessionId: Uuid;
  startedAt: IsoDate | null;
  levelReached: number | null;
  totalDurationSeconds: number | null;
  recommendation: RecommendationValue | null;
  /** Assumed: the wireframe shows tolerance per session in the history. */
  toleranceIndex?: number | null;
}

export interface Progress {
  sessionsCount: number;
  levelReached: number | null;
  lastSessions: SessionSummary[];
  /** Assumed: needed to show the current plan to the professional. */
  allowedStartLevel?: number;
}

// §6.3 level_record payload (fields the web shows)
export type LevelOutcome = 'completed' | 'criterion_not_met' | 'safe_exit' | 'abandoned';
export type SudsPhase = 'before' | 'during' | 'after';

export interface SudsEntry {
  phase: SudsPhase;
  value: number;
  at: number;
}

export interface LevelRecord {
  level: number;
  attempt: number;
  levelDefinitionVersion: string;
  startedAt: IsoDate;
  endedAt: IsoDate;
  outcome: LevelOutcome;
  criterionMet: boolean;
  permanenceSeconds: number;
  minDistanceM: number | null;
  gaze: { coneDeg: number | null; onStimulusSeconds: number | null; meanAngleDeg: number | null };
  avoidanceCount: number;
  suds: SudsEntry[];
}

export type EndReason = 'completed' | 'user_finished' | 'safe_exit' | 'app_closed';

/** Assumed shape: §5.1 says "sesión, registros por nivel, SUDS y análisis". */
export interface SessionDetail {
  sessionId: Uuid;
  startedAt: IsoDate | null;
  endedAt: IsoDate | null;
  phobiaGrade: number | null;
  testSession: boolean;
  endReason: EndReason | null;
  levelReached: number | null;
  totalDurationSeconds: number | null;
  levels: LevelRecord[];
  analysis: Analysis | null;
}

// §5.1
export interface PatientListItem {
  patientId: Uuid;
  fullName: string;
  lastSessionAt: IsoDate | null;
  levelReached: number | null;
  lastRecommendation: RecommendationValue | null;
  /** v1.1.0: last self-reported phobia grade (1-5). */
  phobiaGrade?: number | null;
}

export interface PlanRequest {
  allowedStartLevel: number;
}

/** Assumed shape of each note in GET /patients/{id}/notes. */
export interface Note {
  noteId: Uuid;
  text: string;
  sessionId: Uuid | null;
  authorUserId: Uuid;
  authorName: string | null;
  createdAt: IsoDate;
  editedAt: IsoDate | null;
}

export interface CreateNoteRequest {
  text: string;
  sessionId?: Uuid;
}

export interface NoteQuery extends PageQuery {
  sessionId?: Uuid;
}

// v1.1.0: public product information
export type ProductInfo = Schemas['ProductInfoOut'];

// v1.1.0: patient therapy state and phobia grade (BPMN "Ajustar grado de fobia")
export type TherapyState = Schemas['TherapyStateOut'];
export type SessionFeedback = Schemas['SessionFeedbackItem'];
export type PhobiaGradeRequest = Schemas['PhobiaGradeIn'];
export type PhobiaGradeResponse = Schemas['PhobiaGradeOut'];

// v1.1.0: professional view of the AI feedback per session
export type PatientFeedback = Schemas['ProfessionalFeedbackItem'];

// §6.1
export interface PairingCode {
  code: string;
  expiresAt: IsoDate;
}

/** Assumed shape of each item in GET /me/devices. */
export interface Device {
  deviceId: Uuid;
  model: string;
  appVersion: string;
  pairedAt: IsoDate;
  revokedAt: IsoDate | null;
}

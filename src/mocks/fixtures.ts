// Fictional data for the simulated server. Shapes and example values follow
// docs/api/CONTRATO_API_v1.md (§4–§7). Nothing here is real personal or clinical data.
import type { WireNote } from '../api/adapters';
import type {
  Analysis,
  Assignment,
  Consent,
  Device,
  LevelRecord,
  ProductInfo,
  RecommendationValue,
  Role,
  SessionDetail,
} from '../api/types';

/**
 * Fixture password accepted by the simulated server for every seeded account.
 * It only exists inside the mock (MSW); the real backend never sees it.
 */
export const DEMO_PASSWORD = 'demo-neurophobia';

export const CONSENT_VERSION = '2026-10-v1';

export interface MockUser {
  id: string;
  email: string;
  fullName: string;
  role: Role;
  active: boolean;
  password: string;
  consents: Consent[];
  /** Clinical side (patients only). */
  allowedStartLevel?: number;
  phobiaGrade?: number | null;
  phobiaGradeUpdatedAt?: string | null;
}

/** Notes are stored as the backend sends them (v1.1.0 `NoteOut`). */
export type MockNote = Required<Pick<WireNote, 'authorId'>> & Omit<WireNote, 'authorUserId'> & { authorName: string | null };

export interface MockDb {
  users: MockUser[];
  assignments: Assignment[];
  sessions: Record<string, SessionDetail[]>;
  /** Session started in the headset and not closed yet, per patient. */
  openSessions: Record<string, { sessionId: string; startedAt: string }>;
  notes: Record<string, MockNote[]>;
  devices: Record<string, Device[]>;
  refreshTokens: Set<string>;
  accessTokens: Map<string, string>;
  failedLogins: Map<string, number>;
}

export const IDS = {
  admin: '6a0f4c1e-1d2b-4c3a-9e8f-0a1b2c3d4e01',
  professional: '6a0f4c1e-1d2b-4c3a-9e8f-0a1b2c3d4e02',
  professional2: '6a0f4c1e-1d2b-4c3a-9e8f-0a1b2c3d4e03',
  ana: '6a0f4c1e-1d2b-4c3a-9e8f-0a1b2c3d4e10',
  carlos: '6a0f4c1e-1d2b-4c3a-9e8f-0a1b2c3d4e11',
  lucia: '6a0f4c1e-1d2b-4c3a-9e8f-0a1b2c3d4e12',
  julian: '6a0f4c1e-1d2b-4c3a-9e8f-0a1b2c3d4e13',
  pedro: '6a0f4c1e-1d2b-4c3a-9e8f-0a1b2c3d4e14',
} as const;

const granted = (at: string): Consent[] => [{ consentVersion: CONSENT_VERSION, grantedAt: at, withdrawnAt: null }];

function seedUsers(): MockUser[] {
  const base = { password: DEMO_PASSWORD, active: true };
  return [
    { ...base, id: IDS.admin, email: 'admin@neurophobia.test', fullName: 'Valeria Rosero', role: 'admin', consents: granted('2026-10-01T14:00:00Z') },
    { ...base, id: IDS.professional, email: 'profesional@neurophobia.test', fullName: 'Marta Gómez', role: 'professional', consents: granted('2026-10-02T14:00:00Z') },
    { ...base, id: IDS.professional2, email: 'profesional2@neurophobia.test', fullName: 'Andrés Benavides', role: 'professional', consents: granted('2026-10-02T15:00:00Z') },
    { ...base, id: IDS.ana, email: 'ana@example.com', fullName: 'Ana Pérez', role: 'patient', consents: granted('2026-10-05T16:00:00Z'), allowedStartLevel: 2, phobiaGrade: 3, phobiaGradeUpdatedAt: '2026-10-29T19:55:00Z' },
    { ...base, id: IDS.carlos, email: 'carlos@neurophobia.test', fullName: 'Carlos Ruiz', role: 'patient', consents: granted('2026-10-08T16:00:00Z'), allowedStartLevel: 1, phobiaGrade: 4, phobiaGradeUpdatedAt: '2026-10-27T14:50:00Z' },
    { ...base, id: IDS.lucia, email: 'lucia@neurophobia.test', fullName: 'Lucía Chamorro', role: 'patient', consents: granted('2026-10-09T16:00:00Z'), allowedStartLevel: 1, phobiaGrade: 2, phobiaGradeUpdatedAt: '2026-10-25T17:50:00Z' },
    { ...base, id: IDS.julian, email: 'julian@neurophobia.test', fullName: 'Julián Ortega', role: 'patient', consents: granted('2026-10-28T16:00:00Z'), allowedStartLevel: 1 },
    { ...base, id: IDS.pedro, email: 'inactivo@neurophobia.test', fullName: 'Pedro Erazo', role: 'patient', active: false, consents: granted('2026-10-10T16:00:00Z'), allowedStartLevel: 1 },
  ];
}

// Contract §7 example, used as the template for every analysis.
function analysis(toleranceIndex: number, recommendation: RecommendationValue, sudsDrop: number, avoidance: number, createdAt: string): Analysis {
  return {
    toleranceIndex,
    recommendation,
    method: 'rules-baseline',
    methodVersion: '0.1.0',
    basis: [
      { feature: 'sudsDrop', value: sudsDrop, effect: sudsDrop >= 0 ? 'favorable' : 'unfavorable' },
      { feature: 'avoidanceCount', value: avoidance, effect: avoidance > 1 ? 'unfavorable' : 'favorable' },
    ],
    clinicalStatus: 'pendiente_de_validar',
    createdAt,
  };
}

function addSeconds(iso: string, seconds: number): string {
  return new Date(new Date(iso).getTime() + seconds * 1000).toISOString().replace('.000Z', 'Z');
}

// Contract §6.3 level_record example, shifted per level.
function levelRecord(level: number, startedAt: string, before: number, during: number, after: number, avoidance: number, met: boolean): LevelRecord {
  const permanence = met ? 270 : 140;
  return {
    level,
    attempt: 1,
    levelDefinitionVersion: '2026-10-30',
    startedAt,
    endedAt: addSeconds(startedAt, permanence),
    outcome: met ? 'completed' : 'criterion_not_met',
    criterionMet: met,
    permanenceSeconds: permanence,
    minDistanceM: level === 1 ? null : Math.max(0.4, 3.2 - level * 0.55),
    gaze: { coneDeg: 15, onStimulusSeconds: met ? 142.5 : 61.2, meanAngleDeg: 21.3 },
    avoidanceCount: avoidance,
    suds: [
      { phase: 'before', value: before, at: 0 },
      { phase: 'during', value: during, at: 120.4 },
      { phase: 'after', value: after, at: permanence },
    ],
  };
}

interface SessionSeed {
  id: string;
  startedAt: string;
  levelReached: number;
  phobiaGrade: number;
  tolerance: number | null;
  recommendation: RecommendationValue | null;
  testSession?: boolean;
  lastLevelMet?: boolean;
}

function session(seed: SessionSeed): SessionDetail {
  const levels: LevelRecord[] = [];
  let cursor = addSeconds(seed.startedAt, 60);
  for (let level = 1; level <= seed.levelReached; level += 1) {
    const isLast = level === seed.levelReached;
    const met = isLast ? seed.lastLevelMet ?? true : true;
    const before = 40 + level * 6;
    levels.push(levelRecord(level, cursor, before, before + 10, before - (met ? 20 : 5), met ? 1 : 3, met));
    cursor = addSeconds(cursor, 330);
  }
  const total = Math.max(300, levels.length * 330 + 60);
  const firstLevel = levels[0];
  const lastLevel = levels[levels.length - 1];
  const sudsDrop = firstLevel && lastLevel ? (firstLevel.suds[0]?.value ?? 0) - (lastLevel.suds[2]?.value ?? 0) : 0;
  const endedAt = addSeconds(seed.startedAt, total);
  return {
    sessionId: seed.id,
    startedAt: seed.startedAt,
    endedAt,
    phobiaGrade: seed.phobiaGrade,
    testSession: seed.testSession ?? false,
    endReason: seed.lastLevelMet === false ? 'user_finished' : 'completed',
    levelReached: seed.levelReached,
    totalDurationSeconds: total,
    levels,
    analysis:
      seed.tolerance === null || seed.recommendation === null || seed.testSession
        ? null
        : analysis(seed.tolerance, seed.recommendation, sudsDrop, lastLevel?.avoidanceCount ?? 0, addSeconds(endedAt, 2)),
  };
}

function seedSessions(): Record<string, SessionDetail[]> {
  return {
    [IDS.ana]: [
      session({ id: 'a3b9e2c4-0001-4d5e-8f60-000000000001', startedAt: '2026-10-06T21:00:00Z', levelReached: 1, phobiaGrade: 3, tolerance: 0.38, recommendation: 'repeat', lastLevelMet: false }),
      session({ id: 'a3b9e2c4-0001-4d5e-8f60-000000000002', startedAt: '2026-10-10T21:00:00Z', levelReached: 1, phobiaGrade: 3, tolerance: 0.47, recommendation: 'advance' }),
      session({ id: 'a3b9e2c4-0001-4d5e-8f60-000000000003', startedAt: '2026-10-14T21:00:00Z', levelReached: 2, phobiaGrade: 3, tolerance: 0.44, recommendation: 'repeat', lastLevelMet: false }),
      session({ id: 'a3b9e2c4-0001-4d5e-8f60-000000000004', startedAt: '2026-10-18T20:30:00Z', levelReached: 1, phobiaGrade: 3, tolerance: null, recommendation: null, testSession: true }),
      session({ id: 'a3b9e2c4-0001-4d5e-8f60-000000000005', startedAt: '2026-10-21T21:00:00Z', levelReached: 2, phobiaGrade: 3, tolerance: 0.55, recommendation: 'advance' }),
      session({ id: 'a3b9e2c4-0001-4d5e-8f60-000000000006', startedAt: '2026-10-29T20:00:00Z', levelReached: 2, phobiaGrade: 3, tolerance: 0.62, recommendation: 'repeat', lastLevelMet: false }),
    ],
    [IDS.carlos]: [
      session({ id: 'c1d2e3f4-0002-4a5b-8c6d-000000000001', startedAt: '2026-10-20T15:00:00Z', levelReached: 1, phobiaGrade: 4, tolerance: 0.31, recommendation: 'step_back', lastLevelMet: false }),
      session({ id: 'c1d2e3f4-0002-4a5b-8c6d-000000000002', startedAt: '2026-10-27T15:00:00Z', levelReached: 1, phobiaGrade: 4, tolerance: 0.4, recommendation: 'repeat' }),
    ],
    [IDS.lucia]: [
      session({ id: 'e5f6a7b8-0003-4c5d-9e0f-000000000001', startedAt: '2026-10-25T18:00:00Z', levelReached: 3, phobiaGrade: 2, tolerance: 0.71, recommendation: 'advance' }),
    ],
    [IDS.julian]: [],
    [IDS.pedro]: [],
  };
}

function seedNotes(): Record<string, MockNote[]> {
  const note = (n: number, text: string, sessionId: string | null, createdAt: string): MockNote => ({
    noteId: `f0e1d2c3-0004-4b5a-9c8d-00000000000${n}`,
    text,
    sessionId,
    authorId: IDS.professional,
    authorName: 'Marta Gómez',
    createdAt,
    editedAt: null,
  });
  return {
    [IDS.ana]: [
      note(3, 'Nota de ejemplo del servidor simulado para la sesión del 29 de octubre.', 'a3b9e2c4-0001-4d5e-8f60-000000000006', '2026-10-29T22:00:00Z'),
      note(2, 'Nota de ejemplo del servidor simulado para la sesión del 21 de octubre.', 'a3b9e2c4-0001-4d5e-8f60-000000000005', '2026-10-21T22:10:00Z'),
      note(1, 'Nota de ejemplo del servidor simulado sin sesión asociada.', null, '2026-10-07T13:00:00Z'),
    ],
  };
}

function seedDevices(): Record<string, Device[]> {
  return {
    [IDS.ana]: [
      { deviceId: 'd7c6b5a4-0005-4e3f-8a1b-000000000001', model: 'quest3', appVersion: '0.2.0', pairedAt: '2026-10-14T20:40:00Z', revokedAt: null },
      { deviceId: 'd7c6b5a4-0005-4e3f-8a1b-000000000002', model: 'quest2', appVersion: '0.1.0', pairedAt: '2026-10-05T19:00:00Z', revokedAt: '2026-10-14T20:35:00Z' },
    ],
  };
}

/** Contract v1.1.0 example `product_info.response.200.json`. */
export const PRODUCT_INFO: ProductInfo = {
  name: 'NEUROPHOBIA',
  tagline: 'Terapia de exposición a la aracnofobia en realidad virtual, acompañada por tu profesional.',
  description:
    'NEUROPHOBIA es un prototipo académico de exposición gradual a arañas en realidad virtual (Meta Quest). Cada sesión avanza por niveles, registra cómo respondes y genera una retroalimentación que revisa tu profesional de la salud.',
  audience: 'Personas con miedo a las arañas que siguen un proceso con un profesional de la salud.',
  features: [
    { title: 'Exposición gradual', description: 'Cinco niveles de exposición; empiezas en el que autorice tu profesional.' },
    { title: 'Tú controlas', description: 'Puedes pausar o salir de forma segura en cualquier momento.' },
    { title: 'Seguimiento', description: 'Tu profesional ve tu avance, la retroalimentación de cada sesión y deja notas.' },
    { title: 'Privacidad', description: 'Los datos de las sesiones se guardan separados de tu identidad.' },
  ],
  howItWorks: [
    { order: 1, title: 'Regístrate', description: 'Crea tu cuenta y acepta el consentimiento informado.' },
    { order: 2, title: 'Empareja el visor', description: 'Genera un código en la web y escríbelo en las gafas.' },
    { order: 3, title: 'Ajusta tu grado de fobia', description: 'Indica del 1 al 5 cuánto miedo sientes hoy.' },
    { order: 4, title: 'Inicia la terapia', description: 'Pulsa «Comenzar» en el Refugio y avanza a tu ritmo.' },
    { order: 5, title: 'Revisa tu avance', description: 'Consulta tus sesiones; tu profesional revisa la retroalimentación.' },
  ],
  requirements: {
    headsets: ['Meta Quest 2', 'Meta Quest 3', 'Meta Quest 3S'],
    web: 'Navegador actualizado (Chrome, Edge, Firefox o Safari).',
  },
  disclaimer:
    'NEUROPHOBIA es un prototipo académico y no sustituye un diagnóstico ni un tratamiento profesional. Si sientes malestar intenso, detén la sesión y consulta con tu profesional de la salud.',
  contentVersion: '2026-11-04',
  contentStatus: 'pendiente_de_aprobacion',
  apiVersion: '0.2.0',
};

export function createDb(): MockDb {
  return {
    users: seedUsers(),
    assignments: [
      { assignmentId: 'b1a2c3d4-0006-4f5e-8d7c-000000000001', professionalId: IDS.professional, patientId: IDS.ana, createdAt: '2026-10-05T17:00:00Z' },
      { assignmentId: 'b1a2c3d4-0006-4f5e-8d7c-000000000002', professionalId: IDS.professional, patientId: IDS.carlos, createdAt: '2026-10-08T17:00:00Z' },
      { assignmentId: 'b1a2c3d4-0006-4f5e-8d7c-000000000003', professionalId: IDS.professional2, patientId: IDS.lucia, createdAt: '2026-10-09T17:00:00Z' },
    ],
    sessions: seedSessions(),
    openSessions: {},
    notes: seedNotes(),
    devices: seedDevices(),
    refreshTokens: new Set(),
    accessTokens: new Map(),
    failedLogins: new Map(),
  };
}

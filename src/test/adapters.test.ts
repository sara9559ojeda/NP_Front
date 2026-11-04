import { expect, test } from 'vitest';
import { device, named, note, session } from '../api/adapters';
import { createDb, IDS } from '../mocks/fixtures';

test('normaliza nombres y campos concretados por el backend', () => {
  expect(named({ fullName: null }).fullName).toBe('Sin datos');
  expect(note({ noteId: 'n', authorId: 'p', text: '', sessionId: null, createdAt: '', editedAt: null }).authorUserId).toBe('p');
  expect(device({ deviceId: 'd', deviceModel: 'quest3', appVersion: '1', pairedAt: '', revokedAt: null }).model).toBe('quest3');
});
test('lee gaze desde payload y no inventa mediciones ausentes', () => {
  const original = createDb().sessions[IDS.ana]![0]!;
  const level = original.levels[0]!;
  const { gaze, levelDefinitionVersion, ...summary } = level;
  const withPayload = session({ ...original, levels: [{ ...summary, payload: { gaze, levelDefinitionVersion } }] });
  expect(withPayload.levels[0]?.gaze).toEqual(gaze);
  const missing = session({ ...original, startedAt: null, levels: [summary] });
  expect(missing.startedAt).toBeNull();
  expect(missing.levels[0]?.gaze.onStimulusSeconds).toBeNull();
});

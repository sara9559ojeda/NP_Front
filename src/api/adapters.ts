// Wire shapes concretized by NP_Back's OpenAPI; existing view models stay stable.
import type { Device, LevelRecord, Me, Note, Page, SessionDetail } from './types';
import { t } from '../i18n';

export function named<T extends { fullName: string | null }>(value: T): Omit<T, 'fullName'> & { fullName: string } {
  return { ...value, fullName: value.fullName ?? t('common.noData') };
}
export function mapPage<T, U>(page: Page<T>, map: (item: T) => U): Page<U> {
  return { ...page, nextCursor: page.nextCursor ?? null, items: page.items.map(map) };
}
export type WireMe = Omit<Me, 'fullName'> & { fullName: string | null };
export type WireNote = Omit<Note, 'authorUserId'> & { authorId?: string; authorUserId?: string };
export const note = (value: WireNote): Note => ({ ...value, authorUserId: value.authorId ?? value.authorUserId ?? '' });
export type WireDevice = Omit<Device, 'model'> & { deviceModel?: string; model?: string };
export const device = (value: WireDevice): Device => ({ ...value, model: value.deviceModel ?? value.model ?? t('common.noData') });
type WireLevel = Omit<LevelRecord, 'gaze' | 'levelDefinitionVersion'> & {
  gaze?: LevelRecord['gaze']; levelDefinitionVersion?: string;
  payload?: { gaze?: LevelRecord['gaze']; levelDefinitionVersion?: string };
};
export type WireSession = Omit<SessionDetail, 'levels'> & { levels: WireLevel[] };
export function session(value: WireSession): SessionDetail {
  return { ...value, levels: value.levels.map(level => ({
    ...level,
    levelDefinitionVersion: level.levelDefinitionVersion ?? level.payload?.levelDefinitionVersion ?? '',
    gaze: level.gaze ?? level.payload?.gaze ?? { coneDeg: null, onStimulusSeconds: null, meanAngleDeg: null },
  })) };
}

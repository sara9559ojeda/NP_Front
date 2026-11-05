import type { CSSProperties } from 'react';
import { t, tDynamic } from '../../i18n';

export const LEVELS = [1, 2, 3, 4, 5] as const;
export type Level = (typeof LEVELS)[number];

/** Where the stimulus ring sits on the track for each level, as a percentage of its width. */
const RING_POSITION: Record<Level, number> = { 1: 90, 2: 74, 3: 58, 4: 42, 5: 30 };

export function isLevel(value: number | null | undefined): value is Level {
  return typeof value === 'number' && (LEVELS as readonly number[]).includes(value);
}

interface DistanceRulerProps {
  level: Level;
  /** Smaller track for cards inside the app. */
  compact?: boolean;
}

/**
 * Signature element: "you" on the left, the stimulus as a breathing ring on the right.
 * Higher levels bring the ring closer. Purely visual: the level is always also written as text
 * next to it, so the track is hidden from assistive technology.
 */
export function DistanceRuler({ level, compact = false }: DistanceRulerProps) {
  const style = { '--ring-position': `${RING_POSITION[level]}%` } as CSSProperties;
  return (
    <div className={`ruler${compact ? ' ruler--compact' : ''}`} style={style} aria-hidden="true">
      <span className="ruler__line" />
      <span className="ruler__you">
        <span className="ruler__you-label">{t('ruler.you')}</span>
      </span>
      {!compact && <span className="ruler__gap">{tDynamic(`ruler.gap.${level}`, 'common.noData')}</span>}
      <span className="ruler__ring">
        <span className="ruler__breath" />
        <span className="ruler__breath ruler__breath--outer" />
      </span>
    </div>
  );
}

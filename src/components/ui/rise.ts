import type { CSSProperties } from 'react';

/** Sets the custom property that staggers the `.rise` entrance animation (see motion.css). */
export function riseOrder(order: number): CSSProperties {
  return { '--rise-order': order } as CSSProperties;
}

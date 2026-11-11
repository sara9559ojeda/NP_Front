import { useMemo } from 'react';
import { RIDGES, ridgeHeight, SKY, type RidgeLayer } from './terrain';

const W = 1600;
const H = 900;
const STEPS = 160;

function mixHex(a: string, b: string, t: number): string {
  const pa = parseInt(a.slice(1), 16);
  const pb = parseInt(b.slice(1), 16);
  const channel = (shift: number) => Math.round(((pa >> shift) & 255) * (1 - t) + ((pb >> shift) & 255) * t);
  return `#${((channel(16) << 16) | (channel(8) << 8) | channel(0)).toString(16).padStart(6, '0')}`;
}

function ridgePath(layer: RidgeLayer): string {
  const points: string[] = [];
  for (let i = 0; i <= STEPS; i += 1) {
    const u = i / STEPS;
    // Same shape as the WebGL ridges, squeezed into the lower part of the frame.
    const y = H * (1 - (ridgeHeight(layer, u) * 0.9 + 0.04));
    points.push(`${(u * W).toFixed(1)},${y.toFixed(1)}`);
  }
  return `M0,${H} L${points.join(' L')} L${W},${H} Z`;
}

/**
 * Static landscape shown first, kept when WebGL is unavailable, on reduced motion and in
 * the inner panels. Purely decorative: hidden from assistive technology.
 */
export function LandscapeFallback() {
  const layers = useMemo(
    () =>
      RIDGES.map((layer, index) => ({
        key: layer.seed,
        d: ridgePath(layer),
        // Far ridges fade into the horizon, like fog in the 3D scene.
        fill: mixHex(layer.color, SKY.horizon.start, Math.max(0, (layer.depth - 90) / 550)),
        depth: RIDGES.length - index,
      })),
    [],
  );

  return (
    <svg className="fallback" viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="xMidYMax slice" aria-hidden="true" focusable="false">
      <defs>
        <linearGradient id="fallback-sky" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor={SKY.top.start} />
          <stop offset="0.75" stopColor={SKY.horizon.start} />
        </linearGradient>
        <radialGradient id="fallback-glow" cx="0.5" cy="0.5" r="0.5">
          <stop offset="0" stopColor={SKY.glow} stopOpacity="0.55" />
          <stop offset="1" stopColor={SKY.glow} stopOpacity="0" />
        </radialGradient>
        <linearGradient id="fallback-lake" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#24425a" />
          <stop offset="1" stopColor="#0f2232" />
        </linearGradient>
      </defs>
      <rect width={W} height={H} fill="url(#fallback-sky)" />
      <circle cx={W * 0.3} cy={H * 0.42} r={220} fill="url(#fallback-glow)" />
      {layers.map((layer) => (
        <path key={layer.key} d={layer.d} fill={layer.fill} className="fallback__ridge" style={{ ['--depth' as string]: layer.depth }} />
      ))}
      <ellipse cx={W * 0.47} cy={H * 0.93} rx={W * 0.3} ry={H * 0.05} fill="url(#fallback-lake)" />
      <rect x={W * 0.68} y={H * 0.86} width={26} height={18} fill="#3b3a33" />
      <polygon points={`${W * 0.68 - 6},${H * 0.86} ${W * 0.68 + 13},${H * 0.83} ${W * 0.68 + 32},${H * 0.86}`} fill="#23262a" />
      <rect x={W * 0.68 + 5} y={H * 0.865} width={6} height={5} fill="#ffd99a" />
    </svg>
  );
}

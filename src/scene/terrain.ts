/*
 * Shared shape of the landscape. The WebGL scene and the static SVG fallback draw the
 * same ridges from the same deterministic noise, so the switch between them is seamless.
 */

/** Hash-based value noise in 1D, stable for a given seed. */
function hash(n: number): number {
  const s = Math.sin(n * 127.1 + 311.7) * 43758.5453;
  return s - Math.floor(s);
}

function smooth(t: number): number {
  return t * t * (3 - 2 * t);
}

function noise1(x: number, seed: number): number {
  const i = Math.floor(x);
  const f = x - i;
  return hash(i + seed * 57.3) * (1 - smooth(f)) + hash(i + 1 + seed * 57.3) * smooth(f);
}

/** Fractal noise in [0, 1]. */
export function fbm(x: number, seed: number, octaves = 4): number {
  let sum = 0;
  let amp = 0.5;
  let freq = 1;
  let norm = 0;
  for (let o = 0; o < octaves; o += 1) {
    sum += amp * noise1(x * freq, seed + o * 13);
    norm += amp;
    amp *= 0.5;
    freq *= 2.03;
  }
  return sum / norm;
}

export interface RidgeLayer {
  /** Distance from the viewer, in scene units (larger is farther). */
  depth: number;
  /** Height of the horizon line and amplitude of the peaks, as a fraction of the view. */
  base: number;
  amplitude: number;
  /** Horizontal frequency of the peaks. */
  frequency: number;
  seed: number;
  /** Adds a jagged pine-tree edge on top of the ridge. */
  treeline: boolean;
  color: string;
}

/** Back to front: far mineral peaks, then forested hills in pine greens. */
export const RIDGES: RidgeLayer[] = [
  { depth: 340, base: 0.5, amplitude: 0.34, frequency: 2.1, seed: 3, treeline: false, color: '#304b5b' },
  { depth: 250, base: 0.4, amplitude: 0.26, frequency: 3.2, seed: 11, treeline: false, color: '#233d4c' },
  { depth: 170, base: 0.3, amplitude: 0.16, frequency: 4.4, seed: 23, treeline: true, color: '#18312f' },
  { depth: 110, base: 0.2, amplitude: 0.1, frequency: 5.6, seed: 37, treeline: true, color: '#112622' },
];

/** Ridge height in [0, 1] (fraction of the view height) at horizontal position u in [0, 1]. */
export function ridgeHeight(layer: RidgeLayer, u: number): number {
  let h = layer.base + layer.amplitude * fbm(u * layer.frequency, layer.seed);
  if (layer.treeline) {
    // Narrow triangular spikes read as pine tops at a distance.
    const spikes = 90 + layer.seed;
    const tri = 1 - Math.abs(((u * spikes) % 1) * 2 - 1);
    h += tri * 0.012 * (0.6 + hash(Math.floor(u * spikes) + layer.seed));
  }
  return h;
}

/** Sky colours: deep night blue towards a soft mineral dawn as the page is read. */
export const SKY = {
  top: { start: '#081423', end: '#13304a' },
  horizon: { start: '#4a6878', end: '#8fa9ad' },
  glow: '#f2d9a6',
};

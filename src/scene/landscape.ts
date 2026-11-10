/*
 * Ambient WebGL landscape: a refuge between mountains and forest, drawn with light,
 * flat-shaded geometry, fog and several depth planes. Loaded lazily by AmbientBackdrop;
 * it only decorates, every control stays in the HTML on top of it.
 *
 * Deliberately calm: no creatures, no particles that could read as insects, no sound,
 * and motion that is slow, small and stops whenever the tab is hidden.
 */
import {
  AdditiveBlending,
  CanvasTexture,
  Color,
  ConeGeometry,
  BoxGeometry,
  DirectionalLight,
  DoubleSide,
  Fog,
  HemisphereLight,
  InstancedMesh,
  Material,
  Mesh,
  MeshBasicMaterial,
  MeshLambertMaterial,
  MeshPhongMaterial,
  Object3D,
  PerspectiveCamera,
  PlaneGeometry,
  PointLight,
  Scene,
  Shape,
  ShapeGeometry,
  ShaderMaterial,
  Sprite,
  SpriteMaterial,
  Texture,
  Vector3,
  WebGLRenderer,
  CircleGeometry,
} from 'three';
import { fbm, RIDGES, ridgeHeight, SKY } from './terrain';

export type Quality = 'high' | 'low';

export interface LandscapeOptions {
  quality: Quality;
  /** Called after the first frame is on screen, so the canvas can fade in. */
  onReady?: () => void;
  /** Called if the GPU drops the context; the page then keeps the static backdrop. */
  onLost?: () => void;
}

export interface Landscape {
  /** Reading progress of the page, 0 at the top and 1 at the end. */
  setProgress(progress: number): void;
  /** Pointer position in [-1, 1] on both axes (desktop only). */
  setPointer(x: number, y: number): void;
  /** Starts or stops the render loop (hidden tab, reduced motion). */
  setActive(active: boolean): void;
  resize(width: number, height: number): void;
  dispose(): void;
}

const FOV = 45;
const GROUND_Y = -14;
const LAKE = { x: -6, z: -58, rx: 40, rz: 15 };
const CABIN = { x: 24, z: -66 };
const MAX_PIXELS = 2_400_000;

const SETTINGS: Record<Quality, { trees: number; fps: number; maxRatio: number; antialias: boolean; segments: number }> = {
  high: { trees: 240, fps: 60, maxRatio: 1.5, antialias: true, segments: 220 },
  low: { trees: 90, fps: 30, maxRatio: 1, antialias: false, segments: 120 },
};

function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

/** Soft radial gradient used for the dawn glow and the mist banks. */
function radialTexture(inner: string, outer: string): CanvasTexture {
  const size = 128;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');
  if (ctx) {
    const gradient = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
    gradient.addColorStop(0, inner);
    gradient.addColorStop(1, outer);
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, size, size);
  }
  return new CanvasTexture(canvas);
}

function skyMaterial(): ShaderMaterial {
  return new ShaderMaterial({
    uniforms: {
      top: { value: new Color(SKY.top.start) },
      horizon: { value: new Color(SKY.horizon.start) },
    },
    vertexShader: /* glsl */ `
      varying float vY;
      void main() {
        vY = uv.y;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: /* glsl */ `
      uniform vec3 top;
      uniform vec3 horizon;
      varying float vY;
      void main() {
        float t = smoothstep(0.18, 0.95, vY);
        gl_FragColor = vec4(mix(horizon, top, t), 1.0);
      }
    `,
    depthWrite: false,
    fog: false,
  });
}

/** One silhouette plane per ridge: cheap, and fog gives the atmospheric depth. */
function ridgeMesh(index: number, segments: number): Mesh {
  const layer = RIDGES[index]!;
  const viewHeight = 2 * layer.depth * Math.tan((FOV / 2) * (Math.PI / 180));
  const width = viewHeight * 3.4;
  const shape = new Shape();
  shape.moveTo(-width / 2, -viewHeight);
  for (let i = 0; i <= segments; i += 1) {
    const u = i / segments;
    const y = (ridgeHeight(layer, u) - 0.5) * viewHeight * 0.92;
    shape.lineTo(-width / 2 + u * width, y);
  }
  shape.lineTo(width / 2, -viewHeight);
  shape.closePath();
  const mesh = new Mesh(new ShapeGeometry(shape), new MeshBasicMaterial({ color: layer.color }));
  mesh.position.set(0, 0, -layer.depth);
  return mesh;
}

function insideLake(x: number, z: number, margin = 1): boolean {
  const dx = (x - LAKE.x) / (LAKE.rx * margin);
  const dz = (z - LAKE.z) / (LAKE.rz * margin);
  return dx * dx + dz * dz < 1;
}

function forest(count: number): InstancedMesh {
  const geometry = new ConeGeometry(1.1, 4.6, 6);
  geometry.translate(0, 2.3, 0);
  const material = new MeshLambertMaterial({ flatShading: true });
  const mesh = new InstancedMesh(geometry, material, count);
  const dummy = new Object3D();
  const dark = new Color('#132c25');
  const light = new Color('#24473a');
  const tint = new Color();
  let placed = 0;
  let attempt = 0;
  while (placed < count && attempt < count * 20) {
    attempt += 1;
    const r1 = fbm(attempt * 0.731, 5, 2);
    const r2 = fbm(attempt * 1.379, 9, 2);
    const x = lerp(-110, 110, (r1 * 7.3) % 1);
    const z = lerp(-104, 2, (r2 * 5.9) % 1);
    if (insideLake(x, z, 1.15)) continue;
    // Keep a clearing in front of the camera and around the refuge.
    if (z > -36 && Math.abs(x) < 20) continue;
    if (Math.hypot(x - CABIN.x, z - CABIN.z) < 9) continue;
    const scale = 0.7 + ((r1 * 13.1) % 1) * 1.1;
    dummy.position.set(x, GROUND_Y, z);
    dummy.scale.set(scale, scale * (0.9 + ((r2 * 3.7) % 1) * 0.5), scale);
    dummy.rotation.y = r2 * Math.PI;
    dummy.updateMatrix();
    mesh.setMatrixAt(placed, dummy.matrix);
    mesh.setColorAt(placed, tint.copy(dark).lerp(light, (r2 * 11.3) % 1));
    placed += 1;
  }
  mesh.count = placed;
  mesh.instanceMatrix.needsUpdate = true;
  if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
  return mesh;
}

function refuge(scene: Scene, quality: Quality): void {
  const wall = new MeshLambertMaterial({ color: '#3b3a33', flatShading: true });
  const roof = new MeshLambertMaterial({ color: '#23262a', flatShading: true });
  const body = new Mesh(new BoxGeometry(6, 3.4, 4.4), wall);
  body.position.set(CABIN.x, GROUND_Y + 1.7, CABIN.z);
  const top = new Mesh(new ConeGeometry(4.6, 2.8, 4), roof);
  top.rotation.y = Math.PI / 4;
  top.position.set(CABIN.x, GROUND_Y + 4.8, CABIN.z);
  // The single warm light in the scene: the refuge window.
  const glass = new Mesh(new PlaneGeometry(1.4, 1), new MeshBasicMaterial({ color: '#ffd99a' }));
  glass.position.set(CABIN.x - 1.2, GROUND_Y + 1.9, CABIN.z + 2.21);
  scene.add(body, top, glass);
  if (quality === 'high') {
    const lamp = new PointLight('#ffcf8a', 26, 34, 1.6);
    lamp.position.set(CABIN.x - 1.2, GROUND_Y + 2, CABIN.z + 4);
    scene.add(lamp);
  }
}

export function createLandscape(canvas: HTMLCanvasElement, options: LandscapeOptions): Landscape {
  const settings = SETTINGS[options.quality];
  const renderer = new WebGLRenderer({ canvas, antialias: settings.antialias, alpha: false, powerPreference: 'low-power' });
  renderer.setClearColor(SKY.horizon.start);

  const scene = new Scene();
  // Far enough that the farthest ridge keeps about half its colour against the horizon.
  const fog = new Fog(SKY.horizon.start, 90, 640);
  scene.fog = fog;
  const camera = new PerspectiveCamera(FOV, 1, 1, 1200);

  const textures: Texture[] = [];

  const sky = new Mesh(new PlaneGeometry(2400, 1100), skyMaterial());
  sky.position.set(0, 180, -480);
  scene.add(sky);

  const glowTexture = radialTexture('rgba(255,236,200,0.9)', 'rgba(255,236,200,0)');
  textures.push(glowTexture);
  const glow = new Sprite(new SpriteMaterial({ map: glowTexture, color: SKY.glow, blending: AdditiveBlending, transparent: true, depthWrite: false, fog: false }));
  glow.position.set(-70, 46, -420);
  glow.scale.set(170, 170, 1);
  scene.add(glow);

  RIDGES.forEach((_, index) => scene.add(ridgeMesh(index, settings.segments)));

  const ground = new Mesh(new PlaneGeometry(320, 140, 1, 1), new MeshLambertMaterial({ color: '#0f2420' }));
  ground.rotation.x = -Math.PI / 2;
  ground.position.set(0, GROUND_Y, -50);
  scene.add(ground);

  const lake = new Mesh(
    new CircleGeometry(1, 48),
    new MeshPhongMaterial({ color: '#1b3446', specular: '#9fb7c7', shininess: 60, side: DoubleSide }),
  );
  lake.rotation.x = -Math.PI / 2;
  lake.scale.set(LAKE.rx, LAKE.rz, 1);
  lake.position.set(LAKE.x, GROUND_Y + 0.05, LAKE.z);
  scene.add(lake);

  // A faint reflection of the dawn glow on the water.
  const shimmerTexture = radialTexture('rgba(255,230,190,0.55)', 'rgba(255,230,190,0)');
  textures.push(shimmerTexture);
  const shimmer = new Mesh(
    new PlaneGeometry(26, 9),
    new MeshBasicMaterial({ map: shimmerTexture, transparent: true, blending: AdditiveBlending, depthWrite: false }),
  );
  shimmer.rotation.x = -Math.PI / 2;
  shimmer.position.set(LAKE.x - 8, GROUND_Y + 0.1, LAKE.z - 4);
  scene.add(shimmer);

  scene.add(forest(settings.trees));
  refuge(scene, options.quality);

  const mistTexture = radialTexture('rgba(220,232,236,0.55)', 'rgba(220,232,236,0)');
  textures.push(mistTexture);
  const mists = [
    { z: -200, y: -6, scale: 260, opacity: 0.16 },
    { z: -130, y: -10, scale: 190, opacity: 0.14 },
    { z: -80, y: -12, scale: 120, opacity: 0.1 },
  ].map((m, i) => {
    const sprite = new Sprite(new SpriteMaterial({ map: mistTexture, transparent: true, opacity: m.opacity, depthWrite: false }));
    sprite.position.set(i * 30 - 30, m.y, m.z);
    sprite.scale.set(m.scale, m.scale * 0.22, 1);
    scene.add(sprite);
    return { sprite, baseX: sprite.position.x, phase: i * 1.7 };
  });

  const hemi = new HemisphereLight('#9fb7c7', '#08130f', 1.1);
  const sun = new DirectionalLight('#f3dcb0', 0.9);
  sun.position.set(-0.6, 0.5, -1);
  scene.add(hemi, sun);

  const topStart = new Color(SKY.top.start);
  const topEnd = new Color(SKY.top.end);
  const horizonStart = new Color(SKY.horizon.start);
  const horizonEnd = new Color(SKY.horizon.end);
  const horizon = new Color();
  const skyUniforms = (sky.material as ShaderMaterial).uniforms;
  const target = new Vector3();

  let targetProgress = 0;
  let progress = 0;
  let pointerX = 0;
  let pointerY = 0;
  let smoothX = 0;
  let smoothY = 0;
  let raf = 0;
  let last = 0;
  let ready = false;
  let disposed = false;
  const frameInterval = 1000 / settings.fps;

  function update(seconds: number): void {
    // Slow glides: the camera follows the reading position and the pointer with lag.
    progress += (targetProgress - progress) * 0.05;
    smoothX += (pointerX - smoothX) * 0.04;
    smoothY += (pointerY - smoothY) * 0.04;

    const bob = Math.sin(seconds * 0.35) * 0.18;
    camera.position.set(smoothX * 1.8, lerp(0, -5, progress) + bob - smoothY * 0.8, lerp(0, -36, progress));
    target.set(smoothX * 4, camera.position.y + lerp(3, 1, progress), camera.position.z - 120);
    camera.lookAt(target);

    // The light warms a little towards the end of the page, like early morning.
    skyUniforms.top!.value.copy(topStart).lerp(topEnd, progress);
    horizon.copy(horizonStart).lerp(horizonEnd, progress * 0.85);
    skyUniforms.horizon!.value.copy(horizon);
    fog.color.copy(horizon);
    renderer.setClearColor(horizon);
    (glow.material as SpriteMaterial).opacity = lerp(0.35, 0.75, progress);
    glow.position.y = lerp(40, 60, progress);

    for (const mist of mists) {
      mist.sprite.position.x = mist.baseX + Math.sin(seconds * 0.03 + mist.phase) * 12;
    }
  }

  function frame(now: number): void {
    raf = requestAnimationFrame(frame);
    if (now - last < frameInterval) return;
    last = now;
    update(now / 1000);
    renderer.render(scene, camera);
    if (!ready) {
      ready = true;
      options.onReady?.();
    }
  }

  function handleLost(event: Event): void {
    event.preventDefault();
    cancelAnimationFrame(raf);
    raf = 0;
    options.onLost?.();
  }
  canvas.addEventListener('webglcontextlost', handleLost);

  return {
    setProgress(value) {
      targetProgress = Math.min(1, Math.max(0, value));
    },
    setPointer(x, y) {
      pointerX = x;
      pointerY = y;
    },
    setActive(active) {
      if (disposed) return;
      if (active && !raf) raf = requestAnimationFrame(frame);
      if (!active && raf) {
        cancelAnimationFrame(raf);
        raf = 0;
      }
    },
    resize(width, height) {
      if (disposed || width === 0 || height === 0) return;
      // Cap the drawing buffer: device ratio limit, then a total pixel budget.
      let ratio = Math.min(window.devicePixelRatio || 1, settings.maxRatio);
      if (width * height * ratio * ratio > MAX_PIXELS) ratio = Math.sqrt(MAX_PIXELS / (width * height));
      renderer.setPixelRatio(ratio);
      renderer.setSize(width, height, false);
      camera.aspect = width / height;
      camera.updateProjectionMatrix();
    },
    dispose() {
      disposed = true;
      cancelAnimationFrame(raf);
      raf = 0;
      canvas.removeEventListener('webglcontextlost', handleLost);
      scene.traverse((object) => {
        const mesh = object as Mesh;
        mesh.geometry?.dispose();
        const material = mesh.material as Material | Material[] | undefined;
        (Array.isArray(material) ? material : material ? [material] : []).forEach((m) => m.dispose());
      });
      textures.forEach((texture) => texture.dispose());
      renderer.dispose();
      renderer.forceContextLoss();
    },
  };
}

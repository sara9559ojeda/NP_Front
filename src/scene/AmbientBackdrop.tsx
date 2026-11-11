import { useEffect, useRef, useState } from 'react';
import { usePrefersReducedMotion } from '../hooks/usePrefersReducedMotion';
import type { Landscape, Quality } from './landscape';
import { LandscapeFallback } from './LandscapeFallback';

/** immersive: public pages, 3D when possible. calm: inner panels, static and dimmed. */
export type BackdropMode = 'immersive' | 'calm';

interface AmbientBackdropProps {
  mode: BackdropMode;
  /** Fixed scene position (e.g. sign in); without it the scene follows the scroll. */
  fixedProgress?: number;
  /** Stronger veil behind forms. */
  dim?: boolean;
}

function supportsWebGL(): boolean {
  try {
    const canvas = document.createElement('canvas');
    return Boolean(canvas.getContext('webgl2') ?? canvas.getContext('webgl'));
  } catch {
    return false;
  }
}

/** Data saver on: keep the static landscape. Small screens still get the scene, at low quality. */
function wantsLightweight(): boolean {
  const connection = (navigator as Navigator & { connection?: { saveData?: boolean } }).connection;
  return Boolean(connection?.saveData);
}

function pickQuality(): Quality {
  const small = typeof window.matchMedia === 'function' && window.matchMedia('(max-width: 760px), (pointer: coarse)').matches;
  const cores = navigator.hardwareConcurrency ?? 8;
  return small || cores <= 4 ? 'low' : 'high';
}

function scrollProgress(): number {
  const max = document.documentElement.scrollHeight - window.innerHeight;
  return max > 0 ? window.scrollY / max : 0;
}

/**
 * Fixed background layer. The static landscape is always rendered first, so the page is
 * usable and legible before (or without) WebGL; the 3D scene loads lazily on top of it.
 */
export function AmbientBackdrop({ mode, fixedProgress, dim = false }: AmbientBackdropProps) {
  const reducedMotion = usePrefersReducedMotion();
  const rootRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const sceneRef = useRef<Landscape | null>(null);
  const fixedRef = useRef(fixedProgress);
  fixedRef.current = fixedProgress;
  const [eligible, setEligible] = useState(false);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    setEligible(mode === 'immersive' && !reducedMotion && !wantsLightweight() && supportsWebGL());
  }, [mode, reducedMotion]);

  // Scroll position drives the scene and a light parallax on the static layers.
  const still = reducedMotion || mode === 'calm';

  useEffect(() => {
    if (still) return;
    let frame = 0;
    const apply = () => {
      frame = 0;
      const progress = fixedRef.current ?? scrollProgress();
      rootRef.current?.style.setProperty('--scroll-p', progress.toFixed(4));
      sceneRef.current?.setProgress(progress);
    };
    const onScroll = () => {
      if (!frame) frame = requestAnimationFrame(apply);
    };
    apply();
    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', onScroll);
    return () => {
      window.removeEventListener('scroll', onScroll);
      window.removeEventListener('resize', onScroll);
      cancelAnimationFrame(frame);
    };
  }, [still, fixedProgress]);

  useEffect(() => {
    if (!eligible) return;
    let cancelled = false;
    let scene: Landscape | null = null;
    const canvas = canvasRef.current;

    const resize = () => scene?.resize(window.innerWidth, window.innerHeight);
    const onVisibility = () => scene?.setActive(!document.hidden);
    const finePointer = typeof window.matchMedia === 'function' && window.matchMedia('(pointer: fine)').matches;
    const onPointer = (event: PointerEvent) =>
      scene?.setPointer((event.clientX / window.innerWidth) * 2 - 1, (event.clientY / window.innerHeight) * 2 - 1);

    const start = () => {
      import('./landscape')
        .then(({ createLandscape }) => {
          if (cancelled || !canvas) return;
          try {
            scene = createLandscape(canvas, {
              quality: pickQuality(),
              onReady: () => !cancelled && setReady(true),
              onLost: () => {
                if (cancelled) return;
                setReady(false);
                setEligible(false);
              },
            });
          } catch {
            setEligible(false);
            return;
          }
          sceneRef.current = scene;
          resize();
          scene.setProgress(fixedRef.current ?? scrollProgress());
          scene.setActive(!document.hidden);
          window.addEventListener('resize', resize);
          document.addEventListener('visibilitychange', onVisibility);
          if (finePointer) window.addEventListener('pointermove', onPointer, { passive: true });
        })
        .catch(() => setEligible(false));
    };

    // Wait until the page is idle: the content and controls never wait for the scene.
    const hasIdle = typeof window.requestIdleCallback === 'function';
    const idle = hasIdle ? window.requestIdleCallback(start, { timeout: 1500 }) : window.setTimeout(start, 300);

    return () => {
      cancelled = true;
      if (hasIdle) window.cancelIdleCallback(idle);
      else window.clearTimeout(idle);
      window.removeEventListener('resize', resize);
      document.removeEventListener('visibilitychange', onVisibility);
      window.removeEventListener('pointermove', onPointer);
      scene?.dispose();
      sceneRef.current = null;
      setReady(false);
    };
  }, [eligible]);

  return (
    <div
      ref={rootRef}
      className={`backdrop backdrop--${mode}${dim ? ' backdrop--dim' : ''}${still ? '' : ' backdrop--moving'}`}
      aria-hidden="true"
    >
      <LandscapeFallback />
      {eligible && <canvas ref={canvasRef} className={`backdrop__canvas${ready ? ' is-ready' : ''}`} />}
      <div className="backdrop__veil" />
    </div>
  );
}

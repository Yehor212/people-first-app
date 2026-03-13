/**
 * ValenceOrb — GPU-accelerated orb for State of Mind valence step.
 *
 * Progressive enhancement (Law 22 — probe highest tier first):
 *   WebGL 2.0 available → GLSL 300 es shader (10/10 quality, 60fps capable)
 *   WebGL 1.0 available → GLSL ES 1.0 shader (10/10 quality, 60fps capable)
 *   Neither available → Canvas 2D fallback (8/10 quality, 30fps)
 *
 * Both paths share the same particle system, shape presets, and color mapping.
 * Context loss recovery: seamless WebGL → Canvas 2D → WebGL on restore.
 *
 * Law 12 (Performance): 30fps RAF, IntersectionObserver pause, DPR cap at 2x.
 * Law 18 (Cleanup): mounted guard, RAF cancel, observer disconnect, GL dispose, listener removal.
 * Dopamine gate: shouldAnimate() → static frame if disabled.
 *
 * Canvas management: canvases are created programmatically (not via JSX ref) to allow
 * replacing a WebGL-locked canvas with a fresh one for Canvas 2D fallback.
 * Per HTML spec, once getContext('webgl2') succeeds, the same canvas cannot provide
 * a '2d' context — a new <canvas> element is the only solution.
 */

import { useRef, useEffect, useState, memo } from 'react';
import { shouldAnimate } from '@/lib/animationUtils';
import { recordError } from '@/lib/crashReporting';
import { createParticlePool, updateParticles } from './particleSystem';
import { drawOrbScene, getShapeParams } from './orbRenderer';
import { valenceToHSL } from './colorUtils';
import { createOrbGL2, createOrbGL } from './orbShader';
import type { Particle } from './particleSystem';
import type { OrbGLRenderer } from './orbShader';

interface ValenceOrbProps {
  /** Current valence value (-1.0 to 1.0) */
  valence: number;
  /** Size in px (width = height) */
  size?: number;
}

const FRAME_INTERVAL = 1000 / 30; // 30fps
const PARTICLE_COUNT = 22;

/** Create a fresh canvas element configured for the given size */
function createCanvas(size: number, dpr: number): HTMLCanvasElement {
  const c = document.createElement('canvas');
  c.width = size * dpr;
  c.height = size * dpr;
  c.style.width = `${size}px`;
  c.style.height = `${size}px`;
  c.setAttribute('aria-hidden', 'true');
  return c;
}

export const ValenceOrb = memo(function ValenceOrb({ valence, size = 192 }: ValenceOrbProps) {
  const wrapperRef = useRef<HTMLDivElement>(null);
  const rafRef = useRef(0);
  const mountedRef = useRef(true);
  const isVisibleRef = useRef(true);
  const glRendererRef = useRef<OrbGLRenderer | null>(null);
  const canvasElRef = useRef<HTMLCanvasElement | null>(null);
  const [ctxFailed, setCtxFailed] = useState(false);

  // Mutable animation state — avoids React re-renders during animation
  const stateRef = useRef<{
    targetValence: number;
    currentValence: number;
    time: number;
    particles: Particle[];
    lastFrame: number;
  } | null>(null);

  // Keep target valence in sync with prop
  const valenceRef = useRef(valence);
  valenceRef.current = valence;
  if (stateRef.current) {
    stateRef.current.targetValence = valence;
  }

  // Law 18: track mounted state
  useEffect(() => {
    mountedRef.current = true;
    return () => { mountedRef.current = false; };
  }, []);

  // IntersectionObserver: pause RAF when off-screen
  useEffect(() => {
    const wrapper = wrapperRef.current;
    if (!wrapper) return;

    const observer = new IntersectionObserver(
      ([entry]) => { isVisibleRef.current = entry.isIntersecting; },
      { threshold: 0 },
    );
    observer.observe(wrapper);
    return () => observer.disconnect();
  }, []);

  // Main canvas + animation setup
  useEffect(() => {
    const wrapper = wrapperRef.current;
    if (!wrapper) return;

    const dpr = Math.min(window.devicePixelRatio || 1, 2);

    // Initialize animation state
    const cx = size / 2;
    const cy = size / 2;
    const innerR = size * 0.28;
    const outerR = size * 0.42;

    stateRef.current = {
      targetValence: valenceRef.current,
      currentValence: valenceRef.current,
      time: 0,
      particles: createParticlePool(PARTICLE_COUNT, cx, cy, innerR, outerR),
      lastFrame: 0,
    };

    const isDarkRead = () => document.documentElement.classList.contains('dark');

    // ── Progressive enhancement with fresh canvas per tier (Law 22) ──
    // Key: each tier gets a fresh canvas to avoid context locking.
    // Per HTML spec, once getContext('webgl2') succeeds, getContext('2d')
    // on the same canvas returns null — a new <canvas> element is required.

    let activeCanvas: HTMLCanvasElement;
    let glRenderer: OrbGLRenderer | null = null;
    let ctx2d: CanvasRenderingContext2D | null = null;

    // Attempt 1: WebGL 2.0
    const gl2Canvas = createCanvas(size, dpr);
    const gl2Renderer = createOrbGL2(gl2Canvas);

    if (gl2Renderer) {
      glRenderer = gl2Renderer;
      activeCanvas = gl2Canvas;
    } else {
      // Attempt 2: WebGL 1.0 on a FRESH canvas
      // (gl2Canvas may be locked to webgl2 if getContext succeeded but shader failed)
      const gl1Canvas = createCanvas(size, dpr);
      const gl1Renderer = createOrbGL(gl1Canvas);

      if (gl1Renderer) {
        glRenderer = gl1Renderer;
        activeCanvas = gl1Canvas;
      } else {
        // Attempt 3: Canvas 2D on a fresh canvas
        const c2dCanvas = createCanvas(size, dpr);
        try {
          ctx2d = c2dCanvas.getContext('2d', { willReadFrequently: false });
        } catch (err) {
          recordError(err, { component: 'ValenceOrb', action: 'canvas2d-probe' });
          ctx2d = null;
        }

        if (!ctx2d) {
          setCtxFailed(true);
          return;
        }
        activeCanvas = c2dCanvas;
      }
    }

    glRendererRef.current = glRenderer;
    canvasElRef.current = activeCanvas;
    wrapper.appendChild(activeCanvas);

    // ── Render helpers ──
    const renderGL = (v: number, t: number, particles: Particle[]) => {
      const gl = glRendererRef.current;
      if (!gl) return;
      gl.render({
        valence: v,
        time: t,
        size,
        dpr,
        isDark: isDarkRead(),
        color: valenceToHSL(v),
        shape: getShapeParams(v),
        particles,
      });
    };

    const renderCanvas2D = (v: number, t: number, particles: Particle[]) => {
      if (!ctx2d) return;
      drawOrbScene(ctx2d, {
        valence: v,
        time: t,
        particles,
        size,
        dpr,
        isDark: isDarkRead(),
      });
    };

    let render = glRenderer ? renderGL : renderCanvas2D;

    // ── Fallback canvas for context loss recovery ──
    let fallbackCanvas: HTMLCanvasElement | null = null;

    /** Degrade to Canvas 2D on a fresh canvas (WebGL canvas is locked) */
    const degradeToCanvas2D = () => {
      fallbackCanvas = createCanvas(size, dpr);
      ctx2d = fallbackCanvas.getContext('2d', { willReadFrequently: false });

      if (ctx2d) {
        activeCanvas.style.display = 'none';
        wrapper.appendChild(fallbackCanvas);
        render = renderCanvas2D;
      }
    };

    // ── Animation loop ──
    const loop = (timestamp: number) => {
      if (!mountedRef.current) return;

      const state = stateRef.current;
      if (!state) return;

      // Runtime dopamine gate
      if (!shouldAnimate()) {
        try { render(state.currentValence, state.time, state.particles); } catch { /* static frame best-effort */ }
        return;
      }

      // Throttle to 30fps
      if (timestamp - state.lastFrame < FRAME_INTERVAL) {
        rafRef.current = requestAnimationFrame(loop);
        return;
      }
      state.lastFrame = timestamp;

      // Interpolate valence (exponential ease)
      state.currentValence += (state.targetValence - state.currentValence) * 0.06;
      state.time += 1 / 30;

      // Update particles (skip when off-screen to save CPU)
      if (isVisibleRef.current) {
        updateParticles(
          state.particles,
          state.currentValence,
          cx, cy,
          innerR, outerR,
        );
      }

      // Draw scene (skip when off-screen, catch errors to prevent loop death)
      if (isVisibleRef.current) {
        try {
          render(state.currentValence, state.time, state.particles);
        } catch (err) {
          recordError(err, { component: 'ValenceOrb', action: 'render' });

          if (glRendererRef.current) {
            // WebGL render threw — degrade to Canvas 2D
            glRendererRef.current.dispose();
            glRendererRef.current = null;
            degradeToCanvas2D();
          } else {
            // Canvas 2D render also threw — give up
            cancelAnimationFrame(rafRef.current);
            setCtxFailed(true);
            return;
          }
        }
      }

      rafRef.current = requestAnimationFrame(loop);
    };

    // ── Context loss recovery (Law 22, Part 10) ──
    const handleContextLost = (e: Event) => {
      e.preventDefault();
      cancelAnimationFrame(rafRef.current);
      glRendererRef.current?.dispose();
      glRendererRef.current = null;

      // Cannot getContext('2d') on a WebGL-locked canvas — create a fresh one
      degradeToCanvas2D();

      // Restart RAF loop with Canvas 2D rendering
      if (ctx2d && shouldAnimate() && mountedRef.current) {
        rafRef.current = requestAnimationFrame(loop);
      }

      recordError(
        new Error('WebGL context lost — degraded to Canvas 2D'),
        { component: 'ValenceOrb' },
      );
    };

    const handleContextRestored = () => {
      // Re-probe WebGL on the original canvas (it gets its context back)
      const restored = createOrbGL2(activeCanvas) ?? createOrbGL(activeCanvas);
      if (restored) {
        glRendererRef.current = restored;
        ctx2d = null;
        render = renderGL;

        // Remove fallback canvas, show original
        activeCanvas.style.display = '';
        if (fallbackCanvas && wrapper.contains(fallbackCanvas)) {
          wrapper.removeChild(fallbackCanvas);
          fallbackCanvas = null;
        }
      }
      // Restart RAF loop
      if (shouldAnimate() && mountedRef.current) {
        rafRef.current = requestAnimationFrame(loop);
      }
    };

    // Only attach WebGL event listeners if we're using WebGL
    if (glRenderer) {
      activeCanvas.addEventListener('webglcontextlost', handleContextLost);
      activeCanvas.addEventListener('webglcontextrestored', handleContextRestored);
    }

    // ── Cleanup ──
    const cleanup = () => {
      cancelAnimationFrame(rafRef.current);
      if (glRenderer) {
        activeCanvas.removeEventListener('webglcontextlost', handleContextLost);
        activeCanvas.removeEventListener('webglcontextrestored', handleContextRestored);
      }
      glRendererRef.current?.dispose();
      glRendererRef.current = null;
      canvasElRef.current = null;

      // Remove canvas elements from DOM
      if (wrapper.contains(activeCanvas)) {
        wrapper.removeChild(activeCanvas);
      }
      if (fallbackCanvas && wrapper.contains(fallbackCanvas)) {
        wrapper.removeChild(fallbackCanvas);
      }
    };

    // ── Animation gate ──
    if (!shouldAnimate()) {
      try { render(valenceRef.current, 0, stateRef.current.particles); } catch { /* best-effort */ }
      return cleanup;
    }

    rafRef.current = requestAnimationFrame(loop);

    return cleanup;
  }, [size]);

  // Update static frame when valence changes and animations are off
  useEffect(() => {
    if (shouldAnimate()) return;

    const canvas = canvasElRef.current;
    if (!canvas) return;
    const state = stateRef.current;
    if (!state) return;

    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    state.currentValence = valence;

    if (glRendererRef.current) {
      glRendererRef.current.render({
        valence,
        time: 0,
        size,
        dpr,
        isDark: document.documentElement.classList.contains('dark'),
        color: valenceToHSL(valence),
        shape: getShapeParams(valence),
        particles: state.particles,
      });
    } else {
      const ctx = canvas.getContext('2d');
      if (!ctx) return;
      drawOrbScene(ctx, {
        valence,
        time: 0,
        particles: state.particles,
        size,
        dpr,
        isDark: document.documentElement.classList.contains('dark'),
      });
    }
  }, [valence, size]);

  // Context failure fallback — soft radial gradient instead of boring pulse
  if (ctxFailed) {
    return (
      <div
        ref={wrapperRef}
        className="relative flex items-center justify-center flex-shrink-0"
        style={{ width: size, height: size }}
        aria-hidden="true"
      >
        <div
          className="rounded-full motion-safe:animate-pulse"
          style={{
            width: size * 0.7,
            height: size * 0.7,
            background: `radial-gradient(circle at 35% 35%,
              hsl(var(--primary) / 0.3),
              hsl(var(--primary) / 0.15) 50%,
              hsl(var(--primary) / 0.05) 80%,
              transparent)`,
            filter: 'blur(4px)',
          }}
        />
      </div>
    );
  }

  return (
    <div
      ref={wrapperRef}
      className="relative flex items-center justify-center"
      style={{ width: size, height: size }}
      aria-hidden="true"
    />
  );
});

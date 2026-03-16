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
import { hapticTap } from '@/lib/haptics';
import { hapticMedium } from '@/lib/haptics';
import { createParticlePool, updateParticles, burstParticles } from './particleSystem';
import { drawOrbScene, getShapeParams } from './orbRenderer';
import { valenceToHSL } from './colorUtils';
import { createOrbGL2, createOrbGL } from './orbShader';
import type { Particle } from './particleSystem';
import type { OrbGLRenderer } from './orbShader';

// Module-level: genesis plays only once per browser session
let genesisPlayed = false;

interface ValenceOrbProps {
  /** Current valence value (-1.0 to 1.0) */
  valence: number;
  /** Size in px (width = height) */
  size?: number;
}

const WEBGL_FRAME_INTERVAL = 1000 / 60; // 60fps for WebGL (shader is <1ms)
const CANVAS_FRAME_INTERVAL = 1000 / 30; // 30fps for Canvas 2D fallback
const PARTICLE_COUNT = 22;

/** Probe whether WebGL actually renders (catches WKWebView/in-app browser broken contexts) */
function probeWebGLWorks(): boolean {
  try {
    const c = document.createElement('canvas');
    c.width = 1;
    c.height = 1;
    const gl = c.getContext('webgl2', { preserveDrawingBuffer: true })
            ?? c.getContext('webgl', { preserveDrawingBuffer: true });
    if (!gl) return false;

    // Clear to known color and read back
    gl.clearColor(1, 0, 0, 1);
    gl.clear(gl.COLOR_BUFFER_BIT);
    const pixel = new Uint8Array(4);
    gl.readPixels(0, 0, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, pixel);

    // Free test context
    gl.getExtension('WEBGL_lose_context')?.loseContext();

    // If WebGL is broken (WKWebView), pixel will be all zeros
    return pixel[0] > 200 && pixel[3] > 200;
  } catch {
    return false;
  }
}

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
  const genesisStartRef = useRef(0);
  const touchRef = useRef<{ x: number; y: number; startTime: number } | null>(null);
  const shimmerRef = useRef(0); // P3: 1.0→0 decaying flash on large valence change
  const prevStableValenceRef = useRef(0); // P3: last settled valence for delta detection
  const lastInteractionRef = useRef(performance.now()); // P4: idle awareness

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
    lastInteractionRef.current = performance.now(); // P4: slider change = interaction
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

    // Genesis plays once per session — skip on re-mounts (tab switches, etc.)
    if (genesisPlayed) {
      genesisStartRef.current = -10000; // far in past → computeGenesis returns 1.0 instantly
    } else {
      genesisStartRef.current = performance.now();
      genesisPlayed = true;
    }

    const isDarkRead = () => document.documentElement.classList.contains('dark');

    // ── Progressive enhancement with fresh canvas per tier (Law 22) ──
    // Key: each tier gets a fresh canvas to avoid context locking.
    // Per HTML spec, once getContext('webgl2') succeeds, getContext('2d')
    // on the same canvas returns null — a new <canvas> element is required.

    let activeCanvas: HTMLCanvasElement;
    let glRenderer: OrbGLRenderer | null = null;
    let ctx2d: CanvasRenderingContext2D | null = null;

    // Functional probe: verify WebGL actually renders pixels
    // (WKWebView/in-app browsers may return a context that produces no output)
    const webglWorks = probeWebGLWorks();

    if (webglWorks) {
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
        }
      }
    }

    // Canvas 2D fallback (always tried if WebGL skipped or failed)
    if (!glRenderer) {
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

    glRendererRef.current = glRenderer;
    canvasElRef.current = activeCanvas;
    wrapper.appendChild(activeCanvas);

    // ── Genesis easing (ease-out-back with slight overshoot) ──
    const computeGenesis = (timestamp: number): number => {
      const elapsed = (timestamp - genesisStartRef.current) / 1000;
      if (elapsed >= 1.5) return 1.0;
      const t = elapsed / 1.5;
      const c1 = 1.70158;
      const c3 = c1 + 1;
      return Math.max(0, 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2));
    };

    // ── Touch state ──
    const computeTouch = (time: number): { x: number; y: number; age: number } => {
      const tc = touchRef.current;
      if (!tc) return { x: 0, y: 0, age: 0 };
      const age = time - tc.startTime;
      if (age > 1.5) { touchRef.current = null; return { x: 0, y: 0, age: 0 }; }
      return { x: tc.x, y: tc.y, age };
    };

    // ── Render helpers ──
    const renderGL = (v: number, t: number, particles: Particle[], timestamp = performance.now()) => {
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
        genesis: computeGenesis(timestamp),
        touch: computeTouch(t),
        shimmer: shimmerRef.current,
      });
    };

    const renderCanvas2D = (v: number, t: number, particles: Particle[], _timestamp?: number) => {
      if (!ctx2d) return;
      drawOrbScene(ctx2d, {
        valence: v,
        time: t,
        particles,
        size,
        dpr,
        isDark: isDarkRead(),
        shimmer: shimmerRef.current,
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

      // Throttle: 60fps for WebGL, 30fps for Canvas 2D
      const frameInterval = glRendererRef.current ? WEBGL_FRAME_INTERVAL : CANVAS_FRAME_INTERVAL;
      const elapsed = timestamp - state.lastFrame;
      if (elapsed < frameInterval) {
        rafRef.current = requestAnimationFrame(loop);
        return;
      }
      // dt in seconds (clamped to avoid spiral-of-death on tab-switch)
      const dt = Math.min(elapsed / 1000, 0.1);
      state.lastFrame = timestamp;

      // ── P3: Shimmer detection (large valence change from stable state) ──
      const settled = Math.abs(state.targetValence - state.currentValence) < 0.01;
      if (settled) {
        // Check if new target diverges significantly from last stable value
        const delta = Math.abs(state.targetValence - prevStableValenceRef.current);
        if (delta > 0.3 && shimmerRef.current < 0.1) {
          shimmerRef.current = 1.0;
          void hapticMedium(); // tactile punctuation for the transformation
          burstParticles(state.particles, 8, cx, cy, innerR, outerR);
        }
        prevStableValenceRef.current = state.currentValence;
      }

      // Shimmer decay: dt-based exponential (~0.8s half-life, frame-rate independent)
      shimmerRef.current *= Math.pow(0.08, dt); // 0.08^(1/30) ≈ 0.92 per frame at 30fps
      if (shimmerRef.current < 0.005) shimmerRef.current = 0;

      // P3: Slow interpolation during shimmer (dramatic metamorphosis)
      // dt-based: 1 - (1 - rate)^(dt*30) ensures same visual speed at any fps
      const baseLerp = shimmerRef.current > 0.1 ? 0.02 : 0.06;
      const lerpRate = 1 - Math.pow(1 - baseLerp, dt * 30);

      // Interpolate valence (exponential ease)
      state.currentValence += (state.targetValence - state.currentValence) * lerpRate;

      // ── P4: Idle awareness (meditative slowdown after 8s inactivity) ──
      const idleElapsed = timestamp - lastInteractionRef.current;
      const idleFactor = Math.max(0, Math.min(1, (idleElapsed - 8000) / 4000));

      state.time += dt * (1 - idleFactor * 0.4); // idle → 40% slower internal time

      // Update particles (skip when off-screen to save CPU)
      if (isVisibleRef.current) {
        updateParticles(
          state.particles,
          state.currentValence,
          cx, cy,
          innerR, outerR,
          idleFactor, // P4: calm factor
        );
      }

      // Proactive context loss detection (iOS 17+ WKWebView — context lost without event)
      if (glRendererRef.current?.isContextLost()) {
        glRendererRef.current.dispose();
        glRendererRef.current = null;
        degradeToCanvas2D();
      }

      // Draw scene (skip when off-screen, catch errors to prevent loop death)
      if (isVisibleRef.current) {
        try {
          render(state.currentValence, state.time, state.particles, timestamp);
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

    // ── Touch ripple handler (P2) ──
    const handlePointerDown = (e: PointerEvent) => {
      const rect = activeCanvas.getBoundingClientRect();
      const x = (e.clientX - rect.left) / rect.width;
      const y = 1.0 - (e.clientY - rect.top) / rect.height; // flip Y for WebGL UV
      const state = stateRef.current;
      if (state) {
        touchRef.current = { x, y, startTime: state.time };
        lastInteractionRef.current = performance.now(); // P4: reset idle
        void hapticTap(); // Tactile feedback on touch (Law 22 — sensory pairing)
      }
    };
    // passive: true — never blocks scroll/swipe gestures
    wrapper.addEventListener('pointerdown', handlePointerDown, { passive: true });

    // ── Cleanup ──
    const cleanup = () => {
      cancelAnimationFrame(rafRef.current);
      wrapper.removeEventListener('pointerdown', handlePointerDown);
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
        genesis: 1.0,
        touch: { x: 0, y: 0, age: 0 },
        shimmer: 0,
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
      style={{ width: size, height: size, touchAction: 'manipulation' }}
      aria-hidden="true"
    />
  );
});

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
 */

import { useRef, useEffect, useState, memo } from 'react';
import { shouldAnimate } from '@/lib/animationUtils';
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

export const ValenceOrb = memo(function ValenceOrb({ valence, size = 192 }: ValenceOrbProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const wrapperRef = useRef<HTMLDivElement>(null);
  const rafRef = useRef(0);
  const mountedRef = useRef(true);
  const isVisibleRef = useRef(true);
  const glRendererRef = useRef<OrbGLRenderer | null>(null);
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
    const canvas = canvasRef.current;
    if (!canvas) return;

    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = size * dpr;
    canvas.height = size * dpr;
    canvas.style.width = `${size}px`;
    canvas.style.height = `${size}px`;

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

    // ── Progressive enhancement: probe highest tier first (Law 22) ──
    const glRenderer = createOrbGL2(canvas) ?? createOrbGL(canvas);
    glRendererRef.current = glRenderer;

    // Canvas 2D fallback (only if all WebGL paths failed)
    let ctx2d: CanvasRenderingContext2D | null = null;
    if (!glRenderer) {
      ctx2d = canvas.getContext('2d', { willReadFrequently: false });
      if (!ctx2d) {
        setCtxFailed(true);
        return;
      }
    }

    // ── Render helpers (use refs for context-loss resilience) ──
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

    // ── Context loss recovery (Law 22, Part 10) ──
    const handleContextLost = (e: Event) => {
      e.preventDefault();
      cancelAnimationFrame(rafRef.current);
      glRendererRef.current?.dispose();
      glRendererRef.current = null;
      // Degrade to Canvas 2D — user sees no interruption
      ctx2d = canvas.getContext('2d', { willReadFrequently: false });
      render = renderCanvas2D;
    };

    const handleContextRestored = () => {
      // Re-probe from highest tier
      const restored = createOrbGL2(canvas) ?? createOrbGL(canvas);
      if (restored) {
        glRendererRef.current = restored;
        ctx2d = null;
        render = renderGL;
      }
    };

    canvas.addEventListener('webglcontextlost', handleContextLost);
    canvas.addEventListener('webglcontextrestored', handleContextRestored);

    // ── Animation ──
    const animate = shouldAnimate();

    if (!animate) {
      render(valenceRef.current, 0, stateRef.current.particles);
      return;
    }

    const loop = (timestamp: number) => {
      if (!mountedRef.current) return;

      const state = stateRef.current;
      if (!state) return;

      // Runtime dopamine gate
      if (!shouldAnimate()) {
        render(state.currentValence, state.time, state.particles);
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

      // Draw scene (skip when off-screen)
      if (isVisibleRef.current) {
        render(state.currentValence, state.time, state.particles);
      }

      rafRef.current = requestAnimationFrame(loop);
    };

    rafRef.current = requestAnimationFrame(loop);

    return () => {
      cancelAnimationFrame(rafRef.current);
      canvas.removeEventListener('webglcontextlost', handleContextLost);
      canvas.removeEventListener('webglcontextrestored', handleContextRestored);
      glRendererRef.current?.dispose();
      glRendererRef.current = null;
    };
  }, [size]);

  // Update static frame when valence changes and animations are off
  useEffect(() => {
    if (shouldAnimate()) return;

    const canvas = canvasRef.current;
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
      const ctx = canvas.getContext('2d', { willReadFrequently: false });
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

  // Context failure fallback
  if (ctxFailed) {
    return (
      <div
        className="flex-shrink-0 rounded-full bg-primary/10 motion-safe:animate-pulse"
        style={{ width: size, height: size }}
        aria-hidden="true"
      />
    );
  }

  return (
    <div
      ref={wrapperRef}
      className="relative flex items-center justify-center"
      style={{ width: size, height: size }}
      aria-hidden="true"
    >
      <canvas
        ref={canvasRef}
        style={{ width: size, height: size }}
      />
    </div>
  );
});

/**
 * ValenceOrb — Premium Canvas 2D orb for State of Mind valence step.
 *
 * Multi-layered living orb that responds to valence (-1 to +1):
 *   - Outer Aura: diffuse glow with drifting light spill
 *   - Middle Blob: organic shape via 2D noise displacement
 *   - Inner Core: bright center with breathing pulse
 *   - Particles: floating glow dots orbiting the shape
 *
 * Drop-in replacement for MorphingBlob (same props interface).
 *
 * Law 12 (Performance): 30fps RAF, IntersectionObserver pause, DPR cap at 2x.
 * Law 18 (Cleanup): mounted guard, RAF cancel, observer disconnect.
 * Dopamine gate: shouldAnimate() → static frame if disabled.
 * Pattern source: GrowthRingsCanvas.tsx
 */

import { useRef, useEffect, useState } from 'react';
import { shouldAnimate } from '@/lib/animationUtils';
import { createParticlePool, updateParticles } from './particleSystem';
import { drawOrbScene } from './orbRenderer';
import type { Particle } from './particleSystem';

interface ValenceOrbProps {
  /** Current valence value (-1.0 to 1.0) */
  valence: number;
  /** Size in px (width = height) */
  size?: number;
}

const FRAME_INTERVAL = 1000 / 30; // 30fps
const PARTICLE_COUNT = 22;

export function ValenceOrb({ valence, size = 192 }: ValenceOrbProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const wrapperRef = useRef<HTMLDivElement>(null);
  const rafRef = useRef(0);
  const mountedRef = useRef(true);
  const isVisibleRef = useRef(true);
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

    const ctx = canvas.getContext('2d', { willReadFrequently: false });
    if (!ctx) {
      setCtxFailed(true);
      return;
    }

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

    const animate = shouldAnimate();

    if (!animate) {
      // Static fallback: single frame, no RAF
      drawOrbScene(ctx, {
        valence: valenceRef.current,
        time: 0,
        particles: stateRef.current.particles,
        size,
        dpr,
        isDark: isDarkRead(),
      });
      return;
    }

    const loop = (timestamp: number) => {
      if (!mountedRef.current) return;

      const state = stateRef.current;
      if (!state) return;

      // Runtime dopamine gate
      if (!shouldAnimate()) {
        drawOrbScene(ctx, {
          valence: state.currentValence,
          time: state.time,
          particles: state.particles,
          size,
          dpr,
          isDark: isDarkRead(),
        });
        return; // Stop RAF
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
        drawOrbScene(ctx, {
          valence: state.currentValence,
          time: state.time,
          particles: state.particles,
          size,
          dpr,
          isDark: isDarkRead(),
        });
      }

      rafRef.current = requestAnimationFrame(loop);
    };

    rafRef.current = requestAnimationFrame(loop);

    return () => {
      cancelAnimationFrame(rafRef.current);
    };
  }, [size]);

  // Update static frame when valence changes and animations are off
  useEffect(() => {
    if (shouldAnimate()) return;

    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d', { willReadFrequently: false });
    if (!ctx) return;

    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const state = stateRef.current;
    if (!state) return;

    state.currentValence = valence;
    drawOrbScene(ctx, {
      valence,
      time: 0,
      particles: state.particles,
      size,
      dpr,
      isDark: document.documentElement.classList.contains('dark'),
    });
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
}

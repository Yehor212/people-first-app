/**
 * GrowthRingsCanvas — Premium canvas tree ring visualization
 *
 * Renders concentric organic rings like a real tree cross-section.
 * Each visual band = one or more days of user history:
 *   - active (emerald) = user completed activities
 *   - rest (indigo) = intentional rest day
 *   - gap (gray) = missed day (thin, low opacity — never erased)
 *
 * Drawing functions extracted to drawGrowthRings.ts.
 */

import { useRef, useEffect, useState, useMemo, memo } from 'react';
import { shouldAnimate } from '@/lib/animationUtils';
import { useLanguage } from '@/contexts/LanguageContext';
import type { GrowthRing } from '@/lib/growthRings';
import {
  MIN_RING_WIDTH,
  MOUNT_DURATION,
  AMBIENT_FRAME,
  groupRings,
  drawScene,
} from './drawGrowthRings';

interface GrowthRingsCanvasProps {
  rings: GrowthRing[];
  size?: number;
}

export const GrowthRingsCanvas = memo(function GrowthRingsCanvas({
  rings,
  size = 80,
}: GrowthRingsCanvasProps) {
  const { t } = useLanguage();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const wrapperRef = useRef<HTMLDivElement>(null);
  const rafRef = useRef<number>(0);
  const mountedRef = useRef(true);
  const isVisibleRef = useRef(true);
  // State-based fallback for getContext failure
  const [ctxFailed, setCtxFailed] = useState(false);

  // A11y: compute growth summary for screen readers (Law 17: i18n)
  const ariaLabel = useMemo(() => {
    if (rings.length === 0) return t.growthRingsEmpty;
    const active = rings.filter(r => r.type === 'active').length;
    const rest = rings.filter(r => r.type === 'rest').length;
    return (t.growthRingsLabel || 'Growth rings: {total} days, {active} active, {rest} rest')
      .replace('{total}', String(rings.length))
      .replace('{active}', String(active))
      .replace('{rest}', String(rest));
  }, [rings, t]);

  // IntersectionObserver: pause RAF when off-screen (Rule 4)
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

  useEffect(() => {
    mountedRef.current = true;
    const canvas = canvasRef.current;
    if (!canvas) return;

    const dpr = window.devicePixelRatio || 1;
    canvas.width = size * dpr;
    canvas.height = size * dpr;
    canvas.style.width = `${size}px`;
    canvas.style.height = `${size}px`;

    const ctx = canvas.getContext('2d', { willReadFrequently: false });
    if (!ctx) {
      setCtxFailed(true);
      return;
    }

    // Round line caps/joins for smooth organic stroke endpoints
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';

    // Adaptive grouping: calculate max visible bands
    const minRadius = 6 * dpr;
    const maxRadius = (size / 2 - 2) * dpr;
    const availableSpace = (maxRadius - minRadius) / dpr; // in CSS px
    const maxBands = Math.max(1, Math.floor(availableSpace / MIN_RING_WIDTH));
    const bands = groupRings(rings, maxBands);

    const animate = shouldAnimate();

    if (!animate || bands.length === 0) {
      // Static render — no animation, full glow
      drawScene(ctx, bands, size, dpr, 1, 0.35);
      return;
    }

    // Phase 1: Mount reveal (400ms ease-out cubic)
    const mountStart = performance.now();
    let mountDone = false;
    let lastDrawTime = 0;

    // Single clean RAF loop for both phases
    const loop = (now: number) => {
      if (!mountedRef.current) return;

      // Runtime dopamine gate: stop if user enables reduce-motion mid-session
      if (!shouldAnimate()) {
        drawScene(ctx, bands, size, dpr, 1, 0.35);
        return; // Stop RAF — static frame rendered
      }

      if (!mountDone) {
        // Phase 1: reveal animation (runs at full refresh rate)
        const elapsed = now - mountStart;
        const t = Math.min(1, elapsed / MOUNT_DURATION);
        const progress = 1 - Math.pow(1 - t, 3); // ease-out cubic
        const glowAlpha = 0.35 * progress;

        drawScene(ctx, bands, size, dpr, progress, glowAlpha);

        if (t >= 1) {
          mountDone = true;
          lastDrawTime = now;
        }
        rafRef.current = requestAnimationFrame(loop);
        return;
      }

      // Phase 2: ambient breathing (throttled to 15fps)
      // Skip draw when off-screen (IntersectionObserver)
      if (isVisibleRef.current && now - lastDrawTime >= AMBIENT_FRAME) {
        lastDrawTime = now;
        const time = now / 1000;
        const breathAlpha = 0.30 + Math.sin(time * 1.6) * 0.12;
        drawScene(ctx, bands, size, dpr, 1, breathAlpha);
      }

      rafRef.current = requestAnimationFrame(loop);
    };

    rafRef.current = requestAnimationFrame(loop);

    return () => {
      mountedRef.current = false;
      if (rafRef.current) {
        cancelAnimationFrame(rafRef.current);
      }
    };
  }, [rings, size]);

  // Render fallback div if canvas context unavailable
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
      role="img"
      aria-label={ariaLabel}
      className="flex-shrink-0"
      style={{ width: size, height: size }}
    >
      <canvas
        ref={canvasRef}
        className="flex-shrink-0"
        style={{ width: size, height: size }}
        aria-hidden="true"
      />
    </div>
  );
});

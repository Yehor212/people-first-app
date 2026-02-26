/**
 * useDiaryCanvas — rAF-driven Full-Background Ambient Engine.
 *
 * Cinematic atmospheric background across the ENTIRE viewport:
 * radial vignette → Z-depth parallax particles → scroll kinetic → touch repulsion.
 *
 * Z-DEPTH PARALLAX:
 *   Each particle has z (0.1 far → 1.0 near).
 *   Size, opacity, speed all scale by z — creates true depth perception.
 *   Near particles are large, bright, fast. Far ones are tiny, dim, slow.
 *
 * SCROLL KINETIC RESPONSE:
 *   When user scrolls diary content, particles shift with parallax depth.
 *   Near particles rush past, far particles barely move.
 *
 * TOUCH REPULSION:
 *   Touch/mouse pushes particles away within 100px radius.
 *   Force scales by z — near particles react more.
 *
 * THEME-SPECIFIC PARTICLES:
 *   dark/cosmos  — twinkling stars (10% cyan/purple tint), nebula overlay
 *   ocean        — bubbles (y-based sine-wave drift, size pulse)
 *   forest       — fireflies (Brownian motion, sharp flicker)
 *   sunset       — embers (diagonal drift, orange-red fade)
 *   light/sepia  — generic soft floaters
 *
 * PERFORMANCE:
 *   Typing-pause gate (2s resume). Scroll un-pauses canvas.
 *   Particle counts: 30-70. Z-math is trivial per frame.
 */

import { useEffect, useRef } from 'react';
import { shouldAnimate } from '@/lib/animationUtils';
import { isCanvasPaused } from '@/lib/canvasPause';
import type { DiaryThemeName, BackgroundIntensity } from './types';

// ── Theme maps ──

const THEME_GRADIENTS: Record<DiaryThemeName, { center: string; edge: string }> = {
  dark:   { center: '#0F172A', edge: '#020617' },
  ocean:  { center: '#082F49', edge: '#0F172A' },
  forest: { center: '#064E3B', edge: '#020617' },
  sunset: { center: '#4C1D95', edge: '#7C2D12' },
  light:  { center: '#FFFEF5', edge: '#F0EBD8' },
  sepia:  { center: '#F4ECD8', edge: '#E0D5B8' },
};

// ── Particle type (with z-depth) ──

interface Particle {
  x: number;
  y: number;
  z: number;          // 0.1 (far) → 1.0 (near) — parallax depth
  baseSize: number;   // size before z-scaling
  baseAlpha: number;  // opacity before z-scaling
  startX: number;     // original X (for sunset diagonal drift)
  size: number;
  speedX: number;
  speedY: number;
  opacity: number;
  phase: number;
  tint: number;       // 0 = accent, 1 = cyan, 2 = purple (space theme)
}

// ── Theme particle configs ──

interface ParticleConfig {
  count: number;
  init: (w: number, h: number) => Particle;
  move: (p: Particle, t: number, w: number, h: number) => void;
  color: (p: Particle, t: number, accent: string) => string;
}

function getParticleConfig(theme: DiaryThemeName, intensity: BackgroundIntensity): ParticleConfig {
  const dimFactor = intensity === 'dim' ? 0.5 : 1;

  switch (theme) {
    case 'dark': {
      // Cosmos — twinkling stars with z-depth parallax, 10% colored tints
      return {
        count: Math.round(70 * dimFactor),
        init: (w, h) => {
          const z = 0.1 + Math.random() * 0.9;
          const baseAlpha = (0.05 + Math.random() * 0.25) * dimFactor;
          // 10% cyan, 10% purple, 80% accent
          const tintRoll = Math.random();
          const tint = tintRoll < 0.1 ? 1 : tintRoll < 0.2 ? 2 : 0;
          return {
            x: Math.random() * w,
            y: Math.random() * h,
            z,
            baseSize: 1 + Math.random() * 2.5,
            baseAlpha,
            startX: 0,
            size: (1 + Math.random() * 2.5) * z,
            speedX: (Math.random() - 0.5) * 0.08 * z,
            speedY: (-0.03 - Math.random() * 0.06) * z,
            opacity: baseAlpha * z,
            phase: Math.random() * Math.PI * 2,
            tint,
          };
        },
        move: (p, t, w, h) => {
          p.x += p.speedX;
          p.y += p.speedY;
          p.opacity = (0.03 + Math.abs(Math.sin(t * 0.001 + p.phase)) * 0.3) * dimFactor * p.z;
          p.size = p.baseSize * p.z;
          if (p.x < -5) p.x = w + 5;
          if (p.x > w + 5) p.x = -5;
          if (p.y < -5) p.y = h + 5;
          if (p.y > h + 5) p.y = -5;
        },
        color: (p, _t, accent) => {
          if (p.tint === 1) return hexToRgba('#A5F3FC', p.opacity); // cyan
          if (p.tint === 2) return hexToRgba('#D8B4FE', p.opacity); // purple
          return hexToRgba(accent, p.opacity);
        },
      };
    }

    case 'ocean': {
      // Bubbles — y-based sine-wave drift, float upward, size pulse, z-depth
      return {
        count: Math.round(50 * dimFactor),
        init: (w, h) => {
          const z = 0.1 + Math.random() * 0.9;
          const baseAlpha = (0.04 + Math.random() * 0.1) * dimFactor;
          return {
            x: Math.random() * w,
            y: Math.random() * h,
            z,
            baseSize: 2 + Math.random() * 4,
            baseAlpha,
            startX: 0,
            size: (2 + Math.random() * 4) * z,
            speedX: 0,
            speedY: (-0.12 - Math.random() * 0.2) * z,
            opacity: baseAlpha * z,
            phase: Math.random() * Math.PI * 2,
            tint: 0,
          };
        },
        move: (p, t, w, h) => {
          // Sine-wave based on Y position (spec: y * 0.05 + time), scaled by z
          p.x += Math.sin(p.y * 0.05 + t * 0.001 + p.phase) * 3 * p.z * 0.016;
          p.y += p.speedY;
          p.size = p.baseSize * p.z * (1 + Math.sin(t * 0.002 + p.phase) * 0.12);
          if (p.y < -10) { p.y = h + 10; p.x = Math.random() * w; }
          if (p.x < -10) p.x = w + 10;
          if (p.x > w + 10) p.x = -10;
        },
        color: (p, _t, accent) => hexToRgba(accent, p.opacity),
      };
    }

    case 'forest': {
      // Fireflies — Brownian motion, sharp flicker, warm glow, z-depth
      return {
        count: Math.round(45 * dimFactor),
        init: (w, h) => {
          const z = 0.1 + Math.random() * 0.9;
          const baseAlpha = (0.06 + Math.random() * 0.12) * dimFactor;
          return {
            x: Math.random() * w,
            y: Math.random() * h,
            z,
            baseSize: 2 + Math.random() * 3,
            baseAlpha,
            startX: 0,
            size: (2 + Math.random() * 3) * z,
            speedX: (Math.random() - 0.5) * 0.25 * z,
            speedY: (Math.random() - 0.5) * 0.25 * z,
            opacity: baseAlpha * z,
            phase: Math.random() * Math.PI * 2,
            tint: 0,
          };
        },
        move: (p, t, w, h) => {
          // Brownian motion scaled by z
          p.speedX += (Math.random() - 0.5) * 0.06 * p.z;
          p.speedY += (Math.random() - 0.5) * 0.06 * p.z;
          p.speedX *= 0.97;
          p.speedY *= 0.97;
          p.x += p.speedX;
          p.y += p.speedY;
          p.size = p.baseSize * p.z;
          // Sharp flicker: pow(sin) for harder on/off transitions (3x faster than before)
          const flicker = Math.pow(Math.abs(Math.sin(t * 0.005 + p.phase)), 3);
          p.opacity = (0.04 + flicker * 0.2) * dimFactor * p.z;
          if (p.x < -10) p.x = w + 10;
          if (p.x > w + 10) p.x = -10;
          if (p.y < -10) p.y = h + 10;
          if (p.y > h + 10) p.y = -10;
        },
        color: (p, t) => {
          const hue = 80 + Math.sin(t * 0.001 + p.phase) * 30;
          return `hsla(${hue}, 80%, 60%, ${p.opacity})`;
        },
      };
    }

    case 'sunset': {
      // Embers — diagonal drift left-to-right, rise slowly, orange-red, z-depth
      return {
        count: Math.round(55 * dimFactor),
        init: (w, h) => {
          const z = 0.1 + Math.random() * 0.9;
          const baseAlpha = (0.08 + Math.random() * 0.18) * dimFactor;
          const startX = Math.random() * w;
          return {
            x: startX,
            y: h * 0.4 + Math.random() * h * 0.6,
            z,
            baseSize: 2 + Math.random() * 3.5,
            baseAlpha,
            startX,
            size: (2 + Math.random() * 3.5) * z,
            speedX: 0,
            speedY: (-0.15 - Math.random() * 0.3) * z,
            opacity: baseAlpha * z,
            phase: Math.random() * Math.PI * 2,
            tint: 0,
          };
        },
        move: (p, t, w, h) => {
          // Diagonal drift: x based on time * z (near particles drift faster)
          p.x = ((p.startX + t * 0.03 * p.z) % (w + 20)) - 10;
          p.y += p.speedY * 0.5;
          p.size = p.baseSize * p.z;
          const heightRatio = Math.max(0, p.y / h);
          p.opacity = Math.max(0.02, heightRatio * 0.22) * dimFactor * p.z;
          if (p.y < -10) {
            p.y = h + 10;
            p.startX = Math.random() * w;
            p.opacity = 0.18 * dimFactor * p.z;
          }
        },
        color: (p, t) => {
          const hue = 15 + Math.sin(t * 0.001 + p.phase) * 15;
          return `hsla(${hue}, 90%, 55%, ${p.opacity})`;
        },
      };
    }

    default: {
      // Light/sepia — subtle generic floaters with z-depth
      return {
        count: Math.round(30 * dimFactor),
        init: (w, h) => {
          const z = 0.1 + Math.random() * 0.9;
          const baseAlpha = (0.04 + Math.random() * 0.06) * dimFactor;
          return {
            x: Math.random() * w,
            y: Math.random() * h,
            z,
            baseSize: 2 + Math.random() * 2.5,
            baseAlpha,
            startX: 0,
            size: (2 + Math.random() * 2.5) * z,
            speedX: (Math.random() - 0.5) * 0.15 * z,
            speedY: (-0.08 - Math.random() * 0.1) * z,
            opacity: baseAlpha * z,
            phase: Math.random() * Math.PI * 2,
            tint: 0,
          };
        },
        move: (p, t, w, h) => {
          p.x += p.speedX + Math.sin(t * 0.001 + p.phase) * 0.08 * p.z;
          p.y += p.speedY;
          p.size = p.baseSize * p.z;
          if (p.y < -10) { p.y = h + 10; p.x = Math.random() * w; }
          if (p.x < -10) p.x = w + 10;
          if (p.x > w + 10) p.x = -10;
        },
        color: (p, _t, accent) => hexToRgba(accent, p.opacity),
      };
    }
  }
}

// ── Pure helpers ──

function hexToRgba(hex: string, alpha: number): string {
  const match = hex.match(/^#([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i);
  if (!match) return `rgba(150, 150, 150, ${alpha})`;
  return `rgba(${parseInt(match[1], 16)}, ${parseInt(match[2], 16)}, ${parseInt(match[3], 16)}, ${alpha})`;
}

// ── Full-background radial vignette + optional nebula overlay ──

function drawBackground(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  theme: DiaryThemeName,
): void {
  const { center, edge } = THEME_GRADIENTS[theme];
  const grad = ctx.createRadialGradient(w / 2, h / 2, 0, w / 2, h / 2, Math.max(w, h) * 0.7);
  grad.addColorStop(0, center);
  grad.addColorStop(1, edge);
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, w, h);

  // Space theme: subtle purple nebula glow in center
  if (theme === 'dark') {
    const nebula = ctx.createRadialGradient(w / 2, h / 2, 0, w / 2, h / 2, Math.max(w, h) * 0.4);
    nebula.addColorStop(0, 'rgba(139, 92, 246, 0.05)');
    nebula.addColorStop(1, 'rgba(139, 92, 246, 0)');
    ctx.fillStyle = nebula;
    ctx.fillRect(0, 0, w, h);
  }
}

// ── Particles (full viewport, z-depth rendering) ──

function drawParticles(
  ctx: CanvasRenderingContext2D,
  particles: Particle[],
  config: ParticleConfig,
  time: number,
  w: number,
  h: number,
  accentColor: string,
  scrollDelta: number,
  touchPos: { x: number; y: number } | null,
): void {
  for (const p of particles) {
    // Apply scroll parallax (before theme move)
    if (scrollDelta !== 0) {
      p.y += scrollDelta * p.z * 0.15;
    }

    // Theme-specific movement
    config.move(p, time, w, h);

    // Touch/mouse repulsion
    if (touchPos) {
      const dx = p.x - touchPos.x;
      const dy = p.y - touchPos.y;
      const dist = Math.sqrt(dx * dx + dy * dy);
      if (dist < 100 && dist > 0) {
        const force = (1 - dist / 100) * 2 * p.z;
        p.x += (dx / dist) * force;
        p.y += (dy / dist) * force;
      }
    }

    // Render with z-depth alpha
    ctx.beginPath();
    ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
    ctx.fillStyle = config.color(p, time, accentColor);
    ctx.fill();
  }
}

// ── Hook ──

export function useDiaryCanvas(
  canvasRef: React.RefObject<HTMLCanvasElement | null>,
  accentColor: string,
  isActive: boolean,
  theme: DiaryThemeName = 'dark',
  intensity: BackgroundIntensity = 'full',
  scrollContainerRef?: React.RefObject<HTMLElement | null>,
): void {
  const particlesRef = useRef<Particle[]>([]);
  const rafRef = useRef(0);
  const typingPausedRef = useRef(false);
  const typingTimerRef = useRef<ReturnType<typeof setTimeout>>();
  const scrollDeltaRef = useRef(0);
  const touchPosRef = useRef<{ x: number; y: number } | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !isActive || !shouldAnimate()) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Size canvas to full viewport ONCE — never resize for keyboard
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const w = window.innerWidth;
    const h = window.innerHeight;
    canvas.width = w * dpr;
    canvas.height = h * dpr;
    canvas.style.width = `${w}px`;
    canvas.style.height = `${h}px`;
    ctx.scale(dpr, dpr);

    // "off" mode: draw static background once, no rAF loop
    if (intensity === 'off') {
      drawBackground(ctx, w, h, theme);
      return;
    }

    // Theme-specific particle config — full viewport
    const config = getParticleConfig(theme, intensity);
    particlesRef.current = Array.from({ length: config.count }, () => config.init(w, h));

    let alive = true;

    // ── Typing-pause performance gate ──
    const RESUME_DELAY = 2000;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.ctrlKey || e.metaKey || e.altKey) return;
      if (e.key.length === 1 || e.key === 'Backspace' || e.key === 'Delete' || e.key === 'Enter') {
        typingPausedRef.current = true;
        if (typingTimerRef.current) clearTimeout(typingTimerRef.current);
        typingTimerRef.current = setTimeout(() => { typingPausedRef.current = false; }, RESUME_DELAY);
      }
    };

    document.addEventListener('keydown', handleKeyDown, { passive: true });

    // ── Scroll kinetic response ──
    const scrollEl = scrollContainerRef?.current;
    let lastScrollTop = scrollEl?.scrollTop ?? 0;

    const handleScroll = () => {
      const top = scrollEl?.scrollTop ?? 0;
      scrollDeltaRef.current += top - lastScrollTop;
      lastScrollTop = top;
      // Un-pause canvas on scroll (user wants visual feedback)
      typingPausedRef.current = false;
      if (typingTimerRef.current) clearTimeout(typingTimerRef.current);
    };

    scrollEl?.addEventListener('scroll', handleScroll, { passive: true });

    // ── Touch/mouse repulsion ──
    const handleTouchMove = (e: TouchEvent) => {
      const touch = e.touches[0];
      if (touch) touchPosRef.current = { x: touch.clientX, y: touch.clientY };
    };
    const handleMouseMove = (e: MouseEvent) => {
      touchPosRef.current = { x: e.clientX, y: e.clientY };
    };
    const handleTouchEnd = () => { touchPosRef.current = null; };
    const handleMouseLeave = () => { touchPosRef.current = null; };

    document.addEventListener('touchmove', handleTouchMove, { passive: true });
    document.addEventListener('touchend', handleTouchEnd);
    document.addEventListener('mousemove', handleMouseMove, { passive: true });
    document.addEventListener('mouseleave', handleMouseLeave);

    function frame(time: number) {
      if (!alive || !ctx) return;
      if (!isCanvasPaused() && !typingPausedRef.current) {
        // 1. Full-background radial vignette (+ nebula for space)
        drawBackground(ctx, w, h, theme);

        // 2. Particles with z-depth parallax, scroll kinetic, touch repulsion
        const scrollDelta = scrollDeltaRef.current;
        drawParticles(ctx, particlesRef.current, config, time, w, h, accentColor, scrollDelta, touchPosRef.current);

        // Decay scroll delta (smooth momentum)
        scrollDeltaRef.current *= 0.85;
        if (Math.abs(scrollDeltaRef.current) < 0.1) scrollDeltaRef.current = 0;
      }
      rafRef.current = requestAnimationFrame(frame);
    }

    rafRef.current = requestAnimationFrame(frame);

    return () => {
      alive = false;
      cancelAnimationFrame(rafRef.current);
      document.removeEventListener('keydown', handleKeyDown);
      scrollEl?.removeEventListener('scroll', handleScroll);
      document.removeEventListener('touchmove', handleTouchMove);
      document.removeEventListener('touchend', handleTouchEnd);
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseleave', handleMouseLeave);
      if (typingTimerRef.current) clearTimeout(typingTimerRef.current);
    };
  }, [canvasRef, accentColor, isActive, theme, intensity, scrollContainerRef]);
}

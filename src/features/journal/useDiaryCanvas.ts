/**
 * useDiaryCanvas — rAF-driven wavy borders + theme-specific particle system.
 *
 * Memory-safe: all rAF + event listeners cleaned up in useEffect return.
 * Canvas is fixed at initial viewport size — NEVER resizes for keyboard.
 * shouldAnimate() guard — static fallback when reduced motion enabled.
 *
 * PERFORMANCE GATE: Pauses rAF loop when user is typing (keydown on textarea).
 * Resumes 2 seconds after the last keystroke. This saves GPU while the user writes.
 *
 * THEME-SPECIFIC PARTICLES:
 *   dark/cosmos  — twinkling stars (opacity oscillation)
 *   ocean        — bubbles (sine-wave drift upward, size pulse)
 *   forest       — fireflies (Brownian motion, warm hue)
 *   sunset       — embers (rise + sway, orange-red fade)
 *   light/sepia  — generic soft floaters
 *
 * DEPTH LAYERS (back to front):
 *   Layer 0 — Dot grid (32px spacing, 3% opacity, subtle scroll parallax)
 *   Layer 1 — Parallax dust (60 static stars, per-star depth factor)
 *   Layer 2 — Wavy borders
 *   Layer 3 — Theme-specific particles
 */

import { useEffect, useRef } from 'react';
import { shouldAnimate } from '@/lib/animationUtils';
import { isCanvasPaused } from '@/lib/canvasPause';
import type { DiaryThemeName } from './types';

// ── Particle type ──

interface Particle {
  x: number;
  y: number;
  size: number;
  speedX: number;
  speedY: number;
  opacity: number;
  phase: number;
}

// ── Dust star (static parallax layer) ──

interface DustStar {
  x: number;
  y: number;
  size: number;
  opacity: number;
  parallaxFactor: number;
}

// ── Theme particle configs ──

interface ParticleConfig {
  count: number;
  init: (w: number, h: number) => Particle;
  move: (p: Particle, t: number, w: number, h: number) => void;
  color: (p: Particle, t: number, accent: string) => string;
}

function getParticleConfig(theme: DiaryThemeName): ParticleConfig {
  switch (theme) {
    case 'dark':
      // Cosmos — twinkling stars with opacity oscillation
      return {
        count: 50,
        init: (w, h) => ({
          x: Math.random() * w,
          y: Math.random() * h,
          size: 1 + Math.random() * 3,
          speedX: (Math.random() - 0.5) * 0.1,
          speedY: (Math.random() - 0.5) * 0.1,
          opacity: 0.1 + Math.random() * 0.3,
          phase: Math.random() * Math.PI * 2,
        }),
        move: (p, t, w, h) => {
          p.x += p.speedX;
          p.y += p.speedY;
          // Twinkle: oscillate opacity
          p.opacity = 0.05 + Math.abs(Math.sin(t * 0.001 + p.phase)) * 0.35;
          if (p.x < -5) p.x = w + 5;
          if (p.x > w + 5) p.x = -5;
          if (p.y < -5) p.y = h + 5;
          if (p.y > h + 5) p.y = -5;
        },
        color: (p, _t, accent) => hexToRgba(accent, p.opacity),
      };

    case 'ocean':
      // Bubbles — sine-wave horizontal drift, float upward, size pulse
      return {
        count: 35,
        init: (w, h) => ({
          x: Math.random() * w,
          y: Math.random() * h,
          size: 2 + Math.random() * 5,
          speedX: 0,
          speedY: -0.15 - Math.random() * 0.25,
          opacity: 0.06 + Math.random() * 0.12,
          phase: Math.random() * Math.PI * 2,
        }),
        move: (p, t, w, h) => {
          p.x += Math.sin(t * 0.0008 + p.phase) * 0.4;
          p.y += p.speedY;
          // Size pulse
          p.size = (2 + Math.random() * 3) * (1 + Math.sin(t * 0.002 + p.phase) * 0.15);
          if (p.y < -10) { p.y = h + 10; p.x = Math.random() * w; }
          if (p.x < -10) p.x = w + 10;
          if (p.x > w + 10) p.x = -10;
        },
        color: (p, _t, accent) => hexToRgba(accent, p.opacity),
      };

    case 'forest':
      // Fireflies — Brownian motion, warm glow
      return {
        count: 30,
        init: (w, h) => ({
          x: Math.random() * w,
          y: Math.random() * h,
          size: 2 + Math.random() * 3,
          speedX: (Math.random() - 0.5) * 0.3,
          speedY: (Math.random() - 0.5) * 0.3,
          opacity: 0.08 + Math.random() * 0.15,
          phase: Math.random() * Math.PI * 2,
        }),
        move: (p, t, w, h) => {
          // Brownian: random velocity change each frame
          p.speedX += (Math.random() - 0.5) * 0.08;
          p.speedY += (Math.random() - 0.5) * 0.08;
          // Dampen to prevent runaway
          p.speedX *= 0.97;
          p.speedY *= 0.97;
          p.x += p.speedX;
          p.y += p.speedY;
          // Glow pulse
          p.opacity = 0.05 + Math.abs(Math.sin(t * 0.0015 + p.phase)) * 0.2;
          if (p.x < -10) p.x = w + 10;
          if (p.x > w + 10) p.x = -10;
          if (p.y < -10) p.y = h + 10;
          if (p.y > h + 10) p.y = -10;
        },
        color: (p, t) => {
          // Warm yellow-green hue for fireflies
          const hue = 80 + Math.sin(t * 0.001 + p.phase) * 30;
          return `hsla(${hue}, 80%, 60%, ${p.opacity})`;
        },
      };

    case 'sunset':
      // Embers — rise upward with horizontal sway, orange-red, fade at top
      return {
        count: 40,
        init: (w, h) => ({
          x: Math.random() * w,
          y: h * 0.5 + Math.random() * h * 0.5,
          size: 2 + Math.random() * 4,
          speedX: (Math.random() - 0.5) * 0.4,
          speedY: -0.2 - Math.random() * 0.4,
          opacity: 0.1 + Math.random() * 0.2,
          phase: Math.random() * Math.PI * 2,
        }),
        move: (p, t, w, h) => {
          p.x += p.speedX + Math.sin(t * 0.001 + p.phase) * 0.3;
          p.y += p.speedY;
          // Fade as particle rises
          const heightRatio = p.y / h;
          p.opacity = Math.max(0.02, heightRatio * 0.25);
          if (p.y < -10) { p.y = h + 10; p.x = Math.random() * w; p.opacity = 0.2; }
          if (p.x < -10) p.x = w + 10;
          if (p.x > w + 10) p.x = -10;
        },
        color: (p, t) => {
          // Orange to red gradient
          const hue = 15 + Math.sin(t * 0.001 + p.phase) * 15;
          return `hsla(${hue}, 90%, 55%, ${p.opacity})`;
        },
      };

    default:
      // Light/sepia — subtle generic floaters
      return {
        count: 25,
        init: (w, h) => ({
          x: Math.random() * w,
          y: Math.random() * h,
          size: 2 + Math.random() * 3,
          speedX: (Math.random() - 0.5) * 0.2,
          speedY: -0.1 - Math.random() * 0.15,
          opacity: 0.05 + Math.random() * 0.08,
          phase: Math.random() * Math.PI * 2,
        }),
        move: (p, t, w, h) => {
          p.x += p.speedX + Math.sin(t * 0.001 + p.phase) * 0.1;
          p.y += p.speedY;
          if (p.y < -10) { p.y = h + 10; p.x = Math.random() * w; }
          if (p.x < -10) p.x = w + 10;
          if (p.x > w + 10) p.x = -10;
        },
        color: (p, _t, accent) => hexToRgba(accent, p.opacity),
      };
  }
}

// ── Pure helpers ──

function hexToRgba(hex: string, alpha: number): string {
  const match = hex.match(/^#([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i);
  if (!match) return `rgba(150, 150, 150, ${alpha})`;
  return `rgba(${parseInt(match[1], 16)}, ${parseInt(match[2], 16)}, ${parseInt(match[3], 16)}, ${alpha})`;
}

// ── Depth Layer 0: Dot Grid ──

function drawGrid(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  scrollY: number,
  accentColor: string,
) {
  const spacing = 32;
  const dotSize = 1;
  const offsetY = (scrollY * 0.03) % spacing; // very subtle parallax
  ctx.fillStyle = hexToRgba(accentColor, 0.03);
  for (let x = spacing; x < w; x += spacing) {
    for (let y = -spacing + offsetY; y < h + spacing; y += spacing) {
      ctx.fillRect(x - dotSize / 2, y - dotSize / 2, dotSize, dotSize);
    }
  }
}

// ── Depth Layer 1: Parallax Dust ──

function drawParallaxDust(
  ctx: CanvasRenderingContext2D,
  stars: DustStar[],
  scrollY: number,
  h: number,
) {
  for (const s of stars) {
    const renderY = ((s.y + scrollY * s.parallaxFactor) % (h + 20)) - 10;
    ctx.fillStyle = `rgba(255, 255, 255, ${s.opacity})`;
    ctx.fillRect(s.x - s.size / 2, renderY - s.size / 2, s.size, s.size);
  }
}

function drawWavyBorder(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  time: number,
  color: string,
) {
  const t = time * 0.001;
  ctx.strokeStyle = hexToRgba(color, 0.06);
  ctx.lineWidth = 1.5;

  // Top wave
  ctx.beginPath();
  for (let x = 0; x <= w; x += 3) {
    const y = 16 + Math.sin(x * 0.012 + t) * 6 + Math.sin(x * 0.024 + t * 1.5) * 3;
    if (x === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
  }
  ctx.stroke();

  // Bottom wave
  ctx.beginPath();
  for (let x = 0; x <= w; x += 3) {
    const y = h - 16 + Math.sin(x * 0.012 + t + 2) * 6 + Math.sin(x * 0.024 + t * 1.3) * 3;
    if (x === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
  }
  ctx.stroke();

  // Left wave
  ctx.beginPath();
  for (let y = 0; y <= h; y += 3) {
    const x = 16 + Math.sin(y * 0.012 + t * 0.8) * 5 + Math.sin(y * 0.024 + t * 1.2) * 2.5;
    if (y === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
  }
  ctx.stroke();

  // Right wave
  ctx.beginPath();
  for (let y = 0; y <= h; y += 3) {
    const x = w - 16 + Math.sin(y * 0.012 + t * 0.9) * 5 + Math.sin(y * 0.024 + t * 1.1) * 2.5;
    if (y === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
  }
  ctx.stroke();
}

// ── Hook ──

export function useDiaryCanvas(
  canvasRef: React.RefObject<HTMLCanvasElement | null>,
  accentColor: string,
  isActive: boolean,
  theme: DiaryThemeName = 'dark',
  scrollYRef?: React.RefObject<number>,
): void {
  const particlesRef = useRef<Particle[]>([]);
  const dustRef = useRef<DustStar[]>([]);
  const rafRef = useRef(0);
  const typingPausedRef = useRef(false);
  const typingTimerRef = useRef<ReturnType<typeof setTimeout>>();

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !isActive || !shouldAnimate()) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Size canvas to full viewport ONCE — never resize for keyboard
    const dpr = window.devicePixelRatio || 1;
    const w = window.innerWidth;
    const h = window.innerHeight;
    canvas.width = w * dpr;
    canvas.height = h * dpr;
    canvas.style.width = `${w}px`;
    canvas.style.height = `${h}px`;
    ctx.scale(dpr, dpr);

    // Theme-specific particle config
    const config = getParticleConfig(theme);
    particlesRef.current = Array.from({ length: config.count }, () => config.init(w, h));

    // Parallax dust stars — static positions, depth varies per star
    dustRef.current = Array.from({ length: 60 }, () => ({
      x: Math.random() * w,
      y: Math.random() * h,
      size: 0.5 + Math.random() * 1.5,
      opacity: 0.02 + Math.random() * 0.06,
      parallaxFactor: 0.05 + Math.random() * 0.1,
    }));

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

    function frame(time: number) {
      if (!alive || !ctx) return;
      if (!isCanvasPaused() && !typingPausedRef.current) {
        const scrollY = scrollYRef?.current ?? 0;

        ctx.clearRect(0, 0, w, h);

        // Layer 0: Dot grid (subtle scroll parallax)
        drawGrid(ctx, w, h, scrollY, accentColor);

        // Layer 1: Parallax dust (per-star depth factor)
        drawParallaxDust(ctx, dustRef.current, scrollY, h);

        // Layer 2: Wavy borders
        drawWavyBorder(ctx, w, h, time, accentColor);

        // Layer 3: Theme-specific particles
        for (const p of particlesRef.current) {
          config.move(p, time, w, h);
          ctx.beginPath();
          ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
          ctx.fillStyle = config.color(p, time, accentColor);
          ctx.fill();
        }
      }
      rafRef.current = requestAnimationFrame(frame);
    }

    rafRef.current = requestAnimationFrame(frame);

    return () => {
      alive = false;
      cancelAnimationFrame(rafRef.current);
      document.removeEventListener('keydown', handleKeyDown);
      if (typingTimerRef.current) clearTimeout(typingTimerRef.current);
    };
  }, [canvasRef, accentColor, isActive, theme, scrollYRef]);
}

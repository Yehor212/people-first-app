/**
 * useDiaryCanvas — rAF-driven Full-Background Ambient Engine.
 *
 * Renders a living atmospheric background across the ENTIRE viewport:
 * radial vignette → scattered theme particles.
 * The paper sheet (editor) floats on top with its own opaque background.
 *
 * Memory-safe: all rAF + event listeners cleaned up in useEffect return.
 * Canvas is fixed at initial viewport size — NEVER resizes for keyboard.
 * shouldAnimate() guard — static fallback when reduced motion enabled.
 *
 * PERFORMANCE GATE: Pauses rAF loop when user is typing (keydown).
 * Resumes 2 seconds after the last keystroke. This saves GPU while the user writes.
 *
 * INTENSITY MODES:
 *   full — all particles at normal opacity
 *   dim  — halved particle count, 50% max opacity
 *   off  — solid background only (no rAF loop)
 *
 * THEME-SPECIFIC PARTICLES (scattered across full viewport):
 *   dark/cosmos  — twinkling stars (opacity oscillation)
 *   ocean        — bubbles (sine-wave drift upward, size pulse)
 *   forest       — fireflies (Brownian motion, warm hue)
 *   sunset       — embers (rise + sway, orange-red fade)
 *   light/sepia  — generic soft floaters
 *
 * PER FRAME:
 *   1. Clear → fill with radial vignette gradient
 *   2. Render theme particles across the full viewport
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
    case 'dark':
      // Cosmos — twinkling stars with opacity oscillation
      return {
        count: Math.round(70 * dimFactor),
        init: (w, h) => ({
          x: Math.random() * w,
          y: Math.random() * h,
          size: 1 + Math.random() * 2.5,
          speedX: (Math.random() - 0.5) * 0.08,
          speedY: -0.03 - Math.random() * 0.06,
          opacity: (0.05 + Math.random() * 0.25) * dimFactor,
          phase: Math.random() * Math.PI * 2,
        }),
        move: (p, t, w, h) => {
          p.x += p.speedX;
          p.y += p.speedY;
          p.opacity = (0.03 + Math.abs(Math.sin(t * 0.001 + p.phase)) * 0.3) * dimFactor;
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
        count: Math.round(50 * dimFactor),
        init: (w, h) => ({
          x: Math.random() * w,
          y: Math.random() * h,
          size: 2 + Math.random() * 4,
          speedX: 0,
          speedY: -0.12 - Math.random() * 0.2,
          opacity: (0.04 + Math.random() * 0.1) * dimFactor,
          phase: Math.random() * Math.PI * 2,
        }),
        move: (p, t, w, h) => {
          p.x += Math.sin(t * 0.0008 + p.phase) * 0.35;
          p.y += p.speedY;
          p.size = (2 + Math.random() * 2.5) * (1 + Math.sin(t * 0.002 + p.phase) * 0.12);
          if (p.y < -10) { p.y = h + 10; p.x = Math.random() * w; }
          if (p.x < -10) p.x = w + 10;
          if (p.x > w + 10) p.x = -10;
        },
        color: (p, _t, accent) => hexToRgba(accent, p.opacity),
      };

    case 'forest':
      // Fireflies — Brownian motion, warm glow
      return {
        count: Math.round(45 * dimFactor),
        init: (w, h) => ({
          x: Math.random() * w,
          y: Math.random() * h,
          size: 2 + Math.random() * 3,
          speedX: (Math.random() - 0.5) * 0.25,
          speedY: (Math.random() - 0.5) * 0.25,
          opacity: (0.06 + Math.random() * 0.12) * dimFactor,
          phase: Math.random() * Math.PI * 2,
        }),
        move: (p, t, w, h) => {
          p.speedX += (Math.random() - 0.5) * 0.06;
          p.speedY += (Math.random() - 0.5) * 0.06;
          p.speedX *= 0.97;
          p.speedY *= 0.97;
          p.x += p.speedX;
          p.y += p.speedY;
          p.opacity = (0.04 + Math.abs(Math.sin(t * 0.0015 + p.phase)) * 0.16) * dimFactor;
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

    case 'sunset':
      // Embers — rise upward with horizontal sway, orange-red, fade at top
      return {
        count: Math.round(55 * dimFactor),
        init: (w, h) => ({
          x: Math.random() * w,
          y: h * 0.4 + Math.random() * h * 0.6,
          size: 2 + Math.random() * 3.5,
          speedX: (Math.random() - 0.5) * 0.35,
          speedY: -0.15 - Math.random() * 0.3,
          opacity: (0.08 + Math.random() * 0.18) * dimFactor,
          phase: Math.random() * Math.PI * 2,
        }),
        move: (p, t, w, h) => {
          p.x += p.speedX + Math.sin(t * 0.001 + p.phase) * 0.25;
          p.y += p.speedY;
          const heightRatio = p.y / h;
          p.opacity = Math.max(0.02, heightRatio * 0.22) * dimFactor;
          if (p.y < -10) { p.y = h + 10; p.x = Math.random() * w; p.opacity = 0.18 * dimFactor; }
          if (p.x < -10) p.x = w + 10;
          if (p.x > w + 10) p.x = -10;
        },
        color: (p, t) => {
          const hue = 15 + Math.sin(t * 0.001 + p.phase) * 15;
          return `hsla(${hue}, 90%, 55%, ${p.opacity})`;
        },
      };

    default:
      // Light/sepia — subtle generic floaters
      return {
        count: Math.round(30 * dimFactor),
        init: (w, h) => ({
          x: Math.random() * w,
          y: Math.random() * h,
          size: 2 + Math.random() * 2.5,
          speedX: (Math.random() - 0.5) * 0.15,
          speedY: -0.08 - Math.random() * 0.1,
          opacity: (0.04 + Math.random() * 0.06) * dimFactor,
          phase: Math.random() * Math.PI * 2,
        }),
        move: (p, t, w, h) => {
          p.x += p.speedX + Math.sin(t * 0.001 + p.phase) * 0.08;
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

// ── Full-background radial vignette ──

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
}

// ── Particles (full viewport) ──

function drawParticles(
  ctx: CanvasRenderingContext2D,
  particles: Particle[],
  config: ParticleConfig,
  time: number,
  w: number,
  h: number,
  accentColor: string,
): void {
  for (const p of particles) {
    config.move(p, time, w, h);
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
): void {
  const particlesRef = useRef<Particle[]>([]);
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

    function frame(time: number) {
      if (!alive || !ctx) return;
      if (!isCanvasPaused() && !typingPausedRef.current) {
        // 1. Full-background radial vignette
        drawBackground(ctx, w, h, theme);

        // 2. Scattered particles across entire viewport
        drawParticles(ctx, particlesRef.current, config, time, w, h, accentColor);
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
  }, [canvasRef, accentColor, isActive, theme, intensity]);
}

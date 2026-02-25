/**
 * useDiaryCanvas — rAF-driven Wavy Frame Engine with theme-specific particles.
 *
 * Renders TWO frame zones (top ~120px, bottom ~140px) on a single full-screen canvas.
 * Each frame has: sinusoidal-clipped gradient fill → glowing wave line → constrained particles.
 * The middle of the canvas is transparent so --diary-bg shows through.
 *
 * Memory-safe: all rAF + event listeners cleaned up in useEffect return.
 * Canvas is fixed at initial viewport size — NEVER resizes for keyboard.
 * shouldAnimate() guard — static fallback when reduced motion enabled.
 *
 * PERFORMANCE GATE: Pauses rAF loop when user is typing (keydown on textarea).
 * Resumes 2 seconds after the last keystroke. This saves GPU while the user writes.
 *
 * THEME-SPECIFIC PARTICLES (constrained inside frame zones):
 *   dark/cosmos  — twinkling stars (opacity oscillation)
 *   ocean        — bubbles (sine-wave drift upward, size pulse)
 *   forest       — fireflies (Brownian motion, warm hue)
 *   sunset       — embers (rise + sway, orange-red fade)
 *   light/sepia  — generic soft floaters
 *
 * FRAME RENDERING (per frame zone):
 *   1. Clip to sinusoidal boundary → fill with theme gradient
 *   2. Stroke glowing sinusoidal wave line (shadowBlur: 15)
 *   3. Render theme particles inside the frame
 */

import { useEffect, useRef } from 'react';
import { shouldAnimate } from '@/lib/animationUtils';
import { isCanvasPaused } from '@/lib/canvasPause';
import type { DiaryThemeName } from './types';

// ── Constants ──

const TOP_FRAME_HEIGHT = 120;
const BOTTOM_FRAME_HEIGHT = 140;
const WAVE_AMPLITUDE = 10;
const WAVE_FREQUENCY = 0.008;
const WAVE_SPEED = 0.0005;
const WAVE_STEP = 2;
const GLOW_LINE_WIDTH = 2.5;
const GLOW_SHADOW_BLUR = 15;

// ── Theme maps ──

const THEME_GRADIENTS: Record<DiaryThemeName, { from: string; to: string }> = {
  dark:   { from: '#020617', to: '#0f172a' },
  ocean:  { from: '#082f49', to: '#0F1B2D' },
  forest: { from: '#064e3b', to: '#1B2D1B' },
  sunset: { from: '#2D1B1B', to: '#1a0f0f' },
  light:  { from: '#FFFEF5', to: '#F5F0E0' },
  sepia:  { from: '#F4ECD8', to: '#E8DCC0' },
};

const THEME_WAVE_COLORS: Record<DiaryThemeName, string> = {
  dark:   'rgba(139, 92, 246, 0.8)',
  ocean:  'rgba(6, 182, 212, 0.8)',
  forest: 'rgba(16, 185, 129, 0.8)',
  sunset: 'rgba(232, 131, 74, 0.8)',
  light:  'rgba(120, 120, 90, 0.35)',
  sepia:  'rgba(139, 105, 20, 0.45)',
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
  init: (w: number, yMin: number, yMax: number) => Particle;
  move: (p: Particle, t: number, w: number, yMin: number, yMax: number) => void;
  color: (p: Particle, t: number, accent: string) => string;
}

function getParticleConfig(theme: DiaryThemeName): ParticleConfig {
  switch (theme) {
    case 'dark':
      // Cosmos — twinkling stars with opacity oscillation
      return {
        count: 50,
        init: (w, yMin, yMax) => ({
          x: Math.random() * w,
          y: yMin + Math.random() * (yMax - yMin),
          size: 1 + Math.random() * 3,
          speedX: (Math.random() - 0.5) * 0.1,
          speedY: -0.05 - Math.random() * 0.1,
          opacity: 0.1 + Math.random() * 0.3,
          phase: Math.random() * Math.PI * 2,
        }),
        move: (p, t, w, yMin, yMax) => {
          p.x += p.speedX;
          p.y += p.speedY;
          p.opacity = 0.05 + Math.abs(Math.sin(t * 0.001 + p.phase)) * 0.35;
          if (p.x < -5) p.x = w + 5;
          if (p.x > w + 5) p.x = -5;
          if (p.y < yMin - 5) p.y = yMax + 5;
          if (p.y > yMax + 5) p.y = yMin - 5;
        },
        color: (p, _t, accent) => hexToRgba(accent, p.opacity),
      };

    case 'ocean':
      // Bubbles — sine-wave horizontal drift, float upward, size pulse
      return {
        count: 35,
        init: (w, yMin, yMax) => ({
          x: Math.random() * w,
          y: yMin + Math.random() * (yMax - yMin),
          size: 2 + Math.random() * 5,
          speedX: 0,
          speedY: -0.15 - Math.random() * 0.25,
          opacity: 0.06 + Math.random() * 0.12,
          phase: Math.random() * Math.PI * 2,
        }),
        move: (p, t, w, yMin, yMax) => {
          p.x += Math.sin(t * 0.0008 + p.phase) * 0.4;
          p.y += p.speedY;
          p.size = (2 + Math.random() * 3) * (1 + Math.sin(t * 0.002 + p.phase) * 0.15);
          if (p.y < yMin - 10) { p.y = yMax + 10; p.x = Math.random() * w; }
          if (p.x < -10) p.x = w + 10;
          if (p.x > w + 10) p.x = -10;
        },
        color: (p, _t, accent) => hexToRgba(accent, p.opacity),
      };

    case 'forest':
      // Fireflies — Brownian motion, warm glow
      return {
        count: 30,
        init: (w, yMin, yMax) => ({
          x: Math.random() * w,
          y: yMin + Math.random() * (yMax - yMin),
          size: 2 + Math.random() * 3,
          speedX: (Math.random() - 0.5) * 0.3,
          speedY: (Math.random() - 0.5) * 0.3,
          opacity: 0.08 + Math.random() * 0.15,
          phase: Math.random() * Math.PI * 2,
        }),
        move: (p, t, w, yMin, yMax) => {
          p.speedX += (Math.random() - 0.5) * 0.08;
          p.speedY += (Math.random() - 0.5) * 0.08;
          p.speedX *= 0.97;
          p.speedY *= 0.97;
          p.x += p.speedX;
          p.y += p.speedY;
          p.opacity = 0.05 + Math.abs(Math.sin(t * 0.0015 + p.phase)) * 0.2;
          if (p.x < -10) p.x = w + 10;
          if (p.x > w + 10) p.x = -10;
          if (p.y < yMin - 10) p.y = yMax + 10;
          if (p.y > yMax + 10) p.y = yMin - 10;
        },
        color: (p, t) => {
          const hue = 80 + Math.sin(t * 0.001 + p.phase) * 30;
          return `hsla(${hue}, 80%, 60%, ${p.opacity})`;
        },
      };

    case 'sunset':
      // Embers — rise upward with horizontal sway, orange-red, fade at top
      return {
        count: 40,
        init: (w, yMin, yMax) => ({
          x: Math.random() * w,
          y: yMin + (yMax - yMin) * 0.5 + Math.random() * (yMax - yMin) * 0.5,
          size: 2 + Math.random() * 4,
          speedX: (Math.random() - 0.5) * 0.4,
          speedY: -0.2 - Math.random() * 0.4,
          opacity: 0.1 + Math.random() * 0.2,
          phase: Math.random() * Math.PI * 2,
        }),
        move: (p, t, w, yMin, yMax) => {
          p.x += p.speedX + Math.sin(t * 0.001 + p.phase) * 0.3;
          p.y += p.speedY;
          const heightRatio = (p.y - yMin) / (yMax - yMin);
          p.opacity = Math.max(0.02, heightRatio * 0.25);
          if (p.y < yMin - 10) { p.y = yMax + 10; p.x = Math.random() * w; p.opacity = 0.2; }
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
        count: 25,
        init: (w, yMin, yMax) => ({
          x: Math.random() * w,
          y: yMin + Math.random() * (yMax - yMin),
          size: 2 + Math.random() * 3,
          speedX: (Math.random() - 0.5) * 0.2,
          speedY: -0.1 - Math.random() * 0.15,
          opacity: 0.05 + Math.random() * 0.08,
          phase: Math.random() * Math.PI * 2,
        }),
        move: (p, t, w, yMin, yMax) => {
          p.x += p.speedX + Math.sin(t * 0.001 + p.phase) * 0.1;
          p.y += p.speedY;
          if (p.y < yMin - 10) { p.y = yMax + 10; p.x = Math.random() * w; }
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

// ── Wave path builder ──

interface WavePath { xs: number[]; ys: number[] }

function buildWavePath(w: number, baseY: number, time: number): WavePath {
  const xs: number[] = [];
  const ys: number[] = [];
  for (let x = 0; x <= w; x += WAVE_STEP) {
    xs.push(x);
    ys.push(baseY + Math.sin(x * WAVE_FREQUENCY + time) * WAVE_AMPLITUDE);
  }
  return { xs, ys };
}

// ── Frame gradient fill (clipped to sinusoidal boundary) ──

function drawFrameGradient(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  frame: 'top' | 'bottom',
  wave: WavePath,
  theme: DiaryThemeName,
): void {
  const { from, to } = THEME_GRADIENTS[theme];
  const isTop = frame === 'top';

  ctx.save();
  ctx.beginPath();

  if (isTop) {
    // Rectangle top + sinusoidal bottom edge
    ctx.moveTo(0, 0);
    ctx.lineTo(w, 0);
    // Walk sinusoidal edge right-to-left
    for (let i = wave.xs.length - 1; i >= 0; i--) {
      ctx.lineTo(wave.xs[i], wave.ys[i]);
    }
  } else {
    // Sinusoidal top edge + rectangle bottom
    ctx.moveTo(wave.xs[0], wave.ys[0]);
    for (let i = 1; i < wave.xs.length; i++) {
      ctx.lineTo(wave.xs[i], wave.ys[i]);
    }
    ctx.lineTo(w, h);
    ctx.lineTo(0, h);
  }

  ctx.closePath();
  ctx.clip();

  // Gradient fill inside clip
  const grad = isTop
    ? ctx.createLinearGradient(0, 0, 0, TOP_FRAME_HEIGHT + WAVE_AMPLITUDE)
    : ctx.createLinearGradient(0, h - BOTTOM_FRAME_HEIGHT - WAVE_AMPLITUDE, 0, h);
  grad.addColorStop(0, from);
  grad.addColorStop(1, to);
  ctx.fillStyle = grad;

  if (isTop) {
    ctx.fillRect(0, 0, w, TOP_FRAME_HEIGHT + WAVE_AMPLITUDE + 1);
  } else {
    ctx.fillRect(0, h - BOTTOM_FRAME_HEIGHT - WAVE_AMPLITUDE - 1, w, BOTTOM_FRAME_HEIGHT + WAVE_AMPLITUDE + 2);
  }

  ctx.restore();
}

// ── Glowing wave line ──

function drawGlowLine(
  ctx: CanvasRenderingContext2D,
  wave: WavePath,
  theme: DiaryThemeName,
): void {
  const color = THEME_WAVE_COLORS[theme];

  ctx.save();
  ctx.strokeStyle = color;
  ctx.lineWidth = GLOW_LINE_WIDTH;
  ctx.shadowBlur = GLOW_SHADOW_BLUR;
  ctx.shadowColor = color;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';

  ctx.beginPath();
  ctx.moveTo(wave.xs[0], wave.ys[0]);
  for (let i = 1; i < wave.xs.length; i++) {
    ctx.lineTo(wave.xs[i], wave.ys[i]);
  }
  ctx.stroke();
  ctx.restore();
}

// ── Frame particles ──

function drawFrameParticles(
  ctx: CanvasRenderingContext2D,
  particles: Particle[],
  config: ParticleConfig,
  time: number,
  w: number,
  yMin: number,
  yMax: number,
  accentColor: string,
): void {
  for (const p of particles) {
    config.move(p, time, w, yMin, yMax);
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
): void {
  const topParticlesRef = useRef<Particle[]>([]);
  const bottomParticlesRef = useRef<Particle[]>([]);
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

    // Frame boundaries
    const topYMin = 0;
    const topYMax = TOP_FRAME_HEIGHT + WAVE_AMPLITUDE;
    const bottomYMin = h - BOTTOM_FRAME_HEIGHT - WAVE_AMPLITUDE;
    const bottomYMax = h;

    // Guard: if screen too small for both frames, skip
    if (topYMax + 50 > bottomYMin) return;

    // Theme-specific particle config — split between top and bottom frames
    const config = getParticleConfig(theme);
    const topCount = Math.floor(config.count / 2);
    const bottomCount = Math.ceil(config.count / 2);
    topParticlesRef.current = Array.from({ length: topCount }, () => config.init(w, topYMin, topYMax));
    bottomParticlesRef.current = Array.from({ length: bottomCount }, () => config.init(w, bottomYMin, bottomYMax));

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
        const t = time * WAVE_SPEED;

        ctx.clearRect(0, 0, w, h);

        // Pre-compute wave paths (reused for clip + glow)
        const topWave = buildWavePath(w, TOP_FRAME_HEIGHT, t);
        const bottomWave = buildWavePath(w, h - BOTTOM_FRAME_HEIGHT, t);

        // ── TOP FRAME ──
        drawFrameGradient(ctx, w, h, 'top', topWave, theme);
        drawGlowLine(ctx, topWave, theme);
        drawFrameParticles(ctx, topParticlesRef.current, config, time, w, topYMin, topYMax, accentColor);

        // ── BOTTOM FRAME ──
        drawFrameGradient(ctx, w, h, 'bottom', bottomWave, theme);
        drawGlowLine(ctx, bottomWave, theme);
        drawFrameParticles(ctx, bottomParticlesRef.current, config, time, w, bottomYMin, bottomYMax, accentColor);
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
  }, [canvasRef, accentColor, isActive, theme]);
}

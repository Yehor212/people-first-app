/**
 * useDiaryCanvas — rAF-driven wavy borders + floating particle system.
 *
 * Memory-safe: all rAF + event listeners cleaned up in useEffect return.
 * Canvas is fixed at initial viewport size — NEVER resizes for keyboard.
 * shouldAnimate() guard — static fallback when reduced motion enabled.
 *
 * PERFORMANCE GATE: Pauses rAF loop when user is typing (keydown on textarea).
 * Resumes 2 seconds after the last keystroke. This saves GPU while the user writes.
 */

import { useEffect, useRef } from 'react';
import { shouldAnimate } from '@/lib/animationUtils';
import { isCanvasPaused } from '@/lib/canvasPause';

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

// ── Pure helpers ──

function initParticles(count: number, w: number, h: number): Particle[] {
  return Array.from({ length: count }, () => ({
    x: Math.random() * w,
    y: Math.random() * h,
    size: 2 + Math.random() * 4,
    speedX: (Math.random() - 0.5) * 0.3,
    speedY: -0.1 - Math.random() * 0.2,
    opacity: 0.08 + Math.random() * 0.12,
    phase: Math.random() * Math.PI * 2,
  }));
}

function hexToRgba(hex: string, alpha: number): string {
  const match = hex.match(/^#([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i);
  if (!match) return `rgba(150, 150, 150, ${alpha})`;
  return `rgba(${parseInt(match[1], 16)}, ${parseInt(match[2], 16)}, ${parseInt(match[3], 16)}, ${alpha})`;
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

function updateAndDrawParticles(
  ctx: CanvasRenderingContext2D,
  particles: Particle[],
  w: number,
  h: number,
  time: number,
  color: string,
) {
  const t = time * 0.001;
  for (const p of particles) {
    p.x += p.speedX + Math.sin(t + p.phase) * 0.15;
    p.y += p.speedY;

    // Wrap around edges
    if (p.y < -10) { p.y = h + 10; p.x = Math.random() * w; }
    if (p.x < -10) p.x = w + 10;
    if (p.x > w + 10) p.x = -10;

    ctx.beginPath();
    ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
    ctx.fillStyle = hexToRgba(color, p.opacity);
    ctx.fill();
  }
}

// ── Hook ──

export function useDiaryCanvas(
  canvasRef: React.RefObject<HTMLCanvasElement | null>,
  accentColor: string,
  isActive: boolean,
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

    particlesRef.current = initParticles(40, w, h);
    let alive = true;

    // ── Typing-pause performance gate ──
    // Pause rAF while user types, resume 2s after last keystroke
    const RESUME_DELAY = 2000;

    const handleKeyDown = (e: KeyboardEvent) => {
      // Only pause for printable keys / deletion — ignore modifiers, arrows, etc.
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
      // Skip drawing when typing or image manipulation is active (save GPU)
      if (!isCanvasPaused() && !typingPausedRef.current) {
        ctx.clearRect(0, 0, w, h);
        drawWavyBorder(ctx, w, h, time, accentColor);
        updateAndDrawParticles(ctx, particlesRef.current, w, h, time, accentColor);
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
  }, [canvasRef, accentColor, isActive]);
}

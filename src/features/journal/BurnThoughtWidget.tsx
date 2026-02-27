/**
 * BurnThoughtWidget — Inline "burn a worry" section for the journal editor.
 *
 * "Ember Rise" dissolution:
 *   STATE MACHINE: IDLE → DISSOLVING → RELEASED → COLLAPSING → closed
 *
 *   DISSOLVING: Text fades opacity 1→0 over 600ms while warm ember particles
 *     spawn continuously for 800ms and float UPWARD with gentle drift.
 *     No html2canvas — zero main-thread freeze.
 *   RELEASED: "Released" text with gentle scale-in (400ms pause).
 *   COLLAPSING: Telegram-style height collapse → onClose().
 *   FALLBACK: shouldAnimate() false → instant RELEASED (no animation).
 *
 * Memory-safe: canvas + particle array destroyed in cleanup.
 * Haptic feedback. Respects in-app Dopamine toggle only.
 */

import { useState, useRef, useCallback, useEffect } from 'react';
import { Flame, X } from 'lucide-react';
import { motion } from 'framer-motion';
import { zenMotion, shouldAnimate } from '@/lib/animationUtils';
import { useLanguage } from '@/contexts/LanguageContext';

interface BurnThoughtWidgetProps {
  onClose: () => void;
}

// ── Ember particle ──────────────────────────────────────────────

interface Ember {
  x: number; y: number;
  vx: number; vy: number;
  size: number;
  alpha: number;
  decay: number;
  color: string;
  glow: boolean;
  rotation: number;
  rotSpeed: number;
  life: number;
  maxLife: number;
  spawnTime: number;
  phase: number;
}

// Warm color palette — ember/incense tones
const EMBER_COLORS = [
  '#ff6b35',  // deep orange
  '#ff8c42',  // amber
  '#ffa62b',  // gold
  '#ffcf56',  // bright gold
  '#fff5e0',  // white-hot
  '#ef4444',  // red
  '#f97316',  // orange
];

const TOTAL_DURATION = 1500;    // ms total animation
const SPAWN_WINDOW  = 800;      // ms — embers spawn during first 800ms
const TEXT_FADE_MS  = 600;      // ms — text opacity 1→0
const MAX_PARTICLES = 400;

function spawnEmber(areaW: number, areaH: number, now: number): Ember {
  const maxLife = 600 + Math.random() * 600; // 600-1200ms
  return {
    x: Math.random() * areaW,
    y: areaH * (0.3 + Math.random() * 0.7), // bottom-heavy bias
    vx: (Math.random() - 0.5) * 30,
    vy: -40 - Math.random() * 60,            // upward: -40 to -100 px/s
    size: 1 + Math.random() * 4,             // 1-5px radius
    alpha: 1,
    decay: 1 / maxLife,
    color: EMBER_COLORS[Math.floor(Math.random() * EMBER_COLORS.length)],
    glow: Math.random() < 0.15,              // 15% glow particles
    rotation: Math.random() * Math.PI * 2,
    rotSpeed: (Math.random() - 0.5) * 2,
    life: 0,
    maxLife,
    spawnTime: now,
    phase: Math.random() * Math.PI * 2,
  };
}

export function BurnThoughtWidget({ onClose }: BurnThoughtWidgetProps) {
  const { t } = useLanguage();
  const ts = t as unknown as Record<string, string>;
  const [text, setText] = useState('');
  const [burned, setBurned] = useState(false);
  const [burning, setBurning] = useState(false);
  const [collapsing, setCollapsing] = useState(false);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const rafRef = useRef(0);
  const closeTimerRef = useRef<ReturnType<typeof setTimeout>>();

  // ── Ember Rise animation ──

  const startBurn = useCallback(() => {
    if (!text.trim() || burning) return;

    // Haptic feedback
    navigator.vibrate?.([10, 30, 10]);

    // Reduced motion: skip animation entirely
    if (!shouldAnimate()) {
      setBurned(true);
      return;
    }

    setBurning(true);

    const container = containerRef.current;
    if (!container) { setBurned(true); return; }

    const canvas = canvasRef.current;
    if (!canvas) { setBurned(true); setBurning(false); return; }

    const ctx = canvas.getContext('2d');
    if (!ctx) { setBurned(true); setBurning(false); return; }

    // Size canvas to container (no html2canvas — zero freeze!)
    const rect = container.getBoundingClientRect();
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const w = Math.round(rect.width * dpr);
    const h = Math.round(rect.height * dpr);
    canvas.width = w;
    canvas.height = h;
    canvas.style.width = `${rect.width}px`;
    canvas.style.height = `${rect.height}px`;
    ctx.scale(dpr, dpr);

    const areaW = rect.width;
    const areaH = rect.height;

    // Particle pool
    const embers: Ember[] = [];
    let lastTime = performance.now();
    const startTime = lastTime;
    let spawnAccum = 0; // fractional spawn accumulator

    function frame(now: number) {
      if (!ctx) return;
      const dt = Math.min((now - lastTime) / 1000, 0.05); // cap at 50ms to avoid spiral
      const elapsed = now - startTime;
      lastTime = now;

      ctx.clearRect(0, 0, areaW, areaH);

      // ── Spawn phase: first 800ms ──
      if (elapsed < SPAWN_WINDOW && embers.length < MAX_PARTICLES) {
        // ~0.5 embers per ms = ~30 per frame at 60fps
        spawnAccum += dt * 500;
        const toSpawn = Math.min(
          Math.floor(spawnAccum),
          MAX_PARTICLES - embers.length,
        );
        for (let i = 0; i < toSpawn; i++) {
          embers.push(spawnEmber(areaW, areaH, now));
        }
        spawnAccum -= toSpawn;
      }

      // ── Update & render ──
      let alive = 0;
      for (let i = 0; i < embers.length; i++) {
        const p = embers[i];
        if (p.alpha <= 0) continue;

        // Lifetime progress
        p.life += dt * 1000;
        if (p.life >= p.maxLife) { p.alpha = 0; continue; }

        // Anti-gravity: gentle upward deceleration
        p.vy -= 60 * dt;

        // Wind wobble
        p.vx += Math.sin(now * 0.003 + p.phase) * 15 * dt;

        // Move
        p.x += p.vx * dt;
        p.y += p.vy * dt;

        // Rotation
        p.rotation += p.rotSpeed * dt;

        // Alpha fade based on individual lifetime
        p.alpha = Math.max(0, 1 - (p.life / p.maxLife));

        // Very subtle shrink
        p.size *= (1 - 0.002 * (dt * 60));

        if (p.alpha <= 0.01 || p.size < 0.3) { p.alpha = 0; continue; }

        alive++;

        // ── Render glow halo ──
        if (p.glow) {
          ctx.globalAlpha = p.alpha * 0.25;
          ctx.fillStyle = p.color;
          ctx.beginPath();
          ctx.arc(p.x, p.y, p.size * 2.5, 0, Math.PI * 2);
          ctx.fill();
        }

        // ── Render core ember ──
        ctx.globalAlpha = p.alpha;
        ctx.fillStyle = p.color;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
        ctx.fill();
      }

      ctx.globalAlpha = 1;

      // End condition: past total duration AND no alive particles
      if (elapsed > TOTAL_DURATION && alive === 0) {
        setBurning(false);
        setBurned(true);
        return;
      }

      // Hard timeout safety (3s max)
      if (elapsed > 3000) {
        setBurning(false);
        setBurned(true);
        return;
      }

      rafRef.current = requestAnimationFrame(frame);
    }

    rafRef.current = requestAnimationFrame(frame);
  }, [text, burning]);

  // ── Telegram-style collapse: burned → brief pause → collapse → close ──
  useEffect(() => {
    if (burned && !collapsing) {
      closeTimerRef.current = setTimeout(() => {
        setCollapsing(true);
      }, 400);
    }
    return () => { if (closeTimerRef.current) clearTimeout(closeTimerRef.current); };
  }, [burned, collapsing]);

  // ── Cleanup rAF ──
  useEffect(() => {
    return () => {
      cancelAnimationFrame(rafRef.current);
      if (closeTimerRef.current) clearTimeout(closeTimerRef.current);
    };
  }, []);

  // Determine animation states
  const getAnimateProps = () => {
    if (collapsing) {
      return {
        opacity: 0,
        height: 0,
        scaleY: 0.92,
        y: -8,
        marginTop: 0,
        marginBottom: 0,
        paddingTop: 0,
        paddingBottom: 0,
      };
    }
    if (burned) {
      return { opacity: 1, y: 0, scale: 1, borderColor: 'rgba(156,163,175,0.2)' };
    }
    if (burning) {
      return {
        opacity: 1,
        y: 0,
        scale: 1,
        borderColor: ['rgba(239,68,68,0.5)', 'rgba(249,115,22,0.5)', 'rgba(156,163,175,0.3)'],
      };
    }
    return { opacity: 1, y: 0, scale: 1, borderColor: 'rgba(239,68,68,0.5)' };
  };

  const getTransition = () => {
    if (collapsing) {
      return { duration: 0.55, ease: [0.32, 0.72, 0, 1] as const };
    }
    if (burned) {
      return { duration: 0.3, ease: 'easeOut' as const };
    }
    if (burning) {
      return { duration: 0.8, ease: 'easeOut' as const };
    }
    return zenMotion.gentle;
  };

  return (
    <motion.div
      className="my-8 p-6 border border-dashed rounded-2xl bg-red-500/5 relative overflow-hidden"
      style={{ borderColor: 'rgba(239, 68, 68, 0.5)' }}
      initial={{ opacity: 0, y: -16, scale: 0.97 }}
      animate={getAnimateProps()}
      exit={{ opacity: 0, height: 0, scaleY: 0.92, y: -8, marginTop: 0, marginBottom: 0, paddingTop: 0, paddingBottom: 0 }}
      transition={getTransition()}
      onAnimationComplete={() => {
        if (collapsing) onClose();
      }}
    >
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-2.5">
        <div className="flex items-center gap-2 text-red-400">
          <Flame className="w-4 h-4" />
          <span className="text-sm font-medium">
            {burned ? (ts.journalBurnReleased || 'Released') : (ts.journalBurnTitle || 'Burn a thought')}
          </span>
        </div>
        {!burned && !burning && (
          <motion.button
            whileTap={{ scale: 0.92 }}
            onClick={onClose}
            className="min-w-[44px] min-h-[44px] flex items-center justify-center rounded-full"
            aria-label={ts.close || 'Close'}
          >
            <X className="w-3.5 h-3.5 text-red-400/60" />
          </motion.button>
        )}
      </div>

      {/* Body */}
      <div className="relative px-4 pb-4">
        {burned ? (
          <motion.p
            className="text-sm py-4 text-center text-red-300/60"
            initial={{ opacity: 0, scale: 0.9 }}
            animate={collapsing ? { opacity: 0, y: -12 } : { opacity: 1, scale: 1 }}
            transition={collapsing ? { duration: 0.25 } : zenMotion.gentle}
          >
            {ts.journalBurnReleasedMessage || 'Your thought has been released.'}
          </motion.p>
        ) : (
          <div ref={containerRef} className="relative">
            {/* Content — opacity fade during burning (text dissolves while embers rise) */}
            <motion.div
              animate={{ opacity: burning ? 0 : 1 }}
              transition={{ duration: TEXT_FADE_MS / 1000, ease: 'easeOut' }}
            >
              <textarea
                value={text}
                onChange={(e) => setText(e.target.value)}
                placeholder={ts.journalBurnPlaceholder || 'Write what worries you...'}
                className="w-full rounded-xl px-3.5 py-2.5 text-sm outline-none resize-none bg-transparent text-red-300 border border-red-500/30 placeholder:text-red-400/40"
                style={{ minHeight: 64 }}
                rows={2}
                disabled={burning}
              />
              {!burning && (
                <motion.button
                  whileTap={{ scale: 0.95 }}
                  onClick={startBurn}
                  disabled={!text.trim()}
                  className={`mt-2.5 w-full py-2.5 rounded-full text-sm font-medium transition-colors flex items-center justify-center gap-2 min-h-[44px] ${text.trim() ? 'bg-red-500/20 text-red-300 border border-red-500/40' : 'bg-white/5 text-slate-500 border border-white/10'}`}
                >
                  <Flame className="w-4 h-4" />
                  {ts.journalBurnAction || 'Burn it'}
                </motion.button>
              )}
            </motion.div>

            {/* Ember canvas — overlays content, pointer-events: none */}
            {burning && (
              <canvas
                ref={canvasRef}
                className="absolute inset-0 w-full h-full rounded-xl gpu-layer"
                style={{ zIndex: 2, pointerEvents: 'none' }}
                aria-hidden="true"
              />
            )}
          </div>
        )}
      </div>
    </motion.div>
  );
}

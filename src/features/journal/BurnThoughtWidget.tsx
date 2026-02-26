/**
 * BurnThoughtWidget — Inline "burn a worry" section for the journal editor.
 *
 * Renders as an inline collapsible section (not absolute-positioned).
 * Canvas fire particle animation on "Burn". Memory-safe rAF cleanup.
 * Text blurs/fades via framer-motion while fire plays. Haptic feedback.
 */

import { useState, useRef, useCallback, useEffect } from 'react';
import { Flame, X } from 'lucide-react';
import { motion } from 'framer-motion';
import { zenMotion, shouldAnimate } from '@/lib/animationUtils';
import { useLanguage } from '@/contexts/LanguageContext';

interface BurnThoughtWidgetProps {
  onClose: () => void;
}

// ── Fire particle system ──

interface FireParticle {
  x: number; y: number;
  vx: number; vy: number;
  life: number; maxLife: number;
  size: number;
  hue: number; // 0-40 for orange/red
}

function initFireParticles(w: number, h: number): FireParticle[] {
  return Array.from({ length: 60 }, () => ({
    x: w * 0.3 + Math.random() * w * 0.4,
    y: h * 0.8 + Math.random() * h * 0.2,
    vx: (Math.random() - 0.5) * 2,
    vy: -1.5 - Math.random() * 3,
    life: 1,
    maxLife: 0.6 + Math.random() * 0.4,
    size: 3 + Math.random() * 5,
    hue: Math.random() * 40,
  }));
}

export function BurnThoughtWidget({ onClose }: BurnThoughtWidgetProps) {
  const { t } = useLanguage();
  const ts = t as unknown as Record<string, string>;
  const [text, setText] = useState('');
  const [burned, setBurned] = useState(false);
  const [burning, setBurning] = useState(false);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const rafRef = useRef(0);
  const closeTimerRef = useRef<ReturnType<typeof setTimeout>>();

  // ── Fire animation ──

  const startBurn = useCallback(() => {
    if (!text.trim() || burning) return;

    // Haptic feedback
    navigator.vibrate?.([100, 50, 200]);

    // Reduced motion: skip fire animation, mark burned immediately
    if (!shouldAnimate()) {
      setBurned(true);
      return;
    }

    setBurning(true);

    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const w = canvas.width;
    const h = canvas.height;
    const particles = initFireParticles(w, h);
    const startTime = performance.now();
    const DURATION = 2500;

    function frame(now: number) {
      if (!ctx) return;
      const elapsed = now - startTime;
      const progress = Math.min(1, elapsed / DURATION);

      ctx.clearRect(0, 0, w, h);

      for (const p of particles) {
        p.x += p.vx;
        p.y += p.vy;
        p.vy -= 0.02; // accelerate upward
        p.life = Math.max(0, 1 - (elapsed / DURATION) * (1 / p.maxLife));

        if (p.life <= 0) continue;

        ctx.globalAlpha = p.life * 0.8;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size * p.life, 0, Math.PI * 2);
        ctx.fillStyle = `hsl(${p.hue}, 100%, ${50 + p.life * 30}%)`;
        ctx.fill();
      }
      ctx.globalAlpha = 1;

      if (progress < 1) {
        rafRef.current = requestAnimationFrame(frame);
      } else {
        setBurned(true);
        setBurning(false);
      }
    }

    rafRef.current = requestAnimationFrame(frame);
  }, [text, burning]);

  // ── Auto-close after burned ──
  useEffect(() => {
    if (burned) {
      closeTimerRef.current = setTimeout(onClose, 1000);
    }
    return () => { if (closeTimerRef.current) clearTimeout(closeTimerRef.current); };
  }, [burned, onClose]);

  // ── Cleanup rAF ──
  useEffect(() => {
    return () => {
      cancelAnimationFrame(rafRef.current);
      if (closeTimerRef.current) clearTimeout(closeTimerRef.current);
    };
  }, []);

  return (
    <motion.div
      className="my-8 p-6 border border-dashed rounded-2xl bg-red-500/5 relative overflow-hidden"
      style={{ borderColor: 'rgba(239, 68, 68, 0.5)' }}
      initial={{ opacity: 0, y: -16, scale: 0.97 }}
      animate={burned
        ? { opacity: 0, height: 0, marginTop: 0, marginBottom: 0, paddingTop: 0, paddingBottom: 0 }
        : burning
          ? { opacity: 1, y: 0, scale: 1, borderColor: ['rgba(239,68,68,0.5)', 'rgba(249,115,22,0.5)', 'rgba(156,163,175,0.3)'] }
          : { opacity: 1, y: 0, scale: 1, borderColor: 'rgba(239,68,68,0.5)' }}
      exit={{ opacity: 0, y: -16, scale: 0.97 }}
      transition={burned ? { duration: 0.8, ease: 'easeInOut' } : burning ? { duration: 2.5, ease: 'easeOut' } : zenMotion.gentle}
    >
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-2.5">
        <div className="flex items-center gap-2 text-red-400">
          <Flame className="w-4 h-4" />
          <span className="text-sm font-medium">
            {burned ? (ts.journalBurnReleased || 'Released') : (ts.journalBurnTitle || 'Burn a thought')}
          </span>
        </div>
        <motion.button
          whileTap={{ scale: 0.92 }}
          onClick={onClose}
          className="min-w-[44px] min-h-[44px] flex items-center justify-center rounded-full"
          aria-label={ts.close || 'Close'}
        >
          <X className="w-3.5 h-3.5 text-red-400/60" />
        </motion.button>
      </div>

      {/* Body */}
      <div className="relative px-4 pb-4">
        {burned ? (
          <motion.p
            className="text-sm py-4 text-center text-red-300/60"
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={zenMotion.gentle}
          >
            {ts.journalBurnReleasedMessage || 'Your thought has been released.'}
          </motion.p>
        ) : (
          <div className="relative">
            {/* Text area — blurs and fades when burning */}
            <motion.div
              animate={burning ? { scale: 0.9, y: -50, opacity: 0 } : { scale: 1, y: 0, opacity: 1 }}
              transition={{ duration: 2.5, ease: 'easeOut' }}
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

            {/* Fire canvas — overlays the blurring text */}
            {burning && (
              <canvas
                ref={canvasRef}
                width={280}
                height={120}
                className="absolute inset-0 w-full h-full rounded-xl"
                style={{ zIndex: 10 }}
                aria-hidden="true"
              />
            )}
          </div>
        )}
      </div>
    </motion.div>
  );
}

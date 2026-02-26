/**
 * BurnThoughtWidget — Inline "burn a worry" section for the journal editor.
 *
 * Renders as an inline collapsible section (not absolute-positioned).
 * Cinematic disintegration animation on "Burn":
 *   - Grid-based particles cover the content area
 *   - Bottom-to-top burn wave sweeps through, activating particles
 *   - Particles scatter upward with fire glow (additive blend)
 *   - Text blurs/fades fast via framer-motion while particles take over
 *
 * After burn: Telegram-style smooth collapse —
 *   brief "Released" glow → content fades up → card collapses to zero height.
 *
 * Memory-safe rAF cleanup. Haptic feedback. Respects reduced motion.
 */

import { useState, useRef, useCallback, useEffect } from 'react';
import { Flame, X } from 'lucide-react';
import { motion } from 'framer-motion';
import { zenMotion, shouldAnimate } from '@/lib/animationUtils';
import { useLanguage } from '@/contexts/LanguageContext';

interface BurnThoughtWidgetProps {
  onClose: () => void;
}

// ── Disintegration particle system ──

interface DisintegrationParticle {
  x: number; y: number;
  originX: number; originY: number;
  vx: number; vy: number;
  size: number;
  rotation: number;
  rotationSpeed: number;
  hue: number;        // 0-50 (red→orange→yellow)
  saturation: number;
  lightness: number;
  life: number;       // 0..1
  maxLife: number;
  delay: number;      // activation delay for burn-wave sweep (seconds)
  active: boolean;
  hasShadow: boolean; // tier 1 (glow) vs tier 2 (no glow)
}

const MAX_PARTICLES = 300;
const GRID_STEP = 6;
const BURN_DURATION = 2500;

function initDisintegrationParticles(w: number, h: number): DisintegrationParticle[] {
  const particles: DisintegrationParticle[] = [];
  const cols = Math.floor(w / GRID_STEP);
  const rows = Math.floor(h / GRID_STEP);

  for (let row = 0; row < rows; row++) {
    for (let col = 0; col < cols; col++) {
      if (particles.length >= MAX_PARTICLES) break;
      // ~30% spawn probability per cell
      if (Math.random() > 0.30) continue;

      const x = col * GRID_STEP + Math.random() * GRID_STEP;
      const y = row * GRID_STEP + Math.random() * GRID_STEP;

      // Burn wave delay: bottom rows activate first (delay≈0), top rows last (delay≈1.2s)
      const normalizedRow = row / Math.max(rows - 1, 1); // 0 (top) to 1 (bottom)
      const burnDelay = (1 - normalizedRow) * 1.2 + Math.random() * 0.3;

      const isTier1 = Math.random() < 0.6; // 60% fragment (glow), 40% ash (no glow)

      particles.push({
        x, y,
        originX: x, originY: y,
        vx: 0, vy: 0,
        size: isTier1 ? (2 + Math.random() * 2.5) : (1 + Math.random() * 1),
        rotation: Math.random() * Math.PI * 2,
        rotationSpeed: (Math.random() - 0.5) * 0.15,
        hue: Math.random() * 50,
        saturation: 85 + Math.random() * 15,
        lightness: isTier1 ? (45 + Math.random() * 25) : (30 + Math.random() * 20),
        life: 1.0,
        maxLife: 0.5 + Math.random() * 0.5,
        delay: burnDelay,
        active: false,
        hasShadow: isTier1,
      });
    }
    if (particles.length >= MAX_PARTICLES) break;
  }

  return particles;
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

  // ── Disintegration animation ──

  const startBurn = useCallback(() => {
    if (!text.trim() || burning) return;

    // Haptic feedback
    navigator.vibrate?.([100, 50, 200]);

    // Reduced motion: skip animation, mark burned immediately
    if (!shouldAnimate()) {
      setBurned(true);
      return;
    }

    setBurning(true);

    const canvas = canvasRef.current;
    const container = containerRef.current;
    if (!canvas || !container) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Dynamic canvas sizing (DPR-aware, cap at 2)
    const rect = container.getBoundingClientRect();
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const w = rect.width;
    const h = rect.height;
    canvas.width = w * dpr;
    canvas.height = h * dpr;
    canvas.style.width = `${w}px`;
    canvas.style.height = `${h}px`;
    ctx.scale(dpr, dpr);

    const particles = initDisintegrationParticles(w, h);
    const startTime = performance.now();

    function frame(now: number) {
      if (!ctx) return;
      const elapsed = now - startTime;
      const progress = Math.min(1, elapsed / BURN_DURATION);
      const elapsedSec = elapsed / 1000;

      ctx.clearRect(0, 0, w, h);

      // ── Pass 1: Charring overlay (darkens as burn progresses) ──
      const charProgress = Math.min(1, elapsed / (BURN_DURATION * 0.7));
      ctx.globalCompositeOperation = 'source-over';
      ctx.fillStyle = `rgba(2, 6, 17, ${charProgress * 0.85})`;
      ctx.fillRect(0, 0, w, h);

      // ── Pass 2: Burn wavefront glow line (first 60% of animation) ──
      if (progress < 0.6) {
        const waveY = h * (1 - progress / 0.6); // bottom → top
        const grad = ctx.createLinearGradient(0, waveY - 15, 0, waveY + 15);
        grad.addColorStop(0, 'rgba(251, 146, 60, 0)');
        grad.addColorStop(0.3, 'rgba(251, 146, 60, 0.6)');
        grad.addColorStop(0.5, 'rgba(249, 115, 22, 0.9)');
        grad.addColorStop(0.7, 'rgba(251, 146, 60, 0.6)');
        grad.addColorStop(1, 'rgba(251, 146, 60, 0)');
        ctx.fillStyle = grad;
        ctx.fillRect(0, waveY - 15, w, 30);
      }

      // ── Pass 3: Particles (two-tier, additive blend) ──
      ctx.globalCompositeOperation = 'lighter';

      // Separate into glow and non-glow for batched rendering
      for (let tier = 0; tier < 2; tier++) {
        const renderGlow = tier === 1;

        if (renderGlow) {
          // Set shadow once for entire glow tier
          ctx.shadowColor = 'rgba(249, 115, 22, 0.5)';
        }

        for (const p of particles) {
          if (p.hasShadow !== renderGlow) continue;

          // Activate on delay
          if (!p.active) {
            if (elapsedSec >= p.delay) {
              p.active = true;
              // Ignition burst
              p.vx = (Math.random() - 0.5) * 3;
              p.vy = -2 - Math.random() * 4;
            } else {
              continue;
            }
          }

          // Life decay
          const timeSinceActive = elapsedSec - p.delay;
          const lifespan = p.maxLife * (BURN_DURATION / 1000);
          p.life = Math.max(0, 1 - timeSinceActive / lifespan);
          if (p.life <= 0) { p.active = false; continue; }

          // Physics: turbulence + upward fire bias + drag
          const turbX = Math.sin(now * 0.003 + p.originX * 0.1) * 0.4;
          const turbY = Math.cos(now * 0.004 + p.originY * 0.1) * 0.2;
          p.vx += turbX * 0.016;
          p.vy += (-0.8 - Math.random() * 0.4 + turbY) * 0.016;
          p.vx *= 0.98;
          p.vy *= 0.98;
          p.x += p.vx;
          p.y += p.vy;
          p.rotation += p.rotationSpeed;

          // Render
          const alpha = p.life * p.life; // quadratic fade
          if (alpha < 0.01) continue;

          ctx.globalAlpha = alpha;
          if (renderGlow) {
            ctx.shadowBlur = (2 + p.size) * p.life;
          }

          // Color shifts: bright → dark as life fades
          const lifetimeHue = p.hue * p.life;
          const lifetimeLightness = p.lightness * (0.3 + p.life * 0.7);

          ctx.save();
          ctx.translate(p.x, p.y);
          ctx.rotate(p.rotation);
          const halfSize = p.size * (0.5 + p.life * 0.5);
          ctx.fillStyle = `hsl(${lifetimeHue}, ${p.saturation}%, ${lifetimeLightness}%)`;
          ctx.fillRect(-halfSize, -halfSize, halfSize * 2, halfSize * 2);
          ctx.restore();
        }

        if (renderGlow) {
          ctx.shadowBlur = 0;
          ctx.shadowColor = 'transparent';
        }
      }

      ctx.globalCompositeOperation = 'source-over';
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

  // ── Telegram-style collapse: burned → brief pause → collapse → close ──
  useEffect(() => {
    if (burned && !collapsing) {
      // Brief 400ms pause showing "Released", then start collapse
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
      // Brief "Released" state — soft glow pulse
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
      // Telegram-style: fast start, smooth landing
      return { duration: 0.55, ease: [0.32, 0.72, 0, 1] as const };
    }
    if (burned) {
      return { duration: 0.3, ease: 'easeOut' as const };
    }
    if (burning) {
      return { duration: 2.5, ease: 'easeOut' as const };
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
            {/* Text area — blurs and fades fast when burning */}
            <motion.div
              animate={burning ? { opacity: 0, filter: 'blur(3px)' } : { opacity: 1, filter: 'blur(0px)' }}
              transition={{ duration: 0.5, ease: 'easeOut' }}
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

            {/* Disintegration canvas — overlays the content area */}
            {burning && (
              <canvas
                ref={canvasRef}
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

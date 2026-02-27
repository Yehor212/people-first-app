/**
 * BurnThoughtWidget — Inline "burn a worry" section for the journal editor.
 *
 * Telegram-style bitmap disintegration:
 *   STATE MACHINE: IDLE → CAPTURING → SHATTERING → CLEANUP
 *
 *   CAPTURING: html2canvas captures the content DOM as bitmap.
 *   SHATTERING: Bitmap is split into pixel-block particles using getImageData.
 *     Each particle carries the REAL color from the original content.
 *     Background pixels (low luminance) fade 3× faster.
 *     Physics: gravity, turbulence, alpha decay over 800ms.
 *   CLEANUP: "Released" pause → Telegram-style height collapse → onClose().
 *   FALLBACK_FADE: If capture fails or reduced motion — instant burn.
 *
 * Memory-safe: canvas + particle array destroyed in CLEANUP.
 * Haptic feedback. Respects prefers-reduced-motion.
 */

import { useState, useRef, useCallback, useEffect } from 'react';
import { Flame, X } from 'lucide-react';
import { motion } from 'framer-motion';
import html2canvas from 'html2canvas';
import { zenMotion, shouldAnimate } from '@/lib/animationUtils';
import { useLanguage } from '@/contexts/LanguageContext';

interface BurnThoughtWidgetProps {
  onClose: () => void;
}

// ── Shatter particle (bitmap-sampled) ──

interface ShatterParticle {
  x: number; y: number;
  vx: number; vy: number;
  r: number; g: number; b: number;
  alpha: number;    // current fade 1→0
  size: number;     // block size px
  phase: number;    // turbulence sine offset
  isBg: boolean;    // background pixel → fades 3× faster
}

const SHATTER_DURATION = 800; // ms

/**
 * Sample bitmap pixels into block-averaged particles.
 * Skip transparent blocks. Tag dark blocks as background (fade faster).
 */
function createParticlesFromBitmap(
  imageData: ImageData,
  w: number,
  h: number,
): ShatterParticle[] {
  const { data } = imageData;
  const area = w * h;
  const blockSize = area > 200 * 200 ? 4 : 3;
  const particles: ShatterParticle[] = [];

  for (let by = 0; by < h; by += blockSize) {
    for (let bx = 0; bx < w; bx += blockSize) {
      let rSum = 0, gSum = 0, bSum = 0, aSum = 0, count = 0;

      // Average color within block
      for (let py = by; py < Math.min(by + blockSize, h); py++) {
        for (let px = bx; px < Math.min(bx + blockSize, w); px++) {
          const idx = (py * w + px) * 4;
          rSum += data[idx];
          gSum += data[idx + 1];
          bSum += data[idx + 2];
          aSum += data[idx + 3];
          count++;
        }
      }

      const avgAlpha = aSum / count;
      if (avgAlpha < 10) continue; // skip transparent

      const r = Math.round(rSum / count);
      const g = Math.round(gSum / count);
      const b = Math.round(bSum / count);

      // Luminance check: dark pixels are background → fade faster
      const luminance = 0.299 * r + 0.587 * g + 0.114 * b;
      const isBg = luminance < 30;

      particles.push({
        x: bx, y: by,
        vx: (Math.random() - 0.5) * 200,       // px/s random burst
        vy: -50 - Math.random() * 100,           // upward kick px/s
        r, g, b,
        alpha: 1,
        size: blockSize,
        phase: Math.random() * Math.PI * 2,
        isBg,
      });
    }
  }

  return particles;
}

export function BurnThoughtWidget({ onClose }: BurnThoughtWidgetProps) {
  const { t } = useLanguage();
  const ts = t as unknown as Record<string, string>;
  const [text, setText] = useState('');
  const [burned, setBurned] = useState(false);
  const [burning, setBurning] = useState(false);
  const [shattering, setShattering] = useState(false);
  const [collapsing, setCollapsing] = useState(false);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const rafRef = useRef(0);
  const closeTimerRef = useRef<ReturnType<typeof setTimeout>>();

  // ── Bitmap disintegration ──

  const startBurn = useCallback(async () => {
    if (!text.trim() || burning) return;

    // Haptic feedback (spec pattern)
    navigator.vibrate?.([10, 30, 10]);

    // Reduced motion: skip animation entirely
    if (!shouldAnimate()) {
      setBurned(true);
      return;
    }

    setBurning(true);

    const container = containerRef.current;
    if (!container) { setBurned(true); return; }

    try {
      // ── CAPTURING: bitmap snapshot of DOM content ──
      const bitmap = await html2canvas(container, {
        backgroundColor: null,
        scale: 1,
        logging: false,
        useCORS: true,
      });

      const canvas = canvasRef.current;
      if (!canvas) { setBurned(true); setBurning(false); return; }

      const ctx = canvas.getContext('2d');
      if (!ctx) { setBurned(true); setBurning(false); return; }

      // Size overlay canvas to match container
      const w = bitmap.width;
      const h = bitmap.height;
      canvas.width = w;
      canvas.height = h;
      canvas.style.width = `${container.offsetWidth}px`;
      canvas.style.height = `${container.offsetHeight}px`;

      // Extract pixel data from bitmap
      const bitmapCtx = bitmap.getContext('2d');
      if (!bitmapCtx) { setBurned(true); setBurning(false); return; }
      const imageData = bitmapCtx.getImageData(0, 0, w, h);

      // ── SHATTERING: create particles from real pixels ──
      const particles = createParticlesFromBitmap(imageData, w, h);
      setShattering(true);

      let lastTime = performance.now();
      const startTime = lastTime;

      function frame(now: number) {
        if (!ctx) return;
        const dt = (now - lastTime) / 1000; // seconds
        const elapsed = now - startTime;
        lastTime = now;

        ctx.clearRect(0, 0, w, h);

        let alive = 0;
        for (const p of particles) {
          if (p.alpha <= 0) continue;

          // Gravity pulls down
          p.vy += 400 * dt;

          // Turbulence (sine wobble on X)
          p.vx += Math.sin(elapsed * 0.005 + p.phase) * 50 * dt;

          // Move
          p.x += p.vx * dt;
          p.y += p.vy * dt;

          // Alpha decay
          const fadeRate = p.isBg ? 3 : 1; // bg pixels fade 3× faster
          p.alpha -= (dt / (SHATTER_DURATION / 1000)) * fadeRate;
          if (p.alpha <= 0) { p.alpha = 0; continue; }

          alive++;

          // Render pixel block
          ctx.globalAlpha = p.alpha;
          ctx.fillStyle = `rgb(${p.r},${p.g},${p.b})`;
          ctx.fillRect(Math.round(p.x), Math.round(p.y), p.size, p.size);
        }

        ctx.globalAlpha = 1;

        if (alive > 0 && elapsed < SHATTER_DURATION * 1.5) {
          rafRef.current = requestAnimationFrame(frame);
        } else {
          // ── CLEANUP ──
          setShattering(false);
          setBurning(false);
          setBurned(true);
        }
      }

      rafRef.current = requestAnimationFrame(frame);
    } catch {
      // ── FALLBACK_FADE: capture failed ──
      setBurning(false);
      setBurned(true);
    }
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
            {/* Content — hidden (visibility) during shattering, keeps height */}
            <div style={shattering ? { visibility: 'hidden' as const } : undefined}>
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
            </div>

            {/* Shatter canvas — overlays content, pointer-events: none */}
            {(burning || shattering) && (
              <canvas
                ref={canvasRef}
                className="absolute inset-0 w-full h-full rounded-xl gpu-layer"
                style={{ zIndex: 1000, pointerEvents: 'none' }}
                aria-hidden="true"
              />
            )}
          </div>
        )}
      </div>
    </motion.div>
  );
}

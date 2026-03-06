/**
 * BurnThoughtWidget — Premium "burn a worry" section for the journal editor.
 *
 * "Thanos Snap" text disintegration — cinematic "letting go" experience:
 *   STATE MACHINE: IDLE -> DISSOLVING -> RELEASED -> COLLAPSING -> closed
 *
 *   Director's Arc:
 *     1. TENSION    — text trembles with crescendo intensity (600ms)
 *     2. RELEASE    — strip-by-strip dissolution, particles rise upward (2200ms)
 *     3. LIBERATION — particles float away like freed thoughts, cooling to ash
 *     4. BREATH     — serene pause (800ms), animated check circle
 *     5. RESOLUTION — Telegram-style collapse -> onClose()
 *
 *   IDLE: Ambient ember particles float along card edges when text is entered.
 *         Flame icon pulses gently. Burn button glows with warm pulse.
 *         Character counter at bottom-right. Textarea auto-grows.
 *
 *   DISSOLVING: Text-to-pixel sampling -> dust particles with temperature
 *     progression (hot amber/orange -> cool gray ash). Particles float UPWARD
 *     like releasing thoughts into the sky. Rising CSS embers complement.
 *
 *   RELEASED: Animated check circle draws itself + "Released" text.
 *   COLLAPSING: Telegram-style height collapse -> onClose().
 *   FALLBACK: shouldAnimate() false -> instant RELEASED (no animation).
 *
 *   Safari/iOS: Uses standard font stack for canvas (Safari returns
 *   .AppleSystemUIFont which Canvas API can't parse). willReadFrequently
 *   hint for getImageData. Keyboard dismissed before animation.
 *
 * No html2canvas - fillText is GPU-accelerated, <1ms.
 * Memory-safe: offscreen canvas + particle array destroyed in cleanup.
 * Haptic feedback via Capacitor. Respects in-app Dopamine toggle only.
 */

import { useState, useRef, useCallback, useEffect, memo } from 'react';
import { Flame, X } from 'lucide-react';
import { motion } from 'framer-motion';
import { zenMotion, shouldAnimate } from '@/lib/animationUtils';
import { useLanguage } from '@/contexts/LanguageContext';
import { hapticWarning, hapticMedium, hapticSuccess, hapticTap } from '@/lib/haptics';
import { announceSuccess } from '@/lib/a11y';

interface BurnThoughtWidgetProps {
  onClose: () => void;
}

// -- Dust particle (text-sampled) ----------------------------------------

interface DustParticle {
  x: number; y: number;
  originX: number; originY: number;
  vx: number; vy: number;
  size: number;
  alpha: number;
  color: string;
  ashColor: string;
  glow: boolean;
  rotation: number;
  rotSpeed: number;
  life: number;
  maxLife: number;
  delay: number;
  phase: number;
  started: boolean;
}

// Hot ember palette - bright, warm colors for fresh particles
const COLORS_HOT = [
  '#fbbf24',  // amber-400
  '#fb923c',  // orange-400
  '#f87171',  // red-400
  '#fca5a5',  // red-300
];

// Ash palette - cool, muted colors for dying particles
const COLORS_ASH = [
  '#d4d4d8',  // zinc-300
  '#a1a1aa',  // zinc-400
  '#71717a',  // zinc-500
];

// Ambient ember colors (for floating CSS particles)
const EMBER_AMBIENT = ['#fbbf24', '#fb923c', '#f87171', '#ef4444'];

// -- Animation constants (Director's pacing - slow, emotional) -----------

const TOTAL_DURATION  = 4000;   // ms - longer for "letting go" feel
const VIBRATE_PHASE   = 600;    // ms - crescendo trembling builds tension
const DISSOLVE_PHASE  = 2200;   // ms - slow, deliberate strip dissolution
const TEXT_FADE_MS    = 300;    // ms - gradual text->particle swap
const MAX_PARTICLES   = 600;    // particle budget
const NUM_STRIPS      = 8;      // vertical dissolution strips
const SAMPLE_STEP     = 3;      // sample every 3rd pixel
const HARD_TIMEOUT    = 5500;   // ms - safety cutoff
const RELEASED_PAUSE  = 800;    // ms - serenity pause before collapse

// Safari-safe font stack for Canvas API
// Safari returns ".AppleSystemUIFont" from getComputedStyle which Canvas can't parse
const CANVAS_FONT_FAMILY = 'system-ui, -apple-system, BlinkMacSystemFont, sans-serif';

// -- Word-wrap helper (canvas fillText doesn't auto-wrap) ----------------

function wrapText(ctx: CanvasRenderingContext2D, text: string, maxWidth: number): string[] {
  const words = text.split(/\s+/);
  const lines: string[] = [];
  let currentLine = '';
  for (const word of words) {
    const testLine = currentLine ? `${currentLine} ${word}` : word;
    if (ctx.measureText(testLine).width > maxWidth && currentLine) {
      lines.push(currentLine);
      currentLine = word;
    } else {
      currentLine = testLine;
    }
  }
  if (currentLine) lines.push(currentLine);
  return lines;
}

// -- Text-to-pixel sampling ----------------------------------------------

function sampleTextPixels(
  text: string,
  areaW: number,
  areaH: number,
  dpr: number,
  textareaEl: HTMLTextAreaElement | null,
): Array<{ x: number; y: number }> {
  const offscreen = document.createElement('canvas');
  const scaledW = Math.round(areaW * dpr);
  const scaledH = Math.round(areaH * dpr);
  offscreen.width = scaledW;
  offscreen.height = scaledH;

  // willReadFrequently hint - optimizes getImageData on Safari/iOS
  const ctx = offscreen.getContext('2d', { willReadFrequently: true });
  if (!ctx) return [];

  ctx.scale(dpr, dpr);

  // Match textarea styling - use standard font stack for Safari compatibility
  const computed = textareaEl ? getComputedStyle(textareaEl) : null;
  const fontSize = computed ? (parseFloat(computed.fontSize) || 14) : 14;
  const lineHeight = computed ? (parseFloat(computed.lineHeight) || fontSize * 1.5) : fontSize * 1.5;
  const borderLeft = computed ? (parseFloat(computed.borderLeftWidth) || 0) : 1;
  const borderTop = computed ? (parseFloat(computed.borderTopWidth) || 0) : 1;
  const paddingLeft = (computed ? (parseFloat(computed.paddingLeft) || 14) : 14) + borderLeft;
  const paddingTop = (computed ? (parseFloat(computed.paddingTop) || 10) : 10) + borderTop;
  const textAreaWidth = areaW - paddingLeft * 2;

  // Use standard font stack instead of computed fontFamily
  // Safari returns ".AppleSystemUIFont" which Canvas API cannot parse
  ctx.font = `${fontSize}px ${CANVAS_FONT_FAMILY}`;
  ctx.fillStyle = '#ffffff';
  ctx.textBaseline = 'top';

  const lines = wrapText(ctx, text, textAreaWidth);
  for (let i = 0; i < lines.length; i++) {
    ctx.fillText(lines[i], paddingLeft, paddingTop + i * lineHeight);
  }

  // Read pixel data and collect positions where text exists
  const imageData = ctx.getImageData(0, 0, scaledW, scaledH);
  const pixels = imageData.data;
  const positions: Array<{ x: number; y: number }> = [];

  for (let py = 0; py < scaledH; py += SAMPLE_STEP) {
    for (let px = 0; px < scaledW; px += SAMPLE_STEP) {
      const idx = (py * scaledW + px) * 4;
      if (pixels[idx + 3] > 30) {
        positions.push({ x: px / dpr, y: py / dpr });
      }
    }
  }

  // Cleanup offscreen canvas
  offscreen.width = 0;
  offscreen.height = 0;

  // Cap at MAX_PARTICLES via random subsampling
  if (positions.length > MAX_PARTICLES) {
    // Fisher-Yates partial shuffle
    for (let i = positions.length - 1; i > 0 && i >= positions.length - MAX_PARTICLES; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [positions[i], positions[j]] = [positions[j], positions[i]];
    }
    positions.length = MAX_PARTICLES;
  }

  return positions;
}

// -- Component -----------------------------------------------------------

export const BurnThoughtWidget = memo(function BurnThoughtWidget({ onClose }: BurnThoughtWidgetProps) {
  const { t, isRTL } = useLanguage();
  const ts = (t as unknown as Record<string, string>) ?? {};
  const [text, setText] = useState('');
  const [burned, setBurned] = useState(false);
  const [burning, setBurning] = useState(false);
  const [collapsing, setCollapsing] = useState(false);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const rafRef = useRef(0);
  const closeTimerRef = useRef<ReturnType<typeof setTimeout>>();
  const hapticTimerRef = useRef<ReturnType<typeof setTimeout>>();
  const midHapticRef = useRef<ReturnType<typeof setTimeout>>();

  // -- Textarea auto-grow --
  useEffect(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = `${Math.min(el.scrollHeight, 200)}px`;
  }, [text]);

  // -- Thanos Snap dissolution --

  const startBurn = useCallback(() => {
    if (!text.trim() || burning) return;

    // Dismiss iOS virtual keyboard before animation
    textareaRef.current?.blur();

    // Haptic: burn initiation (Beat 1 - the decision)
    void hapticWarning();

    // Reduced motion: skip animation entirely
    if (!shouldAnimate()) {
      setBurned(true);
      announceSuccess(ts.journalBurnReleasedMessage || 'Your thought has been released.');
      void hapticSuccess();
      return;
    }

    setBurning(true);

    // Fallback helper - instant release if canvas setup fails
    const instantRelease = () => {
      setBurned(true);
      setBurning(false);
      void hapticSuccess();
      announceSuccess(ts.journalBurnReleasedMessage || 'Your thought has been released.');
    };

    const container = containerRef.current;
    if (!container) { instantRelease(); return; }

    const canvas = canvasRef.current;
    if (!canvas) { instantRelease(); return; }

    const ctx = canvas.getContext('2d');
    if (!ctx) { instantRelease(); return; }

    // Size canvas to container
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

    // Sample text pixel positions
    const textareaEl = container.querySelector('textarea');
    let positions: Array<{ x: number; y: number }>;
    try {
      positions = sampleTextPixels(text, areaW, areaH, dpr, textareaEl);
    } catch {
      instantRelease();
      return;
    }

    // If no pixels sampled (edge case), instant release
    if (positions.length === 0) {
      instantRelease();
      return;
    }

    // Create particles with temperature-aware colors and upward release physics
    const particles: DustParticle[] = positions.map(pos => {
      const stripIndex = Math.floor((pos.x / areaW) * NUM_STRIPS);
      const normalizedStrip = isRTL ? (NUM_STRIPS - 1 - stripIndex) : stripIndex;
      const delay = VIBRATE_PHASE + normalizedStrip * (DISSOLVE_PHASE / NUM_STRIPS);
      const maxLife = 1200 + Math.random() * 1200; // longer life for slow release

      return {
        x: pos.x,
        y: pos.y,
        originX: pos.x,
        originY: pos.y,
        vx: 0,
        vy: 0,
        size: 1 + Math.random() * 2,
        alpha: 0.9,
        color: COLORS_HOT[Math.floor(Math.random() * COLORS_HOT.length)],
        ashColor: COLORS_ASH[Math.floor(Math.random() * COLORS_ASH.length)],
        glow: Math.random() < 0.2,
        rotation: Math.random() * Math.PI * 2,
        rotSpeed: (Math.random() - 0.5) * 2,
        life: 0,
        maxLife,
        delay,
        phase: Math.random() * Math.PI * 2,
        started: false,
      };
    });

    // Haptic at dissolution start (Beat 2 - the release)
    hapticTimerRef.current = setTimeout(() => { void hapticMedium(); }, VIBRATE_PHASE);

    // Midway gentle haptic (Beat 3 - the letting go)
    midHapticRef.current = setTimeout(() => { void hapticTap(); }, VIBRATE_PHASE + DISSOLVE_PHASE / 2);

    let lastTime = performance.now();
    const startTime = lastTime;

    function frame(now: number) {
      if (!ctx) return;
      const dt = Math.min((now - lastTime) / 1000, 0.05);
      const elapsed = now - startTime;
      lastTime = now;

      ctx.clearRect(0, 0, areaW, areaH);

      let alive = 0;

      for (let i = 0; i < particles.length; i++) {
        const p = particles[i];
        if (p.alpha <= 0) continue;

        // -- Phase 1: Vibrate in place (crescendo trembling) --
        if (!p.started) {
          if (elapsed < p.delay) {
            // Quadratic crescendo - starts subtle, builds to intense trembling
            const t = Math.min(1, elapsed / VIBRATE_PHASE);
            const trembleAmp = t * t * 4; // 0 -> 4px quadratic ramp
            p.x = p.originX + (Math.random() - 0.5) * trembleAmp;
            p.y = p.originY + (Math.random() - 0.5) * trembleAmp * 0.7;
            alive++;

            // Render as hot dot at text position
            ctx.globalAlpha = 0.9;
            ctx.fillStyle = p.color;
            ctx.beginPath();
            ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
            ctx.fill();
            continue;
          }

          // -- Activate: upward release velocity (like freeing a thought) --
          p.started = true;
          p.life = 0;
          // Upward cone: -130deg to -50deg (mostly upward with slight spread)
          const angle = -Math.PI / 2 + (Math.random() - 0.5) * Math.PI * 0.8;
          const speed = 15 + Math.random() * 40; // gentle, not explosive
          const windBias = isRTL ? -8 : 8; // subtle directional drift
          p.vx = Math.cos(angle) * speed + windBias;
          p.vy = Math.sin(angle) * speed; // no downward bias - float up
        }

        // -- Phase 2/3: Dissolving with temperature --
        p.life += dt * 1000;
        if (p.life >= p.maxLife) { p.alpha = 0; continue; }

        // Gentle wind drift (not chaotic wobble)
        p.vx += Math.sin(now * 0.002 + p.phase) * 5 * dt;

        // Slight upward pull - particles gently rise like released thoughts
        p.vy -= 8 * dt;

        // Move
        p.x += p.vx * dt;
        p.y += p.vy * dt;

        // Rotation
        p.rotation += p.rotSpeed * dt;

        // Alpha: quadratic ease-out fade
        const lifeT = p.life / p.maxLife;
        p.alpha = Math.max(0, 1 - lifeT * lifeT);

        // Size: very slow shrink (half the previous rate)
        p.size *= (1 - 0.0015 * (dt * 60));

        if (p.alpha <= 0.01 || p.size < 0.2) { p.alpha = 0; continue; }

        alive++;

        // Temperature-based color: hot ember -> cool ash
        const temp = 1 - Math.min(lifeT * 1.3, 1);
        const currentColor = temp > 0.35 ? p.color : p.ashColor;

        // -- Render glow halo (enhanced for hot particles) --
        if (p.glow) {
          ctx.globalAlpha = p.alpha * 0.3;
          ctx.shadowBlur = p.size * (temp > 0.5 ? 5 : 3);
          ctx.shadowColor = currentColor;
          ctx.fillStyle = currentColor;
          ctx.beginPath();
          ctx.arc(p.x, p.y, p.size * 2, 0, Math.PI * 2);
          ctx.fill();
          ctx.shadowBlur = 0;
        }

        // -- Render core particle --
        ctx.globalAlpha = p.alpha;
        ctx.fillStyle = currentColor;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
        ctx.fill();
      }

      ctx.globalAlpha = 1;

      // End condition: past total duration AND no alive particles
      if (elapsed > TOTAL_DURATION && alive === 0) {
        setBurning(false);
        setBurned(true);
        void hapticSuccess(); // Beat 4 - resolution
        announceSuccess(ts.journalBurnReleasedMessage || 'Your thought has been released.');
        return;
      }

      // Hard timeout safety
      if (elapsed > HARD_TIMEOUT) {
        setBurning(false);
        setBurned(true);
        void hapticSuccess();
        announceSuccess(ts.journalBurnReleasedMessage || 'Your thought has been released.');
        return;
      }

      rafRef.current = requestAnimationFrame(frame);
    }

    rafRef.current = requestAnimationFrame(frame);
  }, [text, burning, ts.journalBurnReleasedMessage, isRTL]);

  // -- Telegram-style collapse: burned -> serenity pause -> collapse -> close --
  useEffect(() => {
    if (burned && !collapsing) {
      closeTimerRef.current = setTimeout(() => {
        setCollapsing(true);
      }, RELEASED_PAUSE);
    }
    return () => { if (closeTimerRef.current) clearTimeout(closeTimerRef.current); };
  }, [burned, collapsing]);

  // -- Cleanup rAF + timers --
  useEffect(() => {
    return () => {
      cancelAnimationFrame(rafRef.current);
      if (closeTimerRef.current) clearTimeout(closeTimerRef.current);
      if (hapticTimerRef.current) clearTimeout(hapticTimerRef.current);
      if (midHapticRef.current) clearTimeout(midHapticRef.current);
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
    return { opacity: 1, y: 0, scale: 1 };
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

  const hasText = text.trim().length > 0;
  const animate = shouldAnimate();
  const showAmbientEmbers = hasText && !burning && !burned && animate;

  return (
    <motion.div
      className="my-8 p-6 rounded-2xl relative overflow-hidden bg-surface-glass backdrop-blur-[var(--surface-glass-blur)] border border-[var(--surface-glass-border)] zen-shadow-soft"
      style={{ boxShadow: 'inset 0 0 60px rgba(239, 68, 68, 0.04), var(--zen-shadow-soft)' }}
      initial={{ opacity: 0, y: -16, scale: 0.97 }}
      animate={getAnimateProps()}
      exit={{ opacity: 0, height: 0, scaleY: 0.92, y: -8, marginTop: 0, marginBottom: 0, paddingTop: 0, paddingBottom: 0 }}
      transition={getTransition()}
      onAnimationComplete={() => {
        if (collapsing) onClose();
      }}
    >
      {/* Card burn glow - GPU-only opacity transition */}
      <div
        className="absolute inset-0 rounded-2xl pointer-events-none transition-opacity duration-500 ease-out"
        style={{
          boxShadow: 'inset 0 0 80px rgba(239, 68, 68, 0.1), 0 0 24px rgba(239, 68, 68, 0.12)',
          opacity: burning ? 1 : 0,
        }}
        aria-hidden="true"
      />

      {/* Ambient floating embers - visible when text is entered */}
      {showAmbientEmbers && (
        <div className="absolute inset-0 pointer-events-none overflow-hidden rounded-2xl" aria-hidden="true">
          {Array.from({ length: 8 }, (_, i) => (
            <span
              key={i}
              className="absolute w-1 h-1 rounded-full animate-burn-float-ember"
              style={{
                left: `${8 + (i * 12) % 84}%`,
                bottom: '-2px',
                animationDelay: `${i * 0.5}s`,
                backgroundColor: EMBER_AMBIENT[i % EMBER_AMBIENT.length],
              }}
            />
          ))}
        </div>
      )}

      {/* Rising embers during dissolution */}
      {burning && animate && (
        <div className="absolute inset-0 pointer-events-none overflow-hidden rounded-2xl z-[3]" aria-hidden="true">
          {Array.from({ length: 14 }, (_, i) => (
            <span
              key={i}
              className="absolute rounded-full animate-burn-rise-ember"
              style={{
                width: `${2 + (i % 3)}px`,
                height: `${2 + (i % 3)}px`,
                left: `${5 + (i * 7) % 88}%`,
                bottom: '5%',
                animationDelay: `${i * 0.15}s`,
                backgroundColor: COLORS_HOT[i % COLORS_HOT.length],
              }}
            />
          ))}
        </div>
      )}

      {/* Header */}
      <div className="flex items-center justify-between px-4 py-2">
        <div className={`flex items-center gap-2 ${burned ? 'text-muted-foreground/70' : 'text-red-400'}`}>
          <Flame className={`w-4 h-4 ${showAmbientEmbers ? 'animate-burn-flame-pulse' : ''}`} />
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
          <motion.div
            className="flex flex-col items-center gap-3 py-6"
            initial={{ opacity: 0, scale: 0.9 }}
            animate={collapsing ? { opacity: 0, y: -12 } : { opacity: 1, scale: 1 }}
            transition={collapsing ? { duration: 0.25 } : zenMotion.gentle}
            aria-live="polite"
          >
            {/* Animated check circle */}
            <div className="w-10 h-10 rounded-full bg-emerald-500/10 flex items-center justify-center">
              <svg
                viewBox="0 0 24 24"
                className="w-5 h-5 text-emerald-400"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path
                  d="M5 13l4 4L19 7"
                  style={animate ? {
                    strokeDasharray: 22,
                    strokeDashoffset: 22,
                    animation: 'burn-draw-check 0.5s ease-out 0.15s forwards',
                  } : undefined}
                />
              </svg>
            </div>
            <p className="text-sm text-muted-foreground/60">
              {ts.journalBurnReleasedMessage || 'Your thought has been released.'}
            </p>
          </motion.div>
        ) : (
          <div ref={containerRef} className="relative overflow-hidden">
            {/* Content - gradual opacity swap to particles during burning */}
            <motion.div
              animate={{ opacity: burning ? 0 : 1 }}
              transition={{ duration: TEXT_FADE_MS / 1000, ease: 'easeOut' }}
            >
              <textarea
                ref={textareaRef}
                value={text}
                onChange={(e) => setText(e.target.value)}
                placeholder={ts.journalBurnPlaceholder || 'Write what worries you...'}
                className={`w-full rounded-xl px-4 py-3 text-sm outline-none resize-none bg-white/[0.03] ring-1 ring-white/[0.06] focus:ring-red-500/20 placeholder:text-muted-foreground/40 transition-colors duration-150 ${burning ? 'text-orange-400/80' : 'text-foreground/90'}`}
                style={{ minHeight: 64, maxHeight: 200 }}
                rows={2}
                maxLength={500}
                disabled={burning}
                aria-label={ts.journalBurnPlaceholder || 'Write what worries you...'}
              />

              {/* Character counter */}
              {text.length > 0 && !burning && (
                <div className={`text-end text-xs mt-1 transition-opacity duration-200 ${text.length > 450 ? 'text-red-400/70' : 'text-muted-foreground/30'}`}>
                  {text.length}/500
                </div>
              )}

              {!burning && (
                <motion.button
                  whileTap={{ scale: 0.95 }}
                  onClick={startBurn}
                  disabled={!hasText}
                  className={`mt-3 w-full py-3 rounded-full text-sm font-medium transition-all flex items-center justify-center gap-2 min-h-[44px] ${hasText ? 'bg-red-500/15 text-red-300 ring-1 ring-red-500/20 hover:bg-red-500/20' : 'bg-white/[0.03] text-muted-foreground/50 ring-1 ring-white/[0.06]'} ${hasText && animate ? 'burn-glow-pulse-wrap' : ''}`}
                >
                  <Flame className="w-4 h-4" />
                  {ts.journalBurnAction || 'Burn it'}
                </motion.button>
              )}
            </motion.div>

            {/* Dust canvas - ALWAYS in DOM so ref is available synchronously.
                React 18 batches setState, so {burning && <canvas>} would make
                canvasRef.current null when startBurn() accesses it. */}
            <canvas
              ref={canvasRef}
              className="absolute inset-0 w-full h-full rounded-xl"
              style={{
                zIndex: 2,
                pointerEvents: 'none',
                opacity: burning ? 1 : 0,
              }}
              aria-hidden="true"
            />
          </div>
        )}
      </div>
    </motion.div>
  );
});

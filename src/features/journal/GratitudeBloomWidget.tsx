/**
 * GratitudeBloomWidget — Inline "plant gratitude" section for the journal editor.
 *
 * Seed-to-bloom growth animation (duality counterpart to BurnThoughtWidget):
 *   STATE MACHINE: IDLE → GROWING → BLOOMED → COLLAPSING → closed
 *
 *   GROWING uses Framer Motion (no Canvas needed — simpler than fire particles):
 *     Phase 1 (0-300ms):    Text fades, seed circle scales in (haptic tap)
 *     Phase 2 (300-800ms):  Stem grows upward, 2 leaves stagger in (haptic medium)
 *     Phase 3 (800-1200ms): Flower blooms — 5 petals rotate+scale, particle burst (haptic success)
 *
 *   BLOOMED: "Planted" text with gentle pulse (400ms pause).
 *   COLLAPSING: Telegram-style height collapse → onClose().
 *   FALLBACK: shouldAnimate() false → instant BLOOMED (no animation).
 *
 * Creates a GratitudeEntry via onPlant callback → triggers full gamification chain.
 * Validated via gratitudeTextSchema. Sanitized via sanitizeString.
 */

import { useState, useRef, useCallback, useEffect, memo } from 'react';
import { Sprout, X, Check } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { zenMotion, shouldAnimate } from '@/lib/animationUtils';
import { useLanguage } from '@/contexts/LanguageContext';
import { hapticTap, hapticMedium, hapticSuccess } from '@/lib/haptics';
import { announceSuccess } from '@/lib/a11y';
import { gratitudeTextSchema } from '@/lib/validation';
import { sanitizeString } from '@/lib/sanitize';
import { generateId, getToday } from '@/lib/utils';
import type { GratitudeEntry } from '@/types';

interface GratitudeBloomWidgetProps {
  onClose: () => void;
  onPlant: (entry: GratitudeEntry) => void;
}

// ── Botanical palette ────────────────────────────────────────────
const PETAL_COLORS = ['#f9a8d4', '#fda4af', '#fcd34d', '#a7f3d0', '#c4b5fd'] as const;
const LEAF_COLOR = '#34d399';  // emerald-400

// Pre-computed radial particle burst (12 particles, varied sizes)
const PARTICLES = Array.from({ length: 12 }, (_, i) => ({
  x: Math.cos((i / 12) * Math.PI * 2) * 44,
  y: Math.sin((i / 12) * Math.PI * 2) * 44,
  size: 4 + (i % 3) * 1.5,
  color: PETAL_COLORS[i % PETAL_COLORS.length],
}));

// ── Component ────────────────────────────────────────────────────

export const GratitudeBloomWidget = memo(function GratitudeBloomWidget({ onClose, onPlant }: GratitudeBloomWidgetProps) {
  const { t } = useLanguage();
  const ts = (t as unknown as Record<string, string>) ?? {};
  const [text, setText] = useState('');
  const [validationError, setValidationError] = useState<string | null>(null);
  const [planted, setPlanted] = useState(false);
  const [growing, setGrowing] = useState(false);
  const [collapsing, setCollapsing] = useState(false);

  const closeTimerRef = useRef<ReturnType<typeof setTimeout>>();
  const hapticTimerRef = useRef<ReturnType<typeof setTimeout>>();
  const hapticTimer2Ref = useRef<ReturnType<typeof setTimeout>>();
  const validationTimerRef = useRef<ReturnType<typeof setTimeout>>();

  // ── Plant action ──
  const handlePlant = useCallback(() => {
    if (!text.trim() || growing) return;

    // Validate
    const result = gratitudeTextSchema.safeParse(text.trim());
    if (!result.success) {
      const msg = text.trim().length > 500
        ? (ts.textTooLong || 'Text is too long')
        : (ts.invalidInput || 'Invalid input');
      setValidationError(msg);
      if (validationTimerRef.current) clearTimeout(validationTimerRef.current);
      validationTimerRef.current = setTimeout(() => setValidationError(null), 3000);
      return;
    }
    setValidationError(null);

    // Create entry
    const sanitized = sanitizeString(result.data);
    const entry: GratitudeEntry = {
      id: generateId(),
      text: sanitized,
      date: getToday(),
      timestamp: Date.now(),
    };

    // Haptic: initiation
    void hapticTap();

    // Reduced motion: skip animation
    if (!shouldAnimate()) {
      onPlant(entry);
      setPlanted(true);
      announceSuccess(ts.journalGratitudePlantedMsg || 'Your gratitude has been planted.');
      void hapticSuccess();
      return;
    }

    // Start growth animation
    setGrowing(true);
    onPlant(entry);

    // Phase 2 haptic (stem fully grown)
    hapticTimerRef.current = setTimeout(() => { void hapticMedium(); }, 600);

    // Phase 3 end (bloom + burst complete)
    hapticTimer2Ref.current = setTimeout(() => {
      setGrowing(false);
      setPlanted(true);
      void hapticSuccess();
      announceSuccess(ts.journalGratitudePlantedMsg || 'Your gratitude has been planted.');
    }, 1500);
  }, [text, growing, ts.textTooLong, ts.invalidInput, ts.journalGratitudePlantedMsg, onPlant]);

  // ── Telegram-style collapse: planted → pause → collapse → close ──
  useEffect(() => {
    if (planted && !collapsing) {
      closeTimerRef.current = setTimeout(() => setCollapsing(true), 400);
    }
    return () => { if (closeTimerRef.current) clearTimeout(closeTimerRef.current); };
  }, [planted, collapsing]);

  // ── Cleanup timers ──
  useEffect(() => {
    return () => {
      if (closeTimerRef.current) clearTimeout(closeTimerRef.current);
      if (hapticTimerRef.current) clearTimeout(hapticTimerRef.current);
      if (hapticTimer2Ref.current) clearTimeout(hapticTimer2Ref.current);
      if (validationTimerRef.current) clearTimeout(validationTimerRef.current);
    };
  }, []);

  // ── Collapse/animate props (mirrors BurnThoughtWidget) ──
  const getAnimateProps = () => {
    if (collapsing) {
      return {
        opacity: 0, height: 0, scaleY: 0.92, y: -8,
        marginTop: 0, marginBottom: 0, paddingTop: 0, paddingBottom: 0,
      };
    }
    return { opacity: 1, y: 0, scale: 1 };
  };

  const getTransition = () => {
    if (collapsing) return { duration: 0.55, ease: [0.32, 0.72, 0, 1] as const };
    if (planted) return { duration: 0.3, ease: 'easeOut' as const };
    return zenMotion.gentle;
  };

  return (
    <motion.div
      className="my-8 p-6 rounded-2xl relative overflow-hidden bg-surface-glass backdrop-blur-[var(--surface-glass-blur)] border border-[var(--surface-glass-border)] zen-shadow-soft"
      style={{ boxShadow: 'inset 0 0 60px rgba(52, 211, 153, 0.04), var(--zen-shadow-soft)' }}
      initial={{ opacity: 0, y: -16, scale: 0.97 }}
      animate={getAnimateProps()}
      exit={{ opacity: 0, height: 0, scaleY: 0.92, y: -8, marginTop: 0, marginBottom: 0, paddingTop: 0, paddingBottom: 0 }}
      transition={getTransition()}
      onAnimationComplete={() => { if (collapsing) onClose(); }}
    >
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-2">
        <div className={`flex items-center gap-2 ${planted ? 'text-muted-foreground/70' : 'text-emerald-400'}`}>
          <Sprout className="w-4 h-4" />
          <span className="text-sm font-medium">
            {planted ? (ts.journalGratitudePlanted || 'Planted') : (ts.journalGratitudeTitle || 'Plant gratitude')}
          </span>
        </div>
        {!planted && !growing && (
          <motion.button
            whileTap={{ scale: 0.92 }}
            onClick={onClose}
            className="min-w-[44px] min-h-[44px] flex items-center justify-center rounded-full"
            aria-label={ts.close || 'Close'}
          >
            <X className="w-3.5 h-3.5 text-emerald-400/60" />
          </motion.button>
        )}
      </div>

      {/* Body */}
      <div className="relative px-4 pb-4">
        {planted ? (
          /* ── Planted state ── */
          <motion.div
            className="flex flex-col items-center py-4 gap-2"
            initial={{ opacity: 0, scale: 0.9 }}
            animate={collapsing ? { opacity: 0, y: -12 } : { opacity: 1, scale: 1 }}
            transition={collapsing ? { duration: 0.25 } : zenMotion.gentle}
          >
            <motion.div
              className="w-10 h-10 rounded-full bg-emerald-500/20 flex items-center justify-center"
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              transition={{ type: 'spring', stiffness: 400, damping: 15 }}
            >
              <Check className="w-5 h-5 text-emerald-400" />
            </motion.div>
            <p className="text-sm text-muted-foreground/60" aria-live="polite">
              {ts.journalGratitudePlantedMsg || 'Your gratitude has been planted.'}
            </p>
          </motion.div>
        ) : growing ? (
          /* ── Growth animation — seed at bottom, bloom at top ── */
          <div className="flex items-center justify-center py-3" aria-live="polite">
            <div className="relative" style={{ width: 90, height: 140 }}>

              {/* Seed — pops in at bottom center */}
              <motion.div
                className="absolute rounded-full"
                style={{
                  width: 10, height: 10,
                  bottom: 0, left: '50%', marginLeft: -5,
                  background: 'radial-gradient(circle at 35% 35%, #d97706, #78350f)',
                  boxShadow: '0 0 10px 3px rgba(217, 119, 6, 0.35)',
                }}
                initial={{ scale: 0, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                transition={{ duration: 0.25, type: 'spring', stiffness: 500, damping: 18 }}
              />

              {/* Stem — grows UPWARD from seed (scaleY + origin-bottom) */}
              <motion.div
                className="absolute"
                style={{
                  width: 2.5, height: 115,
                  bottom: 8, left: '50%', marginLeft: -1.25,
                  background: 'linear-gradient(to top, #059669, #34d399, #6ee7b7)',
                  borderRadius: 2,
                  transformOrigin: 'center bottom',
                  boxShadow: '0 0 10px 2px rgba(52, 211, 153, 0.25)',
                }}
                initial={{ scaleY: 0 }}
                animate={{ scaleY: 1 }}
                transition={{ delay: 0.2, duration: 0.6, ease: [0.33, 1, 0.68, 1] }}
              />

              {/* Right leaf — sprouts from mid-stem */}
              <motion.div
                className="absolute"
                style={{
                  width: 14, height: 20,
                  bottom: 48, left: 'calc(50% + 3px)',
                  backgroundColor: LEAF_COLOR,
                  borderRadius: '50% 50% 0% 50%',
                  transformOrigin: 'bottom left',
                  rotate: 25,
                  boxShadow: '0 0 8px 1px rgba(52, 211, 153, 0.2)',
                }}
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                transition={{ delay: 0.5, type: 'spring', stiffness: 280, damping: 14 }}
              />

              {/* Left leaf — slightly higher, staggered */}
              <motion.div
                className="absolute"
                style={{
                  width: 12, height: 18,
                  bottom: 60, right: 'calc(50% + 3px)',
                  backgroundColor: LEAF_COLOR,
                  borderRadius: '50% 50% 50% 0%',
                  transformOrigin: 'bottom right',
                  rotate: -25,
                  boxShadow: '0 0 8px 1px rgba(52, 211, 153, 0.2)',
                }}
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                transition={{ delay: 0.62, type: 'spring', stiffness: 280, damping: 14 }}
              />

              {/* Flower — blooms at top of stem */}
              <div className="absolute" style={{ top: 14, left: '50%', marginLeft: 0 }}>
                {/* 5 Petals — teardrop shapes with radial gradient + glow */}
                {PETAL_COLORS.map((color, i) => (
                  <motion.div
                    key={i}
                    className="absolute"
                    style={{
                      width: 14, height: 22,
                      left: -7, top: -11,
                      background: `radial-gradient(ellipse at 50% 30%, ${color}ee, ${color}aa)`,
                      borderRadius: '50% 50% 50% 50% / 60% 60% 40% 40%',
                      transformOrigin: 'center bottom',
                      rotate: `${i * 72}deg`,
                      boxShadow: `0 0 10px 3px ${color}30`,
                    }}
                    initial={{ scale: 0, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    transition={{ delay: 0.85 + i * 0.07, type: 'spring', stiffness: 280, damping: 15 }}
                  />
                ))}

                {/* Center pistil — warm glow */}
                <motion.div
                  className="absolute z-10"
                  style={{
                    width: 10, height: 10,
                    left: -5, top: -5,
                    background: 'radial-gradient(circle at 38% 38%, #fde68a, #f59e0b)',
                    borderRadius: '50%',
                    boxShadow: '0 0 14px 4px rgba(251, 191, 36, 0.45)',
                  }}
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  transition={{ delay: 1.15, type: 'spring', stiffness: 400, damping: 14 }}
                />
              </div>

              {/* Particle burst — radiates from flower center */}
              {PARTICLES.map((p, i) => (
                <motion.div
                  key={`p-${i}`}
                  className="absolute rounded-full"
                  style={{
                    width: p.size, height: p.size,
                    top: 18, left: '50%', marginLeft: -(p.size / 2),
                    backgroundColor: p.color,
                    boxShadow: `0 0 4px 1px ${p.color}50`,
                  }}
                  initial={{ scale: 0, opacity: 0, x: 0, y: 0 }}
                  animate={{
                    scale: [0, 1.3, 0],
                    opacity: [0, 0.85, 0],
                    x: p.x,
                    y: p.y,
                  }}
                  transition={{ delay: 1.1 + i * 0.025, duration: 0.65, ease: 'easeOut' }}
                />
              ))}

            </div>
          </div>
        ) : (
          /* ── Idle state: textarea + plant button ── */
          <>
            <textarea
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder={ts.journalGratitudePlaceholder || 'What are you grateful for?'}
              className="w-full rounded-xl px-4 py-3 text-sm outline-none resize-none bg-white/[0.03] text-foreground/90 ring-1 ring-white/[0.06] focus:ring-emerald-500/20 placeholder:text-muted-foreground/40 transition-shadow"
              style={{ minHeight: 64 }}
              rows={2}
              maxLength={500}
              aria-label={ts.journalGratitudePlaceholder || 'What are you grateful for?'}
            />

            {/* Validation error */}
            <AnimatePresence>
              {validationError && (
                <motion.p
                  className="text-sm text-destructive mt-1"
                  role="alert"
                  initial={{ opacity: 0, y: -4 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0 }}
                >
                  {validationError}
                </motion.p>
              )}
            </AnimatePresence>

            <motion.button
              whileTap={{ scale: 0.95 }}
              onClick={handlePlant}
              disabled={!text.trim()}
              className={`mt-3 w-full py-3 rounded-full text-sm font-medium transition-all flex items-center justify-center gap-2 min-h-[44px] ${
                text.trim()
                  ? 'bg-emerald-500/15 text-emerald-300 ring-1 ring-emerald-500/20 hover:bg-emerald-500/20'
                  : 'bg-white/[0.03] text-muted-foreground/50 ring-1 ring-white/[0.06]'
              }`}
            >
              <Sprout className="w-4 h-4" />
              {ts.journalGratitudeAction || 'Plant it'}
            </motion.button>
          </>
        )}
      </div>
    </motion.div>
  );
});

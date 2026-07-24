/**
 * DiaryBreatheWidget — Inline 70×70px breathing circle for the diary editor.
 *
 * 8-second cycle: Inhale (3.5s) → Hold (1s) → Exhale (3.5s).
 * Phase text changes dynamically, haptic ticks at phase transitions.
 * Scale 1.0→1.6 with a user-controlled, resumable cycle.
 */

import { useState, useEffect, useRef, useCallback, memo } from 'react';
import { motion } from 'framer-motion';
import { Pause, Play } from 'lucide-react';
import { useLanguage } from '@/contexts/LanguageContext';
import { useShouldAnimate } from '@/hooks/useShouldAnimate';
import { hapticTap } from '@/lib/haptics';

type Phase = 'in' | 'hold' | 'out';

const CYCLE_MS = 8_000;
const INHALE_MS = 3_500;
const HOLD_END_MS = 4_500;

function getPhase(elapsedMs: number): Phase {
  if (elapsedMs < INHALE_MS) return 'in';
  if (elapsedMs < HOLD_END_MS) return 'hold';
  return 'out';
}

function getExpansion(elapsedMs: number): number {
  if (elapsedMs < INHALE_MS) {
    const progress = elapsedMs / INHALE_MS;
    return 0.5 - Math.cos(Math.PI * progress) / 2;
  }
  if (elapsedMs < HOLD_END_MS) return 1;
  const progress = (elapsedMs - HOLD_END_MS) / (CYCLE_MS - HOLD_END_MS);
  return 1 - (0.5 - Math.cos(Math.PI * progress) / 2);
}

interface DiaryBreatheWidgetProps {
  animate?: boolean;
  initiallyPaused?: boolean;
}

export const DiaryBreatheWidget = memo(function DiaryBreatheWidget({
  animate = true,
  initiallyPaused = false,
}: DiaryBreatheWidgetProps) {
  const { t } = useLanguage();
  const sharedMotionAllowed = useShouldAnimate();
  const [paused, setPaused] = useState(initiallyPaused);
  const canAnimate = animate && sharedMotionAllowed && !paused;
  const showPlaybackControl = animate && sharedMotionAllowed;
  const [phase, setPhase] = useState<Phase>('in');
  const [elapsedMs, setElapsedMs] = useState(0);
  const elapsedRef = useRef(0);
  const lastTickRef = useRef<number | null>(null);
  const prevPhaseRef = useRef<Phase>('in');

  const advanceCycle = useCallback((now: number, allowHaptic: boolean) => {
    const previousTick = lastTickRef.current;
    lastTickRef.current = now;
    if (previousTick === null) return;

    const delta = Math.max(0, now - previousTick);
    const nextElapsed = (elapsedRef.current + delta) % CYCLE_MS;
    const nextPhase = getPhase(nextElapsed);
    const previousPhase = prevPhaseRef.current;

    elapsedRef.current = nextElapsed;
    setElapsedMs(nextElapsed);
    if (nextPhase === previousPhase) return;

    if (
      allowHaptic &&
      delta <= 500 &&
      (nextPhase === 'hold' || (nextPhase === 'in' && previousPhase === 'out'))
    ) {
      void hapticTap();
    }
    prevPhaseRef.current = nextPhase;
    setPhase(nextPhase);
  }, []);

  useEffect(() => {
    if (!canAnimate) return undefined;
    lastTickRef.current = Date.now();
    const id = setInterval(() => {
      advanceCycle(Date.now(), true);
    }, 100);
    return () => {
      clearInterval(id);
      lastTickRef.current = null;
    };
  }, [advanceCycle, canAnimate]);

  const handlePlaybackToggle = useCallback(() => {
    if (paused) {
      lastTickRef.current = Date.now();
      setPaused(false);
      return;
    }
    advanceCycle(Date.now(), false);
    setPaused(true);
  }, [advanceCycle, paused]);

  const label = canAnimate
    ? phase === 'in'
      ? t.breatheIn
      : phase === 'hold'
        ? t.hold
        : t.breatheOut
    : t.breatheGently;

  const expansion = animate && sharedMotionAllowed ? getExpansion(elapsedMs) : 0;
  const glowAlpha = 0.3 + expansion * 0.3;

  return (
    <div className="mx-auto my-6 flex w-fit flex-col items-center gap-2">
    <motion.div
      className="flex h-[calc(4.375rem*var(--font-scale,1))] w-[calc(4.375rem*var(--font-scale,1))] items-center justify-center rounded-full border-2 border-emerald-500/60 bg-emerald-500/15"
      animate={{
        scale: 1 + expansion * 0.6,
        boxShadow: `0 0 ${25 + expansion * 25}px rgba(16, 185, 129, ${glowAlpha})`,
      }}
      transition={{ duration: canAnimate ? 0.1 : 0, ease: 'linear' }}
    >
      <motion.span
        key={canAnimate ? phase : 'gentle'}
        initial={canAnimate ? { opacity: 0 } : false}
        animate={{ opacity: 1 }}
        role={canAnimate ? undefined : 'status'}
        aria-live={canAnimate ? undefined : 'polite'}
        aria-atomic={canAnimate ? undefined : 'true'}
        className="max-w-full select-none whitespace-normal break-words px-2 text-center text-xs font-bold uppercase tracking-widest text-[var(--journal-paper-text,currentColor)]"
      >
        {label}
      </motion.span>
    </motion.div>
    {showPlaybackControl ? (
      <button
        type="button"
        onClick={handlePlaybackToggle}
        aria-label={paused ? t.journalBreatheResume : t.journalBreathePause}
        title={paused ? t.journalBreatheResume : t.journalBreathePause}
        className="flex h-[44px] w-[44px] touch-manipulation items-center justify-center rounded-full text-[var(--journal-paper-muted,currentColor)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/45"
      >
        {paused ? <Play className="h-4 w-4" aria-hidden="true" /> : <Pause className="h-4 w-4" aria-hidden="true" />}
      </button>
    ) : null}
    </div>
  );
});

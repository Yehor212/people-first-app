/**
 * DiaryBreatheWidget — Inline 70×70px breathing circle for the diary editor.
 *
 * 8-second cycle: Inhale (3.5s) → Hold (1s) → Exhale (3.5s).
 * Phase text changes dynamically, haptic ticks at phase transitions.
 * Scale 1.0→1.6, emerald glow pulse. Never stops while visible.
 */

import { useState, useEffect, useRef, memo } from 'react';
import { motion } from 'framer-motion';
import { useLanguage } from '@/contexts/LanguageContext';
import { hapticTap } from '@/lib/haptics';

type Phase = 'in' | 'hold' | 'out';

export const DiaryBreatheWidget = memo(function DiaryBreatheWidget() {
  const { t } = useLanguage();
  const [phase, setPhase] = useState<Phase>('in');
  const prevPhaseRef = useRef<Phase>('in');

  useEffect(() => {
    const start = Date.now();
    const id = setInterval(() => {
      const elapsed = ((Date.now() - start) / 1000) % 8;
      let next: Phase;
      if (elapsed < 3.5) next = 'in';
      else if (elapsed < 4.5) next = 'hold';
      else next = 'out';

      if (next !== prevPhaseRef.current) {
        // Haptic tick at inhale peak (in→hold) and exhale end (out→in)
        if (next === 'hold' || (next === 'in' && prevPhaseRef.current === 'out')) {
          void hapticTap();
        }
        prevPhaseRef.current = next;
        setPhase(next);
      }
    }, 200);
    return () => clearInterval(id);
  }, []);

  const label = phase === 'in' ? t.breatheIn : phase === 'hold' ? t.hold : t.breatheOut;

  return (
    <motion.div
      className="w-[70px] h-[70px] mx-auto my-6 rounded-full border-2 border-emerald-500/60 bg-emerald-500/15 flex items-center justify-center"
      animate={{
        scale: [1, 1.6, 1.6, 1],
        boxShadow: [
          '0 0 25px rgba(16, 185, 129, 0.3)',
          '0 0 50px rgba(16, 185, 129, 0.6)',
          '0 0 50px rgba(16, 185, 129, 0.6)',
          '0 0 25px rgba(16, 185, 129, 0.3)',
        ],
      }}
      transition={{
        duration: 8,
        repeat: Infinity,
        times: [0, 0.4375, 0.5625, 1],
        ease: 'easeInOut',
      }}
    >
      <motion.span
        key={phase}
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        className="text-emerald-400 text-[10px] font-bold tracking-widest select-none text-center uppercase"
      >
        {label}
      </motion.span>
    </motion.div>
  );
});

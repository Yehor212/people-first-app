import { useEffect } from 'react';
import { motion } from 'framer-motion';
import { useLanguage } from '@/contexts/LanguageContext';
import { zenMotion, shouldShowConfetti } from '@/lib/animationUtils';
import { haptics } from '@/lib/haptics';

interface SuccessAnimationProps {
  onComplete: () => void;
}

/** Circle container scales in with bouncy spring */
const circleDraw = {
  hidden: { scale: 0, opacity: 0 },
  visible: { scale: 1, opacity: 1, transition: zenMotion.bouncy },
};

/** Checkmark draws via pathLength with delayed bouncy spring */
const checkDraw = {
  hidden: { pathLength: 0, opacity: 0 },
  visible: {
    pathLength: 1,
    opacity: 1,
    transition: {
      pathLength: { ...zenMotion.bouncy, delay: 0.2 },
      opacity: { duration: 0.05 },
    },
  },
};

/**
 * Brief success confirmation after saving State of Mind entry.
 * Auto-dismisses after 1.2s.
 *
 * Visual Aesthetic Rule 7: Celebration purpose → bouncy + haptic.
 * Law 18 (Housekeeping): clearTimeout in cleanup.
 * Visual Aesthetic Rule 5: confetti gated by shouldShowConfetti().
 * Upgrade 4: SVG pathLength draw (like MiniCheckmarkCell pattern).
 */
export function SuccessAnimation({ onComplete }: SuccessAnimationProps) {
  const { t } = useLanguage();

  useEffect(() => {
    void haptics.success();
    const timer = setTimeout(onComplete, 1200);
    return () => clearTimeout(timer);
  }, [onComplete]);

  return (
    <div className="flex flex-col items-center justify-center gap-4 py-16">
      {/* Checkmark circle bounces in → 200ms pause → path draws with spring overshoot */}
      <motion.div
        variants={circleDraw}
        initial="hidden"
        animate="visible"
        className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center"
      >
        <svg width="32" height="32" viewBox="0 0 32 32" fill="none" aria-hidden="true">
          <motion.path
            d="M8 16.5 L13 21.5 L24 10.5"
            stroke="currentColor"
            strokeWidth={3}
            strokeLinecap="round"
            strokeLinejoin="round"
            className="text-primary"
            variants={checkDraw}
            initial="hidden"
            animate="visible"
          />
        </svg>
      </motion.div>

      {/* "Saved" text */}
      <motion.p
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ ...zenMotion.gentle, delay: 0.15 }}
        className="text-sm font-medium text-muted-foreground"
      >
        {t.somSaved}
      </motion.p>

      {/* Confetti (gated by dopamine settings) */}
      {shouldShowConfetti() && (
        <div className="fixed inset-0 pointer-events-none z-[60]" aria-hidden="true">
          {Array.from({ length: 12 }).map((_, i) => (
            <div
              key={i}
              className="absolute animate-confetti"
              style={{
                left: `${10 + Math.random() * 80}%`,
                top: '-5%',
                width: 8,
                height: 8,
                borderRadius: Math.random() > 0.5 ? '50%' : '2px',
                backgroundColor: `hsl(${Math.random() * 360}, 70%, 60%)`,
                animationDelay: `${Math.random() * 0.3}s`,
              }}
            />
          ))}
        </div>
      )}
    </div>
  );
}

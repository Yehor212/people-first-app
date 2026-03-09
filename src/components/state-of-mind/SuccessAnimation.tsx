import { useEffect } from 'react';
import { motion } from 'framer-motion';
import { useLanguage } from '@/contexts/LanguageContext';
import { zenMotion, shouldShowConfetti } from '@/lib/animationUtils';
import { haptics } from '@/lib/haptics';

interface SuccessAnimationProps {
  onComplete: () => void;
  /** Current valence — gates celebration intensity (no confetti for negative moods) */
  valence?: number;
}

/** Circle container: bouncy for positive, gentle for negative */
function circleDraw(isPositive: boolean) {
  return {
    hidden: { scale: 0, opacity: 0 },
    visible: { scale: 1, opacity: 1, transition: isPositive ? zenMotion.bouncy : zenMotion.gentle },
  };
}

/** Checkmark: bouncy overshoot for positive, gentle ease for negative */
function checkDraw(isPositive: boolean) {
  const spring = isPositive ? zenMotion.bouncy : zenMotion.gentle;
  return {
    hidden: { pathLength: 0, opacity: 0 },
    visible: {
      pathLength: 1,
      opacity: 1,
      transition: {
        pathLength: { ...spring, delay: 0.2 },
        opacity: { duration: 0.05 },
      },
    },
  };
}

/**
 * Brief success confirmation after saving State of Mind entry.
 * Auto-dismisses after 1.2s.
 *
 * Visual Aesthetic Rule 7: Celebration purpose → bouncy + haptic.
 * Law 18 (Housekeeping): clearTimeout in cleanup.
 * Visual Aesthetic Rule 5: confetti gated by shouldShowConfetti().
 * Upgrade 4: SVG pathLength draw (like MiniCheckmarkCell pattern).
 */
export function SuccessAnimation({ onComplete, valence = 0 }: SuccessAnimationProps) {
  const { t } = useLanguage();
  const isPositive = valence >= 0;

  useEffect(() => {
    // C2: Gentle haptic for negative moods, celebratory for positive
    void (isPositive ? haptics.moodSaved() : haptics.light());
    const timer = setTimeout(onComplete, 1200);
    return () => clearTimeout(timer);
  }, [onComplete, isPositive]);

  const circleVariants = circleDraw(isPositive);
  const checkVariants = checkDraw(isPositive);

  return (
    <div className="flex flex-col items-center justify-center gap-4 py-16">
      {/* Checkmark circle: bouncy for positive, gentle for negative */}
      <motion.div
        variants={circleVariants}
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
            variants={checkVariants}
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

      {/* Confetti: double-gated — dopamine settings AND positive valence only (C2) */}
      {isPositive && shouldShowConfetti() && (
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
                backgroundColor: ['hsl(152,68%,46%)', 'hsl(152,68%,66%)', 'hsl(234,56%,58%)', 'hsl(234,56%,78%)', 'hsl(45,80%,60%)'][Math.floor(Math.random() * 5)],
                animationDelay: `${Math.random() * 0.3}s`,
              }}
            />
          ))}
        </div>
      )}
    </div>
  );
}

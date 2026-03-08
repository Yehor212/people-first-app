import { useEffect } from 'react';
import { motion } from 'framer-motion';
import { Check } from 'lucide-react';
import { useLanguage } from '@/contexts/LanguageContext';
import { zenMotion, shouldShowConfetti } from '@/lib/animationUtils';
import { haptics } from '@/lib/haptics';

interface SuccessAnimationProps {
  onComplete: () => void;
}

/**
 * Brief success confirmation after saving State of Mind entry.
 * Auto-dismisses after 1.2s.
 *
 * Visual Aesthetic Rule 7: Celebration purpose → bouncy + haptic.
 * Law 18 (Housekeeping): clearTimeout in cleanup.
 * Visual Aesthetic Rule 5: confetti gated by shouldShowConfetti().
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
      {/* Checkmark with bounce */}
      <motion.div
        initial={{ scale: 0, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={zenMotion.bouncy}
        className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center"
      >
        <Check className="w-8 h-8 text-primary" />
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

      {/* Confetti (reuse existing ConfettiBurst if dopamine allows) */}
      {shouldShowConfetti() && (
        <div className="fixed inset-0 pointer-events-none z-[60]" aria-hidden="true">
          {/* Confetti particles via CSS animation */}
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
                animationDelay: `${Math.random() * 0.5}s`,
                animationDuration: `${0.7 + Math.random() * 0.4}s`,
              }}
            />
          ))}
        </div>
      )}
    </div>
  );
}

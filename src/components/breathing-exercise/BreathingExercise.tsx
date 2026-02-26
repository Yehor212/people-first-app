import { useState, useMemo, useCallback } from 'react';
import { X } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { cn } from '@/lib/utils';
import { useLanguage } from '@/contexts/LanguageContext';
import { useScrollLock } from '@/hooks/useScrollLock';
import { useModalA11y } from '@/hooks/useModalA11y';
import { BREATHING_PATTERNS, type BreathingPattern } from '@/lib/breathingPatterns';
import type { BreathingExerciseProps } from './types';
import { generateStars } from './types';
import { useBreathingEngine } from './useBreathingEngine';
import { CompactCard } from './CompactCard';
import { PatternSelector } from './PatternSelector';
import { CompletionView } from './CompletionView';
import { ActiveBreathingView } from './ActiveBreathingView';

export function BreathingExercise({ onComplete, compact = true }: BreathingExerciseProps) {
  const { t } = useLanguage();
  const [isOpen, setIsOpen] = useState(false);
  const [selectedPattern, setSelectedPattern] = useState<BreathingPattern>(BREATHING_PATTERNS[0]);

  useScrollLock(isOpen);

  const engine = useBreathingEngine({ selectedPattern, onComplete });

  const stars = useMemo(() => generateStars(20), []);

  const closeModal = useCallback(() => {
    engine.reset();
    setIsOpen(false);
  }, [engine]);

  useModalA11y(isOpen, closeModal);

  // Compact card
  if (compact && !isOpen) {
    return <CompactCard onOpen={() => setIsOpen(true)} t={t as unknown as Record<string, string>} />;
  }

  const tRecord = t as unknown as Record<string, string>;

  // Full modal
  return (
    <AnimatePresence>
      {(isOpen || !compact) && (
        <motion.div
          role="dialog"
          aria-modal="true"
          aria-labelledby="breathing-title"
          className="fixed inset-0 z-[60] flex items-center justify-center p-4"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
        >
          {/* Cosmic overlay */}
          <motion.div
            className="absolute inset-0"
            style={{
              background: `radial-gradient(ellipse at center,
                rgba(6, 182, 212, 0.1) 0%,
                rgba(0, 0, 0, 0.8) 50%,
                rgba(0, 0, 0, 0.9) 100%)`,
              backdropFilter: 'blur(8px)',
              WebkitBackdropFilter: 'blur(8px)',
            }}
            onClick={closeModal}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          />

          {/* Star particles */}
          <div className="absolute inset-0 pointer-events-none overflow-hidden">
            {stars.map((star) => (
              <motion.div
                key={star.id}
                className="absolute w-1 h-1 bg-cyan-400/60 rounded-full"
                style={{ left: `${star.left}%`, top: `${star.top}%` }}
                animate={{ opacity: [0.3, 0.8, 0.3], scale: [0.8, 1.2, 0.8] }}
                transition={{ duration: star.duration, repeat: Infinity, delay: star.delay }}
              />
            ))}
          </div>

          {/* Modal content */}
          <motion.div
            className={cn(
              "relative w-full max-w-sm rounded-3xl overflow-hidden",
              "bg-background/95 backdrop-blur-xl",
              "border border-border"
            )}
            style={{
              boxShadow: '0 0 40px rgba(6, 182, 212, 0.2), 0 25px 50px -12px rgba(0, 0, 0, 0.5)',
            }}
            initial={{ scale: 0.9, y: 20 }}
            animate={{ scale: 1, y: 0 }}
            exit={{ scale: 0.9, y: 20 }}
            transition={{ type: 'spring', stiffness: 300, damping: 30 }}
          >
            <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-cyan-500/50 to-transparent" />
            <div
              className="absolute top-0 left-1/2 -translate-x-1/2 w-48 h-24 pointer-events-none"
              style={{ background: 'radial-gradient(ellipse, rgba(6, 182, 212, 0.15) 0%, transparent 70%)' }}
            />

            <div className="relative z-10 p-4 sm:p-6">
              {/* Header */}
              <div className="flex items-center justify-between mb-6">
                <h2 id="breathing-title" className="text-xl font-bold text-foreground">
                  {t.breathingTitle || 'Breathing'}
                </h2>
                <motion.button
                  onClick={closeModal}
                  aria-label={t.close || 'Close'}
                  className={cn(
                    "p-2 rounded-xl transition-all",
                    "bg-muted border border-border",
                    "hover:bg-secondary"
                  )}
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                >
                  <X className="w-5 h-5" />
                </motion.button>
              </div>

              {!engine.isActive && engine.currentPhase !== 'complete' ? (
                <PatternSelector
                  patterns={BREATHING_PATTERNS}
                  selected={selectedPattern}
                  onSelect={setSelectedPattern}
                  onStart={engine.start}
                  t={tRecord}
                />
              ) : engine.currentPhase === 'complete' ? (
                <CompletionView onReset={engine.reset} t={tRecord} />
              ) : (
                <ActiveBreathingView
                  isActive={engine.isActive}
                  isPaused={engine.isPaused}
                  currentPhase={engine.currentPhase}
                  phaseTime={engine.phaseTime}
                  currentCycle={engine.currentCycle}
                  circleScale={engine.circleScale}
                  getPhaseDuration={engine.getPhaseDuration}
                  selectedPattern={selectedPattern}
                  onTogglePause={engine.togglePause}
                  onReset={engine.reset}
                  t={tRecord}
                />
              )}
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

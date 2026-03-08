import { motion, AnimatePresence } from 'framer-motion';
import { ArrowLeft, X } from 'lucide-react';
import { useLanguage } from '@/contexts/LanguageContext';
import { useModalKeyboard } from '@/hooks/useModalKeyboard';
import { zenMotion, zenTap } from '@/lib/animationUtils';
import { haptics } from '@/lib/haptics';
import { MorphingBlob } from './MorphingBlob';
import { ValenceSlider } from './ValenceSlider';
import { EmotionTagGrid } from './EmotionTagGrid';
import { ContextGrid } from './ContextGrid';
import { NoteStep } from './NoteStep';
import { SuccessAnimation } from './SuccessAnimation';
import { useStateOfMind } from './useStateOfMind';
import type { MoodEntry, MoodLogType } from '@/types';

interface StateOfMindModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (entry: MoodEntry) => void;
}

/** Step container: orchestrates child cascade, fast exit */
const stepContainer = {
  hidden: { opacity: 0 },
  visible: { opacity: 1, transition: { staggerChildren: 0.06, delayChildren: 0.08 } },
  exit: { opacity: 0, x: -40, transition: zenMotion.exit },
};

/** Step child: each sub-element fades + slides up */
const stepChild = {
  hidden: { opacity: 0, y: 12 },
  visible: { opacity: 1, y: 0, transition: zenMotion.gentle },
};

/**
 * Full-screen modal orchestrator for State of Mind flow.
 * State machine: slider → emotionTags → contexts → note → saving → saved.
 *
 * Law 10 (Cross-Platform): safe area insets, -webkit-backdrop-filter, dvh.
 * Law 9 (a11y): focus management, Escape to close, semantic buttons.
 * Visual Aesthetic: zenMotion tokens, glassmorphism backdrop, 8pt grid.
 */
export function StateOfMindModal({ isOpen, onClose, onSave }: StateOfMindModalProps) {
  const { t } = useLanguage();
  const som = useStateOfMind({ isOpen, onClose, onSave });

  // Law 9 (a11y): Focus trap + Escape key + focus restoration
  // Note: Android back button handled in useStateOfMind with step-aware navigation
  const { modalRef, handleKeyDown: trapKeyDown } = useModalKeyboard({
    isOpen,
    onClose: som.handleClose,
    closeOnEscape: true,
    trapFocus: true,
    restoreFocus: true,
  });

  const stepTitle: Record<string, string> = {
    slider: t.somHowAreYouFeeling,
    emotionTags: t.somWhatDescribes,
    contexts: t.somWhatInfluencing,
    note: t.somAddNote,
  };

  const isLastStep = som.step === 'note';
  const showNavigation = som.step !== 'saving' && som.step !== 'saved';

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Backdrop */}
          <motion.div
            className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50"
            style={{ WebkitBackdropFilter: 'blur(4px)' }}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={zenMotion.exit}
            onClick={som.handleClose}
            aria-hidden="true"
          />

          {/* Modal content */}
          <motion.div
            ref={modalRef}
            className="fixed inset-0 z-50 flex flex-col bg-background/95"
            style={{
              paddingTop: 'max(env(safe-area-inset-top, 0px), 12px)',
              paddingBottom: 'max(env(safe-area-inset-bottom, 0px), 12px)',
            }}
            initial={{ opacity: 0, scale: 0.92, y: 16 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.92, y: 16 }}
            transition={zenMotion.gentle}
            role="dialog"
            aria-modal="true"
            aria-label={t.somHowAreYouFeeling}
            onKeyDown={trapKeyDown}
          >
            {/* Header */}
            {showNavigation && (
              <div className="flex items-center justify-between px-4 py-3">
                {som.step !== 'slider' ? (
                  <motion.button
                    type="button"
                    whileTap={zenTap.icon}
                    onClick={som.handleBack}
                    className="w-11 h-11 flex items-center justify-center rounded-full hover:bg-muted/50 focus:outline-none focus:ring-2 focus:ring-primary/50"
                    aria-label={t.back}
                  >
                    <ArrowLeft className="w-5 h-5 text-foreground rtl:scale-x-[-1]" />
                  </motion.button>
                ) : (
                  <div className="w-11" />
                )}

                <h2 className="text-base font-semibold text-foreground">
                  {stepTitle[som.step] || ''}
                </h2>

                <motion.button
                  type="button"
                  whileTap={zenTap.icon}
                  onClick={som.handleClose}
                  className="w-11 h-11 flex items-center justify-center rounded-full hover:bg-muted/50 focus:outline-none focus:ring-2 focus:ring-primary/50"
                  aria-label={t.close}
                >
                  <X className="w-5 h-5 text-muted-foreground" />
                </motion.button>
              </div>
            )}

            {/* Step content */}
            <div className="flex-1 overflow-y-auto px-4">
              <AnimatePresence mode="wait" initial={false}>
                <motion.div
                  key={som.step}
                  variants={stepContainer}
                  initial="hidden"
                  animate="visible"
                  exit="exit"
                  className="flex-1 flex flex-col"
                >
                  {som.step === 'slider' && (
                    <div className="flex flex-col items-center gap-6 pt-8">
                      <motion.div variants={stepChild}>
                        <LogTypeToggle value={som.logType} onChange={som.setLogType} />
                      </motion.div>
                      <motion.div variants={stepChild}>
                        <MorphingBlob valence={som.valence} size={192} />
                      </motion.div>
                      <motion.div variants={stepChild} className="w-full max-w-sm">
                        <ValenceSlider value={som.valence} onChange={som.setValence} />
                      </motion.div>
                    </div>
                  )}

                  {som.step === 'emotionTags' && (
                    <motion.div variants={stepChild} className="pt-4">
                      <EmotionTagGrid
                        valence={som.valence}
                        selected={som.emotionTags}
                        onToggle={som.handleToggleEmotionTag}
                      />
                    </motion.div>
                  )}

                  {som.step === 'contexts' && (
                    <motion.div variants={stepChild} className="pt-4">
                      <ContextGrid
                        selected={som.contexts}
                        onToggle={som.handleToggleContext}
                      />
                    </motion.div>
                  )}

                  {som.step === 'note' && (
                    <motion.div variants={stepChild} className="pt-4">
                      <NoteStep value={som.note} onChange={som.setNote} />
                    </motion.div>
                  )}

                  {(som.step === 'saving' || som.step === 'saved') && (
                    <SuccessAnimation onComplete={som.handleSavedComplete} />
                  )}
                </motion.div>
              </AnimatePresence>
            </div>

            {/* Footer with Next/Done button */}
            {showNavigation && (
              <div className="px-4 py-4">
                <motion.button
                  type="button"
                  whileTap={zenTap.button}
                  onClick={() => {
                    void haptics.light();
                    if (isLastStep) som.handleSave(); else som.handleNext();
                  }}
                  className="w-full py-3.5 rounded-xl bg-primary text-primary-foreground font-medium text-base focus:outline-none focus:ring-2 focus:ring-primary/50 focus:ring-offset-2"
                >
                  {isLastStep ? t.somDone : t.somNext}
                </motion.button>
              </div>
            )}
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}

/** Momentary vs Overall toggle */
function LogTypeToggle({ value, onChange }: { value: MoodLogType; onChange: (v: MoodLogType) => void }) {
  const { t } = useLanguage();

  return (
    <div className="flex gap-2 p-1 rounded-xl bg-muted/50 ring-1 ring-black/5 dark:ring-white/10">
      {(['momentary', 'overall'] as const).map((type) => (
        <motion.button
          key={type}
          type="button"
          whileTap={zenTap.button}
          animate={{ scale: value === type ? 1 : 0.97 }}
          transition={zenMotion.snappy}
          onClick={() => onChange(type)}
          className={[
            'px-4 py-2 rounded-lg text-sm font-medium transition-colors',
            'focus:outline-none focus:ring-2 focus:ring-primary/50',
            value === type
              ? 'bg-card text-foreground shadow-zen-xs'
              : 'text-muted-foreground',
          ].join(' ')}
        >
          {type === 'momentary' ? t.somMomentaryEmotion : t.somOverallMood}
        </motion.button>
      ))}
    </div>
  );
}

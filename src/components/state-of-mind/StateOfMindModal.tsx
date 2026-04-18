import { motion, AnimatePresence } from "framer-motion";
import { ArrowLeft, X, Clock, CalendarDays } from "lucide-react";
import { useLanguage } from "@/contexts/LanguageContext";
import { useBackHandler } from "@/hooks/useBackHandler";
import { useModalKeyboard } from "@/hooks/useModalKeyboard";
import { zenMotion, zenTap } from "@/lib/animationUtils";
import { haptics } from "@/lib/haptics";
import { valenceToColor } from "./colorUtils";
import { ValenceOrb } from "./ValenceOrb";
import { MoodSliderV2 } from "@/pages/nav-v2/MoodSliderV2";
import { EmotionTagGrid } from "./EmotionTagGrid";
import { ContextGrid } from "./ContextGrid";
import { NoteStep } from "./NoteStep";
import { useStateOfMind } from "./useStateOfMind";
import type { MoodEntry } from "@/types";

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
 * State machine: typeSelect → valence → emotionTags → contextsAndNote → saving.
 *
 * Law 10 (Cross-Platform): safe area insets, -webkit-backdrop-filter, dvh.
 * Law 9 (a11y): focus management, Escape to close, semantic buttons.
 * Visual Aesthetic: zenMotion tokens, glassmorphism backdrop, 8pt grid.
 */
export function StateOfMindModal({ isOpen, onClose, onSave }: StateOfMindModalProps) {
  const { t } = useLanguage();
  const som = useStateOfMind({ isOpen, onClose, onSave });

  // Law 10 (Cross-Platform): Android hardware back button closes modal
  useBackHandler(isOpen, som.handleClose);

  // Law 9 (a11y): Focus trap + Escape key + focus restoration
  const { modalRef, handleKeyDown: trapKeyDown } = useModalKeyboard({
    isOpen,
    onClose: som.handleClose,
    closeOnEscape: true,
    trapFocus: true,
    restoreFocus: true,
  });

  const stepTitle: Record<string, string> = {
    typeSelect: t.somLogFeeling,
    valence: t.somHowAreYouFeeling,
    emotionTags: t.somWhatDescribes,
    contextsAndNote: t.somContextsAndNote,
  };

  const isLastStep = som.step === "contextsAndNote";
  const showNavigation = som.step !== "saving";
  const showFooterButton = som.step !== "typeSelect" && som.step !== "saving";

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Backdrop */}
          <motion.div
            className="fixed inset-0 bg-black/40 backdrop-blur-sm z-[60] [-webkit-backdrop-filter:blur(4px)]"
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
            className="fixed inset-0 z-[60] flex flex-col bg-background/95 pt-[max(env(safe-area-inset-top,0px),12px)] pb-[max(env(safe-area-inset-bottom,0px),12px)] md:mx-auto md:my-6 md:max-w-2xl md:rounded-2xl md:shadow-2xl"
            initial={{ opacity: 0, scale: 0.92, y: 16 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.92, y: 16 }}
            transition={zenMotion.gentle}
            role="dialog"
            aria-modal="true"
            aria-label={t.somHowAreYouFeeling}
            onKeyDown={trapKeyDown}
          >
            {/* Immersive background color wash — radial gradient centered on blob */}
            <div
              className="absolute inset-0 pointer-events-none"
              style={{
                background: `radial-gradient(circle at 50% 32%, ${valenceToColor(som.valence, 0.22)}, ${valenceToColor(som.valence, 0.08)})`,
                transition: "background 300ms ease-out",
              }}
              aria-hidden="true"
            />

            {/* Header */}
            {showNavigation && (
              <div className="flex items-center justify-between px-4 py-3 flex-shrink-0">
                {som.step !== "typeSelect" ? (
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
                  {stepTitle[som.step] || ""}
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
            <div className="flex-1 overflow-y-auto px-4 min-h-0">
              <AnimatePresence mode="wait" initial={false}>
                <motion.div
                  key={som.step}
                  variants={stepContainer}
                  initial="hidden"
                  animate="visible"
                  exit="exit"
                  className="flex-1 flex flex-col h-full"
                >
                  {/* Step: Type Selection — two large cards */}
                  {som.step === "typeSelect" && (
                    <div className="flex flex-col gap-4 pt-8 pb-4">
                      <motion.button
                        type="button"
                        variants={stepChild}
                        whileTap={zenTap.button}
                        onClick={() => {
                          void haptics.light();
                          som.handleSelectType("momentary");
                        }}
                        className="flex items-start gap-4 p-5 rounded-2xl bg-card ring-1 ring-black/5 dark:ring-white/10 text-start focus:outline-none focus:ring-2 focus:ring-primary/50"
                      >
                        <div className="w-11 h-11 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
                          <Clock className="w-5 h-5 text-primary" />
                        </div>
                        <div className="flex flex-col gap-1">
                          <span className="text-base font-semibold text-foreground">
                            {t.somMomentaryTitle}
                          </span>
                          <span className="text-sm text-muted-foreground">
                            {t.somMomentarySubtitle}
                          </span>
                        </div>
                      </motion.button>

                      <motion.button
                        type="button"
                        variants={stepChild}
                        whileTap={zenTap.button}
                        onClick={() => {
                          void haptics.light();
                          som.handleSelectType("overall");
                        }}
                        className="flex items-start gap-4 p-5 rounded-2xl bg-card ring-1 ring-black/5 dark:ring-white/10 text-start focus:outline-none focus:ring-2 focus:ring-primary/50"
                      >
                        <div className="w-11 h-11 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
                          <CalendarDays className="w-5 h-5 text-primary" />
                        </div>
                        <div className="flex flex-col gap-1">
                          <span className="text-base font-semibold text-foreground">
                            {t.somOverallTitle}
                          </span>
                          <span className="text-sm text-muted-foreground">
                            {t.somOverallSubtitle}
                          </span>
                        </div>
                      </motion.button>
                    </div>
                  )}

                  {/* Step: Valence — blob + slider centered */}
                  {som.step === "valence" && (
                    <div className="flex flex-col items-center justify-center flex-1 gap-6">
                      <motion.div variants={stepChild} className="relative">
                        {/* CSS blur backdrop — GPU-accelerated immersive color wash behind orb */}
                        {/* Radial gradient glow — no blur-[60px] to avoid rectangular haze artifact */}
                        <div
                          className="absolute inset-0 pointer-events-none scale-[1.8] transition-[background] duration-300 ease-out"
                          style={{
                            background: `radial-gradient(circle, ${valenceToColor(som.valence, 0.35)} 0%, ${valenceToColor(som.valence, 0.15)} 40%, transparent 70%)`,
                          }}
                          aria-hidden="true"
                        />
                        <ValenceOrb valence={som.valence} size={280} />
                      </motion.div>
                      <motion.div variants={stepChild} className="w-full max-w-sm">
                        <MoodSliderV2
                          value={som.valence}
                          onDraft={som.setValence}
                          onCommit={som.setValence}
                        />
                      </motion.div>
                    </div>
                  )}

                  {/* Step: Emotion Tags */}
                  {som.step === "emotionTags" && (
                    <motion.div variants={stepChild} className="pt-4">
                      <EmotionTagGrid
                        valence={som.valence}
                        selected={som.emotionTags}
                        onToggle={som.handleToggleEmotionTag}
                      />
                    </motion.div>
                  )}

                  {/* Step: Contexts + Note (merged) */}
                  {som.step === "contextsAndNote" && (
                    <motion.div variants={stepChild} className="pt-4 flex flex-col gap-6">
                      <ContextGrid selected={som.contexts} onToggle={som.handleToggleContext} />
                      <NoteStep value={som.note} onChange={som.setNote} />
                    </motion.div>
                  )}
                </motion.div>
              </AnimatePresence>
            </div>

            {/* Footer with Next/Done button — always visible */}
            {showFooterButton && (
              <div className="px-4 py-4 flex-shrink-0">
                <motion.button
                  type="button"
                  whileTap={zenTap.button}
                  onClick={() => {
                    void haptics.light();
                    if (isLastStep) som.handleSave();
                    else som.handleNext();
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

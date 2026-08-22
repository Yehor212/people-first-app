import { useState } from "react";
import { motion } from "framer-motion";
import { X, Sparkles, PenLine } from "lucide-react";
import { cn } from "@/lib/utils";
import { useLanguage } from "@/contexts/LanguageContext";
import { zenMotion, zenTap } from "@/lib/animationUtils";
import { useModalKeyboard } from "@/hooks/useModalKeyboard";
import { CosmicStar, cosmicStars } from "@/components/cosmic/CosmicStarField";

/**
 * Theme-aware particle — CSS switches animation via .dark ancestor:
 *   Day:   zen-mote-float  — gentle upward drift (dust in sunbeam)
 *   Night: zen-star-twinkle — pulse in place (distant stars)
 * Only transform + opacity → GPU compositor, 60fps.
 */
// Generate stars for background (shared with FocusTimer)
interface FocusReflectionModalProps {
  reflectionValue: number | null;
  onSelectValue: (value: number) => void;
  onSave: (value: number | null) => void;
  onDismiss: () => void;
  onCancel: () => void;
  onExpandToJournal?: () => void; // IA Blueprint Phase 3: Focus → Journal expansion
}

export function FocusReflectionModal({
  reflectionValue,
  onSelectValue,
  onSave,
  onDismiss,
  onCancel,
  onExpandToJournal,
}: FocusReflectionModalProps) {
  const { t } = useLanguage();
  const [isSaving, setIsSaving] = useState(false);
  const { modalRef, handleKeyDown } = useModalKeyboard({
    isOpen: true,
    onClose: onCancel,
  });

  return (
    <>
      {/* Desktop backdrop */}
      <div
        className="hidden md:block fixed inset-0 z-[59] bg-black/60 backdrop-blur-sm [-webkit-backdrop-filter:blur(4px)]"
        onClick={onDismiss}
        aria-hidden="true"
      />
      <motion.div
        ref={modalRef}
        className="fixed inset-0 z-[60] flex items-center justify-center overflow-y-auto overscroll-contain bg-black/60 ps-[max(1rem,var(--safe-inline-start))] pe-[max(1rem,var(--safe-inline-end))] pb-[max(1rem,var(--safe-bottom))] pt-[max(1rem,var(--safe-top))] backdrop-blur-sm md:mx-auto md:my-6 md:max-w-lg md:rounded-2xl md:shadow-2xl"
        role="dialog"
        aria-modal="true"
        aria-label={t.ariaFocusReflection}
        onKeyDown={handleKeyDown}
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        onClick={(e) => {
          if (e.target === e.currentTarget) {
            onDismiss();
          }
        }}
      >
      <motion.div
        className="relative max-h-[calc(100dvh-var(--safe-top)-var(--safe-bottom)-2rem)] w-full max-w-xs overflow-x-hidden overflow-y-auto overscroll-contain rounded-2xl sm:max-w-sm"
        initial={{ scale: 0.9, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={zenMotion.gentle}
      >
        {/* Premium background — Sun-Dappled Meadow (light) / Cosmic (dark) */}
        <div className="absolute inset-0 bg-gradient-to-b from-amber-50 via-sky-50 to-indigo-50 dark:bg-none" />
        <div
          className="absolute inset-0 hidden dark:block"
          style={{
            background: `radial-gradient(ellipse at top,
              hsl(var(--focus-cosmic-dark)) 0%, hsl(var(--focus-cosmic-mid)) 60%, hsl(var(--focus-cosmic-deep)) 100%)`,
          }}
        />
        {/* Star particles */}
        {cosmicStars.slice(0, 8).map((star) => (
          <CosmicStar key={star.id} {...star} />
        ))}

        <div className="relative p-6">
          {/* Close button */}
          <button
            onClick={onDismiss}
            className="absolute top-3 end-3 flex min-h-[44px] min-w-[44px] items-center justify-center rounded-lg bg-secondary text-slate-600 hover:bg-secondary/80 hover:text-slate-800 motion-safe:transition-colors dark:text-white/60 dark:hover:text-white"
            aria-label={t.close}
          >
            <X className="w-4 h-4" />
          </button>

          <div className="flex items-center gap-2 mb-2">
            <Sparkles className="w-5 h-5 text-violet-600 dark:text-violet-400" />
            <h4 className="min-w-0 break-words hyphens-manual pe-10 text-lg font-semibold text-slate-800 dark:text-white">
              {t.focusReflectionTitle}
            </h4>
          </div>
          <p className="mt-1 break-words hyphens-manual text-sm text-slate-600 dark:text-white/60">
            {t.focusReflectionQuestion}
          </p>

          <div className="flex justify-between mt-5">
            {[1, 2, 3, 4, 5].map((value) => {
              const isSelected = reflectionValue === value;
              const colors = [
                "from-red-500 to-red-600",
                "from-orange-500 to-orange-600",
                "from-amber-500 to-amber-600",
                "from-emerald-500 to-emerald-600",
                "from-violet-500 to-violet-600",
              ];
              return (
                <motion.button
                  key={value}
                  onClick={() => onSelectValue(value)}
                  className={cn(
                    "w-11 h-11 rounded-full text-sm font-bold motion-safe:transition-all",
                    isSelected
                      ? `bg-gradient-to-br ${colors[value - 1]} text-white shadow-[0_0_16px_hsl(var(--focus-violet)/0.5)]`
                      : "bg-secondary text-muted-foreground hover:bg-secondary/80 hover:text-foreground"
                  )}
                  whileHover={{ scale: 1.1 }}
                  whileTap={zenTap.button}
                >
                  {value}
                </motion.button>
              );
            })}
          </div>

          <div className="mt-6 flex flex-col gap-2 min-[360px]:flex-row">
            <motion.button
              onClick={onDismiss}
              className="min-h-[44px] h-auto min-w-0 flex-1 whitespace-normal break-words hyphens-manual rounded-xl bg-secondary py-3 font-medium text-muted-foreground hover:bg-secondary/80 hover:text-foreground motion-safe:transition-colors"
              whileTap={zenTap.card}
            >
              {t.focusReflectionSkip}
            </motion.button>
            <motion.button
              onClick={() => {
                if (isSaving) return;
                setIsSaving(true);
                onSave(reflectionValue);
              }}
              disabled={isSaving}
              className={cn(
                "min-h-[44px] h-auto min-w-0 flex-1 whitespace-normal break-words hyphens-manual rounded-xl bg-gradient-to-r from-violet-500 to-purple-600 py-3 font-medium text-white",
                "shadow-[0_0_16px_hsl(var(--focus-violet)/0.4)]",
                isSaving && "opacity-50 cursor-not-allowed"
              )}
              whileHover={isSaving ? {} : { scale: 1.02 }}
              whileTap={isSaving ? {} : zenTap.card}
            >
              {t.focusReflectionSave}
            </motion.button>
          </div>

          {/* Focus → Journal expansion (IA Blueprint Phase 3) */}
          {onExpandToJournal && (
            <button
              disabled={isSaving}
              onClick={() => {
                if (isSaving) return;
                setIsSaving(true);
                onSave(reflectionValue);
                onExpandToJournal();
              }}
              className="mt-3 flex min-h-[44px] h-auto w-full items-center justify-center gap-2 whitespace-normal break-words hyphens-manual rounded-xl py-2.5 text-sm font-medium text-violet-600 hover:bg-violet-50 motion-safe:transition-colors dark:text-violet-400 dark:hover:bg-violet-950/30"
            >
              <PenLine className="w-4 h-4" aria-hidden="true" />
              {t.focusExpandToJournal || "Write about it in your journal"}
            </button>
          )}
        </div>
      </motion.div>
    </motion.div>
    </>
  );
}

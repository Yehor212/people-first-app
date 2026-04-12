import { useState } from "react";
import { motion } from "framer-motion";
import { X, Sparkles, PenLine } from "lucide-react";
import { cn } from "@/lib/utils";
import { useLanguage } from "@/contexts/LanguageContext";
import { zenMotion, zenTap } from "@/lib/animationUtils";
import { useModalClose } from "@/hooks/useModalState";
import { RewardedAdPrompt } from "@/components/ads/RewardedAdPrompt";

/**
 * Theme-aware particle — CSS switches animation via .dark ancestor:
 *   Day:   zen-mote-float  — gentle upward drift (dust in sunbeam)
 *   Night: zen-star-twinkle — pulse in place (distant stars)
 * Only transform + opacity → GPU compositor, 60fps.
 */
export function CosmicStar({
  x,
  y,
  size,
  delay,
}: {
  x: number;
  y: number;
  size: number;
  delay: number;
}) {
  return (
    <div
      className="zen-particle absolute rounded-full"
      style={
        {
          left: `${x}%`,
          top: `${y}%`,
          width: size,
          height: size,
          backgroundColor: "var(--particle-color)",
          "--particle-duration": `${2 + delay}s`,
          "--particle-delay": `${delay}s`,
        } as React.CSSProperties
      }
    />
  );
}

// Generate stars for background (shared with FocusTimer)
export const cosmicStars = Array.from({ length: 15 }, (_, i) => ({
  id: i,
  x: Math.random() * 100,
  y: Math.random() * 100,
  size: 1 + Math.random() * 2,
  delay: Math.random() * 3,
}));

interface FocusReflectionModalProps {
  reflectionValue: number | null;
  onSelectValue: (value: number) => void;
  onSave: (value: number | null) => void;
  onDismiss: () => void;
  onExpandToJournal?: () => void; // IA Blueprint Phase 3: Focus → Journal expansion
}

export function FocusReflectionModal({
  reflectionValue,
  onSelectValue,
  onSave,
  onDismiss,
  onExpandToJournal,
}: FocusReflectionModalProps) {
  const { t } = useLanguage();
  const [isSaving, setIsSaving] = useState(false);
  useModalClose(true, onDismiss);

  return (
    <motion.div
      className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center px-4 z-[60] md:inset-y-6 md:left-auto md:right-auto md:w-full md:mx-auto md:max-w-lg md:rounded-2xl md:shadow-2xl"
      role="dialog"
      aria-modal="true"
      aria-label={t.ariaFocusReflection}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      onClick={(e) => {
        if (e.target === e.currentTarget) {
          onDismiss();
        }
      }}
    >
      <motion.div
        className="w-full max-w-xs sm:max-w-sm relative overflow-hidden rounded-2xl"
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
            className="absolute top-3 end-3 p-2 rounded-lg bg-secondary hover:bg-secondary/80 text-slate-600 dark:text-white/60 hover:text-slate-800 dark:hover:text-white transition-colors"
            aria-label={t.close}
          >
            <X className="w-4 h-4" />
          </button>

          <div className="flex items-center gap-2 mb-2">
            <Sparkles className="w-5 h-5 text-violet-600 dark:text-violet-400" />
            <h4 className="text-lg font-semibold text-slate-800 dark:text-white pe-10">
              {t.focusReflectionTitle}
            </h4>
          </div>
          <p className="text-sm text-slate-600 dark:text-white/60 mt-1">
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
                    "w-11 h-11 rounded-full text-sm font-bold transition-all",
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

          <div className="flex gap-2 mt-6">
            <motion.button
              onClick={onDismiss}
              className="flex-1 py-3 rounded-xl bg-secondary text-muted-foreground font-medium hover:bg-secondary/80 hover:text-foreground transition-colors"
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
                "flex-1 py-3 rounded-xl bg-gradient-to-r from-violet-500 to-purple-600 text-white font-medium",
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
              className="w-full mt-3 py-2.5 rounded-xl text-sm font-medium text-violet-600 dark:text-violet-400 hover:bg-violet-50 dark:hover:bg-violet-950/30 transition-colors flex items-center justify-center gap-2"
            >
              <PenLine className="w-4 h-4" />
              {t.focusExpandToJournal || "Write about it in your journal"}
            </button>
          )}

          {/* Opt-in rewarded ad — earn bonus treats after focus */}
          <div className="mt-4">
            <RewardedAdPrompt context="post_focus" compact />
          </div>
        </div>
      </motion.div>
    </motion.div>
  );
}

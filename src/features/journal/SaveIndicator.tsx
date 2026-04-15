/**
 * SaveIndicator — Shows the save lifecycle state of the current journal entry.
 * States: idle | saving | saved | error | synced
 * Uses framer-motion AnimatePresence for smooth transitions.
 * All animations gated behind shouldAnimate().
 */

import { memo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Check, Loader2, AlertCircle, Cloud } from "lucide-react";
import { shouldAnimate } from "@/lib/animationUtils";
import { useLanguage } from "@/contexts/LanguageContext";

export type SaveState = "idle" | "saving" | "saved" | "error" | "synced";

interface SaveIndicatorProps {
  state: SaveState;
  onRetry?: () => void;
}

export const SaveIndicator = memo(function SaveIndicator({
  state,
  onRetry,
}: SaveIndicatorProps) {
  const { t } = useLanguage();
  const ts = t as unknown as Record<string, string>;
  const animate = shouldAnimate();

  if (state === "idle") return null;

  const content = () => {
    switch (state) {
      case "saving":
        return (
          <motion.span
            key="saving"
            initial={animate ? { opacity: 0 } : false}
            animate={{ opacity: 1 }}
            exit={animate ? { opacity: 0 } : undefined}
            className="flex items-center gap-1 text-[10px] text-muted-foreground"
          >
            <Loader2
              className={`w-2.5 h-2.5 ${animate ? "animate-spin" : ""}`}
            />
            <span className={animate ? "animate-pulse" : ""}>
              {ts.journalSaving || "Saving..."}
            </span>
          </motion.span>
        );

      case "saved":
        return (
          <motion.span
            key="saved"
            initial={animate ? { opacity: 0 } : false}
            animate={{ opacity: 1 }}
            exit={animate ? { opacity: 0 } : undefined}
            transition={{ duration: 0.2 }}
            className="flex items-center gap-0.5 text-[10px] text-primary/70"
          >
            <Check className="w-2.5 h-2.5" />
            {ts.journalSaved || "Saved"}
          </motion.span>
        );

      case "error":
        return (
          <motion.span
            key="error"
            initial={animate ? { opacity: 0 } : false}
            animate={{ opacity: 1 }}
            exit={animate ? { opacity: 0 } : undefined}
            className="flex items-center gap-1 text-[10px] text-destructive"
          >
            <AlertCircle className="w-2.5 h-2.5" />
            {ts.journalSaveFailed || "Save failed"}
            {onRetry && (
              <button
                onClick={onRetry}
                className="underline underline-offset-2 hover:opacity-80 min-h-[28px] px-1"
              >
                {ts.journalRetry || "Retry"}
              </button>
            )}
          </motion.span>
        );

      case "synced":
        return (
          <motion.span
            key="synced"
            initial={animate ? { opacity: 0 } : false}
            animate={{ opacity: 1 }}
            exit={animate ? { opacity: 0 } : undefined}
            transition={{ duration: 0.2 }}
            className="flex items-center gap-0.5 text-[10px] text-primary/50"
          >
            <Cloud className="w-2.5 h-2.5" />
            {ts.journalSynced || "Synced"}
          </motion.span>
        );

      default:
        return null;
    }
  };

  return (
    <span aria-live="polite" aria-atomic="true" className="inline-flex">
      <AnimatePresence mode="wait">{content()}</AnimatePresence>
    </span>
  );
});

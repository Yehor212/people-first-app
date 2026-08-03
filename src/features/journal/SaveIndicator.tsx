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
  errorTitle?: string;
  errorHint?: string;
  retryLabel?: string;
}

export const SaveIndicator = memo(function SaveIndicator({
  state,
  onRetry,
  errorTitle,
  errorHint,
  retryLabel,
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
            className="flex max-w-full min-w-0 flex-wrap items-center gap-1 whitespace-normal break-words text-xs text-muted-foreground"
          >
            <Loader2
              className={`w-2.5 h-2.5 ${animate ? "animate-spin" : ""}`}
            />
            <span className={animate ? "motion-safe:animate-pulse" : ""}>
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
            className="flex max-w-full min-w-0 flex-wrap items-center gap-0.5 whitespace-normal break-words text-xs text-primary/70"
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
            className="flex max-w-full min-w-0 flex-wrap items-center gap-1.5 whitespace-normal break-words text-xs text-destructive"
          >
            <AlertCircle className="w-3 h-3" aria-hidden="true" />
            <span className="shrink-0 font-medium">
              {errorTitle || ts.journalSaveFailed || "Save failed"}
            </span>
            <span className="min-w-[8rem] flex-1 break-words text-destructive/80">
              {errorHint ||
                ts.journalSaveFailedHint ||
                "Your text is still on screen. Retry when you are ready."}
            </span>
            {onRetry && (
              <button
                type="button"
                onClick={onRetry}
                className="inline-flex min-h-[44px] min-w-[44px] shrink-0 items-center justify-center rounded-lg px-2 font-semibold underline underline-offset-2 hover:opacity-80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-destructive/40"
              >
                {retryLabel || ts.journalRetry || "Retry"}
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
            className="flex max-w-full min-w-0 flex-wrap items-center gap-0.5 whitespace-normal break-words text-xs text-primary/50"
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
    <span
      role={state === "error" ? "alert" : "status"}
      aria-live={state === "error" ? "assertive" : "polite"}
      aria-atomic="true"
      className="inline-flex max-w-full min-w-0"
    >
      <AnimatePresence mode="wait">{content()}</AnimatePresence>
    </span>
  );
});

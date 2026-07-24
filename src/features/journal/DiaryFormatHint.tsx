/**
 * DiaryFormatHint — one-time onboarding hint for the formatting toolbar.
 * Shows a compact text-tools affordance, auto-dismisses after 5s or on tap.
 */

import { useCallback, useEffect, useRef, useState } from "react";
import { motion } from "framer-motion";
import { zenMotion } from "@/lib/animationUtils";
import { useLanguage } from "@/contexts/LanguageContext";
import { V2_SHELL_ICONS } from "@/lib/v2IconSystem";

interface DiaryFormatHintProps {
  onDismiss: () => void;
}

export function DiaryFormatHint({ onDismiss }: DiaryFormatHintProps) {
  const { t } = useLanguage();
  const ts = t;
  const HintIcon = V2_SHELL_ICONS.insight;
  const [dismissed, setDismissed] = useState(false);
  const dismissedRef = useRef(false);
  const dismissTimerRef = useRef<number | null>(null);
  const pauseReasonsRef = useRef(new Set<"focus" | "pointer">());
  const clearDismissTimer = useCallback(() => {
    if (dismissTimerRef.current === null) return;
    window.clearTimeout(dismissTimerRef.current);
    dismissTimerRef.current = null;
  }, []);
  const dismiss = useCallback(() => {
    if (dismissedRef.current) return;
    clearDismissTimer();
    dismissedRef.current = true;
    setDismissed(true);
    onDismiss();
  }, [clearDismissTimer, onDismiss]);
  const scheduleDismiss = useCallback(() => {
    if (dismissedRef.current || pauseReasonsRef.current.size > 0) return;
    clearDismissTimer();
    dismissTimerRef.current = window.setTimeout(dismiss, 5000);
  }, [clearDismissTimer, dismiss]);
  const pauseAutoDismiss = useCallback(
    (reason: "focus" | "pointer") => {
      pauseReasonsRef.current.add(reason);
      clearDismissTimer();
    },
    [clearDismissTimer],
  );
  const resumeAutoDismiss = useCallback(
    (reason: "focus" | "pointer") => {
      pauseReasonsRef.current.delete(reason);
      scheduleDismiss();
    },
    [scheduleDismiss],
  );

  useEffect(() => {
    scheduleDismiss();
    return clearDismissTimer;
  }, [clearDismissTimer, scheduleDismiss]);

  if (dismissed) return null;

  return (
    <motion.div
      initial={{ opacity: 0, y: -8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -8 }}
      transition={zenMotion.gentle}
      role="button"
      tabIndex={0}
      onFocus={() => pauseAutoDismiss("focus")}
      onBlur={() => resumeAutoDismiss("focus")}
      onPointerEnter={() => pauseAutoDismiss("pointer")}
      onPointerLeave={() => resumeAutoDismiss("pointer")}
      onClick={dismiss}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          dismiss();
        }
      }}
      aria-label={ts.diaryFormatHint || "Select text to format (bold, italic, etc.)"}
      className="flex min-h-[44px] min-w-[44px] items-center gap-2 rounded-xl border border-foreground/10 bg-foreground/5 px-3 py-2 backdrop-blur-sm cursor-pointer"
    >
      <HintIcon className="h-3.5 w-3.5 text-muted-foreground" aria-hidden="true" />
      <span className="text-xs text-muted-foreground">
        {ts.diaryFormatHintLabel || ts.journalFormatToolbar || "Text tools"}
      </span>
    </motion.div>
  );
}

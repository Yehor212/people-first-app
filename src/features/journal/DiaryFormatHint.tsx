/**
 * DiaryFormatHint — one-time onboarding hint for the formatting toolbar.
 * Shows a compact text-tools affordance, auto-dismisses after 5s or on tap.
 */

import { useEffect } from "react";
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

  useEffect(() => {
    const timer = setTimeout(onDismiss, 5000);
    return () => clearTimeout(timer);
  }, [onDismiss]);

  return (
    <motion.div
      initial={{ opacity: 0, y: -8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -8 }}
      transition={zenMotion.gentle}
      role="button"
      tabIndex={0}
      onClick={onDismiss}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onDismiss();
        }
      }}
      aria-label={ts.diaryFormatHint || "Select text to format (bold, italic, etc.)"}
      className="flex items-center gap-2 px-3 py-2 rounded-xl bg-foreground/5 border border-foreground/10 backdrop-blur-sm cursor-pointer"
    >
      <HintIcon className="h-3.5 w-3.5 text-muted-foreground" aria-hidden="true" />
      <span className="text-xs text-muted-foreground">
        {ts.diaryFormatHintLabel || ts.journalFormatToolbar || "Text tools"}
      </span>
    </motion.div>
  );
}

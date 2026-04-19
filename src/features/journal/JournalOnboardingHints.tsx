import { memo, useState, useCallback } from "react";
import { motion, AnimatePresence, useReducedMotion } from "framer-motion";
import { springs } from "@/config/animations";
import { shouldAnimate } from "@/lib/animationUtils";
import { useLanguage } from "@/contexts/LanguageContext";
import { storageGetRaw, storageSetRaw } from "@/lib/safeJson";
import { hapticTap } from "@/lib/haptics";

const HINT_IDS = ["mood", "sidebar", "search"] as const;
type HintId = (typeof HINT_IDS)[number];

interface JournalOnboardingHintsProps {
  currentHint: HintId | null;
  position: { top: number; left: number } | null;
  onDismiss: (hint: string) => void;
}

const STORAGE_PREFIX = "journal-onboarding-";

const HINT_KEYS: Record<HintId, { i18n: string; fallback: string }> = {
  mood: { i18n: "diaryHintMood", fallback: "Tap an emoji to set your mood" },
  sidebar: { i18n: "diaryHintSidebar", fallback: "Swipe from edge to toggle sidebar" },
  search: { i18n: "diaryHintSearch", fallback: "Search your entries by keyword" },
};

const pulseKeyframes = {
  boxShadow: [
    "0 0 0 0 hsl(var(--primary) / 0)",
    "0 0 8px 4px hsl(var(--primary) / 0.15)",
    "0 0 0 0 hsl(var(--primary) / 0)",
  ],
};

export const JournalOnboardingHints = memo(function JournalOnboardingHints({
  currentHint,
  position,
  onDismiss,
}: JournalOnboardingHintsProps) {
  const prefersReduced = useReducedMotion();
  const animate = shouldAnimate() && !prefersReduced;
  const { t, isRTL } = useLanguage();
  const tMap = t as unknown as Record<string, string>;

  const handleDismiss = useCallback(() => {
    if (!currentHint) return;
    void hapticTap();
    onDismiss(currentHint);
  }, [currentHint, onDismiss]);

  if (!currentHint || !position) return null;

  const { i18n, fallback } = HINT_KEYS[currentHint];
  const label = tMap[i18n] ?? fallback;
  const closeLabel = tMap["close"] ?? "Close";

  return (
    <AnimatePresence mode="wait">
      <motion.div
        key={currentHint}
        role="tooltip"
        aria-live="polite"
        dir={isRTL ? "rtl" : "ltr"}
        className="fixed z-[55] max-w-[220px] bg-primary/10 backdrop-blur-sm [-webkit-backdrop-filter:blur(4px)] border border-primary/20 rounded-xl px-3 py-2 shadow-lg"
        style={{ top: position.top, left: position.left }}
        initial={animate ? { opacity: 0, y: 6, scale: 0.95 } : undefined}
        animate={animate ? { opacity: 1, y: 0, scale: 1 } : undefined}
        exit={animate ? { opacity: 0, y: -4, transition: { duration: 0.15 } } : undefined}
        transition={animate ? springs.snappy : undefined}
      >
        {/* Arrow pointer */}
        <div
          className="absolute -top-1.5 start-4 w-3 h-3 rotate-45 bg-primary/10 border-l border-t border-primary/20"
        />

        <div className="flex items-start gap-2">
          <p className="text-xs text-foreground flex-1 leading-relaxed">{label}</p>
          <button
            type="button"
            onClick={handleDismiss}
            aria-label={closeLabel}
            className="shrink-0 w-[44px] h-[44px] -m-2 flex items-center justify-center text-muted-foreground hover:text-foreground motion-safe:transition-colors"
          >
            <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
              <path d="M2 2l8 8M10 2l-8 8" />
            </svg>
          </button>
        </div>

        {/* Subtle pulse glow */}
        {animate && (
          <motion.div
            className="absolute inset-0 rounded-xl pointer-events-none"
            animate={pulseKeyframes}
            transition={{ duration: 3, repeat: Infinity, ease: "easeInOut" }}
          />
        )}
      </motion.div>
    </AnimatePresence>
  );
});

export function useJournalOnboarding() {
  const [dismissed, setDismissed] = useState<Set<HintId>>(() => {
    const set = new Set<HintId>();
    for (const id of HINT_IDS) {
      if (storageGetRaw(`${STORAGE_PREFIX}${id}`) === "1") set.add(id);
    }
    return set;
  });

  const currentHint: HintId | null =
    HINT_IDS.find((id) => !dismissed.has(id)) ?? null;

  const isFirstTimeUser = dismissed.size === 0;

  const dismissHint = useCallback((hint: string) => {
    const id = hint as HintId;
    if (!HINT_IDS.includes(id)) return;
    storageSetRaw(`${STORAGE_PREFIX}${id}`, "1");
    setDismissed((prev) => new Set(prev).add(id));
  }, []);

  return { currentHint, dismissHint, isFirstTimeUser };
}

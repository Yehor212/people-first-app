import { memo } from "react";
import { motion, useReducedMotion } from "framer-motion";

import { useLanguage } from "@/contexts/LanguageContext";
import { MiniValenceOrb } from "@/components/state-of-mind/MiniValenceOrb";
import { springs as springPresets } from "@/config/animations";
import { V2_JOURNAL_ICONS } from "@/lib/v2IconSystem";
import { getToday } from "@/lib/utils";

import { DiaryWallpaper } from "./DiaryWallpaper";
import { getJournalQuote } from "./journalQuotes";

/** Detect low-end device: skip orb if < 4GB RAM or no WebGL */
function isLowEndDevice(): boolean {
  if (typeof navigator === "undefined") return false;
  const mem = (navigator as Navigator & { deviceMemory?: number }).deviceMemory;
  if (mem && mem < 4) return true;
  try {
    const canvas = document.createElement("canvas");
    return !canvas.getContext("webgl") && !canvas.getContext("webgl2");
  } catch {
    return true;
  }
}

function getCurrentTimePeriod(): string {
  const h = new Date().getHours();
  if (h >= 5 && h < 12) return "morning";
  if (h >= 12 && h < 17) return "afternoon";
  if (h >= 17 && h < 22) return "evening";
  return "night";
}


const TIME_GREETINGS: Record<string, Record<string, string>> = {
  morning: {
    en: "Good morning",
    uk: "Доброго ранку",
    es: "Buenos días",
    de: "Guten Morgen",
    fr: "Bonjour",
    ja: "おはよう",
    ar: "صباح الخير",
    he: "בוקר טוב",
  },
  afternoon: {
    en: "Good afternoon",
    uk: "Добрий день",
    es: "Buenas tardes",
    de: "Guten Tag",
    fr: "Bon après-midi",
    ja: "こんにちは",
    ar: "مساء الخير",
    he: "צהריים טובים",
  },
  evening: {
    en: "Good evening",
    uk: "Добрий вечір",
    es: "Buenas noches",
    de: "Guten Abend",
    fr: "Bonsoir",
    ja: "こんばんは",
    ar: "مساء الخير",
    he: "ערב טוב",
  },
  night: {
    en: "Quiet night",
    uk: "Тиха ніч",
    es: "Noche tranquila",
    de: "Ruhige Nacht",
    fr: "Nuit calme",
    ja: "静かな夜",
    ar: "ليلة هادئة",
    he: "לילה שקט",
  },
};

interface DiaryEmptyCanvasProps {
  onNewEntry: () => void;
  onNewEntryWithPrompt: (prompt: string) => void;
  selectedDate?: string | null;
  showWallpaper?: boolean;
}

export const DiaryEmptyCanvas = memo(function DiaryEmptyCanvas({
  onNewEntry,
  onNewEntryWithPrompt,
  selectedDate = null,
  showWallpaper = true,
}: DiaryEmptyCanvasProps) {
  const { t, language } = useLanguage();
  const ts = t as unknown as Record<string, string>;
  const reducedMotion = useReducedMotion();
  const lowEnd = isLowEndDevice();
  const currentPrompt = selectedDate && selectedDate !== getToday()
    ? ts.journalReflectionPromptPast || "Write one true sentence you remember about this day."
    : ts.journalReflectionPrompt2 || "Write one true sentence about today.";
  const currentQuote = getJournalQuote(ts);
  const period = getCurrentTimePeriod();
  const greeting = TIME_GREETINGS[period]?.[language] || TIME_GREETINGS[period]?.en || "Hello";
  const NewEntryIcon = V2_JOURNAL_ICONS.newEntry;
  const PromptIcon = V2_JOURNAL_ICONS.prompt;

  return (
    <div
      className="relative flex flex-1 select-none flex-col items-center justify-center gap-5 overflow-x-hidden px-4 py-6 sm:gap-6 [@media(max-height:700px)]:gap-3 [@media(max-height:700px)]:py-3"
      data-testid="diary-empty-canvas"
    >
      {/* Layer 1: shared day/night diary wallpaper */}
      {showWallpaper && <DiaryWallpaper surface="empty" />}

      {/* Layer 2: Shared orb badge */}
      {!reducedMotion && !lowEnd && (
        <motion.div
          initial={{ opacity: 0, scale: 0.8 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ type: "spring", stiffness: 200, damping: 20, delay: 0.2 }}
          className="relative z-[1] [@media(max-height:700px)]:hidden"
          aria-hidden="true"
        >
          <MiniValenceOrb valence={0} hasEntry={false} size="md" chrome="badge" />
        </motion.div>
      )}

      {/* Layer 3: Time-aware greeting */}
      <motion.h2
        initial={false}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.25, duration: 0.35 }}
        className="relative z-[1] text-center font-display text-2xl font-medium tracking-tight text-foreground [@media(max-height:700px)]:text-xl"
      >
        {greeting}
      </motion.h2>

      {/* Layer 4: stable first-party reflection prompt */}
      <motion.p
        initial={false}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.35, duration: 0.4 }}
        className="relative z-[1] w-full max-w-lg px-8 text-center text-lg font-normal italic leading-relaxed text-foreground [@media(max-height:700px)]:px-2 [@media(max-height:700px)]:text-base"
      >
        {currentPrompt}
      </motion.p>

      {/* Layer 5: quiet first-party quote */}
      <motion.figure
        initial={false}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.43, duration: 0.35 }}
        className="relative z-[1] w-full max-w-md rounded-lg border border-border/60 bg-card/80 px-5 py-3 text-center shadow-sm backdrop-blur-sm [-webkit-backdrop-filter:blur(8px)] [@media(max-height:700px)]:hidden"
        data-testid="diary-reflection-quote"
        aria-label={ts.journalReflectionQuoteLabel || "A quiet quote"}
        dir="auto"
      >
        <figcaption className="mb-2 text-xs font-medium text-muted-foreground">
          {ts.journalReflectionQuoteLabel || "A quiet quote"}
        </figcaption>
        <blockquote className="font-serif text-base italic leading-relaxed text-foreground">
          <span aria-hidden="true">&quot;</span>
          {currentQuote}
          <span aria-hidden="true">&quot;</span>
        </blockquote>
      </motion.figure>

      {/* Layer 6: focused actions */}
      <motion.div
        initial={false}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.5, duration: 0.3 }}
        className="zf-auto-fit-grid-10 relative z-[1] grid w-full max-w-lg gap-3"
        data-testid="diary-empty-actions"
      >
        <motion.button
          whileHover={
            reducedMotion
              ? undefined
              : { y: -2, boxShadow: "0 4px 20px rgba(var(--primary-rgb), 0.15)" }
          }
          whileTap={reducedMotion ? undefined : { scale: 0.97 }}
          transition={springPresets.snappy}
          onClick={onNewEntry}
          className="flex min-h-[48px] w-full min-w-0 items-center justify-center gap-2 whitespace-normal rounded-full bg-primary px-4 py-2.5 text-center text-sm font-semibold text-primary-foreground hover:bg-primary/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/45 focus-visible:ring-offset-2 focus-visible:ring-offset-background motion-safe:transition-colors"
          aria-label={ts.journalNewEntry || "Write"}
        >
          <NewEntryIcon className="h-4 w-4 shrink-0" />
          <span className="min-w-0 break-words [hyphens:manual] [overflow-wrap:normal]">
            {ts.journalNewEntry || "Write"}
          </span>
        </motion.button>

        <motion.button
          whileHover={
            reducedMotion
              ? undefined
              : { y: -2, boxShadow: "0 4px 20px rgba(var(--primary-rgb), 0.10)" }
          }
          whileTap={reducedMotion ? undefined : { scale: 0.97 }}
          transition={springPresets.snappy}
          onClick={() => onNewEntryWithPrompt(currentPrompt)}
          className="flex min-h-[48px] w-full min-w-0 items-center justify-center gap-2 whitespace-normal rounded-full border border-border/70 bg-background/80 px-4 py-2.5 text-center text-sm font-medium text-foreground hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/45 focus-visible:ring-offset-2 focus-visible:ring-offset-background motion-safe:transition-colors"
          aria-label={ts.journalUsePrompt || ts.journalPrompt || "Use a prompt"}
        >
          <PromptIcon className="h-4 w-4 shrink-0" />
          <span className="min-w-0 break-words [hyphens:manual] [overflow-wrap:normal]">
            {ts.journalUsePrompt || ts.journalPrompt || "Use a prompt"}
          </span>
        </motion.button>
      </motion.div>

    </div>
  );
});

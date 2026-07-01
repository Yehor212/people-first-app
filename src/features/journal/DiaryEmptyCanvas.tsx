import { memo } from "react";
import { motion, useReducedMotion } from "framer-motion";

import { useLanguage } from "@/contexts/LanguageContext";
import { MiniValenceOrb } from "@/components/state-of-mind/MiniValenceOrb";
import { ParticleBackground } from "@/components/stats/ParticleBackground";
import { springs as springPresets } from "@/config/animations";
import { V2_JOURNAL_ICONS, V2_SHELL_ICONS } from "@/lib/v2IconSystem";

import { DiaryWallpaper } from "./DiaryWallpaper";
import { formatLocalizedCount } from "./journalWordCount";

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

const TIME_PARTICLE_COLOR: Record<string, "gold" | "primary" | "accent" | "purple"> = {
  morning: "gold",
  afternoon: "primary",
  evening: "accent",
  night: "purple",
};

function getCurrentTimePeriod(): string {
  const h = new Date().getHours();
  if (h >= 5 && h < 12) return "morning";
  if (h >= 12 && h < 17) return "afternoon";
  if (h >= 17 && h < 22) return "evening";
  return "night";
}

const JOURNAL_EMPTY_QUOTES = [
  { translationId: "journalReflectionQuote1", fallback: "One detail is enough." },
  { translationId: "journalReflectionQuote2", fallback: "This page can hold only what you choose." },
  { translationId: "journalReflectionQuote3", fallback: "Leave a small note for later." },
] as const;

function getJournalEmptyQuoteIndex(date = new Date()): number {
  return Math.abs(Math.floor(date.getTime() / 86_400_000)) % JOURNAL_EMPTY_QUOTES.length;
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
  streak: number;
  entriesThisWeek: number;
  showWallpaper?: boolean;
}

export const DiaryEmptyCanvas = memo(function DiaryEmptyCanvas({
  onNewEntry,
  onNewEntryWithPrompt,
  streak,
  entriesThisWeek,
  showWallpaper = true,
}: DiaryEmptyCanvasProps) {
  const { t, language } = useLanguage();
  const ts = t as unknown as Record<string, string>;
  const reducedMotion = useReducedMotion();
  const lowEnd = isLowEndDevice();
  const currentPrompt = ts.journalReflectionPrompt2 || "Write one true sentence about today.";
  const quoteDefinition = JOURNAL_EMPTY_QUOTES[getJournalEmptyQuoteIndex()];
  const currentQuote = ts[quoteDefinition.translationId] || quoteDefinition.fallback;
  const period = getCurrentTimePeriod();
  const greeting = TIME_GREETINGS[period]?.[language] || TIME_GREETINGS[period]?.en || "Hello";
  const NewEntryIcon = V2_JOURNAL_ICONS.newEntry;
  const PromptIcon = V2_JOURNAL_ICONS.prompt;
  const StreakIcon = V2_SHELL_ICONS.confirm;

  return (
    <div
      className="relative flex flex-1 select-none flex-col items-center justify-center gap-5 overflow-hidden px-4 py-6 sm:gap-6"
      data-testid="diary-empty-canvas"
    >
      {/* Layer 1: shared day/night diary wallpaper */}
      {showWallpaper && <DiaryWallpaper surface="empty" />}

      {/* Layer 2: Ambient particles */}
      {!reducedMotion && (
        <ParticleBackground
          count={lowEnd ? 5 : 15}
          color={TIME_PARTICLE_COLOR[period] || "primary"}
          className="absolute inset-0"
          active
        />
      )}

      {/* Layer 3: Shared orb badge */}
      {!reducedMotion && !lowEnd && (
        <motion.div
          initial={{ opacity: 0, scale: 0.8 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ type: "spring", stiffness: 200, damping: 20, delay: 0.2 }}
          className="relative z-[1]"
          aria-hidden="true"
        >
          <MiniValenceOrb valence={0} hasEntry={false} size="md" chrome="badge" />
        </motion.div>
      )}

      {/* Layer 4: Time-aware greeting */}
      <motion.h2
        initial={reducedMotion ? false : { opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.25, duration: 0.35 }}
        className="relative z-[1] text-center font-display text-2xl font-medium tracking-tight text-foreground/80"
      >
        {greeting}
      </motion.h2>

      {/* Layer 5: stable first-party reflection prompt */}
      <motion.p
        initial={reducedMotion ? false : { opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.35, duration: 0.4 }}
        className="relative z-[1] max-w-[min(30rem,calc(100vw-3rem))] px-8 text-center text-lg font-light italic leading-relaxed text-foreground/78"
      >
        {currentPrompt}
      </motion.p>

      {/* Layer 6: quiet first-party quote */}
      <motion.figure
        initial={reducedMotion ? false : { opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.43, duration: 0.35 }}
        className="relative z-[1] max-w-[min(28rem,calc(100vw-3rem))] border-y border-foreground/10 bg-background/20 px-5 py-3 text-center backdrop-blur-sm"
        data-testid="diary-reflection-quote"
        aria-label={ts.journalReflectionQuoteLabel || "A quiet quote"}
        dir="auto"
      >
        <figcaption className="mb-2 text-xs font-medium text-muted-foreground/70">
          {ts.journalReflectionQuoteLabel || "A quiet quote"}
        </figcaption>
        <blockquote className="text-base font-serif italic leading-relaxed text-foreground/82">
          <span aria-hidden="true">&quot;</span>
          {currentQuote}
          <span aria-hidden="true">&quot;</span>
        </blockquote>
      </motion.figure>

      {/* Layer 7: CTA pills */}
      <motion.div
        initial={reducedMotion ? false : { opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.5, duration: 0.3 }}
        className="relative z-[1] flex items-center gap-3"
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
          className="flex min-h-[44px] items-center gap-2 rounded-full bg-primary/10 px-4 py-2.5 text-sm font-medium text-primary hover:bg-primary/15 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/35 focus-visible:ring-offset-2 focus-visible:ring-offset-background motion-safe:transition-colors"
          aria-label={ts.journalNewEntry || "Write"}
        >
          <NewEntryIcon className="h-4 w-4" />
          {ts.journalNewEntry || "Write"}
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
          className="flex min-h-[44px] items-center gap-2 rounded-full bg-muted/50 px-4 py-2.5 text-sm font-medium text-muted-foreground hover:bg-muted/70 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/35 focus-visible:ring-offset-2 focus-visible:ring-offset-background motion-safe:transition-colors"
          aria-label={ts.journalPrompt || "Prompt"}
        >
          <PromptIcon className="h-4 w-4" />
          {ts.journalPrompt || "Prompt"}
        </motion.button>
      </motion.div>

      {/* Layer 8: Context line + streak */}
      <motion.div
        initial={reducedMotion ? false : { opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.7, duration: 0.3 }}
        className="relative z-[1] flex items-center justify-center gap-3 text-xs text-muted-foreground/60"
      >
        {entriesThisWeek > 0 && (
          <span className="flex items-center gap-1">
            <NewEntryIcon className="h-3.5 w-3.5" aria-hidden="true" />
            {formatLocalizedCount(
              entriesThisWeek,
              language,
              ts,
              "journalThisWeekCount",
              ts.diaryEntriesThisWeek || "this week"
            )}
          </span>
        )}
        {streak > 0 && (
          <motion.span
            animate={reducedMotion ? undefined : { scale: [1, 1.1, 1] }}
            transition={{ duration: 2, repeat: Infinity, repeatDelay: 3 }}
            className="flex items-center gap-1 font-semibold text-[hsl(var(--zf-warm))]"
          >
            <StreakIcon className="h-3.5 w-3.5" aria-hidden="true" />
            {formatLocalizedCount(
              streak,
              language,
              ts,
              "journalStreakCount",
              ts.diaryStreak || "streak"
            )}
          </motion.span>
        )}
        {entriesThisWeek === 0 && streak === 0 && (
          <span>{ts.diaryStartFirstEntry || "Begin with one small detail."}</span>
        )}
      </motion.div>
    </div>
  );
});

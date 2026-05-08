import { memo, useMemo } from "react";
import { ArrowRight, X } from "lucide-react";
import { motion, useReducedMotion } from "framer-motion";

import { useLanguage } from "@/contexts/LanguageContext";
import { springs } from "@/config/animations";
import { getLocale } from "@/lib/timeUtils";

import { DiaryMiniOrb } from "./DiaryMiniOrb";
import type { JournalEntrySuggestion } from "./types";

interface DiaryEntrySuggestionCardProps {
  suggestion: JournalEntrySuggestion;
  onStart: () => void;
  onDismiss: () => void;
  compact?: boolean;
}

const MOOD_LABEL_KEYS = {
  great: "moodGreat",
  good: "moodGood",
  okay: "moodOkay",
  bad: "moodBad",
  terrible: "moodTerrible",
} as const;

function capitalizeFirst(value: string | null | undefined): string {
  if (!value) return "";
  return value.charAt(0).toUpperCase() + value.slice(1);
}

function stripHtml(value: string | undefined): string {
  if (!value) return "";
  return value
    .replace(/<[^>]*>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function getDateLabel(
  committedAt: number | undefined,
  locale: string,
): string {
  const date = new Date(committedAt ?? Date.now());
  return date.toLocaleDateString(locale, {
    weekday: "short",
    month: "short",
    day: "numeric",
  });
}

function getTimeLabel(
  suggestion: JournalEntrySuggestion,
  tx: Record<string, string>,
  locale: string,
): string {
  if (suggestion.scope === "day") {
    return tx.orbScopeDay || "For the whole day";
  }

  if (suggestion.scope === "specific") {
    if (suggestion.specificTime) {
      return suggestion.specificTime;
    }
    return tx.orbScopeSpecific || "At a specific time";
  }

  return new Date(suggestion.committedAt ?? Date.now()).toLocaleTimeString(locale, {
    hour: "numeric",
    minute: "2-digit",
  });
}

function getScopeLabel(
  suggestion: JournalEntrySuggestion,
  tx: Record<string, string>,
): string {
  if (suggestion.scope === "day") return tx.orbScopeDay || "For the whole day";
  if (suggestion.scope === "specific") return tx.orbScopeSpecific || "At a specific time";
  return tx.orbScopeNow || "In this moment";
}

export const DiaryEntrySuggestionCard = memo(function DiaryEntrySuggestionCard({
  suggestion,
  onStart,
  onDismiss,
  compact = false,
}: DiaryEntrySuggestionCardProps) {
  const { t, language } = useLanguage();
  const tx = t as unknown as Record<string, string>;
  const reducedMotion = useReducedMotion();
  const locale = getLocale(language);

  const moodLabel = suggestion.mood
    ? tx[MOOD_LABEL_KEYS[suggestion.mood]] || suggestion.mood
    : null;

  const title = useMemo(() => {
    if (suggestion.prefill.title?.trim()) return suggestion.prefill.title.trim();
    if (suggestion.emotion) return capitalizeFirst(suggestion.emotion);
    if (moodLabel) return moodLabel;
    return tx.howAreYouFeeling || "How are you feeling?";
  }, [moodLabel, suggestion.emotion, suggestion.prefill.title, tx]);

  const preview = useMemo(() => {
    if (suggestion.note?.trim()) return suggestion.note.trim();
    return stripHtml(suggestion.prefill.content);
  }, [suggestion.note, suggestion.prefill.content]);

  const dateLabel = useMemo(
    () => getDateLabel(suggestion.committedAt, locale),
    [locale, suggestion.committedAt],
  );
  const timeLabel = useMemo(
    () => getTimeLabel(suggestion, tx, locale),
    [locale, suggestion, tx],
  );
  const scopeLabel = useMemo(() => getScopeLabel(suggestion, tx), [suggestion, tx]);

  return (
    <motion.section
      initial={reducedMotion ? false : { opacity: 0, y: 8, scale: 0.985 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={springs.smooth}
      className={[
        "relative overflow-hidden rounded-[30px] border border-border/60 bg-card/82 backdrop-blur-xl",
        compact ? "px-4 py-4" : "px-5 py-5 shadow-sm",
      ].join(" ")}
      data-testid="diary-entry-suggestion"
      aria-label={tx.navV2Diary || tx.diary || "Diary"}
    >
      <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-primary/45 to-transparent" />

      <div className="flex items-start gap-4">
        <DiaryMiniOrb
          mood={suggestion.mood}
          size={compact ? "compact" : "hero"}
          className={compact ? "mt-0.5" : "mt-1"}
        />

        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2 text-[11px] uppercase tracking-[0.14em] text-muted-foreground">
                {suggestion.contextLabel ? <span>{suggestion.contextLabel}</span> : null}
                {suggestion.contextLabel ? (
                  <span className="h-1 w-1 rounded-full bg-current/40" aria-hidden="true" />
                ) : null}
                <span>{dateLabel}</span>
                <span className="h-1 w-1 rounded-full bg-current/40" aria-hidden="true" />
                <span>{timeLabel}</span>
              </div>

              <h3 className="mt-3 text-lg font-semibold tracking-tight text-foreground md:text-[1.25rem]">
                {title}
              </h3>

              <div className="mt-2 flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
                <span>{scopeLabel}</span>
                {moodLabel ? (
                  <>
                    <span className="h-1 w-1 rounded-full bg-current/40" aria-hidden="true" />
                    <span>{moodLabel}</span>
                  </>
                ) : null}
                {suggestion.emotion ? (
                  <>
                    <span className="h-1 w-1 rounded-full bg-current/40" aria-hidden="true" />
                    <span>{capitalizeFirst(suggestion.emotion)}</span>
                  </>
                ) : null}
              </div>

              {preview ? (
                <p className="mt-3 max-w-2xl text-sm leading-6 text-foreground/84">
                  {preview}
                </p>
              ) : null}
            </div>

            <button
              type="button"
              onClick={onDismiss}
              className="inline-flex min-h-[44px] min-w-[44px] shrink-0 items-center justify-center rounded-2xl text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
              aria-label={tx.orbSkip || "Later"}
            >
              <X className="h-4 w-4" aria-hidden="true" />
            </button>
          </div>

          <div className="mt-4 flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={onStart}
              className="inline-flex min-h-[44px] items-center gap-2 rounded-full bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
            >
              <span>{tx.journalContinueWriting || tx.journalStartToday || "Continue writing"}</span>
              <ArrowRight className="h-4 w-4" aria-hidden="true" />
            </button>

            <button
              type="button"
              onClick={onDismiss}
              className="inline-flex min-h-[44px] items-center rounded-full border border-border/70 bg-background/72 px-4 py-2 text-sm font-medium text-foreground transition-colors hover:bg-accent"
            >
              {tx.orbSkip || "Later"}
            </button>
          </div>
        </div>
      </div>
    </motion.section>
  );
});

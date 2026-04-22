import { memo, useMemo } from "react";
import { ArrowRight, X } from "lucide-react";
import { motion, useReducedMotion } from "framer-motion";

import { useLanguage } from "@/contexts/LanguageContext";
import { springs } from "@/config/animations";

import { DiaryMiniOrb } from "./DiaryMiniOrb";
import type { JournalEntrySuggestion } from "./types";

interface DiaryEntrySuggestionCardProps {
  suggestion: JournalEntrySuggestion;
  onStart: () => void;
  onDismiss: () => void;
  compact?: boolean;
}

const MOOD_META: Record<string, { emoji: string; labelKey: string }> = {
  great: { emoji: "\u{1F604}", labelKey: "moodGreat" },
  good: { emoji: "\u{1F642}", labelKey: "moodGood" },
  okay: { emoji: "\u{1F610}", labelKey: "moodOkay" },
  bad: { emoji: "\u{1F614}", labelKey: "moodBad" },
  terrible: { emoji: "\u{1F622}", labelKey: "moodTerrible" },
};

function stripHtml(value: string | undefined): string {
  if (!value) return "";
  return value
    .replace(/<[^>]*>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function capitalizeFirst(value: string | null | undefined): string {
  if (!value) return "";
  return value.charAt(0).toUpperCase() + value.slice(1);
}

function getScopeLabel(
  scope: JournalEntrySuggestion["scope"],
  specificTime: string | null | undefined,
  tx: Record<string, string>,
): string {
  if (scope === "day") return tx.orbScopeDay || "For the whole day";
  if (scope === "specific") {
    return specificTime
      ? `${tx.orbScopeSpecific || "At a specific time"} - ${specificTime}`
      : tx.orbScopeSpecific || "At a specific time";
  }
  return tx.orbScopeNow || "In this moment";
}

export const DiaryEntrySuggestionCard = memo(function DiaryEntrySuggestionCard({
  suggestion,
  onStart,
  onDismiss,
  compact = false,
}: DiaryEntrySuggestionCardProps) {
  const { t } = useLanguage();
  const tx = t as unknown as Record<string, string>;
  const reducedMotion = useReducedMotion();

  const summary = useMemo(
    () => stripHtml(suggestion.prefill.content),
    [suggestion.prefill.content],
  );

  const title =
    suggestion.prefill.title?.trim() ||
    capitalizeFirst(suggestion.emotion) ||
    tx.howAreYouFeeling ||
    "How are you feeling?";

  const moodMeta = suggestion.mood ? MOOD_META[suggestion.mood] : null;
  const moodLabel = moodMeta ? tx[moodMeta.labelKey] || suggestion.mood : null;
  const scopeLabel = getScopeLabel(suggestion.scope, suggestion.specificTime, tx);

  return (
    <motion.section
      initial={reducedMotion ? false : { opacity: 0, y: 8, scale: 0.98 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={springs.smooth}
      className={[
        "relative overflow-hidden rounded-3xl border border-border/60 bg-card/80 backdrop-blur-md",
        compact ? "px-4 py-4" : "px-5 py-5 shadow-sm",
      ].join(" ")}
      data-testid="diary-entry-suggestion"
      aria-label={tx.navV2Diary || tx.diary || "Diary"}
    >
      <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-primary/50 to-transparent" />

      <div className="flex items-start gap-3">
        <DiaryMiniOrb
          mood={suggestion.mood}
          size="compact"
          className="mt-0.5"
        />

        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                <span>{scopeLabel}</span>
                {moodMeta && moodLabel ? (
                  <span className="inline-flex items-center gap-1 rounded-full bg-muted/70 px-2 py-1 text-foreground">
                    <span aria-hidden="true">{moodMeta.emoji}</span>
                    <span>{moodLabel}</span>
                  </span>
                ) : null}
              </div>

              <h3 className="mt-2 text-lg font-semibold tracking-tight text-foreground">
                {title}
              </h3>

              {summary ? (
                <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">
                  {summary}
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
              <span>{tx.journalStartToday || "Start today's entry"}</span>
              <ArrowRight className="h-4 w-4" aria-hidden="true" />
            </button>

            <button
              type="button"
              onClick={onDismiss}
              className="inline-flex min-h-[44px] items-center rounded-full border border-border/70 bg-background/70 px-4 py-2 text-sm font-medium text-foreground transition-colors hover:bg-accent"
            >
              {tx.orbSkip || "Later"}
            </button>
          </div>
        </div>
      </div>
    </motion.section>
  );
});

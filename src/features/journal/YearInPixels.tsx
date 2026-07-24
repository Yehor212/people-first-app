/* eslint-disable jsx-a11y/no-noninteractive-tabindex -- The year mosaic scroller must receive focus for keyboard operation. */
import { memo, useId, useMemo } from "react";
import { motion, useReducedMotion } from "framer-motion";
import { useLanguage } from "@/contexts/LanguageContext";
import { springs, stagger } from "@/config/animations";
import { formatLocalizedCount } from "./journalWordCount";
import type { JournalEntry } from "./types";
import type { MoodType } from "@/types";

/** Mood → inline color (theme-safe via semantic CSS vars) */
const MOOD_INLINE_COLORS: Record<MoodType, string> = {
  great: "hsl(var(--primary))",
  good: "hsl(var(--primary) / 0.7)",
  okay: "hsl(var(--warning, 45 93% 47%))",
  bad: "hsl(var(--destructive) / 0.7)",
  terrible: "hsl(var(--destructive))",
};

/** Map "uk" → "uk-UA" so Intl.DateTimeFormat picks the correct locale */
const LOCALE_MAP: Record<string, string> = { uk: "uk-UA", ja: "ja-JP" };

function daysInMonth(year: number, month: number): number {
  return new Date(year, month + 1, 0).getDate();
}

interface YearInPixelsProps {
  entries: JournalEntry[];
  year?: number;
  labelledById?: string;
}

export const YearInPixels = memo(function YearInPixels({
  entries,
  year = new Date().getFullYear(),
  labelledById,
}: YearInPixelsProps) {
  const { language, t } = useLanguage();
  const ts = t as unknown as Record<string, string>;
  const prefersReducedMotion = useReducedMotion();
  const internalHeadingId = useId();
  const summaryId = useId();

  const locale = LOCALE_MAP[language] ?? language;

  const monthLabels = useMemo(() => {
    const fmt = new Intl.DateTimeFormat(locale, { month: "short" });
    return Array.from({ length: 12 }, (_, m) => fmt.format(new Date(year, m, 1)));
  }, [locale, year]);

  const entryMap = useMemo(() => {
    const map = new Map<string, MoodType | undefined>();
    for (const e of entries) {
      if (e.date.startsWith(`${year}-`)) {
        map.set(e.date, e.mood);
      }
    }
    return map;
  }, [entries, year]);

  const months = useMemo(
    () =>
      Array.from({ length: 12 }, (_, m) => ({
        label: monthLabels[m],
        days: daysInMonth(year, m),
        month: m,
      })),
    [monthLabels, year]
  );

  const loggedDays = entryMap.size;
  const accessibleSummary = useMemo(() => {
    const countLabel = formatLocalizedCount(
      loggedDays,
      language,
      ts,
      "journalStatsDayCount",
      ts.journalStatsDays || "days"
    );
    const moodLabels: Record<MoodType, string> = {
      great: ts.moodGreat || "Great",
      good: ts.moodGood || "Good",
      okay: ts.moodOkay || "Okay",
      bad: ts.moodBad || "Bad",
      terrible: ts.moodTerrible || "Terrible",
    };
    const entryDetails = [...entryMap.entries()]
      .sort(([left], [right]) => left.localeCompare(right))
      .map(
        ([date, mood]) => `${date}: ${mood ? moodLabels[mood] : ts.journalStatsNoMood || "No mood"}`
      );

    return entryDetails.length > 0 ? `${countLabel}. ${entryDetails.join(", ")}` : countLabel;
  }, [entryMap, language, loggedDays, ts]);

  return (
    <div
      className="overflow-x-auto overscroll-x-contain rounded-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/60 focus-visible:ring-offset-2 focus-visible:ring-offset-background"
      role="region"
      tabIndex={0}
      aria-labelledby={labelledById ?? internalHeadingId}
      aria-describedby={summaryId}
    >
      {!labelledById && (
        <span id={internalHeadingId} className="sr-only">
          {ts.journalStatsYearInPixels || "Year in Pixels"}
        </span>
      )}
      <span id={summaryId} className="sr-only">
        {accessibleSummary}
      </span>
      <div className="inline-flex flex-col gap-1" aria-hidden="true">
        {months.map(({ label, days, month }, rowIdx) => {
          const rowDelay = stagger.delayForIndex(rowIdx);
          return (
            <div key={month} className="flex items-center gap-1.5">
              <span className="w-[calc(2.5rem*var(--font-scale,1))] shrink-0 select-none whitespace-normal break-words text-end text-xs text-muted-foreground">
                {label}
              </span>
              <div className="flex gap-0.5">
                {Array.from({ length: days }, (_, d) => {
                  const day = d + 1;
                  const dateKey = `${year}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
                  const mood = entryMap.get(dateKey);
                  const inlineColor = mood ? MOOD_INLINE_COLORS[mood] : undefined;
                  const dotDelay = rowDelay + Math.min(d, 9) * 0.008;

                  return (
                    <motion.div
                      key={day}
                      className="w-3 h-3 rounded-full"
                      style={
                        inlineColor
                          ? { backgroundColor: inlineColor }
                          : {
                              backgroundColor: "hsl(var(--muted-foreground) / 0.08)",
                              boxShadow: "inset 0 0 0 1px hsl(var(--border) / 0.1)",
                            }
                      }
                      initial={prefersReducedMotion ? false : { opacity: 0, scale: 0 }}
                      animate={{ opacity: 1, scale: 1 }}
                      transition={
                        prefersReducedMotion
                          ? { duration: 0 }
                          : { ...springs.snappy, delay: dotDelay }
                      }
                      aria-hidden="true"
                    />
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
});

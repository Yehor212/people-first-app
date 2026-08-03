import { memo, useMemo } from "react";
import { motion, useReducedMotion } from "framer-motion";
import { useLanguage } from "@/contexts/LanguageContext";
import { springs } from "@/config/animations";
import { getLocale } from "@/lib/timeUtils";
import { parseLocalDate } from "@/lib/utils";
import type { JournalEntry } from "./types";
import type { MoodType } from "@/types";
import type { TranslationStrings } from "@/i18n/types";
import { shiftJournalDate } from "./journalDateUtils";

interface MoodCorrelationsProps {
  entries: JournalEntry[];
}

const MOOD_SCORE: Record<MoodType, number> = {
  great: 5, good: 4, okay: 3, bad: 2, terrible: 1,
};

const MIN_SAMPLE = 5;

interface Insight {
  key: string;
  emoji: string;
  text: string;
  stat: string;
  significance: number;
}

function avgMood(scores: number[]): number {
  return scores.length ? scores.reduce((a, b) => a + b, 0) / scores.length : 0;
}

function getTimeOfDay(hour: number): "morning" | "afternoon" | "evening" {
  if (hour < 12) return "morning";
  if (hour < 18) return "afternoon";
  return "evening";
}

function formatInsight(template: string, values: Record<string, string>): string {
  return Object.entries(values).reduce(
    (result, [key, value]) => result.split(`{${key}}`).join(value),
    template,
  );
}

function computeInsights(
  entries: JournalEntry[],
  locale: string,
  ts: TranslationStrings,
): Insight[] {
  const scored = entries
    .filter((e) => e.mood && MOOD_SCORE[e.mood] !== undefined)
    .map((e) => ({ ...e, score: MOOD_SCORE[e.mood!] }));

  if (scored.length < MIN_SAMPLE) return [];

  const insights: Insight[] = [];
  const dayFmt = new Intl.DateTimeFormat(locale, { weekday: "long" });
  const numberFmt = new Intl.NumberFormat(locale, {
    minimumFractionDigits: 1,
    maximumFractionDigits: 1,
  });
  const formatScore = (value: number) => numberFmt.format(value);

  // 1 - Day of week
  const byDay = new Map<number, number[]>();
  for (const e of scored) {
    const day = parseLocalDate(e.date).getDay();
    if (!byDay.has(day)) byDay.set(day, []);
    byDay.get(day)!.push(e.score);
  }
  const validDays = [...byDay.entries()].filter(([, s]) => s.length >= MIN_SAMPLE);
  if (validDays.length >= 2) {
    const best = validDays.reduce((a, b) => (avgMood(a[1]) > avgMood(b[1]) ? a : b));
    const worst = validDays.reduce((a, b) => (avgMood(a[1]) < avgMood(b[1]) ? a : b));
    const diff = avgMood(best[1]) - avgMood(worst[1]);
    if (diff > 0.3) {
      const bestName = dayFmt.format(new Date(2024, 0, 7 + best[0]));
      insights.push({
        key: "day", emoji: "\uD83D\uDCC5",
        text: formatInsight(ts.journalMoodInsightBestDay, { day: bestName }),
        stat: formatInsight(ts.journalMoodInsightAverage, {
          value: formatScore(avgMood(best[1])),
        }),
        significance: diff,
      });
    }
  }

  // 2 - Entry length
  const median = [...scored].sort((a, b) => a.content.length - b.content.length)[
    Math.floor(scored.length / 2)
  ].content.length;
  const short = scored.filter((e) => e.content.length <= median).map((e) => e.score);
  const long = scored.filter((e) => e.content.length > median).map((e) => e.score);
  if (short.length >= MIN_SAMPLE && long.length >= MIN_SAMPLE) {
    const diff = avgMood(long) - avgMood(short);
    if (Math.abs(diff) > 0.2) {
      insights.push({
        key: "length", emoji: "\u270D\uFE0F",
        text: diff > 0
          ? ts.journalMoodInsightLonger
          : ts.journalMoodInsightShorter,
        stat: formatInsight(ts.journalMoodInsightPointDifference, {
          value: formatScore(Math.abs(diff)),
        }),
        significance: Math.abs(diff),
      });
    }
  }

  // 3 - Time of day
  const byTime = new Map<string, number[]>();
  for (const e of scored) {
    const hour = new Date(e.createdAt).getHours();
    const tod = getTimeOfDay(hour);
    if (!byTime.has(tod)) byTime.set(tod, []);
    byTime.get(tod)!.push(e.score);
  }
  const validTimes = [...byTime.entries()].filter(([, s]) => s.length >= MIN_SAMPLE);
  if (validTimes.length >= 2) {
    const best = validTimes.reduce((a, b) => (avgMood(a[1]) > avgMood(b[1]) ? a : b));
    const diff = avgMood(best[1]) - avgMood(
      validTimes.filter(([k]) => k !== best[0]).flatMap(([, s]) => s),
    );
    if (diff > 0.2) {
      insights.push({
        key: "time", emoji: "\u23F0",
        text: formatInsight(ts.journalMoodInsightBestTime, {
          period: {
            morning: ts.journalMoodInsightMorning,
            afternoon: ts.journalMoodInsightAfternoon,
            evening: ts.journalMoodInsightEvening,
          }[best[0]] ?? best[0],
        }),
        stat: formatInsight(ts.journalMoodInsightAverage, {
          value: formatScore(avgMood(best[1])),
        }),
        significance: diff,
      });
    }
  }

  // 4 - Streak effect (consecutive days)
  const dateSet = new Set(scored.map((e) => e.date));
  const streakScores: number[] = [];
  const noStreakScores: number[] = [];
  for (const e of scored) {
    const prevStr = shiftJournalDate(e.date, -1);
    (dateSet.has(prevStr) ? streakScores : noStreakScores).push(e.score);
  }
  if (streakScores.length >= MIN_SAMPLE && noStreakScores.length >= MIN_SAMPLE) {
    const diff = avgMood(streakScores) - avgMood(noStreakScores);
    if (diff > 0.2) {
      insights.push({
        key: "streak", emoji: "\uD83D\uDD25",
        text: ts.journalMoodInsightStreak,
        stat: formatInsight(ts.journalMoodInsightStreakDifference, {
          value: formatScore(diff),
        }),
        significance: diff,
      });
    }
  }

  // 5 - Media usage (photos/audio)
  const withMedia = scored.filter((e) => e.photoIds.length > 0 || (e.audioIds?.length ?? 0) > 0).map((e) => e.score);
  const noMedia = scored.filter((e) => e.photoIds.length === 0 && (e.audioIds?.length ?? 0) === 0).map((e) => e.score);
  if (withMedia.length >= MIN_SAMPLE && noMedia.length >= MIN_SAMPLE) {
    const diff = avgMood(withMedia) - avgMood(noMedia);
    if (Math.abs(diff) > 0.2) {
      insights.push({
        key: "media", emoji: "\uD83D\uDCF7",
        text: diff > 0
          ? ts.journalMoodInsightMedia
          : ts.journalMoodInsightTextOnly,
        stat: formatInsight(ts.journalMoodInsightPointDifference, {
          value: formatScore(Math.abs(diff)),
        }),
        significance: Math.abs(diff),
      });
    }
  }

  return insights.sort((a, b) => b.significance - a.significance).slice(0, 3);
}

export const MoodCorrelations = memo(function MoodCorrelations({
  entries,
}: MoodCorrelationsProps) {
  const { language, t: ts } = useLanguage();
  const prefersReducedMotion = useReducedMotion();

  const insights = useMemo(
    () => computeInsights(entries, getLocale(language), ts),
    [entries, language, ts],
  );

  if (insights.length === 0) {
    return (
      <div
        role="region"
        aria-label={ts.journalMoodInsights}
        className="py-6 text-center text-sm text-muted-foreground"
      >
        {ts.journalMoodInsightsMoreData}
      </div>
    );
  }

  return (
    <div role="region" aria-label={ts.journalMoodInsights} className="flex flex-col gap-2">
      {insights.map((insight, i) => (
        <motion.div
          key={insight.key}
          initial={prefersReducedMotion ? false : { opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={prefersReducedMotion ? { duration: 0 } : { ...springs.quick, delay: i * 0.06 }}
          aria-label={`${insight.text}. ${insight.stat}`}
          className="bg-card/60 border border-border/20 rounded-xl p-3 flex items-start gap-3"
        >
          <span className="text-lg leading-none mt-0.5" aria-hidden="true">{insight.emoji}</span>
          <div className="min-w-0">
            <p className="text-sm text-foreground">{insight.text}</p>
            <p className="text-xs text-muted-foreground mt-0.5">{insight.stat}</p>
          </div>
        </motion.div>
      ))}
    </div>
  );
});

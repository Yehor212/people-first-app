/**
 * HeroInsightStrip — surfaces the top V1 insight on the Habits page.
 *
 * Law 1 / feedback_v2_reuse_v1: we do NOT rebuild insight math. We import
 * {@link generateInsights} from V1 `src/lib/insightsEngine.ts` and render
 * the highest-confidence result as a single literary strip.
 *
 * Why here: the Habits page is where users decide "what am I doing today?",
 * and that's exactly the moment an "on days you meditate, mood is +28%"
 * signal is most actionable (BJ Fogg — cue-to-motivation alignment).
 *
 * Renders nothing when:
 *   - there are no insights yet (insufficient data)
 *   - the translations prop is missing (parent gates it)
 *   - user prefers reduced motion AND the top insight's severity is "info"
 *     (we keep "warning"/"positive" insights even in reduced-motion mode so
 *     nothing that matters is hidden).
 */

import { memo, useMemo } from "react";
import { Sparkles, TrendingUp, AlertCircle } from "lucide-react";
import { useShallow } from "zustand/react/shallow";
import { useUserDataStore } from "@/stores";
import { useLanguage } from "@/contexts/LanguageContext";
import { generateInsights, type InsightTranslations } from "@/lib/insightsEngine";
import type { Insight } from "@/types";

/** The InsightTranslations shape V1 expects — pulled from the t() bag. */
function buildInsightTranslations(tx: Record<string, string>): InsightTranslations {
  return {
    moodHabitPositive:
      tx.insightMoodHabitPositive ??
      "On days you {habit}, your mood is {delta}% higher",
    moodHabitNegative:
      tx.insightMoodHabitNegative ??
      "On days you {habit}, your mood is {delta}% lower",
    focusConsistency:
      tx.insightFocusConsistency ??
      "You focus best at {hour}:00 — {rate}% completion rate",
    habitTimingBest:
      tx.insightHabitTimingBest ??
      "You're {delta}% more consistent {when}",
    moodTagPositive:
      tx.insightMoodTagPositive ??
      "Days tagged {tag} rate {delta}% higher on mood",
    moodTagNegative:
      tx.insightMoodTagNegative ??
      "Days tagged {tag} rate {delta}% lower on mood",
    dataInsufficient: tx.insightDataInsufficient ?? "",
  };
}

function iconFor(insight: Insight) {
  if (insight.severity === "warning") return AlertCircle;
  if (insight.type === "focus-pattern" || insight.type === "habit-timing") return TrendingUp;
  return Sparkles;
}

export const HeroInsightStrip = memo(function HeroInsightStrip() {
  const { t } = useLanguage();
  const tx = t as unknown as Record<string, string>;

  // Pull the three slices needed by generateInsights via a shallow-stable selector
  // so this component does not re-render on unrelated store changes.
  const { moods, habits, focusSessions } = useUserDataStore(
    useShallow((s) => ({
      moods: s.moods,
      habits: s.habits,
      focusSessions: s.focusSessions,
    })),
  );

  const topInsight = useMemo(() => {
    try {
      const translations = buildInsightTranslations(tx);
      const list = generateInsights(
        Array.isArray(moods) ? moods : [],
        Array.isArray(habits) ? habits : [],
        Array.isArray(focusSessions) ? focusSessions : [],
        translations,
      );
      return list[0] ?? null;
    } catch {
      // V1 insightsEngine throws on bad shape — never let insights break the page.
      return null;
    }
  }, [moods, habits, focusSessions, tx]);

  if (!topInsight) return null;

  const Icon = iconFor(topInsight);
  const severityClass =
    topInsight.severity === "warning"
      ? "bg-amber-500/10 text-amber-700 dark:text-amber-300 border-amber-500/20"
      : topInsight.severity === "celebration"
        ? "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border-emerald-500/20"
        : "bg-primary/10 text-primary border-primary/20";

  return (
    <aside
      role="note"
      aria-live="polite"
      aria-atomic="true"
      className={
        "mt-3 flex items-start gap-2 rounded-2xl border px-3 py-2 text-xs font-body " +
        severityClass
      }
      data-testid="habits-hero-insight-strip"
      data-severity={topInsight.severity}
    >
      <Icon className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden="true" />
      <div className="min-w-0 flex-1">
        <p className="font-semibold" data-testid="habits-hero-insight-title">
          {topInsight.title}
        </p>
        {topInsight.description && topInsight.description !== topInsight.title && (
          <p className="mt-0.5 text-muted-foreground">{topInsight.description}</p>
        )}
      </div>
      <span
        className="shrink-0 rounded-full bg-background/60 px-1.5 py-0.5 text-[10px] font-medium tabular-nums"
        aria-label={`confidence ${topInsight.confidence}%`}
      >
        {topInsight.confidence}%
      </span>
    </aside>
  );
});

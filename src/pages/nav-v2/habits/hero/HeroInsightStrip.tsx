/**
 * HeroInsightStrip - surfaces the top V1 insight on the Habits page.
 *
 * Law 1 / feedback_v2_reuse_v1: we do NOT rebuild insight math. We import
 * {@link generateInsights} from V1 `src/lib/insightsEngine.ts` and render
 * the highest-confidence result as a single literary strip.
 *
 * Why here: the Habits page is where users decide "what am I doing today?",
 * and that's exactly the moment an "on days you meditate, mood is +28%"
 * signal is most actionable (BJ Fogg - cue-to-motivation alignment).
 *
 * Renders nothing when:
 *   - there are no insights yet (insufficient data)
 *   - the translations prop is missing (parent gates it)
 *   - user prefers reduced motion AND the top insight's severity is "info"
 *     (we keep "warning"/"positive" insights even in reduced-motion mode so
 *     nothing that matters is hidden).
 */

import { memo, useEffect, useMemo } from "react";
import { AlertCircle, Sparkles, TrendingUp } from "lucide-react";
import { useShallow } from "zustand/react/shallow";
import { useLanguage } from "@/contexts/LanguageContext";
import type { Translations } from "@/i18n/types";
import { analytics } from "@/lib/analytics";
import { generateInsights, type InsightTranslations } from "@/lib/insightsEngine";
import { useUserDataStore } from "@/stores";
import type { Insight } from "@/types";

/** The InsightTranslations shape V1 expects - pulled from the typed i18n bag. */
function buildInsightTranslations(tx: Translations): InsightTranslations {
  return {
    morning: tx.insightMorning,
    afternoon: tx.insightAfternoon,
    evening: tx.insightEvening,
    habitImprovesMood: tx.insightHabitImprovesMood,
    habitImprovesMoodDesc: tx.insightHabitImprovesMoodDesc,
    focusBestLabel: tx.insightFocusBestLabel,
    focusBestLabelDesc: tx.insightFocusBestLabelDesc,
    peakFocusTime: tx.insightPeakFocusTime,
    peakFocusTimeDesc: tx.insightPeakFocusTimeDesc,
    bestTimeForHabit: tx.insightBestTimeForHabit,
    bestTimeForHabitDesc: tx.insightBestTimeForHabitDesc,
    tagBoostsMood: tx.insightTagBoostsMood,
    tagBoostsMoodDesc: tx.insightTagBoostsMoodDesc,
  };
}

function iconFor(insight: Insight) {
  if (insight.severity === "warning") return AlertCircle;
  if (insight.type === "focus-pattern" || insight.type === "habit-timing") return TrendingUp;
  return Sparkles;
}

export const HeroInsightStrip = memo(function HeroInsightStrip() {
  const { t } = useLanguage();
  const tx = t;

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
      // V1 insightsEngine throws on bad shape - never let insights break the page.
      return null;
    }
  }, [moods, habits, focusSessions, tx]);

  // Habits spec Section 15 cross-habit signal - emit once per distinct insight identity
  // so the aggregator can compute the "% of users seeing >=1 insight" funnel.
  // Depending on the two enum fields (not the memo object) keeps the effect
  // stable across re-renders but re-fires when the user flips between insights.
  const insightType = topInsight?.type ?? null;
  const insightSeverity = topInsight?.severity ?? null;
  useEffect(() => {
    if (!insightType || !insightSeverity) return;
    analytics.insightStripRendered(insightType, insightSeverity);
  }, [insightType, insightSeverity]);

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

/**
 * HeroInsightStrip - surfaces the top insight on the Habits page.
 *
 * Law 1 / feedback_v2_reuse_v1: we do NOT rebuild insight math. We import
 * {@link generateInsights} from `src/lib/insightsEngine.ts` and render
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

import { memo, useEffect, useMemo, useState } from "react";
import { useShallow } from "zustand/react/shallow";
import { useLanguage } from "@/contexts/LanguageContext";
import { analytics } from "@/lib/analytics";
import { generateInsights, type InsightTranslations } from "@/lib/insightsEngine";
import { scheduleIdle } from "@/lib/scheduleIdle";
import { V2_SHELL_ICONS } from "@/lib/v2IconSystem";
import { useUserDataStore } from "@/stores";
import type { Habit, Insight } from "@/types";

function iconFor(insight: Insight) {
  if (insight.severity === "warning") return V2_SHELL_ICONS.warning;
  if (insight.type === "focus-pattern" || insight.type === "habit-timing") return V2_SHELL_ICONS.trend;
  return V2_SHELL_ICONS.insight;
}

function getLinkedHabit(insight: Insight | null, habits: Habit[]): Habit | null {
  if (!insight?.metadata || !("habitId" in insight.metadata)) return null;
  const habitId = insight.metadata.habitId;
  if (typeof habitId !== "string" || !habitId) return null;
  return habits.find((habit) => habit.id === habitId) ?? null;
}

interface HeroInsightStripProps {
  onOpenHabitInsight?: (habit: Habit) => void;
}

export const HeroInsightStrip = memo(function HeroInsightStrip({
  onOpenHabitInsight,
}: HeroInsightStripProps) {
  const { t } = useLanguage();
  const tx = t;
  const {
    insightMorning,
    insightAfternoon,
    insightEvening,
    insightHabitImprovesMood,
    insightHabitImprovesMoodDesc,
    insightFocusBestLabel,
    insightFocusBestLabelDesc,
    insightPeakFocusTime,
    insightPeakFocusTimeDesc,
    insightBestTimeForHabit,
    insightBestTimeForHabitDesc,
    insightTagBoostsMood,
    insightTagBoostsMoodDesc,
  } = tx;
  const insightTranslations = useMemo<InsightTranslations>(() => ({
    morning: insightMorning,
    afternoon: insightAfternoon,
    evening: insightEvening,
    habitImprovesMood: insightHabitImprovesMood,
    habitImprovesMoodDesc: insightHabitImprovesMoodDesc,
    focusBestLabel: insightFocusBestLabel,
    focusBestLabelDesc: insightFocusBestLabelDesc,
    peakFocusTime: insightPeakFocusTime,
    peakFocusTimeDesc: insightPeakFocusTimeDesc,
    bestTimeForHabit: insightBestTimeForHabit,
    bestTimeForHabitDesc: insightBestTimeForHabitDesc,
    tagBoostsMood: insightTagBoostsMood,
    tagBoostsMoodDesc: insightTagBoostsMoodDesc,
  }), [
    insightMorning,
    insightAfternoon,
    insightEvening,
    insightHabitImprovesMood,
    insightHabitImprovesMoodDesc,
    insightFocusBestLabel,
    insightFocusBestLabelDesc,
    insightPeakFocusTime,
    insightPeakFocusTimeDesc,
    insightBestTimeForHabit,
    insightBestTimeForHabitDesc,
    insightTagBoostsMood,
    insightTagBoostsMoodDesc,
  ]);

  // Pull the three slices needed by generateInsights via a shallow-stable selector
  // so this component does not re-render on unrelated store changes.
  const { moods, habits, focusSessions } = useUserDataStore(
    useShallow((s) => ({
      moods: s.moods,
      habits: s.habits,
      focusSessions: s.focusSessions,
    })),
  );

  const [topInsight, setTopInsight] = useState<Insight | null>(null);

  useEffect(() => {
    let cancelled = false;
    setTopInsight(null);

    const handle = scheduleIdle(() => {
      if (cancelled) return;
      try {
        const list = generateInsights(
          Array.isArray(moods) ? moods : [],
          Array.isArray(habits) ? habits : [],
          Array.isArray(focusSessions) ? focusSessions : [],
          insightTranslations,
        );
        if (!cancelled) {
          setTopInsight(list[0] ?? null);
        }
      } catch {
        // insightsEngine throws on bad shape - never let insights break the page.
        if (!cancelled) {
          setTopInsight(null);
        }
      }
    }, 1_200, 120);

    return () => {
      cancelled = true;
      handle.cancel();
    };
  }, [moods, habits, focusSessions, insightTranslations]);

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
  const linkedHabit = getLinkedHabit(topInsight, habits);
  const severityClass =
    topInsight.severity === "warning"
      ? "border-[hsl(var(--zf-warning)/0.28)] bg-[hsl(var(--zf-warning)/0.12)] text-[hsl(var(--zf-warning))]"
      : topInsight.severity === "celebration"
        ? "border-[hsl(var(--zf-growth)/0.28)] bg-[hsl(var(--zf-growth)/0.12)] text-[hsl(var(--zf-growth))]"
        : "border-[hsl(var(--zf-role-focus)/0.36)] bg-[hsl(var(--zf-role-focus)/0.18)] text-[hsl(var(--zf-role-focus))]";

  return (
    <aside
      role="note"
      aria-live="polite"
      aria-atomic="true"
      className={"mt-3 rounded-2xl border px-3 py-3 text-xs font-body " + severityClass}
      data-testid="habits-hero-insight-strip"
      data-severity={topInsight.severity}
    >
      <div className="flex items-start gap-3">
        <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-background/60">
          <Icon className="h-3.5 w-3.5" aria-hidden="true" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="whitespace-normal break-words text-xs font-semibold uppercase tracking-[0.14em] text-current/70">
            {tx.insightsTitle || "Insight"}
          </p>
          <p className="mt-1 font-semibold leading-5" data-testid="habits-hero-insight-title">
            {topInsight.title}
          </p>
          {topInsight.description && topInsight.description !== topInsight.title && (
            <p className="mt-1 text-muted-foreground">{topInsight.description}</p>
          )}
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <span
              className="rounded-full bg-background/60 px-2 py-1 text-xs font-medium tabular-nums"
              aria-label={`confidence ${topInsight.confidence}%`}
            >
              {topInsight.confidence}%
            </span>
            {linkedHabit && onOpenHabitInsight && (
              <button
                type="button"
                onClick={() => onOpenHabitInsight(linkedHabit)}
                className="inline-flex min-h-[44px] items-center whitespace-normal break-words rounded-full border border-border/60 bg-background/70 px-3 py-2 text-xs font-medium text-foreground motion-safe:transition-colors hover:bg-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2"
                data-testid="habits-hero-insight-cta"
              >
                {tx.statistics || tx.navV2HabitsOpenDetails || "Statistics"}
              </button>
            )}
          </div>
        </div>
      </div>
    </aside>
  );
});

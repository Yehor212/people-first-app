/**
 * HabitTargetCard — Progress rings showing target completion by time interval.
 * NUMERICAL HABITS ONLY.
 *
 * Shows 3 rings: This Week / This Month / This Year
 * For each: actual value sum / expected based on frequency.
 * Uses existing ProgressRing component. Deep Space aesthetic.
 */

import { memo, useMemo } from "react";
import { ProgressRing } from "@/components/ui/progress-ring";
import { useLanguage } from "@/contexts/LanguageContext";
import { formatHabitValue } from "@/lib/habits";
import { computeHabitStatsSnapshot, type HabitStatsSnapshot } from "@/lib/habitStatsSnapshot";
import type { Habit } from "@/types";

interface HabitTargetCardProps {
  habit: Habit;
  snapshot?: HabitStatsSnapshot;
  className?: string;
}

export const HabitTargetCard = memo(function HabitTargetCard({ habit, snapshot, className }: HabitTargetCardProps) {
  const { t, language } = useLanguage();
  const ts = t as unknown as Record<string, string>;

  const statsSnapshot = useMemo(() => snapshot || computeHabitStatsSnapshot(habit), [habit, snapshot]);
  const stats = statsSnapshot.periods;

  // Guard: only for numerical habits with target
  if (habit.habitType !== "numerical" || habit.targetValue <= 0) return null;

  const intervalLabels: Record<string, string> = {
    week: ts.thisWeek || "Week",
    month: ts.thisMonth || "Month",
    year: ts.thisYear || "Year",
  };

  return (
    <div className={className}>
      <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-3">
        {ts.targetProgress || "Target Progress"}
      </h4>
      <div className="grid grid-cols-1 gap-3 min-[480px]:grid-cols-3 py-2">
        {stats.map((stat) => (
          <div key={stat.key} className="flex min-w-0 items-center gap-3 rounded-xl border border-border/40 p-2 min-[480px]:flex-col min-[480px]:border-0 min-[480px]:p-0">
            <ProgressRing
              progress={stat.percentToDate}
              size="sm"
              showPercentage
              color={stat.percentToDate >= 100 ? "success" : stat.percentToDate >= 50 ? "warning" : "primary"}
            />
            <div className="min-w-0 text-start min-[480px]:text-center">
              <div className="whitespace-normal break-words text-xs text-muted-foreground">{intervalLabels[stat.key]}</div>
              <div className="whitespace-normal [overflow-wrap:anywhere] text-xs font-medium tabular-nums text-muted-foreground">
                {formatHabitValue(stat.actual, language)}/{formatHabitValue(stat.expectedToDate, language)}
              </div>
              <div className="whitespace-normal [overflow-wrap:anywhere] text-xs tabular-nums text-muted-foreground/60">
                {ts.habitStatsFullPlan || "Plan"} {formatHabitValue(stat.expectedFull, language)}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
});

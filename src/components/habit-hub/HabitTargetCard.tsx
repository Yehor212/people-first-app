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
      <div className="flex items-center justify-around py-2">
        {stats.map((stat) => (
          <div key={stat.key} className="flex flex-col items-center gap-1.5">
            <ProgressRing
              progress={stat.percentToDate}
              size="sm"
              showPercentage
              color={stat.percentToDate >= 100 ? "success" : stat.percentToDate >= 50 ? "warning" : "primary"}
            />
            <div className="text-center">
              <div className="text-[10px] text-muted-foreground">{intervalLabels[stat.key]}</div>
              <div className="text-[10px] font-medium text-muted-foreground tabular-nums">
                {formatHabitValue(stat.actual, language)}/{formatHabitValue(stat.expectedToDate, language)}
              </div>
              <div className="text-[9px] text-muted-foreground/60 tabular-nums">
                {ts.habitStatsFullPlan || "Plan"} {formatHabitValue(stat.expectedFull, language)}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
});

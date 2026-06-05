/**
 * HabitFrequencyChart — SVG bar chart showing completions by day of week.
 * Deep Space aesthetic: transparent bg, habit color bars, subtle grid.
 */

import { memo, useMemo } from "react";
import { cn } from "@/lib/utils";
import { getFrequencyByWeekday } from "@/lib/habitScore";
import { resolveHabitColor } from "@/lib/habitColorUtils";
import { useLanguage } from "@/contexts/LanguageContext";
import { useChartFontSizes } from "@/lib/chartTokens";
import type { Habit } from "@/types";

const CHART_WIDTH = 320;
const CHART_HEIGHT = 128;
const CHART_LEFT = 24;
const CHART_RIGHT = 8;
const CHART_TOP = 10;
const CHART_BOTTOM = 24;
const CHART_INNER_WIDTH = CHART_WIDTH - CHART_LEFT - CHART_RIGHT;
const CHART_INNER_HEIGHT = CHART_HEIGHT - CHART_TOP - CHART_BOTTOM;

interface HabitFrequencyChartProps {
  habit: Habit;
  className?: string;
}

export const HabitFrequencyChart = memo(function HabitFrequencyChart({
  habit,
  className,
}: HabitFrequencyChartProps) {
  const { t } = useLanguage();
  const ts = t as unknown as Record<string, string>;
  const chartFonts = useChartFontSizes();

  const dayLabels = useMemo(
    () => [t.daySun, t.dayMon, t.dayTue, t.dayWed, t.dayThu, t.dayFri, t.daySat],
    [t.daySun, t.dayMon, t.dayTue, t.dayWed, t.dayThu, t.dayFri, t.daySat]
  );

  const data = useMemo(() => {
    const counts = getFrequencyByWeekday(habit);
    // Reorder to Mon-first: [Mon, Tue, Wed, Thu, Fri, Sat, Sun]
    const reordered = [counts[1], counts[2], counts[3], counts[4], counts[5], counts[6], counts[0]];
    const labels = [
      dayLabels[1],
      dayLabels[2],
      dayLabels[3],
      dayLabels[4],
      dayLabels[5],
      dayLabels[6],
      dayLabels[0],
    ];
    return reordered.map((count, i) => ({ day: labels[i], count }));
  }, [habit, dayLabels]);

  const maxCount = useMemo(() => Math.max(...data.map((d) => d.count), 1), [data]);
  const habitColor = resolveHabitColor(habit.color);
  const slotWidth = CHART_INNER_WIDTH / data.length;
  const barWidth = Math.max(14, slotWidth - 12);

  return (
    <div className={cn("", className)}>
      <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-3">
        {ts.weekdayFrequency || "By Day of Week"}
      </h4>

      <div
        className="@container w-full"
        role="img"
        aria-label={`${ts.weekdayFrequency || "Habit frequency by day"}: ${data.map((d) => `${d.day} ${d.count}`).join(", ")}`}
      >
        <div className="aspect-[5/2] @sm:aspect-[3/1] min-h-[100px] max-h-[200px]">
          <svg className="h-full w-full overflow-visible" viewBox="0 0 320 128" aria-hidden="true">
            {[0, maxCount].map((value) => {
              const y = CHART_TOP + ((maxCount - value) / maxCount) * CHART_INNER_HEIGHT;
              return (
                <g key={value}>
                  <line
                    x1={CHART_LEFT}
                    x2={CHART_WIDTH - CHART_RIGHT}
                    y1={y}
                    y2={y}
                    stroke="hsl(var(--border) / 0.35)"
                    strokeDasharray="3 4"
                  />
                  <text
                    x={CHART_LEFT - 8}
                    y={y + 4}
                    fill="hsl(var(--muted-foreground))"
                    fontSize={chartFonts.axis}
                    textAnchor="end"
                  >
                    {value}
                  </text>
                </g>
              );
            })}
            {data.map((entry, index) => {
              const height = Math.max((entry.count / maxCount) * CHART_INNER_HEIGHT, entry.count > 0 ? 5 : 2);
              const x = CHART_LEFT + index * slotWidth + (slotWidth - barWidth) / 2;
              const y = CHART_TOP + CHART_INNER_HEIGHT - height;
              return (
                <g key={entry.day}>
                  <rect
                    x={x}
                    y={y}
                    width={barWidth}
                    height={height}
                    rx="4"
                    fill={entry.count > 0 ? habitColor : "hsl(var(--muted) / 0.45)"}
                    opacity={entry.count > 0 ? 0.35 + (entry.count / maxCount) * 0.55 : 1}
                  >
                    <title>{`${entry.day}: ${entry.count}`}</title>
                  </rect>
                  <text
                    x={x + barWidth / 2}
                    y={CHART_HEIGHT - 6}
                    fill="hsl(var(--muted-foreground))"
                    fontSize={chartFonts.axis}
                    textAnchor="middle"
                  >
                    {entry.day}
                  </text>
                </g>
              );
            })}
          </svg>
        </div>
      </div>
    </div>
  );
});

/* eslint-disable jsx-a11y/no-noninteractive-tabindex -- The intrinsic chart scroller must receive focus for keyboard operation. */
/**
 * HabitBarCard — Grouped bar chart showing completions by week or month.
 * Pure SVG (no external chart library). Deep Space aesthetic.
 *
 * Week view: last 12 weeks, each bar = completion count
 * Month view: last 12 months, each bar = completion count
 */

import { memo, useId, useMemo, useState } from "react";
import { cn } from "@/lib/utils";
import { resolveHabitColor } from "@/lib/habitColorUtils";
import { useLanguage } from "@/contexts/LanguageContext";
import { useChartFontSizes } from "@/lib/chartTokens";
import { ENTRY } from "@/types";
import type { Habit } from "@/types";

interface HabitBarCardProps {
  habit: Habit;
  className?: string;
}

type BarInterval = "week" | "month";

interface BarData {
  label: string;
  count: number;
}

function toDateStr(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function getCompletionsByWeek(
  habit: Habit,
  weeks: number,
  nowLabel = "Now",
  weekAbbr = "W"
): BarData[] {
  const result: BarData[] = [];
  const today = new Date();

  for (let w = weeks - 1; w >= 0; w--) {
    const weekEnd = new Date(today);
    weekEnd.setDate(weekEnd.getDate() - w * 7);
    const weekStart = new Date(weekEnd);
    weekStart.setDate(weekStart.getDate() - 6);

    const startStr = toDateStr(weekStart);
    const endStr = toDateStr(weekEnd);

    let count = 0;
    for (const [date, entry] of Object.entries(habit.entries)) {
      if (date >= startStr && date <= endStr) {
        if (habit.habitType === "boolean") {
          if (entry.value === ENTRY.YES_MANUAL) count++;
        } else {
          if (entry.value > 0 && entry.value !== ENTRY.SKIP) count++;
        }
      }
    }

    const label = w === 0 ? nowLabel : `${weekAbbr}-${w}`;
    result.push({ label, count });
  }

  return result;
}

function getCompletionsByMonth(habit: Habit, months: number, locale = "en"): BarData[] {
  const result: BarData[] = [];
  const today = new Date();

  for (let m = months - 1; m >= 0; m--) {
    const month = new Date(today.getFullYear(), today.getMonth() - m, 1);
    const prefix = `${month.getFullYear()}-${String(month.getMonth() + 1).padStart(2, "0")}`;

    let count = 0;
    for (const [date, entry] of Object.entries(habit.entries)) {
      if (date.startsWith(prefix)) {
        if (habit.habitType === "boolean") {
          if (entry.value === ENTRY.YES_MANUAL) count++;
        } else {
          if (entry.value > 0 && entry.value !== ENTRY.SKIP) count++;
        }
      }
    }

    const monthLabel = new Intl.DateTimeFormat(locale, { month: "short" }).format(month);
    result.push({ label: monthLabel, count });
  }

  return result;
}

const CHART_H = 100;
const BAR_PAD = { top: 8, right: 8, bottom: 20, left: 8 };

export const HabitBarCard = memo(function HabitBarCard({ habit, className }: HabitBarCardProps) {
  const { t, language } = useLanguage();
  const ts = t as unknown as Record<string, string>;
  const chartFonts = useChartFontSizes();
  const completionsHeadingId = useId();
  const completionsSummaryId = useId();
  const [barInterval, setBarInterval] = useState<BarInterval>("week");
  const color = resolveHabitColor(habit.color);
  const nowLabel = ts.now || "Now";
  const weekAbbrLabel = ts.weekAbbr || "W";

  const data = useMemo(() => {
    return barInterval === "week"
      ? getCompletionsByWeek(habit, 12, nowLabel, weekAbbrLabel)
      : getCompletionsByMonth(habit, 12, language);
  }, [habit, barInterval, nowLabel, weekAbbrLabel, language]);

  const maxCount = Math.max(1, ...data.map((d) => d.count));
  const svgWidth = 320;
  const innerW = svgWidth - BAR_PAD.left - BAR_PAD.right;
  const innerH = CHART_H - BAR_PAD.top - BAR_PAD.bottom;
  const barWidth = (innerW / data.length) * 0.7;
  const gap = (innerW / data.length) * 0.3;

  return (
    <div className={className}>
      <div className="mb-2 flex flex-col items-stretch gap-2 min-[420px]:flex-row min-[420px]:items-center min-[420px]:justify-between">
        <h4
          id={completionsHeadingId}
          className="whitespace-normal break-words text-xs font-semibold uppercase tracking-wider text-muted-foreground"
        >
          {ts.completions || "Completions"}
        </h4>
        <div className="grid grid-cols-2 gap-1">
          {(["week", "month"] as const).map((iv) => (
            <button
              key={iv}
              onClick={() => setBarInterval(iv)}
              className={cn(
                "min-h-[44px] whitespace-normal break-words rounded-md px-3 py-1.5 text-xs font-medium motion-safe:transition-colors",
                barInterval === iv
                  ? "bg-foreground/[0.10] text-foreground"
                  : "text-muted-foreground hover:text-muted-foreground"
              )}
            >
              {iv === "week" ? ts.weekly || "Week" : ts.monthly || "Month"}
            </button>
          ))}
        </div>
      </div>

      <div
        className="w-full overflow-x-auto rounded-xl border border-foreground/[0.06] bg-foreground/[0.03] scrollbar-hide focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/60 focus-visible:ring-offset-2 focus-visible:ring-offset-background"
        role="region"
        tabIndex={0}
        aria-labelledby={completionsHeadingId}
        aria-describedby={completionsSummaryId}
      >
        <p id={completionsSummaryId} className="sr-only">
          {data.map((item) => `${item.label}: ${item.count}`).join(", ")}
        </p>
        {/* VISUAL-VERIFIED: overflow-x-auto + min-w prevents chart clipping on narrow mobile viewports */}
        <svg
          aria-hidden="true"
          focusable="false"
          viewBox={`0 0 ${svgWidth} ${CHART_H}`}
          preserveAspectRatio="xMidYMid meet"
          className="min-w-[320px] w-full"
          // VISUAL-VERIFIED: height is fixed constant CHART_H for consistent chart proportions
          style={{ height: CHART_H }}
        >
          {/* Grid lines */}
          {[0, 0.25, 0.5, 0.75, 1].map((pct) => (
            <line
              key={pct}
              x1={BAR_PAD.left}
              y1={BAR_PAD.top + innerH * (1 - pct)}
              x2={svgWidth - BAR_PAD.right}
              y2={BAR_PAD.top + innerH * (1 - pct)}
              stroke="white"
              strokeOpacity={0.04}
              strokeDasharray="2,4"
            />
          ))}

          {/* Bars */}
          {data.map((d, i) => {
            const x = BAR_PAD.left + i * (barWidth + gap) + gap / 2;
            const barH = (d.count / maxCount) * innerH;
            const y = BAR_PAD.top + innerH - barH;

            return (
              <g key={i}>
                <rect
                  x={x}
                  y={y}
                  width={barWidth}
                  height={Math.max(barH, 1)}
                  rx={2}
                  fill={color}
                  opacity={d.count > 0 ? 0.7 : 0.1}
                />
                {/* Label */}
                <text
                  x={x + barWidth / 2}
                  y={CHART_H - 4}
                  textAnchor="middle"
                  className="fill-slate-600"
                  fontSize={chartFonts.axis}
                >
                  {d.label}
                </text>
                {/* Value on top */}
                {d.count > 0 && (
                  <text
                    x={x + barWidth / 2}
                    y={y - 3}
                    textAnchor="middle"
                    className="fill-slate-500"
                    fontSize={chartFonts.axis}
                  >
                    {d.count}
                  </text>
                )}
              </g>
            );
          })}
        </svg>
      </div>
    </div>
  );
});

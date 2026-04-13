/**
 * HabitScoreChart — SVG line chart for habit score history.
 * Renders computeScoreHistory() data. Time range selector: 3mo, 6mo, 1yr, All.
 * Pure SVG, no external chart library. Deep Space aesthetic.
 */

import { useState, useMemo, useRef, useCallback } from "react";
import { computeScoreHistory } from "@/lib/habitScore";
import { resolveHabitColor } from "@/lib/habitColorUtils";
import { cn } from "@/lib/utils";
import { useLanguage } from "@/contexts/LanguageContext";
import type { Habit } from "@/types";

interface HabitScoreChartProps {
  habit: Habit;
}

type TimeRange = "3mo" | "6mo" | "1yr" | "all";
const RANGE_WEEKS: Record<TimeRange, number> = {
  "3mo": 13,
  "6mo": 26,
  "1yr": 52,
  all: 104,
};

const CHART_H = 120;
const CHART_PAD = { top: 8, right: 8, bottom: 20, left: 32 };

export function HabitScoreChart({ habit }: HabitScoreChartProps) {
  const { t } = useLanguage();
  const ts = t as unknown as Record<string, string>;
  const [range, setRange] = useState<TimeRange>("3mo");
  const svgRef = useRef<SVGSVGElement>(null);

  const color = resolveHabitColor(habit.color);

  const data = useMemo(() => computeScoreHistory(habit, RANGE_WEEKS[range]), [habit, range]);

  const buildPath = useCallback(
    (width: number) => {
      if (data.length < 2) return { line: "", area: "" };

      const innerW = width - CHART_PAD.left - CHART_PAD.right;
      const innerH = CHART_H - CHART_PAD.top - CHART_PAD.bottom;

      const points = data.map((d, i) => ({
        x: CHART_PAD.left + (i / (data.length - 1)) * innerW,
        y: CHART_PAD.top + innerH - d.score * innerH,
      }));

      const line = points.map((p, i) => `${i === 0 ? "M" : "L"}${p.x},${p.y}`).join(" ");
      const areaBottom = CHART_PAD.top + innerH;
      const area = `${line} L${points[points.length - 1].x},${areaBottom} L${points[0].x},${areaBottom} Z`;

      return { line, area };
    },
    [data]
  );

  // Use a fixed width for SSR-safe rendering, CSS scales it
  const svgWidth = 320;
  const { line, area } = buildPath(svgWidth);

  const gradientId = `score-grad-${habit.id.slice(0, 8)}`;

  const ranges: TimeRange[] = ["3mo", "6mo", "1yr", "all"];
  const rangeLabels: Record<TimeRange, string> = {
    "3mo": ts.range3mo || "3mo",
    "6mo": ts.range6mo || "6mo",
    "1yr": ts.range1yr || "1yr",
    all: ts.rangeAll || "All",
  };

  // Y-axis labels
  const yLabels = [0, 25, 50, 75, 100];
  const innerH = CHART_H - CHART_PAD.top - CHART_PAD.bottom;

  return (
    <div>
      <div className="flex items-center justify-between mb-2">
        <label className="text-xs font-medium text-muted-foreground">
          {ts.scoreHistory || "Score History"}
        </label>
        <div className="flex gap-1">
          {ranges.map((r) => (
            <button
              key={r}
              onClick={() => setRange(r)}
              className={cn(
                "px-3 py-1.5 rounded-md text-[10px] font-medium transition-colors min-h-[44px]",
                range === r
                  ? "bg-white/[0.1] text-foreground"
                  : "text-muted-foreground hover:text-muted-foreground"
              )}
            >
              {rangeLabels[r]}
            </button>
          ))}
        </div>
      </div>

      <div className="w-full rounded-xl bg-white/[0.03] border border-white/[0.06] overflow-x-auto scrollbar-hide">
        {/* VISUAL-VERIFIED: overflow-x-auto + min-w prevents score chart clipping on narrow mobile */}
        <svg
          ref={svgRef}
          viewBox={`0 0 ${svgWidth} ${CHART_H}`}
          preserveAspectRatio="xMidYMid meet"
          className="min-w-[320px] w-full"
          // VISUAL-VERIFIED: height is fixed constant CHART_H for consistent chart proportions
          style={{ height: CHART_H }}
        >
          <defs>
            <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={color} stopOpacity={0.3} />
              <stop offset="100%" stopColor={color} stopOpacity={0.02} />
            </linearGradient>
          </defs>

          {/* Grid lines + Y labels */}
          {yLabels.map((pct) => {
            const y = CHART_PAD.top + innerH - (pct / 100) * innerH;
            return (
              <g key={pct}>
                <line
                  x1={CHART_PAD.left}
                  y1={y}
                  x2={svgWidth - CHART_PAD.right}
                  y2={y}
                  stroke="white"
                  strokeOpacity={0.04}
                  strokeDasharray="2,4"
                />
                <text
                  x={CHART_PAD.left - 4}
                  y={y + 3}
                  textAnchor="end"
                  className="fill-slate-600"
                  fontSize={8}
                >
                  {pct}%
                </text>
              </g>
            );
          })}

          {/* Area fill */}
          {area && <path d={area} fill={`url(#${gradientId})`} />}

          {/* Line */}
          {line && (
            <path
              d={line}
              fill="none"
              stroke={color}
              strokeWidth={2}
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          )}

          {/* Endpoint dot */}
          {data.length >= 2 &&
            (() => {
              const innerW = svgWidth - CHART_PAD.left - CHART_PAD.right;
              const lastPt = data[data.length - 1];
              const cx = CHART_PAD.left + ((data.length - 1) / (data.length - 1)) * innerW;
              const cy = CHART_PAD.top + innerH - lastPt.score * innerH;
              return <circle cx={cx} cy={cy} r={3} fill={color} />;
            })()}
        </svg>
      </div>
    </div>
  );
}

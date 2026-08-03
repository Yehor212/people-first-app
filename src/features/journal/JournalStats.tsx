/* eslint-disable jsx-a11y/no-noninteractive-tabindex -- The year mosaic scroller must receive focus for keyboard operation. */
/**
 * JournalStats — Advanced statistics view for journal
 *
 * IMPORTANT: This component is still lazy-loaded because it is a dense stats
 * surface with animated SVG charts.
 */

import { memo, useCallback, useEffect, useId, useMemo, useRef, useState } from "react";
import { ArrowLeft, ChevronLeft, ChevronRight, LockKeyhole } from "lucide-react";
import { motion } from "framer-motion";
import { cn, parseLocalDate } from "@/lib/utils";
import { getLocale } from "@/lib/timeUtils";
import { useLanguage } from "@/contexts/LanguageContext";
import type { JournalEntry } from "./types";
import type { MoodType } from "@/types";
import { useChartFontSizes } from "@/lib/chartTokens";
import { YearInPixels } from "./YearInPixels";
import { AnimatedCounter } from "@/components/ui/AnimatedCounter";
import { shouldAnimate } from "@/lib/animationUtils";
import { formatLocalizedCount } from "./journalWordCount";
import { getJournalWeekStart } from "./journalDateUtils";
import { useJournalToday } from "./useJournalToday";

const MOOD_COLORS: Record<MoodType, string> = {
  great: "hsl(var(--mood-great))",
  good: "hsl(var(--mood-good))",
  okay: "hsl(var(--mood-okay))",
  bad: "hsl(var(--mood-bad))",
  terrible: "hsl(var(--mood-terrible))",
};

const MOOD_SCORE: Record<MoodType, number> = {
  terrible: 1,
  bad: 2,
  okay: 3,
  good: 4,
  great: 5,
};

const MOOD_PIXEL_BG: Record<MoodType, string> = {
  great: "bg-[hsl(var(--mood-great))]",
  good: "bg-[hsl(var(--mood-good))]",
  okay: "bg-[hsl(var(--mood-okay))]",
  bad: "bg-[hsl(var(--mood-bad))]",
  terrible: "bg-[hsl(var(--mood-terrible))]",
};

type MoodDistributionPoint = {
  name: string;
  value: number;
  color: string;
};

type MoodTimelinePoint = {
  week: string;
  avg: number;
};

const SVG_CHART = {
  width: 320,
  height: 140,
  left: 28,
  right: 10,
  top: 12,
  bottom: 28,
} as const;

const SVG_INNER_WIDTH = SVG_CHART.width - SVG_CHART.left - SVG_CHART.right;
const SVG_INNER_HEIGHT = SVG_CHART.height - SVG_CHART.top - SVG_CHART.bottom;

function DonutMoodChart({ data }: { data: MoodDistributionPoint[] }) {
  const total = data.reduce((sum, entry) => sum + entry.value, 0);
  if (total <= 0) return null;

  const radius = 38;
  const circumference = Math.PI * 2 * radius;
  let cumulative = 0;

  return (
    <svg className="h-[120px] w-[120px] flex-shrink-0" viewBox="0 0 120 120" aria-hidden="true">
      <circle
        cx="60"
        cy="60"
        r={radius}
        fill="none"
        stroke="hsl(var(--muted) / 0.35)"
        strokeWidth="18"
      />
      {data.map((entry) => {
        const portion = entry.value / total;
        const dashLength = portion * circumference;
        const dashOffset = -cumulative * circumference;
        cumulative += portion;

        return (
          <circle
            key={entry.name}
            className="journal-chart-slice"
            cx="60"
            cy="60"
            r={radius}
            fill="none"
            stroke={entry.color}
            strokeWidth="18"
            strokeLinecap="round"
            strokeDasharray={`${dashLength} ${circumference}`}
            strokeDashoffset={dashOffset}
            transform="rotate(-90 60 60)"
          >
            <title>{`${entry.name}: ${entry.value}`}</title>
          </circle>
        );
      })}
      <circle cx="60" cy="60" r="26" fill="hsl(var(--card))" />
    </svg>
  );
}

function chartX(index: number, length: number): number {
  if (length <= 1) return SVG_CHART.left + SVG_INNER_WIDTH / 2;
  return SVG_CHART.left + (index / (length - 1)) * SVG_INNER_WIDTH;
}

function scoreY(value: number): number {
  const clamped = Math.min(Math.max(value, 1), 5);
  return SVG_CHART.top + ((5 - clamped) / 4) * SVG_INNER_HEIGHT;
}

function MoodLineChart({
  data,
  axisFontSize,
}: {
  data: MoodTimelinePoint[];
  axisFontSize: number;
}) {
  const points = data.map((entry, index) => ({
    ...entry,
    x: chartX(index, data.length),
    y: scoreY(entry.avg),
  }));
  const linePath = points
    .map((point, index) => `${index === 0 ? "M" : "L"} ${point.x} ${point.y}`)
    .join(" ");

  return (
    <svg className="h-[140px] w-full overflow-visible" viewBox="0 0 320 140" aria-hidden="true">
      {[1, 2, 3, 4, 5].map((score) => {
        const y = scoreY(score);
        return (
          <g key={score}>
            <line
              x1={SVG_CHART.left}
              x2={SVG_CHART.width - SVG_CHART.right}
              y1={y}
              y2={y}
              stroke="hsl(var(--border) / 0.35)"
              strokeDasharray="3 4"
            />
            <text
              x={SVG_CHART.left - 8}
              y={y + 4}
              fill="hsl(var(--muted-foreground))"
              fontSize={axisFontSize}
              textAnchor="end"
            >
              {score}
            </text>
          </g>
        );
      })}
      <path
        className="journal-chart-line"
        d={linePath}
        fill="none"
        stroke="hsl(var(--primary))"
        strokeWidth="2.5"
        strokeLinecap="round"
        strokeLinejoin="round"
        vectorEffect="non-scaling-stroke"
      />
      {points.map((point) => (
        <circle
          key={`${point.week}-${point.avg}`}
          cx={point.x}
          cy={point.y}
          r="3.2"
          fill="hsl(var(--primary))"
        >
          <title>{`${point.week}: ${point.avg.toFixed(1)}`}</title>
        </circle>
      ))}
      {points.map((point, index) => (
        <text
          key={`${point.week}-${index}`}
          x={point.x}
          y={SVG_CHART.height - 6}
          fill="hsl(var(--muted-foreground))"
          fontSize={axisFontSize}
          textAnchor="middle"
        >
          {point.week}
        </text>
      ))}
    </svg>
  );
}

/**
 * useChartPathAnimation — Applies stroke-dasharray draw animation
 * to local SVG chart paths on scroll-into-view.
 * EP6_US006 T1: Chart Path Drawing Animation
 */
function useChartPathAnimation() {
  const containerRef = useRef<HTMLDivElement>(null);
  const hasAnimatedRef = useRef(false);

  const applyAnimation = useCallback(() => {
    if (hasAnimatedRef.current) return;
    hasAnimatedRef.current = true;

    const el = containerRef.current;
    if (!el) return;

    const paths = el.querySelectorAll<SVGGeometryElement>(".journal-chart-line");

    paths.forEach((path, idx) => {
      const length = path.getTotalLength();
      path.style.setProperty("--path-length", String(length));
      path.style.strokeDasharray = String(length);
      path.style.strokeDashoffset = String(length);
      path.style.animation = `chart-path-draw 1.2s ease-out ${idx * 0.1}s forwards`;
    });
  }, []);

  useEffect(() => {
    const animate = shouldAnimate();
    if (!animate) return;

    const el = containerRef.current;
    if (!el) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          // Small delay to ensure SVG paths have rendered.
          requestAnimationFrame(() => applyAnimation());
          observer.disconnect();
        }
      },
      { threshold: 0.3 }
    );

    observer.observe(el);
    return () => observer.disconnect();
  }, [applyAnimation]);

  return containerRef;
}

interface JournalStatsProps {
  entries: JournalEntry[];
  onBack: () => void;
  today?: string;
  privateMode?: boolean;
}

export const JournalStats = memo(function JournalStats({
  entries,
  onBack,
  today,
  privateMode = false,
}: JournalStatsProps) {
  const { t, language } = useLanguage();
  const locale = getLocale(language);
  const localizedWeekStart = getJournalWeekStart(language);
  const ts = t as unknown as Record<string, string>;
  const chartFonts = useChartFontSizes();
  const lifecycleToday = useJournalToday();
  const currentDay = today ?? lifecycleToday;
  const currentYear = parseLocalDate(currentDay).getFullYear();
  const [pixelYear, setPixelYear] = useState(currentYear);
  const previousCurrentYearRef = useRef(currentYear);
  const pixelGridHeadingId = useId();
  const pixelGridSummaryId = useId();
  const standalonePixelHeadingId = useId();

  useEffect(() => {
    const previousCurrentYear = previousCurrentYearRef.current;
    previousCurrentYearRef.current = currentYear;
    if (previousCurrentYear === currentYear) return;
    setPixelYear((visibleYear) =>
      visibleYear === previousCurrentYear ? currentYear : visibleYear,
    );
  }, [currentYear]);

  // T1: Chart path drawing animation refs
  const moodTimelineRef = useChartPathAnimation();

  const moodLabels = useMemo<Record<MoodType, string>>(
    () => ({
      great: ts.moodGreat || "Great",
      good: ts.moodGood || "Good",
      okay: ts.moodOkay || "Okay",
      bad: ts.moodBad || "Bad",
      terrible: ts.moodTerrible || "Terrible",
    }),
    [ts]
  );

  // Mood distribution
  const moodDist = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const e of entries) {
      if (e.mood) counts[e.mood] = (counts[e.mood] || 0) + 1;
    }
    return Object.entries(counts).map(([mood, count]) => ({
      name: moodLabels[mood as MoodType] || mood,
      value: count,
      color: MOOD_COLORS[mood as MoodType] || "#888",
    }));
  }, [entries, moodLabels]);

  // Mood over time (weekly average)
  const moodTimeline = useMemo(() => {
    const entriesWithMood = entries
      .filter((e) => e.mood)
      .sort((a, b) => a.date.localeCompare(b.date) || a.createdAt - b.createdAt);
    if (entriesWithMood.length === 0) return [];

    // Group by week
    const weeks = new Map<string, number[]>();
    for (const e of entriesWithMood) {
      const d = parseLocalDate(e.date);
      const weekStart = new Date(d);
      const dow = d.getDay();
      weekStart.setDate(d.getDate() - ((dow - localizedWeekStart + 7) % 7));
      const key = `${weekStart.getFullYear()}-${String(weekStart.getMonth() + 1).padStart(2, "0")}-${String(weekStart.getDate()).padStart(2, "0")}`;
      if (!weeks.has(key)) weeks.set(key, []);
      if (e.mood) weeks.get(key)?.push(MOOD_SCORE[e.mood]);
    }

    return [...weeks.entries()].slice(-12).map(([week, scores]) => ({
      week: new Date(week + "T12:00:00").toLocaleDateString(locale, {
        month: "short",
        day: "numeric",
      }),
      avg: Math.round((scores.reduce((a, b) => a + b, 0) / scores.length) * 10) / 10,
    }));
  }, [entries, locale, localizedWeekStart]);

  // Year in Pixels — build month×day grid with mood colors
  const pixelData = useMemo(() => {
    // Build map of date -> max createdAt in one pass (O(n) instead of O(n²))
    const dateMaxCreatedAt = new Map<string, number>();
    for (const e of entries) {
      if (e.mood && e.date.startsWith(String(pixelYear))) {
        const current = dateMaxCreatedAt.get(e.date) ?? 0;
        if (e.createdAt > current) dateMaxCreatedAt.set(e.date, e.createdAt);
      }
    }

    // Map date → mood for selected year, keeping only the entry with max createdAt
    const moodByDate = new Map<string, MoodType>();
    for (const e of entries) {
      if (e.mood && e.date.startsWith(String(pixelYear))) {
        if (e.createdAt === dateMaxCreatedAt.get(e.date)) {
          moodByDate.set(e.date, e.mood);
        }
      }
    }

    // Has-entry-without-mood set
    const entryWithoutMood = new Set<string>();
    for (const e of entries) {
      if (!e.mood && e.date.startsWith(String(pixelYear))) {
        entryWithoutMood.add(e.date);
      }
    }

    // Build 12 months of day cells
    const months: Array<{
      month: number;
      label: string;
      days: Array<{
        date: string;
        mood?: MoodType;
        hasEntry: boolean;
        isFuture: boolean;
      }>;
    }> = [];

    const todayStr = currentDay;
    const monthFormatter = new Intl.DateTimeFormat(language, {
      month: "short",
    });

    for (let m = 0; m < 12; m++) {
      const daysInMonth = new Date(pixelYear, m + 1, 0).getDate();
      const days: (typeof months)[0]["days"] = [];

      for (let d = 1; d <= daysInMonth; d++) {
        const dateStr = `${pixelYear}-${String(m + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
        const isFuture = dateStr > todayStr;
        days.push({
          date: dateStr,
          mood: moodByDate.get(dateStr),
          hasEntry: moodByDate.has(dateStr) || entryWithoutMood.has(dateStr),
          isFuture,
        });
      }

      months.push({
        month: m,
        label: monthFormatter.format(new Date(pixelYear, m, 1)),
        days,
      });
    }

    // Stats for the year
    const totalDaysWithMood = moodByDate.size;
    const totalDaysWithEntry = moodByDate.size + entryWithoutMood.size;

    return { months, totalDaysWithMood, totalDaysWithEntry };
  }, [currentDay, entries, pixelYear, language]);
  const pixelGridSummary = useMemo(() => {
    const countLabel = formatLocalizedCount(
      pixelData.totalDaysWithEntry,
      language,
      ts,
      "journalStatsDayCount",
      ts.journalStatsDays || "days"
    );
    const entryDetails = pixelData.months
      .flatMap((month) => month.days)
      .filter((day) => day.hasEntry && !day.isFuture)
      .map(
        (day) =>
          `${day.date}: ${day.mood ? moodLabels[day.mood] : ts.journalStatsNoMood || "No mood"}`
      );

    return entryDetails.length > 0 ? `${countLabel}. ${entryDetails.join(", ")}` : countLabel;
  }, [language, moodLabels, pixelData, ts]);

  if (privateMode) {
    return (
      <>
        <div className="flex items-center justify-between px-4 py-3 border-b border-border/30 bg-background/80 backdrop-blur-xl">
          <button
            onClick={onBack}
            className="p-2 rounded-lg hover:bg-muted/50 min-w-[44px] min-h-[44px] flex items-center justify-center"
            aria-label={ts.back || "Back"}
          >
            <ArrowLeft className="w-5 h-5 text-foreground rtl:scale-x-[-1]" />
          </button>
          <h2 className="text-base font-bold text-foreground">
            {ts.journalStatsTitle || "Diary Statistics"}
          </h2>
          <div className="w-[44px]" />
        </div>

        <div className="flex-1 overflow-y-auto px-4 py-4">
          <section
            data-testid="journal-stats-private-mode"
            aria-label={ts.privateMode || "Private"}
            className="flex min-h-[280px] flex-col items-center justify-center rounded-2xl border border-border/25 bg-card/45 px-5 py-10 text-center backdrop-blur-xl"
          >
            <span className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl border border-primary/20 bg-primary/10 text-primary">
              <LockKeyhole className="h-6 w-6" aria-hidden="true" />
            </span>
            <h3 className="text-base font-bold text-foreground">{ts.privateMode || "Private"}</h3>
            <p className="mt-2 max-w-[260px] text-sm leading-relaxed text-muted-foreground">
              {ts.journalPrivateEntryHint || "Unlock private mode to view this memory."}
            </p>
          </section>
        </div>
      </>
    );
  }

  return (
    <>
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-border/30 bg-background/80 backdrop-blur-xl">
        <button
          onClick={onBack}
          className="p-2 rounded-lg hover:bg-muted/50 min-w-[44px] min-h-[44px] flex items-center justify-center"
          aria-label={ts.back || "Back"}
        >
          <ArrowLeft className="w-5 h-5 text-foreground rtl:scale-x-[-1]" />
        </button>
        <h2 className="text-base font-bold text-foreground">
          {ts.journalStatsTitle || "Diary Statistics"}
        </h2>
        <div className="w-[44px]" />
      </div>

      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-5">
        {entries.length === 0 ? (
          <div className="text-center py-12">
            <p className="text-sm text-muted-foreground">
              {ts.journalStatsEmpty || "Start writing to see your statistics"}
            </p>
          </div>
        ) : (
          <>
            {/* Summary cards — T2: AnimatedCounter with spring overshoot */}
            <div className="grid grid-cols-1 gap-2.5">
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0 }}
                className="p-3 rounded-xl bg-card/70 backdrop-blur-sm border border-border/20"
              >
                <p className="whitespace-normal break-words text-xs uppercase tracking-wider text-muted-foreground/60">
                  {ts.journalStatsTotal || "Total Entries"}
                </p>
                <p className="text-lg font-bold text-foreground mt-0.5">
                  <AnimatedCounter target={entries.length} />
                </p>
              </motion.div>
            </div>

            {/* Year in Pixels — mood mosaic */}
            <div className="p-4 rounded-xl bg-card/70 backdrop-blur-sm border border-border/20">
              {/* Header with year navigation */}
              <div className="flex items-center justify-between mb-3">
                <h3
                  id={pixelGridHeadingId}
                  className="text-xs font-bold text-muted-foreground/50 uppercase tracking-widest"
                >
                  {ts.journalStatsYearInPixels || "Year in Pixels"}
                </h3>
                <div className="flex items-center gap-1">
                  <button
                    onClick={() => setPixelYear((y) => y - 1)}
                    className="flex min-h-[44px] min-w-[44px] items-center justify-center rounded-lg p-2 hover:bg-muted/50"
                    aria-label={ts.previous || "Previous"}
                  >
                    <ChevronLeft className="w-3.5 h-3.5 text-muted-foreground rtl:scale-x-[-1]" />
                  </button>
                  <span className="text-xs font-semibold text-foreground tabular-nums min-w-[40px] text-center">
                    {pixelYear}
                  </span>
                  <button
                    onClick={() => setPixelYear((y) => Math.min(y + 1, currentYear))}
                    disabled={pixelYear >= currentYear}
                    className="flex min-h-[44px] min-w-[44px] items-center justify-center rounded-lg p-2 hover:bg-muted/50 disabled:opacity-50"
                    aria-label={ts.next || "Next"}
                  >
                    <ChevronRight className="w-3.5 h-3.5 text-muted-foreground rtl:scale-x-[-1]" />
                  </button>
                </div>
              </div>

              {/* Pixel grid — 12 months × up to 31 days */}
              <div
                className="-mx-1 overflow-x-auto rounded-md px-1 scrollbar-hide focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/60 focus-visible:ring-offset-2 focus-visible:ring-offset-background"
                role="region"
                tabIndex={0}
                aria-labelledby={pixelGridHeadingId}
                aria-describedby={pixelGridSummaryId}
              >
                <p id={pixelGridSummaryId} className="sr-only">
                  {pixelGridSummary}
                </p>
                <div
                  className="grid min-w-[calc(36rem*var(--font-scale,1))] grid-cols-[auto_repeat(31,1fr)] gap-[3px]"
                  aria-hidden="true"
                >
                  {pixelData.months.map((monthData) => (
                    <div key={monthData.month} className="contents">
                      {/* Month label */}
                      <div className="flex min-h-[calc(1rem*var(--font-scale,1))] items-center pe-1.5">
                        <span className="whitespace-normal break-words text-xs capitalize leading-tight text-muted-foreground/60">
                          {monthData.label}
                        </span>
                      </div>
                      {/* Day cells */}
                      {Array.from({ length: 31 }, (_, dayIdx) => {
                        const dayData = monthData.days[dayIdx];
                        if (!dayData) {
                          // Empty cell for months with <31 days
                          return <div key={dayIdx} className="w-full aspect-square" />;
                        }
                        return (
                          <div
                            key={dayIdx}
                            className={cn(
                              "w-full aspect-square rounded-[2px] motion-safe:transition-colors",
                              dayData.isFuture
                                ? "bg-muted/20"
                                : dayData.mood
                                  ? MOOD_PIXEL_BG[dayData.mood]
                                  : dayData.hasEntry
                                    ? "bg-primary/30"
                                    : "bg-muted/40"
                            )}
                          />
                        );
                      })}
                    </div>
                  ))}
                </div>
              </div>

              {/* Legend */}
              <div className="mt-3 flex flex-col items-stretch gap-2 min-[420px]:flex-row min-[420px]:items-start min-[420px]:justify-between border-t border-border/10 pt-2">
                <div className="flex items-center gap-2.5 flex-wrap">
                  {(["great", "good", "okay", "bad", "terrible"] as MoodType[]).map((mood) => (
                    <span
                      key={mood}
                      className="flex items-center gap-1 whitespace-normal break-words text-xs text-muted-foreground/60"
                    >
                      <span className={cn("w-2 h-2 rounded-[1px]", MOOD_PIXEL_BG[mood])} />
                      {moodLabels[mood]}
                    </span>
                  ))}
                  <span className="flex items-center gap-1 whitespace-normal break-words text-xs text-muted-foreground/60">
                    <span className="w-2 h-2 rounded-[1px] bg-primary/30" />
                    {ts.journalStatsNoMood || "No mood"}
                  </span>
                </div>
                <span className="whitespace-normal break-words text-xs tabular-nums text-muted-foreground/60 min-[420px]:flex-shrink-0">
                  {formatLocalizedCount(
                    pixelData.totalDaysWithEntry,
                    language,
                    ts,
                    "journalStatsDayCount",
                    ts.journalStatsDays || "days"
                  )}
                </span>
              </div>
            </div>

            {/* Mood distribution */}
            {moodDist.length > 0 && (
              <div className="p-4 rounded-xl bg-card/70 backdrop-blur-sm border border-border/20">
                <h3 className="text-xs font-bold text-muted-foreground/50 uppercase tracking-widest mb-3">
                  {ts.journalStatsMoodDist || "Mood Distribution"}
                </h3>
                <div
                  className="flex items-center gap-4"
                  role="img"
                  aria-label={`${ts.journalStatsMoodDist || "Mood Distribution"}: ${moodDist.map((m) => `${m.name} ${m.value}`).join(", ")}`}
                >
                  <DonutMoodChart data={moodDist} />
                  <div className="flex-1 space-y-1">
                    {moodDist.map((m) => (
                      <div key={m.name} className="flex items-center gap-2">
                        <div
                          className="w-2.5 h-2.5 rounded-full flex-shrink-0"
                          style={{ backgroundColor: m.color }}
                        />
                        <span className="text-xs text-foreground flex-1">{m.name}</span>
                        <span className="text-xs text-muted-foreground tabular-nums">
                          {m.value}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {/* Mood over time — T1: chart path draw animation */}
            {moodTimeline.length > 2 && (
              <div
                ref={moodTimelineRef}
                className="p-4 rounded-xl bg-card/70 backdrop-blur-sm border border-border/20"
                role="img"
                aria-label={`${ts.journalStatsMoodTime || "Mood Over Time"}: ${moodTimeline.map((w) => `${w.week} ${w.avg.toFixed(1)}`).join(", ")}`}
              >
                <h3 className="text-xs font-bold text-muted-foreground/50 uppercase tracking-widest mb-3">
                  {ts.journalStatsMoodTime || "Mood Over Time"}
                </h3>
                <MoodLineChart data={moodTimeline} axisFontSize={chartFonts.axis} />
              </div>
            )}
          </>
        )}

        {/* Year in Pixels — mood heatmap grid */}
        {entries.length > 0 && (
          <div className="mt-6">
            <h3
              id={standalonePixelHeadingId}
              className="text-sm font-semibold text-foreground mb-3 px-1"
            >
              {ts.journalYearInPixels || "Year in Pixels"}
            </h3>
            <YearInPixels entries={entries} labelledById={standalonePixelHeadingId} />
          </div>
        )}
      </div>
    </>
  );
});

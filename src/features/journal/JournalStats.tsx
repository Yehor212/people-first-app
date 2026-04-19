/**
 * JournalStats — Advanced statistics view for journal
 *
 * IMPORTANT: This component imports Recharts (CJS) and MUST be lazy-loaded
 * to avoid TDZ errors. Use lazyWithRetry() or React.lazy() from the parent.
 */

import { useMemo, useState, useRef, useEffect, useCallback, memo } from "react";
import { ArrowLeft, ChevronLeft, ChevronRight, Flame } from "lucide-react";
import { motion } from "framer-motion";
import {
  PieChart,
  Pie,
  Cell,
  LineChart,
  Line,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import { cn } from "@/lib/utils";
import { useLanguage } from "@/contexts/LanguageContext";
import type { JournalEntry } from "./types";
import { countWords } from "./types";
import { StickerRenderer } from "./StickerRenderer";
import type { MoodType } from "@/types";
import { useChartFontSizes } from "@/lib/chartTokens";
import { YearInPixels } from "./YearInPixels";
import { MoodCorrelations } from "./MoodCorrelations";
import { AnimatedCounter } from "@/components/ui/AnimatedCounter";
import { shouldAnimate } from "@/lib/animationUtils";
import { formatDecimal } from "@/lib/timeUtils";

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
  great: "bg-green-400",
  good: "bg-emerald-400",
  okay: "bg-amber-400",
  bad: "bg-orange-400",
  terrible: "bg-red-400",
};

/**
 * useChartPathAnimation — Applies stroke-dasharray draw animation
 * to all <path> elements inside a Recharts container on scroll-into-view.
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

    const paths = el.querySelectorAll<SVGPathElement>(
      ".recharts-line-curve, .recharts-bar-rectangle path, .recharts-pie-sector path"
    );

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
          // Small delay to ensure Recharts has rendered paths
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

/** StreakFireIcon — Fire icon with scale pulse on mount (EP6_US006 T2) */
const StreakFireIcon = memo(function StreakFireIcon() {
  const animate = shouldAnimate();
  return (
    <motion.span
      initial={animate ? { scale: 1 } : false}
      animate={animate ? { scale: [1, 1.2, 1] } : undefined}
      transition={animate ? { duration: 0.5, ease: "easeOut" } : undefined}
      className="inline-flex"
      aria-hidden="true"
    >
      <Flame className="w-4 h-4 text-orange-500" />
    </motion.span>
  );
});

interface JournalStatsProps {
  entries: JournalEntry[];
  onBack: () => void;
}

export const JournalStats = memo(function JournalStats({ entries, onBack }: JournalStatsProps) {
  const { t, language } = useLanguage();
  const ts = t as unknown as Record<string, string>;
  const chartFonts = useChartFontSizes();
  const [pixelYear, setPixelYear] = useState(() => new Date().getFullYear());

  // T1: Chart path drawing animation refs
  const moodTimelineRef = useChartPathAnimation();
  const frequencyRef = useChartPathAnimation();

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

  const dayNames = useMemo(() => {
    const formatter = new Intl.DateTimeFormat(language, { weekday: "short" });
    return Array.from({ length: 7 }, (_, i) => formatter.format(new Date(2025, 0, 5 + i)));
  }, [language]);

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
    const entriesWithMood = entries.filter((e) => e.mood).sort((a, b) => a.createdAt - b.createdAt);
    if (entriesWithMood.length === 0) return [];

    // Group by week
    const weeks = new Map<string, number[]>();
    for (const e of entriesWithMood) {
      const d = new Date(e.createdAt);
      const weekStart = new Date(d);
      const dow = d.getDay();
      weekStart.setDate(d.getDate() - (dow === 0 ? 6 : dow - 1));
      const key = `${weekStart.getFullYear()}-${String(weekStart.getMonth() + 1).padStart(2, "0")}-${String(weekStart.getDate()).padStart(2, "0")}`;
      if (!weeks.has(key)) weeks.set(key, []);
      if (e.mood) weeks.get(key)?.push(MOOD_SCORE[e.mood]);
    }

    return [...weeks.entries()].slice(-12).map(([week, scores]) => ({
      week: new Date(week + "T00:00:00").toLocaleDateString(language, {
        month: "short",
        day: "numeric",
      }),
      avg: Math.round((scores.reduce((a, b) => a + b, 0) / scores.length) * 10) / 10,
    }));
  }, [entries, language]);

  // Writing frequency (entries per week, last 8 weeks)
  const frequency = useMemo(() => {
    const now = Date.now();
    const weeks: { week: string; count: number }[] = [];

    for (let i = 7; i >= 0; i--) {
      const weekStart = now - (i + 1) * 7 * 86400000;
      const weekEnd = now - i * 7 * 86400000;
      const count = entries.filter((e) => e.createdAt >= weekStart && e.createdAt < weekEnd).length;
      const label = new Date(weekStart).toLocaleDateString(language, {
        month: "short",
        day: "numeric",
      });
      weeks.push({ week: label, count });
    }

    return weeks;
  }, [entries, language]);

  // Tag cloud
  const tagCloud = useMemo(() => {
    const counts = new Map<string, number>();
    for (const e of entries) {
      for (const tag of e.tags) {
        counts.set(tag, (counts.get(tag) || 0) + 1);
      }
    }
    return [...counts.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 20)
      .map(([tag, count]) => ({ tag, count }));
  }, [entries]);

  // Streaks
  const streakData = useMemo(() => {
    const dates = [...new Set(entries.map((e) => e.date))].sort();
    if (dates.length === 0) return { current: 0, longest: 0, thisMonth: 0, avgPerWeek: 0 };

    // Current streak (from today backwards)
    const today = new Date();
    const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`;
    const dateSet = new Set(dates);

    let current = 0;
    const checkDate = new Date(today);
    // Allow starting from today or yesterday
    if (!dateSet.has(todayStr)) {
      checkDate.setDate(checkDate.getDate() - 1);
    }
    while (current < 365) {
      const str = `${checkDate.getFullYear()}-${String(checkDate.getMonth() + 1).padStart(2, "0")}-${String(checkDate.getDate()).padStart(2, "0")}`;
      if (dateSet.has(str)) {
        current++;
        checkDate.setDate(checkDate.getDate() - 1);
      } else {
        break;
      }
    }

    // Longest streak
    let longest = 0;
    let streak = 1;
    for (let i = 1; i < dates.length; i++) {
      const prev = new Date(dates[i - 1] + "T00:00:00");
      const curr = new Date(dates[i] + "T00:00:00");
      const diff = Math.round((curr.getTime() - prev.getTime()) / 86400000);
      if (diff === 1) {
        streak++;
      } else {
        longest = Math.max(longest, streak);
        streak = 1;
      }
    }
    longest = Math.max(longest, streak);

    // This month
    const monthStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}`;
    const thisMonth = entries.filter((e) => e.date.startsWith(monthStr)).length;

    // Avg per week (over last 4 weeks)
    const fourWeeksAgo = Date.now() - 28 * 86400000;
    const recentCount = entries.filter((e) => e.createdAt >= fourWeeksAgo).length;
    const avgPerWeek = Math.round((recentCount / 4) * 10) / 10;

    return { current, longest, thisMonth, avgPerWeek };
  }, [entries]);

  // Most active day of week
  const dayActivity = useMemo(() => {
    const counts = new Array(7).fill(0);
    for (const e of entries) {
      const day = new Date(e.date + "T00:00:00").getDay();
      counts[day]++;
    }
    return dayNames.map((name, i) => ({ day: name, count: counts[i] }));
  }, [entries, dayNames]);

  const totalWords = useMemo(() => {
    return entries.reduce((sum, e) => sum + countWords(e.content), 0);
  }, [entries]);

  // Most used stickers
  const topStickers = useMemo(() => {
    const counts = new Map<string, number>();
    for (const e of entries) {
      for (const s of e.stickers) {
        counts.set(s, (counts.get(s) || 0) + 1);
      }
    }
    return [...counts.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .map(([sticker, count]) => ({ sticker, count }));
  }, [entries]);

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

    const today = new Date();
    const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`;
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
  }, [entries, pixelYear, language]);

  const currentYear = new Date().getFullYear();

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
            <div className="grid grid-cols-2 gap-2.5">
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0 }}
                className="p-3 rounded-xl bg-card/70 backdrop-blur-sm border border-border/20"
              >
                <p className="text-[10px] text-muted-foreground/60 uppercase tracking-wider">
                  {ts.journalStatsTotal || "Total Entries"}
                </p>
                <p className="text-lg font-bold text-foreground mt-0.5">
                  <AnimatedCounter target={entries.length} />
                </p>
              </motion.div>

              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.05 }}
                className="p-3 rounded-xl bg-card/70 backdrop-blur-sm border border-border/20"
              >
                <p className="text-[10px] text-muted-foreground/60 uppercase tracking-wider">
                  {ts.journalStatsTotalWords || "Total Words"}
                </p>
                <p className="text-lg font-bold text-foreground mt-0.5">
                  <AnimatedCounter target={totalWords} />
                </p>
              </motion.div>

              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.1 }}
                className="p-3 rounded-xl bg-card/70 backdrop-blur-sm border border-border/20"
              >
                <p className="text-[10px] text-muted-foreground/60 uppercase tracking-wider flex items-center gap-1">
                  <StreakFireIcon />
                  {ts.journalStatsStreaks || "Current Streak"}
                </p>
                <p className="text-lg font-bold text-foreground mt-0.5">
                  <AnimatedCounter
                    target={streakData.current}
                    suffix={` ${ts.journalStatsDays || "days"}`}
                  />
                </p>
              </motion.div>

              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.15 }}
                className="p-3 rounded-xl bg-card/70 backdrop-blur-sm border border-border/20"
              >
                <p className="text-[10px] text-muted-foreground/60 uppercase tracking-wider flex items-center gap-1">
                  <StreakFireIcon />
                  {ts.journalStatsLongestStreak || "Longest Streak"}
                </p>
                <p className="text-lg font-bold text-foreground mt-0.5">
                  <AnimatedCounter
                    target={streakData.longest}
                    suffix={` ${ts.journalStatsDays || "days"}`}
                  />
                </p>
              </motion.div>

              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.2 }}
                className="p-3 rounded-xl bg-card/70 backdrop-blur-sm border border-border/20"
              >
                <p className="text-[10px] text-muted-foreground/60 uppercase tracking-wider">
                  {ts.journalStatsThisMonth || "This Month"}
                </p>
                <p className="text-lg font-bold text-foreground mt-0.5">
                  <AnimatedCounter target={streakData.thisMonth} />
                </p>
              </motion.div>

              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.25 }}
                className="p-3 rounded-xl bg-card/70 backdrop-blur-sm border border-border/20"
              >
                <p className="text-[10px] text-muted-foreground/60 uppercase tracking-wider">
                  {ts.journalStatsAvgPerWeek || "Avg / Week"}
                </p>
                <p className="text-lg font-bold text-foreground mt-0.5">
                  <AnimatedCounter target={streakData.avgPerWeek} format={(v) => formatDecimal(v, language)} />
                </p>
              </motion.div>
            </div>

            {/* Year in Pixels — mood mosaic */}
            <div className="p-4 rounded-xl bg-card/70 backdrop-blur-sm border border-border/20">
              {/* Header with year navigation */}
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-xs font-bold text-muted-foreground/50 uppercase tracking-widest">
                  {ts.journalStatsYearInPixels || "Year in Pixels"}
                </h3>
                <div className="flex items-center gap-1">
                  <button
                    onClick={() => setPixelYear((y) => y - 1)}
                    className="p-1.5 rounded-lg hover:bg-muted/50 min-w-[32px] min-h-[32px] flex items-center justify-center"
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
                    className="p-1.5 rounded-lg hover:bg-muted/50 disabled:opacity-50 min-w-[32px] min-h-[32px] flex items-center justify-center"
                    aria-label={ts.next || "Next"}
                  >
                    <ChevronRight className="w-3.5 h-3.5 text-muted-foreground rtl:scale-x-[-1]" />
                  </button>
                </div>
              </div>

              {/* Pixel grid — 12 months × up to 31 days */}
              <div className="overflow-x-auto scrollbar-hide -mx-1 px-1">
                <div className="grid gap-[3px] grid-cols-[auto_repeat(31,1fr)]">
                  {pixelData.months.map((monthData) => (
                    <div key={monthData.month} className="contents">
                      {/* Month label */}
                      <div className="flex items-center pe-1.5 h-[14px]">
                        <span className="text-[9px] text-muted-foreground/60 capitalize leading-none whitespace-nowrap">
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
                              "w-full aspect-square rounded-[2px] transition-colors",
                              dayData.isFuture
                                ? "bg-muted/20"
                                : dayData.mood
                                  ? MOOD_PIXEL_BG[dayData.mood]
                                  : dayData.hasEntry
                                    ? "bg-primary/30"
                                    : "bg-muted/40"
                            )}
                            title={`${dayData.date}${dayData.mood ? ` — ${moodLabels[dayData.mood]}` : ""}`}
                          />
                        );
                      })}
                    </div>
                  ))}
                </div>
              </div>

              {/* Legend */}
              <div className="flex items-center justify-between mt-3 pt-2 border-t border-border/10">
                <div className="flex items-center gap-2.5 flex-wrap">
                  {(["great", "good", "okay", "bad", "terrible"] as MoodType[]).map((mood) => (
                    <span
                      key={mood}
                      className="flex items-center gap-1 text-[9px] text-muted-foreground/60"
                    >
                      <span className={cn("w-2 h-2 rounded-[1px]", MOOD_PIXEL_BG[mood])} />
                      {moodLabels[mood]}
                    </span>
                  ))}
                  <span className="flex items-center gap-1 text-[9px] text-muted-foreground/60">
                    <span className="w-2 h-2 rounded-[1px] bg-primary/30" />
                    {ts.journalStatsNoMood || "No mood"}
                  </span>
                </div>
                <span className="text-[9px] text-muted-foreground/60 tabular-nums flex-shrink-0">
                  {pixelData.totalDaysWithEntry} {ts.journalStatsDays || "days"}
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
                  <ResponsiveContainer width="100%" height={120}>
                    <PieChart>
                      <Pie
                        data={moodDist}
                        cx="50%"
                        cy="50%"
                        innerRadius={30}
                        outerRadius={55}
                        dataKey="value"
                        stroke="none"
                      >
                        {moodDist.map((entry, idx) => (
                          <Cell key={idx} fill={entry.color} />
                        ))}
                      </Pie>
                    </PieChart>
                  </ResponsiveContainer>
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
                aria-label={`${ts.journalStatsMoodTime || "Mood Over Time"}: ${moodTimeline.map((w) => `${w.week} ${formatDecimal(w.avg, language)}`).join(", ")}`}
              >
                <h3 className="text-xs font-bold text-muted-foreground/50 uppercase tracking-widest mb-3">
                  {ts.journalStatsMoodTime || "Mood Over Time"}
                </h3>
                <ResponsiveContainer width="100%" height={140}>
                  <LineChart data={moodTimeline}>
                    <XAxis dataKey="week" tick={{ fontSize: chartFonts.axis }} stroke="#888" />
                    <YAxis
                      domain={[1, 5]}
                      tick={{ fontSize: chartFonts.axis }}
                      stroke="#888"
                      width={20}
                    />
                    <Tooltip
                      contentStyle={{
                        fontSize: chartFonts.tooltip,
                        borderRadius: 8,
                        border: "none",
                        boxShadow: "0 4px 12px rgba(0,0,0,0.1)",
                      }}
                    />
                    <Line
                      type="monotone"
                      dataKey="avg"
                      stroke="#818cf8"
                      strokeWidth={2}
                      dot={{ r: 3 }}
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            )}

            {/* Writing frequency — T1: chart path draw animation */}
            {frequency.some((f) => f.count > 0) && (
              <div
                ref={frequencyRef}
                className="p-4 rounded-xl bg-card/70 backdrop-blur-sm border border-border/20"
                role="img"
                aria-label={`${ts.journalStatsFrequency || "Writing Frequency"}: ${frequency
                  .filter((f) => f.count > 0)
                  .map((f) => `${f.week} ${f.count}`)
                  .join(", ")}`}
              >
                <h3 className="text-xs font-bold text-muted-foreground/50 uppercase tracking-widest mb-3">
                  {ts.journalStatsFrequency || "Writing Frequency"}
                </h3>
                <ResponsiveContainer width="100%" height={120}>
                  <BarChart data={frequency}>
                    <XAxis dataKey="week" tick={{ fontSize: chartFonts.axis }} stroke="#888" />
                    <YAxis
                      tick={{ fontSize: chartFonts.axis }}
                      stroke="#888"
                      width={20}
                      allowDecimals={false}
                    />
                    <Tooltip
                      contentStyle={{
                        fontSize: chartFonts.tooltip,
                        borderRadius: 8,
                        border: "none",
                        boxShadow: "0 4px 12px rgba(0,0,0,0.1)",
                      }}
                    />
                    <Bar dataKey="count" fill="#818cf8" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}

            {/* Most active day */}
            <div className="p-4 rounded-xl bg-card/70 backdrop-blur-sm border border-border/20">
              <h3 className="text-xs font-bold text-muted-foreground/50 uppercase tracking-widest mb-3">
                {ts.journalStatsMostActiveDay || "Most Active Day"}
              </h3>
              <div className="flex items-end gap-1.5 h-16">
                {dayActivity.map((d) => {
                  const maxCount = Math.max(...dayActivity.map((x) => x.count), 1);
                  const height = (d.count / maxCount) * 100;
                  return (
                    <div key={d.day} className="flex-1 flex flex-col items-center gap-1">
                      <div
                        className={cn(
                          "w-full rounded-t-md transition-all",
                          d.count > 0 ? "bg-primary/60" : "bg-muted/30"
                        )}
                        style={{ height: `${Math.max(height, 4)}%` }}
                      />
                      <span className="text-[10px] text-muted-foreground/60">{d.day}</span>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Tag cloud */}
            {tagCloud.length > 0 && (
              <div className="p-4 rounded-xl bg-card/70 backdrop-blur-sm border border-border/20">
                <h3 className="text-xs font-bold text-muted-foreground/50 uppercase tracking-widest mb-3">
                  {ts.journalStatsTagCloud || "Top Tags"}
                </h3>
                <div className="flex flex-wrap gap-1.5">
                  {tagCloud.map(({ tag, count }) => {
                    const maxCount = tagCloud[0].count;
                    const size = 10 + (count / maxCount) * 6; // 10-16px
                    return (
                      <span
                        key={tag}
                        className="px-2 py-0.5 rounded-full bg-primary/8 text-primary/80"
                        style={{ fontSize: `${size}px` }}
                      >
                        #{tag} <span className="text-muted-foreground/50">{count}</span>
                      </span>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Most Used Stickers */}
            {topStickers.length > 0 && (
              <div className="p-4 rounded-xl bg-card/70 backdrop-blur-sm border border-border/20">
                <h3 className="text-xs font-bold text-muted-foreground/50 uppercase tracking-widest mb-3">
                  {ts.journalStatsMostUsedStickers || "Most Used Stickers"}
                </h3>
                <div className="space-y-2">
                  {topStickers.map(({ sticker, count }, idx) => {
                    const maxCount = topStickers[0].count;
                    const widthPct = Math.max((count / maxCount) * 100, 8);
                    return (
                      <div key={idx} className="flex items-center gap-2.5">
                        <StickerRenderer emoji={sticker} size="sm" />
                        <div className="flex-1 h-5 bg-muted/20 rounded-full overflow-hidden">
                          <motion.div
                            className="origin-left h-full w-full bg-primary/40 rounded-full"
                            initial={{ scaleX: 0 }}
                            animate={{ scaleX: widthPct / 100 }}
                            transition={{ delay: idx * 0.05, duration: 0.4 }}
                          />
                        </div>
                        <span className="text-xs text-muted-foreground tabular-nums min-w-[24px] text-end">
                          {count}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </>
        )}

        {/* Year in Pixels — mood heatmap grid */}
        {entries.length > 0 && (
          <div className="mt-6">
            <h3 className="text-sm font-semibold text-foreground mb-3 px-1">
              {ts.journalYearInPixels || "Year in Pixels"}
            </h3>
            <YearInPixels entries={entries} />
          </div>
        )}

        {/* Mood correlation insights */}
        {entries.length >= 10 && (
          <div className="mt-6">
            <MoodCorrelations entries={entries} />
          </div>
        )}
      </div>
    </>
  );
});

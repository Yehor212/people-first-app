import { useEffect, useMemo, useRef, useState } from "react";
import { ChevronLeft, ChevronRight, CalendarDays } from "lucide-react";
import { motion, AnimatePresence, useReducedMotion } from "framer-motion";
import { cn } from "@/lib/utils";
import { getLocale } from "@/lib/timeUtils";
import { useLanguage } from "@/contexts/LanguageContext";
import { shouldAnimate } from "@/lib/animationUtils";
import { hapticTap } from "@/lib/haptics";
import type { MoodType } from "@/types";
import { DiaryMiniOrb } from "./DiaryMiniOrb";
import { computeStreaks } from "./computeStreaks";
import { getJournalWeekStart } from "./journalDateUtils";
import { formatLocalizedCount } from "./journalWordCount";

/** Theme-token-based mood background colors with opacity modulation */
const MOOD_BG_STYLE: Record<MoodType, string> = {
  great: "hsl(var(--mood-great) / 0.45)",
  good: "hsl(var(--mood-good) / 0.38)",
  okay: "hsl(var(--mood-okay) / 0.35)",
  bad: "hsl(var(--mood-bad) / 0.32)",
  terrible: "hsl(var(--mood-terrible) / 0.30)",
};

/** Dark mode reduces saturation — lower opacity */
const MOOD_BG_STYLE_DARK: Record<MoodType, string> = {
  great: "hsl(var(--mood-great) / 0.28)",
  good: "hsl(var(--mood-good) / 0.24)",
  okay: "hsl(var(--mood-okay) / 0.22)",
  bad: "hsl(var(--mood-bad) / 0.20)",
  terrible: "hsl(var(--mood-terrible) / 0.18)",
};

/** Get localized single-letter day names, starting from correct day of week */
function getLocalizedDayNames(locale: string, weekStart: number): string[] {
  const formatter = new Intl.DateTimeFormat(locale, { weekday: "narrow" });
  return Array.from({ length: 7 }, (_, i) =>
    formatter.format(new Date(2025, 0, 5 + ((i + weekStart) % 7)))
  );
}

interface JournalCalendarFullProps {
  today: string;
  entryDates: Map<string, MoodType | undefined>;
  releaseTraceDates?: Map<string, number>;
  selectedDate: string | null;
  onSelectDate: (date: string | null) => void;
  onToggleMode: () => void;
  privateMode?: boolean;
}

export function JournalCalendarFull({
  today,
  entryDates,
  releaseTraceDates,
  selectedDate,
  onSelectDate,
  onToggleMode,
  privateMode = false,
}: JournalCalendarFullProps) {
  const { t, language, isRTL } = useLanguage();
  const ts = t as unknown as Record<string, string>;
  const reducedMotion = useReducedMotion();
  const animate = shouldAnimate() && !reducedMotion;

  // Current viewing month
  const [viewYear, setViewYear] = useState(() => parseInt(today.split("-")[0]));
  const [viewMonth, setViewMonth] = useState(() => parseInt(today.split("-")[1]) - 1); // 0-indexed
  const [direction, setDirection] = useState(0); // -1 = prev, 1 = next
  const previousTodayRef = useRef(today);
  const motionDirection = isRTL ? -direction : direction;

  useEffect(() => {
    const previousToday = previousTodayRef.current;
    previousTodayRef.current = today;
    if (previousToday === today) return;

    const [previousYear, previousMonth] = previousToday.split("-").map(Number);
    if (viewYear !== previousYear || viewMonth !== previousMonth - 1) return;

    const [nextYear, nextMonth] = today.split("-").map(Number);
    setViewYear(nextYear);
    setViewMonth(nextMonth - 1);
  }, [today, viewMonth, viewYear]);

  const locale = getLocale(language);
  const weekStart = getJournalWeekStart(language);
  const dayNames = useMemo(
    () => getLocalizedDayNames(locale, weekStart),
    [locale, weekStart]
  );
  const fullDateFormatter = useMemo(
    () =>
      new Intl.DateTimeFormat(locale, {
        weekday: "long",
        year: "numeric",
        month: "long",
        day: "numeric",
      }),
    [locale],
  );

  // Detect dark mode via class on document
  const isDark =
    typeof document !== "undefined" && document.documentElement.classList.contains("dark");

  // Count entries per date for the current month
  const entryCounts = useMemo(() => {
    const counts = new Map<string, number>();
    entryDates.forEach((_, date) => {
      counts.set(date, (counts.get(date) || 0) + 1);
    });
    return counts;
  }, [entryDates]);

  // Memoized streak computation
  const streaks = useMemo(() => computeStreaks(entryDates), [entryDates]);

  // Generate calendar grid for current month
  const calendarDays = useMemo(() => {
    const firstDay = new Date(viewYear, viewMonth, 1);
    const lastDay = new Date(viewYear, viewMonth + 1, 0);
    const daysInMonth = lastDay.getDate();

    // Compute day-of-week offset for first day
    const firstDayOfWeek = (firstDay.getDay() - weekStart + 7) % 7;

    const days: { date: string | null; day: number; isToday: boolean }[] = [];

    // Empty cells before first day
    for (let i = 0; i < firstDayOfWeek; i++) {
      days.push({ date: null, day: 0, isToday: false });
    }

    // Days of the month
    for (let d = 1; d <= daysInMonth; d++) {
      const dateStr = `${viewYear}-${String(viewMonth + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
      days.push({ date: dateStr, day: d, isToday: dateStr === today });
    }

    return days;
  }, [viewYear, viewMonth, today, weekStart]);

  const monthLabel = new Date(viewYear, viewMonth).toLocaleDateString(locale, {
    month: "long",
    year: "numeric",
  });

  const isCurrentMonth =
    viewYear === parseInt(today.split("-")[0]) && viewMonth === parseInt(today.split("-")[1]) - 1;

  const navigateMonth = (delta: number) => {
    setDirection(delta);
    let newMonth = viewMonth + delta;
    let newYear = viewYear;
    if (newMonth < 0) {
      newMonth = 11;
      newYear--;
    }
    if (newMonth > 11) {
      newMonth = 0;
      newYear++;
    }
    // Don't go past current month
    const todayYear = parseInt(today.split("-")[0]);
    const todayMonth = parseInt(today.split("-")[1]) - 1;
    if (newYear > todayYear || (newYear === todayYear && newMonth > todayMonth)) return;
    setViewYear(newYear);
    setViewMonth(newMonth);
  };

  const goToToday = () => {
    setDirection(1);
    setViewYear(parseInt(today.split("-")[0]));
    setViewMonth(parseInt(today.split("-")[1]) - 1);
    onSelectDate(null);
  };

  const canGoForward = !isCurrentMonth;

  return (
    <div>
      {/* Header */}
      <div className="mb-2 grid grid-cols-[48px_minmax(0,1fr)_48px] items-center gap-x-2 gap-y-1">
        <button
          onClick={() => navigateMonth(-1)}
          className="p-1.5 rounded-lg hover:bg-muted/50 min-w-[44px] min-h-[44px] flex items-center justify-center"
          aria-label={ts.previous || "Previous month"}
        >
          <ChevronLeft className="w-4 h-4 text-muted-foreground rtl:scale-x-[-1]" />
        </button>

        <div className="col-span-3 row-start-2 flex min-w-0 flex-wrap items-center justify-center gap-2 min-[420px]:col-span-1 min-[420px]:col-start-2 min-[420px]:row-start-1">
          <span className="min-w-0 whitespace-normal break-words text-center text-xs font-semibold capitalize text-foreground">{monthLabel}</span>
          {!isCurrentMonth && (
            <button
              onClick={goToToday}
              className="flex min-h-[44px] items-center justify-center whitespace-normal break-words rounded-full bg-primary/10 px-3 py-2 text-xs font-medium text-primary"
            >
              {ts.journalCalendarToday || "Today"}
            </button>
          )}
          <button
            onClick={onToggleMode}
            className="p-1 rounded-md hover:bg-muted/50 min-w-[44px] min-h-[44px] flex items-center justify-center"
            aria-label={t.ariaSwitchToStripView}
          >
            <CalendarDays className="w-3.5 h-3.5 text-muted-foreground/60" />
          </button>
        </div>

        <button
          onClick={() => navigateMonth(1)}
          disabled={!canGoForward}
          className="col-start-3 row-start-1 flex min-h-[44px] min-w-[44px] items-center justify-center rounded-lg p-1.5 hover:bg-muted/50 disabled:opacity-50"
          aria-label={ts.next || "Next month"}
        >
          <ChevronRight className="w-4 h-4 text-muted-foreground rtl:scale-x-[-1]" />
        </button>
      </div>

      <div className="-mx-1 overflow-x-auto overscroll-x-contain px-1 pb-1">
        <div className="min-w-[calc(308px*var(--font-scale,1))]">
          {/* Day name headers */}
          <div className="mb-1 grid grid-cols-[repeat(7,minmax(calc(44px*var(--font-scale,1)),1fr))]">
            {dayNames.map((name, i) => (
              <div
                key={i}
                className="whitespace-normal break-words py-0.5 text-center text-xs font-medium text-muted-foreground/60"
              >
                {name}
              </div>
            ))}
          </div>

      {/* Calendar grid — animated month transitions gated by shouldAnimate */}
      <AnimatePresence mode="wait" initial={false}>
        <motion.div
          key={`${viewYear}-${viewMonth}`}
          initial={animate ? { opacity: 0, x: motionDirection > 0 ? 50 : -50 } : false}
          animate={{ opacity: 1, x: 0 }}
          exit={animate ? { opacity: 0, x: motionDirection > 0 ? -50 : 50 } : undefined}
          transition={
            animate
              ? { duration: 0.3, type: "spring", stiffness: 260, damping: 25 }
              : { duration: 0 }
          }
          className="grid grid-cols-[repeat(7,minmax(calc(44px*var(--font-scale,1)),1fr))] gap-0.5"
        >
          {calendarDays.map((cell, idx) => {
            if (!cell.date) {
              return <div key={`empty-${idx}`} className="aspect-square" />;
            }

            const rawMood = entryDates.get(cell.date);
            const mood = privateMode ? undefined : rawMood;
            const hasEntry = !privateMode && entryDates.has(cell.date);
            const hasReleaseTrace = !privateMode && (releaseTraceDates?.get(cell.date) ?? 0) > 0;
            const count = entryCounts.get(cell.date) || 0;
            const isSelected = cell.date === selectedDate;
            const isFuture = cell.date > today;
            const streak = privateMode ? undefined : streaks.get(cell.date);
            const [cellYear, cellMonth, cellDay] = cell.date.split("-").map(Number);
            const fullDateLabel = fullDateFormatter.format(
              new Date(cellYear, cellMonth - 1, cellDay),
            );
            const entryStatusLabel = hasEntry
              ? formatLocalizedCount(
                  count,
                  language,
                  ts,
                  "journalEntryCount",
                  ts.journalEntries || ts.journalEntry || "entries",
                )
              : "";
            const moodStatusLabel = mood
              ? {
                  great: ts.moodGreat || "Great",
                  good: ts.moodGood || "Good",
                  okay: ts.moodOkay || "Okay",
                  bad: ts.moodBad || "Bad",
                  terrible: ts.moodTerrible || "Terrible",
                }[mood]
              : "";

            // T1: Mood intensity background color via theme tokens
            const moodBgColor =
              mood && !isSelected && !isFuture
                ? isDark
                  ? MOOD_BG_STYLE_DARK[mood]
                  : MOOD_BG_STYLE[mood]
                : undefined;

            return (
              <button
                key={cell.date}
                onClick={() => {
                  if (isFuture) return;
                  // T3: Haptic feedback on day tap
                  void hapticTap();
                  onSelectDate(isSelected ? null : cell.date);
                }}
                disabled={isFuture}
                aria-current={cell.isToday ? "date" : undefined}
                aria-pressed={isSelected}
                style={moodBgColor ? { backgroundColor: moodBgColor } : undefined}
                className={cn(
                  "aspect-square rounded-xl flex flex-col items-center justify-center gap-0.5",
                  "motion-safe:transition-all motion-safe:duration-150 relative overflow-hidden",
                  "min-h-[44px] min-w-[44px]",
                  isFuture && "opacity-30",
                  isSelected
                    ? "bg-primary/15 shadow-sm ring-1 ring-primary/30"
                    : !moodBgColor && "hover:bg-muted/40",
                  moodBgColor && !isSelected && "hover:brightness-110",
                  cell.isToday && !isSelected && "ring-1 ring-primary/40"
                )}
              >
                <span className="sr-only">
                  {fullDateLabel}
                  {entryStatusLabel ? `. ${entryStatusLabel}` : ""}
                  {moodStatusLabel ? `. ${moodStatusLabel}` : ""}
                </span>
                {/* T2: Streak background bar — subtle connector between consecutive days */}
                {streak && (
                  <span
                    className="absolute inset-y-[30%] bg-primary/8 pointer-events-none"
                    style={{
                      insetInlineStart: streak.isStart ? "20%" : "0",
                      insetInlineEnd: streak.isEnd ? "20%" : "0",
                      borderStartStartRadius: streak.isStart ? "6px" : "0",
                      borderEndStartRadius: streak.isStart ? "6px" : "0",
                      borderStartEndRadius: streak.isEnd ? "6px" : "0",
                      borderEndEndRadius: streak.isEnd ? "6px" : "0",
                    }}
                    aria-hidden="true"
                  />
                )}
                <span
                  aria-hidden="true"
                  className={cn(
                    "text-xs font-medium leading-none relative z-[1]",
                    cell.isToday ? "text-primary font-bold" : "text-foreground",
                    isFuture && "text-muted-foreground/50"
                  )}
                >
                  {cell.day}
                </span>
                {hasEntry && (
                  <div className="flex items-center gap-px relative z-[1]">
                    <div
                      className={cn(
                        "flex h-4 w-4 items-center justify-center",
                        cell.isToday && "motion-safe:animate-pulse-subtle"
                      )}
                      data-testid="journal-calendar-full-mood-orb"
                      data-mood={mood || "entry"}
                    >
                      <DiaryMiniOrb mood={mood} size="micro" className="scale-[0.58]" />
                    </div>
                    {!privateMode && count > 1 && (
                      <span aria-hidden="true" className="text-xs font-medium leading-none text-muted-foreground/60">
                        {count}
                      </span>
                    )}
                  </div>
                )}
                {hasReleaseTrace && (
                  <span
                    data-testid="journal-release-trace-dot"
                    className="absolute bottom-1 end-1 z-[2] h-1.5 w-1.5 rounded-full bg-[hsl(var(--cosmic-nebula-cyan)/0.86)] shadow-[0_0_8px_hsl(var(--cosmic-nebula-purple)/0.34)]"
                    aria-hidden="true"
                  />
                )}
              </button>
            );
          })}
        </motion.div>
      </AnimatePresence>
        </div>
      </div>
    </div>
  );
}

import { useState, useMemo } from "react";
import { ChevronLeft, ChevronRight, CalendarDays } from "lucide-react";
import { motion, AnimatePresence, useReducedMotion } from "framer-motion";
import { cn, getToday } from "@/lib/utils";
import { useLanguage } from "@/contexts/LanguageContext";
import { shouldAnimate } from "@/lib/animationUtils";
import { hapticTap } from "@/lib/haptics";
import type { MoodType } from "@/types";
import { DiaryMiniOrb } from "./DiaryMiniOrb";

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

/** Detect consecutive diary day streaks from a set of date strings */
function computeStreaks(
  entryDates: Map<string, MoodType | undefined>
): Map<string, { isStart: boolean; isEnd: boolean; length: number }> {
  const result = new Map<string, { isStart: boolean; isEnd: boolean; length: number }>();
  const dates = Array.from(entryDates.keys()).sort();
  if (dates.length === 0) return result;

  let streakStart = 0;
  for (let i = 1; i <= dates.length; i++) {
    const prevDate = new Date(dates[i - 1] + "T00:00:00");
    const currDate = i < dates.length ? new Date(dates[i] + "T00:00:00") : null;
    const isConsecutive = currDate && currDate.getTime() - prevDate.getTime() === 86400000;

    if (!isConsecutive) {
      const streakLen = i - streakStart;
      if (streakLen >= 2) {
        for (let j = streakStart; j < i; j++) {
          result.set(dates[j], {
            isStart: j === streakStart,
            isEnd: j === i - 1,
            length: streakLen,
          });
        }
      }
      streakStart = i;
    }
  }
  return result;
}

/** RTL locales where week starts on Saturday */
const RTL_WEEK_START_SATURDAY = new Set(["ar", "he"]);

/** Get localized single-letter day names, starting from correct day of week */
function getLocalizedDayNames(locale: string, startSaturday: boolean): string[] {
  const formatter = new Intl.DateTimeFormat(locale, { weekday: "narrow" });
  // Jan 5 2025 = Sunday (0), so we shift for startSaturday (6)
  const offset = startSaturday ? 6 : 0;
  return Array.from({ length: 7 }, (_, i) =>
    formatter.format(new Date(2025, 0, 5 + ((i + offset) % 7)))
  );
}

interface JournalCalendarFullProps {
  entryDates: Map<string, MoodType | undefined>;
  releaseTraceDates?: Map<string, number>;
  selectedDate: string | null;
  onSelectDate: (date: string | null) => void;
  onToggleMode: () => void;
}

export function JournalCalendarFull({
  entryDates,
  releaseTraceDates,
  selectedDate,
  onSelectDate,
  onToggleMode,
}: JournalCalendarFullProps) {
  const today = getToday();
  const { t, language } = useLanguage();
  const ts = t as unknown as Record<string, string>;
  const reducedMotion = useReducedMotion();
  const animate = shouldAnimate() && !reducedMotion;

  // Current viewing month
  const [viewYear, setViewYear] = useState(() => parseInt(today.split("-")[0]));
  const [viewMonth, setViewMonth] = useState(() => parseInt(today.split("-")[1]) - 1); // 0-indexed
  const [direction, setDirection] = useState(0); // -1 = prev, 1 = next

  const startSaturday = RTL_WEEK_START_SATURDAY.has(language);
  const dayNames = useMemo(
    () => getLocalizedDayNames(language, startSaturday),
    [language, startSaturday]
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
    let firstDayOfWeek = firstDay.getDay(); // 0 = Sunday
    if (startSaturday) {
      firstDayOfWeek = (firstDayOfWeek + 1) % 7; // Shift so Saturday = 0
    }

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
  }, [viewYear, viewMonth, today, startSaturday]);

  const monthLabel = new Date(viewYear, viewMonth).toLocaleDateString(language, {
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
      <div className="flex items-center justify-between mb-2">
        <button
          onClick={() => navigateMonth(-1)}
          className="p-1.5 rounded-lg hover:bg-muted/50 min-w-[44px] min-h-[44px] flex items-center justify-center"
          aria-label={ts.previous || "Previous month"}
        >
          <ChevronLeft className="w-4 h-4 text-muted-foreground rtl:scale-x-[-1]" />
        </button>

        <div className="flex items-center gap-2">
          <span className="text-xs font-semibold text-foreground capitalize">{monthLabel}</span>
          {!isCurrentMonth && (
            <button
              onClick={goToToday}
              className="text-[10px] font-medium text-primary px-2 py-0.5 rounded-full bg-primary/10"
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
          className="p-1.5 rounded-lg hover:bg-muted/50 disabled:opacity-50 min-w-[44px] min-h-[44px] flex items-center justify-center"
          aria-label={ts.next || "Next month"}
        >
          <ChevronRight className="w-4 h-4 text-muted-foreground rtl:scale-x-[-1]" />
        </button>
      </div>

      {/* Day name headers */}
      <div className="grid grid-cols-7 mb-1">
        {dayNames.map((name, i) => (
          <div
            key={i}
            className="text-center text-[10px] font-medium text-muted-foreground/60 py-0.5"
          >
            {name}
          </div>
        ))}
      </div>

      {/* Calendar grid — animated month transitions gated by shouldAnimate */}
      <AnimatePresence mode="wait" initial={false}>
        <motion.div
          key={`${viewYear}-${viewMonth}`}
          initial={animate ? { opacity: 0, x: direction > 0 ? 50 : -50 } : false}
          animate={{ opacity: 1, x: 0 }}
          exit={animate ? { opacity: 0, x: direction > 0 ? -50 : 50 } : undefined}
          transition={
            animate
              ? { duration: 0.3, type: "spring", stiffness: 260, damping: 25 }
              : { duration: 0 }
          }
          className="grid grid-cols-7 gap-0.5"
        >
          {calendarDays.map((cell, idx) => {
            if (!cell.date) {
              return <div key={`empty-${idx}`} className="aspect-square" />;
            }

            const mood = entryDates.get(cell.date);
            const hasEntry = entryDates.has(cell.date);
            const hasReleaseTrace = (releaseTraceDates?.get(cell.date) ?? 0) > 0;
            const count = entryCounts.get(cell.date) || 0;
            const isSelected = cell.date === selectedDate;
            const isFuture = cell.date > today;
            const streak = streaks.get(cell.date);

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
                style={moodBgColor ? { backgroundColor: moodBgColor } : undefined}
                className={cn(
                  "aspect-square rounded-xl flex flex-col items-center justify-center gap-0.5",
                  "motion-safe:transition-all motion-safe:duration-150 relative overflow-hidden",
                  "min-h-[36px]",
                  isFuture && "opacity-30",
                  isSelected
                    ? "bg-primary/15 shadow-sm ring-1 ring-primary/30"
                    : !moodBgColor && "hover:bg-muted/40",
                  moodBgColor && !isSelected && "hover:brightness-110",
                  cell.isToday && !isSelected && "ring-1 ring-primary/40"
                )}
              >
                {/* T2: Streak background bar — subtle connector between consecutive days */}
                {streak && (
                  <span
                    className="absolute inset-y-[30%] bg-primary/8 pointer-events-none"
                    style={{
                      left: streak.isStart ? "20%" : "0",
                      right: streak.isEnd ? "20%" : "0",
                      borderStartStartRadius: streak.isStart ? "6px" : "0",
                      borderEndStartRadius: streak.isStart ? "6px" : "0",
                      borderStartEndRadius: streak.isEnd ? "6px" : "0",
                      borderEndEndRadius: streak.isEnd ? "6px" : "0",
                    }}
                    aria-hidden="true"
                  />
                )}
                <span
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
                    {count > 1 && (
                      <span className="text-[7px] text-muted-foreground/60 font-medium leading-none">
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
  );
}

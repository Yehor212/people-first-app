import { useState, useMemo, useRef, useEffect } from "react";
import { ChevronLeft, ChevronRight, CalendarRange } from "lucide-react";
import { motion, useReducedMotion } from "framer-motion";
import { cn, getToday } from "@/lib/utils";
import { useLanguage } from "@/contexts/LanguageContext";
import { getLocale } from "@/lib/timeUtils";
import { shouldAnimate } from "@/lib/animationUtils";
import { hapticTap } from "@/lib/haptics";
import type { MoodType } from "@/types";
import { computeStreaks } from "./computeStreaks";
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

/** Get localized single-letter day names (Sun–Sat) using Intl API */
function getLocalizedDayNames(locale: string): string[] {
  const formatter = new Intl.DateTimeFormat(locale, { weekday: "narrow" });
  // Jan 5 2025 = Sunday, Jan 6 = Monday, ... Jan 11 = Saturday
  return Array.from({ length: 7 }, (_, i) => formatter.format(new Date(2025, 0, 5 + i)));
}

interface JournalCalendarProps {
  entryDates: Map<string, MoodType | undefined>;
  releaseTraceDates?: Map<string, number>;
  selectedDate: string | null;
  onSelectDate: (date: string | null) => void;
  onToggleMode?: () => void;
}

export function JournalCalendar({
  entryDates,
  releaseTraceDates,
  selectedDate,
  onSelectDate,
  onToggleMode,
}: JournalCalendarProps) {
  const today = getToday();
  const scrollRef = useRef<HTMLDivElement>(null);
  const { t, language, isRTL } = useLanguage();
  const ts = t as unknown as Record<string, string>;
  const reducedMotion = useReducedMotion();
  const animate = shouldAnimate() && !reducedMotion;
  const [startOffset, setStartOffset] = useState(0);

  // Detect dark mode via class on document
  const isDark =
    typeof document !== "undefined" && document.documentElement.classList.contains("dark");

  const dayNames = useMemo(() => getLocalizedDayNames(language), [language]);

  // Memoized streak computation
  const streaks = useMemo(() => computeStreaks(entryDates), [entryDates]);

  // Generate 28 days based on offset
  const days = useMemo(() => {
    const result: { date: string; day: number; dayOfWeek: number }[] = [];
    for (let i = 27 + startOffset; i >= startOffset; i--) {
      if (i < 0) continue;
      const d = new Date(Date.now() - i * 86400000);
      const dateStr = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
      result.push({ date: dateStr, day: d.getDate(), dayOfWeek: d.getDay() });
    }
    return result;
  }, [startOffset]);

  // Month label
  const monthLabel = useMemo(() => {
    if (days.length === 0) return "";
    const first = new Date(days[0].date + "T00:00:00");
    const last = new Date(days[days.length - 1].date + "T00:00:00");
    const opts: Intl.DateTimeFormatOptions = { month: "long", year: "numeric" };
    const locale = getLocale(language);
    const firstMonth = first.toLocaleDateString(locale, opts);
    const lastMonth = last.toLocaleDateString(locale, opts);
    if (firstMonth === lastMonth) return firstMonth;
    return `${first.toLocaleDateString(locale, { month: "short" })} \u2014 ${last.toLocaleDateString(locale, { month: "short", year: "numeric" })}`;
  }, [days, language]);

  const canGoForward = startOffset > 0;

  // Scroll to end (today) on mount / offset change — RTL aware
  useEffect(() => {
    if (!scrollRef.current) return;
    requestAnimationFrame(() => {
      if (!scrollRef.current) return;
      const maxScroll = scrollRef.current.scrollWidth - scrollRef.current.clientWidth;
      const compactSidebarInset = scrollRef.current.clientWidth <= 340 ? 28 : 0;
      if (isRTL) {
        scrollRef.current.scrollLeft = -(maxScroll - compactSidebarInset);
      } else {
        scrollRef.current.scrollLeft = maxScroll - compactSidebarInset;
      }
    });
  }, [isRTL, startOffset]);

  return (
    <div>
      {/* Header: month label + navigation */}
      <div className="flex items-center justify-between mb-1.5">
        <button
          onClick={() => setStartOffset((prev) => prev + 7)}
          className="flex h-[46px] w-[46px] items-center justify-center rounded-lg p-0 hover:bg-muted/50"
          aria-label={ts.previous || "Previous week"}
        >
          <ChevronLeft className="w-4 h-4 text-muted-foreground rtl:scale-x-[-1]" />
        </button>

        <div className="flex items-center gap-2">
          <span className="text-xs font-medium text-foreground capitalize">{monthLabel}</span>
          {startOffset > 0 && (
            <button
              onClick={() => {
                setStartOffset(0);
                onSelectDate(null);
              }}
              className="text-[10px] font-medium text-primary px-3 py-2 min-h-[44px] rounded-full bg-primary/10 flex items-center justify-center"
            >
              {ts.journalCalendarToday || "Today"}
            </button>
          )}
          {onToggleMode && (
            <button
              onClick={onToggleMode}
              className="flex h-[46px] w-[46px] items-center justify-center rounded-md p-0 hover:bg-muted/50"
              aria-label={ts.journalCalendarMonthView || "Switch to month view"}
            >
              <CalendarRange className="w-3.5 h-3.5 text-muted-foreground/60" />
            </button>
          )}
        </div>

        <button
          onClick={() => setStartOffset((prev) => Math.max(0, prev - 7))}
          disabled={!canGoForward}
          className="flex h-[46px] w-[46px] items-center justify-center rounded-lg p-0 hover:bg-muted/50 disabled:opacity-50"
          aria-label={ts.next || "Next week"}
        >
          <ChevronRight className="w-4 h-4 text-muted-foreground rtl:scale-x-[-1]" />
        </button>
      </div>

      {/* Day strip */}
      <div
        ref={scrollRef}
        className="flex gap-1 overflow-x-auto scrollbar-hide pb-1 -mx-1 px-1 pr-8 snap-x snap-mandatory rtl:pl-8 rtl:pr-1"
      >
        {days.map((d, index) => {
          const isToday = d.date === today;
          const isSelected = d.date === selectedDate;
          const mood = entryDates.get(d.date);
          const hasEntry = entryDates.has(d.date);
          const hasReleaseTrace = (releaseTraceDates?.get(d.date) ?? 0) > 0;
          const streak = streaks.get(d.date);

          // T1: Mood intensity background color via theme tokens
          const moodBgColor =
            mood && !isSelected
              ? isDark
                ? MOOD_BG_STYLE_DARK[mood]
                : MOOD_BG_STYLE[mood]
              : undefined;

          return (
            <motion.button
              key={d.date}
              initial={animate ? { opacity: 0 } : false}
              animate={{ opacity: 1 }}
              transition={
                animate
                  ? {
                      delay: index * 0.01,
                      type: "spring",
                      stiffness: 500,
                      damping: 30,
                    }
                  : { duration: 0 }
              }
              onClick={() => {
                // T3: Haptic feedback on day tap
                void hapticTap();
                onSelectDate(isSelected ? null : d.date);
              }}
              // A11Y-OK: day number + day name provide accessible label for calendar day cell
              aria-label={`${dayNames[d.dayOfWeek]} ${d.day}${hasEntry ? ` (${mood || "entry"})` : ""}`}
              style={moodBgColor ? { backgroundColor: moodBgColor } : undefined}
              className={cn(
                "snap-start flex h-[44px] w-[44px] flex-none flex-col items-center gap-0.5 rounded-xl py-1.5 motion-safe:transition-all motion-safe:duration-200 relative overflow-hidden",
                isSelected
                  ? "bg-gradient-to-b from-primary/20 to-primary/10 shadow-sm"
                  : !moodBgColor && "hover:bg-muted/50",
                moodBgColor && !isSelected && "hover:brightness-110",
                isToday && !isSelected && "ring-1 ring-primary/40"
              )}
            >
              {/* T2: Streak background bar — subtle connector between consecutive days */}
              {streak && (
                <span
                  className="absolute inset-y-[25%] bg-primary/8 pointer-events-none"
                  style={{
                    left: streak.isStart ? "15%" : "0",
                    right: streak.isEnd ? "15%" : "0",
                    borderStartStartRadius: streak.isStart ? "6px" : "0",
                    borderEndStartRadius: streak.isStart ? "6px" : "0",
                    borderStartEndRadius: streak.isEnd ? "6px" : "0",
                    borderEndEndRadius: streak.isEnd ? "6px" : "0",
                  }}
                  aria-hidden="true"
                />
              )}
              <span className="text-[10px] text-muted-foreground leading-none relative z-[1]">
                {dayNames[d.dayOfWeek]}
              </span>
              <span
                className={cn(
                  "text-xs font-semibold leading-none relative z-[1]",
                  isToday ? "text-primary" : "text-foreground"
                )}
              >
                {d.day}
              </span>
              {hasEntry ? (
                <motion.div
                  initial={animate ? { scale: 0 } : false}
                  animate={{ scale: 1 }}
                  transition={animate ? { type: "spring", stiffness: 500, damping: 20 } : { duration: 0 }}
                  className={cn(
                    "relative z-[1] flex h-4 w-4 items-center justify-center",
                    isToday && "motion-safe:animate-pulse-subtle"
                  )}
                  data-testid="journal-calendar-mood-orb"
                  data-mood={mood || "entry"}
                >
                  <DiaryMiniOrb mood={mood} size="micro" className="scale-[0.64]" />
                </motion.div>
              ) : (
                <div className="h-4 w-4" />
              )}
              {hasReleaseTrace && (
                <span
                  data-testid="journal-release-trace-dot"
                  className="absolute bottom-1 end-1 z-[2] h-1.5 w-1.5 rounded-full bg-[hsl(var(--cosmic-nebula-cyan)/0.86)] shadow-[0_0_8px_hsl(var(--cosmic-nebula-purple)/0.34)]"
                  aria-hidden="true"
                />
              )}
            </motion.button>
          );
        })}
      </div>

    </div>
  );
}

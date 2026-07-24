import { useState, useEffect, memo } from "react";
import { MoodEntry } from "@/types";
import { cn } from "@/lib/utils";
import { Calendar, ChevronLeft, ChevronRight, ChevronDown, ChevronUp } from "lucide-react";
import { AnimatedMoodEmoji } from "@/components/AnimatedMoodEmoji";
import { AnimatedEmotionEmoji } from "@/components/AnimatedEmotionEmoji";
import { getEmotionLabels } from "@/lib/emotionConstants";
import { safeParseInt } from "@/lib/validation";
import { useLanguage } from "@/contexts/LanguageContext";
import { CalendarDay, DayData, getEntryGradient, moodConfig } from "./calendarHelpers";

interface AnimatedCalendarProps {
  title: string;
  yearLabel: string;
  selectedYear: number;
  availableYears: number[];
  onYearChange: (year: number) => void;
  selectedMonth: number;
  onMonthChange: (month: number) => void;
  monthNames: string[];
  dayNames: string[];
  calendarDays: CalendarDay[];
  todayKey: string;
  selectedDate: string | null;
  onDateSelect: (date: string | null) => void;
  getMoodForDate: (dateKey: string) => MoodEntry | undefined;
  hasDataForDate: (dateKey: string) => boolean;
  getDayData: (dateKey: string) => DayData | null;
  // Stats
  moodCount: number;
  focusMinutes: number;
  habitCompletions: number;
  gratitudeCount: number;
  // Labels
  moodEntriesLabel: string;
  focusMinutesLabel: string;
  habitsCompletedLabel: string;
  gratitudesLabel: string;
  selectDayLabel: string;
  moodTodayLabel: string;
  noDataLabel: string;
  prevMonthLabel: string;
  nextMonthLabel: string;
}

export const AnimatedCalendar = memo(function AnimatedCalendar({
  title,
  yearLabel,
  selectedYear,
  availableYears,
  onYearChange,
  selectedMonth,
  onMonthChange,
  monthNames,
  dayNames,
  calendarDays,
  todayKey,
  selectedDate,
  onDateSelect,
  getMoodForDate,
  hasDataForDate,
  getDayData,
  moodCount,
  focusMinutes,
  habitCompletions,
  gratitudeCount,
  moodEntriesLabel,
  focusMinutesLabel,
  habitsCompletedLabel,
  gratitudesLabel,
  selectDayLabel,
  moodTodayLabel,
  noDataLabel: _noDataLabel,
  prevMonthLabel,
  nextMonthLabel,
}: AnimatedCalendarProps) {
  const { t: calT } = useLanguage();
  const [showMonthSelector, setShowMonthSelector] = useState(false);
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    setIsVisible(true);
  }, []);

  const handleMonthShift = (delta: number) => {
    let newMonth = selectedMonth + delta;
    if (newMonth < 0) {
      newMonth = 11;
      if (availableYears.includes(selectedYear - 1)) {
        onYearChange(selectedYear - 1);
      }
    } else if (newMonth > 11) {
      newMonth = 0;
      if (availableYears.includes(selectedYear + 1)) {
        onYearChange(selectedYear + 1);
      }
    }
    onMonthChange(newMonth);
  };

  const selectedDayData = selectedDate ? getDayData(selectedDate) : null;

  const stats = [
    {
      value: moodCount,
      label: moodEntriesLabel,
      gradient: "from-pink-500 to-rose-500",
    },
    {
      value: focusMinutes,
      label: focusMinutesLabel,
      gradient: "from-violet-500 to-purple-500",
    },
    {
      value: habitCompletions,
      label: habitsCompletedLabel,
      gradient: "from-emerald-500 to-teal-500",
    },
    {
      value: gratitudeCount,
      label: gratitudesLabel,
      gradient: "from-amber-500 to-orange-500",
    },
  ];

  return (
    <div
      className={cn(
        "bg-card rounded-2xl p-4 sm:p-6 zen-shadow-card overflow-hidden motion-safe:transition-all motion-safe:duration-500",
        isVisible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-4"
      )}
    >
      {/* Header */}
      <div className="mb-5 flex min-w-0 items-start gap-3">
        <div className="relative shrink-0">
          <div className="p-2.5 bg-gradient-to-br from-violet-500 to-purple-500 rounded-xl shadow-lg shadow-violet-500/20">
            <Calendar className="w-5 h-5 text-white" aria-hidden="true" />
          </div>
          <div className="absolute -top-1 -end-1 w-2 h-2 bg-violet-400 rounded-full motion-safe:animate-pulse" />
        </div>
        <h3 className="min-w-0 whitespace-normal break-words text-lg font-bold leading-snug text-foreground">
          {title}
        </h3>
      </div>

      {/* Year & Month Selector */}
      <div className="flex flex-wrap items-center gap-2 mb-5">
        <label className="min-w-0 whitespace-normal break-words text-sm text-muted-foreground">
          {yearLabel}
        </label>
        <select
          value={selectedYear}
          onChange={(e) =>
            onYearChange(safeParseInt(e.target.value, new Date().getFullYear(), 2020, 2100))
          }
          className="min-h-[44px] rounded-xl bg-secondary p-2 text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30"
          aria-label={yearLabel || "Select year"}
        >
          {availableYears.map((year) => (
            <option key={year} value={year}>
              {year}
            </option>
          ))}
        </select>

        <div className="ms-0 grid w-full grid-cols-[44px_minmax(0,1fr)_44px] items-stretch gap-2 min-[520px]:ms-auto min-[520px]:w-auto">
          <button
            onClick={() => handleMonthShift(-1)}
            aria-label={prevMonthLabel}
            className="flex min-h-[44px] min-w-[44px] items-center justify-center rounded-xl bg-secondary p-2 hover:bg-primary/10 motion-safe:transition-colors"
          >
            <ChevronLeft className="w-4 h-4 rtl:scale-x-[-1]" />
          </button>
          <button
            onClick={() => setShowMonthSelector(!showMonthSelector)}
            aria-label={calT.selectMonth || "Select month"}
            className="flex min-h-[44px] min-w-0 items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-primary/10 to-accent/10 px-3 py-2 text-sm font-medium hover:from-primary/20 hover:to-accent/20 motion-safe:transition-all"
          >
            <span className="min-w-0 whitespace-normal break-words text-center leading-tight">
              {monthNames[selectedMonth]} {selectedYear}
            </span>
            {showMonthSelector ? (
              <ChevronUp className="h-4 w-4 shrink-0" aria-hidden="true" />
            ) : (
              <ChevronDown className="h-4 w-4 shrink-0" aria-hidden="true" />
            )}
          </button>
          <button
            onClick={() => handleMonthShift(1)}
            aria-label={nextMonthLabel}
            className="flex min-h-[44px] min-w-[44px] items-center justify-center rounded-xl bg-secondary p-2 hover:bg-primary/10 motion-safe:transition-colors"
          >
            <ChevronRight className="w-4 h-4 rtl:scale-x-[-1]" />
          </button>
        </div>
      </div>

      {/* Month Selector Grid */}
      {showMonthSelector && (
        <div className="grid grid-cols-2 gap-2 min-[420px]:grid-cols-4 mb-5 motion-safe:animate-fade-in">
          {monthNames.map((month, index) => (
            <button
              key={month}
              onClick={() => {
                onMonthChange(index);
                onDateSelect(null);
                setShowMonthSelector(false);
              }}
              className={cn(
                "h-auto min-h-[44px] whitespace-normal break-words rounded-xl px-2 py-2.5 text-xs font-medium leading-tight motion-safe:transition-all",
                selectedMonth === index
                  ? "bg-gradient-to-r from-primary to-accent text-white shadow-lg"
                  : "bg-secondary text-muted-foreground hover:bg-primary/10"
              )}
            >
              {month}
            </button>
          ))}
        </div>
      )}

      {/* Stats Grid */}
      <div className="grid grid-cols-1 gap-3 min-[420px]:grid-cols-2 min-[720px]:grid-cols-4 mb-5">
        {stats.map((stat, index) => (
          <div
            key={stat.label}
            className="text-center p-3 bg-secondary/50 rounded-xl hover:bg-secondary motion-safe:transition-colors motion-safe:animate-fade-in"
            style={{ animationDelay: `${index * 100}ms` }}
          >
            <p
              className={cn(
                "text-xl font-bold bg-clip-text text-transparent",
                `bg-gradient-to-r ${stat.gradient}`
              )}
            >
              {stat.value}
            </p>
            <p className="mt-1 whitespace-normal break-words text-xs leading-relaxed text-muted-foreground">
              {stat.label}
            </p>
          </div>
        ))}
      </div>

      {/* The calendar is genuinely two-dimensional, so it scrolls inside the card at narrow widths. */}
      <div className="max-w-full overflow-x-auto overscroll-x-contain pb-1">
        <div className="min-w-[23rem]">
          {/* Day Names */}
          <div className="grid grid-cols-7 gap-1 text-xs text-muted-foreground mb-2">
            {dayNames.map((day) => (
              <div key={day} className="whitespace-normal break-words py-2 text-center font-medium leading-tight">
                {day.slice(0, 2)}
              </div>
            ))}
          </div>

          {/* Calendar Days */}
          <div className="grid grid-cols-7 gap-1.5">
            {calendarDays.map((cell, index) => {
              if (!cell.dateKey) {
                return <div key={`empty-${index}`} className="w-full aspect-square" />;
              }

              const moodEntry = getMoodForDate(cell.dateKey);
              const hasEmotion = !!moodEntry?.emotion?.primary;
              const hasLegacyMood = !!moodEntry?.mood;
              const hasData = hasDataForDate(cell.dateKey);
              const isToday = cell.dateKey === todayKey;
              const isSelected = cell.dateKey === selectedDate;

              const gradient = moodEntry ? getEntryGradient(moodEntry) : "";

              return (
                <button
                  key={cell.dateKey}
                  aria-label={cell.dateKey}
                  aria-pressed={isSelected}
                  onClick={() => onDateSelect(cell.dateKey)}
                  className={cn(
                    "w-full aspect-square min-h-[44px] min-w-[44px] rounded-xl text-xs font-semibold flex items-center justify-center motion-safe:transition-all motion-safe:duration-200",
                    "hover:scale-105 hover:shadow-lg",
                    hasEmotion || hasLegacyMood
                      ? `bg-gradient-to-br ${gradient} text-white shadow-md`
                      : hasData
                        ? "bg-primary/20 text-foreground"
                        : "bg-secondary/50 text-muted-foreground hover:bg-secondary",
                    isToday && "ring-2 ring-primary ring-offset-2 ring-offset-card",
                    isSelected && "ring-2 ring-accent ring-offset-1 ring-offset-card scale-110"
                  )}
                >
                  {hasEmotion ? (
                    <AnimatedEmotionEmoji emotion={moodEntry.emotion!.primary} size="sm" />
                  ) : hasLegacyMood ? (
                    <AnimatedMoodEmoji mood={moodEntry.mood} size="sm" />
                  ) : (
                    cell.day
                  )}
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* Selected Day Details */}
      <div className="mt-5 p-4 bg-gradient-to-br from-secondary/80 to-secondary rounded-xl">
        {selectedDate && selectedDayData ? (
          <div className="space-y-3 motion-safe:animate-fade-in">
            <div className="flex min-w-0 flex-wrap items-center justify-between gap-2">
              <p className="min-w-0 whitespace-normal break-words font-bold text-foreground">
                {selectedDate}
              </p>
              {selectedDayData.mood && (
                <div className="flex shrink-0 items-center gap-2">
                  {selectedDayData.mood.emotion?.primary ? (
                    <AnimatedEmotionEmoji
                      emotion={selectedDayData.mood.emotion.primary}
                      size="md"
                    />
                  ) : (
                    <AnimatedMoodEmoji mood={selectedDayData.mood.mood} size="sm" />
                  )}
                </div>
              )}
            </div>

            <div className="grid grid-cols-1 gap-3 text-sm min-[520px]:grid-cols-2">
              <div className="flex min-w-0 flex-col items-start gap-1 rounded-lg bg-card/50 p-2 min-[420px]:flex-row min-[420px]:justify-between">
                <span className="min-w-0 whitespace-normal break-words text-muted-foreground">{moodTodayLabel}</span>
                <span className="min-w-0 whitespace-normal break-words font-medium min-[420px]:text-end">
                  {selectedDayData.mood
                    ? selectedDayData.mood.emotion?.primary
                      ? getEmotionLabels(calT.locale || "en")[selectedDayData.mood.emotion.primary]
                      : moodConfig[selectedDayData.mood.mood].emoji
                    : "—"}
                </span>
              </div>
              <div className="flex min-w-0 flex-col items-start gap-1 rounded-lg bg-card/50 p-2 min-[420px]:flex-row min-[420px]:justify-between">
                <span className="min-w-0 whitespace-normal break-words text-muted-foreground">{focusMinutesLabel}</span>
                <span className="shrink-0 font-medium min-[420px]:text-end">{selectedDayData.focusMinutes}</span>
              </div>
              <div className="flex min-w-0 flex-col items-start gap-1 rounded-lg bg-card/50 p-2 min-[420px]:flex-row min-[420px]:justify-between">
                <span className="min-w-0 whitespace-normal break-words text-muted-foreground">{habitsCompletedLabel}</span>
                <span className="shrink-0 font-medium min-[420px]:text-end">{selectedDayData.habits.length}</span>
              </div>
              <div className="flex min-w-0 flex-col items-start gap-1 rounded-lg bg-card/50 p-2 min-[420px]:flex-row min-[420px]:justify-between">
                <span className="min-w-0 whitespace-normal break-words text-muted-foreground">{gratitudesLabel}</span>
                <span className="shrink-0 font-medium min-[420px]:text-end">{selectedDayData.gratitude.length}</span>
              </div>
            </div>

            {selectedDayData.habits.length > 0 && (
              <div className="whitespace-normal break-words rounded-lg bg-card/30 p-2 text-xs leading-relaxed text-muted-foreground">
                {selectedDayData.habits.join(", ")}
              </div>
            )}
          </div>
        ) : (
          <p className="whitespace-normal break-words py-4 text-center text-sm leading-relaxed text-muted-foreground">
            {selectDayLabel}
          </p>
        )}
      </div>
    </div>
  );
});

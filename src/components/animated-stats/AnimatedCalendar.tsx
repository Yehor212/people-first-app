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
        "bg-card rounded-2xl p-6 zen-shadow-card overflow-hidden motion-safe:transition-all motion-safe:duration-500",
        isVisible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-4"
      )}
    >
      {/* Header */}
      <div className="flex items-center gap-3 mb-5">
        <div className="relative">
          <div className="p-2.5 bg-gradient-to-br from-violet-500 to-purple-500 rounded-xl shadow-lg shadow-violet-500/20">
            <Calendar className="w-5 h-5 text-white" aria-hidden="true" />
          </div>
          <div className="absolute -top-1 -end-1 w-2 h-2 bg-violet-400 rounded-full motion-safe:animate-pulse" />
        </div>
        <h3 className="text-lg font-bold text-foreground">{title}</h3>
      </div>

      {/* Year & Month Selector */}
      <div className="flex flex-wrap items-center gap-2 mb-5">
        <label className="text-sm text-muted-foreground">{yearLabel}</label>
        <select
          value={selectedYear}
          onChange={(e) =>
            onYearChange(safeParseInt(e.target.value, new Date().getFullYear(), 2020, 2100))
          }
          className="p-2 bg-secondary rounded-xl text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30"
          aria-label={yearLabel || "Select year"}
        >
          {availableYears.map((year) => (
            <option key={year} value={year}>
              {year}
            </option>
          ))}
        </select>

        <div className="ms-auto flex items-center gap-2">
          <button
            onClick={() => handleMonthShift(-1)}
            aria-label={prevMonthLabel}
            className="p-2 rounded-xl bg-secondary hover:bg-primary/10 motion-safe:transition-colors min-w-[44px] min-h-[44px] flex items-center justify-center"
          >
            <ChevronLeft className="w-4 h-4 rtl:scale-x-[-1]" />
          </button>
          <button
            onClick={() => setShowMonthSelector(!showMonthSelector)}
            aria-label={calT.selectMonth || "Select month"}
            className="px-4 py-2 min-h-[44px] rounded-xl bg-gradient-to-r from-primary/10 to-accent/10 text-sm font-medium hover:from-primary/20 hover:to-accent/20 motion-safe:transition-all flex items-center gap-2"
          >
            {monthNames[selectedMonth]} {selectedYear}
            {showMonthSelector ? (
              <ChevronUp className="w-4 h-4" aria-hidden="true" />
            ) : (
              <ChevronDown className="w-4 h-4" aria-hidden="true" />
            )}
          </button>
          <button
            onClick={() => handleMonthShift(1)}
            aria-label={nextMonthLabel}
            className="p-2 rounded-xl bg-secondary hover:bg-primary/10 motion-safe:transition-colors min-w-[44px] min-h-[44px] flex items-center justify-center"
          >
            <ChevronRight className="w-4 h-4 rtl:scale-x-[-1]" />
          </button>
        </div>
      </div>

      {/* Month Selector Grid */}
      {showMonthSelector && (
        <div className="grid grid-cols-4 gap-2 mb-5 motion-safe:animate-fade-in">
          {monthNames.map((month, index) => (
            <button
              key={month}
              onClick={() => {
                onMonthChange(index);
                onDateSelect(null);
                setShowMonthSelector(false);
              }}
              className={cn(
                "px-2 py-2.5 min-h-[44px] rounded-xl text-xs font-medium motion-safe:transition-all",
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
      <div className="grid grid-cols-4 gap-3 mb-5">
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
            <p className="text-xs text-muted-foreground mt-1 line-clamp-1">{stat.label}</p>
          </div>
        ))}
      </div>

      {/* Day Names */}
      <div className="grid grid-cols-7 gap-1 text-xs text-muted-foreground mb-2">
        {dayNames.map((day) => (
          <div key={day} className="text-center font-medium py-2">
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

      {/* Selected Day Details */}
      <div className="mt-5 p-4 bg-gradient-to-br from-secondary/80 to-secondary rounded-xl">
        {selectedDate && selectedDayData ? (
          <div className="space-y-3 motion-safe:animate-fade-in">
            <div className="flex items-center justify-between">
              <p className="font-bold text-foreground">{selectedDate}</p>
              {selectedDayData.mood && (
                <div className="flex items-center gap-2">
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

            <div className="grid grid-cols-2 gap-3 text-sm">
              <div className="flex items-center justify-between p-2 bg-card/50 rounded-lg">
                <span className="text-muted-foreground">{moodTodayLabel}</span>
                <span className="font-medium">
                  {selectedDayData.mood
                    ? selectedDayData.mood.emotion?.primary
                      ? getEmotionLabels(calT.locale || "en")[selectedDayData.mood.emotion.primary]
                      : moodConfig[selectedDayData.mood.mood].emoji
                    : "—"}
                </span>
              </div>
              <div className="flex items-center justify-between p-2 bg-card/50 rounded-lg">
                <span className="text-muted-foreground">{focusMinutesLabel}</span>
                <span className="font-medium">{selectedDayData.focusMinutes}</span>
              </div>
              <div className="flex items-center justify-between p-2 bg-card/50 rounded-lg">
                <span className="text-muted-foreground">{habitsCompletedLabel}</span>
                <span className="font-medium">{selectedDayData.habits.length}</span>
              </div>
              <div className="flex items-center justify-between p-2 bg-card/50 rounded-lg">
                <span className="text-muted-foreground">{gratitudesLabel}</span>
                <span className="font-medium">{selectedDayData.gratitude.length}</span>
              </div>
            </div>

            {selectedDayData.habits.length > 0 && (
              <div className="text-xs text-muted-foreground bg-card/30 p-2 rounded-lg">
                {selectedDayData.habits.join(", ")}
              </div>
            )}
          </div>
        ) : (
          <p className="text-sm text-muted-foreground text-center py-4">{selectDayLabel}</p>
        )}
      </div>
    </div>
  );
});

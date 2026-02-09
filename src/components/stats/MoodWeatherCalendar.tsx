/**
 * MoodWeatherCalendar - Bottom sheet with month grid showing mood history
 * Opens on MoodWeather card tap. Shows day emoji indicators, detail panel, insights.
 * Pattern: custom fixed div modal (NOT Radix Sheet)
 */

import { useMemo, useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronLeft, ChevronRight, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useLanguage } from '@/contexts/LanguageContext';
import { useBackHandler } from '@/hooks/useBackHandler';
import { MoodEntry, MoodType } from '@/types';
import {
  deriveWeatherMood,
  getWeatherMoodConfig,
  WeatherMoodId,
} from '@/lib/weatherMoodConfig';

// ============================================
// TYPES
// ============================================

interface MoodWeatherCalendarProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  moods: MoodEntry[];
  currentWeatherMood: WeatherMoodId;
}

// ============================================
// HELPERS
// ============================================

function formatDate(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function getTodayStr(): string {
  return formatDate(new Date());
}

const MOOD_FILTER_EMOJI: Record<MoodType, string> = {
  great: '😊',
  good: '🙂',
  okay: '😐',
  bad: '😔',
  terrible: '😢',
};

// ============================================
// QUICK INSIGHTS
// ============================================

function useInsights(moods: MoodEntry[], t: Record<string, string>) {
  return useMemo(() => {
    if (moods.length === 0) return null;

    // Most common weather mood
    const moodCounts: Record<string, number> = {};
    moods.forEach((m) => {
      const wm = deriveWeatherMood(m.mood, m.emotion);
      moodCounts[wm] = (moodCounts[wm] || 0) + 1;
    });
    const mostCommonId = Object.entries(moodCounts).sort((a, b) => b[1] - a[1])[0]?.[0] as WeatherMoodId | undefined;
    const mostCommonConfig = mostCommonId ? getWeatherMoodConfig(mostCommonId) : null;

    // Longest streak (consecutive days with moods logged)
    const uniqueDates = [...new Set(moods.map((m) => m.date))].sort();
    let maxStreak = 1;
    let currentStreak = 1;
    for (let i = 1; i < uniqueDates.length; i++) {
      const prev = new Date(uniqueDates[i - 1]);
      const curr = new Date(uniqueDates[i]);
      const diff = (curr.getTime() - prev.getTime()) / (1000 * 60 * 60 * 24);
      if (Math.round(diff) === 1) {
        currentStreak++;
        maxStreak = Math.max(maxStreak, currentStreak);
      } else {
        currentStreak = 1;
      }
    }

    // Best weekday
    const dayScores: Record<number, { total: number; count: number }> = {};
    const moodScoreMap: Record<MoodType, number> = { great: 5, good: 4, okay: 3, bad: 2, terrible: 1 };
    moods.forEach((m) => {
      const dow = new Date(m.date).getDay();
      if (!dayScores[dow]) dayScores[dow] = { total: 0, count: 0 };
      dayScores[dow].total += moodScoreMap[m.mood];
      dayScores[dow].count++;
    });
    const bestDay = Object.entries(dayScores)
      .filter(([, v]) => v.count >= 2)
      .sort((a, b) => b[1].total / b[1].count - a[1].total / a[1].count)[0];
    const dayNames = [t.sun, t.mon, t.tue, t.wed, t.thu, t.fri, t.sat];
    const bestDayName = bestDay ? dayNames[Number(bestDay[0])] : null;

    return { maxStreak, mostCommonConfig, bestDayName };
  }, [moods, t]);
}

// ============================================
// DAY CELL
// ============================================

function DayCell({
  date,
  isCurrentMonth,
  isToday,
  isSelected,
  moodEntry,
  onClick,
}: {
  date: Date;
  isCurrentMonth: boolean;
  isToday: boolean;
  isSelected: boolean;
  moodEntry?: MoodEntry;
  onClick: () => void;
}) {
  const weatherMood = moodEntry ? deriveWeatherMood(moodEntry.mood, moodEntry.emotion) : null;
  const config = weatherMood ? getWeatherMoodConfig(weatherMood) : null;

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={!isCurrentMonth}
      className={cn(
        'relative w-full aspect-square flex flex-col items-center justify-center rounded-xl transition-all duration-150',
        'min-h-[44px]',
        !isCurrentMonth && 'opacity-25 cursor-default',
        isCurrentMonth && 'cursor-pointer active:scale-95',
        isSelected && 'ring-2 ring-primary bg-primary/10',
        isToday && !isSelected && 'ring-1 ring-primary/40',
      )}
      style={
        config && isCurrentMonth
          ? { backgroundColor: `hsl(${config.palette.light.accent} / 0.1)` }
          : undefined
      }
    >
      <span
        className={cn(
          'text-xs leading-none',
          isToday && 'font-bold text-primary',
          !isToday && isCurrentMonth && 'text-foreground',
        )}
      >
        {date.getDate()}
      </span>
      {config && isCurrentMonth && (
        <span className="text-[10px] leading-none mt-0.5">{config.emoji}</span>
      )}
    </button>
  );
}

// ============================================
// DAY DETAIL PANEL
// ============================================

function DayDetail({
  entry,
  dateStr,
  language,
  t,
}: {
  entry: MoodEntry;
  dateStr: string;
  language: string;
  t: Record<string, string>;
}) {
  const weatherMood = deriveWeatherMood(entry.mood, entry.emotion);
  const config = getWeatherMoodConfig(weatherMood);
  const dateObj = new Date(dateStr + 'T12:00:00');
  const formattedDate = dateObj.toLocaleDateString(language, { weekday: 'short', month: 'short', day: 'numeric' });

  const emotionLabel = entry.emotion
    ? `${t[`emotion${entry.emotion.primary.charAt(0).toUpperCase() + entry.emotion.primary.slice(1)}`] || entry.emotion.primary} (${t[entry.emotion.intensity] || entry.emotion.intensity})`
    : null;

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -10 }}
      className="mt-4 p-3 rounded-xl bg-muted/40 border border-border/30"
    >
      <div className="flex items-center gap-2 mb-1">
        <span className="text-lg">{config.emoji}</span>
        <div>
          <p className="text-sm font-semibold text-foreground">{formattedDate}</p>
          <p className="text-xs text-muted-foreground">
            {t[config.labelKey] || config.labelKey}
          </p>
        </div>
      </div>
      {emotionLabel && (
        <p className="text-xs text-muted-foreground mt-1">{emotionLabel}</p>
      )}
      {entry.note && (
        <p className="text-xs text-foreground/80 mt-2 italic line-clamp-3">&ldquo;{entry.note}&rdquo;</p>
      )}
      {entry.tags && entry.tags.length > 0 && (
        <div className="flex flex-wrap gap-1 mt-2">
          {entry.tags.map((tag) => (
            <span key={tag} className="text-[10px] px-1.5 py-0.5 rounded-full bg-primary/10 text-primary">
              {tag}
            </span>
          ))}
        </div>
      )}
    </motion.div>
  );
}

// ============================================
// MAIN COMPONENT
// ============================================

export function MoodWeatherCalendar({
  open,
  onOpenChange,
  moods,
  currentWeatherMood,
}: MoodWeatherCalendarProps) {
  const { t, language } = useLanguage();
  const tRecord = t as Record<string, string>;

  const [currentDate, setCurrentDate] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [moodFilter, setMoodFilter] = useState<MoodType | null>(null);

  useBackHandler(open, () => onOpenChange(false));

  const onClose = useCallback(() => onOpenChange(false), [onOpenChange]);

  // Build moods map: date → latest MoodEntry
  const moodsByDate = useMemo(() => {
    const map = new Map<string, MoodEntry>();
    const filtered = moodFilter ? moods.filter((m) => m.mood === moodFilter) : moods;
    filtered.forEach((entry) => {
      const existing = map.get(entry.date);
      if (!existing || entry.timestamp > existing.timestamp) {
        map.set(entry.date, entry);
      }
    });
    return map;
  }, [moods, moodFilter]);

  // Calendar days grid (6 weeks = 42 cells)
  const calendarDays = useMemo(() => {
    const year = currentDate.getFullYear();
    const month = currentDate.getMonth();
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    const startPadding = firstDay.getDay();
    const totalDays = lastDay.getDate();

    const days: { date: Date; isCurrentMonth: boolean }[] = [];

    for (let i = startPadding - 1; i >= 0; i--) {
      days.push({ date: new Date(year, month, -i), isCurrentMonth: false });
    }
    for (let i = 1; i <= totalDays; i++) {
      days.push({ date: new Date(year, month, i), isCurrentMonth: true });
    }
    const remaining = 42 - days.length;
    for (let i = 1; i <= remaining; i++) {
      days.push({ date: new Date(year, month + 1, i), isCurrentMonth: false });
    }

    return days;
  }, [currentDate]);

  const monthLabel = currentDate.toLocaleDateString(language, { month: 'long', year: 'numeric' });
  const todayStr = getTodayStr();
  const weekdayLabels = [tRecord.sun, tRecord.mon, tRecord.tue, tRecord.wed, tRecord.thu, tRecord.fri, tRecord.sat]
    .map((d) => (d || '').slice(0, 2));

  const insights = useInsights(moods, tRecord);
  const selectedEntry = selectedDate ? moodsByDate.get(selectedDate) : null;

  const goToPrevMonth = () => {
    setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() - 1, 1));
    setSelectedDate(null);
  };
  const goToNextMonth = () => {
    setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 1));
    setSelectedDate(null);
  };

  if (!open) return null;

  const currentConfig = getWeatherMoodConfig(currentWeatherMood);

  return (
    <>
      {/* Overlay */}
      <div
        className="fixed inset-0 z-[60] bg-black/60 backdrop-blur-sm animate-fade-in"
        onClick={onClose}
      />

      {/* Panel */}
      <div
        role="dialog"
        aria-modal="true"
        className="fixed bottom-0 left-0 right-0 z-[60] rounded-t-[2rem] bg-background max-h-[90dvh] overflow-hidden animate-slide-up"
      >
        {/* Handle bar */}
        <div className="flex justify-center pt-3 pb-1">
          <div className="w-12 h-1.5 rounded-full bg-muted-foreground/20" />
        </div>

        {/* Header */}
        <div className="flex items-center justify-between px-5 pb-3">
          <div className="flex items-center gap-2">
            <span className="text-xl">{currentConfig.emoji}</span>
            <h2 className="text-lg font-bold text-foreground">
              {tRecord.moodCalendar || 'Mood Calendar'}
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-xl hover:bg-muted transition-colors"
            aria-label="Close"
          >
            <X className="w-5 h-5 text-muted-foreground" />
          </button>
        </div>

        {/* Scrollable content */}
        <div className="px-5 pb-6 overflow-y-auto max-h-[75dvh] overscroll-contain">
          {/* Quick Insights */}
          {insights && (
            <motion.div
              initial={{ y: 10, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              transition={{ delay: 0.05 }}
              className="grid grid-cols-3 gap-2 mb-4"
            >
              <div className="flex flex-col items-center p-2 rounded-xl bg-muted/30">
                <span className="text-lg font-bold text-foreground">{insights.maxStreak}d</span>
                <span className="text-[10px] text-muted-foreground text-center">
                  {tRecord.moodCalendarStreak || 'Streak'}
                </span>
              </div>
              <div className="flex flex-col items-center p-2 rounded-xl bg-muted/30">
                <span className="text-lg">{insights.mostCommonConfig?.emoji || '—'}</span>
                <span className="text-[10px] text-muted-foreground text-center line-clamp-1">
                  {tRecord.moodCalendarMostCommon || 'Most common'}
                </span>
              </div>
              <div className="flex flex-col items-center p-2 rounded-xl bg-muted/30">
                <span className="text-sm font-bold text-foreground">{insights.bestDayName || '—'}</span>
                <span className="text-[10px] text-muted-foreground text-center">
                  {tRecord.moodCalendarBestDay || 'Best day'}
                </span>
              </div>
            </motion.div>
          )}

          {/* Mood filter pills */}
          <motion.div
            initial={{ y: 10, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ delay: 0.1 }}
            className="flex gap-1.5 mb-4 overflow-x-auto pb-1"
          >
            <button
              type="button"
              onClick={() => setMoodFilter(null)}
              className={cn(
                'shrink-0 px-3 py-1.5 rounded-full text-xs font-medium transition-colors min-h-[36px]',
                !moodFilter ? 'bg-primary text-primary-foreground' : 'bg-muted/50 text-muted-foreground',
              )}
            >
              {tRecord.all || 'All'}
            </button>
            {(Object.keys(MOOD_FILTER_EMOJI) as MoodType[]).map((m) => (
              <button
                key={m}
                type="button"
                onClick={() => setMoodFilter(moodFilter === m ? null : m)}
                className={cn(
                  'shrink-0 px-3 py-1.5 rounded-full text-xs font-medium transition-colors min-h-[36px]',
                  moodFilter === m ? 'bg-primary text-primary-foreground' : 'bg-muted/50 text-muted-foreground',
                )}
              >
                {MOOD_FILTER_EMOJI[m]}
              </button>
            ))}
          </motion.div>

          {/* Month navigation */}
          <motion.div
            initial={{ y: 10, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ delay: 0.15 }}
            className="flex items-center justify-between mb-3"
          >
            <button
              type="button"
              onClick={goToPrevMonth}
              className="p-2 rounded-xl hover:bg-muted transition-colors min-w-[44px] min-h-[44px] flex items-center justify-center"
            >
              <ChevronLeft className="w-5 h-5 text-muted-foreground" />
            </button>
            <span className="text-sm font-semibold text-foreground capitalize">{monthLabel}</span>
            <button
              type="button"
              onClick={goToNextMonth}
              className="p-2 rounded-xl hover:bg-muted transition-colors min-w-[44px] min-h-[44px] flex items-center justify-center"
            >
              <ChevronRight className="w-5 h-5 text-muted-foreground" />
            </button>
          </motion.div>

          {/* Weekday headers */}
          <div className="grid grid-cols-7 gap-1 mb-1">
            {weekdayLabels.map((label, i) => (
              <div key={i} className="text-center text-[10px] font-medium text-muted-foreground py-1">
                {label}
              </div>
            ))}
          </div>

          {/* Day grid */}
          <AnimatePresence mode="wait">
            <motion.div
              key={currentDate.getFullYear() + '-' + currentDate.getMonth()}
              className="grid grid-cols-7 gap-1"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              transition={{ duration: 0.2 }}
            >
              {calendarDays.map((day, i) => {
                const dateStr = formatDate(day.date);
                const moodEntry = moodsByDate.get(dateStr);
                return (
                  <DayCell
                    key={i}
                    date={day.date}
                    isCurrentMonth={day.isCurrentMonth}
                    isToday={dateStr === todayStr}
                    isSelected={dateStr === selectedDate}
                    moodEntry={moodEntry}
                    onClick={() => {
                      if (day.isCurrentMonth) {
                        setSelectedDate(dateStr === selectedDate ? null : dateStr);
                      }
                    }}
                  />
                );
              })}
            </motion.div>
          </AnimatePresence>

          {/* Tap hint */}
          {!selectedDate && moods.length > 0 && (
            <p className="text-[10px] text-muted-foreground text-center mt-2">
              {tRecord.moodCalendarTapDay || 'Tap a day to see details'}
            </p>
          )}

          {/* Selected day detail */}
          <AnimatePresence mode="wait">
            {selectedEntry && selectedDate && (
              <DayDetail
                key={selectedDate}
                entry={selectedEntry}
                dateStr={selectedDate}
                language={language}
                t={tRecord}
              />
            )}
          </AnimatePresence>

          {/* Empty state */}
          {moods.length === 0 && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="flex flex-col items-center justify-center py-8"
            >
              <span className="text-4xl mb-3">🌤️</span>
              <p className="text-sm text-muted-foreground text-center">
                {tRecord.moodCalendarEmpty || 'No mood entries yet'}
              </p>
            </motion.div>
          )}
        </div>
      </div>
    </>
  );
}

export default MoodWeatherCalendar;

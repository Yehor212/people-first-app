/**
 * MoodWeatherCalendar - Premium bottom sheet with mood history calendar
 * Opens on MoodWeather card tap.
 *
 * Design: Glassmorphism header + compact 40px day cells + mood-colored backgrounds
 * Pattern: custom fixed div modal (NOT Radix Sheet)
 */

import { useMemo, useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronLeft, ChevronRight, X, Sparkles } from 'lucide-react';
import { cn, formatDate, getToday } from '@/lib/utils';
import { useLanguage } from '@/contexts/LanguageContext';
import { useTheme } from '@/components/ThemeToggle';
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
// MOOD FILTER CONFIG
// ============================================

const MOOD_FILTERS: { mood: MoodType; emoji: string }[] = [
  { mood: 'great', emoji: '😊' },
  { mood: 'good', emoji: '🙂' },
  { mood: 'okay', emoji: '😐' },
  { mood: 'bad', emoji: '😔' },
  { mood: 'terrible', emoji: '😢' },
];

// ============================================
// SPARKLE PARTICLES (for header)
// ============================================

function HeaderSparkles({ color }: { color: string }) {
  return (
    <div className="absolute inset-0 overflow-hidden pointer-events-none">
      {[0, 1, 2, 3, 4, 5].map((i) => (
        <motion.div
          key={i}
          className="absolute"
          style={{
            left: `${8 + i * 16}%`,
            top: `${15 + (i % 3) * 25}%`,
          }}
          animate={{
            y: [0, -10, 0],
            opacity: [0, 1, 0],
            scale: [0.5, 1, 0.5],
          }}
          transition={{
            duration: 2 + (i % 3) * 0.5,
            delay: i * 0.2,
            repeat: Infinity,
            repeatDelay: 0.5,
          }}
        >
          <Sparkles className="w-3 h-3" style={{ color }} />
        </motion.div>
      ))}
    </div>
  );
}

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
// DAY CELL — compact 40×40px, premium
// ============================================

function DayCell({
  date,
  isCurrentMonth,
  isToday,
  isSelected,
  moodEntry,
  isDark,
  onClick,
}: {
  date: Date;
  isCurrentMonth: boolean;
  isToday: boolean;
  isSelected: boolean;
  moodEntry?: MoodEntry;
  isDark: boolean;
  onClick: () => void;
}) {
  const weatherMood = moodEntry ? deriveWeatherMood(moodEntry.mood, moodEntry.emotion) : null;
  const config = weatherMood ? getWeatherMoodConfig(weatherMood) : null;
  const palette = config ? (isDark ? config.palette.dark : config.palette.light) : null;

  return (
    <motion.button
      type="button"
      onClick={onClick}
      disabled={!isCurrentMonth}
      className={cn(
        'relative w-10 h-10 flex flex-col items-center justify-center rounded-xl transition-all duration-150',
        !isCurrentMonth && 'opacity-20 cursor-default',
        isCurrentMonth && !config && 'bg-muted/30',
        isCurrentMonth && 'cursor-pointer',
        isSelected && 'ring-2 ring-primary shadow-sm',
      )}
      style={
        config && isCurrentMonth && palette
          ? {
              backgroundColor: `hsl(${palette.accent} / ${isSelected ? 0.25 : 0.15})`,
            }
          : undefined
      }
      whileTap={isCurrentMonth ? { scale: 0.9 } : undefined}
    >
      {/* Today pulse ring */}
      {isToday && (
        <motion.div
          className="absolute inset-0 rounded-xl ring-2 ring-primary/60"
          animate={{
            scale: [1, 1.08, 1],
            opacity: [0.7, 0.3, 0.7],
          }}
          transition={{ duration: 2, repeat: Infinity }}
        />
      )}

      {/* Day number */}
      <span
        className={cn(
          'text-[11px] leading-none font-medium',
          isToday && 'font-bold text-primary',
          !isToday && isCurrentMonth && config && 'text-foreground',
          !isToday && isCurrentMonth && !config && 'text-muted-foreground',
        )}
      >
        {date.getDate()}
      </span>

      {/* Mood emoji */}
      {config && isCurrentMonth && (
        <span className="text-[11px] leading-none mt-0.5">{config.emoji}</span>
      )}
    </motion.button>
  );
}

// ============================================
// DAY DETAIL PANEL — mood-themed
// ============================================

function DayDetail({
  entry,
  dateStr,
  language,
  isDark,
  t,
}: {
  entry: MoodEntry;
  dateStr: string;
  language: string;
  isDark: boolean;
  t: Record<string, string>;
}) {
  const weatherMood = deriveWeatherMood(entry.mood, entry.emotion);
  const config = getWeatherMoodConfig(weatherMood);
  const palette = isDark ? config.palette.dark : config.palette.light;
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
      className="mt-3 p-3.5 rounded-2xl border border-border/20 backdrop-blur-sm"
      style={{
        backgroundColor: `hsl(${palette.accent} / 0.08)`,
      }}
    >
      <div className="flex items-start gap-3">
        {/* Emoji with glow */}
        <motion.div
          className="flex-shrink-0 w-10 h-10 rounded-xl flex items-center justify-center"
          style={{
            backgroundColor: `hsl(${palette.accent} / 0.2)`,
            boxShadow: `0 0 12px ${palette.glow}`,
          }}
        >
          <span className="text-lg">{config.emoji}</span>
        </motion.div>

        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-foreground">{formattedDate}</p>
          <p className="text-xs text-muted-foreground">
            {t[config.labelKey] || config.labelKey}
          </p>
          {emotionLabel && (
            <p className="text-xs text-muted-foreground/80 mt-0.5">{emotionLabel}</p>
          )}
        </div>
      </div>

      {entry.note && (
        <p className="text-xs text-foreground/80 mt-2.5 italic line-clamp-3 pl-[52px]">
          &ldquo;{entry.note}&rdquo;
        </p>
      )}
      {entry.tags && entry.tags.length > 0 && (
        <div className="flex flex-wrap gap-1 mt-2 pl-[52px]">
          {entry.tags.map((tag) => (
            <span
              key={tag}
              className="text-[10px] px-2 py-0.5 rounded-full border border-border/20"
              style={{ backgroundColor: `hsl(${palette.accent} / 0.1)` }}
            >
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
  const { effectiveTheme } = useTheme();
  const tRecord = t as Record<string, string>;
  const isDark = effectiveTheme === 'dark' || effectiveTheme === 'oled';

  const [currentDate, setCurrentDate] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [moodFilter, setMoodFilter] = useState<MoodType | null>(null);

  useBackHandler(open, () => onOpenChange(false));

  const onClose = useCallback(() => onOpenChange(false), [onOpenChange]);

  // Current weather mood config for header theming
  const currentConfig = getWeatherMoodConfig(currentWeatherMood);
  const headerPalette = isDark ? currentConfig.palette.dark : currentConfig.palette.light;

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
  const todayStr = getToday();
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
        {/* ====== PREMIUM HEADER ====== */}
        <div
          className="relative h-28 overflow-hidden"
          style={{
            background: `linear-gradient(135deg, hsl(${headerPalette.surface}), hsl(${headerPalette.accent} / 0.35))`,
          }}
        >
          {/* Sparkle particles */}
          <HeaderSparkles color={headerPalette.glow.replace(/[\d.]+\)$/, '0.7)')} />

          {/* Animated gradient orb */}
          <motion.div
            className="absolute -top-16 -right-16 w-56 h-56 rounded-full blur-3xl"
            style={{
              background: `radial-gradient(circle, hsl(${headerPalette.accent} / 0.4), transparent)`,
            }}
            animate={{
              scale: [1, 1.15, 1],
              opacity: [0.3, 0.5, 0.3],
            }}
            transition={{ duration: 5, repeat: Infinity }}
          />

          {/* Handle bar */}
          <div className="absolute top-3 left-1/2 -translate-x-1/2 w-12 h-1.5 rounded-full bg-white/30" />

          {/* Header content */}
          <div className="absolute bottom-4 left-5 right-5 flex items-end justify-between">
            <div className="flex items-center gap-3">
              <motion.div
                className="p-2.5 rounded-xl bg-white/20 backdrop-blur-sm"
                style={{ boxShadow: `0 0 24px ${headerPalette.glow}` }}
                animate={{
                  boxShadow: [
                    `0 0 16px ${headerPalette.glow}`,
                    `0 0 32px ${headerPalette.glow}`,
                    `0 0 16px ${headerPalette.glow}`,
                  ],
                }}
                transition={{ duration: 2.5, repeat: Infinity }}
              >
                <span className="text-xl">{currentConfig.emoji}</span>
              </motion.div>
              <div>
                <h2 className="text-lg font-bold text-white tracking-tight">
                  {tRecord.moodCalendar || 'Mood Calendar'}
                </h2>
                <p className="text-xs text-white/60">
                  {tRecord[currentConfig.messageKey] || ''}
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="p-2 rounded-xl bg-white/10 hover:bg-white/20 transition-colors backdrop-blur-sm"
              aria-label="Close"
            >
              <X className="w-5 h-5 text-white/80" />
            </button>
          </div>
        </div>

        {/* ====== SCROLLABLE CONTENT ====== */}
        <div className="px-5 pb-6 pt-4 overflow-y-auto max-h-[calc(90dvh-7rem)] overscroll-contain">
          <div className="max-w-[420px] mx-auto">

            {/* Quick Insights */}
            {insights && (
              <motion.div
                initial={{ y: 10, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                transition={{ delay: 0.05 }}
                className="grid grid-cols-3 gap-2 mb-4"
              >
                {/* Streak */}
                <div className="flex flex-col items-center p-3 rounded-xl bg-card/60 backdrop-blur-sm border border-border/20">
                  <span className="text-base mb-0.5">🔥</span>
                  <span className="text-base font-bold text-foreground tabular-nums">{insights.maxStreak}d</span>
                  <span className="text-[10px] text-muted-foreground text-center leading-tight mt-0.5">
                    {tRecord.moodCalendarStreak || 'Streak'}
                  </span>
                </div>

                {/* Most common */}
                <div className="flex flex-col items-center p-3 rounded-xl bg-card/60 backdrop-blur-sm border border-border/20">
                  <span className="text-base mb-0.5">{insights.mostCommonConfig?.emoji || '—'}</span>
                  <span className="text-[11px] font-semibold text-foreground text-center line-clamp-1">
                    {insights.mostCommonConfig
                      ? (tRecord[insights.mostCommonConfig.labelKey] || insights.mostCommonConfig.labelKey)
                      : '—'}
                  </span>
                  <span className="text-[10px] text-muted-foreground text-center leading-tight mt-0.5">
                    {tRecord.moodCalendarMostCommon || 'Most common'}
                  </span>
                </div>

                {/* Best day */}
                <div className="flex flex-col items-center p-3 rounded-xl bg-card/60 backdrop-blur-sm border border-border/20">
                  <span className="text-base mb-0.5">🏆</span>
                  <span className="text-sm font-bold text-foreground">{insights.bestDayName || '—'}</span>
                  <span className="text-[10px] text-muted-foreground text-center leading-tight mt-0.5">
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
              className="flex gap-1.5 mb-4 overflow-x-auto pb-1 scrollbar-none"
            >
              <button
                type="button"
                onClick={() => setMoodFilter(null)}
                className={cn(
                  'shrink-0 px-3 py-1.5 rounded-full text-xs font-medium transition-all min-h-[34px]',
                  !moodFilter
                    ? 'bg-primary text-primary-foreground shadow-sm'
                    : 'bg-card/60 backdrop-blur-sm border border-border/20 text-muted-foreground hover:text-foreground',
                )}
              >
                {tRecord.all || 'All'}
              </button>
              {MOOD_FILTERS.map(({ mood, emoji }) => (
                <button
                  key={mood}
                  type="button"
                  onClick={() => setMoodFilter(moodFilter === mood ? null : mood)}
                  className={cn(
                    'shrink-0 px-3 py-1.5 rounded-full text-xs font-medium transition-all min-h-[34px] flex items-center gap-1',
                    moodFilter === mood
                      ? 'bg-primary text-primary-foreground shadow-sm'
                      : 'bg-card/60 backdrop-blur-sm border border-border/20 text-muted-foreground hover:text-foreground',
                  )}
                >
                  <span>{emoji}</span>
                  <span>{tRecord[mood] || mood}</span>
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
                className="p-2 rounded-xl hover:bg-muted transition-colors min-w-[40px] min-h-[40px] flex items-center justify-center"
              >
                <ChevronLeft className="w-5 h-5 text-muted-foreground" />
              </button>
              <AnimatePresence mode="wait">
                <motion.span
                  key={monthLabel}
                  className="text-sm font-semibold text-foreground capitalize"
                  initial={{ opacity: 0, y: -8 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: 8 }}
                  transition={{ duration: 0.15 }}
                >
                  {monthLabel}
                </motion.span>
              </AnimatePresence>
              <button
                type="button"
                onClick={goToNextMonth}
                className="p-2 rounded-xl hover:bg-muted transition-colors min-w-[40px] min-h-[40px] flex items-center justify-center"
              >
                <ChevronRight className="w-5 h-5 text-muted-foreground" />
              </button>
            </motion.div>

            {/* Weekday headers */}
            <div className="grid grid-cols-7 gap-1.5 mb-1 place-items-center">
              {weekdayLabels.map((label, i) => (
                <div key={i} className="w-10 text-center text-[10px] font-medium text-muted-foreground py-1">
                  {label}
                </div>
              ))}
            </div>

            {/* Day grid */}
            <AnimatePresence mode="wait">
              <motion.div
                key={currentDate.getFullYear() + '-' + currentDate.getMonth()}
                className="grid grid-cols-7 gap-1.5 place-items-center"
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
                      isDark={isDark}
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
              <p className="text-[10px] text-muted-foreground text-center mt-2.5">
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
                  isDark={isDark}
                  t={tRecord}
                />
              )}
            </AnimatePresence>

            {/* Empty state */}
            {moods.length === 0 && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="flex flex-col items-center justify-center py-10"
              >
                <motion.span
                  className="text-4xl mb-3"
                  animate={{ scale: [1, 1.1, 1] }}
                  transition={{ duration: 3, repeat: Infinity }}
                >
                  {currentConfig.emoji}
                </motion.span>
                <p className="text-sm text-muted-foreground text-center">
                  {tRecord.moodCalendarEmpty || 'No mood entries yet'}
                </p>
              </motion.div>
            )}
          </div>
        </div>
      </div>
    </>
  );
}

export default MoodWeatherCalendar;

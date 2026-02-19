/**
 * HabitCalendar - GitHub-style contribution calendar for habits
 *
 * Features:
 * - Monthly view with color-coded completion rates
 * - Click on day to see completed habits
 * - Streak visualization
 * - Premium glassmorphism design
 */

import { useMemo, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Calendar, ChevronLeft, ChevronRight, Target, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useLanguage } from '@/contexts/LanguageContext';
import { Habit } from '@/types';
import { isHabitCompletedOnDate } from '@/lib/habits';
import { getDaysInMonth, formatDate } from '@/lib/utils';

interface HabitCalendarProps {
  habits: Habit[];
  className?: string;
}

interface DayData {
  date: string;
  day: number;
  completedCount: number;
  totalHabits: number;
  completionRate: number;
  completedHabits: string[];
  isToday: boolean;
  isFuture: boolean;
}

// Get completion level (0-4) for color intensity
function getCompletionLevel(rate: number): number {
  if (rate === 0) return 0;
  if (rate < 0.25) return 1;
  if (rate < 0.5) return 2;
  if (rate < 0.75) return 3;
  return 4;
}

// Premium color themes for completion levels
const levelColors = {
  light: {
    0: 'bg-slate-100 dark:bg-slate-800/50',
    1: 'bg-emerald-200 dark:bg-emerald-900/60',
    2: 'bg-emerald-300 dark:bg-emerald-700/70',
    3: 'bg-emerald-400 dark:bg-emerald-600/80',
    4: 'bg-emerald-500 dark:bg-emerald-500',
  },
  glow: {
    0: 'none',
    1: '0 0 4px rgba(16, 185, 129, 0.2)',
    2: '0 0 6px rgba(16, 185, 129, 0.3)',
    3: '0 0 8px rgba(16, 185, 129, 0.4)',
    4: '0 0 12px rgba(16, 185, 129, 0.5)',
  },
};

export function HabitCalendar({ habits, className }: HabitCalendarProps) {
  const { t } = useLanguage();
  const today = useMemo(() => new Date(), []);
  const todayStr = formatDate(today);

  const [selectedYear, setSelectedYear] = useState(today.getFullYear());
  const [selectedMonth, setSelectedMonth] = useState(today.getMonth());
  const [selectedDay, setSelectedDay] = useState<DayData | null>(null);

  const monthNames = [
    t.january, t.february, t.march, t.april, t.may, t.june,
    t.july, t.august, t.september, t.october, t.november, t.december
  ];

  const dayNames = [t.sun, t.mon, t.tue, t.wed, t.thu, t.fri, t.sat];

  // Calculate calendar data
  const calendarData = useMemo(() => {
    const daysInMonth = getDaysInMonth(selectedYear, selectedMonth);
    const firstDayOfWeek = new Date(selectedYear, selectedMonth, 1).getDay();
    const monthKey = `${selectedYear}-${String(selectedMonth + 1).padStart(2, '0')}`;

    const days: (DayData | null)[] = [];

    // Empty cells for days before month starts
    for (let i = 0; i < firstDayOfWeek; i++) {
      days.push(null);
    }

    // Days of the month
    for (let day = 1; day <= daysInMonth; day++) {
      const dateStr = `${monthKey}-${String(day).padStart(2, '0')}`;
      const isToday = dateStr === todayStr;
      const isFuture = dateStr > todayStr;

      // Calculate completion for this day
      const completedHabits: string[] = [];
      habits.forEach(habit => {
        if (isHabitCompletedOnDate(habit, dateStr)) {
          completedHabits.push(habit.name);
        }
      });

      const totalHabits = habits.length;
      const completedCount = completedHabits.length;
      const completionRate = totalHabits > 0 ? completedCount / totalHabits : 0;

      days.push({
        date: dateStr,
        day,
        completedCount,
        totalHabits,
        completionRate,
        completedHabits,
        isToday,
        isFuture,
      });
    }

    return days;
  }, [selectedYear, selectedMonth, habits, todayStr]);

  // Calculate month stats
  const monthStats = useMemo(() => {
    const validDays = calendarData.filter((d): d is DayData => d !== null && !d.isFuture);
    const totalCompletions = validDays.reduce((sum, d) => sum + d.completedCount, 0);
    const perfectDays = validDays.filter(d => d.completionRate === 1 && d.totalHabits > 0).length;
    const avgRate = validDays.length > 0
      ? validDays.reduce((sum, d) => sum + d.completionRate, 0) / validDays.length
      : 0;

    return { totalCompletions, perfectDays, avgRate };
  }, [calendarData]);

  const handleMonthChange = (delta: number) => {
    setSelectedDay(null);
    const newMonth = selectedMonth + delta;
    if (newMonth < 0) {
      setSelectedYear(y => y - 1);
      setSelectedMonth(11);
    } else if (newMonth > 11) {
      setSelectedYear(y => y + 1);
      setSelectedMonth(0);
    } else {
      setSelectedMonth(newMonth);
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className={cn(
        'relative overflow-hidden rounded-2xl',
        'bg-card border border-border/50',
        'shadow-lg',
        className
      )}
    >
      {/* Header */}
      <div className="p-4 border-b border-border/30">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <div className="p-2 bg-gradient-to-br from-emerald-500 to-teal-500 rounded-xl">
              <Calendar className="w-4 h-4 text-white" />
            </div>
            <h3 className="text-base font-bold text-foreground">
              {t.habitCalendar || 'Habit Calendar'}
            </h3>
          </div>

          {/* Month navigation */}
          <div className="flex items-center gap-2">
            <button
              onClick={() => handleMonthChange(-1)}
              className="p-1.5 rounded-lg bg-muted/50 hover:bg-muted transition-colors min-w-[44px] min-h-[44px] flex items-center justify-center"
              aria-label={t.calendarPrevMonth || 'Previous month'}
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <span className="text-sm font-medium min-w-[120px] text-center">
              {monthNames[selectedMonth]} {selectedYear}
            </span>
            <button
              onClick={() => handleMonthChange(1)}
              className="p-1.5 rounded-lg bg-muted/50 hover:bg-muted transition-colors min-w-[44px] min-h-[44px] flex items-center justify-center"
              aria-label={t.calendarNextMonth || 'Next month'}
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Month stats */}
        <div className="grid grid-cols-3 gap-2">
          <div className="text-center p-2 bg-muted/30 rounded-xl">
            <p className="text-lg font-bold text-emerald-500">{monthStats.totalCompletions}</p>
            <p className="text-[10px] text-muted-foreground">{t.completions || 'Completions'}</p>
          </div>
          <div className="text-center p-2 bg-muted/30 rounded-xl">
            <p className="text-lg font-bold text-amber-500">{monthStats.perfectDays}</p>
            <p className="text-[10px] text-muted-foreground">{t.perfectDays || 'Perfect Days'}</p>
          </div>
          <div className="text-center p-2 bg-muted/30 rounded-xl">
            <p className="text-lg font-bold text-primary">{Math.round(monthStats.avgRate * 100)}%</p>
            <p className="text-[10px] text-muted-foreground">{t.avgCompletion || 'Avg Rate'}</p>
          </div>
        </div>
      </div>

      {/* Calendar grid */}
      <div className="p-4">
        {/* Day names */}
        <div className="grid grid-cols-7 gap-1 mb-2">
          {dayNames.map((day) => (
            <div key={day} className="text-center text-[10px] font-medium text-muted-foreground py-1">
              {day.slice(0, 2)}
            </div>
          ))}
        </div>

        {/* Days grid */}
        <div className="grid grid-cols-7 gap-1">
          {calendarData.map((dayData, index) => {
            if (!dayData) {
              return <div key={`empty-${index}`} className="aspect-square" />;
            }

            const level = dayData.isFuture ? 0 : getCompletionLevel(dayData.completionRate);
            const isSelected = selectedDay?.date === dayData.date;

            return (
              <motion.button
                key={dayData.date}
                onClick={() => !dayData.isFuture && setSelectedDay(dayData)}
                disabled={dayData.isFuture}
                className={cn(
                  'aspect-square rounded-md flex items-center justify-center relative transition-all',
                  levelColors.light[level as keyof typeof levelColors.light],
                  dayData.isToday && 'ring-2 ring-primary ring-offset-1 ring-offset-background',
                  isSelected && 'ring-2 ring-accent',
                  dayData.isFuture && 'opacity-30 cursor-not-allowed',
                  !dayData.isFuture && 'hover:scale-110 cursor-pointer'
                )}
                style={{
                  boxShadow: levelColors.glow[level as keyof typeof levelColors.glow],
                }}
                whileHover={!dayData.isFuture ? { scale: 1.1 } : {}}
                whileTap={!dayData.isFuture ? { scale: 0.95 } : {}}
              >
                <span className={cn(
                  'text-[10px] font-medium',
                  level >= 3 ? 'text-white' : 'text-foreground'
                )}>
                  {dayData.day}
                </span>

                {/* Perfect day indicator */}
                {dayData.completionRate === 1 && dayData.totalHabits > 0 && (
                  <motion.div
                    className="absolute -top-0.5 -end-0.5 w-2 h-2 bg-amber-400 rounded-full"
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    style={{ boxShadow: '0 0 4px rgba(251, 191, 36, 0.6)' }}
                  />
                )}
              </motion.button>
            );
          })}
        </div>

        {/* Legend */}
        <div className="flex items-center justify-center gap-1 mt-4">
          <span className="text-[10px] text-muted-foreground me-1">{t.less || 'Less'}</span>
          {[0, 1, 2, 3, 4].map((level) => (
            <div
              key={level}
              className={cn(
                'w-3 h-3 rounded-sm',
                levelColors.light[level as keyof typeof levelColors.light]
              )}
            />
          ))}
          <span className="text-[10px] text-muted-foreground ms-1">{t.more || 'More'}</span>
        </div>
      </div>

      {/* Selected day details */}
      <AnimatePresence>
        {selectedDay && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="border-t border-border/30 overflow-hidden"
          >
            <div className="p-4">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <Target className="w-4 h-4 text-emerald-500" />
                  <span className="text-sm font-medium">
                    {selectedDay.date}
                  </span>
                </div>
                <button
                  onClick={() => setSelectedDay(null)}
                  className="p-1 rounded-lg hover:bg-muted/50 transition-colors min-w-[44px] min-h-[44px] flex items-center justify-center"
                  aria-label={t.close || 'Close'}
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div className="flex items-center gap-2 mb-3">
                <div className="flex-1 h-2 bg-muted/30 rounded-full overflow-hidden">
                  <motion.div
                    className="h-full bg-gradient-to-r from-emerald-400 to-emerald-500 rounded-full"
                    initial={{ width: 0 }}
                    animate={{ width: `${selectedDay.completionRate * 100}%` }}
                  />
                </div>
                <span className="text-sm font-bold text-emerald-500">
                  {Math.round(selectedDay.completionRate * 100)}%
                </span>
              </div>

              {selectedDay.completedHabits.length > 0 ? (
                <div className="flex flex-wrap gap-1.5">
                  {selectedDay.completedHabits.map((habitName) => {
                    const habit = habits.find(h => h.name === habitName);
                    return (
                      <motion.div
                        key={habitName}
                        initial={{ scale: 0.8, opacity: 0 }}
                        animate={{ scale: 1, opacity: 1 }}
                        className="flex items-center gap-1 px-2 py-1 bg-emerald-500/10 rounded-full"
                      >
                        <span className="text-xs">{habit?.icon || '✓'}</span>
                        <span className="text-xs font-medium text-emerald-700 dark:text-emerald-300">
                          {habitName}
                        </span>
                      </motion.div>
                    );
                  })}
                </div>
              ) : (
                <p className="text-sm text-muted-foreground text-center py-2">
                  {t.noHabitsCompleted || 'No habits completed'}
                </p>
              )}

              {/* Missed habits */}
              {selectedDay.totalHabits > selectedDay.completedCount && (
                <div className="mt-3 pt-3 border-t border-border/30">
                  <p className="text-[10px] text-muted-foreground mb-2">
                    {t.missedHabits || 'Missed'}:
                  </p>
                  <div className="flex flex-wrap gap-1.5">
                    {habits
                      .filter(h => !selectedDay.completedHabits.includes(h.name))
                      .map((habit) => (
                        <div
                          key={habit.id}
                          className="flex items-center gap-1 px-2 py-1 bg-red-500/10 rounded-full"
                        >
                          <span className="text-xs opacity-50">{habit.icon}</span>
                          <span className="text-xs text-red-600 dark:text-red-400">
                            {habit.name}
                          </span>
                        </div>
                      ))}
                  </div>
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

export default HabitCalendar;

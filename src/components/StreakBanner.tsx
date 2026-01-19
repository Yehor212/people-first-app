/**
 * StreakBanner - Prominent streak display for home tab
 * Shows current activity streak with motivational messaging
 * Includes Rest Mode button for low-energy days
 */

import { useMemo } from 'react';
import { Flame, Zap, Trophy, Moon } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useLanguage } from '@/contexts/LanguageContext';
import { MoodEntry, Habit, FocusSession, GratitudeEntry } from '@/types';
import { getToday, calculateStreak } from '@/lib/utils';

interface StreakBannerProps {
  moods: MoodEntry[];
  habits: Habit[];
  focusSessions: FocusSession[];
  gratitudeEntries: GratitudeEntry[];
  restDays?: string[];
  onRestMode?: () => void;
  isRestMode?: boolean;
}

export function StreakBanner({ moods, habits, focusSessions, gratitudeEntries, restDays = [], onRestMode, isRestMode = false }: StreakBannerProps) {
  const { t } = useLanguage();
  const today = getToday();

  // Calculate streak based on ANY activity (including rest days)
  const streak = useMemo(() => {
    const allActivityDates = [
      ...moods.map(m => m.date),
      ...habits.flatMap(h => h.completedDates),
      ...focusSessions.map(f => f.date),
      ...gratitudeEntries.map(g => g.date),
      ...restDays, // Rest days count towards streak!
    ];
    const uniqueActivityDates = [...new Set(allActivityDates)].sort();
    return calculateStreak(uniqueActivityDates);
  }, [moods, habits, focusSessions, gratitudeEntries, restDays]);

  // Check today's progress
  const todayProgress = useMemo(() => {
    const hasMood = moods.some(m => m.date === today);
    const hasHabits = habits.length === 0 || habits.some(h => h.completedDates?.includes(today));
    const hasFocus = focusSessions.some(s => s.date === today);
    const hasGratitude = gratitudeEntries.some(g => g.date === today);

    const completed = [hasMood, hasHabits, hasFocus, hasGratitude].filter(Boolean).length;
    return { completed, total: 4, hasMood, hasHabits, hasFocus, hasGratitude };
  }, [moods, habits, focusSessions, gratitudeEntries, today]);

  // Get streak message
  const getMessage = () => {
    if (streak === 0) {
      return t.startStreak;
    }
    if (streak >= 30) {
      return t.legendaryStreak;
    }
    if (streak >= 7) {
      return t.amazingStreak;
    }
    if (streak >= 3) {
      return t.keepItUp;
    }
    return t.goodStart;
  };

  // Get icon based on streak
  const Icon = streak >= 7 ? Trophy : streak >= 3 ? Flame : Zap;

  return (
    <div className={cn(
      "relative overflow-hidden rounded-2xl p-4 transition-all",
      streak >= 7
        ? "bg-gradient-to-r from-yellow-500/20 via-orange-500/20 to-red-500/20 ring-1 ring-yellow-500/30"
        : streak >= 3
          ? "bg-gradient-to-r from-orange-500/20 to-red-500/20 ring-1 ring-orange-500/30"
          : "bg-gradient-to-r from-primary/10 to-accent/10 ring-1 ring-primary/20"
    )}>
      {/* Background glow for high streaks */}
      {streak >= 7 && (
        <div className="absolute inset-0 bg-gradient-to-r from-yellow-500/10 via-transparent to-orange-500/10 animate-pulse" />
      )}

      <div className="relative flex items-center gap-4">
        {/* Icon */}
        <div className={cn(
          "w-14 h-14 rounded-2xl flex items-center justify-center",
          streak >= 7
            ? "bg-gradient-to-br from-yellow-500 to-orange-500 text-white"
            : streak >= 3
              ? "bg-gradient-to-br from-orange-500 to-red-500 text-white"
              : "bg-primary/20 text-primary"
        )}>
          <Icon className={cn(
            "w-7 h-7",
            streak >= 3 && "animate-pulse"
          )} />
        </div>

        {/* Content */}
        <div className="flex-1">
          <div className="flex items-baseline gap-2">
            <span className={cn(
              "text-3xl font-bold",
              streak >= 7 ? "text-yellow-500" : streak >= 3 ? "text-orange-500" : "text-primary"
            )}>
              {streak}
            </span>
            <span className="text-sm text-muted-foreground">
              {t.daysInRow}
            </span>
          </div>
          <p className="text-sm text-muted-foreground mt-0.5">
            {getMessage()}
          </p>
        </div>

        {/* Today's progress indicator */}
        <div className="flex flex-col items-end gap-1">
          <div className="flex gap-1">
            {['💜', '🎯', '🧠', '💖'].map((emoji, i) => {
              const done = [
                todayProgress.hasMood,
                todayProgress.hasHabits,
                todayProgress.hasFocus,
                todayProgress.hasGratitude
              ][i];
              return (
                <span
                  key={i}
                  className={cn(
                    "text-lg transition-all",
                    done ? "opacity-100 scale-100" : "opacity-30 scale-90"
                  )}
                >
                  {done ? '✅' : emoji}
                </span>
              );
            })}
          </div>
          <span className="text-xs text-muted-foreground">
            {todayProgress.completed}/4 {t.today}
          </span>
        </div>
      </div>

      {/* Progress bar for today */}
      <div className="mt-3 h-1.5 bg-muted/50 rounded-full overflow-hidden">
        <div
          className={cn(
            "h-full rounded-full transition-all duration-500",
            todayProgress.completed === 4
              ? "bg-gradient-to-r from-green-500 to-emerald-500"
              : "bg-gradient-to-r from-primary to-accent"
          )}
          style={{ width: `${(todayProgress.completed / 4) * 100}%` }}
        />
      </div>

      {/* Rest Mode Button - shown when no progress today and not already in rest mode */}
      {onRestMode && todayProgress.completed === 0 && !isRestMode && (
        <button
          onClick={onRestMode}
          className="mt-3 w-full py-2.5 flex items-center justify-center gap-2 bg-indigo-500/10 hover:bg-indigo-500/20 text-indigo-400 rounded-xl transition-colors text-sm font-medium"
        >
          <Moon className="w-4 h-4" />
          {t.restDayButton || 'День отдыха'}
        </button>
      )}
    </div>
  );
}

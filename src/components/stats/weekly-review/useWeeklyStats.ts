import { useMemo, useCallback } from 'react';
import { Target, Brain, Flame } from 'lucide-react';
import { formatDate } from '@/lib/utils';
import { isHabitCompletedOnDate } from '@/lib/habits';
import { Habit, MoodEntry, FocusSession } from '@/types';
import type { WeekStats } from './types';

interface UseWeeklyStatsParams {
  habits: Habit[];
  moods: MoodEntry[];
  focusSessions: FocusSession[];
  currentStreak: number;
  t: Record<string, string>;
}

export function useWeeklyStats({ habits, moods, focusSessions, currentStreak, t }: UseWeeklyStatsParams) {
  const dayNames = [t.sun, t.mon, t.tue, t.wed, t.thu, t.fri, t.sat];

  // Calculate this week and last week dates
  const weekDates = useMemo(() => {
    const today = new Date();
    const thisWeek: string[] = [];
    const lastWeek: string[] = [];

    for (let i = 6; i >= 0; i--) {
      const d = new Date(today);
      d.setDate(d.getDate() - i);
      thisWeek.push(formatDate(d));

      const ld = new Date(today);
      ld.setDate(ld.getDate() - i - 7);
      lastWeek.push(formatDate(ld));
    }

    return { thisWeek, lastWeek };
  }, []);

  // Calculate week stats
  const calculateWeekStats = useCallback((dates: string[]): WeekStats => {
    let habitsCompleted = 0;
    let totalPossible = 0;
    let focusMinutes = 0;
    let moodTotal = 0;
    let moodCount = 0;
    let perfectDays = 0;
    let bestDay: string | null = null;
    let bestDayScore = 0;

    dates.forEach(date => {
      // Habits
      const dayHabits = habits.filter(h => isHabitCompletedOnDate(h, date)).length;
      habitsCompleted += dayHabits;
      totalPossible += habits.length;

      // Focus
      const dayFocus = focusSessions
        .filter(s => s.date === date && s.completedAt)
        .reduce((sum, s) => sum + s.duration, 0);
      focusMinutes += dayFocus;

      // Mood
      const dayMoods = moods.filter(m => m.date === date);
      dayMoods.forEach(m => {
        const score = m.mood === 'great' ? 5 : m.mood === 'good' ? 4 : m.mood === 'okay' ? 3 : m.mood === 'bad' ? 2 : 1;
        moodTotal += score;
        moodCount++;
      });

      // Perfect day check
      const isPerfect = dayHabits === habits.length && habits.length > 0 && dayFocus >= 30;
      if (isPerfect) perfectDays++;

      // Best day calculation
      const dayScore = (dayHabits / Math.max(habits.length, 1)) * 50 +
                       Math.min(dayFocus / 60, 1) * 30 +
                       (dayMoods.length > 0 ? (moodTotal / moodCount / 5) * 20 : 0);
      if (dayScore > bestDayScore) {
        bestDayScore = dayScore;
        bestDay = date;
      }
    });

    return {
      habitsCompleted,
      habitRate: totalPossible > 0 ? Math.round((habitsCompleted / totalPossible) * 100) : 0,
      focusMinutes,
      moodAvg: moodCount > 0 ? moodTotal / moodCount : 0,
      perfectDays,
      bestDay,
    };
  }, [habits, moods, focusSessions]);

  const thisWeekStats = useMemo(() => calculateWeekStats(weekDates.thisWeek), [weekDates.thisWeek, calculateWeekStats]);
  const lastWeekStats = useMemo(() => calculateWeekStats(weekDates.lastWeek), [weekDates.lastWeek, calculateWeekStats]);

  // Calculate changes
  const changes = {
    habitRate: thisWeekStats.habitRate - lastWeekStats.habitRate,
    focusMinutes: thisWeekStats.focusMinutes - lastWeekStats.focusMinutes,
    moodAvg: thisWeekStats.moodAvg - lastWeekStats.moodAvg,
  };

  // Overall score
  const weekScore = Math.round(
    thisWeekStats.habitRate * 0.4 +
    Math.min(thisWeekStats.focusMinutes / 300, 1) * 100 * 0.3 +
    (thisWeekStats.moodAvg / 5) * 100 * 0.3
  );

  // Get recommendation based on stats
  const getRecommendation = () => {
    if (thisWeekStats.habitRate < 50) {
      return t.weeklyRecommendationHabits || "Focus on building one habit at a time. Consistency beats perfection.";
    }
    if (thisWeekStats.focusMinutes < 120) {
      return t.weeklyRecommendationFocus || "Try adding one 25-minute focus session per day to boost productivity.";
    }
    if (thisWeekStats.moodAvg < 3) {
      return t.weeklyRecommendationMood || "Consider adding gratitude journaling to improve your daily mood.";
    }
    return t.weeklyRecommendationGreat || "Outstanding week! Keep this momentum going into next week.";
  };

  // Top achievements
  const achievements = [
    {
      icon: Target,
      title: t.habitsCompleted || 'Habits',
      value: `${thisWeekStats.habitsCompleted}`,
      color: '#10b981',
    },
    {
      icon: Brain,
      title: t.focusMinutes || 'Focus',
      value: `${thisWeekStats.focusMinutes}m`,
      color: '#8b5cf6',
    },
    {
      icon: Flame,
      title: t.streak || 'Streak',
      value: `${currentStreak}d`,
      color: '#f97316',
    },
  ];

  // Best day of week
  const bestDayName = thisWeekStats.bestDay
    ? dayNames[new Date(thisWeekStats.bestDay).getDay()]
    : null;

  return {
    weekScore,
    thisWeekStats,
    lastWeekStats,
    changes,
    achievements,
    getRecommendation,
    bestDayName,
    dayNames,
  };
}

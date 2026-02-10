/**
 * useStatsCalculations Hook
 * Extracts stats calculation logic from StatsPage for better maintainability
 */

import { useMemo } from 'react';
import { MoodEntry, Habit, FocusSession, GratitudeEntry, PrimaryEmotion } from '@/types';
import { calculateStreak, getToday, parseLocalDate } from '@/lib/utils';
import { getHabitCompletedDates } from '@/lib/habits';
import { getEmotionScore, MOOD_TO_EMOTION_MAP } from '@/lib/emotionConstants';

export type StatsRange = 'week' | 'month' | 'all';

interface UseStatsCalculationsProps {
  moods: MoodEntry[];
  habits: Habit[];
  focusSessions: FocusSession[];
  gratitudeEntries: GratitudeEntry[];
  restDays: string[];
  currentFocusMinutes?: number;
  range: StatsRange;
  selectedTag: string;
  monthNames: string[];
}

interface Stats {
  totalFocusMinutes: number;
  allTimeFocusMinutes: number;
  totalHabitCompletions: number;
  currentStreak: number;
  moodCounts: Record<string, number>;
  emotionCounts: Record<PrimaryEmotion, number>;
  totalEmotionEntries: number;
  thisMonthMoods: number;
  thisMonthFocusMinutes: number;
  thisMonthGratitude: number;
  monthName: string;
}

interface PremiumStats {
  moodScore: number;
  habitRate: number;
  focusScore: number;
  weekScore: number;
  weeklyChange: number;
  currentMood: string;
}

interface MoodInsights {
  bestDay: { day: string; avg: number } | null;
  focusAvg: { withFocus: number; withoutFocus: number } | null;
  habitDiffs: Array<{ id: string; name: string; diff: number }>;
}

export function useStatsCalculations({
  moods,
  habits,
  focusSessions,
  gratitudeEntries,
  restDays,
  currentFocusMinutes,
  range,
  selectedTag,
  monthNames,
}: UseStatsCalculationsProps) {
  // Filter completed focus sessions
  const completedFocusSessions = useMemo(
    () => focusSessions.filter((session) => session.status !== 'aborted'),
    [focusSessions]
  );

  // Filter moods by tag and range
  const filteredMoods = useMemo(() => {
    let filtered = moods;

    if (selectedTag !== 'all') {
      filtered = filtered.filter((m) => m.tags?.includes(selectedTag));
    }

    if (range === 'week') {
      const weekAgo = new Date();
      weekAgo.setDate(weekAgo.getDate() - 7);
      weekAgo.setHours(0, 0, 0, 0);
      filtered = filtered.filter((m) => parseLocalDate(m.date) >= weekAgo);
    } else if (range === 'month') {
      const thisMonth = new Date().toISOString().slice(0, 7);
      filtered = filtered.filter((m) => m.date.startsWith(thisMonth));
    }

    return filtered;
  }, [moods, selectedTag, range]);

  // Main stats calculation
  const stats = useMemo((): Stats => {
    const rangeDates = new Set(filteredMoods.map((entry) => entry.date));
    const totalFocusMinutes = completedFocusSessions
      .filter((session) => range === 'all' || rangeDates.has(session.date))
      .reduce((acc, s) => acc + s.duration, 0);

    const completedMinutes = completedFocusSessions.reduce((acc, s) => acc + s.duration, 0);
    const allTimeFocusMinutes = completedMinutes + (currentFocusMinutes || 0);

    const totalHabitCompletions = habits.reduce((acc, habit) => {
      const count = getHabitCompletedDates(habit).filter(
        (date) => range === 'all' || rangeDates.has(date)
      ).length;
      return acc + count;
    }, 0);

    // Calculate streak from ALL activities
    const allActivityDates = [
      ...moods.map((m) => m.date),
      ...habits.flatMap((h) => getHabitCompletedDates(h)),
      ...completedFocusSessions.map((f) => f.date),
      ...gratitudeEntries.map((g) => g.date),
      ...restDays,
    ];
    const uniqueDates = [...new Set(allActivityDates)].sort();
    const currentStreak = calculateStreak(uniqueDates);

    const moodCounts = filteredMoods.reduce((acc, m) => {
      acc[m.mood] = (acc[m.mood] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    const emotionCounts = filteredMoods.reduce((acc, m) => {
      if (m.emotion?.primary) {
        acc[m.emotion.primary] = (acc[m.emotion.primary] || 0) + 1;
      } else if (m.mood) {
        const mappedEmotion = MOOD_TO_EMOTION_MAP[m.mood];
        if (mappedEmotion) {
          acc[mappedEmotion] = (acc[mappedEmotion] || 0) + 1;
        }
      }
      return acc;
    }, {} as Record<PrimaryEmotion, number>);

    const totalEmotionEntries = Object.values(emotionCounts).reduce((a, b) => a + b, 0);

    const now = new Date();
    const thisMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
    const today = getToday();

    const weekStart = new Date(now);
    weekStart.setDate(now.getDate() - 6);
    weekStart.setHours(0, 0, 0, 0);

    const filterByRange = <T extends { date: string }>(data: T[]): T[] => {
      if (range === 'week') {
        return data.filter((item) => parseLocalDate(item.date) >= weekStart);
      }
      if (range === 'month') {
        return data.filter((item) => item.date.startsWith(thisMonth));
      }
      return data;
    };

    const rangeMoods = filterByRange(moods);
    const rangeFocus = filterByRange(completedFocusSessions);
    const rangeGratitude = filterByRange(gratitudeEntries);

    const rangeBaseFocusMinutes = rangeFocus.reduce((acc, s) => acc + s.duration, 0);
    const isCurrentInRange =
      range === 'all' ||
      (range === 'month' && today.startsWith(thisMonth)) ||
      (range === 'week' && parseLocalDate(today) >= weekStart);
    const finalRangeFocusMinutes =
      currentFocusMinutes !== undefined && isCurrentInRange
        ? rangeBaseFocusMinutes + currentFocusMinutes
        : rangeBaseFocusMinutes;

    const rangeTitle =
      range === 'week'
        ? 'This Week'
        : range === 'month'
          ? monthNames[now.getMonth()]
          : 'All Time';

    return {
      totalFocusMinutes,
      allTimeFocusMinutes,
      totalHabitCompletions,
      currentStreak,
      moodCounts,
      emotionCounts,
      totalEmotionEntries,
      thisMonthMoods: rangeMoods.length,
      thisMonthFocusMinutes: finalRangeFocusMinutes,
      thisMonthGratitude: rangeGratitude.length,
      monthName: rangeTitle,
    };
  }, [
    moods,
    habits,
    completedFocusSessions,
    gratitudeEntries,
    restDays,
    monthNames,
    filteredMoods,
    range,
    currentFocusMinutes,
  ]);

  // Premium stats for dashboard widgets
  const premiumStats = useMemo((): PremiumStats => {
    // Unified scoring: uses emotion system when available, falls back to legacy mood
    const getScore = (m: MoodEntry): number => {
      if (m.emotion?.primary) return getEmotionScore(m.emotion.primary, m.emotion.intensity);
      switch (m.mood) {
        case 'great': return 5;
        case 'good': return 4;
        case 'okay': return 3;
        case 'bad': return 2;
        case 'terrible': return 1;
        default: return 3;
      }
    };

    const moodScores = filteredMoods.map(getScore);
    const avgMoodScore =
      moodScores.length > 0 ? moodScores.reduce((a, b) => a + b, 0) / moodScores.length : 3;

    const now = new Date();
    const actualDaysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
    const daysInRange = range === 'week' ? 7 : range === 'month' ? actualDaysInMonth : 90;
    const totalPossibleCompletions = habits.length * daysInRange;
    const habitRate =
      totalPossibleCompletions > 0
        ? Math.min(100, (stats.totalHabitCompletions / totalPossibleCompletions) * 100)
        : 0;

    const dailyFocusTarget = 60;
    const avgDailyFocus = stats.totalFocusMinutes / Math.max(1, daysInRange);
    const focusScore = Math.min(100, (avgDailyFocus / dailyFocusTarget) * 100);

    const latestMood = moods.length > 0 ? moods[moods.length - 1]?.mood : 'okay';

    const weekScore = Math.round(
      ((avgMoodScore - 1) / 4) * 100 * 0.3 + habitRate * 0.4 + focusScore * 0.3
    );

    // Weekly change calculation
    let weeklyChange = 0;
    const oneWeekAgo = new Date(now);
    oneWeekAgo.setDate(now.getDate() - 7);
    const twoWeeksAgo = new Date(now);
    twoWeeksAgo.setDate(now.getDate() - 14);

    const thisWeekMoods = moods.filter((m) => parseLocalDate(m.date) >= oneWeekAgo);
    const lastWeekMoods = moods.filter((m) => {
      const date = parseLocalDate(m.date);
      return date >= twoWeeksAgo && date < oneWeekAgo;
    });

    if (thisWeekMoods.length > 0 && lastWeekMoods.length > 0) {
      const thisWeekAvg =
        thisWeekMoods.reduce((sum, m) => sum + getScore(m), 0) / thisWeekMoods.length;
      const lastWeekAvg =
        lastWeekMoods.reduce((sum, m) => sum + getScore(m), 0) / lastWeekMoods.length;

      weeklyChange = Math.round(((thisWeekAvg - lastWeekAvg) / lastWeekAvg) * 100);
    }

    return {
      moodScore: avgMoodScore,
      habitRate,
      focusScore,
      weekScore,
      weeklyChange,
      currentMood: latestMood || 'okay',
    };
  }, [filteredMoods, habits, moods, range, stats.totalHabitCompletions, stats.totalFocusMinutes]);

  // Mood insights (best day, focus correlation, habit correlation)
  const moodInsights = useMemo((): MoodInsights => {
    if (filteredMoods.length === 0) {
      return {
        bestDay: null,
        focusAvg: null,
        habitDiffs: [],
      };
    }

    const getMoodEntryScore = (entry: MoodEntry): number => {
      if (entry.emotion?.primary) {
        return getEmotionScore(entry.emotion.primary, entry.emotion.intensity);
      }
      switch (entry.mood) {
        case 'great':
          return 5;
        case 'good':
          return 4;
        case 'okay':
          return 3;
        case 'bad':
          return 2;
        case 'terrible':
          return 1;
        default:
          return 0;
      }
    };

    const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    const moodByDay: Record<number, { total: number; count: number }> = {};

    filteredMoods.forEach((entry) => {
      const day = parseLocalDate(entry.date).getDay();
      const score = getMoodEntryScore(entry);
      const current = moodByDay[day] || { total: 0, count: 0 };
      moodByDay[day] = { total: current.total + score, count: current.count + 1 };
    });

    let bestDay: { day: string; avg: number } | null = null;
    let maxAvg = 0;
    Object.entries(moodByDay).forEach(([dayStr, data]) => {
      const avg = data.total / data.count;
      if (avg > maxAvg) {
        maxAvg = avg;
        bestDay = { day: dayNames[parseInt(dayStr)], avg };
      }
    });

    // Focus correlation
    const focusDates = new Set(completedFocusSessions.map((s) => s.date));
    const withFocusMoods = filteredMoods.filter((m) => focusDates.has(m.date));
    const withoutFocusMoods = filteredMoods.filter((m) => !focusDates.has(m.date));

    let focusAvg: { withFocus: number; withoutFocus: number } | null = null;
    if (withFocusMoods.length > 0 && withoutFocusMoods.length > 0) {
      const avgWith =
        withFocusMoods.reduce((acc, m) => acc + getMoodEntryScore(m), 0) / withFocusMoods.length;
      const avgWithout =
        withoutFocusMoods.reduce((acc, m) => acc + getMoodEntryScore(m), 0) /
        withoutFocusMoods.length;
      focusAvg = { withFocus: avgWith, withoutFocus: avgWithout };
    }

    // Habit correlation
    const habitDiffs: Array<{ id: string; name: string; diff: number }> = [];
    habits.forEach((habit) => {
      const completedDates = new Set(getHabitCompletedDates(habit));
      const withHabitMoods = filteredMoods.filter((m) => completedDates.has(m.date));
      const withoutHabitMoods = filteredMoods.filter((m) => !completedDates.has(m.date));

      if (withHabitMoods.length >= 3 && withoutHabitMoods.length >= 3) {
        const avgWith =
          withHabitMoods.reduce((acc, m) => acc + getMoodEntryScore(m), 0) / withHabitMoods.length;
        const avgWithout =
          withoutHabitMoods.reduce((acc, m) => acc + getMoodEntryScore(m), 0) /
          withoutHabitMoods.length;
        const diff = avgWith - avgWithout;
        if (Math.abs(diff) >= 0.3) {
          habitDiffs.push({ id: habit.id, name: habit.name, diff });
        }
      }
    });

    habitDiffs.sort((a, b) => Math.abs(b.diff) - Math.abs(a.diff));

    return { bestDay, focusAvg, habitDiffs: habitDiffs.slice(0, 3) };
  }, [filteredMoods, completedFocusSessions, habits]);

  // Date mappings for calendar/heatmap
  const moodsByDate = useMemo(() => {
    const map: Record<string, MoodEntry[]> = {};
    moods.forEach((m) => {
      if (!map[m.date]) map[m.date] = [];
      map[m.date].push(m);
    });
    return map;
  }, [moods]);

  const focusMinutesByDate = useMemo(() => {
    const map: Record<string, number> = {};
    completedFocusSessions.forEach((s) => {
      map[s.date] = (map[s.date] || 0) + s.duration;
    });
    return map;
  }, [completedFocusSessions]);

  const gratitudeByDate = useMemo(() => {
    const map: Record<string, GratitudeEntry[]> = {};
    gratitudeEntries.forEach((g) => {
      if (!map[g.date]) map[g.date] = [];
      map[g.date].push(g);
    });
    return map;
  }, [gratitudeEntries]);

  const habitCompletionMap = useMemo(() => {
    const map: Record<string, string[]> = {};
    habits.forEach((habit) => {
      getHabitCompletedDates(habit).forEach((date) => {
        if (!map[date]) map[date] = [];
        map[date].push(habit.name);
      });
    });
    return map;
  }, [habits]);

  return {
    completedFocusSessions,
    filteredMoods,
    stats,
    premiumStats,
    moodInsights,
    moodsByDate,
    focusMinutesByDate,
    gratitudeByDate,
    habitCompletionMap,
  };
}

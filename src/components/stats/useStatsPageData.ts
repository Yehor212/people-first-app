/**
 * useStatsPageData — shared data hook for StatsPage tabs
 * Extracts cross-tab useMemo computations from the original 1,281L monolith.
 */

import { useMemo } from 'react';
import { MoodEntry, Habit, FocusSession, GratitudeEntry } from '@/types';
import { getToday, formatDate } from '@/lib/utils';
import { getHabitCompletedDates, isHabitCompletedOnDate } from '@/lib/habits';
import { getEmotionScore, getEmotionLabels, MOOD_TO_EMOTION_MAP } from '@/lib/emotionConstants';
import { deriveCurrentWeather } from '@/lib/weatherMoodConfig';
import { generateWeeklyStory, hasEnoughDataForStory, getCurrentWeekRange } from '@/lib/progressStories';

interface UseStatsPageDataProps {
  moods: MoodEntry[];
  habits: Habit[];
  focusSessions: FocusSession[];
  gratitudeEntries: GratitudeEntry[];
  completedFocusSessions: FocusSession[];
  stats: { currentStreak: number };
  t: Record<string, string>;
}

// Legacy moodScore for backward compat with components
function moodScore(mood: MoodEntry['mood']): number {
  switch (mood) {
    case 'great': return 5;
    case 'good': return 4;
    case 'okay': return 3;
    case 'bad': return 2;
    case 'terrible': return 1;
    default: return 0;
  }
}

export function useStatsPageData({
  moods,
  habits,
  focusSessions,
  gratitudeEntries,
  completedFocusSessions,
  stats,
  t,
}: UseStatsPageDataProps) {
  // Get emotion labels for current language
  const emotionLabels = useMemo(() => getEmotionLabels(t.locale || 'en'), [t.locale]);

  const allTags = useMemo(() => {
    const set = new Set<string>();
    moods.forEach((entry) => (entry.tags || []).forEach((tag) => set.add(tag)));
    return Array.from(set).sort();
  }, [moods]);

  // Store ALL mood entries per date (not just one)
  const moodsByDate = useMemo(() => {
    const map = new Map<string, MoodEntry[]>();
    moods.forEach((entry) => {
      const existing = map.get(entry.date) || [];
      existing.push(entry);
      map.set(entry.date, existing);
    });
    // Sort entries by timestamp within each day
    map.forEach((entries) => {
      entries.sort((a, b) => a.timestamp - b.timestamp);
    });
    return map;
  }, [moods]);

  // Legacy single mood per date (for calendar coloring - uses last mood of day)
  const moodByDate = useMemo(() => {
    const map = new Map<string, MoodEntry>();
    moods.forEach((entry) => {
      const existing = map.get(entry.date);
      if (!existing || entry.timestamp > existing.timestamp) {
        map.set(entry.date, entry);
      }
    });
    return map;
  }, [moods]);

  const focusMinutesByDate = useMemo(() => {
    const map = new Map<string, number>();
    completedFocusSessions.forEach((session) => {
      map.set(session.date, (map.get(session.date) || 0) + session.duration);
    });
    return map;
  }, [completedFocusSessions]);

  const gratitudeByDate = useMemo(() => {
    const map = new Map<string, GratitudeEntry[]>();
    gratitudeEntries.forEach((entry) => {
      const items = map.get(entry.date) || [];
      items.push(entry);
      map.set(entry.date, items);
    });
    return map;
  }, [gratitudeEntries]);

  const habitCompletionMap = useMemo(() => {
    const map = new Map<string, string[]>();
    habits.forEach((habit) => {
      getHabitCompletedDates(habit).forEach((date) => {
        const list = map.get(date) || [];
        list.push(habit.name);
        map.set(date, list);
      });
    });
    return map;
  }, [habits]);

  // Smart weather: today → yesterday → 7-day weighted average → neutral
  const currentWeatherInput = useMemo(() => deriveCurrentWeather(moods), [moods]);

  // Phase 13: EmotionGalaxy data - ONLY TODAY'S emotions
  const todayMoods = useMemo(() => {
    const today = getToday();
    return moods.filter(m => m.date === today);
  }, [moods]);

  const emotionGalaxyData = useMemo(() => {
    const emotionColors: Record<string, string> = {
      joy: '#fbbf24', trust: '#22c55e', fear: '#6366f1', surprise: '#f97316',
      sadness: '#3b82f6', disgust: '#a855f7', anger: '#ef4444', anticipation: '#ec4899',
    };
    const emotionEmojis: Record<string, string> = {
      joy: '😊', trust: '🤝', fear: '😨', surprise: '😲',
      sadness: '😢', disgust: '🤢', anger: '😠', anticipation: '🤩',
    };

    const todayCounts: Record<string, number> = {};
    todayMoods.forEach(m => {
      if (m.emotion?.primary) {
        todayCounts[m.emotion.primary] = (todayCounts[m.emotion.primary] || 0) + 1;
      } else if (m.mood) {
        const mapped = MOOD_TO_EMOTION_MAP[m.mood];
        if (mapped) {
          todayCounts[mapped] = (todayCounts[mapped] || 0) + 1;
        }
      }
    });

    return Object.entries(todayCounts)
      .filter(([_, count]) => count > 0)
      .map(([emotion, count]) => ({
        emotion,
        emoji: emotionEmojis[emotion] || '😐',
        count,
        color: emotionColors[emotion] || '#9ca3af',
      }));
  }, [todayMoods]);

  // Weekly data for ring detail sheet + previous week averages for trend
  const ringWeeklyData = useMemo(() => {
    const today = new Date();
    const weekDays: string[] = [];
    for (let i = 6; i >= 0; i--) {
      const d = new Date(today);
      d.setDate(d.getDate() - i);
      weekDays.push(formatDate(d));
    }

    const prevWeekDays: string[] = [];
    for (let i = 13; i >= 7; i--) {
      const d = new Date(today);
      d.setDate(d.getDate() - i);
      prevWeekDays.push(formatDate(d));
    }

    const moodData = weekDays.map(date => {
      const dayMoods = moods.filter(m => m.date === date);
      if (dayMoods.length === 0) return { date, value: 0 };
      const avgScore = dayMoods.reduce((sum, m) => {
        const score = m.emotion?.primary
          ? getEmotionScore(m.emotion.primary, m.emotion.intensity)
          : moodScore(m.mood);
        return sum + score;
      }, 0) / dayMoods.length;
      return { date, value: Math.round((avgScore / 5) * 100) };
    });

    const habitsData = weekDays.map(date => {
      if (habits.length === 0) return { date, value: 0 };
      const completed = habits.filter(h => isHabitCompletedOnDate(h, date)).length;
      return { date, value: Math.round((completed / habits.length) * 100) };
    });

    const focusData = weekDays.map(date => {
      const mins = focusMinutesByDate.get(date) || 0;
      return { date, value: Math.min(Math.round((mins / 60) * 100), 100) };
    });

    const prevMoodValues = prevWeekDays.map(date => {
      const dayMoods = moods.filter(m => m.date === date);
      if (dayMoods.length === 0) return 0;
      const avgScore = dayMoods.reduce((sum, m) => {
        const score = m.emotion?.primary
          ? getEmotionScore(m.emotion.primary, m.emotion.intensity)
          : moodScore(m.mood);
        return sum + score;
      }, 0) / dayMoods.length;
      return Math.round((avgScore / 5) * 100);
    });

    const prevHabitsValues = prevWeekDays.map(date => {
      if (habits.length === 0) return 0;
      const completed = habits.filter(h => isHabitCompletedOnDate(h, date)).length;
      return Math.round((completed / habits.length) * 100);
    });

    const prevFocusValues = prevWeekDays.map(date => {
      const mins = focusMinutesByDate.get(date) || 0;
      return Math.min(Math.round((mins / 60) * 100), 100);
    });

    const avg = (arr: number[]) => arr.reduce((a, b) => a + b, 0) / arr.length;

    return {
      mood: moodData,
      habits: habitsData,
      focus: focusData,
      prevMoodAvg: Math.round(avg(prevMoodValues)),
      prevHabitsAvg: Math.round(avg(prevHabitsValues)),
      prevFocusAvg: Math.round(avg(prevFocusValues)),
    };
  }, [moods, habits, focusMinutesByDate]);

  // Generate weekly story data
  const canShowStory = useMemo(() => {
    return hasEnoughDataForStory(moods, habits, focusSessions);
  }, [moods, habits, focusSessions]);

  const storySlides = useMemo(() => {
    if (!canShowStory) return [];
    return generateWeeklyStory(moods, habits, focusSessions, gratitudeEntries, [], stats.currentStreak, t);
  }, [moods, habits, focusSessions, gratitudeEntries, stats.currentStreak, canShowStory, t]);

  const weekRange = useMemo(() => getCurrentWeekRange().range, []);

  return {
    emotionLabels,
    allTags,
    moodsByDate,
    moodByDate,
    focusMinutesByDate,
    gratitudeByDate,
    habitCompletionMap,
    currentWeatherInput,
    todayMoods,
    emotionGalaxyData,
    ringWeeklyData,
    canShowStory,
    storySlides,
    weekRange,
  };
}

export type UseStatsPageDataReturn = ReturnType<typeof useStatsPageData>;

/**
 * Weekly Insights - Generate weekly summaries with AI-like recommendations
 * Part of v1.5.0 Intelligence & Speed
 *
 * Analyzes the current week's data and compares with previous weeks
 * to generate personalized recommendations
 */

import type { MoodEntry, Habit, FocusSession, GratitudeEntry } from '@/types';
import { safeAverage } from '@/lib/validation';

// ============================================
// TYPES
// ============================================

export interface WeeklyStats {
  weekStart: string;
  weekEnd: string;
  moodAverage: number;
  moodCount: number;
  habitsCompleted: number;
  habitsTotal: number;
  habitCompletionRate: number;
  focusMinutes: number;
  focusSessions: number;
  gratitudeCount: number;
  streakDays: number;
  bestDay: string | null;
  worstDay: string | null;
}

export interface WeekComparison {
  moodChange: number; // percentage change
  habitsChange: number;
  focusChange: number;
  trend: 'improving' | 'declining' | 'stable';
}

export interface Recommendation {
  id: string;
  type: 'habit' | 'mood' | 'focus' | 'general';
  priority: 'high' | 'medium' | 'low';
  title: string;
  titleKey: string;
  description: string;
  descriptionKey: string;
  action?: string;
  actionKey?: string;
  icon: string;
}

export interface WeeklyInsightsData {
  currentWeek: WeeklyStats;
  previousWeek: WeeklyStats | null;
  comparison: WeekComparison | null;
  recommendations: Recommendation[];
  highlights: string[];
  weekNumber: number;
}

// ============================================
// CONSTANTS
// ============================================

const MOOD_VALUES: Record<string, number> = {
  terrible: 1,
  bad: 2,
  okay: 3,
  good: 4,
  great: 5,
};

const DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

// ============================================
// HELPER FUNCTIONS
// ============================================

function getWeekBounds(date: Date): { start: Date; end: Date } {
  const d = new Date(date);
  const day = d.getDay();
  const diffToMonday = day === 0 ? -6 : 1 - day;

  const start = new Date(d);
  start.setDate(d.getDate() + diffToMonday);
  start.setHours(0, 0, 0, 0);

  const end = new Date(start);
  end.setDate(start.getDate() + 6);
  end.setHours(23, 59, 59, 999);

  return { start, end };
}

function formatDateStr(date: Date): string {
  return date.toISOString().split('T')[0];
}

function getWeekNumber(date: Date): number {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() + 4 - (d.getDay() || 7));
  const yearStart = new Date(d.getFullYear(), 0, 1);
  return Math.ceil((((d.getTime() - yearStart.getTime()) / 86400000) + 1) / 7);
}

function filterByDateRange<T extends { date: string }>(
  items: T[],
  start: Date,
  end: Date
): T[] {
  const startStr = formatDateStr(start);
  const endStr = formatDateStr(end);
  return items.filter(item => item.date >= startStr && item.date <= endStr);
}

function moodToValue(mood: string): number {
  return MOOD_VALUES[mood] || 3;
}

// ============================================
// STATS CALCULATION
// ============================================

function calculateWeeklyStats(
  weekStart: Date,
  weekEnd: Date,
  moods: MoodEntry[],
  habits: Habit[],
  focusSessions: FocusSession[],
  gratitudeEntries: GratitudeEntry[]
): WeeklyStats {
  const startStr = formatDateStr(weekStart);
  const endStr = formatDateStr(weekEnd);

  // Filter data for this week
  const weekMoods = filterByDateRange(moods, weekStart, weekEnd);
  const weekFocus = filterByDateRange(focusSessions, weekStart, weekEnd)
    .filter(s => s.status !== 'aborted');
  const weekGratitude = filterByDateRange(gratitudeEntries, weekStart, weekEnd);

  // Calculate mood stats
  const moodValues = weekMoods.map(m => moodToValue(m.mood));
  const moodAverage = safeAverage(moodValues);

  // Find best and worst days
  const moodByDay = new Map<string, number[]>();
  weekMoods.forEach(m => {
    const values = moodByDay.get(m.date) || [];
    values.push(moodToValue(m.mood));
    moodByDay.set(m.date, values);
  });

  let bestDay: string | null = null;
  let worstDay: string | null = null;
  let bestDayAvg = 0;
  let worstDayAvg = 6;

  moodByDay.forEach((values, date) => {
    const avg = safeAverage(values);
    if (avg > bestDayAvg) {
      bestDayAvg = avg;
      bestDay = date;
    }
    if (avg < worstDayAvg) {
      worstDayAvg = avg;
      worstDay = date;
    }
  });

  // Calculate habit stats
  const daysInWeek: string[] = [];
  const current = new Date(weekStart);
  while (current <= weekEnd) {
    daysInWeek.push(formatDateStr(current));
    current.setDate(current.getDate() + 1);
  }

  let totalCompletions = 0;
  let totalPossible = 0;
  let streakDays = 0;

  habits.forEach(habit => {
    const weekCompletions = (habit.completedDates || []).filter(
      d => d >= startStr && d <= endStr
    );
    totalCompletions += weekCompletions.length;
    totalPossible += daysInWeek.length;
  });

  // Calculate streak (consecutive days with at least one habit completed)
  for (const day of daysInWeek) {
    const hasCompletion = habits.some(h =>
      h.completedDates?.includes(day)
    );
    if (hasCompletion) {
      streakDays++;
    } else {
      streakDays = 0; // Reset on gap
    }
  }

  // Focus stats
  const focusMinutes = weekFocus.reduce((sum, s) => sum + s.duration, 0);

  return {
    weekStart: startStr,
    weekEnd: endStr,
    moodAverage: Math.round(moodAverage * 10) / 10,
    moodCount: weekMoods.length,
    habitsCompleted: totalCompletions,
    habitsTotal: totalPossible,
    habitCompletionRate: totalPossible > 0
      ? Math.round((totalCompletions / totalPossible) * 100)
      : 0,
    focusMinutes,
    focusSessions: weekFocus.length,
    gratitudeCount: weekGratitude.length,
    streakDays,
    bestDay,
    worstDay,
  };
}

// ============================================
// COMPARISON
// ============================================

function compareWeeks(
  current: WeeklyStats,
  previous: WeeklyStats
): WeekComparison {
  const moodChange = previous.moodAverage > 0
    ? ((current.moodAverage - previous.moodAverage) / previous.moodAverage) * 100
    : 0;

  const habitsChange = previous.habitCompletionRate > 0
    ? current.habitCompletionRate - previous.habitCompletionRate
    : current.habitCompletionRate;

  const focusChange = previous.focusMinutes > 0
    ? ((current.focusMinutes - previous.focusMinutes) / previous.focusMinutes) * 100
    : 0;

  // Determine overall trend
  const improvements = [
    moodChange > 5,
    habitsChange > 5,
    focusChange > 10,
  ].filter(Boolean).length;

  const declines = [
    moodChange < -5,
    habitsChange < -5,
    focusChange < -10,
  ].filter(Boolean).length;

  let trend: 'improving' | 'declining' | 'stable' = 'stable';
  if (improvements >= 2) trend = 'improving';
  else if (declines >= 2) trend = 'declining';

  return {
    moodChange: Math.round(moodChange),
    habitsChange: Math.round(habitsChange),
    focusChange: Math.round(focusChange),
    trend,
  };
}

// ============================================
// RECOMMENDATIONS ENGINE
// ============================================

function generateRecommendations(
  current: WeeklyStats,
  previous: WeeklyStats | null,
  comparison: WeekComparison | null,
  habits: Habit[],
  moods: MoodEntry[]
): Recommendation[] {
  const recommendations: Recommendation[] = [];

  // Low mood recommendation
  if (current.moodAverage < 3 && current.moodCount >= 3) {
    recommendations.push({
      id: 'low-mood-week',
      type: 'mood',
      priority: 'high',
      title: 'Mood needs attention',
      titleKey: 'recLowMoodTitle',
      description: 'Your mood this week has been lower than usual. Consider activities that usually lift your spirits.',
      descriptionKey: 'recLowMoodDesc',
      action: 'Try a quick 5-minute breathing exercise',
      actionKey: 'recLowMoodAction',
      icon: '💙',
    });
  }

  // Habit decline recommendation
  if (comparison && comparison.habitsChange < -15) {
    recommendations.push({
      id: 'habit-decline',
      type: 'habit',
      priority: 'high',
      title: 'Habit consistency dropped',
      titleKey: 'recHabitDeclineTitle',
      description: `Your habit completion is down ${Math.abs(comparison.habitsChange)}% from last week. Start small to rebuild momentum.`,
      descriptionKey: 'recHabitDeclineDesc',
      action: 'Focus on just one habit today',
      actionKey: 'recHabitDeclineAction',
      icon: '🎯',
    });
  }

  // Low focus recommendation
  if (current.focusMinutes < 60 && current.focusSessions < 3) {
    recommendations.push({
      id: 'low-focus',
      type: 'focus',
      priority: 'medium',
      title: 'Boost your focus time',
      titleKey: 'recLowFocusTitle',
      description: 'You\'ve had limited focus sessions this week. Even short sessions help build the habit.',
      descriptionKey: 'recLowFocusDesc',
      action: 'Try a 10-minute focus session',
      actionKey: 'recLowFocusAction',
      icon: '🧠',
    });
  }

  // Celebrate improvements
  if (comparison && comparison.trend === 'improving') {
    recommendations.push({
      id: 'great-progress',
      type: 'general',
      priority: 'low',
      title: 'You\'re on a roll! 🎉',
      titleKey: 'recGreatProgressTitle',
      description: 'Your overall progress is improving compared to last week. Keep up the momentum!',
      descriptionKey: 'recGreatProgressDesc',
      icon: '⭐',
    });
  }

  // Best day insight
  if (current.bestDay) {
    const dayName = DAY_NAMES[new Date(current.bestDay).getDay()];
    recommendations.push({
      id: 'best-day',
      type: 'mood',
      priority: 'low',
      title: `${dayName} was your best day`,
      titleKey: 'recBestDayTitle',
      description: 'Try to identify what made this day special and replicate those conditions.',
      descriptionKey: 'recBestDayDesc',
      icon: '☀️',
    });
  }

  // Gratitude recommendation
  if (current.gratitudeCount < 3) {
    recommendations.push({
      id: 'more-gratitude',
      type: 'general',
      priority: 'medium',
      title: 'Practice gratitude',
      titleKey: 'recGratitudeTitle',
      description: 'Writing down things you\'re grateful for can significantly improve your mood over time.',
      descriptionKey: 'recGratitudeDesc',
      action: 'Add a gratitude entry today',
      actionKey: 'recGratitudeAction',
      icon: '💖',
    });
  }

  // Perfect week celebration
  if (current.habitCompletionRate >= 90) {
    recommendations.push({
      id: 'perfect-week',
      type: 'habit',
      priority: 'low',
      title: 'Amazing consistency!',
      titleKey: 'recPerfectWeekTitle',
      description: `You completed ${current.habitCompletionRate}% of your habits this week. You're building strong routines!`,
      descriptionKey: 'recPerfectWeekDesc',
      icon: '🏆',
    });
  }

  // Mood-habit correlation recommendation
  if (habits.length > 0 && moods.length > 7) {
    const topHabit = habits
      .filter(h => (h.completedDates?.length || 0) >= 5)
      .sort((a, b) => (b.completedDates?.length || 0) - (a.completedDates?.length || 0))[0];

    if (topHabit) {
      recommendations.push({
        id: 'top-habit',
        type: 'habit',
        priority: 'medium',
        title: `Keep up "${topHabit.name}"`,
        titleKey: 'recTopHabitTitle',
        description: 'This is one of your most consistent habits. It\'s likely contributing to your well-being.',
        descriptionKey: 'recTopHabitDesc',
        icon: topHabit.icon,
      });
    }
  }

  // Sort by priority
  const priorityOrder = { high: 0, medium: 1, low: 2 };
  recommendations.sort((a, b) => priorityOrder[a.priority] - priorityOrder[b.priority]);

  return recommendations.slice(0, 5); // Return top 5
}

// ============================================
// HIGHLIGHTS GENERATION
// ============================================

function generateHighlights(
  current: WeeklyStats,
  comparison: WeekComparison | null
): string[] {
  const highlights: string[] = [];

  // Mood highlight
  if (current.moodAverage >= 4) {
    highlights.push(`Great mood week! Average: ${current.moodAverage}/5 ✨`);
  } else if (current.moodCount > 0) {
    highlights.push(`Tracked mood ${current.moodCount} times`);
  }

  // Habits highlight
  if (current.habitCompletionRate >= 80) {
    highlights.push(`${current.habitCompletionRate}% habit completion 🎯`);
  } else if (current.habitsCompleted > 0) {
    highlights.push(`${current.habitsCompleted} habits completed`);
  }

  // Focus highlight
  if (current.focusMinutes >= 120) {
    const hours = Math.floor(current.focusMinutes / 60);
    const mins = current.focusMinutes % 60;
    highlights.push(`${hours}h ${mins}m of deep focus 🧠`);
  } else if (current.focusMinutes > 0) {
    highlights.push(`${current.focusMinutes}m focused`);
  }

  // Streak highlight
  if (current.streakDays >= 5) {
    highlights.push(`${current.streakDays} day streak 🔥`);
  }

  // Comparison highlights
  if (comparison) {
    if (comparison.moodChange > 10) {
      highlights.push(`Mood up ${comparison.moodChange}% from last week 📈`);
    }
    if (comparison.habitsChange > 10) {
      highlights.push(`Habits up ${comparison.habitsChange}% 📈`);
    }
    if (comparison.focusChange > 20) {
      highlights.push(`Focus time up ${comparison.focusChange}% 📈`);
    }
  }

  return highlights.slice(0, 4);
}

// ============================================
// MAIN API
// ============================================

/**
 * Generate weekly insights data
 */
export function generateWeeklyInsights(
  moods: MoodEntry[],
  habits: Habit[],
  focusSessions: FocusSession[],
  gratitudeEntries: GratitudeEntry[] = []
): WeeklyInsightsData {
  const today = new Date();
  const { start: currentWeekStart, end: currentWeekEnd } = getWeekBounds(today);

  // Calculate current week stats
  const currentWeek = calculateWeeklyStats(
    currentWeekStart,
    currentWeekEnd,
    moods,
    habits,
    focusSessions,
    gratitudeEntries
  );

  // Calculate previous week stats
  const prevWeekEnd = new Date(currentWeekStart);
  prevWeekEnd.setDate(prevWeekEnd.getDate() - 1);
  const { start: prevWeekStart } = getWeekBounds(prevWeekEnd);

  const previousWeek = calculateWeeklyStats(
    prevWeekStart,
    prevWeekEnd,
    moods,
    habits,
    focusSessions,
    gratitudeEntries
  );

  // Compare weeks
  const comparison = previousWeek.moodCount > 0 || previousWeek.habitsCompleted > 0
    ? compareWeeks(currentWeek, previousWeek)
    : null;

  // Generate recommendations
  const recommendations = generateRecommendations(
    currentWeek,
    previousWeek.moodCount > 0 ? previousWeek : null,
    comparison,
    habits,
    moods
  );

  // Generate highlights
  const highlights = generateHighlights(currentWeek, comparison);

  return {
    currentWeek,
    previousWeek: previousWeek.moodCount > 0 || previousWeek.habitsCompleted > 0
      ? previousWeek
      : null,
    comparison,
    recommendations,
    highlights,
    weekNumber: getWeekNumber(today),
  };
}

/**
 * Check if there's enough data for weekly insights
 */
export function hasEnoughDataForWeeklyInsights(
  moods: MoodEntry[],
  habits: Habit[],
  focusSessions: FocusSession[]
): boolean {
  const today = new Date();
  const { start, end } = getWeekBounds(today);

  const weekMoods = filterByDateRange(moods, start, end);
  const weekFocus = filterByDateRange(focusSessions, start, end);

  // Need at least 2 mood entries or 1 habit or 1 focus session this week
  const habitsThisWeek = habits.some(h =>
    h.completedDates?.some(d =>
      d >= formatDateStr(start) && d <= formatDateStr(end)
    )
  );

  return weekMoods.length >= 2 || habitsThisWeek || weekFocus.length >= 1;
}

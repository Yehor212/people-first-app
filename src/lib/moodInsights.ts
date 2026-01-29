/**
 * Mood Insights - Local AI-like pattern analysis
 * Analyzes mood, habit, and focus data to provide personalized insights
 * No external API required - all analysis is done locally
 */

import { MoodEntry, Habit, FocusSession, GratitudeEntry, MoodType } from '@/types';
import { getToday, formatDate } from './utils';
import { safeParseInt } from '@/lib/validation';

// Mood scores for analysis
const MOOD_SCORES: Record<MoodType, number> = {
  great: 5,
  good: 4,
  okay: 3,
  bad: 2,
  terrible: 1,
};

// Insight types
export interface MoodInsight {
  id: string;
  type: 'pattern' | 'correlation' | 'tip' | 'achievement' | 'warning';
  icon: string;
  titleKey: string;       // Translation key for title
  descriptionKey: string; // Translation key for description
  params?: Record<string, string | number>; // Interpolation parameters
  title: string;          // Fallback English title
  description: string;    // Fallback English description
  priority: number; // Higher = more important
  data?: Record<string, unknown>;
}

// Helper: Get mood score
function getMoodScore(mood: MoodType): number {
  return MOOD_SCORES[mood];
}

// Helper: Get day of week (0 = Sunday)
function getDayOfWeek(dateStr: string): number {
  return new Date(dateStr).getDay();
}

// Helper: Get hour of day
function getHourOfDay(timestamp: number): number {
  return new Date(timestamp).getHours();
}

// Helper: Calculate average
function average(numbers: number[]): number {
  if (numbers.length === 0) return 0;
  return numbers.reduce((a, b) => a + b, 0) / numbers.length;
}

// Helper: Get time period
function getTimePeriod(hour: number): 'morning' | 'afternoon' | 'evening' | 'night' {
  if (hour >= 5 && hour < 12) return 'morning';
  if (hour >= 12 && hour < 17) return 'afternoon';
  if (hour >= 17 && hour < 21) return 'evening';
  return 'night';
}

// Day names for display
const DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const DAY_EMOJIS = ['🌞', '🌙', '🔥', '💧', '⚡', '🌸', '🎉'];

/**
 * Analyze best mood day of the week
 */
function analyzeBestMoodDay(moods: MoodEntry[]): MoodInsight | null {
  if (moods.length < 7) return null;

  const dayScores: Record<number, number[]> = {};
  for (let i = 0; i < 7; i++) dayScores[i] = [];

  moods.forEach(entry => {
    const day = getDayOfWeek(entry.date);
    dayScores[day].push(getMoodScore(entry.mood));
  });

  let bestDay = -1;
  let bestAvg = 0;
  let worstDay = -1;
  let worstAvg = 6;

  Object.entries(dayScores).forEach(([day, scores]) => {
    if (scores.length >= 2) {
      const avg = average(scores);
      if (avg > bestAvg) {
        bestAvg = avg;
        bestDay = safeParseInt(day, 0, 0, 6);
      }
      if (avg < worstAvg) {
        worstAvg = avg;
        worstDay = safeParseInt(day, 0, 0, 6);
      }
    }
  });

  if (bestDay === -1) return null;

  return {
    id: 'best-mood-day',
    type: 'pattern',
    icon: DAY_EMOJIS[bestDay],
    titleKey: 'insightBestDayTitle',
    descriptionKey: 'insightBestDayDesc',
    params: { day: DAY_NAMES[bestDay] },
    title: `${DAY_NAMES[bestDay]}s are your best!`,
    description: `Your mood tends to be highest on ${DAY_NAMES[bestDay]}s. Consider scheduling important tasks then.`,
    priority: 8,
    data: { bestDay, bestAvg, worstDay, worstAvg },
  };
}

/**
 * Analyze mood by time of day
 */
function analyzeMoodByTimeOfDay(moods: MoodEntry[]): MoodInsight | null {
  if (moods.length < 10) return null;

  const periodScores: Record<string, number[]> = {
    morning: [],
    afternoon: [],
    evening: [],
    night: [],
  };

  moods.forEach(entry => {
    const period = getTimePeriod(getHourOfDay(entry.timestamp));
    periodScores[period].push(getMoodScore(entry.mood));
  });

  let bestPeriod = '';
  let bestAvg = 0;

  Object.entries(periodScores).forEach(([period, scores]) => {
    if (scores.length >= 3) {
      const avg = average(scores);
      if (avg > bestAvg) {
        bestAvg = avg;
        bestPeriod = period;
      }
    }
  });

  if (!bestPeriod) return null;

  const periodEmojis = {
    morning: '🌅',
    afternoon: '☀️',
    evening: '🌆',
    night: '🌙',
  };

  return {
    id: 'best-time-of-day',
    type: 'pattern',
    icon: periodEmojis[bestPeriod as keyof typeof periodEmojis],
    titleKey: 'insightBestTimeTitle',
    descriptionKey: 'insightBestTimeDesc',
    params: { period: bestPeriod },
    title: `You shine brightest in the ${bestPeriod}`,
    description: `Your mood is typically better during ${bestPeriod} hours. Schedule demanding tasks then!`,
    priority: 7,
    data: { bestPeriod, bestAvg },
  };
}

/**
 * Analyze habit-mood correlation
 */
function analyzeHabitMoodCorrelation(
  moods: MoodEntry[],
  habits: Habit[]
): MoodInsight | null {
  if (moods.length < 14 || habits.length === 0) return null;

  // Group moods by date
  const moodByDate: Record<string, number> = {};
  moods.forEach(entry => {
    if (!moodByDate[entry.date] || getMoodScore(entry.mood) > moodByDate[entry.date]) {
      moodByDate[entry.date] = getMoodScore(entry.mood);
    }
  });

  // Find habit with best mood correlation
  let bestHabit: Habit | null = null;
  let bestCorrelation = 0;

  habits.forEach(habit => {
    const datesWithHabit = habit.completedDates;
    // P2 Fix: Use Set for O(1) lookup instead of O(n) includes()
    const habitDatesSet = new Set(datesWithHabit);
    const datesWithoutHabit = Object.keys(moodByDate).filter(d => !habitDatesSet.has(d));

    const scoresWithHabit = datesWithHabit
      .filter(d => moodByDate[d] !== undefined)
      .map(d => moodByDate[d]);
    const scoresWithoutHabit = datesWithoutHabit
      .filter(d => moodByDate[d] !== undefined)
      .map(d => moodByDate[d]);

    if (scoresWithHabit.length >= 5 && scoresWithoutHabit.length >= 5) {
      const avgWith = average(scoresWithHabit);
      const avgWithout = average(scoresWithoutHabit);
      const correlation = avgWith - avgWithout;

      if (correlation > bestCorrelation) {
        bestCorrelation = correlation;
        bestHabit = habit;
      }
    }
  });

  if (!bestHabit || bestCorrelation < 0.3) return null;

  return {
    id: 'habit-mood-correlation',
    type: 'correlation',
    icon: bestHabit.icon,
    titleKey: 'insightHabitBoostsTitle',
    descriptionKey: 'insightHabitBoostsDesc',
    params: { habit: bestHabit.name, percent: Math.round(bestCorrelation * 20) },
    title: `${bestHabit.name} boosts your mood!`,
    description: `When you complete "${bestHabit.name}", your mood tends to be ${Math.round(bestCorrelation * 20)}% better. Keep it up!`,
    priority: 9,
    data: { habitId: bestHabit.id, correlation: bestCorrelation },
  };
}

/**
 * Analyze focus-mood correlation
 */
function analyzeFocusMoodCorrelation(
  moods: MoodEntry[],
  focusSessions: FocusSession[]
): MoodInsight | null {
  if (moods.length < 14 || focusSessions.length < 7) return null;

  // Group focus minutes by date
  const focusByDate: Record<string, number> = {};
  focusSessions.forEach(session => {
    focusByDate[session.date] = (focusByDate[session.date] || 0) + (session.duration || 0);
  });

  // Group moods by date
  const moodByDate: Record<string, number> = {};
  moods.forEach(entry => {
    if (!moodByDate[entry.date] || getMoodScore(entry.mood) > moodByDate[entry.date]) {
      moodByDate[entry.date] = getMoodScore(entry.mood);
    }
  });

  // Compare mood on focus days vs non-focus days
  const focusDays = Object.keys(focusByDate);
  // P2 Fix: Use Set for O(1) lookup instead of O(n) includes()
  const focusDaysSet = new Set(focusDays);
  const nonFocusDays = Object.keys(moodByDate).filter(d => !focusDaysSet.has(d));

  const moodWithFocus = focusDays
    .filter(d => moodByDate[d] !== undefined)
    .map(d => moodByDate[d]);
  const moodWithoutFocus = nonFocusDays
    .filter(d => moodByDate[d] !== undefined)
    .map(d => moodByDate[d]);

  if (moodWithFocus.length < 5 || moodWithoutFocus.length < 5) return null;

  const avgWithFocus = average(moodWithFocus);
  const avgWithoutFocus = average(moodWithoutFocus);
  const diff = avgWithFocus - avgWithoutFocus;

  if (diff < 0.2) return null;

  return {
    id: 'focus-mood-correlation',
    type: 'correlation',
    icon: '🎯',
    titleKey: 'insightFocusMoodTitle',
    descriptionKey: 'insightFocusMoodDesc',
    params: { percent: Math.round(diff * 20) },
    title: 'Focus time = Better mood!',
    description: `On days you do focus sessions, your mood is ${Math.round(diff * 20)}% better. Deep work pays off!`,
    priority: 8,
    data: { avgWithFocus, avgWithoutFocus, diff },
  };
}

/**
 * Analyze gratitude-mood correlation
 */
function analyzeGratitudeMoodCorrelation(
  moods: MoodEntry[],
  gratitude: GratitudeEntry[]
): MoodInsight | null {
  if (moods.length < 14 || gratitude.length < 7) return null;

  // Group gratitude by date
  const gratitudeByDate: Record<string, number> = {};
  gratitude.forEach(entry => {
    gratitudeByDate[entry.date] = (gratitudeByDate[entry.date] || 0) + 1;
  });

  // Group moods by date
  const moodByDate: Record<string, number> = {};
  moods.forEach(entry => {
    if (!moodByDate[entry.date] || getMoodScore(entry.mood) > moodByDate[entry.date]) {
      moodByDate[entry.date] = getMoodScore(entry.mood);
    }
  });

  // Compare mood on gratitude days vs non-gratitude days
  const gratitudeDays = Object.keys(gratitudeByDate);
  // P2 Fix: Use Set for O(1) lookup instead of O(n) includes()
  const gratitudeDaysSet = new Set(gratitudeDays);
  const nonGratitudeDays = Object.keys(moodByDate).filter(d => !gratitudeDaysSet.has(d));

  const moodWithGratitude = gratitudeDays
    .filter(d => moodByDate[d] !== undefined)
    .map(d => moodByDate[d]);
  const moodWithoutGratitude = nonGratitudeDays
    .filter(d => moodByDate[d] !== undefined)
    .map(d => moodByDate[d]);

  if (moodWithGratitude.length < 5 || moodWithoutGratitude.length < 5) return null;

  const avgWithGratitude = average(moodWithGratitude);
  const avgWithoutGratitude = average(moodWithoutGratitude);
  const diff = avgWithGratitude - avgWithoutGratitude;

  if (diff < 0.2) return null;

  return {
    id: 'gratitude-mood-correlation',
    type: 'correlation',
    icon: '🙏',
    titleKey: 'insightGratitudeMoodTitle',
    descriptionKey: 'insightGratitudeMoodDesc',
    params: { percent: Math.round(diff * 20) },
    title: 'Gratitude lifts your mood!',
    description: `Days with gratitude entries show ${Math.round(diff * 20)}% better mood. Keep practicing gratitude!`,
    priority: 7,
    data: { avgWithGratitude, avgWithoutGratitude, diff },
  };
}

/**
 * Generate mood trend insight
 */
function analyzeMoodTrend(moods: MoodEntry[]): MoodInsight | null {
  if (moods.length < 7) return null;

  // Get last 7 days of mood
  const today = new Date(getToday());
  const last7Days: string[] = [];
  for (let i = 6; i >= 0; i--) {
    const d = new Date(today);
    d.setDate(d.getDate() - i);
    last7Days.push(formatDate(d));
  }

  // Get previous 7 days
  const prev7Days: string[] = [];
  for (let i = 13; i >= 7; i--) {
    const d = new Date(today);
    d.setDate(d.getDate() - i);
    prev7Days.push(formatDate(d));
  }

  // P2 Fix: Use Sets for O(1) lookup
  const last7DaysSet = new Set(last7Days);
  const prev7DaysSet = new Set(prev7Days);

  const recentScores = moods
    .filter(m => last7DaysSet.has(m.date))
    .map(m => getMoodScore(m.mood));
  const previousScores = moods
    .filter(m => prev7DaysSet.has(m.date))
    .map(m => getMoodScore(m.mood));

  if (recentScores.length < 3 || previousScores.length < 3) return null;

  const recentAvg = average(recentScores);
  const previousAvg = average(previousScores);
  const change = recentAvg - previousAvg;

  if (Math.abs(change) < 0.3) return null;

  if (change > 0) {
    return {
      id: 'mood-trend-up',
      type: 'achievement',
      icon: '📈',
      titleKey: 'insightMoodUpTitle',
      descriptionKey: 'insightMoodUpDesc',
      params: { percent: Math.round(change * 20) },
      title: 'Your mood is improving!',
      description: `Your average mood this week is ${Math.round(change * 20)}% better than last week. You're doing great!`,
      priority: 9,
      data: { recentAvg, previousAvg, change },
    };
  } else {
    return {
      id: 'mood-trend-down',
      type: 'tip',
      icon: '💪',
      titleKey: 'insightMoodDownTitle',
      descriptionKey: 'insightMoodDownDesc',
      params: {},
      title: 'Let\'s boost your mood!',
      description: `Your mood has dipped a bit. Try focusing on habits that usually make you feel good.`,
      priority: 10,
      data: { recentAvg, previousAvg, change },
    };
  }
}

/**
 * Generate consistency insight
 */
function analyzeConsistency(moods: MoodEntry[], habits: Habit[]): MoodInsight | null {
  if (moods.length < 14) return null;

  // Check logging consistency
  const today = new Date(getToday());
  const last14Days: string[] = [];
  for (let i = 13; i >= 0; i--) {
    const d = new Date(today);
    d.setDate(d.getDate() - i);
    last14Days.push(formatDate(d));
  }

  // P2 Fix: Use Set for O(1) lookup
  const last14DaysSet = new Set(last14Days);
  const daysWithMood = new Set(moods.filter(m => last14DaysSet.has(m.date)).map(m => m.date));
  const consistency = daysWithMood.size / 14;

  if (consistency >= 0.85) {
    return {
      id: 'high-consistency',
      type: 'achievement',
      icon: '🌟',
      titleKey: 'insightHighConsistencyTitle',
      descriptionKey: 'insightHighConsistencyDesc',
      params: { days: daysWithMood.size },
      title: 'Amazing consistency!',
      description: `You've logged your mood ${daysWithMood.size} of the last 14 days. This self-awareness is powerful!`,
      priority: 8,
      data: { daysLogged: daysWithMood.size, total: 14, consistency },
    };
  }

  if (consistency < 0.5) {
    return {
      id: 'low-consistency',
      type: 'tip',
      icon: '📱',
      titleKey: 'insightLowConsistencyTitle',
      descriptionKey: 'insightLowConsistencyDesc',
      params: {},
      title: 'Build your logging habit',
      description: `Try logging your mood at the same time each day. Consistency helps you spot patterns!`,
      priority: 6,
      data: { daysLogged: daysWithMood.size, total: 14, consistency },
    };
  }

  return null;
}

/**
 * Main function: Generate all insights
 * Limits analysis to last 90 days for performance
 */
export function generateMoodInsights(
  moods: MoodEntry[],
  habits: Habit[],
  focusSessions: FocusSession[],
  gratitudeEntries: GratitudeEntry[]
): MoodInsight[] {
  // Limit to last 90 days for performance with large datasets
  const ninetyDaysAgo = Date.now() - 90 * 24 * 60 * 60 * 1000;
  const recentMoods = moods.filter(m => m.timestamp >= ninetyDaysAgo);
  const recentSessions = focusSessions.filter(s => s.completedAt >= ninetyDaysAgo);
  const recentGratitude = gratitudeEntries.filter(g => g.timestamp >= ninetyDaysAgo);

  // Filter habit completedDates to last 90 days
  const cutoffDate = new Date(ninetyDaysAgo).toISOString().split('T')[0];
  const recentHabits = habits.map(h => ({
    ...h,
    completedDates: (h.completedDates || []).filter(d => d >= cutoffDate)
  }));

  const insights: MoodInsight[] = [];

  // Run all analysis functions
  const analyses = [
    analyzeMoodTrend(recentMoods),
    analyzeHabitMoodCorrelation(recentMoods, recentHabits),
    analyzeFocusMoodCorrelation(recentMoods, recentSessions),
    analyzeGratitudeMoodCorrelation(recentMoods, recentGratitude),
    analyzeBestMoodDay(recentMoods),
    analyzeMoodByTimeOfDay(recentMoods),
    analyzeConsistency(recentMoods, recentHabits),
  ];

  // Filter out nulls and add to insights
  analyses.forEach(insight => {
    if (insight) insights.push(insight);
  });

  // Sort by priority (highest first)
  insights.sort((a, b) => b.priority - a.priority);

  // Return top insights (limit to 5 for clarity)
  return insights.slice(0, 5);
}

/**
 * Get a single featured insight for display
 */
export function getFeaturedInsight(
  moods: MoodEntry[],
  habits: Habit[],
  focusSessions: FocusSession[],
  gratitudeEntries: GratitudeEntry[]
): MoodInsight | null {
  const insights = generateMoodInsights(moods, habits, focusSessions, gratitudeEntries);
  return insights.length > 0 ? insights[0] : null;
}

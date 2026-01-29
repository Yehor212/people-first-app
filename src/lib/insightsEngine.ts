/**
 * Insights Engine - Pattern Detection & Analysis
 *
 * Privacy-first local analysis without external ML libraries.
 * Analyzes user data to generate personalized insights about:
 * - Mood-Habit correlations
 * - Focus time patterns
 * - Habit timing success
 * - Mood tag insights
 * - Energy patterns
 */

import { nanoid } from 'nanoid';
import { safeParseInt, safeAverage } from '@/lib/validation';
import type {
  MoodEntry,
  Habit,
  FocusSession,
  Insight,
  MoodHabitCorrelationMetadata,
  FocusPatternMetadata,
  HabitTimingMetadata,
  MoodTagMetadata,
} from '@/types';

// Minimum data requirements for insights
const MIN_DAYS_FOR_INSIGHTS = 7;
const MIN_HABIT_DAYS = 5;
const MIN_FOCUS_SESSIONS = 3;
const MIN_TAG_OCCURRENCES = 3;

// Mood value mapping
const MOOD_VALUES: Record<string, number> = {
  terrible: 1,
  bad: 2,
  okay: 3,
  good: 4,
  great: 5,
};

/**
 * Convert mood type to numeric value for calculations
 */
function moodToValue(mood: string): number {
  return MOOD_VALUES[mood] || 3;
}

/**
 * Calculate Pearson correlation coefficient
 * Returns value between -1 (negative correlation) and 1 (positive correlation)
 */
function calculateCorrelation(x: number[], y: number[]): number {
  if (x.length !== y.length || x.length === 0) return 0;

  const n = x.length;
  const sumX = x.reduce((a, b) => a + b, 0);
  const sumY = y.reduce((a, b) => a + b, 0);
  const sumXY = x.reduce((sum, xi, i) => sum + xi * y[i], 0);
  const sumX2 = x.reduce((sum, xi) => sum + xi * xi, 0);
  const sumY2 = y.reduce((sum, yi) => sum + yi * yi, 0);

  const numerator = n * sumXY - sumX * sumY;
  const denominator = Math.sqrt((n * sumX2 - sumX * sumX) * (n * sumY2 - sumY * sumY));

  if (denominator === 0) return 0;
  return numerator / denominator;
}

/**
 * Calculate statistical confidence based on sample size and correlation
 */
function calculateConfidence(dataPoints: number, correlation: number): number {
  // More data points = higher confidence
  const sizeConfidence = Math.min(dataPoints / 30, 1) * 50;
  // Stronger correlation = higher confidence
  const correlationConfidence = Math.abs(correlation) * 50;
  return Math.min(Math.round(sizeConfidence + correlationConfidence), 100);
}

/**
 * Analyze correlation between habits and mood
 * Returns insights about which habits improve mood
 */
export function analyzeMoodHabitCorrelation(
  moods: MoodEntry[],
  habits: Habit[]
): Insight[] {
  const insights: Insight[] = [];

  if (moods.length < MIN_DAYS_FOR_INSIGHTS) return insights;

  // Group moods by date
  const moodsByDate = new Map<string, number>();
  moods.forEach(entry => {
    const value = moodToValue(entry.mood);
    const existing = moodsByDate.get(entry.date);
    // Take average if multiple moods per day
    moodsByDate.set(entry.date, existing ? (existing + value) / 2 : value);
  });

  // Analyze each habit
  habits.forEach(habit => {
    if (habit.completedDates.length < MIN_HABIT_DAYS) return;

    const daysWithHabit: number[] = [];
    const daysWithoutHabit: number[] = [];

    // Compare mood on days with and without the habit
    moodsByDate.forEach((moodValue, date) => {
      if (habit.completedDates.includes(date)) {
        daysWithHabit.push(moodValue);
      } else {
        daysWithoutHabit.push(moodValue);
      }
    });

    if (daysWithHabit.length < MIN_HABIT_DAYS || daysWithoutHabit.length < 3) return;

    const avgMoodWith = safeAverage(daysWithHabit);
    const avgMoodWithout = safeAverage(daysWithoutHabit);
    const improvement = avgMoodWithout > 0
      ? ((avgMoodWith - avgMoodWithout) / avgMoodWithout) * 100
      : 0;

    // Only generate insight if improvement is significant (>10%)
    if (improvement > 10) {
      const confidence = calculateConfidence(
        daysWithHabit.length,
        improvement / 100
      );

      const metadata: MoodHabitCorrelationMetadata = {
        type: 'mood-habit-correlation',
        habitId: habit.id,
        habitName: habit.name,
        moodImprovement: Math.round(improvement),
        avgMoodWith: Math.round(avgMoodWith * 10) / 10,
        avgMoodWithout: Math.round(avgMoodWithout * 10) / 10,
        sampleDays: daysWithHabit.length,
      };

      insights.push({
        id: nanoid(),
        type: 'mood-habit-correlation',
        severity: improvement > 25 ? 'celebration' : 'tip',
        title: `${habit.name} improves your mood`,
        description: `On days when you complete "${habit.name}", your mood is ${Math.round(improvement)}% better on average.`,
        confidence,
        dataPoints: daysWithHabit.length + daysWithoutHabit.length,
        createdAt: Date.now(),
        metadata,
      });
    }
  });

  return insights;
}

/**
 * Analyze focus session patterns
 * Returns insights about best times and labels for focus
 */
export function analyzeFocusPatterns(sessions: FocusSession[]): Insight[] {
  const insights: Insight[] = [];

  if (sessions.length < MIN_FOCUS_SESSIONS) return insights;

  // Analyze by label
  const labelStats = new Map<string, { durations: number[]; completed: number; total: number }>();

  // Analyze by time of day
  const timeStats = new Map<string, { durations: number[]; completed: number }>();

  sessions.forEach(session => {
    // Skip aborted sessions
    if (session.status === 'aborted') return;

    // Track by label
    if (session.label) {
      const stats = labelStats.get(session.label) || { durations: [], completed: 0, total: 0 };
      stats.durations.push(session.duration);
      stats.completed++;
      stats.total++;
      labelStats.set(session.label, stats);
    }

    // Track by hour
    const hour = new Date(session.completedAt).getHours();
    const timeKey = `${hour}:00`;
    const timeStatsEntry = timeStats.get(timeKey) || { durations: [], completed: 0 };
    timeStatsEntry.durations.push(session.duration);
    timeStatsEntry.completed++;
    timeStats.set(timeKey, timeStatsEntry);
  });

  // Find best label (highest average duration)
  let bestLabel: string | undefined;
  let bestLabelAvg = 0;
  let bestLabelStats: { durations: number[]; completed: number; total: number } | undefined;

  labelStats.forEach((stats, label) => {
    if (stats.completed < 2) return; // Need at least 2 sessions
    const avg = safeAverage(stats.durations);
    if (avg > bestLabelAvg) {
      bestLabelAvg = avg;
      bestLabel = label;
      bestLabelStats = stats;
    }
  });

  if (bestLabel && bestLabelStats) {
    const successRate = (bestLabelStats.completed / bestLabelStats.total) * 100;
    const confidence = calculateConfidence(bestLabelStats.completed, successRate / 100);

    const metadata: FocusPatternMetadata = {
      type: 'focus-pattern',
      bestLabel,
      avgDuration: Math.round(bestLabelAvg),
      successRate: Math.round(successRate),
      totalSessions: bestLabelStats.completed,
    };

    insights.push({
      id: nanoid(),
      type: 'focus-pattern',
      severity: 'tip',
      title: `You focus best on '${bestLabel}' tasks`,
      description: `Your average focus time for '${bestLabel}' is ${Math.round(bestLabelAvg)} minutes, higher than other activities.`,
      confidence,
      dataPoints: bestLabelStats.completed,
      createdAt: Date.now(),
      metadata,
    });
  }

  // Find best time of day (highest average duration)
  let bestTime: string | undefined;
  let bestTimeAvg = 0;
  let bestTimeCount = 0;

  timeStats.forEach((stats, time) => {
    if (stats.completed < 2) return;
    const avg = safeAverage(stats.durations);
    if (avg > bestTimeAvg) {
      bestTimeAvg = avg;
      bestTime = time;
      bestTimeCount = stats.completed;
    }
  });

  if (bestTime && bestTimeCount >= 2) {
    const hourParts = bestTime.split(':');
    const hour = hourParts.length > 0 ? safeParseInt(hourParts[0], 0, 0, 23) : 0;
    let timeOfDay = 'morning';
    if (hour >= 12 && hour < 17) timeOfDay = 'afternoon';
    else if (hour >= 17) timeOfDay = 'evening';

    const confidence = calculateConfidence(bestTimeCount, 0.7);

    const metadata: FocusPatternMetadata = {
      type: 'focus-pattern',
      bestTime,
      avgDuration: Math.round(bestTimeAvg),
      successRate: 100,
      totalSessions: bestTimeCount,
    };

    insights.push({
      id: nanoid(),
      type: 'focus-pattern',
      severity: 'tip',
      title: `Your peak focus time is ${timeOfDay}`,
      description: `You achieve your best focus around ${bestTime}, with an average of ${Math.round(bestTimeAvg)} minutes.`,
      confidence,
      dataPoints: bestTimeCount,
      createdAt: Date.now(),
      metadata,
    });
  }

  return insights;
}

/**
 * Analyze habit completion timing
 * Returns insights about best times of day for habits
 */
export function analyzeHabitTiming(habits: Habit[], moods: MoodEntry[]): Insight[] {
  const insights: Insight[] = [];

  // Group moods by date and time
  const moodTimes = new Map<string, number>(); // date -> hour
  moods.forEach(entry => {
    const hour = new Date(entry.timestamp).getHours();
    moodTimes.set(entry.date, hour);
  });

  habits.forEach(habit => {
    if (habit.completedDates.length < MIN_HABIT_DAYS) return;

    const morningCompletions: string[] = [];
    const afternoonCompletions: string[] = [];
    const eveningCompletions: string[] = [];

    // Categorize by time (using mood time as proxy for habit completion time)
    habit.completedDates.forEach(date => {
      const hour = moodTimes.get(date);
      if (hour === undefined) return;

      if (hour < 12) morningCompletions.push(date);
      else if (hour < 17) afternoonCompletions.push(date);
      else eveningCompletions.push(date);
    });

    const total = morningCompletions.length + afternoonCompletions.length + eveningCompletions.length;
    if (total < MIN_HABIT_DAYS) return;

    const morningRate = (morningCompletions.length / total) * 100;
    const afternoonRate = (afternoonCompletions.length / total) * 100;
    const eveningRate = (eveningCompletions.length / total) * 100;

    // Find best time
    const rates = [
      { time: 'morning' as const, rate: morningRate, count: morningCompletions.length },
      { time: 'afternoon' as const, rate: afternoonRate, count: afternoonCompletions.length },
      { time: 'evening' as const, rate: eveningRate, count: eveningCompletions.length },
    ];

    rates.sort((a, b) => b.rate - a.rate);
    const best = rates[0];
    const worst = rates[2];

    // Only create insight if there's a significant difference (>20%)
    if (best.rate - worst.rate > 20) {
      const confidence = calculateConfidence(total, (best.rate - worst.rate) / 100);

      const metadata: HabitTimingMetadata = {
        type: 'habit-timing',
        habitId: habit.id,
        habitName: habit.name,
        bestTime: best.time,
        bestTimeRate: Math.round(best.rate),
        worstTimeRate: Math.round(worst.rate),
        morningCount: morningCompletions.length,
        afternoonCount: afternoonCompletions.length,
        eveningCount: eveningCompletions.length,
      };

      insights.push({
        id: nanoid(),
        type: 'habit-timing',
        severity: 'tip',
        title: `Best time for ${habit.name}: ${best.time}`,
        description: `You're ${Math.round(best.rate)}% more likely to complete "${habit.name}" in the ${best.time} compared to ${worst.time} (${Math.round(worst.rate)}%).`,
        confidence,
        dataPoints: total,
        createdAt: Date.now(),
        metadata,
      });
    }
  });

  return insights;
}

/**
 * Analyze mood tags for patterns
 * Returns insights about which tags correlate with better mood
 */
export function analyzeMoodTags(moods: MoodEntry[]): Insight[] {
  const insights: Insight[] = [];

  // Collect all tags
  const tagOccurrences = new Map<string, number[]>(); // tag -> mood values
  const moodsWithoutTags: number[] = [];

  moods.forEach(entry => {
    const moodValue = moodToValue(entry.mood);

    if (entry.tags && entry.tags.length > 0) {
      entry.tags.forEach(tag => {
        const values = tagOccurrences.get(tag) || [];
        values.push(moodValue);
        tagOccurrences.set(tag, values);
      });
    } else {
      moodsWithoutTags.push(moodValue);
    }
  });

  if (moodsWithoutTags.length === 0) return insights;

  const avgMoodWithoutTags = safeAverage(moodsWithoutTags);

  // Analyze each tag
  tagOccurrences.forEach((values, tag) => {
    if (values.length < MIN_TAG_OCCURRENCES) return;

    const avgMoodWith = safeAverage(values);
    const improvement = avgMoodWithoutTags > 0
      ? ((avgMoodWith - avgMoodWithoutTags) / avgMoodWithoutTags) * 100
      : 0;

    // Only create insight if improvement is significant (>15%)
    if (improvement > 15) {
      const confidence = calculateConfidence(values.length, improvement / 100);

      const metadata: MoodTagMetadata = {
        type: 'mood-tag',
        tag,
        avgMoodWith: Math.round(avgMoodWith * 10) / 10,
        avgMoodWithout: Math.round(avgMoodWithoutTags * 10) / 10,
        improvement: Math.round(improvement),
        occurrences: values.length,
      };

      insights.push({
        id: nanoid(),
        type: 'mood-tag',
        severity: improvement > 30 ? 'celebration' : 'tip',
        title: `'${tag}' boosts your mood`,
        description: `Days tagged with '${tag}' show ${Math.round(improvement)}% better mood on average.`,
        confidence,
        dataPoints: values.length + moodsWithoutTags.length,
        createdAt: Date.now(),
        metadata,
      });
    }
  });

  return insights;
}

/**
 * Generate all insights from user data
 * Main entry point for insights generation
 * Limits analysis to last 90 days for performance
 */
export function generateInsights(
  moods: MoodEntry[],
  habits: Habit[],
  focusSessions: FocusSession[]
): Insight[] {
  // Limit to last 90 days for performance with large datasets
  const ninetyDaysAgo = Date.now() - 90 * 24 * 60 * 60 * 1000;
  const recentMoods = moods.filter(m => m.timestamp >= ninetyDaysAgo);
  const recentSessions = focusSessions.filter(s => s.completedAt >= ninetyDaysAgo);

  // Filter habit completedDates to last 90 days
  const cutoffDate = new Date(ninetyDaysAgo).toISOString().split('T')[0];
  const recentHabits = habits.map(h => ({
    ...h,
    completedDates: (h.completedDates || []).filter(d => d >= cutoffDate)
  }));

  const allInsights: Insight[] = [];

  // Generate all types of insights
  allInsights.push(...analyzeMoodHabitCorrelation(recentMoods, recentHabits));
  allInsights.push(...analyzeFocusPatterns(recentSessions));
  allInsights.push(...analyzeHabitTiming(recentHabits, recentMoods));
  allInsights.push(...analyzeMoodTags(recentMoods));

  // Sort by confidence (highest first)
  allInsights.sort((a, b) => b.confidence - a.confidence);

  // Return top 5 insights
  return allInsights.slice(0, 5);
}

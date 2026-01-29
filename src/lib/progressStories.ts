/**
 * Progress Stories - Generate weekly "Instagram-style" stories
 * Part of v1.4.0 Social & Sharing
 *
 * Creates shareable story slides from weekly progress data
 */

import { MoodEntry, Habit, FocusSession, GratitudeEntry, Badge } from '@/types';
import { getToday } from './utils';

// ============================================
// TYPES
// ============================================

export type StorySlideType =
  | 'intro'
  | 'mood'
  | 'habits'
  | 'focus'
  | 'gratitude'
  | 'streak'
  | 'achievement'
  | 'summary'
  | 'outro';

export interface StorySlide {
  type: StorySlideType;
  title: string;
  subtitle?: string;
  icon?: string;
  value?: string | number;
  data?: unknown;
  gradient: string;
  accentColor: string;
}

export interface WeeklyStoryData {
  weekStart: string;
  weekEnd: string;
  weekRange: string;
  moods: MoodEntry[];
  habits: Habit[];
  focusSessions: FocusSession[];
  gratitudeEntries: GratitudeEntry[];
  newBadges: Badge[];
  streak: number;
}

export interface MoodTrendData {
  average: number;
  trend: 'up' | 'down' | 'stable';
  bestDay: string;
  worstDay: string;
  dominantMood: string;
  moodCounts: Record<string, number>;
}

export interface HabitStatsData {
  totalCompletions: number;
  completionRate: number;
  topHabit: { name: string; icon: string; completions: number } | null;
  perfectDays: number;
}

export interface FocusStatsData {
  totalMinutes: number;
  sessionsCount: number;
  averageSession: number;
  longestSession: number;
  topLabel: string | null;
}

// ============================================
// GRADIENTS FOR SLIDE TYPES
// ============================================

const SLIDE_GRADIENTS: Record<StorySlideType, { gradient: string; accent: string }> = {
  intro: { gradient: 'linear-gradient(135deg, #1E293B 0%, #334155 100%)', accent: '#94A3B8' },
  mood: { gradient: 'linear-gradient(135deg, #7C3AED 0%, #A78BFA 100%)', accent: '#C4B5FD' },
  habits: { gradient: 'linear-gradient(135deg, #059669 0%, #10B981 100%)', accent: '#6EE7B7' },
  focus: { gradient: 'linear-gradient(135deg, #2563EB 0%, #3B82F6 100%)', accent: '#93C5FD' },
  gratitude: { gradient: 'linear-gradient(135deg, #DB2777 0%, #EC4899 100%)', accent: '#F9A8D4' },
  streak: { gradient: 'linear-gradient(135deg, #EA580C 0%, #F97316 100%)', accent: '#FDBA74' },
  achievement: { gradient: 'linear-gradient(135deg, #CA8A04 0%, #EAB308 100%)', accent: '#FDE047' },
  summary: { gradient: 'linear-gradient(135deg, #0891B2 0%, #06B6D4 100%)', accent: '#67E8F9' },
  outro: { gradient: 'linear-gradient(135deg, #4F46E5 0%, #6366F1 100%)', accent: '#A5B4FC' },
};

// ============================================
// HELPER FUNCTIONS
// ============================================

/**
 * Get the start and end dates for the current week (Mon-Sun)
 */
export function getCurrentWeekRange(): { start: Date; end: Date; range: string } {
  const today = new Date();
  const dayOfWeek = today.getDay();
  const diffToMonday = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;

  const monday = new Date(today);
  monday.setDate(today.getDate() + diffToMonday);
  monday.setHours(0, 0, 0, 0);

  const sunday = new Date(monday);
  sunday.setDate(monday.getDate() + 6);
  sunday.setHours(23, 59, 59, 999);

  const formatDate = (d: Date) => d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  const range = `${formatDate(monday)} - ${formatDate(sunday)}`;

  return { start: monday, end: sunday, range };
}

/**
 * Filter data for the current week
 */
function filterByWeek<T extends { date: string }>(items: T[], weekStart: Date, weekEnd: Date): T[] {
  const startStr = weekStart.toISOString().split('T')[0];
  const endStr = weekEnd.toISOString().split('T')[0];

  return items.filter(item => item.date >= startStr && item.date <= endStr);
}

/**
 * Calculate mood statistics for the week
 */
function calculateMoodStats(moods: MoodEntry[]): MoodTrendData {
  const moodScores: Record<string, number> = {
    great: 5,
    good: 4,
    okay: 3,
    bad: 2,
    terrible: 1,
  };

  const moodCounts: Record<string, number> = { great: 0, good: 0, okay: 0, bad: 0, terrible: 0 };
  let totalScore = 0;
  let bestDay = '';
  let worstDay = '';
  let bestScore = 0;
  let worstScore = 6;

  moods.forEach(m => {
    const score = moodScores[m.mood] || 3;
    totalScore += score;
    moodCounts[m.mood] = (moodCounts[m.mood] || 0) + 1;

    if (score > bestScore) {
      bestScore = score;
      bestDay = m.date;
    }
    if (score < worstScore) {
      worstScore = score;
      worstDay = m.date;
    }
  });

  const average = moods.length > 0 ? totalScore / moods.length : 0;

  // Determine dominant mood
  const dominantMood = Object.entries(moodCounts).reduce(
    (a, b) => (b[1] > a[1] ? b : a),
    ['okay', 0]
  )[0];

  // Determine trend (compare first half to second half)
  const mid = Math.floor(moods.length / 2);
  const firstHalf = moods.slice(0, mid);
  const secondHalf = moods.slice(mid);

  const firstAvg = firstHalf.reduce((sum, m) => sum + (moodScores[m.mood] || 3), 0) / (firstHalf.length || 1);
  const secondAvg = secondHalf.reduce((sum, m) => sum + (moodScores[m.mood] || 3), 0) / (secondHalf.length || 1);

  let trend: 'up' | 'down' | 'stable' = 'stable';
  if (secondAvg - firstAvg > 0.3) trend = 'up';
  else if (firstAvg - secondAvg > 0.3) trend = 'down';

  return { average, trend, bestDay, worstDay, dominantMood, moodCounts };
}

/**
 * Calculate habit statistics for the week
 */
function calculateHabitStats(habits: Habit[], weekStart: Date, weekEnd: Date): HabitStatsData {
  let totalCompletions = 0;
  let totalPossible = 0;
  let topHabit: HabitStatsData['topHabit'] = null;
  let topCompletions = 0;

  const startStr = weekStart.toISOString().split('T')[0];
  const endStr = weekEnd.toISOString().split('T')[0];

  // Count days in the week
  const daysInWeek: string[] = [];
  const current = new Date(weekStart);
  while (current <= weekEnd) {
    daysInWeek.push(current.toISOString().split('T')[0]);
    current.setDate(current.getDate() + 1);
  }

  const completionsByDay = new Map<string, number>();

  habits.forEach(habit => {
    const weekCompletions = (habit.completedDates || []).filter(
      d => d >= startStr && d <= endStr
    );
    totalCompletions += weekCompletions.length;
    totalPossible += daysInWeek.length;

    if (weekCompletions.length > topCompletions) {
      topCompletions = weekCompletions.length;
      topHabit = {
        name: habit.name,
        icon: habit.icon,
        completions: weekCompletions.length,
      };
    }

    weekCompletions.forEach(d => {
      completionsByDay.set(d, (completionsByDay.get(d) || 0) + 1);
    });
  });

  // Count perfect days (all habits completed)
  const perfectDays = daysInWeek.filter(day => {
    const completed = completionsByDay.get(day) || 0;
    return completed >= habits.length && habits.length > 0;
  }).length;

  const completionRate = totalPossible > 0 ? (totalCompletions / totalPossible) * 100 : 0;

  return { totalCompletions, completionRate, topHabit, perfectDays };
}

/**
 * Calculate focus statistics for the week
 */
function calculateFocusStats(sessions: FocusSession[]): FocusStatsData {
  const completedSessions = sessions.filter(s => s.status !== 'aborted');
  const totalMinutes = completedSessions.reduce((sum, s) => sum + s.duration, 0);
  const sessionsCount = completedSessions.length;
  const averageSession = sessionsCount > 0 ? Math.round(totalMinutes / sessionsCount) : 0;
  const longestSession = completedSessions.reduce((max, s) => Math.max(max, s.duration), 0);

  // Find most common label
  const labelCounts = new Map<string, number>();
  completedSessions.forEach(s => {
    if (s.label) {
      labelCounts.set(s.label, (labelCounts.get(s.label) || 0) + 1);
    }
  });

  let topLabel: string | null = null;
  let topCount = 0;
  labelCounts.forEach((count, label) => {
    if (count > topCount) {
      topCount = count;
      topLabel = label;
    }
  });

  return { totalMinutes, sessionsCount, averageSession, longestSession, topLabel };
}

// ============================================
// MAIN STORY GENERATION
// ============================================

/**
 * Generate weekly story slides from user data
 */
export function generateWeeklyStory(
  moods: MoodEntry[],
  habits: Habit[],
  focusSessions: FocusSession[],
  gratitudeEntries: GratitudeEntry[],
  newBadges: Badge[] = [],
  streak: number = 0,
  translations: Record<string, string> = {}
): StorySlide[] {
  const { start: weekStart, end: weekEnd, range: weekRange } = getCurrentWeekRange();

  // Filter data for current week
  const weekMoods = filterByWeek(moods, weekStart, weekEnd);
  const weekFocus = filterByWeek(focusSessions, weekStart, weekEnd);
  const weekGratitude = filterByWeek(gratitudeEntries, weekStart, weekEnd);

  // Calculate statistics
  const moodStats = calculateMoodStats(weekMoods);
  const habitStats = calculateHabitStats(habits, weekStart, weekEnd);
  const focusStats = calculateFocusStats(weekFocus);

  const slides: StorySlide[] = [];

  // 1. Intro slide
  slides.push({
    type: 'intro',
    title: translations.weeklyReview || 'Your Week in Review',
    subtitle: weekRange,
    icon: '📊',
    ...SLIDE_GRADIENTS.intro,
  });

  // 2. Mood slide (if there are moods)
  if (weekMoods.length > 0) {
    const moodEmoji = {
      great: '😄',
      good: '🙂',
      okay: '😐',
      bad: '😔',
      terrible: '😢',
    }[moodStats.dominantMood] || '🙂';

    const trendText = {
      up: translations.moodTrendUp || 'Improving! ↗️',
      down: translations.moodTrendDown || 'Challenging week ↘️',
      stable: translations.moodTrendStable || 'Steady week →',
    }[moodStats.trend];

    slides.push({
      type: 'mood',
      title: translations.moodJourney || 'Mood Journey',
      subtitle: trendText,
      icon: moodEmoji,
      value: `${moodStats.average.toFixed(1)}/5`,
      data: moodStats,
      ...SLIDE_GRADIENTS.mood,
    });
  }

  // 3. Habits slide (if there are habits)
  if (habits.length > 0 && habitStats.totalCompletions > 0) {
    slides.push({
      type: 'habits',
      title: translations.habitChampions || 'Habit Champions',
      subtitle: habitStats.topHabit
        ? `${habitStats.topHabit.icon} ${habitStats.topHabit.name}`
        : undefined,
      icon: '🎯',
      value: `${Math.round(habitStats.completionRate)}%`,
      data: habitStats,
      ...SLIDE_GRADIENTS.habits,
    });
  }

  // 4. Focus slide (if there are sessions)
  if (focusStats.sessionsCount > 0) {
    const hours = Math.floor(focusStats.totalMinutes / 60);
    const mins = focusStats.totalMinutes % 60;
    const timeStr = hours > 0
      ? `${hours}h ${mins}m`
      : `${mins}m`;

    slides.push({
      type: 'focus',
      title: translations.deepWork || 'Deep Work',
      subtitle: `${focusStats.sessionsCount} ${translations.sessions || 'sessions'}`,
      icon: '🧠',
      value: timeStr,
      data: focusStats,
      ...SLIDE_GRADIENTS.focus,
    });
  }

  // 5. Gratitude slide (if there are entries)
  if (weekGratitude.length > 0) {
    slides.push({
      type: 'gratitude',
      title: translations.gratitudeMoments || 'Gratitude Moments',
      subtitle: translations.thingsToBeThankfulFor || 'Things to be thankful for',
      icon: '💖',
      value: weekGratitude.length,
      data: weekGratitude.slice(0, 3),
      ...SLIDE_GRADIENTS.gratitude,
    });
  }

  // 6. Streak slide (if streak > 0)
  if (streak > 0) {
    const streakText = streak >= 30
      ? translations.legendaryStreak || 'Legendary! 👑'
      : streak >= 14
        ? translations.amazingStreak || 'Amazing! 💎'
        : streak >= 7
          ? translations.onFire || 'On Fire! 🔥'
          : translations.keepGoing || 'Keep Going!';

    slides.push({
      type: 'streak',
      title: `${streak} ${translations.dayStreak || 'Day Streak'}`,
      subtitle: streakText,
      icon: '🔥',
      value: streak,
      ...SLIDE_GRADIENTS.streak,
    });
  }

  // 7. Achievement slide (if new badges)
  if (newBadges.length > 0) {
    slides.push({
      type: 'achievement',
      title: translations.achievementsUnlocked || 'Achievements Unlocked',
      subtitle: `${newBadges.length} ${translations.newBadges || 'new'}`,
      icon: '🏆',
      value: newBadges.length,
      data: newBadges,
      ...SLIDE_GRADIENTS.achievement,
    });
  }

  // 8. Summary slide
  const summaryPoints = [];
  if (weekMoods.length > 0) summaryPoints.push(`${moodStats.average.toFixed(1)} avg mood`);
  if (habitStats.totalCompletions > 0) summaryPoints.push(`${habitStats.totalCompletions} habits`);
  if (focusStats.totalMinutes > 0) summaryPoints.push(`${focusStats.totalMinutes}m focus`);

  if (summaryPoints.length > 0) {
    slides.push({
      type: 'summary',
      title: translations.weekSummary || 'Week Summary',
      subtitle: summaryPoints.join(' • '),
      icon: '✨',
      data: { moodStats, habitStats, focusStats },
      ...SLIDE_GRADIENTS.summary,
    });
  }

  // 9. Outro slide
  slides.push({
    type: 'outro',
    title: translations.keepGrowing || 'Keep Growing!',
    subtitle: translations.seeYouNextWeek || 'See you next week',
    icon: '🌱',
    ...SLIDE_GRADIENTS.outro,
  });

  return slides;
}

/**
 * Check if enough data exists to generate a meaningful story
 */
export function hasEnoughDataForStory(
  moods: MoodEntry[],
  habits: Habit[],
  focusSessions: FocusSession[]
): boolean {
  const { start: weekStart, end: weekEnd } = getCurrentWeekRange();
  const weekMoods = filterByWeek(moods, weekStart, weekEnd);
  const weekFocus = filterByWeek(focusSessions, weekStart, weekEnd);

  // Need at least some data to make a story
  return weekMoods.length >= 2 || habits.length > 0 || weekFocus.length > 0;
}

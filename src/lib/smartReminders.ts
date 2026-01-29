/**
 * Smart Reminders - Analyze patterns and suggest optimal reminder times
 * Part of v1.5.0 Intelligence & Speed
 *
 * Uses local pattern analysis to suggest personalized reminder times
 * based on when users typically complete habits, log moods, and focus.
 */

import { Habit, MoodEntry, FocusSession, ReminderSettings } from '@/types';
import { getHabitCompletedDates } from '@/lib/habits';
import { safeParseInt } from '@/lib/validation';

// ============================================
// TYPES
// ============================================

export interface TimePattern {
  hour: number;
  count: number;
  percentage: number;
}

export interface DayPattern {
  day: number; // 0-6 (Sunday-Saturday)
  dayName: string;
  count: number;
  percentage: number;
}

export interface PatternAnalysis {
  peakHours: TimePattern[];
  quietHours: TimePattern[];
  bestDays: DayPattern[];
  averageCompletionTime: string;
  consistency: number; // 0-100%
}

export interface SmartReminderSuggestion {
  id: string;
  type: 'habit' | 'mood' | 'focus';
  currentTime: string;
  suggestedTime: string;
  reason: string;
  confidence: 'high' | 'medium' | 'low';
  icon: string;
  improvement?: string;
}

export interface HabitReminderSuggestion {
  habitId: string;
  habitName: string;
  habitIcon: string;
  suggestedTime: string;
  reason: string;
  confidence: 'high' | 'medium' | 'low';
  patternBased: boolean;
}

// ============================================
// HELPER FUNCTIONS
// ============================================

/**
 * Parse time string to hours (e.g., "09:30" -> 9.5)
 * Returns default of 9 if input is invalid
 */
function parseTimeToHours(time: string | undefined | null): number {
  if (!time || typeof time !== 'string') {
    return 9; // Default to 9 AM
  }
  const parts = time.split(':');
  const hours = safeParseInt(parts[0], 9, 0, 23);
  const minutes = parts.length > 1 ? safeParseInt(parts[1], 0, 0, 59) : 0;

  if (isNaN(hours)) return 9;
  return Math.max(0, Math.min(23, hours)) + (isNaN(minutes) ? 0 : Math.max(0, Math.min(59, minutes)) / 60);
}

/**
 * Format hours to time string (e.g., 9.5 -> "09:30")
 */
function formatHoursToTime(hours: number): string {
  const h = Math.floor(hours);
  const m = Math.round((hours - h) * 60);
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

/**
 * Get hour from timestamp
 */
function getHourFromTimestamp(timestamp: number): number {
  return new Date(timestamp).getHours();
}

/**
 * Get day from date string (YYYY-MM-DD)
 */
function getDayFromDate(dateStr: string): number {
  return new Date(dateStr).getDay();
}

/**
 * Calculate mode (most frequent value) from array
 */
function calculateMode(values: number[]): number | null {
  if (values.length === 0) return null;

  const counts = new Map<number, number>();
  let maxCount = 0;
  let mode = values[0];

  for (const val of values) {
    const count = (counts.get(val) || 0) + 1;
    counts.set(val, count);
    if (count > maxCount) {
      maxCount = count;
      mode = val;
    }
  }

  return mode;
}

/**
 * Calculate average from array
 */
function calculateAverage(values: number[]): number {
  if (values.length === 0) return 0;
  return values.reduce((a, b) => a + b, 0) / values.length;
}

/**
 * Get day name
 */
function getDayName(day: number, short = true): string {
  const days = short
    ? ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
    : ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  return days[day];
}

// ============================================
// PATTERN ANALYSIS
// ============================================

/**
 * Analyze mood logging patterns
 */
export function analyzeMoodPatterns(moods: MoodEntry[]): PatternAnalysis {
  const hourCounts = new Map<number, number>();
  const dayCounts = new Map<number, number>();
  const hours: number[] = [];

  moods.forEach(mood => {
    const hour = getHourFromTimestamp(mood.timestamp);
    const day = getDayFromDate(mood.date);

    hourCounts.set(hour, (hourCounts.get(hour) || 0) + 1);
    dayCounts.set(day, (dayCounts.get(day) || 0) + 1);
    hours.push(hour);
  });

  const total = moods.length || 1;

  // Convert to patterns sorted by count
  const peakHours: TimePattern[] = Array.from(hourCounts.entries())
    .map(([hour, count]) => ({
      hour,
      count,
      percentage: Math.round((count / total) * 100),
    }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 3);

  // Find quiet hours (hours with no or minimal activity)
  const allHours = Array.from({ length: 24 }, (_, i) => i);
  const quietHours: TimePattern[] = allHours
    .filter(h => !hourCounts.has(h) || (hourCounts.get(h) || 0) < 2)
    .slice(0, 5)
    .map(hour => ({
      hour,
      count: hourCounts.get(hour) || 0,
      percentage: Math.round(((hourCounts.get(hour) || 0) / total) * 100),
    }));

  const bestDays: DayPattern[] = Array.from(dayCounts.entries())
    .map(([day, count]) => ({
      day,
      dayName: getDayName(day),
      count,
      percentage: Math.round((count / total) * 100),
    }))
    .sort((a, b) => b.count - a.count);

  // Calculate consistency (standard deviation based)
  const avgHour = calculateAverage(hours);
  const variance = hours.length > 0
    ? hours.reduce((sum, h) => sum + Math.pow(h - avgHour, 2), 0) / hours.length
    : 0;
  const stdDev = Math.sqrt(variance);
  // Lower std dev = higher consistency (max 6 hours std dev = 0% consistency)
  const consistency = Math.max(0, Math.min(100, Math.round((1 - stdDev / 6) * 100)));

  return {
    peakHours,
    quietHours,
    bestDays,
    averageCompletionTime: formatHoursToTime(avgHour || 12),
    consistency,
  };
}

/**
 * Analyze focus session patterns
 */
export function analyzeFocusPatterns(sessions: FocusSession[]): PatternAnalysis {
  const completedSessions = sessions.filter(s => s.status !== 'aborted');
  const hourCounts = new Map<number, number>();
  const dayCounts = new Map<number, number>();
  const hours: number[] = [];

  completedSessions.forEach(session => {
    // Use completedAt time for analysis
    const date = new Date(session.date);
    // Use completedAt timestamp or estimate from date
    const hour = session.completedAt
      ? getHourFromTimestamp(session.completedAt)
      : date.getHours();
    const day = date.getDay();

    hourCounts.set(hour, (hourCounts.get(hour) || 0) + 1);
    dayCounts.set(day, (dayCounts.get(day) || 0) + 1);
    hours.push(hour);
  });

  const total = completedSessions.length || 1;

  const peakHours: TimePattern[] = Array.from(hourCounts.entries())
    .map(([hour, count]) => ({
      hour,
      count,
      percentage: Math.round((count / total) * 100),
    }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 3);

  const allHours = Array.from({ length: 24 }, (_, i) => i);
  const quietHours: TimePattern[] = allHours
    .filter(h => !hourCounts.has(h) || (hourCounts.get(h) || 0) < 2)
    .slice(0, 5)
    .map(hour => ({
      hour,
      count: hourCounts.get(hour) || 0,
      percentage: Math.round(((hourCounts.get(hour) || 0) / total) * 100),
    }));

  const bestDays: DayPattern[] = Array.from(dayCounts.entries())
    .map(([day, count]) => ({
      day,
      dayName: getDayName(day),
      count,
      percentage: Math.round((count / total) * 100),
    }))
    .sort((a, b) => b.count - a.count);

  const avgHour = calculateAverage(hours);
  const variance = hours.length > 0
    ? hours.reduce((sum, h) => sum + Math.pow(h - avgHour, 2), 0) / hours.length
    : 0;
  const stdDev = Math.sqrt(variance);
  const consistency = Math.max(0, Math.min(100, Math.round((1 - stdDev / 6) * 100)));

  return {
    peakHours,
    quietHours,
    bestDays,
    averageCompletionTime: formatHoursToTime(avgHour || 10),
    consistency,
  };
}

/**
 * Analyze habit completion patterns for a specific habit
 */
export function analyzeHabitPatterns(habit: Habit): PatternAnalysis {
  const completedDates = getHabitCompletedDates(habit);
  const dayCounts = new Map<number, number>();

  completedDates.forEach(dateStr => {
    const day = getDayFromDate(dateStr);
    dayCounts.set(day, (dayCounts.get(day) || 0) + 1);
  });

  const total = completedDates.length || 1;

  // For habits, we don't have timestamps, so we estimate based on typical patterns
  // Morning habits: 6-9, Afternoon: 12-14, Evening: 18-21
  const estimatedHour = habit.category === 'morning' ? 8
    : habit.category === 'evening' ? 20
    : 14;

  const bestDays: DayPattern[] = Array.from(dayCounts.entries())
    .map(([day, count]) => ({
      day,
      dayName: getDayName(day),
      count,
      percentage: Math.round((count / total) * 100),
    }))
    .sort((a, b) => b.count - a.count);

  // Consistency based on completion rate
  const totalDays = 30; // Last 30 days
  const consistency = Math.min(100, Math.round((completedDates.length / totalDays) * 100));

  return {
    peakHours: [{ hour: estimatedHour, count: total, percentage: 100 }],
    quietHours: [],
    bestDays,
    averageCompletionTime: formatHoursToTime(estimatedHour),
    consistency,
  };
}

// ============================================
// SMART SUGGESTIONS
// ============================================

/**
 * Generate smart reminder suggestions based on patterns
 */
export function generateSmartSuggestions(
  currentSettings: ReminderSettings,
  moods: MoodEntry[],
  habits: Habit[],
  focusSessions: FocusSession[]
): SmartReminderSuggestion[] {
  const suggestions: SmartReminderSuggestion[] = [];

  // Analyze patterns
  const moodPatterns = analyzeMoodPatterns(moods);
  const focusPatterns = analyzeFocusPatterns(focusSessions);

  // Mood reminder suggestion
  if (moods.length >= 7) { // Need at least a week of data
    const topMoodHour = moodPatterns.peakHours.length > 0 ? moodPatterns.peakHours[0] : undefined;
    if (topMoodHour && moodPatterns.consistency >= 40) {
      const suggestedTime = formatHoursToTime(topMoodHour.hour);
      const currentMorning = parseTimeToHours(currentSettings.moodTimeMorning);
      const currentAfternoon = parseTimeToHours(currentSettings.moodTimeAfternoon);

      // Suggest adjusting morning reminder if user logs mood earlier/later
      if (Math.abs(topMoodHour.hour - currentMorning) > 1) {
        suggestions.push({
          id: 'mood-morning',
          type: 'mood',
          currentTime: currentSettings.moodTimeMorning,
          suggestedTime,
          reason: `You typically log your mood around ${suggestedTime}`,
          confidence: moodPatterns.consistency >= 60 ? 'high' : 'medium',
          icon: '😊',
          improvement: `Based on ${moods.length} mood logs`,
        });
      }
    }
  }

  // Focus reminder suggestion
  if (focusSessions.length >= 5) {
    const topFocusHour = focusPatterns.peakHours.length > 0 ? focusPatterns.peakHours[0] : undefined;
    if (topFocusHour && focusPatterns.consistency >= 30) {
      const suggestedTime = formatHoursToTime(topFocusHour.hour);
      const currentFocus = parseTimeToHours(currentSettings.focusTime);

      if (Math.abs(topFocusHour.hour - currentFocus) > 1) {
        suggestions.push({
          id: 'focus',
          type: 'focus',
          currentTime: currentSettings.focusTime,
          suggestedTime,
          reason: `Your most productive focus time is around ${suggestedTime}`,
          confidence: focusPatterns.consistency >= 50 ? 'high' : 'medium',
          icon: '🎯',
          improvement: `Based on ${focusSessions.length} focus sessions`,
        });
      }
    }
  }

  // Habit reminder suggestion
  const habitPatterns = habits.map(h => ({
    habit: h,
    patterns: analyzeHabitPatterns(h),
  }));

  // Find if habits are completed at a consistent time different from reminder
  const consistentHabits = habitPatterns
    .filter(hp => hp.patterns.consistency >= 50)
    .slice(0, 1);

  if (consistentHabits.length > 0) {
    const hp = consistentHabits[0];
    const suggestedTime = hp.patterns.averageCompletionTime;
    const currentHabit = parseTimeToHours(currentSettings.habitTime);
    const suggestedHour = parseTimeToHours(suggestedTime);

    if (Math.abs(suggestedHour - currentHabit) > 2) {
      suggestions.push({
        id: 'habits',
        type: 'habit',
        currentTime: currentSettings.habitTime,
        suggestedTime,
        reason: `You tend to complete habits around ${suggestedTime}`,
        confidence: 'medium',
        icon: '✨',
        improvement: `Based on your habit completion patterns`,
      });
    }
  }

  return suggestions;
}

/**
 * Generate per-habit reminder suggestions
 */
export function generateHabitReminderSuggestions(
  habits: Habit[],
  moods: MoodEntry[]
): HabitReminderSuggestion[] {
  const suggestions: HabitReminderSuggestion[] = [];

  habits.forEach(habit => {
    const patterns = analyzeHabitPatterns(habit);

    // Find best time based on category or patterns
    let suggestedTime = '09:00';
    let reason = '';
    let confidence: 'high' | 'medium' | 'low' = 'low';
    let patternBased = false;

    // If habit has good consistency, use pattern
    if (patterns.consistency >= 40) {
      suggestedTime = patterns.averageCompletionTime;
      reason = `Based on your completion patterns (${patterns.consistency}% consistency)`;
      confidence = patterns.consistency >= 60 ? 'high' : 'medium';
      patternBased = true;
    } else {
      // Suggest based on category or habit name
      const name = habit.name.toLowerCase();

      if (name.includes('morning') || name.includes('wake') || name.includes('breakfast')) {
        suggestedTime = '07:30';
        reason = 'Best completed in the morning';
      } else if (name.includes('lunch') || name.includes('noon')) {
        suggestedTime = '12:00';
        reason = 'Best completed around midday';
      } else if (name.includes('evening') || name.includes('night') || name.includes('dinner') || name.includes('sleep') || name.includes('bed')) {
        suggestedTime = '21:00';
        reason = 'Best completed in the evening';
      } else if (name.includes('workout') || name.includes('exercise') || name.includes('gym') || name.includes('run')) {
        // Check if user tends to have better mood in morning or evening
        const morningMoods = moods.filter(m => getHourFromTimestamp(m.timestamp) < 12);
        const eveningMoods = moods.filter(m => getHourFromTimestamp(m.timestamp) >= 17);

        if (morningMoods.length > eveningMoods.length) {
          suggestedTime = '07:00';
          reason = 'You seem more active in the mornings';
        } else {
          suggestedTime = '18:00';
          reason = 'After-work workout time';
        }
        confidence = 'medium';
      } else if (name.includes('read') || name.includes('study') || name.includes('learn')) {
        suggestedTime = '20:00';
        reason = 'Quiet time for focused activities';
        confidence = 'medium';
      } else if (name.includes('meditat') || name.includes('breath') || name.includes('relax')) {
        suggestedTime = '07:00';
        reason = 'Start your day with mindfulness';
        confidence = 'medium';
      } else if (name.includes('water') || name.includes('drink')) {
        suggestedTime = '08:00';
        reason = 'Hydration reminder after waking up';
        confidence = 'medium';
      } else {
        suggestedTime = '19:00';
        reason = 'End of day reminder';
        confidence = 'low';
      }
    }

    suggestions.push({
      habitId: habit.id,
      habitName: habit.name,
      habitIcon: habit.icon,
      suggestedTime,
      reason,
      confidence,
      patternBased,
    });
  });

  return suggestions;
}

/**
 * Get optimal quiet hours based on patterns
 */
export function getOptimalQuietHours(
  moods: MoodEntry[],
  focusSessions: FocusSession[]
): { start: string; end: string } {
  const allTimestamps: number[] = [
    ...moods.map(m => m.timestamp),
    ...focusSessions.map(s => s.completedAt || new Date(s.date).getTime()),
  ];

  if (allTimestamps.length < 10) {
    // Default quiet hours
    return { start: '22:00', end: '08:00' };
  }

  const hourCounts = new Map<number, number>();
  allTimestamps.forEach(ts => {
    const hour = getHourFromTimestamp(ts);
    hourCounts.set(hour, (hourCounts.get(hour) || 0) + 1);
  });

  // Find hours with least activity
  const sortedHours = Array.from({ length: 24 }, (_, i) => ({
    hour: i,
    count: hourCounts.get(i) || 0,
  })).sort((a, b) => a.count - b.count);

  // Find contiguous quiet period
  const quietPeriod = sortedHours.slice(0, 8).map(h => h.hour).sort((a, b) => a - b);

  // Find the start and end of quiet period
  let start = quietPeriod[0] || 22;
  let end = quietPeriod[quietPeriod.length - 1] || 7;

  // Adjust to reasonable quiet hours (night time)
  if (start > 12) start = Math.max(22, start);
  if (end < 12) end = Math.min(8, end + 1);

  return {
    start: formatHoursToTime(start >= 22 ? start : 22),
    end: formatHoursToTime(end <= 8 ? end : 8),
  };
}

/**
 * Check if there's enough data for smart suggestions
 */
export function hasEnoughDataForSmartReminders(
  moods: MoodEntry[],
  habits: Habit[],
  focusSessions: FocusSession[]
): boolean {
  return moods.length >= 7 || focusSessions.length >= 5 || habits.some(h => getHabitCompletedDates(h).length >= 7);
}

/**
 * Get best days for reminders
 */
export function getBestReminderDays(
  moods: MoodEntry[],
  habits: Habit[]
): number[] {
  const dayCounts = new Map<number, number>();

  // Count activity per day
  moods.forEach(m => {
    const day = getDayFromDate(m.date);
    dayCounts.set(day, (dayCounts.get(day) || 0) + 1);
  });

  habits.forEach(h => {
    getHabitCompletedDates(h).forEach(dateStr => {
      const day = getDayFromDate(dateStr);
      dayCounts.set(day, (dayCounts.get(day) || 0) + 1);
    });
  });

  // Sort by count and return top 5 days
  const sortedDays = Array.from(dayCounts.entries())
    .sort((a, b) => b[1] - a[1])
    .map(([day]) => day);

  // Return at least Monday-Friday if not enough data
  if (sortedDays.length < 3) {
    return [1, 2, 3, 4, 5]; // Mon-Fri
  }

  return sortedDays.slice(0, 5);
}

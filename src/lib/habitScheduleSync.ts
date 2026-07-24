/**
 * Habit-Schedule Synchronization Module
 * v1.4.0 - Auto-sync habits with reminders to the schedule timeline
 *
 * ADHD-focused: Reduces cognitive load by automatically showing habits
 * in the visual schedule, so users don't need to remember separately.
 */

import { Habit, HabitReminder, ScheduleEvent } from '@/types';
import { safeParseInt } from '@/lib/validation';
import { parseLocalDate } from '@/lib/utils';
import { resolveHabitColor } from '@/lib/habitColorUtils';
import { isHabitDueOnDate, normalizeHabitReminderDays } from '@/lib/habitScheduling';

/**
 * Format a date to YYYY-MM-DD string
 */
function formatDate(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/**
 * Check if a habit reminder should show on a given date
 * Based on the reminder's enabled status and day configuration
 */
export function shouldReminderShowOnDate(
  reminder: HabitReminder,
  dateStr: string
): boolean {
  if (!reminder.enabled) return false;

  const date = parseLocalDate(dateStr);
  // v1.4.0: Validate date to prevent NaN issues with invalid dateStr
  if (isNaN(date.getTime())) return false;

  const dayOfWeek = date.getDay(); // 0 = Sunday, 1 = Monday, etc.

  return normalizeHabitReminderDays(reminder.days).includes(dayOfWeek);
}

/**
 * Convert a single habit to schedule events for specified dates
 * Each reminder creates a separate event
 */
export function habitToScheduleEvents(
  habit: Habit,
  dates: string[]
): ScheduleEvent[] {
  const events: ScheduleEvent[] = [];

  if (!habit.reminders || habit.reminders.length === 0) {
    return events;
  }

  // Resolve color from palette index
  const colorHex = resolveHabitColor(habit.color);

  for (const date of dates) {
    if (!isHabitDueOnDate(habit, date)) continue;

    habit.reminders.forEach((reminder, reminderIndex) => {
      if (!shouldReminderShowOnDate(reminder, date)) return;

      // v1.4.0: Null check for reminder.time to prevent crash
      if (!reminder.time || typeof reminder.time !== 'string') return;

      // Parse time "HH:MM"
      const timeParts = reminder.time.split(':');
      if (timeParts.length < 2) return; // Invalid time format
      const startHour = safeParseInt(timeParts[0], 9, 0, 23);
      const startMinute = safeParseInt(timeParts[1], 0, 0, 59);

      // Default 30-minute duration for habit events
      let endHour = startHour;
      let endMinute = startMinute + 30;

      if (endMinute >= 60) {
        endHour += 1;
        endMinute -= 60;
      }

      // Clamp to end of day
      if (endHour >= 24) {
        endHour = 23;
        endMinute = 59;
      }

      events.push({
        id: `habit-${habit.id}-${date}-${reminderIndex}`,
        title: habit.name,
        startHour,
        startMinute,
        endHour,
        endMinute,
        color: colorHex,
        emoji: habit.icon,
        date,
        source: 'habit',
        habitId: habit.id,
        isEditable: false,
      });
    });
  }

  return events;
}

/**
 * Generate schedule events from all habits for specified number of days
 * Creates events for today + daysAhead days
 */
export function generateHabitScheduleEvents(
  habits: Habit[],
  daysAhead: number = 7
): ScheduleEvent[] {
  // Generate dates array (today + daysAhead)
  const dates: string[] = [];
  const today = new Date();

  for (let i = 0; i <= daysAhead; i++) {
    const date = new Date(today);
    date.setDate(today.getDate() + i);
    dates.push(formatDate(date));
  }

  // Generate events for all habits
  const allEvents: ScheduleEvent[] = [];

  for (const habit of habits) {
    const habitEvents = habitToScheduleEvents(habit, dates);
    allEvents.push(...habitEvents);
  }

  return allEvents;
}

/**
 * Merge manual events with habit-generated events
 * Preserves manual events and adds habit events
 * Adds source='manual' to existing events that lack it for backward compat
 */
export function mergeScheduleEvents(
  manualEvents: ScheduleEvent[],
  habitEvents: ScheduleEvent[]
): ScheduleEvent[] {
  // Normalize manual events - add source='manual' if missing
  const normalizedManual = manualEvents.map(event => ({
    ...event,
    source: event.source || 'manual' as const,
    isEditable: event.isEditable !== false,
  }));

  return [...normalizedManual, ...habitEvents];
}

/**
 * Filter events by date
 */
export function filterEventsByDate(
  events: ScheduleEvent[],
  date: string
): ScheduleEvent[] {
  return events.filter(event => event.date === date);
}

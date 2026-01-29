/**
 * Habit-Schedule Synchronization Module
 * v1.4.0 - Auto-sync habits with reminders to the schedule timeline
 *
 * ADHD-focused: Reduces cognitive load by automatically showing habits
 * in the visual schedule, so users don't need to remember separately.
 */

import { Habit, HabitReminder, ScheduleEvent } from '@/types';
import { safeParseInt } from '@/lib/validation';

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

  // If no specific days configured, show every day
  if (!reminder.days || reminder.days.length === 0) return true;

  const date = new Date(dateStr);
  // v1.4.0: Validate date to prevent NaN issues with invalid dateStr
  if (isNaN(date.getTime())) return false;

  const dayOfWeek = date.getDay(); // 0 = Sunday, 1 = Monday, etc.

  return reminder.days.includes(dayOfWeek);
}

/**
 * Map habit color class to hex color for schedule events
 */
function habitColorToHex(colorClass: string): string {
  // v1.4.0: Null check to prevent crash on undefined colorClass
  if (!colorClass || typeof colorClass !== 'string') {
    return '#8b5cf6'; // Default to primary purple
  }

  // Common Tailwind color mappings
  const colorMap: Record<string, string> = {
    'bg-primary': '#8b5cf6',
    'bg-accent': '#06b6d4',
    'bg-green-500': '#22c55e',
    'bg-blue-500': '#3b82f6',
    'bg-purple-500': '#a855f7',
    'bg-pink-500': '#ec4899',
    'bg-orange-500': '#f97316',
    'bg-red-500': '#ef4444',
    'bg-yellow-500': '#eab308',
    'bg-teal-500': '#14b8a6',
    'bg-indigo-500': '#6366f1',
    'bg-cyan-500': '#06b6d4',
  };

  // Try to find a matching color
  for (const [key, value] of Object.entries(colorMap)) {
    if (colorClass.includes(key.replace('bg-', ''))) {
      return value;
    }
  }

  // Default to primary purple
  return '#8b5cf6';
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

  for (const date of dates) {
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
        color: habitColorToHex(habit.color),
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

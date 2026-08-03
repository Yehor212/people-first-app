import { ScheduleEvent } from '@/types';
import { formatDate, parseLocalDate, getToday } from '@/lib/utils';

export interface ScheduleTimelineProps {
  events: ScheduleEvent[];
  initialSelectedDate?: string;
  onAddEvent?: (event: Omit<ScheduleEvent, 'id'>) => void;
  onDeleteEvent?: (id: string) => void;
}

// Get array of dates for ±30 days range
export function getExtendedDates(): string[] {
  const dates: string[] = [];
  const today = new Date();
  for (let i = -30; i <= 30; i++) {
    const date = new Date(today);
    date.setDate(today.getDate() + i);
    dates.push(formatDate(date));
  }
  return dates;
}

// Format date for display
export function formatDayShort(dateStr: string, language: string): { day: string; weekday: string; isToday: boolean } {
  const date = parseLocalDate(dateStr);
  const isToday = dateStr === getToday();
  const formatter = new Intl.DateTimeFormat(language, { weekday: 'short' });

  return {
    day: date.getDate().toString(),
    weekday: formatter.format(date),
    isToday,
  };
}

// Event color system
export const EVENT_COLORS = {
  work: 'hsl(var(--event-work))',
  meal: 'hsl(var(--event-meal))',
  rest: 'hsl(var(--event-rest))',
  exercise: 'hsl(var(--event-exercise))',
  study: 'hsl(var(--event-study))',
  meeting: 'hsl(var(--event-meeting))',
  break: 'hsl(var(--event-break))',
  urgent: 'hsl(var(--event-urgent))',
  google: 'hsl(var(--event-google))',
} as const;

// Event gradient mappings for premium cards
export const EVENT_GRADIENTS = {
  work: 'from-blue-500/40 to-blue-600/30',
  meal: 'from-green-500/40 to-green-600/30',
  rest: 'from-purple-500/40 to-purple-600/30',
  exercise: 'from-orange-500/40 to-orange-600/30',
  study: 'from-cyan-500/40 to-cyan-600/30',
  meeting: 'from-pink-500/40 to-pink-600/30',
  break: 'from-amber-500/40 to-amber-600/30',
  urgent: 'from-red-500/40 to-red-600/30',
  google: 'from-blue-500/40 to-indigo-500/30',
} as const;

export const getEventColor = (colorVar?: string, isUrgent?: boolean): string => {
  if (isUrgent) return EVENT_COLORS.urgent;
  if (colorVar && colorVar in EVENT_COLORS) {
    return EVENT_COLORS[colorVar as keyof typeof EVENT_COLORS];
  }
  return EVENT_COLORS.work;
};

export const getEventGradient = (colorVar?: string, isUrgent?: boolean): string => {
  if (isUrgent) return EVENT_GRADIENTS.urgent;
  if (colorVar && colorVar in EVENT_GRADIENTS) {
    return EVENT_GRADIENTS[colorVar as keyof typeof EVENT_GRADIENTS];
  }
  return EVENT_GRADIENTS.work;
};

// Event presets
export const EVENT_PRESETS = [
  { id: 'work', emoji: '💼', colorVar: 'work', labelKey: 'scheduleWork' },
  { id: 'meal', emoji: '🍽️', colorVar: 'meal', labelKey: 'scheduleMeal' },
  { id: 'rest', emoji: '😴', colorVar: 'rest', labelKey: 'scheduleRest' },
  { id: 'exercise', emoji: '🏃', colorVar: 'exercise', labelKey: 'scheduleExercise' },
  { id: 'study', emoji: '📚', colorVar: 'study', labelKey: 'scheduleStudy' },
  { id: 'meeting', emoji: '👥', colorVar: 'meeting', labelKey: 'scheduleMeeting' },
];

// Timeline constants
export const HOURS_PER_DAY = 24;
export const HOURS = Array.from({ length: HOURS_PER_DAY }, (_, i) => i);
// The timeline is intentionally a one-axis scroller. A 96px cell keeps the
// complete `HH:00` label readable at ZenFlow's 150% text scale plus WCAG text
// spacing without shrinking or clipping the user's chosen typography.
export const HOUR_WIDTH_PX = 96;
export const DAY_WIDTH_PX = HOURS_PER_DAY * HOUR_WIDTH_PX;

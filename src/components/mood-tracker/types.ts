import { Sun, Cloud, Moon } from 'lucide-react';
import type { MoodType, MoodEntry } from '@/types';
import { moodNoteSchema } from '@/lib/validation';
import { sanitizeString } from '@/lib/sanitize';
import { logger } from '@/lib/logger';

export type TimeOfDay = 'morning' | 'afternoon' | 'evening';

export interface MoodConfig {
  type: MoodType;
  emoji: string;
  labelKey: string;
  color: string;
}

export const MOOD_CONFIGS: MoodConfig[] = [
  { type: 'great', emoji: '😄', labelKey: 'great', color: 'bg-mood-great' },
  { type: 'good', emoji: '🙂', labelKey: 'good', color: 'bg-mood-good' },
  { type: 'okay', emoji: '😐', labelKey: 'okay', color: 'bg-mood-okay' },
  { type: 'bad', emoji: '😔', labelKey: 'bad', color: 'bg-mood-bad' },
  { type: 'terrible', emoji: '😢', labelKey: 'terrible', color: 'bg-mood-terrible' },
];

export const TIME_ICONS = {
  morning: Sun,
  afternoon: Cloud,
  evening: Moon,
} as const;

export function getCurrentTimeOfDay(): TimeOfDay {
  const hour = new Date().getHours();
  if (hour >= 0 && hour < 12) return 'morning';
  if (hour >= 12 && hour < 18) return 'afternoon';
  return 'evening';
}

export function getTimeOfDayFromTimestamp(timestamp: number): TimeOfDay {
  const hour = new Date(timestamp).getHours();
  if (hour >= 0 && hour < 12) return 'morning';
  if (hour >= 12 && hour < 18) return 'afternoon';
  return 'evening';
}

export interface ConfirmChangePayload {
  entryId: string;
  newMood: MoodType;
  oldMood: MoodType;
  newNote?: string;
}

export interface CelebrationData {
  mood: MoodType;
  note?: string;
  timeOfDay: TimeOfDay;
}

export interface MoodTrackerProps {
  entries: MoodEntry[];
  onAddEntry: (entry: MoodEntry) => void;
  onUpdateEntry?: (entryId: string, mood: MoodType, note?: string) => void;
  isPrimaryCTA?: boolean;
}

/**
 * Validate and sanitize a mood note.
 * Returns sanitized string, undefined (empty input), or null (invalid).
 */
export function validateNote(note: string): string | undefined | null {
  const trimmed = note.trim();
  if (!trimmed) return undefined;
  const result = moodNoteSchema.safeParse(trimmed);
  if (!result.success) {
    logger.warn('[MoodTracker] Invalid note:', result.error.message);
    return null;
  }
  return sanitizeString(result.data);
}

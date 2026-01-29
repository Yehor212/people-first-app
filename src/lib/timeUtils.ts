/**
 * Time Utilities
 *
 * Safe time parsing functions that handle edge cases
 * like undefined values, invalid formats, and out-of-range numbers.
 */

/**
 * Safely parse a time string in "HH:MM" format.
 * Returns default values if the input is invalid.
 *
 * @param time - Time string in "HH:MM" format (e.g., "09:30", "14:00")
 * @param defaultHour - Default hour if parsing fails (default: 9)
 * @param defaultMinute - Default minute if parsing fails (default: 0)
 * @returns Object with validated hour (0-23) and minute (0-59)
 */
export function parseTime(
  time: string | undefined | null,
  defaultHour: number = 9,
  defaultMinute: number = 0
): { hour: number; minute: number } {
  if (!time || typeof time !== 'string') {
    return { hour: defaultHour, minute: defaultMinute };
  }

  const parts = time.split(':');

  if (parts.length === 0) {
    return { hour: defaultHour, minute: defaultMinute };
  }

  const parsedHour = parseInt(parts[0], 10);
  const parsedMinute = parts.length > 1 ? parseInt(parts[1], 10) : 0;

  const hour = isNaN(parsedHour) ? defaultHour : Math.max(0, Math.min(23, parsedHour));
  const minute = isNaN(parsedMinute) ? defaultMinute : Math.max(0, Math.min(59, parsedMinute));

  return { hour, minute };
}

/**
 * Format hour and minute into "HH:MM" string
 *
 * @param hour - Hour (0-23)
 * @param minute - Minute (0-59)
 * @returns Formatted time string like "09:30"
 */
export function formatTime(hour: number, minute: number): string {
  const h = Math.max(0, Math.min(23, hour));
  const m = Math.max(0, Math.min(59, minute));
  return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}`;
}

/**
 * Check if a time string is valid "HH:MM" format
 *
 * @param time - Time string to validate
 * @returns true if valid, false otherwise
 */
export function isValidTimeFormat(time: string | undefined | null): boolean {
  if (!time || typeof time !== 'string') {
    return false;
  }

  const match = time.match(/^(\d{1,2}):(\d{2})$/);
  if (!match) {
    return false;
  }

  const hour = parseInt(match[1], 10);
  const minute = parseInt(match[2], 10);

  return hour >= 0 && hour <= 23 && minute >= 0 && minute <= 59;
}

// ============================================
// LOCALE UTILITIES
// ============================================

import type { Language } from '@/i18n/translations';

/**
 * Map language codes to locale strings for Intl APIs
 */
export const localeMap: Record<Language, string> = {
  ru: 'ru-RU',
  en: 'en-US',
  uk: 'uk-UA',
  es: 'es-ES',
  de: 'de-DE',
  fr: 'fr-FR'
};

/**
 * Get locale string from language code
 */
export function getLocale(language: Language): string {
  return localeMap[language] || 'en-US';
}

/**
 * Format date with proper locale
 */
export function formatLocalizedDate(
  date: Date,
  language: Language,
  options?: Intl.DateTimeFormatOptions
): string {
  return date.toLocaleDateString(getLocale(language), options);
}

/**
 * Format time with proper locale
 */
export function formatLocalizedTime(
  date: Date,
  language: Language,
  options?: Intl.DateTimeFormatOptions
): string {
  return date.toLocaleTimeString(getLocale(language), options);
}

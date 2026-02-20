/**
 * Garden Atmosphere engine (IA Blueprint Phase 4.3)
 *
 * Maps current schedule events to garden visual mood.
 * The garden atmosphere changes based on what the user is doing now.
 * Pure functions — no React dependency.
 */

import type { ScheduleEvent } from '@/types';

export type GardenAtmosphere =
  | 'default'    // No events — seasonal default
  | 'focused'    // Focus/work event — quiet, muted colors
  | 'social'     // Social event — butterflies, lively
  | 'restful'    // Rest/break event — nighttime ambiance
  | 'energetic'  // Exercise event — bright, dynamic
  | 'creative';  // Study/creative event — inspired, warm

/** Event color vars that indicate focus/work */
const FOCUS_COLORS = new Set(['work', 'study', 'meeting']);
/** Event color vars that indicate social */
const SOCIAL_COLORS = new Set(['meeting']);
/** Event color vars that indicate rest */
const REST_COLORS = new Set(['rest', 'break']);
/** Event color vars that indicate exercise */
const EXERCISE_COLORS = new Set(['exercise']);

/**
 * Determines current garden atmosphere based on what schedule event
 * is happening right now.
 */
export function getCurrentGardenAtmosphere(
  events: ScheduleEvent[],
  currentHour?: number,
  currentMinute?: number,
): GardenAtmosphere {
  const now = new Date();
  const hour = currentHour ?? now.getHours();
  const minute = currentMinute ?? now.getMinutes();
  const currentTime = hour * 60 + minute;

  // Find event happening right now
  const currentEvent = events.find(e => {
    const start = e.startHour * 60 + (e.startMinute || 0);
    const end = e.endHour * 60 + (e.endMinute || 0);
    return currentTime >= start && currentTime < end;
  });

  if (!currentEvent) return 'default';

  const colorVar = currentEvent.colorVar || '';

  if (REST_COLORS.has(colorVar)) return 'restful';
  if (EXERCISE_COLORS.has(colorVar)) return 'energetic';
  if (SOCIAL_COLORS.has(colorVar) && colorVar === 'meeting') return 'social';
  if (FOCUS_COLORS.has(colorVar)) return 'focused';

  // Fallback: if event title contains keywords
  const title = (currentEvent.title || '').toLowerCase();
  if (title.includes('focus') || title.includes('work') || title.includes('study')) return 'focused';
  if (title.includes('rest') || title.includes('break') || title.includes('nap')) return 'restful';
  if (title.includes('exercise') || title.includes('gym') || title.includes('run')) return 'energetic';
  if (title.includes('meeting') || title.includes('call') || title.includes('social')) return 'social';
  if (title.includes('create') || title.includes('draw') || title.includes('write')) return 'creative';

  return 'default';
}

/**
 * Returns companion behavior hint based on garden atmosphere.
 */
export function getCompanionBehaviorForAtmosphere(atmosphere: GardenAtmosphere): string {
  switch (atmosphere) {
    case 'focused': return 'sits_still';     // Companion sits quietly
    case 'social': return 'waves';           // Companion waves excitedly
    case 'restful': return 'sleeps';         // Companion curls up
    case 'energetic': return 'bounces';      // Companion bounces around
    case 'creative': return 'watches';       // Companion watches curiously
    default: return 'idle';                  // Default idle behavior
  }
}

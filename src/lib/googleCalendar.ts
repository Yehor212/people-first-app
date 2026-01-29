/**
 * Google Calendar Integration
 * Part of v1.3.0 "Harmony" - Enhanced Productivity
 *
 * Integrates with Google Calendar API to:
 * - Show today's events in ScheduleTimeline
 * - Auto-sync when app opens
 * - Respect privacy (read-only access)
 *
 * Uses existing Supabase Google OAuth for authentication.
 */

import { supabase } from './supabaseClient';
import { logger } from './logger';
import { safeLocalStorageGet, safeLocalStorageSet } from './safeJson';

// ============================================
// TYPES
// ============================================

export interface CalendarEvent {
  id: string;
  title: string;
  description?: string;
  startTime: Date;
  endTime: Date;
  isAllDay: boolean;
  location?: string;
  color?: string;
}

export interface CalendarSyncState {
  lastSyncAt: number;
  events: CalendarEvent[];
  enabled: boolean;
}

// ============================================
// CONSTANTS
// ============================================

const STORAGE_KEY = 'zenflow_calendar_cache';
const CACHE_DURATION_MS = 15 * 60 * 1000; // 15 minutes
const CALENDAR_API_BASE = 'https://www.googleapis.com/calendar/v3';

// ============================================
// STATE MANAGEMENT
// ============================================

/**
 * Get cached calendar state
 */
function getCachedState(): CalendarSyncState | null {
  return safeLocalStorageGet<CalendarSyncState | null>(STORAGE_KEY, null);
}

/**
 * Save calendar state to cache
 */
function saveCacheState(state: CalendarSyncState): void {
  safeLocalStorageSet(STORAGE_KEY, state);
}

/**
 * Check if calendar integration is enabled
 */
export function isCalendarEnabled(): boolean {
  const state = getCachedState();
  return state?.enabled ?? false;
}

/**
 * Enable/disable calendar integration
 */
export function setCalendarEnabled(enabled: boolean): void {
  const state = getCachedState() || {
    lastSyncAt: 0,
    events: [],
    enabled: false,
  };
  state.enabled = enabled;
  saveCacheState(state);
  logger.log('[Calendar] Integration', enabled ? 'enabled' : 'disabled');
}

// ============================================
// AUTHENTICATION
// ============================================

/**
 * Check if user has Google OAuth connected with calendar scope
 */
export async function isCalendarConnected(): Promise<boolean> {
  if (!supabase) return false;

  try {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session?.provider_token) return false;

    // Check if the provider is Google
    const user = session.user;
    const isGoogle = user?.app_metadata?.provider === 'google' ||
                     user?.identities?.some(i => i.provider === 'google');

    return isGoogle && !!session.provider_token;
  } catch (error) {
    logger.error('[Calendar] Connection check failed:', error);
    return false;
  }
}

/**
 * Get Google access token from Supabase session
 */
async function getAccessToken(): Promise<string | null> {
  if (!supabase) return null;

  try {
    const { data: { session } } = await supabase.auth.getSession();
    return session?.provider_token || null;
  } catch (error) {
    logger.error('[Calendar] Failed to get access token:', error);
    return null;
  }
}

// ============================================
// CALENDAR API
// ============================================

/**
 * Fetch events from Google Calendar
 */
export async function fetchCalendarEvents(
  date: Date = new Date()
): Promise<CalendarEvent[]> {
  const token = await getAccessToken();
  if (!token) {
    logger.warn('[Calendar] No access token available');
    return [];
  }

  try {
    // Get start and end of day
    const startOfDay = new Date(date);
    startOfDay.setHours(0, 0, 0, 0);

    const endOfDay = new Date(date);
    endOfDay.setHours(23, 59, 59, 999);

    const params = new URLSearchParams({
      timeMin: startOfDay.toISOString(),
      timeMax: endOfDay.toISOString(),
      singleEvents: 'true',
      orderBy: 'startTime',
      maxResults: '50',
    });

    const response = await fetch(
      `${CALENDAR_API_BASE}/calendars/primary/events?${params}`,
      {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      }
    );

    if (!response.ok) {
      if (response.status === 401) {
        logger.warn('[Calendar] Token expired or invalid');
        return [];
      }
      throw new Error(`Calendar API error: ${response.status}`);
    }

    const data = await response.json();

    // Parse events - filter out items without valid dates
    const events: CalendarEvent[] = (data.items || [])
      .filter((item: any) => {
        // Must have either dateTime or date for both start and end
        const hasStart = item.start?.dateTime || item.start?.date;
        const hasEnd = item.end?.dateTime || item.end?.date;
        return hasStart && hasEnd;
      })
      .map((item: any) => ({
        id: item.id,
        title: item.summary || 'Untitled Event',
        description: item.description,
        startTime: new Date(item.start.dateTime || item.start.date),
        endTime: new Date(item.end.dateTime || item.end.date),
        isAllDay: !item.start.dateTime,
        location: item.location,
        color: item.colorId ? getColorForId(item.colorId) : undefined,
      }));

    logger.log('[Calendar] Fetched', events.length, 'events');
    return events;
  } catch (error) {
    logger.error('[Calendar] Fetch events failed:', error);
    return [];
  }
}

/**
 * Sync calendar events (with caching)
 */
export async function syncCalendarEvents(
  forceRefresh: boolean = false
): Promise<CalendarEvent[]> {
  // Check if enabled
  if (!isCalendarEnabled()) {
    return [];
  }

  // Check if connected
  const connected = await isCalendarConnected();
  if (!connected) {
    logger.warn('[Calendar] Not connected to Google');
    return [];
  }

  // Check cache
  const state = getCachedState();
  const now = Date.now();

  if (!forceRefresh && state && (now - state.lastSyncAt) < CACHE_DURATION_MS) {
    logger.log('[Calendar] Using cached events');
    return state.events;
  }

  // Fetch fresh events
  const events = await fetchCalendarEvents();

  // Update cache
  saveCacheState({
    lastSyncAt: now,
    events,
    enabled: true,
  });

  return events;
}

/**
 * Get today's events (from cache or API)
 */
export async function getTodaysEvents(): Promise<CalendarEvent[]> {
  return syncCalendarEvents();
}

/**
 * Get events within a time range
 */
export function getEventsInRange(
  events: CalendarEvent[],
  startHour: number,
  endHour: number
): CalendarEvent[] {
  return events.filter((event) => {
    const eventHour = event.startTime.getHours();
    return eventHour >= startHour && eventHour < endHour;
  });
}

/**
 * Get current or next upcoming event
 */
export function getCurrentOrNextEvent(
  events: CalendarEvent[]
): CalendarEvent | null {
  const now = new Date();

  // Find current event (happening now)
  const current = events.find(
    (e) => e.startTime <= now && e.endTime > now
  );
  if (current) return current;

  // Find next upcoming event
  const upcoming = events
    .filter((e) => e.startTime > now)
    .sort((a, b) => a.startTime.getTime() - b.startTime.getTime());

  return upcoming[0] || null;
}

// ============================================
// HELPERS
// ============================================

/**
 * Format event time for display
 */
export function formatEventTime(event: CalendarEvent): string {
  if (event.isAllDay) {
    return 'All day';
  }

  const formatTime = (date: Date) => {
    return date.toLocaleTimeString([], {
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    });
  };

  return `${formatTime(event.startTime)} - ${formatTime(event.endTime)}`;
}

/**
 * Get duration in minutes
 */
export function getEventDuration(event: CalendarEvent): number {
  return Math.round(
    (event.endTime.getTime() - event.startTime.getTime()) / (1000 * 60)
  );
}

/**
 * Map Google Calendar color IDs to hex colors
 */
function getColorForId(colorId: string): string {
  const colors: Record<string, string> = {
    '1': '#7986cb', // Lavender
    '2': '#33b679', // Sage
    '3': '#8e24aa', // Grape
    '4': '#e67c73', // Flamingo
    '5': '#f6bf26', // Banana
    '6': '#f4511e', // Tangerine
    '7': '#039be5', // Peacock
    '8': '#616161', // Graphite
    '9': '#3f51b5', // Blueberry
    '10': '#0b8043', // Basil
    '11': '#d50000', // Tomato
  };
  return colors[colorId] || '#4285f4';
}

/**
 * Clear calendar cache
 */
export function clearCalendarCache(): void {
  localStorage.removeItem(STORAGE_KEY);
  logger.log('[Calendar] Cache cleared');
}

export default {
  isCalendarEnabled,
  setCalendarEnabled,
  isCalendarConnected,
  fetchCalendarEvents,
  syncCalendarEvents,
  getTodaysEvents,
  getEventsInRange,
  getCurrentOrNextEvent,
  formatEventTime,
  getEventDuration,
  clearCalendarCache,
};

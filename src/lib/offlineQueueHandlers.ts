/**
 * Offline Queue Handlers
 *
 * Registers handlers for offline queue actions.
 * Each handler knows how to sync a specific type of action to the cloud.
 */

import { offlineQueue, type OfflineAction } from './offlineQueue';
import { syncMood, deleteMoodFromCloud } from '@/storage/realtimeSync';
import { syncHabit, deleteHabitFromCloud } from '@/storage/realtimeSync';
import { syncFocusSession } from '@/storage/realtimeSync';
import { syncGratitude, deleteGratitudeFromCloud } from '@/storage/realtimeSync';
import { logger } from './logger';
import { MoodEntry, Habit, FocusSession, GratitudeEntry } from '@/types';

/**
 * Initialize all offline queue handlers
 * Call this once when the app starts
 */
export function initializeOfflineQueueHandlers(): void {
  logger.log('[OfflineQueue] Initializing handlers...');

  // Mood handlers
  offlineQueue.registerHandler('CREATE_MOOD', async (action: OfflineAction) => {
    const mood = action.payload as MoodEntry;
    await syncMood(mood);
  });

  offlineQueue.registerHandler('UPDATE_MOOD', async (action: OfflineAction) => {
    const mood = action.payload as MoodEntry;
    await syncMood(mood);
  });

  offlineQueue.registerHandler('DELETE_MOOD', async (action: OfflineAction) => {
    await deleteMoodFromCloud(action.entityId);
  });

  // Habit handlers
  offlineQueue.registerHandler('CREATE_HABIT', async (action: OfflineAction) => {
    const habit = action.payload as Habit;
    await syncHabit(habit);
  });

  offlineQueue.registerHandler('UPDATE_HABIT', async (action: OfflineAction) => {
    const habit = action.payload as Habit;
    await syncHabit(habit);
  });

  offlineQueue.registerHandler('DELETE_HABIT', async (action: OfflineAction) => {
    await deleteHabitFromCloud(action.entityId);
  });

  offlineQueue.registerHandler('TOGGLE_HABIT', async (action: OfflineAction) => {
    const habit = action.payload as Habit;
    await syncHabit(habit);
  });

  // Focus session handler
  offlineQueue.registerHandler('CREATE_FOCUS_SESSION', async (action: OfflineAction) => {
    const session = action.payload as FocusSession;
    await syncFocusSession(session);
  });

  // Gratitude handlers
  offlineQueue.registerHandler('CREATE_GRATITUDE', async (action: OfflineAction) => {
    const entry = action.payload as GratitudeEntry;
    await syncGratitude(entry);
  });

  offlineQueue.registerHandler('DELETE_GRATITUDE', async (action: OfflineAction) => {
    await deleteGratitudeFromCloud(action.entityId);
  });

  // Settings handler
  offlineQueue.registerHandler('UPDATE_SETTINGS', async (action: OfflineAction) => {
    // Settings are synced via full backup sync
    // This is a placeholder for future granular settings sync
    logger.log('[OfflineQueue] Settings sync - using full backup');
  });

  logger.log('[OfflineQueue] Handlers initialized');

  // Process any pending actions from previous session
  if (navigator.onLine) {
    void offlineQueue.processQueue();
  }
}

/**
 * Helper to queue a mood action with offline support
 */
export const queueMoodSync = async (
  action: 'CREATE_MOOD' | 'UPDATE_MOOD' | 'DELETE_MOOD',
  mood: MoodEntry
): Promise<void> => {
  await offlineQueue.enqueue(action, mood.id, mood);
};

/**
 * Helper to queue a habit action with offline support
 */
export const queueHabitSync = async (
  action: 'CREATE_HABIT' | 'UPDATE_HABIT' | 'DELETE_HABIT' | 'TOGGLE_HABIT',
  habit: Habit
): Promise<void> => {
  await offlineQueue.enqueue(action, habit.id, habit);
};

/**
 * Helper to queue a focus session with offline support
 */
export const queueFocusSessionSync = async (session: FocusSession): Promise<void> => {
  await offlineQueue.enqueue('CREATE_FOCUS_SESSION', session.id, session);
};

/**
 * Helper to queue a gratitude entry with offline support
 */
export const queueGratitudeSync = async (
  action: 'CREATE_GRATITUDE' | 'DELETE_GRATITUDE',
  entry: GratitudeEntry
): Promise<void> => {
  await offlineQueue.enqueue(action, entry.id, entry);
};

export default initializeOfflineQueueHandlers;

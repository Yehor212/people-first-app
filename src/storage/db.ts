import Dexie, { Table } from 'dexie';
import { MoodEntry, Habit, FocusSession, GratitudeEntry } from '@/types';
import type { JournalEntry, JournalPhoto } from '@/features/journal/types';
import { logger } from '@/lib/logger';

/**
 * Offline queue action stored in IndexedDB
 * P0 Fix: Move from localStorage to IndexedDB for better quota handling
 */
export interface OfflineQueueItem {
  id: string;
  type: string;
  entityId: string;
  payload: unknown;
  timestamp: number;
  retries: number;
  maxRetries: number;
  lastError?: string;
}

// Определяем схему базы данных
export class ZenFlowDB extends Dexie {
  moods!: Table<MoodEntry, string>;
  habits!: Table<Habit, string>;
  focusSessions!: Table<FocusSession, string>;
  gratitudeEntries!: Table<GratitudeEntry, string>;
  settings!: Table<{ key: string; value: unknown }, string>;
  offlineQueue!: Table<OfflineQueueItem, string>;
  journalEntries!: Table<JournalEntry, string>;
  journalPhotos!: Table<JournalPhoto, string>;

  constructor() {
    super('ZenFlowDB');

    // Version 1: Initial schema
    this.version(1).stores({
      moods: 'id, timestamp',
      habits: 'id, createdAt',
      focusSessions: 'id, startTime',
      gratitudeEntries: 'id, timestamp',
      settings: 'key',
    });

    // Version 2: Add indexes for performance (no data migration needed)
    this.version(2).stores({
      moods: 'id, timestamp, date',
      habits: 'id, createdAt, type',
      focusSessions: 'id, startTime, date',
      gratitudeEntries: 'id, timestamp, date',
      settings: 'key',
    });

    // Version 3: Add offline queue table for P0 fix
    // This moves offline queue from localStorage to IndexedDB
    // for better quota handling and reliability
    this.version(3).stores({
      moods: 'id, timestamp, date',
      habits: 'id, createdAt, type',
      focusSessions: 'id, startTime, date',
      gratitudeEntries: 'id, timestamp, date',
      settings: 'key',
      offlineQueue: 'id, type, entityId, timestamp',
    });

    // Version 4: Add journal/diary tables
    this.version(4).stores({
      moods: 'id, timestamp, date',
      habits: 'id, createdAt, type',
      focusSessions: 'id, startTime, date',
      gratitudeEntries: 'id, timestamp, date',
      settings: 'key',
      offlineQueue: 'id, type, entityId, timestamp',
      journalEntries: 'id, date, createdAt, updatedAt',
      journalPhotos: 'id, entryId, createdAt',
    });
  }
}

export const db = new ZenFlowDB();

export const moodsRepo = db.moods;
export const habitsRepo = db.habits;
export const focusRepo = db.focusSessions;
export const gratitudeRepo = db.gratitudeEntries;
export const settingsRepo = db.settings;
export const journalEntriesRepo = db.journalEntries;
export const journalPhotosRepo = db.journalPhotos;

// Helper to check database health with timeout
export const checkDatabaseHealth = async (): Promise<boolean> => {
  // First check if IndexedDB is available at all
  if (typeof indexedDB === 'undefined') {
    logger.warn('[DB] IndexedDB not available - using localStorage fallback');
    return true; // Allow app to continue with localStorage
  }

  try {
    // Add timeout to prevent hanging on IndexedDB issues
    // Increased from 3000ms to 5000ms to handle slow devices and cold starts
    const timeoutPromise = new Promise<boolean>((resolve) => {
      setTimeout(() => {
        logger.warn('[DB] Database health check timed out - continuing anyway');
        resolve(true); // Don't block app on timeout
      }, 5000);
    });

    const healthCheckPromise = (async () => {
      try {
        // Explicitly open the database first
        await db.open();
        // Then try a simple count operation
        await db.moods.count();
        return true;
      } catch (openError) {
        // If opening fails, try to delete and recreate
        logger.warn('[DB] Database open failed, attempting recovery:', openError);

        // P0 Fix: Emit event to notify UI about database recovery
        if (typeof window !== 'undefined') {
          window.dispatchEvent(new CustomEvent('zenflow:database-recovery-needed', {
            detail: {
              error: openError instanceof Error ? openError.message : 'Database open failed',
              timestamp: Date.now(),
            }
          }));
        }

        try {
          await db.delete();
          await db.open();
          return true;
        } catch (recoveryError) {
          logger.error('[DB] Database recovery failed:', recoveryError);
          // Emit critical error event
          if (typeof window !== 'undefined') {
            window.dispatchEvent(new CustomEvent('zenflow:database-recovery-failed', {
              detail: {
                error: recoveryError instanceof Error ? recoveryError.message : 'Recovery failed',
                timestamp: Date.now(),
              }
            }));
          }
          // Still return true to allow app to work with localStorage
          return true;
        }
      }
    })();

    return await Promise.race([healthCheckPromise, timeoutPromise]);
  } catch (error) {
    logger.error('[DB] Database health check failed:', error);
    // Return true to allow app to continue - it will use localStorage fallback
    return true;
  }
};

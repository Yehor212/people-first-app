import Dexie, { Table } from "dexie";
import { MoodEntry, Habit, FocusSession, GratitudeEntry } from "@/types";
import type {
  JournalAudio,
  JournalEntry,
  JournalEntryLink,
  JournalHubPreferences,
  JournalPhoto,
  JournalPracticeSession,
  JournalSpace,
  JournalSpaceCapture,
} from "@/features/journal/types";
import { logger } from "@/lib/logger";
import { SK } from "@/lib/storageKeys";
import { storageKeys, storageRemove } from "@/lib/safeJson";
import { isLocalOnlySettingKey } from "@/storage/sync/settingSyncPolicy";

/**
 * Offline queue action stored in IndexedDB
 * Move from localStorage to IndexedDB for better quota handling
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
  priority?: string;
}

/** Dead-letter item for actions that exhausted retries */
export interface DeadLetterItem {
  id: string;
  type: string;
  entityId: string;
  payload: unknown;
  lastError: string;
  failedAt: number;
}

// Определяем схему базы данных
export class ZenFlowDB extends Dexie {
  moods!: Table<MoodEntry, string>;
  habits!: Table<Habit, string>;
  focusSessions!: Table<FocusSession, string>;
  gratitudeEntries!: Table<GratitudeEntry, string>;
  settings!: Table<{ key: string; value: unknown }, string>;
  offlineQueue!: Table<OfflineQueueItem, string>;
  deadLetterQueue!: Table<DeadLetterItem, string>;
  journalEntries!: Table<JournalEntry, string>;
  journalPhotos!: Table<JournalPhoto, string>;
  journalAudio!: Table<JournalAudio, string>;
  journalHubPreferences!: Table<JournalHubPreferences, string>;
  journalSpaces!: Table<JournalSpace, string>;
  journalPracticeSessions!: Table<JournalPracticeSession, string>;
  journalEntryLinks!: Table<JournalEntryLink, string>;
  journalSpaceCaptures!: Table<JournalSpaceCapture, string>;

  constructor() {
    super("ZenFlowDB");

    // Version 1: Initial schema
    this.version(1).stores({
      moods: "id, timestamp",
      habits: "id, createdAt",
      focusSessions: "id, startTime",
      gratitudeEntries: "id, timestamp",
      settings: "key",
    });

    // Version 2: Add indexes for performance (no data migration needed)
    this.version(2).stores({
      moods: "id, timestamp, date",
      habits: "id, createdAt, type",
      focusSessions: "id, startTime, date",
      gratitudeEntries: "id, timestamp, date",
      settings: "key",
    });

    // Version 3: Add offline queue table for P0 fix
    // This moves offline queue from localStorage to IndexedDB
    // for better quota handling and reliability
    this.version(3).stores({
      moods: "id, timestamp, date",
      habits: "id, createdAt, type",
      focusSessions: "id, startTime, date",
      gratitudeEntries: "id, timestamp, date",
      settings: "key",
      offlineQueue: "id, type, entityId, timestamp",
    });

    // Version 4: Add journal/diary tables
    this.version(4).stores({
      moods: "id, timestamp, date",
      habits: "id, createdAt, type",
      focusSessions: "id, startTime, date",
      gratitudeEntries: "id, timestamp, date",
      settings: "key",
      offlineQueue: "id, type, entityId, timestamp",
      journalEntries: "id, date, createdAt, updatedAt",
      journalPhotos: "id, entryId, createdAt",
    });

    // Version 5: Add journal audio recordings table
    this.version(5).stores({
      moods: "id, timestamp, date",
      habits: "id, createdAt, type",
      focusSessions: "id, startTime, date",
      gratitudeEntries: "id, timestamp, date",
      settings: "key",
      offlineQueue: "id, type, entityId, timestamp",
      journalEntries: "id, date, createdAt, updatedAt",
      journalPhotos: "id, entryId, createdAt",
      journalAudio: "id, entryId, createdAt",
    });

    // Version 6: State of Mind — add valence index for mood entries
    // Supports multiple entries per day via valence-based mood tracking
    this.version(6).stores({
      moods: "id, timestamp, date, valence",
      habits: "id, createdAt, type",
      focusSessions: "id, startTime, date",
      gratitudeEntries: "id, timestamp, date",
      settings: "key",
      offlineQueue: "id, type, entityId, timestamp",
      journalEntries: "id, date, createdAt, updatedAt",
      journalPhotos: "id, entryId, createdAt",
      journalAudio: "id, entryId, createdAt",
    });

    // Version 7: Add updatedAt index for cross-device timestamp merge
    this.version(7).stores({
      moods: "id, timestamp, date, valence, updatedAt",
      habits: "id, createdAt, type",
      focusSessions: "id, startTime, date, updatedAt",
      gratitudeEntries: "id, timestamp, date, updatedAt",
      settings: "key",
      offlineQueue: "id, type, entityId, timestamp",
      journalEntries: "id, date, createdAt, updatedAt",
      journalPhotos: "id, entryId, createdAt",
      journalAudio: "id, entryId, createdAt",
    });

    // Version 8: Add dead-letter queue for exhausted offline actions (Phase 2)
    this.version(8).stores({
      moods: "id, timestamp, date, valence, updatedAt",
      habits: "id, createdAt, type",
      focusSessions: "id, startTime, date, updatedAt",
      gratitudeEntries: "id, timestamp, date, updatedAt",
      settings: "key",
      offlineQueue: "id, type, entityId, timestamp",
      deadLetterQueue: "id, type, entityId, failedAt",
      journalEntries: "id, date, createdAt, updatedAt",
      journalPhotos: "id, entryId, createdAt",
      journalAudio: "id, entryId, createdAt",
    });

    // Version 9: Journal V2 Hub local-first model
    this.version(9).stores({
      moods: "id, timestamp, date, valence, updatedAt",
      habits: "id, createdAt, type",
      focusSessions: "id, startTime, date, updatedAt",
      gratitudeEntries: "id, timestamp, date, updatedAt",
      settings: "key",
      offlineQueue: "id, type, entityId, timestamp",
      deadLetterQueue: "id, type, entityId, failedAt",
      journalEntries: "id, date, createdAt, updatedAt",
      journalPhotos: "id, entryId, createdAt",
      journalAudio: "id, entryId, createdAt",
      journalHubPreferences: "id, updatedAt",
      journalSpaces: "id, sortOrder, updatedAt",
      journalPracticeSessions: "id, practiceId, entryId, startedAt, completedAt",
      journalEntryLinks: "id, entryId, targetType, targetId, createdAt",
    });

    // Version 10: Local-first space capture cards for Journal V2 mobile workspaces
    this.version(10).stores({
      moods: "id, timestamp, date, valence, updatedAt",
      habits: "id, createdAt, type",
      focusSessions: "id, startTime, date, updatedAt",
      gratitudeEntries: "id, timestamp, date, updatedAt",
      settings: "key",
      offlineQueue: "id, type, entityId, timestamp",
      deadLetterQueue: "id, type, entityId, failedAt",
      journalEntries: "id, date, createdAt, updatedAt",
      journalPhotos: "id, entryId, createdAt",
      journalAudio: "id, entryId, createdAt",
      journalHubPreferences: "id, updatedAt",
      journalSpaces: "id, sortOrder, updatedAt",
      journalPracticeSessions: "id, practiceId, entryId, startedAt, completedAt",
      journalEntryLinks: "id, entryId, targetType, targetId, createdAt",
      journalSpaceCaptures: "id, spaceId, date, createdAt, updatedAt",
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
export const journalHubPreferencesRepo = db.journalHubPreferences;
export const journalSpacesRepo = db.journalSpaces;
export const journalPracticeSessionsRepo = db.journalPracticeSessions;
export const journalEntryLinksRepo = db.journalEntryLinks;
export const journalSpaceCapturesRepo = db.journalSpaceCaptures;

/**
 * User-specific settings keys stored in db.settings IndexedDB table.
 * These are cleared on sign-out. Device-level keys are NOT listed here:
 * zenflow-language-selected, zenflow-tutorial-complete, zenflow-onboarding-complete,
 * zenflow-google-auth-checked, zenflow-notification-permission-checked, zenflow-privacy
 */
const USER_SETTINGS_KEYS = [
  "zenflow-moods",
  "zenflow-habits",
  "zenflow-focus",
  "zenflow-gratitude",
  "zenflow-username",
  "zenflow-username-custom",
  "zenflow-reminders",
  "zenflow-schedule-events",
  "zenflow-special-badges",
  "zenflow-last-weekly-report",
  "zenflow-micro-reflections",
  "zenflow-canvas-goals",
  "zenflow-day-rituals",
  "zenflow-reflection-insights",
  "gamification",
];

const USER_BOUNDARY_LOCAL_ONLY_KEYS = [
  "sync-last-seq",
  "sync-cursor-v2",
  "zenflow-device-id",
  "zenflow-deleted-habit-ids",
  "zenflow-deleted-journal-entry-ids",
  "zenflow-deleted-mood-ids",
  "zenflow-deleted-focus-session-ids",
  "zenflow-deleted-gratitude-ids",
  SK.DEVICE_ID,
  SK.LAST_SYNC_SEQ,
  SK.SYNC_LEADER_LOCK,
  SK.JOURNAL_PASSWORD,
  SK.JOURNAL_BIOMETRIC,
  SK.JOURNAL_SCREENSHOT_BLOCK,
  SK.JOURNAL_PRIVATE_MODE,
  SK.JOURNAL_LOCK_TIMEOUT,
  SK.JOURNAL_PASSWORD_RESET,
];

interface ClearLocalUserDataOptions {
  /**
   * Clears per-account sync cursors, deletion tombstones, local journal locks,
   * and the stable sync device id. Keep enabled for sign-out/delete/reset flows.
   */
  includeUserBoundaryState?: boolean;
}

/**
 * Clear all user data from IndexedDB and localStorage.
 * Called on sign-out / delete-account to prevent data leakage between accounts.
 *
 * IMPORTANT: Call stopAutoSync() BEFORE this function to prevent
 * background sync from uploading empty data to cloud.
 */
export const clearLocalUserData = async (
  options: ClearLocalUserDataOptions = {}
): Promise<void> => {
  const { includeUserBoundaryState = true } = options;
  const settingsKeysToDelete = includeUserBoundaryState
    ? [...USER_SETTINGS_KEYS, ...USER_BOUNDARY_LOCAL_ONLY_KEYS]
    : USER_SETTINGS_KEYS;

  try {
    await db.transaction(
      "rw",
      [
        db.moods,
        db.habits,
        db.focusSessions,
        db.gratitudeEntries,
        db.journalEntries,
        db.journalPhotos,
        db.journalAudio,
        db.journalHubPreferences,
        db.journalSpaces,
        db.journalPracticeSessions,
        db.journalEntryLinks,
        db.journalSpaceCaptures,
        db.offlineQueue,
        db.deadLetterQueue,
        db.settings,
      ],
      async () => {
        const localOnlySettingKeys = includeUserBoundaryState
          ? (await db.settings.toCollection().primaryKeys()).filter(
              (key): key is string => typeof key === "string" && isLocalOnlySettingKey(key)
            )
          : [];

        await db.moods.clear();
        await db.habits.clear();
        await db.focusSessions.clear();
        await db.gratitudeEntries.clear();
        await db.journalEntries.clear();
        await db.journalPhotos.clear();
        await db.journalAudio.clear();
        await db.journalHubPreferences.clear();
        await db.journalSpaces.clear();
        await db.journalPracticeSessions.clear();
        await db.journalEntryLinks.clear();
        await db.journalSpaceCaptures.clear();
        await db.offlineQueue.clear();
        await db.deadLetterQueue.clear();
        // Delete account-bound settings and local-only sync state, including
        // dynamic unsaved diary draft keys that are intentionally not listed.
        await db.settings.bulkDelete([...new Set([...settingsKeysToDelete, ...localOnlySettingKeys])]);
      }
    );
  } catch (error) {
    logger.error("[DB] Failed to clear IndexedDB tables:", error);
    // Fallback: delete and recreate the entire database
    try {
      await db.delete();
      await db.open();
    } catch (fallbackError) {
      logger.error("[DB] Database recreation failed:", fallbackError);
    }
  }

  const dynamicLocalOnlyStorageKeys = includeUserBoundaryState
    ? storageKeys().filter(isLocalOnlySettingKey)
    : [];

  // Clear user-data localStorage keys (must match IndexedDB keys above)
  const allUserKeys = [
    ...USER_SETTINGS_KEYS,
    SK.CLOUD_SYNC_ENABLED, // Cloud sync preference (per-account)
    SK.OFFLINE_QUEUE, // Offline queue localStorage fallback
    ...(includeUserBoundaryState ? USER_BOUNDARY_LOCAL_ONLY_KEYS : []),
    ...dynamicLocalOnlyStorageKeys,
  ];
  allUserKeys.forEach((key) => storageRemove(key));
};

// Helper to check database health with timeout
export const checkDatabaseHealth = async (): Promise<boolean> => {
  // First check if IndexedDB is available at all
  if (typeof indexedDB === "undefined") {
    logger.warn("[DB] IndexedDB not available - using localStorage fallback");
    return true; // Allow app to continue with localStorage
  }

  try {
    // Add timeout to prevent hanging on IndexedDB issues
    // Increased from 3000ms to 5000ms to handle slow devices and cold starts
    let timeoutId: ReturnType<typeof setTimeout> | undefined;
    const timeoutPromise = new Promise<boolean>((resolve) => {
      timeoutId = setTimeout(() => {
        timeoutId = undefined;
        logger.warn("[DB] Database health check timed out - continuing anyway");
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
        logger.warn("[DB] Database open failed, attempting recovery:", openError);

        // Emit event to notify UI about database recovery
        if (typeof window !== "undefined") {
          window.dispatchEvent(
            new CustomEvent("zenflow:database-recovery-needed", {
              detail: {
                error: openError instanceof Error ? openError.message : "Database open failed",
                timestamp: Date.now(),
              },
            })
          );
        }

        try {
          await db.delete();
          await db.open();
          return true;
        } catch (recoveryError) {
          logger.error("[DB] Database recovery failed:", recoveryError);
          // Emit critical error event
          if (typeof window !== "undefined") {
            window.dispatchEvent(
              new CustomEvent("zenflow:database-recovery-failed", {
                detail: {
                  error: recoveryError instanceof Error ? recoveryError.message : "Recovery failed",
                  timestamp: Date.now(),
                },
              })
            );
          }
          // Still return true to allow app to work with localStorage
          return true;
        }
      }
    })();

    const result = await Promise.race([healthCheckPromise, timeoutPromise]);
    if (timeoutId !== undefined) {
      clearTimeout(timeoutId);
    }
    return result;
  } catch (error) {
    logger.error("[DB] Health check failed", error);
    return false;
  }
};

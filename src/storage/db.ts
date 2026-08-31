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
import { SK, SSK } from "@/lib/storageKeys";
import { storageKeys, storageRemove } from "@/lib/safeJson";
import { resetAccountBoundaryRuntimeState } from "@/storage/accountBoundaryRuntime";
import { isLocalOnlySettingKey } from "@/storage/sync/settingSyncPolicy";

/**
 * Offline queue action stored in IndexedDB
 * Move from localStorage to IndexedDB for better quota handling
 */
export interface OfflineQueueItem {
  id: string;
  /** Stable idempotency identity reused by every retry of this logical write. */
  operationId?: string;
  type: string;
  entityId: string;
  /** Account that created the action. Missing only on quarantined legacy rows. */
  ownerUserId?: string;
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
 * zenflow-language-selected, zenflow-onboarding-complete,
 * zenflow-google-auth-checked, zenflow-notification-permission-checked
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

/**
 * Account payloads kept outside the primary Dexie domain tables. These must
 * never survive a sign-out/account switch because several mounted runtimes
 * can otherwise upload them under the next active Supabase session.
 */
const USER_BOUNDARY_ACCOUNT_STORAGE_KEYS = [
  SK.TASKS,
  SK.TASK_MOMENTUM,
  SK.INNER_WORLD,
  SK.CHALLENGES,
  SK.LAST_STATE,
  SK.USER_BIRTH_DATE,
  SK.QUESTS,
  SK.OFFLINE_QUEUE,
  SK.MOOD_SLIDER_V2_LAST_COMMIT,
  SK.COMBO_STATE,
  SK.DAILY_LOGIN,
  SK.LOGIN_STREAK,
  SK.LAST_LOGIN,
  SK.SPIN_TOKENS,
  SK.MYSTERY_BOXES,
  SK.TIME_CHALLENGES,
  SK.ACTIVE_POWERUPS,
  SK.LEGACY_FEEDBACK_SETTINGS,
  SK.HOME_LAYOUT,
  SK.BADGES,
  SK.SPECIAL_BADGES,
  SK.DAILY_SURPRISE_SEEN,
  SK.LAST_SHOWN_STREAK,
  SK.TIMER_STATE,
  SK.JOURNAL_PASSWORD,
  SK.JOURNAL_VAULT_KEY,
  SK.JOURNAL_PASSWORD_COOLDOWN,
  SK.JOURNAL_BIOMETRIC,
  SK.JOURNAL_REMINDER,
  SK.JOURNAL_SCREENSHOT_BLOCK,
  SK.JOURNAL_PRIVATE_MODE,
  SK.JOURNAL_AI_SEARCH_CONSENT,
  SK.JOURNAL_LOCK_TIMEOUT,
  SK.JOURNAL_PASSWORD_RESET,
  SK.JOURNAL_PASSWORD_RESET_PROOF,
  SK.JOURNAL_CALENDAR_MODE,
  SK.JOURNAL_LEGEND_SEEN,
  SK.JOURNAL_RECENT_STICKERS,
  SK.JOURNAL_STICKER_PACKS,
  SK.JOURNAL_SIDEBAR_COLLAPSED,
  SK.JOURNAL_SIDEBAR_STATE,
  SK.JOURNAL_STREAK_FREEZES,
  SK.JOURNAL_OTD_DISMISSED,
  SK.JOURNAL_PENDING_ENTRY_DELETES,
  SK.HABIT_ORDER,
  SK.PENDING_FEEDBACK,
  SK.FEEDBACK,
  SK.ERROR_LOG,
  SK.CRASH_LOG,
  SK.INSIGHTS_LAST_GENERATED,
  SK.INSIGHTS_DISMISSED,
  SK.ONBOARDING_STATE,
  SK.AD_GRACE_STATE,
  SK.HABIT_SWIPE_HINT_SEEN,
  SK.DIARY_FORMAT_HINT_SEEN,
  SK.HABITS_EVER_CREATED,
  SK.FRIENDS,
  SK.MY_FRIEND_PROFILE,
  SK.FRIEND_ACTIVITIES,
  SK.CLOUD_SYNC_ENABLED,
  SK.COACH_HISTORY,
  SK.COACH_ONBOARDING,
  SK.LAST_ACTIVE_DATE,
  SK.WELCOME_BACK_SHOWN,
  SK.COMEBACK_CHALLENGE,
  SK.REVIEW_PROMPT,
  SK.WEEKLY_REPORT,
  SK.SEASONAL_PROGRESS,
  SK.CALENDAR_CACHE,
  SK.QUICK_ACTIONS_ENABLED,
  SK.WIDGET_DATA,
  SK.DISMISSED_URGENCY,
  SK.PRIVACY,
  SK.PROFILE_RECOVERY,
] as const;

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
  SK.DATA_OWNER_ID,
  SK.PUSH_INSTALL_ID,
  SK.PUSH_TOKEN,
  SK.LAST_SYNC_SEQ,
  SK.SYNC_LEADER_LOCK,
  SK.JOURNAL_PASSWORD,
  SK.JOURNAL_VAULT_KEY,
  SK.JOURNAL_BIOMETRIC,
  SK.JOURNAL_SCREENSHOT_BLOCK,
  SK.JOURNAL_PRIVATE_MODE,
  SK.JOURNAL_LOCK_TIMEOUT,
  SK.JOURNAL_PASSWORD_RESET,
  SK.JOURNAL_PASSWORD_RESET_PROOF,
  SK.JOURNAL_SECURITY_MIGRATION,
  SK.JOURNAL_SECURITY_REMOVAL,
  SK.JOURNAL_VAULT_REVISION,
  SK.JOURNAL_PENDING_ENTRY_DELETES,
];

const USER_BOUNDARY_SESSION_STORAGE_KEYS = [
  SSK.MOOD_ENTRY_DRAFT,
  SSK.SPOTIFY_TOKENS,
  SSK.SPOTIFY_PKCE_VERIFIER,
  SSK.DISMISSED_EVENTS,
  SSK.HABITS_SESSION_CREATED,
] as const;

interface ClearLocalUserDataOptions {
  /**
   * Clears per-account sync cursors, deletion tombstones, local journal locks,
   * and the stable sync device id. Keep enabled for sign-out/delete/reset flows.
   */
  includeUserBoundaryState?: boolean;
}

/**
 * Clear all user data from IndexedDB, browser storage, and mounted runtime state.
 * Called on sign-out / delete-account to prevent data leakage between accounts.
 *
 * IMPORTANT: Call stopAutoSync() BEFORE this function to prevent
 * background sync from uploading empty data to cloud.
 */
export const clearLocalUserData = async (
  options: ClearLocalUserDataOptions = {}
): Promise<void> => {
  const { includeUserBoundaryState = true } = options;
  const settingsKeysToDelete = [
    ...USER_SETTINGS_KEYS,
    ...USER_BOUNDARY_ACCOUNT_STORAGE_KEYS,
    ...(includeUserBoundaryState ? USER_BOUNDARY_LOCAL_ONLY_KEYS : []),
  ];

  let indexedDbCleanupFailed = false;
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
        await db.settings.bulkDelete([
          ...new Set([...settingsKeysToDelete, ...localOnlySettingKeys]),
        ]);
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
      indexedDbCleanupFailed = true;
    }
  }

  const dynamicLocalOnlyStorageKeys = includeUserBoundaryState
    ? storageKeys().filter(
        (key) =>
          isLocalOnlySettingKey(key) &&
          (!indexedDbCleanupFailed || key !== SK.PENDING_LOCAL_BACKUP_ACCOUNT_CLAIM)
      )
    : [];

  // Clear user-data localStorage keys (must match IndexedDB keys above)
  const allUserKeys = [
    ...USER_SETTINGS_KEYS,
    ...USER_BOUNDARY_ACCOUNT_STORAGE_KEYS,
    ...(includeUserBoundaryState ? USER_BOUNDARY_LOCAL_ONLY_KEYS : []),
    ...(includeUserBoundaryState && !indexedDbCleanupFailed
      ? [SK.PENDING_LOCAL_BACKUP_ACCOUNT_CLAIM]
      : []),
    ...dynamicLocalOnlyStorageKeys,
  ];
  let browserStorageCleanupFailed = false;
  for (const key of new Set(allUserKeys)) {
    if (storageRemove(key) === false) {
      browserStorageCleanupFailed = true;
    }
  }

  if (typeof window !== "undefined") {
    for (const key of USER_BOUNDARY_SESSION_STORAGE_KEYS) {
      try {
        window.sessionStorage.removeItem(key);
      } catch (error) {
        logger.error("[DB] Failed to clear account-bound session storage:", { key, error });
        browserStorageCleanupFailed = true;
      }
    }
  }

  let runtimeCleanupFailed = false;
  try {
    resetAccountBoundaryRuntimeState();
  } catch (error) {
    logger.error("[DB] Failed to clear mounted account state:", error);
    runtimeCleanupFailed = true;
  }

  if (indexedDbCleanupFailed || browserStorageCleanupFailed || runtimeCleanupFailed) {
    throw new Error("Unable to clear data on this device");
  }
};

export const getLocalDataOwnerId = async (): Promise<string | null> => {
  const owner = await db.settings.get(SK.DATA_OWNER_ID);
  return typeof owner?.value === "string" && owner.value.trim().length > 0 ? owner.value : null;
};

export const setLocalDataOwnerId = async (userId: string): Promise<void> => {
  if (!userId.trim()) {
    throw new Error("Cannot bind local data to an empty account id");
  }
  await db.settings.put({ key: SK.DATA_OWNER_ID, value: userId });
};

export const clearLocalDataOwnerId = async (): Promise<void> => {
  await db.settings.delete(SK.DATA_OWNER_ID);
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
        // A health probe cannot distinguish corruption from transient quota,
        // version, blocked-tab, or WebView failures. Preserve local data and
        // let the recovery UI offer a retry instead of deleting the database.
        logger.warn("[DB] Database health check failed; preserving local data:", openError);

        // Emit event to notify UI about database recovery
        if (typeof window !== "undefined") {
          window.dispatchEvent(
            new CustomEvent("zenflow:database-recovery-needed", {
              detail: {
                error: openError instanceof Error ? openError.message : "Database open failed",
                timestamp: Date.now(),
                destructiveActionTaken: false,
              },
            })
          );
        }
        return false;
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

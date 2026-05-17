/**
 * Offline Queue Handlers
 *
 * Registers handlers for offline queue actions.
 * Each handler knows how to sync a specific type of action to the cloud.
 */

import { offlineQueue, type OfflineAction } from "./offlineQueue";
import { syncMood, deleteMoodFromCloud } from "@/storage/realtimeSync";
import { syncHabit, deleteHabitFromCloud, syncHabitCompletion } from "@/storage/realtimeSync";
import { syncFocusSession } from "@/storage/realtimeSync";
import { syncGratitude, deleteGratitudeFromCloud } from "@/storage/realtimeSync";
import { syncJournalEntry, deleteJournalEntryFromCloud, syncSetting } from "@/storage/realtimeSync";
import { logger } from "./logger";
import {
  isSyncEventWriteIntent,
  normalizeSyncEventWriteIntent,
  writeQueuedEventAndBroadcast,
} from "@/storage/eventSync";
import { MoodEntry, Habit, FocusSession, GratitudeEntry } from "@/types";
import type { JournalEntry } from "@/features/journal/types";
import {
  moodEntrySchema,
  habitSchema,
  focusSessionSchema,
  gratitudeEntrySchema,
  safeValidate,
} from "./validation";

// Use Zod schemas for robust payload validation
// This validates field types, value constraints, and prevents corrupted data from syncing

function isValidMoodEntry(payload: unknown): payload is MoodEntry {
  // Use Zod schema for comprehensive validation
  const validated = safeValidate(moodEntrySchema, payload);
  return validated !== null;
}

function isValidHabit(payload: unknown): payload is Habit {
  // Use Zod schema for comprehensive validation
  const validated = safeValidate(habitSchema, payload);
  return validated !== null;
}

function isValidFocusSession(payload: unknown): payload is FocusSession {
  // Use Zod schema for comprehensive validation
  const validated = safeValidate(focusSessionSchema, payload);
  return validated !== null;
}

function isValidGratitudeEntry(payload: unknown): payload is GratitudeEntry {
  // Use Zod schema for comprehensive validation
  const validated = safeValidate(gratitudeEntrySchema, payload);
  return validated !== null;
}

/**
 * Initialize all offline queue handlers
 * Call this once when the app starts
 */
export function initializeOfflineQueueHandlers(): void {
  logger.log("[OfflineQueue] Initializing handlers...");

  // Mood handlers
  // Validate payload before processing
  offlineQueue.registerHandler("CREATE_MOOD", async (action: OfflineAction) => {
    if (!isValidMoodEntry(action.payload)) {
      logger.warn("[OfflineQueue] Invalid mood payload, skipping:", action.entityId);
      return;
    }
    await syncMood(action.payload);
  });

  offlineQueue.registerHandler("UPDATE_MOOD", async (action: OfflineAction) => {
    if (!isValidMoodEntry(action.payload)) {
      logger.warn("[OfflineQueue] Invalid mood payload, skipping:", action.entityId);
      return;
    }
    await syncMood(action.payload);
  });

  offlineQueue.registerHandler("DELETE_MOOD", async (action: OfflineAction) => {
    await deleteMoodFromCloud(action.entityId);
  });

  // Habit handlers
  // Validate payload before processing
  offlineQueue.registerHandler("CREATE_HABIT", async (action: OfflineAction) => {
    if (!isValidHabit(action.payload)) {
      logger.warn("[OfflineQueue] Invalid habit payload, skipping:", action.entityId);
      return;
    }
    await syncHabit(action.payload);
  });

  offlineQueue.registerHandler("UPDATE_HABIT", async (action: OfflineAction) => {
    if (!isValidHabit(action.payload)) {
      logger.warn("[OfflineQueue] Invalid habit payload, skipping:", action.entityId);
      return;
    }
    await syncHabit(action.payload);
  });

  offlineQueue.registerHandler("DELETE_HABIT", async (action: OfflineAction) => {
    await deleteHabitFromCloud(action.entityId);
  });

  offlineQueue.registerHandler("TOGGLE_HABIT", async (action: OfflineAction) => {
    const p = action.payload as {
      habitId?: string;
      date?: string;
      completed?: boolean;
      count?: number;
      duration?: number;
      habitType?: "boolean" | "numerical";
      targetType?: "atLeast" | "atMost";
      entryValue?: number;
    } | null;
    if (!p || typeof p.habitId !== "string" || typeof p.date !== "string") {
      logger.warn("[OfflineQueue] Invalid habit completion payload, skipping:", action.entityId);
      return;
    }
    await syncHabitCompletion(p.habitId, p.date, p.completed ?? false, p.count, p.duration, {
      habitType: p.habitType,
      targetType: p.targetType,
      entryValue: p.entryValue,
    });
  });

  // Focus session handler
  // Validate payload before processing
  offlineQueue.registerHandler("CREATE_FOCUS_SESSION", async (action: OfflineAction) => {
    if (!isValidFocusSession(action.payload)) {
      logger.warn("[OfflineQueue] Invalid focus session payload, skipping:", action.entityId);
      return;
    }
    await syncFocusSession(action.payload);
  });

  // Gratitude handlers
  // Validate payload before processing
  offlineQueue.registerHandler("CREATE_GRATITUDE", async (action: OfflineAction) => {
    if (!isValidGratitudeEntry(action.payload)) {
      logger.warn("[OfflineQueue] Invalid gratitude payload, skipping:", action.entityId);
      return;
    }
    await syncGratitude(action.payload);
  });

  offlineQueue.registerHandler("DELETE_GRATITUDE", async (action: OfflineAction) => {
    await deleteGratitudeFromCloud(action.entityId);
  });

  // Settings handler — sync individual setting to cloud
  offlineQueue.registerHandler("UPDATE_SETTINGS", async (action: OfflineAction) => {
    const payload = action.payload as { key?: string; value?: unknown } | null;
    if (!payload || typeof payload.key !== "string") {
      logger.warn("[OfflineQueue] Invalid settings payload, skipping:", action.entityId);
      return;
    }
    await syncSetting(payload.key, payload.value);
  });

  // Journal handlers
  offlineQueue.registerHandler("SYNC_JOURNAL_ENTRY", async (action: OfflineAction) => {
    const entry = action.payload as JournalEntry;
    if (!entry || typeof entry.id !== "string" || typeof entry.date !== "string") {
      logger.warn("[OfflineQueue] Invalid journal entry payload, skipping:", action.entityId);
      return;
    }
    await syncJournalEntry(entry);
  });

  offlineQueue.registerHandler("DELETE_JOURNAL_ENTRY", async (action: OfflineAction) => {
    await deleteJournalEntryFromCloud(action.entityId);
  });

  // Durable event-log outbox.
  // If the domain row was already saved but sync_events failed transiently,
  // retry the ordered event before waking other clients.
  offlineQueue.registerHandler("WRITE_SYNC_EVENT", async (action: OfflineAction) => {
    if (!isSyncEventWriteIntent(action.payload)) {
      logger.warn("[OfflineQueue] Invalid sync event payload, skipping:", action.entityId);
      return;
    }
    const intent = normalizeSyncEventWriteIntent(action.payload);
    action.payload = intent;
    await writeQueuedEventAndBroadcast(intent);
  });

  logger.log("[OfflineQueue] Handlers initialized");

  // Process any pending actions from previous session
  if (navigator.onLine) {
    void offlineQueue.processQueue();
  }
}

/**
 * Helper to queue a mood action with offline support
 */
export const queueMoodSync = async (
  action: "CREATE_MOOD" | "UPDATE_MOOD" | "DELETE_MOOD",
  mood: MoodEntry
): Promise<void> => {
  await offlineQueue.enqueue(action, mood.id, mood);
};

/**
 * Helper to queue a habit action with offline support
 */
export const queueHabitSync = async (
  action: "CREATE_HABIT" | "UPDATE_HABIT" | "DELETE_HABIT" | "TOGGLE_HABIT",
  habit: Habit
): Promise<void> => {
  await offlineQueue.enqueue(action, habit.id, habit);
};

/**
 * Helper to queue a focus session with offline support
 */
export const queueFocusSessionSync = async (session: FocusSession): Promise<void> => {
  await offlineQueue.enqueue("CREATE_FOCUS_SESSION", session.id, session);
};

/**
 * Helper to queue a gratitude entry with offline support
 */
export const queueGratitudeSync = async (
  action: "CREATE_GRATITUDE" | "DELETE_GRATITUDE",
  entry: GratitudeEntry
): Promise<void> => {
  await offlineQueue.enqueue(action, entry.id, entry);
};

export default initializeOfflineQueueHandlers;

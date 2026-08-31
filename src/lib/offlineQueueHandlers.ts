/**
 * Offline Queue Handlers
 *
 * Registers handlers for offline queue actions.
 * Each handler knows how to sync a specific type of action to the cloud.
 */

import {
  offlineQueue,
  type OfflineQueueHandlerContext,
  type OfflineQueueHandlerResult,
} from "./offlineQueue";
import { syncMood, deleteMoodFromCloud } from "@/storage/realtimeSync";
import { syncHabit, deleteHabitFromCloud, syncHabitCompletion } from "@/storage/realtimeSync";
import { syncFocusSession } from "@/storage/realtimeSync";
import { syncGratitude, deleteGratitudeFromCloud } from "@/storage/realtimeSync";
import {
  syncJournalEntry,
  deleteJournalEntryFromCloud,
  syncSetting,
  deleteSettingFromCloud,
} from "@/storage/realtimeSync";
import { logger } from "./logger";
import {
  retryJournalPhotoUpload,
  retryJournalAudioUpload,
  retryJournalPhotoDelete,
  retryJournalAudioDelete,
} from "@/features/journal/journalStorage";
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
import { getCurrentSessionUserId } from "./supabaseClient";
import { SyncOwnerBoundaryError } from "@/storage/sync/syncOwner";
import { runJournalSecurityMigration } from "@/features/journal/journalSecurityMigration";
import {
  automationPreferenceRevocationIntentSchema,
  flushAutomationPreferenceRevocation,
} from "@/features/automation/automationPreferences";
import { processQueuedAutomationCommit } from "@/features/automation/automationRepository";
import { processQueuedAutomationUndo } from "@/features/automation/automationUndo";
import {
  automationCommitQueueIntentSchema,
  automationUndoQueueIntentSchema,
} from "@/features/automation/types";

class OfflineQueuePayloadValidationError extends Error {
  constructor(actionType: string) {
    super(`Invalid payload for offline action: ${actionType}`);
    this.name = "OfflineQueuePayloadValidationError";
  }
}

const COMMITTED: OfflineQueueHandlerResult = Object.freeze({ status: "committed" });

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

async function runOwnerBoundCloudMutation<T>(
  context: OfflineQueueHandlerContext,
  operation: () => Promise<T>
): Promise<T> {
  try {
    return await context.runIfOwnerCurrent(operation);
  } catch (error) {
    if (error instanceof SyncOwnerBoundaryError) {
      // Convert the helper's verified owner mismatch into the queue's own
      // boundary signal. The queue then pauses without acknowledging or
      // consuming this account's retry budget.
      await context.runIfOwnerCurrent(() => undefined);
    }
    throw error;
  }
}

/**
 * Initialize all offline queue handlers
 * Call this once when the app starts
 */
export function initializeOfflineQueueHandlers(): void {
  logger.log("[OfflineQueue] Initializing handlers...");

  // Mood handlers
  // Validate payload before processing
  offlineQueue.registerHandler("CREATE_MOOD", async (action, context) => {
    if (!isValidMoodEntry(action.payload)) {
      logger.warn("[OfflineQueue] Invalid mood payload, keeping row blocked");
      throw new OfflineQueuePayloadValidationError(action.type);
    }
    const mood = action.payload;
    await runOwnerBoundCloudMutation(context, () =>
      syncMood(mood, context.ownerUserId, context.operationId)
    );
    return COMMITTED;
  });

  offlineQueue.registerHandler("UPDATE_MOOD", async (action, context) => {
    if (!isValidMoodEntry(action.payload)) {
      logger.warn("[OfflineQueue] Invalid mood payload, keeping row blocked");
      throw new OfflineQueuePayloadValidationError(action.type);
    }
    const mood = action.payload;
    await runOwnerBoundCloudMutation(context, () =>
      syncMood(mood, context.ownerUserId, context.operationId)
    );
    return COMMITTED;
  });

  offlineQueue.registerHandler("DELETE_MOOD", async (action, context) => {
    await runOwnerBoundCloudMutation(context, () =>
      deleteMoodFromCloud(action.entityId, context.ownerUserId, context.operationId)
    );
    return COMMITTED;
  });

  // Habit handlers
  // Validate payload before processing
  offlineQueue.registerHandler("CREATE_HABIT", async (action, context) => {
    if (!isValidHabit(action.payload)) {
      logger.warn("[OfflineQueue] Invalid habit payload, keeping row blocked");
      throw new OfflineQueuePayloadValidationError(action.type);
    }
    const habit = action.payload;
    await runOwnerBoundCloudMutation(context, () =>
      syncHabit(habit, context.ownerUserId, context.operationId)
    );
    return COMMITTED;
  });

  offlineQueue.registerHandler("UPDATE_HABIT", async (action, context) => {
    if (!isValidHabit(action.payload)) {
      logger.warn("[OfflineQueue] Invalid habit payload, keeping row blocked");
      throw new OfflineQueuePayloadValidationError(action.type);
    }
    const habit = action.payload;
    await runOwnerBoundCloudMutation(context, () =>
      syncHabit(habit, context.ownerUserId, context.operationId)
    );
    return COMMITTED;
  });

  offlineQueue.registerHandler("DELETE_HABIT", async (action, context) => {
    await runOwnerBoundCloudMutation(context, () =>
      deleteHabitFromCloud(action.entityId, context.ownerUserId, context.operationId)
    );
    return COMMITTED;
  });

  offlineQueue.registerHandler("TOGGLE_HABIT", async (action, context) => {
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
      logger.warn("[OfflineQueue] Invalid habit completion payload, keeping row blocked");
      throw new OfflineQueuePayloadValidationError(action.type);
    }
    await runOwnerBoundCloudMutation(context, () =>
      syncHabitCompletion(
        p.habitId!,
        p.date!,
        p.completed ?? false,
        p.count,
        p.duration,
        {
          habitType: p.habitType,
          targetType: p.targetType,
          entryValue: p.entryValue,
        },
        context.ownerUserId,
        context.operationId
      )
    );
    return COMMITTED;
  });

  // Focus session handler
  // Validate payload before processing
  offlineQueue.registerHandler("CREATE_FOCUS_SESSION", async (action, context) => {
    if (!isValidFocusSession(action.payload)) {
      logger.warn("[OfflineQueue] Invalid focus session payload, keeping row blocked");
      throw new OfflineQueuePayloadValidationError(action.type);
    }
    const session = action.payload;
    await runOwnerBoundCloudMutation(context, () =>
      syncFocusSession(session, context.ownerUserId, context.operationId)
    );
    return COMMITTED;
  });

  // Gratitude handlers
  // Validate payload before processing
  offlineQueue.registerHandler("CREATE_GRATITUDE", async (action, context) => {
    if (!isValidGratitudeEntry(action.payload)) {
      logger.warn("[OfflineQueue] Invalid gratitude payload, keeping row blocked");
      throw new OfflineQueuePayloadValidationError(action.type);
    }
    const entry = action.payload;
    await runOwnerBoundCloudMutation(context, () =>
      syncGratitude(entry, context.ownerUserId, context.operationId)
    );
    return COMMITTED;
  });

  offlineQueue.registerHandler("DELETE_GRATITUDE", async (action, context) => {
    await runOwnerBoundCloudMutation(context, () =>
      deleteGratitudeFromCloud(action.entityId, context.ownerUserId, context.operationId)
    );
    return COMMITTED;
  });

  // Settings handler — sync individual setting to cloud
  offlineQueue.registerHandler("UPDATE_SETTINGS", async (action, context) => {
    const payload = action.payload as { key?: string; value?: unknown; updatedAt?: string } | null;
    if (!payload || typeof payload.key !== "string") {
      logger.warn("[OfflineQueue] Invalid settings payload, keeping row blocked");
      throw new OfflineQueuePayloadValidationError(action.type);
    }
    await runOwnerBoundCloudMutation(context, () =>
      syncSetting(payload.key!, payload.value, context.ownerUserId, {
        requireRemoteCommit: true,
        eventIdempotencyKey: context.operationId,
        ...(typeof payload.updatedAt === "string" ? { updatedAt: payload.updatedAt } : {}),
      })
    );
    return COMMITTED;
  });

  offlineQueue.registerHandler("DELETE_SETTINGS", async (action, context) => {
    const payload = action.payload as { key?: string } | null;
    const key = typeof payload?.key === "string" ? payload.key : action.entityId;
    if (!key) {
      logger.warn("[OfflineQueue] Invalid settings delete payload, keeping row blocked");
      throw new OfflineQueuePayloadValidationError(action.type);
    }
    await runOwnerBoundCloudMutation(context, () =>
      deleteSettingFromCloud(key, context.ownerUserId, {
        queueOnNetworkError: false,
        requireRemoteCommit: true,
        eventIdempotencyKey: context.operationId,
      })
    );
    return COMMITTED;
  });

  offlineQueue.registerHandler("REVOKE_AUTOMATION_PREFERENCE", async (action, context) => {
    const parsed = automationPreferenceRevocationIntentSchema.safeParse(action.payload);
    if (!parsed.success) {
      logger.warn("[OfflineQueue] Invalid connected-record revocation payload, keeping row blocked");
      throw new OfflineQueuePayloadValidationError(action.type);
    }
    await runOwnerBoundCloudMutation(context, async () => {
      await flushAutomationPreferenceRevocation(parsed.data, context.ownerUserId);
    });
    return COMMITTED;
  });

  offlineQueue.registerHandler("COMMIT_AUTOMATION_TRANSACTION", async (action, context) => {
    const parsed = automationCommitQueueIntentSchema.safeParse(action.payload);
    if (!parsed.success || parsed.data.transactionId !== action.entityId) {
      throw new OfflineQueuePayloadValidationError(action.type);
    }
    const outcome = await runOwnerBoundCloudMutation(context, () =>
      processQueuedAutomationCommit(parsed.data, context.ownerUserId),
    );
    return outcome.status === "committed"
      ? COMMITTED
      : { status: "obsolete", reason: outcome.reason };
  });

  offlineQueue.registerHandler("UNDO_AUTOMATION_TRANSACTION", async (action, context) => {
    const parsed = automationUndoQueueIntentSchema.safeParse(action.payload);
    if (
      !parsed.success ||
      parsed.data.transactionId !== action.entityId ||
      parsed.data.operationId !== context.operationId
    ) {
      throw new OfflineQueuePayloadValidationError(action.type);
    }
    const outcome = await runOwnerBoundCloudMutation(context, () =>
      processQueuedAutomationUndo(parsed.data, context.ownerUserId),
    );
    return outcome.status === "committed"
      ? COMMITTED
      : { status: "obsolete", reason: outcome.reason };
  });

  // Journal handlers
  offlineQueue.registerHandler("SYNC_JOURNAL_ENTRY", async (action, context) => {
    const entry = action.payload as JournalEntry;
    if (!entry || typeof entry.id !== "string" || typeof entry.date !== "string") {
      logger.warn("[OfflineQueue] Invalid journal entry payload, keeping row blocked");
      throw new OfflineQueuePayloadValidationError(action.type);
    }
    await runOwnerBoundCloudMutation(context, () =>
      syncJournalEntry(entry, context.ownerUserId, context.signal, context.operationId)
    );
    return COMMITTED;
  });

  offlineQueue.registerHandler("DELETE_JOURNAL_ENTRY", async (action, context) => {
    await runOwnerBoundCloudMutation(context, () =>
      deleteJournalEntryFromCloud(
        action.entityId,
        context.ownerUserId,
        context.signal,
        context.operationId
      )
    );
    return COMMITTED;
  });

  offlineQueue.registerHandler("UPLOAD_JOURNAL_PHOTO_STORAGE", async (action, context) => {
    await runOwnerBoundCloudMutation(context, () =>
      retryJournalPhotoUpload(
        action.payload ?? { id: action.entityId },
        context.ownerUserId,
        context.signal,
      )
    );
    return COMMITTED;
  });

  offlineQueue.registerHandler("UPLOAD_JOURNAL_AUDIO_STORAGE", async (action, context) => {
    await runOwnerBoundCloudMutation(context, () =>
      retryJournalAudioUpload(
        action.payload ?? { id: action.entityId },
        context.ownerUserId,
        context.signal,
      )
    );
    return COMMITTED;
  });

  offlineQueue.registerHandler("DELETE_JOURNAL_PHOTO_STORAGE", async (action, context) => {
    await runOwnerBoundCloudMutation(context, () =>
      retryJournalPhotoDelete(
        action.payload ?? { id: action.entityId },
        context.ownerUserId,
        context.signal,
      )
    );
    return COMMITTED;
  });

  offlineQueue.registerHandler("DELETE_JOURNAL_AUDIO_STORAGE", async (action, context) => {
    await runOwnerBoundCloudMutation(context, () =>
      retryJournalAudioDelete(
        action.payload ?? { id: action.entityId },
        context.ownerUserId,
        context.signal,
      )
    );
    return COMMITTED;
  });

  offlineQueue.registerHandler("MIGRATE_JOURNAL_SECURITY", async (action, context) => {
    await runOwnerBoundCloudMutation(context, () =>
      runJournalSecurityMigration(action.payload, context.ownerUserId)
    );
    return COMMITTED;
  });

  // Durable event-log outbox.
  // If the domain row was already saved but sync_events failed transiently,
  // retry the ordered event before waking other clients.
  offlineQueue.registerHandler("WRITE_SYNC_EVENT", async (action, context) => {
    if (!isSyncEventWriteIntent(action.payload)) {
      logger.warn("[OfflineQueue] Invalid sync event payload; keeping critical row blocked");
      throw new OfflineQueuePayloadValidationError(action.type);
    }
    const intent = normalizeSyncEventWriteIntent(action.payload, context.operationId);
    action.payload = intent;
    await context.runIfOwnerCurrent(() =>
      writeQueuedEventAndBroadcast(intent, context.ownerUserId)
    );
    return COMMITTED;
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
  const expectedOwnerUserId = await requireCurrentQueueOwner();
  await offlineQueue.enqueue(action, mood.id, mood, { expectedOwnerUserId });
};

/**
 * Helper to queue a habit action with offline support
 */
export const queueHabitSync = async (
  action: "CREATE_HABIT" | "UPDATE_HABIT" | "DELETE_HABIT" | "TOGGLE_HABIT",
  habit: Habit
): Promise<void> => {
  const expectedOwnerUserId = await requireCurrentQueueOwner();
  await offlineQueue.enqueue(action, habit.id, habit, { expectedOwnerUserId });
};

/**
 * Helper to queue a focus session with offline support
 */
export const queueFocusSessionSync = async (session: FocusSession): Promise<void> => {
  const expectedOwnerUserId = await requireCurrentQueueOwner();
  await offlineQueue.enqueue("CREATE_FOCUS_SESSION", session.id, session, {
    expectedOwnerUserId,
  });
};

/**
 * Helper to queue a gratitude entry with offline support
 */
export const queueGratitudeSync = async (
  action: "CREATE_GRATITUDE" | "DELETE_GRATITUDE",
  entry: GratitudeEntry
): Promise<void> => {
  const expectedOwnerUserId = await requireCurrentQueueOwner();
  await offlineQueue.enqueue(action, entry.id, entry, { expectedOwnerUserId });
};

async function requireCurrentQueueOwner(): Promise<string> {
  const expectedOwnerUserId = await getCurrentSessionUserId();
  if (!expectedOwnerUserId) {
    throw new Error("Sign in before queuing changes for sync");
  }
  return expectedOwnerUserId;
}

export default initializeOfflineQueueHandlers;

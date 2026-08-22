/**
 * Habit sync operations — push, delete, and completion sync.
 * Extracted from realtimeSync.ts for modularity.
 */

import { logger } from "@/lib/logger";
import { writeEventAndBroadcast, getPersistentDeviceId } from "@/storage/eventSync";
import { getDeletedHabitIds, trackDeletedHabitId } from "@/storage/deletionTracker";
import { isAbortError, isValidUUID } from "@/lib/validation";
import { supabase } from "@/lib/supabaseClient";
import { ENTRY, type Habit, type LoopHabitType, type TargetType } from "@/types";
import { offlineQueue } from "@/lib/offlineQueue";
import { getHabitPlanState } from "@/lib/habitPlan";
import { normalizeHabitSchedule } from "@/lib/habitScheduling";
import { doesNumericalStoredValueMeetTarget } from "@/lib/habits";
import { isEntityTombstonedOnServer } from "./serverTombstones";
import {
  encodeHabitCompletionForCloud,
  getCloudHabitCompletionSemanticFieldsForSync,
  getCloudHabitTypeForSync,
  isHabitEntrySyncableToCloud,
} from "./habitCompletionCodec";
import { validateSyncOwner } from "./syncOwner";
import { commitManualSyncEvent } from "./manualSyncAcceptance";

// ============================================
// HABIT SYNC
// ============================================

export const syncHabit = async (
  habit: Habit,
  expectedOwnerUserId?: string,
  eventIdempotencyKey?: string
): Promise<void> => {
  const userId = await validateSyncOwner(expectedOwnerUserId, "Habit sync");
  // Explicit validation to prevent RLS violations with undefined user_id
  if (!supabase) {
    if (eventIdempotencyKey) throw new Error("Habit remote sync is unavailable");
    return;
  }
  if (!userId) {
    logger.warn("[Sync] Cannot sync habit: User not authenticated");
    return;
  }

  const deletedHabitIds = await getDeletedHabitIds();
  if (deletedHabitIds.has(habit.id)) {
    logger.warn("[Sync] Skipping tombstoned habit upsert");
    return;
  }

  // Skip granular sync for non-UUID IDs (nanoid) — data is persisted via JSONB backup
  if (!isValidUUID(habit.id)) {
    logger.log("[Sync] Skipping granular habit sync for a legacy identifier");
    return;
  }

  // If offline, queue for later sync
  if (!navigator.onLine) {
    if (eventIdempotencyKey) {
      throw new DOMException("Habit delivery paused while offline", "AbortError");
    }
    await offlineQueue.enqueue("UPDATE_HABIT", habit.id, habit, {
      expectedOwnerUserId: userId,
    });
    logger.log("[Sync] Habit queued for offline sync");
    return;
  }

  if (await isEntityTombstonedOnServer("habit", habit.id, userId)) {
    await trackDeletedHabitId(habit.id);
    logger.warn("[Sync] Skipping server-tombstoned habit upsert");
    return;
  }

  try {
    // Sync habit metadata (map new local model → old cloud schema)
    const freq = habit.frequency || { numerator: 1, denominator: 1 };
    const cloudFrequency = freq.denominator === 1 ? "daily" : "weekly";
    const cloudType = getCloudHabitTypeForSync({
      habitType: habit.habitType,
      targetType: habit.targetType,
    });
    const planState = getHabitPlanState(habit);
    const schedule = normalizeHabitSchedule(habit);
    const updatedAt = habit.updatedAt || new Date().toISOString();

    if (!(await validateSyncOwner(userId, "Habit sync"))) return;
    const { error: habitError } = await supabase.from("habits").upsert(
      {
        id: habit.id,
        user_id: userId,
        name: habit.name,
        icon: habit.icon,
        color: typeof habit.color === "number" ? String(habit.color) : habit.color,
        type: cloudType,
        frequency: cloudFrequency,
        custom_days: schedule.mode === "specificDays" ? schedule.dueDays || [] : [],
        requires_duration: Boolean(planState),
        target_duration: planState?.durationDays ?? null,
        start_date: planState?.startDate ?? null,
        daily_target: habit.targetValue ?? 1,
        target_count: habit.targetValue ?? null,
        template_id: habit.templateId || null,
        is_archived: Boolean(habit.isArchived),
        updated_at: updatedAt,
      },
      { onConflict: "id" }
    );

    if (habitError) throw habitError;

    // Sync entries as completions (map entries → habit_completions rows)
    const entries = habit.entries || {};
    const syncableDates = Object.entries(entries)
      .filter(([, e]) =>
        isHabitEntrySyncableToCloud({
          habitType: habit.habitType,
          targetType: habit.targetType,
          entryValue: e.value,
        })
      )
      .map(([date]) => date);

    if (syncableDates.length > 0) {
      const completions = syncableDates.map((date) => {
        const entryValue = entries[date]?.value ?? 0;
        const isComplete =
          habit.habitType === "numerical"
            ? doesNumericalStoredValueMeetTarget(habit, entryValue)
            : entryValue === ENTRY.YES_MANUAL;
        const { count, duration } = encodeHabitCompletionForCloud({
          habitType: habit.habitType,
          entryValue,
        });
        return {
          user_id: userId,
          habit_id: habit.id,
          date,
          count,
          duration,
          ...getCloudHabitCompletionSemanticFieldsForSync({
            habitType: habit.habitType,
            targetType: habit.targetType,
            entryValue,
            isComplete,
          }),
        };
      });

      if (!(await validateSyncOwner(userId, "Habit completion batch sync"))) return;
      const { error: completionError } = await supabase
        .from("habit_completions")
        .upsert(completions, { onConflict: "habit_id,date" });

      if (completionError) throw completionError;
    }

    // Sync reminders - use safe insert-then-delete pattern to prevent data loss
    if (habit.reminders && habit.reminders.length > 0) {
      // Generate deterministic IDs based on habit + time + days
      const generateReminderId = (habitId: string, time: string, days: number[]) =>
        `${habitId}-${time}-${days.sort().join("")}`;

      const reminders = habit.reminders.map((r) => ({
        id: generateReminderId(habit.id, r.time, r.days),
        user_id: userId,
        habit_id: habit.id,
        enabled: r.enabled,
        time: r.time,
        days: r.days,
      }));

      // Upsert reminders (safe - won't lose data on failure)
      if (!(await validateSyncOwner(userId, "Habit reminder sync"))) return;
      const { error: reminderError } = await supabase
        .from("habit_reminders")
        .upsert(reminders, { onConflict: "id" });

      if (reminderError) throw reminderError;

      // Clean up orphan reminders (non-critical - duplicates are better than data loss)
      // Security fix: sanitize IDs to prevent PostgREST filter injection
      const currentIds = reminders.map((r) => r.id.replace(/[^a-zA-Z0-9\-_]/g, ""));
      const filterTuple = `(${currentIds.map((id) => `"${id}"`).join(",")})`;
      if (!(await validateSyncOwner(userId, "Habit reminder cleanup"))) return;
      const { error: cleanupError } = await supabase
        .from("habit_reminders")
        .delete()
        .eq("habit_id", habit.id)
        .not("id", "in", filterTuple);

      if (cleanupError) {
        logger.warn("[Sync] Habit reminder cleanup deferred");
        // Non-critical - continue anyway
      }
    } else {
      // No reminders - safe to delete all
      if (!(await validateSyncOwner(userId, "Habit reminder cleanup"))) return;
      const { error: deleteError } = await supabase
        .from("habit_reminders")
        .delete()
        .eq("habit_id", habit.id);

      if (deleteError) {
        logger.warn("[Sync] Habit reminder delete deferred");
      }
    }

    logger.log("[Sync] Habit synced");
    const deviceId = await getPersistentDeviceId();
    const event = await writeEventAndBroadcast(
      "habit",
      habit.id,
      "upsert",
      habit as unknown as Record<string, unknown>,
      deviceId,
      {
        expectedOwnerUserId: userId,
        ...(eventIdempotencyKey
          ? { idempotencyKey: eventIdempotencyKey, queueOnFailure: false, requireRemoteCommit: true }
          : {}),
      }
    );
    if (eventIdempotencyKey && !event) {
      throw new Error("Habit ordered event was not committed");
    }
  } catch (error) {
    // Handle AbortError separately
    if (isAbortError(error)) {
      logger.warn("[Sync] Habit sync aborted");
      throw error;
    }
    logger.error("[Sync] Failed to sync habit");
    // P0-4 Fix: Re-throw for offline queue handlers
    throw error;
  }
};

export const deleteHabitFromCloud = async (
  habitId: string,
  expectedOwnerUserId?: string,
  eventIdempotencyKey?: string
): Promise<void> => {
  await trackDeletedHabitId(habitId);

  const userId = await validateSyncOwner(expectedOwnerUserId, "Habit delete");
  if (!supabase) {
    if (eventIdempotencyKey) throw new Error("Habit remote delete is unavailable");
    return;
  }
  if (!userId) return;

  // If offline, queue for later
  if (!navigator.onLine) {
    if (eventIdempotencyKey) {
      throw new DOMException("Habit delete delivery paused while offline", "AbortError");
    }
    await offlineQueue.enqueue(
      "DELETE_HABIT",
      habitId,
      { id: habitId },
      {
        expectedOwnerUserId: userId,
      }
    );
    logger.log("[Sync] Habit delete queued for offline");
    return;
  }

  try {
    if (!isValidUUID(habitId)) {
      const deviceId = await getPersistentDeviceId();
      const event = await writeEventAndBroadcast("habit", habitId, "delete", null, deviceId, {
        expectedOwnerUserId: userId,
        ...(eventIdempotencyKey
          ? { idempotencyKey: eventIdempotencyKey, queueOnFailure: false, requireRemoteCommit: true }
          : {}),
      });
      if (eventIdempotencyKey && !event) {
        throw new Error("Habit delete ordered event was not committed");
      }
      logger.log("[Sync] Legacy habit delete tracked + evented");
      return;
    }

    if (!(await validateSyncOwner(userId, "Habit delete"))) return;
    const { error } = await supabase
      .from("habits")
      .delete()
      .eq("id", habitId)
      .eq("user_id", userId);

    if (error) throw error;

    logger.log("[Sync] Habit deleted + tracked");
    const deviceId = await getPersistentDeviceId();
    const event = await writeEventAndBroadcast("habit", habitId, "delete", null, deviceId, {
      expectedOwnerUserId: userId,
      ...(eventIdempotencyKey
        ? { idempotencyKey: eventIdempotencyKey, queueOnFailure: false, requireRemoteCommit: true }
        : {}),
    });
    if (eventIdempotencyKey && !event) {
      throw new Error("Habit delete ordered event was not committed");
    }
  } catch (error) {
    // Handle AbortError separately
    if (isAbortError(error)) {
      logger.warn("[Sync] Habit delete aborted");
      throw error;
    }
    logger.error("[Sync] Failed to delete habit");
    // P0-4 Fix: Re-throw for offline queue handlers
    throw error;
  }
};

/**
 * Sync habit completion to cloud
 * P1-9 Fix: Now includes offline queue support and error re-throw
 */
export const syncHabitCompletion = async (
  habitId: string,
  date: string,
  completed: boolean,
  count?: number,
  duration?: number,
  options?: {
    habitType?: LoopHabitType;
    targetType?: TargetType;
    entryValue?: number;
  },
  expectedOwnerUserId?: string,
  eventIdempotencyKey?: string
): Promise<void> => {
  const userId = await validateSyncOwner(expectedOwnerUserId, "Habit completion sync");
  if (!supabase) {
    if (eventIdempotencyKey) throw new Error("Habit completion remote sync is unavailable");
    return;
  }
  if (!userId) return;

  // Skip granular sync for non-UUID habit IDs (nanoid)
  if (!isValidUUID(habitId)) {
    if (eventIdempotencyKey) {
      throw new Error("Habit completion remote identity is unsupported");
    }
    logger.log("[Sync] Skipping granular habit completion sync for a legacy identifier");
    return;
  }

  const deletedHabitIds = await getDeletedHabitIds();
  if (deletedHabitIds.has(habitId)) {
    logger.warn("[Sync] Skipping tombstoned habit completion sync");
    return;
  }

  // P1-9 Fix: Add offline queue support (was missing)
  if (!navigator.onLine) {
    if (eventIdempotencyKey) {
      throw new DOMException("Habit completion delivery paused while offline", "AbortError");
    }
    await offlineQueue.enqueue(
      "TOGGLE_HABIT",
      `${habitId}_${date}`,
      {
        habitId,
        date,
        completed,
        count,
        duration,
        habitType: options?.habitType,
        targetType: options?.targetType,
        entryValue: options?.entryValue,
      },
      {
        expectedOwnerUserId: userId,
      }
    );
    logger.log("[Sync] Habit completion queued for offline");
    return;
  }

  if (await isEntityTombstonedOnServer("habit", habitId, userId)) {
    await trackDeletedHabitId(habitId);
    logger.warn("[Sync] Skipping server-tombstoned habit completion sync");
    return;
  }

  try {
    const habitType: LoopHabitType =
      options?.habitType ?? (typeof duration === "number" ? "numerical" : "boolean");
    const entryValue =
      options?.entryValue ??
      (typeof duration === "number"
        ? duration
        : habitType === "boolean" && completed
          ? ENTRY.YES_MANUAL
          : typeof count === "number"
            ? count * 1000
            : null);
    const shouldPersist =
      completed ||
      isHabitEntrySyncableToCloud({
        habitType,
        targetType: options?.targetType,
        entryValue,
      });

    const semanticFields = getCloudHabitCompletionSemanticFieldsForSync({
      habitType,
      targetType: options?.targetType,
      entryValue,
      isComplete: completed,
    });
    const encoded = encodeHabitCompletionForCloud({
      habitType,
      entryValue: entryValue ?? 0,
    });
    const eventEntityId = `${habitId}_${date}`;
    if (eventIdempotencyKey) {
      const deviceId = await getPersistentDeviceId();
      await commitManualSyncEvent({
        ownerUserId: userId,
        operationId: eventIdempotencyKey,
        entityType: "habit_completion",
        entityId: eventEntityId,
        op: shouldPersist ? "upsert" : "delete",
        projection: shouldPersist
          ? {
              habit_id: habitId,
              date,
              count: habitType === "numerical" ? encoded.count : (count ?? encoded.count),
              duration:
                habitType === "numerical" ? encoded.duration : (duration ?? encoded.duration),
              ...semanticFields,
            }
          : null,
        deviceId,
      });
      logger.log("[Sync] Habit completion synced");
      return;
    }

    if (shouldPersist) {
      if (!(await validateSyncOwner(userId, "Habit completion sync"))) return;
      const { error } = await supabase.from("habit_completions").upsert(
        {
          user_id: userId,
          habit_id: habitId,
          date,
          count: habitType === "numerical" ? encoded.count : (count ?? encoded.count),
          duration: habitType === "numerical" ? encoded.duration : (duration ?? encoded.duration),
          ...semanticFields,
        },
        { onConflict: "habit_id,date" }
      );

      if (error) throw error;
    } else {
      if (!(await validateSyncOwner(userId, "Habit completion delete"))) return;
      const { error } = await supabase
        .from("habit_completions")
        .delete()
        .eq("user_id", userId)
        .eq("habit_id", habitId)
        .eq("date", date);

      if (error) throw error;
    }
    logger.log("[Sync] Habit completion synced");
    const deviceId = await getPersistentDeviceId();
    const event = await writeEventAndBroadcast(
      "habit_completion",
      eventEntityId,
      shouldPersist ? "upsert" : "delete",
      shouldPersist
        ? {
            habitId,
            date,
            count,
            duration,
            entryValue,
            habitType,
            targetType: options?.targetType,
          }
        : null,
      deviceId,
      {
        expectedOwnerUserId: userId,
        ...(eventIdempotencyKey
          ? { idempotencyKey: eventIdempotencyKey, queueOnFailure: false, requireRemoteCommit: true }
          : {}),
      }
    );
    if (eventIdempotencyKey && !event) {
      throw new Error("Habit completion ordered event was not committed");
    }
  } catch (error) {
    // Handle AbortError separately
    if (isAbortError(error)) {
      logger.warn("[Sync] Habit completion sync aborted");
      throw error;
    }
    logger.error("[Sync] Failed to sync habit completion");
    // P0-4 Fix: Re-throw for retry logic
    throw error;
  }
};

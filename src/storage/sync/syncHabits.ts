/**
 * Habit sync operations — push, delete, and completion sync.
 * Extracted from realtimeSync.ts for modularity.
 */

import { logger } from "@/lib/logger";
import { writeEventAndBroadcast, getPersistentDeviceId } from "@/storage/eventSync";
import { trackDeletedHabitId } from "@/storage/deletionTracker";
import { isAbortError, isValidUUID } from "@/lib/validation";
import { supabase, getCurrentUserId } from "@/lib/supabaseClient";
import { ENTRY, type Habit, type LoopHabitType, type TargetType } from "@/types";
import { offlineQueue } from "@/lib/offlineQueue";
import { getHabitPlanState } from "@/lib/habitPlan";
import { normalizeHabitSchedule } from "@/lib/habitScheduling";
import { doesNumericalStoredValueMeetTarget } from "@/lib/habits";
import {
  encodeHabitCompletionForCloud,
  getCloudHabitCompletionSemanticFieldsForSync,
  getCloudHabitTypeForSync,
  isHabitEntrySyncableToCloud,
} from "./habitCompletionCodec";

// ============================================
// HABIT SYNC
// ============================================

export const syncHabit = async (habit: Habit): Promise<void> => {
  const userId = await getCurrentUserId();
  // Explicit validation to prevent RLS violations with undefined user_id
  if (!supabase) return;
  if (!userId) {
    logger.warn("[Sync] Cannot sync habit: User not authenticated");
    return;
  }

  // Skip granular sync for non-UUID IDs (nanoid) — data is persisted via JSONB backup
  if (!isValidUUID(habit.id)) {
    logger.log("[Sync] Skipping granular habit sync (non-UUID ID):", habit.id);
    return;
  }

  // If offline, queue for later sync
  if (!navigator.onLine) {
    await offlineQueue.enqueue("UPDATE_HABIT", habit.id, habit);
    logger.log("[Sync] Habit queued for offline sync:", habit.id);
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
      const { error: reminderError } = await supabase
        .from("habit_reminders")
        .upsert(reminders, { onConflict: "id" });

      if (reminderError) throw reminderError;

      // Clean up orphan reminders (non-critical - duplicates are better than data loss)
      // Security fix: sanitize IDs to prevent PostgREST filter injection
      const currentIds = reminders.map((r) => r.id.replace(/[^a-zA-Z0-9\-_]/g, ""));
      const filterTuple = `(${currentIds.map((id) => `"${id}"`).join(",")})`;
      const { error: cleanupError } = await supabase
        .from("habit_reminders")
        .delete()
        .eq("habit_id", habit.id)
        .not("id", "in", filterTuple);

      if (cleanupError) {
        logger.warn("[Sync] Failed to cleanup old reminders for habit:", habit.id, cleanupError);
        // Non-critical - continue anyway
      }
    } else {
      // No reminders - safe to delete all
      const { error: deleteError } = await supabase
        .from("habit_reminders")
        .delete()
        .eq("habit_id", habit.id);

      if (deleteError) {
        logger.warn("[Sync] Failed to delete reminders for habit:", habit.id, deleteError);
      }
    }

    logger.log("[Sync] Habit synced:", habit.id);
    const deviceId = await getPersistentDeviceId();
    await writeEventAndBroadcast(
      "habit",
      habit.id,
      "upsert",
      habit as unknown as Record<string, unknown>,
      deviceId
    );
  } catch (error) {
    // Handle AbortError separately
    if (isAbortError(error)) {
      logger.warn("[Sync] Habit sync aborted (timeout or navigation):", habit.id);
      return;
    }
    logger.error("[Sync] Failed to sync habit:", error);
    // P0-4 Fix: Re-throw for offline queue handlers
    throw error;
  }
};

export const deleteHabitFromCloud = async (habitId: string): Promise<void> => {
  const userId = await getCurrentUserId();
  if (!supabase || !userId) return;

  // If offline, queue for later
  if (!navigator.onLine) {
    await offlineQueue.enqueue("DELETE_HABIT", habitId, { id: habitId });
    logger.log("[Sync] Habit delete queued for offline:", habitId);
    return;
  }

  try {
    if (!isValidUUID(habitId)) {
      await trackDeletedHabitId(habitId);
      const deviceId = await getPersistentDeviceId();
      await writeEventAndBroadcast("habit", habitId, "delete", null, deviceId);
      logger.log("[Sync] Legacy habit delete tracked + evented:", habitId);
      return;
    }

    const { error } = await supabase
      .from("habits")
      .delete()
      .eq("id", habitId)
      .eq("user_id", userId);

    if (error) throw error;

    await trackDeletedHabitId(habitId);
    logger.log("[Sync] Habit deleted + tracked:", habitId);
    const deviceId = await getPersistentDeviceId();
    await writeEventAndBroadcast("habit", habitId, "delete", null, deviceId);
  } catch (error) {
    // Handle AbortError separately
    if (isAbortError(error)) {
      logger.warn("[Sync] Habit delete aborted (timeout or navigation):", habitId);
      return;
    }
    logger.error("[Sync] Failed to delete habit:", error);
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
  }
): Promise<void> => {
  const userId = await getCurrentUserId();
  if (!supabase || !userId) return;

  // Skip granular sync for non-UUID habit IDs (nanoid)
  if (!isValidUUID(habitId)) {
    logger.log("[Sync] Skipping granular habit completion sync (non-UUID ID):", habitId);
    return;
  }

  // P1-9 Fix: Add offline queue support (was missing)
  if (!navigator.onLine) {
    await offlineQueue.enqueue("TOGGLE_HABIT", `${habitId}_${date}`, {
      habitId,
      date,
      completed,
      count,
      duration,
      habitType: options?.habitType,
      targetType: options?.targetType,
      entryValue: options?.entryValue,
    });
    logger.log("[Sync] Habit completion queued for offline:", habitId, date);
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

    if (shouldPersist) {
      const { count: encodedCount, duration: encodedDuration } = encodeHabitCompletionForCloud({
        habitType,
        entryValue: entryValue ?? 0,
      });
      const { error } = await supabase.from("habit_completions").upsert(
        {
          user_id: userId,
          habit_id: habitId,
          date,
          count: habitType === "numerical" ? encodedCount : (count ?? encodedCount),
          duration: habitType === "numerical" ? encodedDuration : (duration ?? encodedDuration),
          ...getCloudHabitCompletionSemanticFieldsForSync({
            habitType,
            targetType: options?.targetType,
            entryValue,
            isComplete: completed,
          }),
        },
        { onConflict: "habit_id,date" }
      );

      if (error) throw error;
    } else {
      const { error } = await supabase
        .from("habit_completions")
        .delete()
        .eq("user_id", userId)
        .eq("habit_id", habitId)
        .eq("date", date);

      if (error) throw error;
    }
    logger.log("[Sync] Habit completion synced:", habitId, date, completed);
    const deviceId = await getPersistentDeviceId();
    await writeEventAndBroadcast(
      "habit_completion",
      `${habitId}_${date}`,
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
      deviceId
    );
  } catch (error) {
    // Handle AbortError separately
    if (isAbortError(error)) {
      logger.warn("[Sync] Habit completion sync aborted:", habitId, date);
      return;
    }
    logger.error("[Sync] Failed to sync habit completion:", error);
    // P0-4 Fix: Re-throw for retry logic
    throw error;
  }
};

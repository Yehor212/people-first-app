/**
 * Mood sync operations — push, delete, and targeted pull.
 * Extracted from realtimeSync.ts for modularity.
 */

import { logger } from "@/lib/logger";
import { triggerDataRefresh } from "@/hooks/useIndexedDB";
import { writeEventAndBroadcast, getPersistentDeviceId } from "@/storage/eventSync";
import { getDeletedMoodIds, trackDeletedMoodId } from "@/storage/deletionTracker";
import type { SeverityLevel } from "@sentry/core";
import type { ErrorCategory } from "@/lib/sentry";

// Lazy-load sentry to keep @sentry/* (~250 KB) off the critical rendering path.
// Breadcrumbs are fire-and-forget telemetry — async import is safe.
const lazyCategorizedBreadcrumb = (
  category: ErrorCategory,
  message: string,
  level?: SeverityLevel
) => {
  import("@/lib/sentry")
    .then((mod) => mod.addCategorizedBreadcrumb(category, message, undefined, level))
    .catch(() => logger.warn("[Sentry] lazy load skipped"));
};
import { isAbortError, isValidUUID } from "@/lib/validation";
import { supabase, getCurrentUserId } from "@/lib/supabaseClient";
import { db } from "@/storage/db";
import { MoodEntry } from "@/types";
import type { Json } from "@/types/supabase";
import { offlineQueue } from "@/lib/offlineQueue";
import { detectNetworkError } from "./syncUtils";
import { isEntityTombstonedOnServer } from "./serverTombstones";
import { validateSyncOwner } from "./syncOwner";
import { commitManualSyncEvent } from "./manualSyncAcceptance";

// ============================================
// MOOD SYNC
// ============================================

export const syncMood = async (
  mood: MoodEntry,
  expectedOwnerUserId?: string,
  eventIdempotencyKey?: string
): Promise<void> => {
  const userId = await validateSyncOwner(expectedOwnerUserId, "Mood sync");
  // Explicit validation to prevent RLS violations with undefined user_id
  if (!supabase) {
    if (eventIdempotencyKey) throw new Error("Mood remote sync is unavailable");
    return;
  }
  if (!userId) {
    logger.warn("[Sync] Cannot sync mood: User not authenticated");
    return;
  }

  const deletedMoodIds = await getDeletedMoodIds();
  if (deletedMoodIds.has(mood.id)) {
    logger.warn("[Sync] Skipping tombstoned mood upsert");
    return;
  }

  // Skip granular sync for non-UUID IDs (nanoid) — data is persisted via JSONB backup
  if (!isValidUUID(mood.id)) {
    if (eventIdempotencyKey) {
      throw new Error("Mood remote identity is unsupported");
    }
    logger.log("[Sync] Skipping granular mood sync for a legacy identifier");
    return;
  }

  lazyCategorizedBreadcrumb("sync", "Starting mood sync");

  // If offline, queue for later sync
  if (!navigator.onLine) {
    if (eventIdempotencyKey) {
      throw new DOMException("Mood delivery paused while offline", "AbortError");
    }
    await offlineQueue.enqueue("CREATE_MOOD", mood.id, mood, {
      expectedOwnerUserId: userId,
    });
    lazyCategorizedBreadcrumb("sync", "Mood queued (offline)");
    logger.log("[Sync] Mood queued for offline sync");
    return;
  }

  if (await isEntityTombstonedOnServer("mood", mood.id, userId)) {
    await trackDeletedMoodId(mood.id);
    logger.warn("[Sync] Skipping server-tombstoned mood upsert");
    return;
  }

  try {
    if (!(await validateSyncOwner(userId, "Mood sync"))) return;
    const projection = {
      id: mood.id,
      mood: mood.mood,
      note: mood.note || null,
      tags: mood.tags || [],
      date: mood.date,
      timestamp: mood.timestamp,
      emotion: (mood.emotion as unknown as Json) || null,
      valence: mood.valence ?? null,
      log_type: mood.logType ?? null,
      emotion_tags: mood.emotionTags ?? [],
      contexts: mood.contexts ?? [],
      updated_at: mood.updatedAt
        ? new Date(mood.updatedAt).toISOString()
        : new Date().toISOString(),
    };
    const deviceId = await getPersistentDeviceId();
    if (eventIdempotencyKey) {
      await commitManualSyncEvent({
        ownerUserId: userId,
        operationId: eventIdempotencyKey,
        entityType: "mood",
        entityId: mood.id,
        op: "upsert",
        projection,
        deviceId,
      });
      lazyCategorizedBreadcrumb("sync", "Mood synced successfully");
      logger.log("[Sync] Mood synced");
      return;
    }
    const { error } = await supabase.from("moods").upsert(
      { ...projection, user_id: userId },
      { onConflict: "id" }
    );

    if (error) throw error;
    lazyCategorizedBreadcrumb("sync", "Mood synced successfully");
    logger.log("[Sync] Mood synced");
    const event = await writeEventAndBroadcast(
      "mood",
      mood.id,
      "upsert",
      mood as unknown as Record<string, unknown>,
      deviceId,
      {
        expectedOwnerUserId: userId,
        ...(eventIdempotencyKey
          ? { idempotencyKey: eventIdempotencyKey, queueOnFailure: false, requireRemoteCommit: true }
          : {}),
      }
    );
    if (eventIdempotencyKey && !event) {
      throw new Error("Mood ordered event was not committed");
    }
  } catch (error) {
    if (isAbortError(error)) {
      lazyCategorizedBreadcrumb("sync", "Mood sync aborted", "warning");
      logger.warn("[Sync] Mood sync aborted");
      throw error;
    }

    // More robust network error detection
    // Check multiple signals instead of relying on fragile string matching
    const isNetworkError = detectNetworkError(error);

    if (isNetworkError) {
      if (eventIdempotencyKey) throw error;
      await offlineQueue.enqueue("CREATE_MOOD", mood.id, mood, {
        expectedOwnerUserId: userId,
      });
      lazyCategorizedBreadcrumb(
        "sync",
        "Mood queued (network error)",
        "warning"
      );
      logger.log("[Sync] Mood queued after network error");
      // Don't re-throw network errors - they're handled via offline queue
    } else {
      lazyCategorizedBreadcrumb(
        "sync",
        "Mood sync failed",
        "error"
      );
      logger.error("[Sync] Failed to sync mood");
      // P0-4 Fix: Re-throw so callers (especially offline queue handlers) know sync failed
      // Without this, the offline queue removes the action thinking it succeeded
      throw error;
    }
  }
};

export const deleteMoodFromCloud = async (
  moodId: string,
  expectedOwnerUserId?: string,
  eventIdempotencyKey?: string
): Promise<void> => {
  await trackDeletedMoodId(moodId);

  const userId = await validateSyncOwner(expectedOwnerUserId, "Mood delete");
  if (!supabase) {
    if (eventIdempotencyKey) throw new Error("Mood remote delete is unavailable");
    return;
  }
  if (!userId) return;

  // Skip granular sync for non-UUID IDs (nanoid)
  if (!isValidUUID(moodId)) {
    logger.log("[Sync] Skipping granular mood delete for a legacy identifier");
    return;
  }

  // If offline, queue for later
  if (!navigator.onLine) {
    if (eventIdempotencyKey) {
      throw new DOMException("Mood delete delivery paused while offline", "AbortError");
    }
    await offlineQueue.enqueue(
      "DELETE_MOOD",
      moodId,
      { id: moodId },
      {
        expectedOwnerUserId: userId,
      }
    );
    logger.log("[Sync] Mood delete queued for offline");
    return;
  }

  try {
    if (!(await validateSyncOwner(userId, "Mood delete"))) return;
    const { error } = await supabase.from("moods").delete().eq("id", moodId).eq("user_id", userId);

    if (error) throw error;
    logger.log("[Sync] Mood deleted + tracked");
    const deviceId = await getPersistentDeviceId();
    const event = await writeEventAndBroadcast("mood", moodId, "delete", null, deviceId, {
      expectedOwnerUserId: userId,
      ...(eventIdempotencyKey
        ? { idempotencyKey: eventIdempotencyKey, queueOnFailure: false, requireRemoteCommit: true }
        : {}),
    });
    if (eventIdempotencyKey && !event) {
      throw new Error("Mood delete ordered event was not committed");
    }
  } catch (error) {
    // Handle AbortError separately
    if (isAbortError(error)) {
      logger.warn("[Sync] Mood delete aborted");
      throw error;
    }
    logger.error("[Sync] Failed to delete mood");
    // P0-4 Fix: Re-throw for offline queue handlers
    throw error;
  }
};

/** Pull moods from cloud and merge by timestamp. */
export const pullMoodsFromCloud = async (): Promise<boolean> => {
  if (!supabase) return false;
  const userId = await getCurrentUserId();
  if (!userId) return false;
  try {
    const { data, error } = await supabase
      .from("moods")
      .select("*")
      .eq("user_id", userId)
      .limit(10000);
    if (error) throw error;
    if (!data?.length) return true;
    const mapped: MoodEntry[] = data.map((m) => ({
      id: m.id,
      mood: m.mood as MoodEntry["mood"],
      note: m.note || undefined,
      date: m.date,
      timestamp: m.timestamp,
      tags: m.tags as string[] | undefined,
      emotion: (m.emotion as unknown as MoodEntry["emotion"]) || undefined,
      valence: m.valence ?? undefined,
      logType: (m.log_type as MoodEntry["logType"]) ?? undefined,
      emotionTags: (m.emotion_tags as string[]) ?? undefined,
      contexts: (m.contexts as string[]) ?? undefined,
      updatedAt: m.updated_at ? new Date(m.updated_at).getTime() : m.timestamp,
    }));
    // Atomic: read + merge + write in Dexie transaction (prevents TOCTOU race)
    const deletedMoodIds = await getDeletedMoodIds();
    await db.transaction("rw", db.moods, async () => {
      const local = await db.moods.toArray();
      const localMap = new Map(local.map((m) => [m.id, m]));
      const merged = mapped.map((remote) => {
        const loc = localMap.get(remote.id);
        if (!loc) return remote;
        return (loc.updatedAt || loc.timestamp || 0) > (remote.updatedAt || remote.timestamp || 0)
          ? loc
          : remote;
      });
      const toWrite =
        deletedMoodIds.size > 0 ? merged.filter((m) => !deletedMoodIds.has(m.id)) : merged;
      if (toWrite.length) await db.moods.bulkPut(toWrite);
    });
    await triggerDataRefresh();
    return true;
  } catch {
    logger.error("[Pull] Moods failed");
    return false;
  }
};

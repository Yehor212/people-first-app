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
  data?: Record<string, unknown>,
  level?: SeverityLevel
) => {
  import("@/lib/sentry")
    .then((mod) => mod.addCategorizedBreadcrumb(category, message, data, level))
    .catch((e) => logger.warn("[Sentry] lazy load skipped:", e));
};
import { isAbortError, isValidUUID } from "@/lib/validation";
import { supabase, getCurrentUserId } from "@/lib/supabaseClient";
import { db } from "@/storage/db";
import { MoodEntry } from "@/types";
import type { Json } from "@/types/supabase";
import { offlineQueue } from "@/lib/offlineQueue";
import { detectNetworkError } from "./syncUtils";

// ============================================
// MOOD SYNC
// ============================================

export const syncMood = async (mood: MoodEntry): Promise<void> => {
  const userId = await getCurrentUserId();
  // Explicit validation to prevent RLS violations with undefined user_id
  if (!supabase) return;
  if (!userId) {
    logger.warn("[Sync] Cannot sync mood: User not authenticated");
    return;
  }

  // Skip granular sync for non-UUID IDs (nanoid) — data is persisted via JSONB backup
  if (!isValidUUID(mood.id)) {
    logger.log("[Sync] Skipping granular mood sync (non-UUID ID):", mood.id);
    return;
  }

  lazyCategorizedBreadcrumb("sync", "Starting mood sync", {
    moodId: mood.id,
    date: mood.date,
  });

  // If offline, queue for later sync
  if (!navigator.onLine) {
    await offlineQueue.enqueue("CREATE_MOOD", mood.id, mood);
    lazyCategorizedBreadcrumb("sync", "Mood queued (offline)", {
      moodId: mood.id,
    });
    logger.log("[Sync] Mood queued for offline sync:", mood.id);
    return;
  }

  try {
    const { error } = await supabase.from("moods").upsert(
      {
        id: mood.id,
        user_id: userId,
        mood: mood.mood,
        note: mood.note || null,
        tags: mood.tags || [],
        date: mood.date,
        timestamp: mood.timestamp,
        emotion: (mood.emotion as unknown as Json) || null,
        // State of Mind fields (v2.0.0)
        valence: mood.valence ?? null,
        log_type: mood.logType ?? null,
        emotion_tags: mood.emotionTags ?? [],
        contexts: mood.contexts ?? [],
        updated_at: mood.updatedAt
          ? new Date(mood.updatedAt).toISOString()
          : new Date().toISOString(),
      },
      { onConflict: "id" }
    );

    if (error) throw error;
    lazyCategorizedBreadcrumb("sync", "Mood synced successfully", {
      moodId: mood.id,
    });
    logger.log("[Sync] Mood synced:", mood.id);
    void getPersistentDeviceId()
      .then((did) =>
        writeEventAndBroadcast(
          "mood",
          mood.id,
          "upsert",
          mood as unknown as Record<string, unknown>,
          did
        )
      )
      .catch((err) => logger.warn("[Sync] writeEvent failed:", err));
  } catch (error) {
    // Handle AbortError separately - it's intentional, don't retry/queue
    if (isAbortError(error)) {
      lazyCategorizedBreadcrumb("sync", "Mood sync aborted", { moodId: mood.id }, "warning");
      logger.warn("[Sync] Mood sync aborted (timeout or navigation):", mood.id);
      return; // Don't retry, don't queue - this was intentional
    }

    // More robust network error detection
    // Check multiple signals instead of relying on fragile string matching
    const isNetworkError = detectNetworkError(error);

    if (isNetworkError) {
      await offlineQueue.enqueue("CREATE_MOOD", mood.id, mood);
      lazyCategorizedBreadcrumb(
        "sync",
        "Mood queued (network error)",
        { moodId: mood.id },
        "warning"
      );
      logger.log("[Sync] Mood queued after network error:", mood.id);
      // Don't re-throw network errors - they're handled via offline queue
    } else {
      lazyCategorizedBreadcrumb(
        "sync",
        "Mood sync failed",
        { moodId: mood.id, error: (error as Error).message },
        "error"
      );
      logger.error("[Sync] Failed to sync mood:", error);
      // P0-4 Fix: Re-throw so callers (especially offline queue handlers) know sync failed
      // Without this, the offline queue removes the action thinking it succeeded
      throw error;
    }
  }
};

export const deleteMoodFromCloud = async (moodId: string): Promise<void> => {
  const userId = await getCurrentUserId();
  if (!supabase || !userId) return;

  // Skip granular sync for non-UUID IDs (nanoid)
  if (!isValidUUID(moodId)) {
    logger.log("[Sync] Skipping granular mood delete (non-UUID ID):", moodId);
    return;
  }

  // If offline, queue for later
  if (!navigator.onLine) {
    await offlineQueue.enqueue("DELETE_MOOD", moodId, { id: moodId });
    logger.log("[Sync] Mood delete queued for offline:", moodId);
    return;
  }

  try {
    const { error } = await supabase.from("moods").delete().eq("id", moodId).eq("user_id", userId);

    if (error) throw error;
    await trackDeletedMoodId(moodId);
    logger.log("[Sync] Mood deleted + tracked:", moodId);
    void getPersistentDeviceId()
      .then((did) => writeEventAndBroadcast("mood", moodId, "delete", null, did))
      .catch((err) => logger.warn("[Sync] writeEvent failed:", err));
  } catch (error) {
    // Handle AbortError separately
    if (isAbortError(error)) {
      logger.warn("[Sync] Mood delete aborted (timeout or navigation):", moodId);
      return;
    }
    logger.error("[Sync] Failed to delete mood:", error);
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
    triggerDataRefresh();
    return true;
  } catch (err) {
    logger.error("[Pull] Moods failed:", err);
    return false;
  }
};

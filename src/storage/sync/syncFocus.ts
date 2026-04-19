/**
 * Focus session sync operations — push and targeted pull.
 * Extracted from realtimeSync.ts for modularity.
 */

import { logger } from "@/lib/logger";
import { triggerDataRefresh } from "@/hooks/useIndexedDB";
import { broadcastChange } from "@/lib/syncBroadcast";
import { writeEvent, getPersistentDeviceId } from "@/storage/eventSync";
import { getDeletedFocusSessionIds } from "@/storage/deletionTracker";
import { isAbortError, isValidUUID } from "@/lib/validation";
import { supabase, getCurrentUserId } from "@/lib/supabaseClient";
import { db } from "@/storage/db";
import { FocusSession } from "@/types";
import { offlineQueue } from "@/lib/offlineQueue";

// ============================================
// FOCUS SESSION SYNC
// ============================================

export const syncFocusSession = async (session: FocusSession): Promise<void> => {
  const userId = await getCurrentUserId();
  // Explicit validation to prevent RLS violations with undefined user_id
  if (!supabase) return;
  if (!userId) {
    logger.warn("[Sync] Cannot sync focus session: User not authenticated");
    return;
  }

  // Skip granular sync for non-UUID IDs (nanoid) — data is persisted via JSONB backup
  if (!isValidUUID(session.id)) {
    logger.log("[Sync] Skipping granular focus session sync (non-UUID ID):", session.id);
    return;
  }

  // If offline, queue for later sync
  if (!navigator.onLine) {
    await offlineQueue.enqueue("CREATE_FOCUS_SESSION", session.id, session);
    logger.log("[Sync] Focus session queued for offline sync:", session.id);
    return;
  }

  try {
    const { error } = await supabase.from("focus_sessions").upsert(
      {
        id: session.id,
        user_id: userId,
        duration: session.duration,
        label: session.label || null,
        status: session.status || "completed",
        updated_at: session.updatedAt
          ? new Date(session.updatedAt).toISOString()
          : new Date().toISOString(),
        reflection: session.reflection || null,
        date: session.date,
        completed_at: session.completedAt,
      },
      { onConflict: "id" }
    );

    if (error) throw error;
    logger.log("[Sync] Focus session synced:", session.id);
    broadcastChange("focus");
    void getPersistentDeviceId()
      .then((did) =>
        writeEvent(
          "focus",
          session.id,
          "upsert",
          session as unknown as Record<string, unknown>,
          did
        )
      )
      .catch((err) => logger.warn("[Sync] writeEvent failed:", err));
  } catch (error) {
    // Handle AbortError separately
    if (isAbortError(error)) {
      logger.warn("[Sync] Focus session sync aborted:", session.id);
      return;
    }
    logger.error("[Sync] Failed to sync focus session:", error);
    // P0-4 Fix: Re-throw for offline queue handlers
    throw error;
  }
};

/** Pull focus sessions from cloud and merge by timestamp. */
export const pullFocusFromCloud = async (): Promise<boolean> => {
  if (!supabase) return false;
  const userId = await getCurrentUserId();
  if (!userId) return false;
  try {
    const { data, error } = await supabase
      .from("focus_sessions")
      .select("*")
      .eq("user_id", userId)
      .limit(10000);
    if (error) throw error;
    if (!data?.length) return true;
    const mapped = data.map((f) => ({
      id: f.id,
      duration: f.duration,
      completedAt: f.completed_at,
      date: f.date,
      label: f.label || undefined,
      status: f.status as "completed" | "aborted" | undefined,
      reflection: f.reflection ?? undefined,
      updatedAt: f.updated_at ? new Date(f.updated_at).getTime() : f.completed_at,
    }));
    const deletedFocusIds = await getDeletedFocusSessionIds();
    await db.transaction("rw", db.focusSessions, async () => {
      const local = await db.focusSessions.toArray();
      const localMap = new Map(local.map((f) => [f.id, f]));
      const merged = mapped.map((remote) => {
        const loc = localMap.get(remote.id);
        if (!loc) return remote;
        const lt = loc.updatedAt || loc.completedAt || 0;
        return lt > (remote.updatedAt || remote.completedAt || 0) ? loc : remote;
      });
      const toWriteFocus =
        deletedFocusIds.size > 0 ? merged.filter((f) => !deletedFocusIds.has(f.id)) : merged;
      if (toWriteFocus.length) await db.focusSessions.bulkPut(toWriteFocus);
    });
    triggerDataRefresh();
    return true;
  } catch (err) {
    logger.error("[Pull] Focus failed:", err);
    return false;
  }
};

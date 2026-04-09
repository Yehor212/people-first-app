/**
 * Gratitude sync operations — push, delete, and targeted pull.
 * Extracted from realtimeSync.ts for modularity.
 */

import { logger } from "@/lib/logger";
import { triggerDataRefresh } from "@/hooks/useIndexedDB";
import { broadcastChange } from "@/lib/syncBroadcast";
import { writeEvent, getPersistentDeviceId } from "@/storage/eventSync";
import { getDeletedGratitudeIds, trackDeletedGratitudeId } from "@/storage/deletionTracker";
import { isAbortError, isValidUUID } from "@/lib/validation";
import { supabase, getCurrentUserId } from "@/lib/supabaseClient";
import { db } from "@/storage/db";
import { GratitudeEntry } from "@/types";
import { offlineQueue } from "@/lib/offlineQueue";

// ============================================
// GRATITUDE SYNC
// ============================================

export const syncGratitude = async (entry: GratitudeEntry): Promise<void> => {
  const userId = await getCurrentUserId();
  // Explicit validation to prevent RLS violations with undefined user_id
  if (!supabase) return;
  if (!userId) {
    logger.warn("[Sync] Cannot sync gratitude: User not authenticated");
    return;
  }

  // Skip granular sync for non-UUID IDs (nanoid) — data is persisted via JSONB backup
  if (!isValidUUID(entry.id)) {
    logger.log("[Sync] Skipping granular gratitude sync (non-UUID ID):", entry.id);
    return;
  }

  // If offline, queue for later sync
  if (!navigator.onLine) {
    await offlineQueue.enqueue("CREATE_GRATITUDE", entry.id, entry);
    logger.log("[Sync] Gratitude queued for offline sync:", entry.id);
    return;
  }

  try {
    const { error } = await supabase.from("gratitude_entries").upsert(
      {
        id: entry.id,
        user_id: userId,
        text: entry.text,
        date: entry.date,
        timestamp: entry.timestamp,
        updated_at: entry.updatedAt
          ? new Date(entry.updatedAt).toISOString()
          : new Date().toISOString(),
      },
      { onConflict: "id" }
    );

    if (error) throw error;
    logger.log("[Sync] Gratitude synced:", entry.id);
    broadcastChange("gratitude");
    void getPersistentDeviceId()
      .then((did) =>
        writeEvent(
          "gratitude",
          entry.id,
          "upsert",
          entry as unknown as Record<string, unknown>,
          did
        )
      )
      .catch((err) => logger.warn("[Sync] writeEvent failed:", err));
  } catch (error) {
    // Handle AbortError separately
    if (isAbortError(error)) {
      logger.warn("[Sync] Gratitude sync aborted:", entry.id);
      return;
    }
    logger.error("[Sync] Failed to sync gratitude:", error);
    // P0-4 Fix: Re-throw for offline queue handlers
    throw error;
  }
};

export const deleteGratitudeFromCloud = async (entryId: string): Promise<void> => {
  const userId = await getCurrentUserId();
  if (!supabase || !userId) return;

  // Skip granular sync for non-UUID IDs (nanoid)
  if (!isValidUUID(entryId)) {
    logger.log("[Sync] Skipping granular gratitude delete (non-UUID ID):", entryId);
    return;
  }

  // If offline, queue for later
  if (!navigator.onLine) {
    await offlineQueue.enqueue("DELETE_GRATITUDE", entryId, { id: entryId });
    logger.log("[Sync] Gratitude delete queued for offline:", entryId);
    return;
  }

  try {
    const { error } = await supabase
      .from("gratitude_entries")
      .delete()
      .eq("id", entryId)
      .eq("user_id", userId);

    if (error) throw error;
    await trackDeletedGratitudeId(entryId);
    broadcastChange("gratitude");
    logger.log("[Sync] Gratitude deleted + tracked:", entryId);
    void getPersistentDeviceId()
      .then((did) => writeEvent("gratitude", entryId, "delete", null, did))
      .catch((err) => logger.warn("[Sync] writeEvent failed:", err));
  } catch (error) {
    // Handle AbortError separately
    if (isAbortError(error)) {
      logger.warn("[Sync] Gratitude delete aborted:", entryId);
      return;
    }
    logger.error("[Sync] Failed to delete gratitude:", error);
    // P0-4 Fix: Re-throw for offline queue handlers
    throw error;
  }
};

/** Pull gratitude entries from cloud and merge by timestamp. */
export const pullGratitudeFromCloud = async (): Promise<boolean> => {
  if (!supabase) return false;
  const userId = await getCurrentUserId();
  if (!userId) return false;
  try {
    const { data, error } = await supabase
      .from("gratitude_entries")
      .select("*")
      .eq("user_id", userId)
      .limit(10000);
    if (error) throw error;
    if (!data?.length) return true;
    const mapped = data.map((g) => ({
      id: g.id,
      text: g.text,
      date: g.date,
      timestamp: g.timestamp,
      updatedAt: (g as any).updated_at ? new Date((g as any).updated_at).getTime() : g.timestamp,
    }));
    const deletedGratIds = await getDeletedGratitudeIds();
    await db.transaction("rw", db.gratitudeEntries, async () => {
      const local = await db.gratitudeEntries.toArray();
      const localMap = new Map(local.map((g) => [g.id, g]));
      const merged = mapped.map((remote) => {
        const loc = localMap.get(remote.id);
        if (!loc) return remote;
        const lt = (loc as any).updatedAt || loc.timestamp || 0;
        return lt > (remote.updatedAt || remote.timestamp || 0) ? loc : remote;
      });
      const toWriteGrat =
        deletedGratIds.size > 0 ? merged.filter((g) => !deletedGratIds.has(g.id)) : merged;
      if (toWriteGrat.length) await db.gratitudeEntries.bulkPut(toWriteGrat as any);
    });
    triggerDataRefresh();
    return true;
  } catch (err) {
    logger.error("[Pull] Gratitude failed:", err);
    return false;
  }
};

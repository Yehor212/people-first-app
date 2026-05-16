/**
 * Settings sync operations — push setting to cloud.
 * Extracted from realtimeSync.ts for modularity.
 */

import { logger } from "@/lib/logger";
import { isAbortError } from "@/lib/validation";
import { detectNetworkError } from "./syncUtils";
import { supabase, getCurrentUserId } from "@/lib/supabaseClient";
import { offlineQueue } from "@/lib/offlineQueue";
import type { Json } from "@/types/supabase";
import { getPersistentDeviceId, writeEventAndBroadcast } from "@/storage/eventSync";

// ============================================
// SETTINGS SYNC
// ============================================

export const syncSetting = async (key: string, value: unknown): Promise<void> => {
  const userId = await getCurrentUserId();
  // Explicit validation to prevent RLS violations with undefined user_id
  if (!supabase) return;
  if (!userId) {
    logger.warn("[Sync] Cannot sync setting: User not authenticated");
    return;
  }

  // Offline queue: defer sync when offline (same pattern as syncMood/syncHabit)
  if (!navigator.onLine) {
    await offlineQueue.enqueue("UPDATE_SETTINGS", key, { key, value });
    return;
  }

  try {
    const updatedAt = new Date().toISOString();
    const payload = { key, value, updatedAt };
    const { error } = await supabase.from("user_settings").upsert(
      {
        user_id: userId,
        key,
        value: value as Json,
        updated_at: updatedAt,
      },
      { onConflict: "user_id,key" }
    );

    if (error) throw error;
    void getPersistentDeviceId()
      .then((deviceId) => writeEventAndBroadcast("setting", key, "upsert", payload, deviceId))
      .catch((err) => logger.warn("[Sync] setting writeEvent failed:", err));
    logger.log("[Sync] Setting synced:", key);
  } catch (error) {
    // Handle AbortError separately
    if (isAbortError(error)) {
      logger.warn("[Sync] Setting sync aborted:", key);
      return;
    }
    // Network error: queue for retry when online
    if (detectNetworkError(error)) {
      await offlineQueue.enqueue("UPDATE_SETTINGS", key, { key, value });
      return;
    }
    logger.error("[Sync] Failed to sync setting:", error);
    // P0-4 Fix: Re-throw for offline queue handlers
    throw error;
  }
};

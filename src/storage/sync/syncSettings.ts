/**
 * Settings sync operations — push setting to cloud.
 * Extracted from realtimeSync.ts for modularity.
 */

import { logger } from "@/lib/logger";
import { isAbortError } from "@/lib/validation";
import { supabase, getCurrentUserId } from "@/lib/supabaseClient";
import type { Json } from "@/types/supabase";

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

  try {
    const { error } = await supabase.from("user_settings").upsert(
      {
        user_id: userId,
        key,
        value: value as Json,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "user_id,key" }
    );

    if (error) throw error;
    logger.log("[Sync] Setting synced:", key);
  } catch (error) {
    // Handle AbortError separately
    if (isAbortError(error)) {
      logger.warn("[Sync] Setting sync aborted:", key);
      return;
    }
    logger.error("[Sync] Failed to sync setting:", error);
    // P0-4 Fix: Re-throw for offline queue handlers
    throw error;
  }
};

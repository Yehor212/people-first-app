/**
 * User stats fetch — RPC call to get_user_stats.
 * Extracted from realtimeSync.ts for modularity.
 */

import { logger } from "@/lib/logger";
import { supabase, getCurrentUserId } from "@/lib/supabaseClient";

// ============================================
// USER STATS
// ============================================

export const fetchUserStats = async () => {
  const userId = await getCurrentUserId();
  if (!supabase || !userId) return null;

  try {
    // get_user_stats is typed in Database['public']['Functions']
    const { data, error } = await supabase.rpc("get_user_stats", {
      p_user_id: userId,
    });
    if (error) throw error;
    return data;
  } catch (error) {
    logger.error("[Sync] Failed to fetch user stats:", error);
    return null;
  }
};

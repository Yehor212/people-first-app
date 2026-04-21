/**
 * Leaderboard Service
 * Part of v1.3.0 "Harmony" - Social Features
 *
 * Privacy-first leaderboards with opt-in system.
 * Users can participate anonymously or with a display name.
 */

import { supabase, getCurrentUserId } from "./supabaseClient";
import { logger } from "./logger";

// ============================================
// TYPES
// ============================================

export interface LeaderboardEntry {
  id: string;
  userId: string;
  displayName: string;
  weeklyXp: number;
  monthlyXp: number;
  allTimeXp: number;
  currentStreak: number;
  longestStreak: number;
  optIn: boolean;
  rank?: number;
  isCurrentUser?: boolean;
}

export interface LeaderboardStats {
  weeklyRank: number | null;
  monthlyRank: number | null;
  streakRank: number | null;
  totalParticipants: number;
}

export type LeaderboardType = "weekly" | "monthly" | "streak";

// ============================================
// SHARED HELPERS
// ============================================

/**
 * Shared helper for estimated-count queries against the leaderboards table.
 * Deduplicates the repeated select→count→filter pattern used in getUserRanks.
 */
async function getLeaderboardCount(
  table: "leaderboards",
  baseFilters: { column: string; value: string | number | boolean }[],
  gtFilter?: { column: string; value: number }
): Promise<number> {
  if (!supabase) return 0;
  let query = supabase.from(table).select("*", { count: "estimated", head: true });
  for (const f of baseFilters) {
    query = query.eq(f.column, f.value);
  }
  if (gtFilter) {
    query = query.gt(gtFilter.column, gtFilter.value);
  }
  const { count, error } = await query;
  if (error) throw error;
  return count ?? 0;
}

// ============================================
// LEADERBOARD QUERIES
// ============================================

/**
 * Get top entries for a leaderboard type
 */
export async function getLeaderboard(
  type: LeaderboardType,
  limit: number = 10
): Promise<LeaderboardEntry[]> {
  const userId = await getCurrentUserId();

  const orderColumn = {
    weekly: "weekly_xp",
    monthly: "monthly_xp",
    streak: "current_streak",
  }[type];

  if (!supabase) return [];

  const { data, error } = await supabase
    .from("leaderboards")
    .select("*")
    .eq("opt_in", true)
    .order(orderColumn, { ascending: false })
    .limit(limit);

  if (error) {
    logger.error("[Leaderboard] Failed to fetch leaderboard:", error);
    return [];
  }

  const rows = data ?? [];
  return rows.map((row, index) => ({
    id: row.id,
    userId: row.user_id,
    displayName: row.display_name || "Zen User",
    weeklyXp: row.weekly_xp ?? 0,
    monthlyXp: row.monthly_xp ?? 0,
    allTimeXp: row.all_time_xp ?? 0,
    currentStreak: row.current_streak ?? 0,
    longestStreak: row.longest_streak ?? 0,
    optIn: row.opt_in ?? false,
    rank: index + 1,
    isCurrentUser: row.user_id === userId,
  }));
}

/**
 * Get current user's leaderboard entry
 */
export async function getUserLeaderboardEntry(): Promise<LeaderboardEntry | null> {
  const userId = await getCurrentUserId();
  if (!userId) return null;

  if (!supabase) return null;

  const { data, error } = await supabase
    .from("leaderboards")
    .select("*")
    .eq("user_id", userId)
    .maybeSingle();

  if (error) {
    logger.error("[Leaderboard] Failed to fetch user entry:", error);
    return null;
  }

  if (!data) return null;

  return {
    id: data.id,
    userId: data.user_id,
    displayName: data.display_name || "Zen User",
    weeklyXp: data.weekly_xp ?? 0,
    monthlyXp: data.monthly_xp ?? 0,
    allTimeXp: data.all_time_xp ?? 0,
    currentStreak: data.current_streak ?? 0,
    longestStreak: data.longest_streak ?? 0,
    optIn: data.opt_in ?? false,
    isCurrentUser: true,
  };
}

/**
 * Get user's rank in each leaderboard
 */
export async function getUserRanks(): Promise<LeaderboardStats> {
  const userId = await getCurrentUserId();
  if (!userId) {
    return { weeklyRank: null, monthlyRank: null, streakRank: null, totalParticipants: 0 };
  }

  // Get user's entry
  const userEntry = await getUserLeaderboardEntry();
  if (!userEntry || !userEntry.optIn) {
    return { weeklyRank: null, monthlyRank: null, streakRank: null, totalParticipants: 0 };
  }

  if (!supabase) {
    return { weeklyRank: null, monthlyRank: null, streakRank: null, totalParticipants: 0 };
  }

  // Run all 4 count queries in parallel via shared helper (estimated count avoids full table scan)
  const optInFilter = [{ column: "opt_in", value: true as string | number | boolean }];
  const [total, weeklyAbove, monthlyAbove, streakAbove] = await Promise.all([
    getLeaderboardCount("leaderboards", optInFilter),
    getLeaderboardCount("leaderboards", optInFilter, {
      column: "weekly_xp",
      value: userEntry.weeklyXp,
    }),
    getLeaderboardCount("leaderboards", optInFilter, {
      column: "monthly_xp",
      value: userEntry.monthlyXp,
    }),
    getLeaderboardCount("leaderboards", optInFilter, {
      column: "current_streak",
      value: userEntry.currentStreak,
    }),
  ]);

  return {
    weeklyRank: weeklyAbove + 1,
    monthlyRank: monthlyAbove + 1,
    streakRank: streakAbove + 1,
    totalParticipants: total,
  };
}

// ============================================
// LEADERBOARD MANAGEMENT
// ============================================

/**
 * Opt in to the leaderboard with a display name
 */
export async function optInToLeaderboard(displayName: string): Promise<boolean> {
  const userId = await getCurrentUserId();
  if (!userId) return false;

  // Sanitize display name (max 20 chars, alphanumeric + spaces)
  const sanitizedName = displayName
    .trim()
    .slice(0, 20)
    .replace(/[^a-zA-Z0-9 _-]/g, "");

  const finalName = sanitizedName || "Zen User";

  if (!supabase) return false;

  const { error } = await supabase.from("leaderboards").upsert(
    {
      user_id: userId,
      display_name: finalName,
      opt_in: true,
    },
    {
      onConflict: "user_id",
    }
  );

  if (error) {
    logger.error("[Leaderboard] Failed to opt in:", error);
    return false;
  }

  logger.log("[Leaderboard] User opted in:", finalName);
  return true;
}

/**
 * Opt out of the leaderboard
 */
export async function optOutOfLeaderboard(): Promise<boolean> {
  const userId = await getCurrentUserId();
  if (!userId) return false;

  if (!supabase) return false;

  const { error } = await supabase
    .from("leaderboards")
    .update({ opt_in: false })
    .eq("user_id", userId);

  if (error) {
    logger.error("[Leaderboard] Failed to opt out:", error);
    return false;
  }

  logger.log("[Leaderboard] User opted out");
  return true;
}

/**
 * Update display name
 */
export async function updateDisplayName(displayName: string): Promise<boolean> {
  const userId = await getCurrentUserId();
  if (!userId) return false;

  const sanitizedName =
    displayName
      .trim()
      .slice(0, 20)
      .replace(/[^a-zA-Z0-9 _-]/g, "") || "Zen User";

  if (!supabase) return false;

  const { error } = await supabase
    .from("leaderboards")
    .update({ display_name: sanitizedName })
    .eq("user_id", userId);

  if (error) {
    logger.error("[Leaderboard] Failed to update display name:", error);
    return false;
  }

  return true;
}

// ============================================
// SCORE UPDATES
// ============================================

/**
 * Add XP to user's leaderboard score
 * Called when user earns XP from activities
 */
export async function addXpToLeaderboard(xpAmount: number): Promise<void> {
  const userId = await getCurrentUserId();
  if (!userId || xpAmount <= 0) return;

  // First check if entry exists
  const existing = await getUserLeaderboardEntry();

  if (!supabase) return;

  if (existing) {
    // Update existing entry
    const { error } = await supabase
      .from("leaderboards")
      .update({
        weekly_xp: existing.weeklyXp + xpAmount,
        monthly_xp: existing.monthlyXp + xpAmount,
        all_time_xp: existing.allTimeXp + xpAmount,
      })
      .eq("user_id", userId);

    if (error) {
      logger.error("[Leaderboard] Failed to add XP:", error);
    }
  } else {
    // Create new entry (not opted in by default)
    const { error } = await supabase.from("leaderboards").insert({
      user_id: userId,
      weekly_xp: xpAmount,
      monthly_xp: xpAmount,
      all_time_xp: xpAmount,
      opt_in: false,
    });

    if (error && error.code !== "23505") {
      // Ignore duplicate key errors
      logger.error("[Leaderboard] Failed to create entry:", error);
    }
  }
}

/**
 * Update streak on leaderboard
 * Called when user's streak changes
 */
export async function updateLeaderboardStreak(currentStreak: number): Promise<void> {
  const userId = await getCurrentUserId();
  if (!userId) return;

  const existing = await getUserLeaderboardEntry();

  if (!supabase) return;

  if (existing) {
    const newLongest = Math.max(existing.longestStreak, currentStreak);

    const { error } = await supabase
      .from("leaderboards")
      .update({
        current_streak: currentStreak,
        longest_streak: newLongest,
      })
      .eq("user_id", userId);

    if (error) {
      logger.error("[Leaderboard] Failed to update streak:", error);
    }
  } else {
    // Create new entry
    const { error } = await supabase.from("leaderboards").insert({
      user_id: userId,
      current_streak: currentStreak,
      longest_streak: currentStreak,
      opt_in: false,
    });

    if (error && error.code !== "23505") {
      logger.error("[Leaderboard] Failed to create entry:", error);
    }
  }
}

// ============================================
// HELPERS
// ============================================

/**
 * Get medal emoji for rank
 */
export function getRankMedal(rank: number): string {
  switch (rank) {
    case 1:
      return "🥇";
    case 2:
      return "🥈";
    case 3:
      return "🥉";
    default:
      return "";
  }
}

/**
 * Format rank with suffix (1st, 2nd, 3rd, etc.)
 */
export function formatRank(rank: number): string {
  const suffix = ["th", "st", "nd", "rd"];
  const v = rank % 100;
  return rank + (suffix[(v - 20) % 10] || suffix[v] || suffix[0]);
}

export default {
  getLeaderboard,
  getUserLeaderboardEntry,
  getUserRanks,
  optInToLeaderboard,
  optOutOfLeaderboard,
  updateDisplayName,
  addXpToLeaderboard,
  updateLeaderboardStreak,
  getRankMedal,
  formatRank,
};

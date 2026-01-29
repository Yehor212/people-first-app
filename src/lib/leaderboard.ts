/**
 * Leaderboard Service
 * Part of v1.3.0 "Harmony" - Social Features
 *
 * Privacy-first leaderboards with opt-in system.
 * Users can participate anonymously or with a display name.
 */

import { supabase, getCurrentUserId } from './supabaseClient';
import { logger } from './logger';

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

export type LeaderboardType = 'weekly' | 'monthly' | 'streak';

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
    weekly: 'weekly_xp',
    monthly: 'monthly_xp',
    streak: 'current_streak',
  }[type];

  const { data, error } = await supabase
    .from('leaderboards')
    .select('*')
    .eq('opt_in', true)
    .order(orderColumn, { ascending: false })
    .limit(limit);

  if (error) {
    logger.error('[Leaderboard] Failed to fetch leaderboard:', error);
    return [];
  }

  return (data || []).map((row, index) => ({
    id: row.id,
    userId: row.user_id,
    displayName: row.display_name || 'Zen User',
    weeklyXp: row.weekly_xp || 0,
    monthlyXp: row.monthly_xp || 0,
    allTimeXp: row.all_time_xp || 0,
    currentStreak: row.current_streak || 0,
    longestStreak: row.longest_streak || 0,
    optIn: row.opt_in,
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

  const { data, error } = await supabase
    .from('leaderboards')
    .select('*')
    .eq('user_id', userId)
    .single();

  if (error) {
    if (error.code === 'PGRST116') {
      // No entry found - this is normal for new users
      return null;
    }
    logger.error('[Leaderboard] Failed to fetch user entry:', error);
    return null;
  }

  return {
    id: data.id,
    userId: data.user_id,
    displayName: data.display_name || 'Zen User',
    weeklyXp: data.weekly_xp || 0,
    monthlyXp: data.monthly_xp || 0,
    allTimeXp: data.all_time_xp || 0,
    currentStreak: data.current_streak || 0,
    longestStreak: data.longest_streak || 0,
    optIn: data.opt_in,
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

  // Count total participants
  const { count: total } = await supabase
    .from('leaderboards')
    .select('*', { count: 'exact', head: true })
    .eq('opt_in', true);

  // Get weekly rank
  const { count: weeklyAbove } = await supabase
    .from('leaderboards')
    .select('*', { count: 'exact', head: true })
    .eq('opt_in', true)
    .gt('weekly_xp', userEntry.weeklyXp);

  // Get monthly rank
  const { count: monthlyAbove } = await supabase
    .from('leaderboards')
    .select('*', { count: 'exact', head: true })
    .eq('opt_in', true)
    .gt('monthly_xp', userEntry.monthlyXp);

  // Get streak rank
  const { count: streakAbove } = await supabase
    .from('leaderboards')
    .select('*', { count: 'exact', head: true })
    .eq('opt_in', true)
    .gt('current_streak', userEntry.currentStreak);

  return {
    weeklyRank: (weeklyAbove ?? 0) + 1,
    monthlyRank: (monthlyAbove ?? 0) + 1,
    streakRank: (streakAbove ?? 0) + 1,
    totalParticipants: total ?? 0,
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
    .replace(/[^a-zA-Z0-9 _-]/g, '');

  const finalName = sanitizedName || 'Zen User';

  const { error } = await supabase
    .from('leaderboards')
    .upsert({
      user_id: userId,
      display_name: finalName,
      opt_in: true,
    }, {
      onConflict: 'user_id',
    });

  if (error) {
    logger.error('[Leaderboard] Failed to opt in:', error);
    return false;
  }

  logger.log('[Leaderboard] User opted in:', finalName);
  return true;
}

/**
 * Opt out of the leaderboard
 */
export async function optOutOfLeaderboard(): Promise<boolean> {
  const userId = await getCurrentUserId();
  if (!userId) return false;

  const { error } = await supabase
    .from('leaderboards')
    .update({ opt_in: false })
    .eq('user_id', userId);

  if (error) {
    logger.error('[Leaderboard] Failed to opt out:', error);
    return false;
  }

  logger.log('[Leaderboard] User opted out');
  return true;
}

/**
 * Update display name
 */
export async function updateDisplayName(displayName: string): Promise<boolean> {
  const userId = await getCurrentUserId();
  if (!userId) return false;

  const sanitizedName = displayName
    .trim()
    .slice(0, 20)
    .replace(/[^a-zA-Z0-9 _-]/g, '') || 'Zen User';

  const { error } = await supabase
    .from('leaderboards')
    .update({ display_name: sanitizedName })
    .eq('user_id', userId);

  if (error) {
    logger.error('[Leaderboard] Failed to update display name:', error);
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

  if (existing) {
    // Update existing entry
    const { error } = await supabase
      .from('leaderboards')
      .update({
        weekly_xp: existing.weeklyXp + xpAmount,
        monthly_xp: existing.monthlyXp + xpAmount,
        all_time_xp: existing.allTimeXp + xpAmount,
      })
      .eq('user_id', userId);

    if (error) {
      logger.error('[Leaderboard] Failed to add XP:', error);
    }
  } else {
    // Create new entry (not opted in by default)
    const { error } = await supabase
      .from('leaderboards')
      .insert({
        user_id: userId,
        weekly_xp: xpAmount,
        monthly_xp: xpAmount,
        all_time_xp: xpAmount,
        opt_in: false,
      });

    if (error && error.code !== '23505') { // Ignore duplicate key errors
      logger.error('[Leaderboard] Failed to create entry:', error);
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

  if (existing) {
    const newLongest = Math.max(existing.longestStreak, currentStreak);

    const { error } = await supabase
      .from('leaderboards')
      .update({
        current_streak: currentStreak,
        longest_streak: newLongest,
      })
      .eq('user_id', userId);

    if (error) {
      logger.error('[Leaderboard] Failed to update streak:', error);
    }
  } else {
    // Create new entry
    const { error } = await supabase
      .from('leaderboards')
      .insert({
        user_id: userId,
        current_streak: currentStreak,
        longest_streak: currentStreak,
        opt_in: false,
      });

    if (error && error.code !== '23505') {
      logger.error('[Leaderboard] Failed to create entry:', error);
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
    case 1: return '🥇';
    case 2: return '🥈';
    case 3: return '🥉';
    default: return '';
  }
}

/**
 * Format rank with suffix (1st, 2nd, 3rd, etc.)
 */
export function formatRank(rank: number): string {
  const suffix = ['th', 'st', 'nd', 'rd'];
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

/**
 * Challenge Service - Backend for Friend Challenges
 * Handles Supabase CRUD and real-time sync
 * Part of Phase 5.15 - Participants Leaderboard
 */

import { supabase, getCurrentUserId } from './supabaseClient';
import { logger } from './logger';
import { formatDate } from './utils';
import type {
  FriendChallenge,
  ChallengeMember,
  ChallengeLeaderboard,
  FriendChallengeRow,
  ChallengeMemberRow
} from '@/types/challenges';

// ============================================
// MAPPERS
// ============================================

function mapChallengeRow(row: FriendChallengeRow): FriendChallenge {
  return {
    id: row.id,
    code: row.code,
    creatorId: row.creator_id,
    habitName: row.habit_name,
    habitIcon: row.habit_icon,
    duration: row.duration,
    startDate: row.start_date,
    endDate: row.end_date,
    status: row.status,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function mapMemberRow(row: ChallengeMemberRow, userId?: string): ChallengeMember {
  return {
    id: row.id,
    challengeId: row.challenge_id,
    userId: row.user_id,
    displayName: row.display_name,
    daysCompleted: row.days_completed,
    currentStreak: row.current_streak,
    lastActivityDate: row.last_activity_date,
    completed: row.completed,
    completedAt: row.completed_at,
    joinedAt: row.joined_at,
    isCurrentUser: row.user_id === userId,
  };
}

// ============================================
// AVAILABILITY CHECK
// ============================================

/**
 * Check if cloud challenges are available
 */
export function isCloudChallengesAvailable(): boolean {
  return supabase !== null;
}

// ============================================
// CHALLENGE CRUD
// ============================================

/**
 * Create a new challenge in the cloud
 */
export async function createCloudChallenge(
  habitName: string,
  habitIcon: string,
  duration: number,
  displayName: string
): Promise<FriendChallenge | null> {
  if (!supabase) {
    logger.warn('[ChallengeService] Supabase not configured');
    return null;
  }

  const userId = await getCurrentUserId();
  if (!userId) {
    logger.warn('[ChallengeService] User not authenticated');
    return null;
  }

  const code = generateChallengeCode();
  const startDate = formatDate(new Date());
  const endDate = calculateEndDate(startDate, duration);

  // Create challenge
  const { data: challenge, error: challengeError } = await (supabase.from('friend_challenges') as any)
    .insert({
      code,
      creator_id: userId,
      habit_name: habitName,
      habit_icon: habitIcon,
      duration,
      start_date: startDate,
      end_date: endDate,
    })
    .select()
    .single();

  if (challengeError) {
    logger.error('[ChallengeService] Failed to create challenge:', challengeError);
    return null;
  }

  if (!challenge) return null;

  // Auto-join as creator
  await joinCloudChallenge((challenge as FriendChallengeRow).id, displayName);

  logger.log('[ChallengeService] Challenge created:', code);
  return mapChallengeRow(challenge as FriendChallengeRow);
}

/**
 * Get challenge by code
 */
export async function getChallengeByCode(code: string): Promise<FriendChallenge | null> {
  if (!supabase) return null;

  const { data, error } = await (supabase.from('friend_challenges') as any)
    .select('*')
    .eq('code', code.toUpperCase())
    .single();

  if (error) {
    if (error.code !== 'PGRST116') { // Not "row not found"
      logger.error('[ChallengeService] Failed to get challenge:', error);
    }
    return null;
  }

  return data ? mapChallengeRow(data as FriendChallengeRow) : null;
}

/**
 * Get challenge by ID
 */
export async function getChallengeById(challengeId: string): Promise<FriendChallenge | null> {
  if (!supabase) return null;

  const { data, error } = await (supabase.from('friend_challenges') as any)
    .select('*')
    .eq('id', challengeId)
    .single();

  if (error) {
    if (error.code !== 'PGRST116') {
      logger.error('[ChallengeService] Failed to get challenge:', error);
    }
    return null;
  }

  return data ? mapChallengeRow(data as FriendChallengeRow) : null;
}

// ============================================
// MEMBER OPERATIONS
// ============================================

/**
 * Join a challenge
 */
export async function joinCloudChallenge(
  challengeId: string,
  displayName: string
): Promise<ChallengeMember | null> {
  if (!supabase) return null;

  const userId = await getCurrentUserId();
  if (!userId) return null;

  const { data, error } = await (supabase.from('friend_challenge_members') as any)
    .upsert({
      challenge_id: challengeId,
      user_id: userId,
      display_name: displayName || 'Zen User',
    }, {
      onConflict: 'challenge_id,user_id',
    })
    .select()
    .single();

  if (error) {
    logger.error('[ChallengeService] Failed to join challenge:', error);
    return null;
  }

  logger.log('[ChallengeService] Joined challenge:', challengeId);
  return data ? mapMemberRow(data as ChallengeMemberRow, userId) : null;
}

/**
 * Update my progress in a challenge
 */
export async function updateMyProgress(
  challengeId: string,
  daysCompleted: number,
  currentStreak: number
): Promise<ChallengeMember | null> {
  if (!supabase) return null;

  const userId = await getCurrentUserId();
  if (!userId) return null;

  const { data, error } = await (supabase as any)
    .rpc('update_member_progress', {
      p_challenge_id: challengeId,
      p_user_id: userId,
      p_days_completed: daysCompleted,
      p_current_streak: currentStreak,
    })
    .abortSignal(AbortSignal.timeout(10000));

  if (error) {
    logger.error('[ChallengeService] Failed to update progress:', error);
    return null;
  }

  return data ? mapMemberRow(data as ChallengeMemberRow, userId) : null;
}

/**
 * Leave a challenge
 */
export async function leaveChallenge(challengeId: string): Promise<boolean> {
  if (!supabase) return false;

  const userId = await getCurrentUserId();
  if (!userId) return false;

  const { error } = await supabase
    .from('friend_challenge_members')
    .delete()
    .eq('challenge_id', challengeId)
    .eq('user_id', userId);

  if (error) {
    logger.error('[ChallengeService] Failed to leave challenge:', error);
    return false;
  }

  logger.log('[ChallengeService] Left challenge:', challengeId);
  return true;
}

// ============================================
// LEADERBOARD
// ============================================

/**
 * Get challenge leaderboard with all participants
 */
export async function getChallengeLeaderboard(
  challengeId: string
): Promise<ChallengeLeaderboard | null> {
  if (!supabase) return null;

  const userId = await getCurrentUserId();

  // Get challenge
  const challenge = await getChallengeById(challengeId);
  if (!challenge) return null;

  // Get leaderboard via RPC
  const { data: members, error: membersError } = await (supabase as any)
    .rpc('get_challenge_leaderboard', { p_challenge_id: challengeId })
    .abortSignal(AbortSignal.timeout(10000));

  if (membersError) {
    logger.error('[ChallengeService] Failed to get leaderboard:', membersError);
    return null;
  }

  const memberRows = (members || []) as ChallengeMemberRow[];
  const mappedMembers = memberRows.map((m: ChallengeMemberRow, index: number) => ({
    ...mapMemberRow(m, userId || undefined),
    rank: index + 1,
  }));

  return {
    challenge,
    members: mappedMembers,
    myProgress: mappedMembers.find((m: ChallengeMember) => m.isCurrentUser) || null,
  };
}

/**
 * Get all challenges the user is participating in
 */
export async function getMyChallenges(): Promise<ChallengeLeaderboard[]> {
  if (!supabase) return [];

  const userId = await getCurrentUserId();
  if (!userId) return [];

  // Get challenges where user is a member
  const { data: memberships, error } = await (supabase.from('friend_challenge_members') as any)
    .select('challenge_id')
    .eq('user_id', userId)
    .limit(20);

  if (error) {
    logger.error('[ChallengeService] Failed to get my challenges:', error);
    return [];
  }

  const results: ChallengeLeaderboard[] = [];

  for (const membership of (memberships || []) as { challenge_id: string }[]) {
    const leaderboard = await getChallengeLeaderboard(membership.challenge_id);
    if (leaderboard) {
      results.push(leaderboard);
    }
  }

  return results;
}

/**
 * Check if user is member of a challenge
 */
export async function isChallengeMember(challengeId: string): Promise<boolean> {
  if (!supabase) return false;

  const userId = await getCurrentUserId();
  if (!userId) return false;

  const { data, error } = await supabase
    .from('friend_challenge_members')
    .select('id')
    .eq('challenge_id', challengeId)
    .eq('user_id', userId)
    .single();

  return !error && !!data;
}

// ============================================
// REAL-TIME SUBSCRIPTION
// ============================================

/**
 * Subscribe to real-time updates for a challenge
 * Returns unsubscribe function
 */
export function subscribeToChallenge(
  challengeId: string,
  onUpdate: (members: ChallengeMember[]) => void
): () => void {
  if (!supabase) {
    return () => {}; // No-op unsubscribe
  }

  const channel = supabase
    .channel(`challenge:${challengeId}`)
    .on(
      'postgres_changes',
      {
        event: '*',
        schema: 'public',
        table: 'friend_challenge_members',
        filter: `challenge_id=eq.${challengeId}`,
      },
      async () => {
        // Refetch leaderboard on any change
        const leaderboard = await getChallengeLeaderboard(challengeId);
        if (leaderboard) {
          onUpdate(leaderboard.members);
        }
      }
    )
    .subscribe();

  return () => {
    void supabase.removeChannel(channel);
  };
}

// ============================================
// SYNC WITH LOCAL
// ============================================

/**
 * Sync local challenge to cloud (create if not exists)
 */
export async function syncLocalChallengeToCloud(
  code: string,
  habitName: string,
  habitIcon: string,
  duration: number,
  startDate: string,
  displayName: string
): Promise<FriendChallenge | null> {
  if (!supabase) return null;

  const userId = await getCurrentUserId();
  if (!userId) return null;

  // Check if challenge already exists
  const existing = await getChallengeByCode(code);
  if (existing) {
    // Just join if not already a member
    const isMember = await isChallengeMember(existing.id);
    if (!isMember) {
      await joinCloudChallenge(existing.id, displayName);
    }
    return existing;
  }

  // Create new challenge
  const endDate = calculateEndDate(startDate, duration);

  const { data: challenge, error } = await (supabase.from('friend_challenges') as any)
    .insert({
      code,
      creator_id: userId,
      habit_name: habitName,
      habit_icon: habitIcon,
      duration,
      start_date: startDate,
      end_date: endDate,
    })
    .select()
    .single();

  if (error) {
    // If conflict (challenge exists), try to get it
    if (error.code === '23505') {
      return getChallengeByCode(code);
    }
    logger.error('[ChallengeService] Failed to sync challenge:', error);
    return null;
  }

  if (!challenge) return null;

  // Join as creator
  await joinCloudChallenge((challenge as FriendChallengeRow).id, displayName);

  return mapChallengeRow(challenge as FriendChallengeRow);
}

// ============================================
// HELPERS
// ============================================

function generateChallengeCode(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  const values = crypto.getRandomValues(new Uint8Array(6));
  const code = Array.from(values, v => chars[v % chars.length]).join('');
  return `ZEN-${code}`;
}

function calculateEndDate(startDate: string, duration: number): string {
  // Parse YYYY-MM-DD as local date (not UTC)
  const [y, m, d] = startDate.split('-').map(Number);
  const start = new Date(y, m - 1, d);
  start.setDate(start.getDate() + duration);
  return formatDate(start);
}

// ============================================
// EXPORTS
// ============================================

export default {
  isCloudChallengesAvailable,
  createCloudChallenge,
  getChallengeByCode,
  getChallengeById,
  joinCloudChallenge,
  updateMyProgress,
  leaveChallenge,
  getChallengeLeaderboard,
  getMyChallenges,
  isChallengeMember,
  subscribeToChallenge,
  syncLocalChallengeToCloud,
};

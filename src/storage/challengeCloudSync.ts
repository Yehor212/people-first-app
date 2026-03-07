import { logger } from '@/lib/logger';
import { supabase } from '@/lib/supabaseClient';
import { Challenge, Badge } from '@/types';
import { getChallenges, saveChallenges, getBadges, saveBadges } from '@/lib/challengeStorage';
import { syncOrchestrator } from '@/lib/syncOrchestrator';
import { triggerDataRefresh } from '@/hooks/useIndexedDB';

// Supabase types
interface SupabaseChallenge {
  id: string;
  user_id: string;
  challenge_id: string;
  type: string;
  progress: number;
  target: number;
  completed: boolean;
  started_at: string;
  completed_at: string | null;
  icon: string;
  title: Record<string, string>;
  description: Record<string, string>;
  habit_id: string | null;
  end_date: string | null;
  reward: string | null;
  created_at: string;
  updated_at: string;
}

interface SupabaseBadge {
  id: string;
  user_id: string;
  badge_id: string;
  category: string;
  unlocked: boolean;
  unlocked_at: string | null;
  icon: string;
  title: Record<string, string>;
  description: Record<string, string>;
  requirement: number;
  rarity: string;
  created_at: string;
  updated_at: string;
}

// Convert local Challenge to Supabase format
function challengeToSupabase(challenge: Challenge, userId: string): Partial<SupabaseChallenge> {
  return {
    user_id: userId,
    challenge_id: challenge.id,
    type: challenge.type,
    progress: challenge.progress,
    target: challenge.target,
    completed: challenge.completed,
    started_at: challenge.startDate,
    completed_at: challenge.completedDate || null,
    icon: challenge.icon,
    title: challenge.title,
    description: challenge.description,
    habit_id: challenge.habitId || null,
    end_date: challenge.endDate || null,
    reward: challenge.reward || null,
  };
}

// Convert Supabase Challenge to local format
function supabaseToChallengeLocal(sc: SupabaseChallenge): Challenge {
  return {
    id: sc.challenge_id,
    type: sc.type as Challenge['type'],
    progress: sc.progress,
    target: sc.target,
    completed: sc.completed,
    startDate: sc.started_at,
    completedDate: sc.completed_at || undefined,
    icon: sc.icon,
    title: sc.title,
    description: sc.description,
    habitId: sc.habit_id || undefined,
    endDate: sc.end_date || undefined,
    reward: sc.reward || undefined,
  };
}

// Convert local Badge to Supabase format
function badgeToSupabase(badge: Badge, userId: string): Partial<SupabaseBadge> {
  return {
    user_id: userId,
    badge_id: badge.id,
    category: badge.category,
    unlocked: badge.unlocked,
    unlocked_at: badge.unlockedDate || null,
    icon: badge.icon,
    title: badge.title,
    description: badge.description,
    requirement: badge.requirement,
    rarity: badge.rarity,
  };
}

// Convert Supabase Badge to local format
function supabaseToBadgeLocal(sb: SupabaseBadge): Badge {
  return {
    id: sb.badge_id,
    category: sb.category as Badge['category'],
    unlocked: sb.unlocked,
    unlockedDate: sb.unlocked_at || undefined,
    icon: sb.icon,
    title: sb.title,
    description: sb.description,
    requirement: sb.requirement,
    rarity: sb.rarity as Badge['rarity'],
  };
}

// Sync challenges with cloud
export async function syncChallengesWithCloud(userId: string): Promise<{
  challenges: Challenge[];
  error?: string;
}> {
  if (!supabase) return { challenges: getChallenges() };

  // Use orchestrator for queue-based sync
  let result: { challenges: Challenge[]; error?: string } = {
    challenges: getChallenges(),
  };

  await syncOrchestrator.sync('challenges', async () => {
    try {
      // 1. Get local challenges
      const localChallenges = getChallenges();

      // 2. Pull from cloud
      const { data: cloudChallenges, error: fetchError } = await (supabase
        .from('user_challenges') as any)
        .select('*')
        .eq('user_id', userId)
        .order('updated_at', { ascending: false })
        .limit(100);

      if (fetchError) {
        logger.error('Failed to fetch challenges from cloud:', fetchError);
        result = { challenges: localChallenges, error: fetchError.message };
        throw new Error(fetchError.message);
      }

      // 3. P1-1 Fix: Merge logic with progress-based conflict resolution
      // Use the version with more progress (not just cloud wins)
      const cloudMap = new Map<string, SupabaseChallenge>();
      (cloudChallenges || []).forEach(cc => {
        cloudMap.set(cc.challenge_id, cc);
      });

      const localMap = new Map<string, Challenge>();
      localChallenges.forEach(lc => {
        localMap.set(lc.id, lc);
      });

      // Merged challenges
      const merged: Challenge[] = [];
      const toUpsert: Partial<SupabaseChallenge>[] = [];

      // Process all challenges (merge conflicts by progress)
      const allChallengeIds = new Set([...cloudMap.keys(), ...localMap.keys()]);

      allChallengeIds.forEach(challengeId => {
        const cloudChallenge = cloudMap.get(challengeId);
        const localChallenge = localMap.get(challengeId);

        if (cloudChallenge && localChallenge) {
          // Both exist - use the one with more progress, or completed one
          const cloudConverted = supabaseToChallengeLocal(cloudChallenge);
          if (localChallenge.completed && !cloudConverted.completed) {
            // Local is completed, cloud is not - use local
            merged.push(localChallenge);
            toUpsert.push(challengeToSupabase(localChallenge, userId));
          } else if (cloudConverted.completed && !localChallenge.completed) {
            // Cloud is completed, local is not - use cloud
            merged.push(cloudConverted);
          } else if (localChallenge.progress > cloudConverted.progress) {
            // Local has more progress - use local
            merged.push(localChallenge);
            toUpsert.push(challengeToSupabase(localChallenge, userId));
          } else {
            // Cloud has equal or more progress - use cloud
            merged.push(cloudConverted);
          }
        } else if (cloudChallenge) {
          // Cloud-only challenge
          merged.push(supabaseToChallengeLocal(cloudChallenge));
        } else if (localChallenge) {
          // Local-only challenge - push to cloud
          merged.push(localChallenge);
          toUpsert.push(challengeToSupabase(localChallenge, userId));
        }
      });

      // 4. Push local-only challenges to cloud
      if (toUpsert.length > 0) {
        const { error: upsertError } = await (supabase
          .from('user_challenges') as any)
          .upsert(toUpsert, { onConflict: 'user_id,challenge_id' });

        if (upsertError) {
          logger.error('Failed to push challenges to cloud:', upsertError);
          throw new Error(upsertError.message);
        }
      }

      // 5. Save merged challenges locally
      saveChallenges(merged);

      // Trigger React state refresh so UI updates
      triggerDataRefresh();
      logger.log('[ChallengesSync] Data refresh triggered after merge');

      result = { challenges: merged };
    } catch (error) {
      logger.error('Sync challenges error:', error);
      result = {
        challenges: getChallenges(),
        error: error instanceof Error ? error.message : 'Unknown error'
      };
      throw error;
    }
  }, { priority: 6, maxRetries: 3 });

  if (result.error) {
    logger.warn('[Sync] Operation failed, will retry via orchestrator');
  }

  return result;
}

// Push single challenge update to cloud
export async function pushChallengeUpdate(userId: string, challenge: Challenge): Promise<boolean> {
  if (!supabase) return false;
  try {
    const { error } = await (supabase
      .from('user_challenges') as any)
      .upsert(challengeToSupabase(challenge, userId), {
        onConflict: 'user_id,challenge_id'
      });

    if (error) {
      logger.error('Failed to push challenge update:', error);
      return false;
    }

    return true;
  } catch (error) {
    logger.error('Push challenge update error:', error);
    return false;
  }
}

/**
 * P2-2 Fix: Delete a challenge from cloud
 * Call this when a challenge is deleted/expired locally
 */
export async function deleteChallengeFromCloud(userId: string, challengeId: string): Promise<boolean> {
  if (!supabase) return false;
  if (!challengeId || typeof challengeId !== 'string') {
    logger.warn('[ChallengesSync] Invalid challengeId for delete:', challengeId);
    return false;
  }

  try {
    const { error } = await (supabase
      .from('user_challenges') as any)
      .delete()
      .eq('user_id', userId)
      .eq('challenge_id', challengeId);

    if (error) {
      logger.error('[ChallengesSync] Failed to delete challenge from cloud:', error);
      return false;
    }

    logger.log('[ChallengesSync] Challenge deleted from cloud:', challengeId);
    return true;
  } catch (error) {
    logger.error('[ChallengesSync] Delete challenge error:', error);
    return false;
  }
}

/**
 * P2-2 Fix: Delete a badge from cloud
 * Call this when a badge needs to be removed (rare case)
 */
export async function deleteBadgeFromCloud(userId: string, badgeId: string): Promise<boolean> {
  if (!supabase) return false;
  if (!badgeId || typeof badgeId !== 'string') {
    logger.warn('[BadgesSync] Invalid badgeId for delete:', badgeId);
    return false;
  }

  try {
    const { error } = await (supabase
      .from('user_badges') as any)
      .delete()
      .eq('user_id', userId)
      .eq('badge_id', badgeId);

    if (error) {
      logger.error('[BadgesSync] Failed to delete badge from cloud:', error);
      return false;
    }

    logger.log('[BadgesSync] Badge deleted from cloud:', badgeId);
    return true;
  } catch (error) {
    logger.error('[BadgesSync] Delete badge error:', error);
    return false;
  }
}

// Sync badges with cloud
export async function syncBadgesWithCloud(userId: string): Promise<{
  badges: Badge[];
  error?: string;
}> {
  if (!supabase) return { badges: getBadges() };

  // Use orchestrator for queue-based sync
  let result: { badges: Badge[]; error?: string } = {
    badges: getBadges(),
  };

  await syncOrchestrator.sync('badges', async () => {
    try {
      // 1. Get local badges
      const localBadges = getBadges();

      // 2. Pull from cloud
      const { data: cloudBadges, error: fetchError } = await (supabase
        .from('user_badges') as any)
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: false })
        .limit(200);

      if (fetchError) {
        logger.error('Failed to fetch badges from cloud:', fetchError);
        result = { badges: localBadges, error: fetchError.message };
        throw new Error(fetchError.message);
      }

      // 3. Merge logic: cloud wins for unlocked status
      const cloudMap = new Map<string, SupabaseBadge>();
      (cloudBadges || []).forEach(cb => {
        cloudMap.set(cb.badge_id, cb);
      });

      const localMap = new Map<string, Badge>();
      localBadges.forEach(lb => {
        localMap.set(lb.id, lb);
      });

      // Merged badges
      const merged: Badge[] = [];
      const toUpsert: Partial<SupabaseBadge>[] = [];

      // P1-7 Fix: Process ALL badges (both local and cloud)
      // Previously only iterated localMap, losing cloud-only badges
      const allBadgeIds = new Set([...localMap.keys(), ...cloudMap.keys()]);

      allBadgeIds.forEach(badgeId => {
        const localBadge = localMap.get(badgeId);
        const cloudBadge = cloudMap.get(badgeId);

        if (localBadge && cloudBadge) {
          // Both exist - prefer unlocked status from either source
          const cloudConverted = supabaseToBadgeLocal(cloudBadge);
          if (localBadge.unlocked && !cloudConverted.unlocked) {
            // Local is unlocked, cloud is not - use local and push to cloud
            merged.push(localBadge);
            toUpsert.push(badgeToSupabase(localBadge, userId));
          } else {
            // Cloud is unlocked or both same - use cloud
            merged.push(cloudConverted);
          }
        } else if (cloudBadge) {
          // Cloud-only badge - P1-7 Fix: This was previously lost!
          merged.push(supabaseToBadgeLocal(cloudBadge));
        } else if (localBadge) {
          // Local-only badge
          merged.push(localBadge);
          if (localBadge.unlocked) {
            // If unlocked locally, push to cloud
            toUpsert.push(badgeToSupabase(localBadge, userId));
          }
        }
      });

      // 4. Push local-only unlocked badges to cloud
      if (toUpsert.length > 0) {
        const { error: upsertError } = await (supabase
          .from('user_badges') as any)
          .upsert(toUpsert, { onConflict: 'user_id,badge_id' });

        if (upsertError) {
          logger.error('Failed to push badges to cloud:', upsertError);
          throw new Error(upsertError.message);
        }
      }

      // 5. Save merged badges locally
      saveBadges(merged);

      // Trigger React state refresh so UI updates
      triggerDataRefresh();
      logger.log('[BadgesSync] Data refresh triggered after merge');

      result = { badges: merged };
    } catch (error) {
      logger.error('Sync badges error:', error);
      result = {
        badges: getBadges(),
        error: error instanceof Error ? error.message : 'Unknown error'
      };
      throw error;
    }
  }, { priority: 6, maxRetries: 3 });

  if (result.error) {
    logger.warn('[Sync] Operation failed, will retry via orchestrator');
  }

  return result;
}

// Push badge unlock to cloud
export async function pushBadgeUnlock(userId: string, badge: Badge): Promise<boolean> {
  if (!supabase) return false;
  try {
    const { error } = await (supabase
      .from('user_badges') as any)
      .upsert(badgeToSupabase(badge, userId), {
        onConflict: 'user_id,badge_id'
      });

    if (error) {
      logger.error('Failed to push badge unlock:', error);
      return false;
    }

    return true;
  } catch (error) {
    logger.error('Push badge unlock error:', error);
    return false;
  }
}

/**
 * DISABLED: Realtime subscriptions for challenges and badges
 *
 * Performance optimization: WAL query was consuming 96% of database time.
 * Data syncs on app resume via pullChallengesFromCloud() instead.
 */

// Subscribe to real-time challenge updates (DISABLED)
export function subscribeToChallengeUpdates(
  _userId: string,
  _onUpdate: (challenge: Challenge) => void
): () => void {
  // Disabled for performance - data syncs on app resume
  return () => {};
}

// Subscribe to real-time badge updates (DISABLED)
export function subscribeToBadgeUpdates(
  _userId: string,
  _onUpdate: (badge: Badge) => void
): () => void {
  // Disabled for performance - data syncs on app resume
  return () => {};
}

// Initialize badges in cloud for new users
export async function initializeBadgesInCloud(userId: string, badges: Badge[]): Promise<boolean> {
  try {
    const badgesToInsert = badges.map(badge => badgeToSupabase(badge, userId));

    const { error } = await (supabase
      .from('user_badges') as any)
      .upsert(badgesToInsert, { onConflict: 'user_id,badge_id' });

    if (error) {
      logger.error('Failed to initialize badges in cloud:', error);
      return false;
    }

    return true;
  } catch (error) {
    logger.error('Initialize badges error:', error);
    return false;
  }
}

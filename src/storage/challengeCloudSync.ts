import { logger } from '@/lib/logger';
import { supabase } from '@/lib/supabaseClient';
import { Challenge, Badge } from '@/types';
import { getChallenges, saveChallenges, getBadges, saveBadges } from '@/lib/challengeStorage';
import { syncOrchestrator } from '@/lib/syncOrchestrator';
import { triggerDataRefresh } from '@/hooks/useIndexedDB';
import type { Json } from '@/types/supabase';
import {
  SyncOwnerBoundaryError,
  validateSyncOwner,
} from '@/storage/sync/syncOwner';

async function assertChallengeSyncOwner(
  expectedOwnerUserId: string,
  operation: string
): Promise<void> {
  if (!(await validateSyncOwner(expectedOwnerUserId, operation))) {
    throw new SyncOwnerBoundaryError(operation);
  }
}

// Convert local Challenge to Supabase format (matches DB Insert type)
function challengeToSupabase(challenge: Challenge, userId: string) {
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
    title: challenge.title as unknown as Json,
    description: challenge.description as unknown as Json,
    habit_id: challenge.habitId || null,
    end_date: challenge.endDate || null,
    reward: challenge.reward || null,
    updated_at: new Date().toISOString(),
  };
}

// Convert Supabase Challenge to local format (handles nullable DB fields)
function supabaseToChallengeLocal(sc: Record<string, unknown>): Challenge {
  return {
    id: sc.challenge_id as string,
    type: sc.type as Challenge['type'],
    progress: (sc.progress as number) ?? 0,
    target: sc.target as number,
    completed: (sc.completed as boolean) ?? false,
    startDate: (sc.started_at as string) ?? new Date().toISOString(),
    completedDate: (sc.completed_at as string) || undefined,
    icon: sc.icon as string,
    title: sc.title as Record<string, string>,
    description: sc.description as Record<string, string>,
    habitId: (sc.habit_id as string) || undefined,
    endDate: (sc.end_date as string) || undefined,
    reward: (sc.reward as string) || undefined,
  };
}

// Convert local Badge to Supabase format (matches DB Insert type)
function badgeToSupabase(badge: Badge, userId: string) {
  return {
    user_id: userId,
    badge_id: badge.id,
    category: badge.category,
    unlocked: badge.unlocked,
    unlocked_at: badge.unlockedDate || null,
    icon: badge.icon,
    title: badge.title as unknown as Json,
    description: badge.description as unknown as Json,
    requirement: badge.requirement,
    rarity: badge.rarity,
    updated_at: new Date().toISOString(),
  };
}

// Convert Supabase Badge to local format (handles nullable DB fields)
function supabaseToBadgeLocal(sb: Record<string, unknown>): Badge {
  return {
    id: sb.badge_id as string,
    category: sb.category as Badge['category'],
    unlocked: (sb.unlocked as boolean) ?? false,
    unlockedDate: (sb.unlocked_at as string) || undefined,
    icon: sb.icon as string,
    title: sb.title as Record<string, string>,
    description: sb.description as Record<string, string>,
    requirement: sb.requirement as number,
    rarity: sb.rarity as Badge['rarity'],
  };
}

// Sync challenges with cloud
export async function syncChallengesWithCloud(userId: string): Promise<{
  challenges: Challenge[];
  error?: string;
}> {
  const client = supabase;
  if (!client) return { challenges: getChallenges() };
  await assertChallengeSyncOwner(userId, 'Challenge sync start');

  // Use orchestrator for queue-based sync
  let result: { challenges: Challenge[]; error?: string } = {
    challenges: getChallenges(),
  };

  await syncOrchestrator.sync('challenges', async () => {
    try {
      // 1. Get local challenges
      const localChallenges = getChallenges();

      // 2. Pull from cloud
      const { data: cloudChallenges, error: fetchError } = await client
        .from('user_challenges')
        .select('*')
        .eq('user_id', userId)
        .order('updated_at', { ascending: false })
        .limit(100);

      if (fetchError) {
        logger.error('[ChallengesSync] Failed to fetch challenges from cloud:', fetchError);
        result = { challenges: localChallenges, error: fetchError.message };
        throw new Error(fetchError.message);
      }

      // 3. P1-1 Fix: Merge logic with progress-based conflict resolution
      // Use the version with more progress (not just cloud wins)
      const cloudMap = new Map<string, Record<string, unknown>>();
      (cloudChallenges || []).forEach(cc => {
        cloudMap.set(cc.challenge_id, cc);
      });

      const localMap = new Map<string, Challenge>();
      localChallenges.forEach(lc => {
        localMap.set(lc.id, lc);
      });

      // Merged challenges
      const merged: Challenge[] = [];
      const toUpsert: ReturnType<typeof challengeToSupabase>[] = [];

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
        const { error: upsertError } = await client
          .from('user_challenges')
          .upsert(toUpsert, { onConflict: 'user_id,challenge_id' });

        if (upsertError) {
          logger.error('[ChallengesSync] Failed to push challenges to cloud:', upsertError);
          throw new Error(upsertError.message);
        }
      }

      // 5. Save merged challenges locally
      await assertChallengeSyncOwner(userId, 'Challenge local merge');
      saveChallenges(merged);

      // Trigger React state refresh so UI updates
      await triggerDataRefresh();
      await assertChallengeSyncOwner(userId, 'Challenge refresh completion');
      logger.log('[ChallengesSync] Data refresh triggered after merge');

      result = { challenges: merged };
    } catch (error) {
      logger.error('[ChallengesSync] Sync challenges error:', error);
      result = {
        challenges: result.challenges,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
      throw error;
    }
  }, { priority: 6, maxRetries: 3, expectedOwnerUserId: userId });

  if (result.error) {
    logger.warn('[Sync] Operation failed, will retry via orchestrator');
  }

  return result;
}

// Push single challenge update to cloud
export async function pushChallengeUpdate(userId: string, challenge: Challenge): Promise<boolean> {
  const client = supabase;
  if (!client) return false;
  try {
    const { error } = await client
      .from('user_challenges')
      .upsert(challengeToSupabase(challenge, userId), {
        onConflict: 'user_id,challenge_id'
      });

    if (error) {
      logger.error('[ChallengesSync] Failed to push challenge update:', error);
      return false;
    }

    return true;
  } catch (error) {
    logger.error('[ChallengesSync] Push challenge update error:', error);
    return false;
  }
}

/**
 * P2-2 Fix: Delete a challenge from cloud
 * Call this when a challenge is deleted/expired locally
 */
export async function deleteChallengeFromCloud(userId: string, challengeId: string): Promise<boolean> {
  const client = supabase;
  if (!client) return false;
  if (!challengeId || typeof challengeId !== 'string') {
    logger.warn('[ChallengesSync] Invalid challengeId for delete:', challengeId);
    return false;
  }

  try {
    const { error } = await client
      .from('user_challenges')
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
  const client = supabase;
  if (!client) return false;
  if (!badgeId || typeof badgeId !== 'string') {
    logger.warn('[BadgesSync] Invalid badgeId for delete:', badgeId);
    return false;
  }

  try {
    const { error } = await client
      .from('user_badges')
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
  const client = supabase;
  if (!client) return { badges: getBadges() };
  await assertChallengeSyncOwner(userId, 'Badge sync start');

  // Use orchestrator for queue-based sync
  let result: { badges: Badge[]; error?: string } = {
    badges: getBadges(),
  };

  await syncOrchestrator.sync('badges', async () => {
    try {
      // 1. Get local badges
      const localBadges = getBadges();

      // 2. Pull from cloud
      const { data: cloudBadges, error: fetchError } = await client
        .from('user_badges')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: false })
        .limit(200);

      if (fetchError) {
        logger.error('[BadgesSync] Failed to fetch badges from cloud:', fetchError);
        result = { badges: localBadges, error: fetchError.message };
        throw new Error(fetchError.message);
      }

      // 3. Merge logic: cloud wins for unlocked status
      const cloudMap = new Map<string, Record<string, unknown>>();
      (cloudBadges || []).forEach(cb => {
        cloudMap.set(cb.badge_id, cb);
      });

      const localMap = new Map<string, Badge>();
      localBadges.forEach(lb => {
        localMap.set(lb.id, lb);
      });

      // Merged badges
      const merged: Badge[] = [];
      const toUpsert: ReturnType<typeof badgeToSupabase>[] = [];

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
        const { error: upsertError } = await client
          .from('user_badges')
          .upsert(toUpsert, { onConflict: 'user_id,badge_id' });

        if (upsertError) {
          logger.error('[BadgesSync] Failed to push badges to cloud:', upsertError);
          throw new Error(upsertError.message);
        }
      }

      // 5. Save merged badges locally
      await assertChallengeSyncOwner(userId, 'Badge local merge');
      saveBadges(merged);

      // Trigger React state refresh so UI updates
      await triggerDataRefresh();
      await assertChallengeSyncOwner(userId, 'Badge refresh completion');
      logger.log('[BadgesSync] Data refresh triggered after merge');

      result = { badges: merged };
    } catch (error) {
      logger.error('[BadgesSync] Sync badges error:', error);
      result = {
        badges: result.badges,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
      throw error;
    }
  }, { priority: 6, maxRetries: 3, expectedOwnerUserId: userId });

  if (result.error) {
    logger.warn('[Sync] Operation failed, will retry via orchestrator');
  }

  return result;
}

// Push badge unlock to cloud
export async function pushBadgeUnlock(userId: string, badge: Badge): Promise<boolean> {
  const client = supabase;
  if (!client) return false;
  try {
    const { error } = await client
      .from('user_badges')
      .upsert(badgeToSupabase(badge, userId), {
        onConflict: 'user_id,badge_id'
      });

    if (error) {
      logger.error('[BadgesSync] Failed to push badge unlock:', error);
      return false;
    }

    return true;
  } catch (error) {
    logger.error('[BadgesSync] Push badge unlock error:', error);
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
  const client = supabase;
  if (!client) return false;
  try {
    const badgesToInsert = badges.map(badge => badgeToSupabase(badge, userId));

    const { error } = await client
      .from('user_badges')
      .upsert(badgesToInsert, { onConflict: 'user_id,badge_id' });

    if (error) {
      logger.error('[BadgesSync] Failed to initialize badges in cloud:', error);
      return false;
    }

    return true;
  } catch (error) {
    logger.error('[BadgesSync] Initialize badges error:', error);
    return false;
  }
}

import { supabase } from '@/lib/supabaseClient';
import { Challenge, Badge } from '@/types';
import { getChallenges, saveChallenges, getBadges, saveBadges } from '@/lib/challengeStorage';

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
  try {
    // 1. Get local challenges
    const localChallenges = getChallenges();

    // 2. Pull from cloud
    const { data: cloudChallenges, error: fetchError } = await supabase
      .from('user_challenges')
      .select('*')
      .eq('user_id', userId);

    if (fetchError) {
      console.error('Failed to fetch challenges from cloud:', fetchError);
      return { challenges: localChallenges, error: fetchError.message };
    }

    // 3. Merge logic: cloud wins for conflicts (latest updated_at)
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

    // Process cloud challenges
    cloudMap.forEach((cloudChallenge, challengeId) => {
      merged.push(supabaseToChallengeLocal(cloudChallenge));
    });

    // Process local-only challenges (need to push to cloud)
    localMap.forEach((localChallenge, challengeId) => {
      if (!cloudMap.has(challengeId)) {
        merged.push(localChallenge);
        toUpsert.push(challengeToSupabase(localChallenge, userId));
      }
    });

    // 4. Push local-only challenges to cloud
    if (toUpsert.length > 0) {
      const { error: upsertError } = await supabase
        .from('user_challenges')
        .upsert(toUpsert, { onConflict: 'user_id,challenge_id' });

      if (upsertError) {
        console.error('Failed to push challenges to cloud:', upsertError);
      }
    }

    // 5. Save merged challenges locally
    saveChallenges(merged);

    return { challenges: merged };
  } catch (error) {
    console.error('Sync challenges error:', error);
    return {
      challenges: getChallenges(),
      error: error instanceof Error ? error.message : 'Unknown error'
    };
  }
}

// Push single challenge update to cloud
export async function pushChallengeUpdate(userId: string, challenge: Challenge): Promise<boolean> {
  try {
    const { error } = await supabase
      .from('user_challenges')
      .upsert(challengeToSupabase(challenge, userId), {
        onConflict: 'user_id,challenge_id'
      });

    if (error) {
      console.error('Failed to push challenge update:', error);
      return false;
    }

    return true;
  } catch (error) {
    console.error('Push challenge update error:', error);
    return false;
  }
}

// Sync badges with cloud
export async function syncBadgesWithCloud(userId: string): Promise<{
  badges: Badge[];
  error?: string;
}> {
  try {
    // 1. Get local badges
    const localBadges = getBadges();

    // 2. Pull from cloud
    const { data: cloudBadges, error: fetchError } = await supabase
      .from('user_badges')
      .select('*')
      .eq('user_id', userId);

    if (fetchError) {
      console.error('Failed to fetch badges from cloud:', fetchError);
      return { badges: localBadges, error: fetchError.message };
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

    // Process all local badges
    localMap.forEach((localBadge, badgeId) => {
      const cloudBadge = cloudMap.get(badgeId);

      if (cloudBadge) {
        // Cloud exists: use cloud unlock status
        merged.push(supabaseToBadgeLocal(cloudBadge));
      } else {
        // Local only: keep local
        merged.push(localBadge);
        if (localBadge.unlocked) {
          // If unlocked locally, push to cloud
          toUpsert.push(badgeToSupabase(localBadge, userId));
        }
      }
    });

    // 4. Push local-only unlocked badges to cloud
    if (toUpsert.length > 0) {
      const { error: upsertError } = await supabase
        .from('user_badges')
        .upsert(toUpsert, { onConflict: 'user_id,badge_id' });

      if (upsertError) {
        console.error('Failed to push badges to cloud:', upsertError);
      }
    }

    // 5. Save merged badges locally
    saveBadges(merged);

    return { badges: merged };
  } catch (error) {
    console.error('Sync badges error:', error);
    return {
      badges: getBadges(),
      error: error instanceof Error ? error.message : 'Unknown error'
    };
  }
}

// Push badge unlock to cloud
export async function pushBadgeUnlock(userId: string, badge: Badge): Promise<boolean> {
  try {
    const { error } = await supabase
      .from('user_badges')
      .upsert(badgeToSupabase(badge, userId), {
        onConflict: 'user_id,badge_id'
      });

    if (error) {
      console.error('Failed to push badge unlock:', error);
      return false;
    }

    return true;
  } catch (error) {
    console.error('Push badge unlock error:', error);
    return false;
  }
}

// Subscribe to real-time challenge updates
export function subscribeToChallengeUpdates(
  userId: string,
  onUpdate: (challenge: Challenge) => void
) {
  const subscription = supabase
    .channel('user_challenges')
    .on(
      'postgres_changes',
      {
        event: '*',
        schema: 'public',
        table: 'user_challenges',
        filter: `user_id=eq.${userId}`
      },
      (payload) => {
        if (payload.new) {
          const challenge = supabaseToChallengeLocal(payload.new as SupabaseChallenge);
          onUpdate(challenge);
        }
      }
    )
    .subscribe();

  return subscription;
}

// Subscribe to real-time badge updates
export function subscribeToBadgeUpdates(
  userId: string,
  onUpdate: (badge: Badge) => void
) {
  const subscription = supabase
    .channel('user_badges')
    .on(
      'postgres_changes',
      {
        event: '*',
        schema: 'public',
        table: 'user_badges',
        filter: `user_id=eq.${userId}`
      },
      (payload) => {
        if (payload.new) {
          const badge = supabaseToBadgeLocal(payload.new as SupabaseBadge);
          onUpdate(badge);
        }
      }
    )
    .subscribe();

  return subscription;
}

// Initialize badges in cloud for new users
export async function initializeBadgesInCloud(userId: string, badges: Badge[]): Promise<boolean> {
  try {
    const badgesToInsert = badges.map(badge => badgeToSupabase(badge, userId));

    const { error } = await supabase
      .from('user_badges')
      .upsert(badgesToInsert, { onConflict: 'user_id,badge_id' });

    if (error) {
      console.error('Failed to initialize badges in cloud:', error);
      return false;
    }

    return true;
  } catch (error) {
    console.error('Initialize badges error:', error);
    return false;
  }
}

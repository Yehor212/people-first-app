// Inner World Cloud Synchronization with Supabase

import { logger } from '@/lib/logger';
import { safeLocalStorageSet } from '@/lib/safeJson';
import { supabase } from '@/lib/supabaseClient';
import { InnerWorld } from '@/types';

const INNER_WORLD_STORAGE_KEY = 'zenflow-inner-world';

// Sync lock to prevent race conditions
let isInnerWorldSyncing = false;

/**
 * Push Inner World state to Supabase
 */
export async function pushInnerWorldToCloud(world: InnerWorld): Promise<void> {
  if (!supabase) return;

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return;

  try {
    const { error } = await supabase
      .from('user_inner_world')
      .upsert({
        user_id: user.id,
        world_data: world,
        updated_at: new Date().toISOString(),
      }, {
        onConflict: 'user_id',
      });

    if (error) {
      // Table might not exist yet - that's ok, we'll just use local storage
      if (error.code !== '42P01') { // relation does not exist
        logger.error('[InnerWorld] Error pushing to cloud:', error);
      }
    }
  } catch (err) {
    logger.error('[InnerWorld] Push error:', err);
  }
}

/**
 * Pull Inner World state from Supabase
 */
export async function pullInnerWorldFromCloud(): Promise<InnerWorld | null> {
  if (!supabase) return null;

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;

  try {
    const { data, error } = await supabase
      .from('user_inner_world')
      .select('world_data')
      .eq('user_id', user.id)
      .single();

    if (error) {
      // Table might not exist or no data - that's ok
      if (error.code !== 'PGRST116' && error.code !== '42P01') {
        logger.error('[InnerWorld] Error pulling from cloud:', error);
      }
      return null;
    }

    // Validate the data before returning
    const worldData = data?.world_data;
    if (worldData && typeof worldData === 'object' && typeof (worldData as InnerWorld).treatsBalance === 'number') {
      return worldData as InnerWorld;
    }
    return null;
  } catch (err) {
    logger.error('[InnerWorld] Pull error:', err);
    return null;
  }
}

/**
 * Sync Inner World: merge local and cloud state
 * Uses lock to prevent race conditions
 */
export async function syncInnerWorld(localWorld: InnerWorld): Promise<InnerWorld> {
  if (isInnerWorldSyncing) {
    // If already syncing, just return local state
    return localWorld;
  }

  isInnerWorldSyncing = true;

  try {
    const cloudWorld = await pullInnerWorldFromCloud();

    if (!cloudWorld) {
      // No cloud data - push local to cloud
      await pushInnerWorldToCloud(localWorld);
      return localWorld;
    }

    // Merge strategy: use the one with more progress (higher streak or more plants)
    const localScore = (localWorld.currentActiveStreak || 0) + (localWorld.plants?.length || 0);
    const cloudScore = (cloudWorld.currentActiveStreak || 0) + (cloudWorld.plants?.length || 0);

    const winner = cloudScore > localScore ? cloudWorld : localWorld;

    // Save merged state (use safe wrapper for Safari Private Mode)
    safeLocalStorageSet(INNER_WORLD_STORAGE_KEY, winner);
    await pushInnerWorldToCloud(winner);

    return winner;
  } finally {
    isInnerWorldSyncing = false;
  }
}

/**
 * Subscribe to real-time Inner World updates
 */
export function subscribeToInnerWorldUpdates(
  userId: string,
  callback: (world: InnerWorld) => void
): () => void {
  if (!supabase || !userId) {
    return () => {};
  }

  const channel = supabase
    .channel(`inner_world_${userId}`)
    .on(
      'postgres_changes',
      {
        event: '*',
        schema: 'public',
        table: 'user_inner_world',
        filter: `user_id=eq.${userId}`,
      },
      (payload) => {
        const newData = payload.new as Record<string, unknown> | null;
        if (newData && typeof newData.world_data === 'object' && newData.world_data !== null) {
          const worldData = newData.world_data as InnerWorld;
          // Basic validation: check required properties exist
          if (worldData && typeof worldData.treatsBalance === 'number') {
            callback(worldData);
          }
        }
      }
    )
    .subscribe();

  return () => {
    channel.unsubscribe();
    supabase.removeChannel(channel);
  };
}

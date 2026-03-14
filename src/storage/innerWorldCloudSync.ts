// Inner World Cloud Synchronization with Supabase

import { logger } from '@/lib/logger';
import { safeLocalStorageSet } from '@/lib/safeJson';
import { SK } from '@/lib/storageKeys';
import { supabase } from '@/lib/supabaseClient';
import { InnerWorld } from '@/types';
import { Json } from '@/types/supabase';
import { z } from 'zod';

/**
 * P2-8 Fix: Zod schema for validating InnerWorld cloud data
 * Validates critical fields to prevent data corruption
 */
const innerWorldSchema = z.object({
  treats: z.object({
    balance: z.number(),
    lifetimeEarned: z.number().optional(),
    lifetimeSpent: z.number().optional(),
  }),
  plants: z.array(z.object({
    id: z.string(),
    type: z.string(),
    stage: z.string(),
  })).optional().default([]),
  creatures: z.array(z.unknown()).optional().default([]),
  currentActiveStreak: z.number().optional().default(0),
  longestActiveStreak: z.number().optional().default(0),
  lastActiveDate: z.string().optional().default(''),
  daysActive: z.number().optional().default(0),
  companion: z.object({
    level: z.number().optional(),
    experience: z.number().optional(),
  }).passthrough().optional(),
}).passthrough(); // Allow additional fields for forward compatibility

/**
 * P2-8 Fix: Validate InnerWorld data from cloud
 */
function validateInnerWorldData(data: unknown): InnerWorld | null {
  const result = innerWorldSchema.safeParse(data);
  if (!result.success) {
    logger.warn('[InnerWorld] Cloud data validation failed:', result.error.issues);
    return null;
  }
  return data as InnerWorld;
}

// P1-8 Fix: Promise-based lock instead of boolean flag
// The boolean flag had a race condition where two concurrent calls
// could both see isInnerWorldSyncing === false before either sets it true
// With a Promise, concurrent callers wait for and return the same result
let syncInnerWorldPromise: Promise<InnerWorld> | null = null;

/**
 * Push Inner World state to Supabase
 */
export async function pushInnerWorldToCloud(world: InnerWorld): Promise<void> {
  if (!supabase) return;

  const { data: { session } } = await supabase.auth.getSession();
  if (!session?.user) return;
  const user = session.user;

  try {
    const { error } = await supabase
      .from('user_inner_world')
      .upsert({
        user_id: user.id,
        world_data: world as unknown as Json,
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

  const { data: { session } } = await supabase.auth.getSession();
  if (!session?.user) return null;
  const user = session.user;

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

    if (!data) return null;

    // P2-8 Fix: Use Zod schema for comprehensive validation
    const worldData = data.world_data;
    return validateInnerWorldData(worldData);
  } catch (err) {
    logger.error('[InnerWorld] Pull error:', err);
    return null;
  }
}

/**
 * Sync Inner World: merge local and cloud state
 * P1-8 Fix: Uses Promise-based lock to prevent race conditions
 * Concurrent callers will wait for and receive the same result
 */
export async function syncInnerWorld(localWorld: InnerWorld): Promise<InnerWorld> {
  // P1-8 Fix: If sync is already in progress, wait for it and return its result
  // This prevents duplicate syncs and ensures all callers get consistent data
  // eslint-disable-next-line @typescript-eslint/no-misused-promises
  if (syncInnerWorldPromise) {
    try {
      return await syncInnerWorldPromise;
    } catch {
      // If the ongoing sync fails, return local state as fallback
      return localWorld;
    }
  }

  // Create a new sync promise
  syncInnerWorldPromise = doSyncInnerWorld(localWorld);

  try {
    return await syncInnerWorldPromise;
  } finally {
    syncInnerWorldPromise = null;
  }
}

/**
 * Internal sync implementation (called within Promise lock)
 */
async function doSyncInnerWorld(localWorld: InnerWorld): Promise<InnerWorld> {
  const cloudWorld = await pullInnerWorldFromCloud();

  if (!cloudWorld) {
    // No cloud data - push local to cloud
    await pushInnerWorldToCloud(localWorld);
    return localWorld;
  }

  // Merge strategy: use the one with more progress (higher streak or more plants)
  // P1-4 Fix: On tie, use the one with more recent lastActiveDate
  const localScore = (localWorld.currentActiveStreak || 0) + (localWorld.plants?.length || 0);
  const cloudScore = (cloudWorld.currentActiveStreak || 0) + (cloudWorld.plants?.length || 0);

  let winner: InnerWorld;
  if (cloudScore > localScore) {
    winner = cloudWorld;
  } else if (localScore > cloudScore) {
    winner = localWorld;
  } else {
    // Tie: use the one with more recent activity
    const localDate = localWorld.lastActiveDate ? new Date(localWorld.lastActiveDate).getTime() : 0;
    const cloudDate = cloudWorld.lastActiveDate ? new Date(cloudWorld.lastActiveDate).getTime() : 0;
    winner = cloudDate > localDate ? cloudWorld : localWorld;
    logger.log(`[InnerWorld] Tie (score=${localScore}), using ${cloudDate > localDate ? 'cloud' : 'local'} (more recent)`);
  }

  // Save merged state (use safe wrapper for Safari Private Mode)
  safeLocalStorageSet(SK.INNER_WORLD, winner);
  await pushInnerWorldToCloud(winner);

  return winner;
}

/**
 * Subscribe to real-time Inner World updates
 */
/**
 * DISABLED: Realtime subscriptions for inner world
 *
 * Performance optimization: WAL query was consuming 96% of database time.
 * Data syncs on app resume via pullInnerWorldFromCloud() instead.
 */
export function subscribeToInnerWorldUpdates(
  _userId: string,
  _callback: (world: InnerWorld) => void
): () => void {
  // Disabled for performance - data syncs on app resume
  return () => {};
}

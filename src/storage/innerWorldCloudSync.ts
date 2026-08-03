// Inner World Cloud Synchronization with Supabase

import { logger } from "@/lib/logger";
import { safeLocalStorageSet } from "@/lib/safeJson";
import { SK } from "@/lib/storageKeys";
import { getCurrentUserId, supabase } from "@/lib/supabaseClient";
import { readPendingLocalBackupAccountClaim } from "@/storage/accountBoundaryRuntime";
import { getLocalDataOwnerId } from "@/storage/db";
import { InnerWorld } from "@/types";
import { Json } from "@/types/supabase";
import { z } from "zod";

/**
 * P2-8 Fix: Zod schema for validating InnerWorld cloud data
 * Validates critical fields to prevent data corruption
 */
const innerWorldSchema = z
  .object({
    treats: z.object({
      balance: z.number(),
      lifetimeEarned: z.number().optional(),
      lifetimeSpent: z.number().optional(),
    }),
    plants: z
      .array(
        z.object({
          id: z.string(),
          type: z.string(),
          stage: z.string(),
        })
      )
      .optional()
      .default([]),
    creatures: z.array(z.unknown()).optional().default([]),
    currentActiveStreak: z.number().optional().default(0),
    longestActiveStreak: z.number().optional().default(0),
    lastActiveDate: z.string().optional().default(""),
    daysActive: z.number().optional().default(0),
    companion: z
      .object({
        level: z.number().optional(),
        experience: z.number().optional(),
      })
      .passthrough()
      .optional(),
  })
  .passthrough(); // Allow additional fields for forward compatibility

/**
 * P2-8 Fix: Validate InnerWorld data from cloud
 */
function validateInnerWorldData(data: unknown): InnerWorld | null {
  const result = innerWorldSchema.safeParse(data);
  if (!result.success) {
    logger.warn("[InnerWorld] Cloud data validation failed:", result.error.issues);
    return null;
  }
  return data as InnerWorld;
}

// P1-8 Fix: Promise-based lock instead of boolean flag
// The boolean flag had a race condition where two concurrent calls
// could both see isInnerWorldSyncing === false before either sets it true
// With a Promise, concurrent callers wait for and return the same result
let syncInnerWorldPromise: Promise<InnerWorld> | null = null;

async function isExpectedOwnerCurrent(expectedOwnerUserId: string): Promise<boolean> {
  const claimBeforeOwnerRead = readPendingLocalBackupAccountClaim();
  if (claimBeforeOwnerRead.status !== "none") {
    logger.warn("[InnerWorld] Skipping cloud operation while a backup awaits an account choice");
    return false;
  }

  const [activeUserId, localOwnerUserId] = await Promise.all([
    getCurrentUserId(),
    getLocalDataOwnerId(),
  ]);
  const claimAfterOwnerRead = readPendingLocalBackupAccountClaim();
  if (
    activeUserId === expectedOwnerUserId &&
    localOwnerUserId === expectedOwnerUserId &&
    claimAfterOwnerRead.status === "none"
  ) {
    return true;
  }

  logger.warn(
    "[InnerWorld] Skipping cloud operation because account ownership is unresolved or changed"
  );
  return false;
}

/**
 * Push Inner World state to Supabase
 */
export async function pushInnerWorldToCloud(
  world: InnerWorld,
  expectedOwnerUserId: string
): Promise<void> {
  if (!supabase || !expectedOwnerUserId.trim()) return;

  try {
    // Keep the originating owner explicit. If auth changed while a debounced
    // write was waiting, do not issue a request under the new account.
    if (!(await isExpectedOwnerCurrent(expectedOwnerUserId))) return;

    const { error } = await supabase.from("user_inner_world").upsert(
      {
        user_id: expectedOwnerUserId,
        world_data: world as unknown as Json,
        updated_at: new Date().toISOString(),
      },
      {
        onConflict: "user_id",
      }
    );

    if (error) {
      // Table might not exist yet - that's ok, we'll just use local storage
      if (error.code !== "42P01") {
        // relation does not exist
        logger.error("[InnerWorld] Error pushing to cloud:", error);
      }
    }
  } catch (err) {
    logger.error("[InnerWorld] Push error:", err);
  }
}

/**
 * Pull Inner World state from Supabase
 */
export async function pullInnerWorldFromCloud(
  expectedOwnerUserId: string
): Promise<InnerWorld | null> {
  if (!supabase || !expectedOwnerUserId.trim()) return null;

  try {
    if (!(await isExpectedOwnerCurrent(expectedOwnerUserId))) return null;

    const { data, error } = await supabase
      .from("user_inner_world")
      .select("world_data")
      .eq("user_id", expectedOwnerUserId)
      .maybeSingle();

    // The account may change while the network request is in flight. Discard
    // the old owner's response before it can reach local state.
    if (!(await isExpectedOwnerCurrent(expectedOwnerUserId))) return null;

    if (error) {
      // Table might not exist - that's ok
      if (error.code !== "42P01") {
        logger.error("[InnerWorld] Error pulling from cloud:", error);
      }
      return null;
    }

    if (!data) return null;

    // P2-8 Fix: Use Zod schema for comprehensive validation
    const worldData = data.world_data;
    return validateInnerWorldData(worldData);
  } catch (err) {
    logger.error("[InnerWorld] Pull error:", err);
    return null;
  }
}

/**
 * Sync Inner World: merge local and cloud state
 * P1-8 Fix: Uses Promise-based lock to prevent race conditions
 * Concurrent callers will wait for and receive the same result
 */
export async function syncInnerWorld(
  localWorld: InnerWorld,
  expectedOwnerUserId: string
): Promise<InnerWorld> {
  // P1-8 Fix: If sync is already in progress, wait for it and return its result
  // This prevents duplicate syncs and ensures all callers get consistent data
  if (syncInnerWorldPromise) {
    try {
      return await syncInnerWorldPromise;
    } catch {
      // If the ongoing sync fails, return local state as fallback
      return localWorld;
    }
  }

  // Create a new sync promise
  syncInnerWorldPromise = doSyncInnerWorld(localWorld, expectedOwnerUserId);

  try {
    return await syncInnerWorldPromise;
  } finally {
    syncInnerWorldPromise = null;
  }
}

/**
 * Internal sync implementation (called within Promise lock)
 */
async function doSyncInnerWorld(
  localWorld: InnerWorld,
  expectedOwnerUserId: string
): Promise<InnerWorld> {
  const cloudWorld = await pullInnerWorldFromCloud(expectedOwnerUserId);

  if (!cloudWorld) {
    // No cloud data - push local to cloud
    await pushInnerWorldToCloud(localWorld, expectedOwnerUserId);
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
    logger.log(
      `[InnerWorld] Tie (score=${localScore}), using ${cloudDate > localDate ? "cloud" : "local"} (more recent)`
    );
  }

  // Save merged state (use safe wrapper for Safari Private Mode)
  if (!(await isExpectedOwnerCurrent(expectedOwnerUserId))) return localWorld;
  safeLocalStorageSet(SK.INNER_WORLD, winner);
  await pushInnerWorldToCloud(winner, expectedOwnerUserId);

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

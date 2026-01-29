import { exportBackup, importBackup } from "@/storage/backup";
import { supabase } from "@/lib/supabaseClient";
import { triggerDataRefresh } from "@/hooks/useIndexedDB";
import logger from "@/lib/logger";
import { syncOrchestrator } from "@/lib/syncOrchestrator";
import { generateSecureRandom } from "@/lib/validation";

const BACKUP_TABLE = "user_backups";
const SYNC_INTERVAL = 5 * 60 * 1000; // 5 minutes
const SYNC_DEBOUNCE = 30 * 1000; // 30 seconds after data change

let syncInterval: ReturnType<typeof setInterval> | null = null;
let syncTimeout: ReturnType<typeof setTimeout> | null = null;
let lastSyncTime = 0;
let autoSyncStarted = false;

// Sync lock with operation ID for safe deadlock prevention
// Using operation ID ensures that timeout-based release doesn't cause data corruption
// when a legitimate slow operation is still running
let syncLock = false;
let syncLockOwner: string | null = null; // Unique ID of the operation holding the lock
let syncLockTimeout: ReturnType<typeof setTimeout> | null = null;
const SYNC_LOCK_TIMEOUT = 120000; // P0 Fix: 120 seconds max lock time (increased from 60s to prevent data corruption during slow operations)

/**
 * Generate a unique operation ID for lock ownership tracking.
 * Format: timestamp-randomstring (e.g., "1706234567890-abc123xyz")
 */
const generateOperationId = (): string => {
  return `${Date.now()}-${generateSecureRandom()}`;
};

// Store listener references for cleanup
let visibilityChangeHandler: (() => void) | null = null;
let beforeUnloadHandler: (() => void) | null = null;

export const syncWithCloud = async (mode: "merge" | "replace" = "merge"): Promise<{ status: string }> => {
  // Prevent concurrent sync operations
  if (syncLock) {
    logger.sync(`Sync already in progress (owner: ${syncLockOwner}), skipping`);
    return { status: 'skipped' };
  }

  if (!supabase) {
    throw new Error("Supabase not configured.");
  }

  // Acquire lock with unique operation ID
  const operationId = generateOperationId();
  syncLock = true;
  syncLockOwner = operationId;
  logger.sync(`Sync started (operation: ${operationId})`);

  // Set timeout to auto-release lock and prevent deadlock
  // IMPORTANT: Only release if this operation still owns the lock
  // This prevents data corruption when timeout fires during a slow but legitimate operation
  syncLockTimeout = setTimeout(() => {
    if (syncLock && syncLockOwner === operationId) {
      logger.warn(`[Sync] Lock timeout exceeded, force releasing (operation: ${operationId})`);
      syncLock = false;
      syncLockOwner = null;
    } else if (syncLock) {
      // Lock is held by a different operation - this is unexpected but possible
      // if the original operation completed and a new one started
      logger.sync(`[Sync] Timeout fired but lock owned by different operation: ${syncLockOwner}`);
    }
  }, SYNC_LOCK_TIMEOUT);

  try {
    const { data } = await supabase.auth.getUser();
    const user = data?.user;

    if (!user) {
      throw new Error("Not authenticated.");
    }

    const localBackup = await exportBackup();

    const { data: remote, error: fetchError } = await supabase
      .from(BACKUP_TABLE)
      .select("payload, updated_at")
      .eq("user_id", user.id)
      .maybeSingle();

    if (fetchError) {
      throw fetchError;
    }

    let syncStatus: "pulled" | "pushed" | "merged" = "pushed";

    if (remote?.payload) {
      const remotePayload = remote.payload;
      const remoteData = remotePayload.data || {};
      const localData = localBackup.data || {};

      // Count items for logging
      const localItemCount =
        (localData.moods?.length || 0) +
        (localData.habits?.length || 0) +
        (localData.focusSessions?.length || 0) +
        (localData.gratitudeEntries?.length || 0);

      const remoteItemCount =
        (remoteData.moods?.length || 0) +
        (remoteData.habits?.length || 0) +
        (remoteData.focusSessions?.length || 0) +
        (remoteData.gratitudeEntries?.length || 0);

      logger.sync(`Local items: ${localItemCount}, Remote items: ${remoteItemCount}`);

      // ALWAYS merge if remote has any data - this ensures cross-device sync works
      // The importBackup with mode="merge" will use bulkPut which updates existing or adds new
      if (remoteItemCount > 0) {
        logger.sync('Merging remote data into local...');
        await importBackup(remotePayload, mode);
        syncStatus = localItemCount === 0 ? "pulled" : "merged";
        // Trigger React state refresh after importing cloud data
        triggerDataRefresh();
        logger.sync('Data refreshed after cloud merge');
      }
    } else {
      logger.sync('No remote data found, will push local data');
    }

    const mergedBackup = await exportBackup();
    const { error: upsertError } = await supabase.from(BACKUP_TABLE).upsert(
      {
        user_id: user.id,
        payload: mergedBackup,
        updated_at: new Date().toISOString()
      },
      { onConflict: "user_id" }
    );

    if (upsertError) {
      throw upsertError;
    }

    lastSyncTime = Date.now();
    return { status: syncStatus };
  } finally {
    // Clear timeout
    if (syncLockTimeout) {
      clearTimeout(syncLockTimeout);
      syncLockTimeout = null;
    }

    // Only release lock if we still own it
    // This prevents releasing a lock that was already timed out and acquired by another operation
    if (syncLockOwner === operationId) {
      syncLock = false;
      syncLockOwner = null;
      logger.sync(`Sync completed, lock released (operation: ${operationId})`);
    } else {
      // Lock was released by timeout or is now owned by another operation
      logger.sync(`Sync completed but lock already released or transferred (operation: ${operationId}, current owner: ${syncLockOwner})`);
    }
  }
};

// Silent sync (no errors thrown, just logs)
export const silentSync = async () => {
  // Use orchestrator for queue-based sync
  await syncOrchestrator.sync('backup', async () => {
    try {
      await syncWithCloud('merge');
      logger.sync('Auto-sync completed');
    } catch (error) {
      logger.warn('[Sync] Auto-sync failed:', error);
      throw error; // Re-throw for orchestrator retry logic
    }
  }, { priority: 5, maxRetries: 3 });
};

// Start periodic sync
export const startAutoSync = () => {
  if (!supabase) return;

  // Prevent duplicate listener registration
  if (autoSyncStarted) {
    logger.sync('Auto-sync already started, skipping');
    return;
  }

  // Clear existing interval (safety)
  if (syncInterval) {
    clearInterval(syncInterval);
  }

  // Sync every 5 minutes
  syncInterval = setInterval(silentSync, SYNC_INTERVAL);

  // Create and store listener references for later cleanup
  visibilityChangeHandler = () => {
    if (document.visibilityState === 'visible' && Date.now() - lastSyncTime > 60000) {
      silentSync().catch((error) => {
        logger.warn('[Sync] Visibility change sync failed:', error);
      });
    }
  };

  beforeUnloadHandler = () => {
    // Note: async operations in beforeunload are unreliable
    // This is a best-effort sync attempt
    if (navigator.sendBeacon && supabase) {
      silentSync().catch((error) => {
        logger.warn('[Sync] Beforeunload sync failed:', error);
      });
    }
  };

  // Add listeners
  document.addEventListener('visibilitychange', visibilityChangeHandler);
  window.addEventListener('beforeunload', beforeUnloadHandler);

  autoSyncStarted = true;
  logger.sync('Auto-sync started');
};

// Stop periodic sync and cleanup listeners
export const stopAutoSync = () => {
  if (syncInterval) {
    clearInterval(syncInterval);
    syncInterval = null;
  }
  if (syncTimeout) {
    clearTimeout(syncTimeout);
    syncTimeout = null;
  }

  // Remove event listeners
  if (visibilityChangeHandler) {
    document.removeEventListener('visibilitychange', visibilityChangeHandler);
    visibilityChangeHandler = null;
  }
  if (beforeUnloadHandler) {
    window.removeEventListener('beforeunload', beforeUnloadHandler);
    beforeUnloadHandler = null;
  }

  autoSyncStarted = false;
  logger.sync('Auto-sync stopped');
};

// Trigger debounced sync (call after data changes)
export const triggerSync = () => {
  if (!supabase) return;

  // Clear existing timeout
  if (syncTimeout) {
    clearTimeout(syncTimeout);
  }

  // Debounce: wait 30s after last change before syncing
  // The orchestrator will handle queue management
  syncTimeout = setTimeout(silentSync, SYNC_DEBOUNCE);
};

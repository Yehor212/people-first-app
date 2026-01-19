import { exportBackup, importBackup } from "@/storage/backup";
import { supabase } from "@/lib/supabaseClient";
import { triggerDataRefresh } from "@/hooks/useIndexedDB";
import logger from "@/lib/logger";

const BACKUP_TABLE = "user_backups";
const SYNC_INTERVAL = 5 * 60 * 1000; // 5 minutes
const SYNC_DEBOUNCE = 30 * 1000; // 30 seconds after data change

let syncInterval: ReturnType<typeof setInterval> | null = null;
let syncTimeout: ReturnType<typeof setTimeout> | null = null;
let lastSyncTime = 0;
let autoSyncStarted = false;

// Store listener references for cleanup
let visibilityChangeHandler: (() => void) | null = null;
let beforeUnloadHandler: (() => void) | null = null;

export const syncWithCloud = async (mode: "merge" | "replace" = "merge") => {
  if (!supabase) {
    throw new Error("Supabase not configured.");
  }

  const {
    data: { user }
  } = await supabase.auth.getUser();

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
};

// Silent sync (no errors thrown, just logs)
export const silentSync = async () => {
  try {
    await syncWithCloud('merge');
    logger.sync('Auto-sync completed');
  } catch (error) {
    logger.warn('[Sync] Auto-sync failed:', error);
  }
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
      silentSync();
    }
  };

  beforeUnloadHandler = () => {
    // Note: async operations in beforeunload are unreliable
    // This is a best-effort sync attempt
    if (navigator.sendBeacon && supabase) {
      silentSync();
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
  syncTimeout = setTimeout(silentSync, SYNC_DEBOUNCE);
};

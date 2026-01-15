import { exportBackup, importBackup } from "@/storage/backup";
import { supabase } from "@/lib/supabaseClient";
import { triggerDataRefresh } from "@/hooks/useIndexedDB";

const BACKUP_TABLE = "user_backups";
const SYNC_INTERVAL = 5 * 60 * 1000; // 5 minutes
const SYNC_DEBOUNCE = 30 * 1000; // 30 seconds after data change

let syncInterval: ReturnType<typeof setInterval> | null = null;
let syncTimeout: ReturnType<typeof setTimeout> | null = null;
let lastSyncTime = 0;

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

  let syncStatus: "pulled" | "pushed" = "pushed";

  if (remote?.payload) {
    const remotePayload = remote.payload;
    const localDate = new Date((localBackup as any).createdAt || localBackup.exportedAt).getTime();
    const remoteDate = new Date(remotePayload.createdAt || remotePayload.exportedAt || remote.updated_at || 0).getTime();
    if (remoteDate > localDate) {
      await importBackup(remotePayload, mode);
      syncStatus = "pulled";
      // Trigger React state refresh after importing cloud data
      triggerDataRefresh();
      console.log('[CloudSync] Data refreshed after cloud pull');
    }
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
    console.log('[CloudSync] Auto-sync completed');
  } catch (error) {
    console.warn('[CloudSync] Auto-sync failed:', error);
  }
};

// Start periodic sync
export const startAutoSync = () => {
  if (!supabase) return;

  // Clear existing interval
  if (syncInterval) {
    clearInterval(syncInterval);
  }

  // Sync every 5 minutes
  syncInterval = setInterval(silentSync, SYNC_INTERVAL);

  // Sync on page visibility change (when user comes back to tab)
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible' && Date.now() - lastSyncTime > 60000) {
      silentSync();
    }
  });

  // Sync before page unload
  window.addEventListener('beforeunload', () => {
    // Use navigator.sendBeacon for reliable delivery
    if (navigator.sendBeacon && supabase) {
      // Can't do async in beforeunload, so just trigger sync
      silentSync();
    }
  });

  console.log('[CloudSync] Auto-sync started');
};

// Stop periodic sync
export const stopAutoSync = () => {
  if (syncInterval) {
    clearInterval(syncInterval);
    syncInterval = null;
  }
  if (syncTimeout) {
    clearTimeout(syncTimeout);
    syncTimeout = null;
  }
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

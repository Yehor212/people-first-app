import { broadcastChange } from "@/lib/syncBroadcast";
import { exportBackup, importBackup, type BackupPayload } from "@/storage/backup";
import { supabase } from "@/lib/supabaseClient";
import { triggerDataRefresh } from "@/hooks/useIndexedDB";
import logger from "@/lib/logger";
import type { Json } from "@/types/supabase";
import { syncOrchestrator } from "@/lib/syncOrchestrator";
import { generateSecureRandom, isAbortError } from "@/lib/validation";
import { fetchAndMergeServerTombstones } from "@/storage/sync/serverTombstones";
import type { SeverityLevel } from "@sentry/core";
import type { ErrorCategory } from "@/lib/sentry";

// Lazy-load sentry to keep @sentry/* (~250 KB) off the critical rendering path.
// Breadcrumbs are fire-and-forget telemetry — async import is safe.
const lazyCategorizedBreadcrumb = (
  category: ErrorCategory,
  message: string,
  data?: Record<string, unknown>,
  level?: SeverityLevel
) => {
  import("@/lib/sentry")
    .then((mod) => mod.addCategorizedBreadcrumb(category, message, data, level))
    .catch((e) => logger.warn("[Sentry] lazy load skipped:", e));
};

const BACKUP_TABLE = "user_backups";
const SYNC_INTERVAL = 10 * 60 * 1000; // 10 minutes (granular sync handles individual items)
const SYNC_DEBOUNCE = 30 * 1000; // 30 seconds (backup is safety net; per-entity sync handles real-time)

let syncInterval: ReturnType<typeof setInterval> | null = null;
let syncTimeout: ReturnType<typeof setTimeout> | null = null;
let lastSyncTime = 0;
let autoSyncStarted = false;

// P1-11 Fix: Promise-based sync lock instead of boolean
// The boolean lock had issues:
// 1. Concurrent callers that see syncLock===true would return 'skipped' and miss the result
// 2. Race condition where two callers could both see syncLock===false
// With Promise-based lock, concurrent callers wait for and return the same result
let currentSyncPromise: Promise<{ status: string }> | null = null;
let syncLockTimeout: ReturnType<typeof setTimeout> | null = null;
let syncLockStartTime: number | null = null; // Track when lock was acquired
let syncAbortController: AbortController | null = null; // AbortController for timeout cancellation
const SYNC_LOCK_TIMEOUT = 60000; // Reduced from 120s to 60s - most sync ops should complete in <30s

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

export const syncWithCloud = async (
  mode: "merge" | "replace" = "merge"
): Promise<{ status: string }> => {
  lazyCategorizedBreadcrumb("sync", "syncWithCloud called", { mode });

  // P1-11 Fix: If sync is already in progress, wait for it and return the same result
  // This prevents "skipped" status and ensures all callers get consistent data
  if (currentSyncPromise) {
    logger.sync("Sync already in progress, waiting for completion...");
    lazyCategorizedBreadcrumb("sync", "Waiting for existing sync");
    try {
      return await currentSyncPromise;
    } catch (error) {
      // Handle AbortError gracefully - don't re-throw aborts
      if (isAbortError(error)) {
        lazyCategorizedBreadcrumb("sync", "Sync wait aborted", {}, "warning");
        logger.warn("[Sync] Sync wait aborted");
        return { status: "aborted" };
      }
      // Re-throw so caller knows sync failed
      throw error;
    }
  }

  if (!supabase) {
    throw new Error("Supabase not configured.");
  }

  // Create the sync promise
  const operationId = generateOperationId();
  syncLockStartTime = Date.now();
  // Create AbortController for timeout cancellation
  syncAbortController = new AbortController();
  const abortSignal = syncAbortController.signal;
  logger.sync(`Sync started (operation: ${operationId})`);

  // P1-11 Fix: Wrap the sync operation in a promise that concurrent callers can await
  currentSyncPromise = doSyncWithCloud(mode, operationId, abortSignal);

  try {
    return await currentSyncPromise;
  } finally {
    currentSyncPromise = null;
  }
};

/**
 * Internal sync implementation
 * P1-11 Fix: Extracted to allow Promise-based locking
 */
const doSyncWithCloud = async (
  mode: "merge" | "replace",
  operationId: string,
  abortSignal: AbortSignal
): Promise<{ status: string }> => {
  // Set timeout to abort operation if it takes too long
  // P1-11 Fix: Simplified - just abort the controller, Promise-based lock handles cleanup
  // P0-7 Fix: Capture controller reference to avoid race condition where timeout fires
  // just as finally block sets syncAbortController = null
  const controllerRef = syncAbortController;
  syncLockTimeout = setTimeout(() => {
    const duration = syncLockStartTime ? Date.now() - syncLockStartTime : 0;
    logger.warn(
      `[Sync] Timeout exceeded after ${duration}ms, aborting operation (operation: ${operationId})`
    );
    // P0-7 Fix: Use captured reference instead of global variable
    controllerRef?.abort();
  }, SYNC_LOCK_TIMEOUT);

  try {
    // Check if operation was aborted before starting
    if (abortSignal.aborted) {
      throw new Error("Sync operation aborted due to timeout");
    }

    const {
      data: { session },
    } = await supabase!.auth.getSession();
    const user = session?.user;

    if (!user) {
      throw new Error("Not authenticated.");
    }

    // Check abort status before heavy operations
    if (abortSignal.aborted) {
      throw new Error("Sync operation aborted due to timeout");
    }

    await fetchAndMergeServerTombstones();
    const localBackup = await exportBackup();

    // Check abort status before network call
    if (abortSignal.aborted) {
      throw new Error("Sync operation aborted due to timeout");
    }

    const { data: remote, error: fetchError } = await supabase!
      .from(BACKUP_TABLE)
      .select("payload, updated_at")
      .eq("user_id", user.id)
      .maybeSingle();

    if (fetchError) {
      throw fetchError;
    }

    // Check abort status after network call
    if (abortSignal.aborted) {
      throw new Error("Sync operation aborted due to timeout");
    }

    let syncStatus: "pulled" | "pushed" | "merged" = "pushed";

    if (remote?.payload) {
      const remotePayload = remote.payload as Record<string, unknown>;
      const remoteData = (remotePayload.data || {}) as Record<string, unknown[]>;
      const localData = localBackup.data;

      // Count items for logging
      const localItemCount =
        (localData.moods?.length || 0) +
        (localData.habits?.length || 0) +
        (localData.focusSessions?.length || 0) +
        (localData.gratitudeEntries?.length || 0) +
        (localData.journalEntries?.length || 0);

      const remoteItemCount =
        (remoteData.moods?.length || 0) +
        (remoteData.habits?.length || 0) +
        (remoteData.focusSessions?.length || 0) +
        (remoteData.gratitudeEntries?.length || 0) +
        (remoteData.journalEntries?.length || 0);

      logger.sync(`Local items: ${localItemCount}, Remote items: ${remoteItemCount}`);

      // ALWAYS merge if remote has any data - this ensures cross-device sync works
      // The importBackup with mode="merge" will use bulkPut which updates existing or adds new
      if (remoteItemCount > 0) {
        logger.sync("Merging remote data into local...");
        await importBackup(remotePayload as unknown as BackupPayload, mode);
        syncStatus = localItemCount === 0 ? "pulled" : "merged";
        // Trigger React state refresh after importing cloud data
        triggerDataRefresh();
        logger.sync("Data refreshed after cloud merge");
      }
    } else {
      logger.sync("No remote data found, will push local data");
    }

    // Check abort status before final operations
    if (abortSignal.aborted) {
      throw new Error("Sync operation aborted due to timeout");
    }

    // Only re-export if we actually merged remote data into local
    // For single-device users (most common), this saves a full IndexedDB scan
    const finalBackup =
      syncStatus === "merged" || syncStatus === "pulled" ? await exportBackup() : localBackup;

    // Final abort check before upsert
    if (abortSignal.aborted) {
      throw new Error("Sync operation aborted due to timeout");
    }

    const { error: upsertError } = await supabase!.from(BACKUP_TABLE).upsert(
      {
        user_id: user.id,
        payload: finalBackup as unknown as Json,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "user_id" }
    );

    if (upsertError) {
      throw upsertError;
    }

    lastSyncTime = Date.now();

    // Signal other devices that data changed
    broadcastChange("backup");
    return { status: syncStatus };
  } finally {
    // P1-11 Fix: Cleanup resources
    // Clear timeout
    if (syncLockTimeout) {
      clearTimeout(syncLockTimeout);
      syncLockTimeout = null;
    }

    // Clean up state
    const duration = syncLockStartTime ? Date.now() - syncLockStartTime : 0;
    syncLockStartTime = null;
    syncAbortController = null;
    logger.sync(`Sync completed in ${duration}ms (operation: ${operationId})`);
  }
};

// Track consecutive sync failures for UI notification
let consecutiveSyncFailures = 0;
const MAX_FAILURES_BEFORE_NOTIFY = 3; // Notify user after 3 consecutive failures

// Emit sync failure event for UI notification
const emitSyncFailureEvent = (error: unknown, failureCount: number) => {
  if (typeof window !== "undefined") {
    window.dispatchEvent(
      new CustomEvent("zenflow:sync-failure", {
        detail: {
          error: error instanceof Error ? error.message : "Sync failed",
          consecutiveFailures: failureCount,
          shouldNotify: failureCount >= MAX_FAILURES_BEFORE_NOTIFY,
        },
      })
    );
  }
};

// Emit sync success event to clear UI notification
const emitSyncSuccessEvent = () => {
  if (typeof window !== "undefined" && consecutiveSyncFailures > 0) {
    window.dispatchEvent(new CustomEvent("zenflow:sync-success"));
  }
};

// Silent sync (no errors thrown, just logs)
export const silentSync = async () => {
  // Use orchestrator for queue-based sync
  await syncOrchestrator.sync(
    "backup",
    async () => {
      try {
        await syncWithCloud("merge");
        logger.sync("Auto-sync completed");
        lazyCategorizedBreadcrumb("sync", "Auto-sync completed");
        // Reset failure counter and emit success on successful sync
        if (consecutiveSyncFailures > 0) {
          consecutiveSyncFailures = 0;
          emitSyncSuccessEvent();
        }
      } catch (error) {
        // Don't count aborts as failures - they're intentional
        if (isAbortError(error)) {
          lazyCategorizedBreadcrumb("sync", "Auto-sync aborted (intentional)", {}, "info");
          logger.log("[Sync] Auto-sync aborted (intentional)");
          return; // Don't throw, don't count as failure
        }
        lazyCategorizedBreadcrumb(
          "sync",
          "Auto-sync failed",
          { error: (error as Error).message },
          "error"
        );
        logger.warn("[Sync] Auto-sync failed:", error);
        // Track failures and emit event for monitoring
        consecutiveSyncFailures++;
        emitSyncFailureEvent(error, consecutiveSyncFailures);
        // NOT re-throwing: silentSync must never throw to prevent unhandled rejections
        // from setInterval/visibilitychange callers. Orchestrator retries via queue, not exceptions.
      }
    },
    { priority: 5, maxRetries: 3 }
  );
};

// Start periodic sync
export const startAutoSync = () => {
  if (!supabase) return;

  // Prevent duplicate listener registration
  if (autoSyncStarted) {
    logger.sync("Auto-sync already started, skipping");
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
    if (document.visibilityState === "visible" && Date.now() - lastSyncTime > 30000) {
      silentSync().catch((error) => {
        logger.warn("[Sync] Visibility change sync failed:", error);
      });
    }
  };

  beforeUnloadHandler = () => {
    // Note: async operations in beforeunload are unreliable
    // This is a best-effort sync attempt
    if (typeof navigator.sendBeacon === "function" && supabase) {
      silentSync().catch((error) => {
        logger.warn("[Sync] Beforeunload sync failed:", error);
      });
    }
  };

  // Add listeners
  document.addEventListener("visibilitychange", visibilityChangeHandler);
  window.addEventListener("beforeunload", beforeUnloadHandler);

  autoSyncStarted = true;
  logger.sync("Auto-sync started");
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
    document.removeEventListener("visibilitychange", visibilityChangeHandler);
    visibilityChangeHandler = null;
  }
  if (beforeUnloadHandler) {
    window.removeEventListener("beforeunload", beforeUnloadHandler);
    beforeUnloadHandler = null;
  }

  // P1-9 Fix: Reset failure counter when stopping sync (e.g., on logout)
  consecutiveSyncFailures = 0;

  autoSyncStarted = false;
  logger.sync("Auto-sync stopped");
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

// Flush sync immediately (bypasses debounce). Use on app pause to prevent data loss.
export const flushSync = () => {
  if (!supabase) return;

  // Cancel pending debounced sync
  if (syncTimeout) {
    clearTimeout(syncTimeout);
    syncTimeout = null;
  }

  // Trigger immediate sync
  void silentSync();
};

/**
 * Complete cleanup of all cloudSync resources
 * Call this when destroying the app or during hot reload to prevent memory leaks.
 * This cleans up ALL intervals, timeouts, listeners, and abort controllers.
 */
export const destroyCloudSync = () => {
  // Stop auto-sync (clears syncInterval, syncTimeout, and event listeners)
  stopAutoSync();

  // Clear sync lock timeout
  if (syncLockTimeout) {
    clearTimeout(syncLockTimeout);
    syncLockTimeout = null;
  }

  // Abort any in-progress sync operation
  if (syncAbortController) {
    syncAbortController.abort();
    syncAbortController = null;
  }

  // P1-11 Fix: Reset Promise-based lock state
  currentSyncPromise = null;
  syncLockStartTime = null;

  // Reset failure counter
  consecutiveSyncFailures = 0;

  logger.sync("CloudSync destroyed and cleaned up");
};

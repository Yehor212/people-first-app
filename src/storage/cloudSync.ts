import { broadcastChange } from "@/lib/syncBroadcast";
import { exportBackup, importBackup, type BackupPayload } from "@/storage/backup";
import { supabase } from "@/lib/supabaseClient";
import { runWithDataWriteBarrier } from "@/hooks/useIndexedDB";
import logger from "@/lib/logger";
import type { Json } from "@/types/supabase";
import { syncOrchestrator } from "@/lib/syncOrchestrator";
import { generateSecureRandom, isAbortError } from "@/lib/validation";
import { fetchAndMergeServerTombstones } from "@/storage/sync/serverTombstones";
import type { SeverityLevel } from "@sentry/core";
import type { ErrorCategory } from "@/lib/sentry";
import { getJournalReplaceAuthorization } from "@/lib/journalContentSession";
import { getLocalDataOwnerId } from "@/storage/db";
import { readPendingLocalBackupAccountClaim } from "@/storage/accountBoundaryRuntime";

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

// Cloud operations are serialized. Blindly sharing an in-flight promise is unsafe:
// a Replace requested after an account switch must never inherit the previous
// account's Merge result.
let currentSyncPromise: Promise<{ status: string }> | null = null;
let syncQueueTail: Promise<void> = Promise.resolve();
let syncGeneration = 0;
let syncSuspended = false;
let accountBoundarySuspensionEpoch = 0;
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

export const syncWithCloud = (
  mode: "merge" | "replace" = "merge",
  expectedOwnerUserId?: string,
  externalSignal?: AbortSignal
): Promise<{ status: string }> => {
  lazyCategorizedBreadcrumb("sync", "syncWithCloud called", { mode });

  if (!supabase) {
    return Promise.reject(new Error("Supabase not configured."));
  }
  if (syncSuspended) {
    return Promise.reject(new Error("Cloud sync is suspended for account-boundary cleanup."));
  }

  const requestGeneration = syncGeneration;
  const queuedSync = syncQueueTail
    .catch(() => undefined)
    .then(async () => {
      if (requestGeneration !== syncGeneration) {
        return { status: "aborted" };
      }

      const operationId = generateOperationId();
      syncLockStartTime = Date.now();
      const operationController = new AbortController();
      syncAbortController = operationController;
      const abortSignal = operationController.signal;
      const forwardExternalAbort = () => {
        if (!abortSignal.aborted) {
          operationController.abort(externalSignal?.reason);
        }
      };
      if (externalSignal?.aborted) {
        forwardExternalAbort();
      } else {
        externalSignal?.addEventListener("abort", forwardExternalAbort, { once: true });
      }
      logger.sync(`Sync started (operation: ${operationId})`);

      const operation = doSyncWithCloud(mode, operationId, abortSignal, expectedOwnerUserId);
      currentSyncPromise = operation;
      try {
        return await operation;
      } finally {
        externalSignal?.removeEventListener("abort", forwardExternalAbort);
        if (currentSyncPromise === operation) {
          currentSyncPromise = null;
        }
      }
    });

  syncQueueTail = queuedSync.then(
    () => undefined,
    () => undefined
  );
  return queuedSync;
};

/**
 * Internal sync implementation
 * P1-11 Fix: Extracted to allow Promise-based locking
 */
const doSyncWithCloud = async (
  mode: "merge" | "replace",
  operationId: string,
  abortSignal: AbortSignal,
  expectedOwnerUserId?: string
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

    const assertNoPendingImportedBackupClaim = () => {
      if (readPendingLocalBackupAccountClaim().status !== "none") {
        throw new Error("Cloud sync stopped while an imported backup awaits an account choice");
      }
    };
    const assertAuthenticatedOwner = async (expected?: string) => {
      assertNoPendingImportedBackupClaim();
      const {
        data: { session },
      } = await supabase!.auth.getSession();
      assertNoPendingImportedBackupClaim();
      const user = session?.user;
      if (!user) throw new Error("Not authenticated.");
      if (expected && user.id !== expected) {
        throw new Error("Authenticated account changed during cloud sync");
      }
      return user;
    };

    const user = await assertAuthenticatedOwner(expectedOwnerUserId);
    const syncOwnerUserId = expectedOwnerUserId ?? user.id;
    const assertLocalOwner = async (): Promise<void> => {
      if ((await getLocalDataOwnerId()) !== syncOwnerUserId) {
        throw new Error("Local data owner changed during cloud sync");
      }
    };
    await assertLocalOwner();

    // Check abort status before heavy operations
    if (abortSignal.aborted) {
      throw new Error("Sync operation aborted due to timeout");
    }

    await fetchAndMergeServerTombstones(100000, syncOwnerUserId);
    const localBackup = await exportBackup();
    await assertLocalOwner();
    await assertAuthenticatedOwner(syncOwnerUserId);

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

    await assertAuthenticatedOwner(syncOwnerUserId);

    // Check abort status after network call
    if (abortSignal.aborted) {
      throw new Error("Sync operation aborted due to timeout");
    }

    const localData = localBackup.data;
    const localItemCount =
      (localData.moods?.length || 0) +
      (localData.habits?.length || 0) +
      (localData.focusSessions?.length || 0) +
      (localData.gratitudeEntries?.length || 0) +
      (localData.journalEntries?.length || 0);
    const remotePayload = remote?.payload ? (remote.payload as unknown as BackupPayload) : null;
    const remoteData = (remotePayload?.data || {}) as Record<string, unknown[]>;
    const remoteItemCount =
      (remoteData.moods?.length || 0) +
      (remoteData.habits?.length || 0) +
      (remoteData.focusSessions?.length || 0) +
      (remoteData.gratitudeEntries?.length || 0) +
      (remoteData.journalEntries?.length || 0);

    logger.sync(`Local items: ${localItemCount}, Remote items: ${remoteItemCount}`);

    let syncStatus: "pulled" | "pushed" | "merged" = "pushed";
    let appliedRemoteData = false;

    if (mode === "replace") {
      // Replace is an account boundary: an empty backup and an absent backup row
      // are both authoritative empty states. Never upload the pre-switch snapshot.
      const authoritativePayload: BackupPayload = remotePayload ?? {
        ...localBackup,
        createdAt: new Date().toISOString(),
        data: {
          moods: [],
          habits: [],
          focusSessions: [],
          gratitudeEntries: [],
          settings: [],
          journalEntries: [],
          journalPhotos: [],
          journalAudio: [],
        },
        deletedHabitIds: undefined,
        deletedJournalEntryIds: undefined,
        deletedMoodIds: undefined,
        deletedFocusSessionIds: undefined,
        deletedGratitudeIds: undefined,
      };

      await runWithDataWriteBarrier(async () => {
        await assertAuthenticatedOwner(syncOwnerUserId);
        const authorization = getJournalReplaceAuthorization();
        if (authorization) {
          await importBackup(authoritativePayload, "replace", {
            journalReplaceAuthorization: authorization,
            expectedOwnerUserId: syncOwnerUserId,
          });
        } else {
          await importBackup(authoritativePayload, "replace", {
            expectedOwnerUserId: syncOwnerUserId,
          });
        }
        await assertAuthenticatedOwner(syncOwnerUserId);
      });
      appliedRemoteData = true;
      syncStatus = "pulled";
      logger.sync("Authoritative cloud backup applied");
    } else if (remotePayload) {
      logger.sync("Merging remote data into local...");
      await runWithDataWriteBarrier(async () => {
        await assertAuthenticatedOwner(syncOwnerUserId);
        await importBackup(remotePayload, "merge", {
          expectedOwnerUserId: syncOwnerUserId,
        });
        await assertAuthenticatedOwner(syncOwnerUserId);
      });
      appliedRemoteData = true;
      syncStatus = localItemCount === 0 ? "pulled" : "merged";
      logger.sync("Data refreshed after cloud merge");
    } else {
      logger.sync("No remote data found, will push local data");
    }

    // Check abort status before final operations
    if (abortSignal.aborted) {
      throw new Error("Sync operation aborted due to timeout");
    }

    // Only re-export if we actually merged remote data into local
    // For single-device users (most common), this saves a full IndexedDB scan
    const finalBackup = appliedRemoteData ? await exportBackup() : localBackup;
    await assertLocalOwner();
    await assertAuthenticatedOwner(syncOwnerUserId);

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

    await assertAuthenticatedOwner(syncOwnerUserId);

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
  await syncOrchestrator
    .sync(
      "backup",
      async ({ ownerUserId, signal }) => {
        try {
          await syncWithCloud("merge", ownerUserId, signal);
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
    )
    .catch((error: unknown) => {
      logger.warn("[Sync] Auto-sync orchestration stopped:", error);
    });
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

/**
 * Suspend new sync work, invalidate queued turns, abort the active operation,
 * and wait until every older turn has unwound. Account-boundary cleanup must
 * await this before clearing IndexedDB.
 */
export const quiesceCloudSync = async (): Promise<void> => {
  accountBoundarySuspensionEpoch += 1;
  syncSuspended = true;
  syncGeneration += 1;
  stopAutoSync();

  const orchestratorQuiesce = syncOrchestrator.suspendForAccountBoundary();
  const activeOperation = currentSyncPromise;
  const queuedOperations = syncQueueTail;
  syncAbortController?.abort();

  await Promise.allSettled([
    orchestratorQuiesce,
    activeOperation ?? Promise.resolve({ status: "idle" }),
    queuedOperations,
  ]);

  currentSyncPromise = null;
  syncLockStartTime = null;
};

/** Read-only account-boundary state; callers must not infer ownership from it. */
export const isCloudSyncSuspendedForAccountBoundary = (): boolean => syncSuspended;

/** Changes on every suspend/resume attempt so a caller can release only its own turn. */
export const getCloudSyncAccountBoundaryEpoch = (): number => accountBoundarySuspensionEpoch;

export const resumeCloudSync = (): void => {
  accountBoundarySuspensionEpoch += 1;
  syncSuspended = false;
  syncOrchestrator.resumeAfterAccountBoundary();
  logger.sync("CloudSync resumed after account-boundary cleanup");
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
  accountBoundarySuspensionEpoch += 1;
  syncGeneration += 1;
  syncSuspended = false;
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

  // Invalidate queued requests from the previous lifecycle. The queue itself is
  // retained so a fresh request cannot overlap an operation that is unwinding.
  currentSyncPromise = null;
  syncLockStartTime = null;

  // Reset failure counter
  consecutiveSyncFailures = 0;

  logger.sync("CloudSync destroyed and cleaned up");
};

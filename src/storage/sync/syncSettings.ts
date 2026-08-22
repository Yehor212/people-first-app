/**
 * Settings sync operations — push setting to cloud.
 * Extracted from realtimeSync.ts for modularity.
 */

import { logger } from "@/lib/logger";
import { isAbortError } from "@/lib/validation";
import { detectNetworkError } from "./syncUtils";
import { supabase } from "@/lib/supabaseClient";
import { offlineQueue } from "@/lib/offlineQueue";
import type { Json } from "@/types/supabase";
import { getPersistentDeviceId, writeEventAndBroadcast } from "@/storage/eventSync";
import { storageRemove } from "@/lib/safeJson";
import { isAccountSyncedSettingKey, shouldDeleteSettingFromCloud } from "./settingSyncPolicy";
import { validateSyncOwner } from "./syncOwner";
import { SK } from "@/lib/storageKeys";
import { canDeleteRemoteJournalVault, canUploadAccountSetting } from "./journalVaultSyncPolicy";
import {
  REQUIRED_REMOTE_COMMIT_RESULT,
  RequiredRemoteCommitError,
  type RequiredRemoteCommitResult,
} from "./remoteCommit";

export interface DeleteSettingFromCloudOptions {
  /** Capability carried only by the durable journal-security removal intent. */
  journalSecurityRemovalRevision?: string;
  /** Captured local/remote vault revision used by the strict server-side CAS path. */
  expectedVaultRevision?: number;
  /** Journal removal must retry its parent intent instead of creating a stale generic delete. */
  queueOnNetworkError?: boolean;
  /** Cancels the strict remote vault deletion request without acknowledging cleanup. */
  signal?: AbortSignal;
}

export interface RemoteVaultDeleteInput {
  expectedOwnerUserId: string;
  expectedVaultRevision: number;
  operationRevision: string;
  signal?: AbortSignal;
}

export interface SyncSettingOptions {
  /** Durable security migrations advance only after the remote row is committed. */
  requireRemoteCommit?: boolean;
  /** Exact previous wrapper required for a same-content-epoch password rewrap. */
  journalVaultExpectedValue?: unknown;
  /** Cancels a strict migration write without acknowledging durable progress. */
  signal?: AbortSignal;
}

function throwIfSettingSyncAborted(
  signal: AbortSignal | undefined,
  requireRemoteCommit = false
): void {
  if (!signal?.aborted) return;
  if (requireRemoteCommit) throw new RequiredRemoteCommitError("aborted");
  if (signal.reason instanceof Error) throw signal.reason;
  throw new DOMException("Setting sync was aborted", "AbortError");
}

// ============================================
// SETTINGS SYNC
// ============================================

export const syncSetting = async (
  key: string,
  value: unknown,
  expectedOwnerUserId?: string,
  options: SyncSettingOptions = {}
): Promise<void> => {
  throwIfSettingSyncAborted(options.signal, options.requireRemoteCommit === true);
  const usesJournalVaultWrapperCas = options.journalVaultExpectedValue !== undefined;
  if (
    usesJournalVaultWrapperCas &&
    (key !== SK.JOURNAL_VAULT_KEY || options.requireRemoteCommit !== true)
  ) {
    throw new RequiredRemoteCommitError("stale");
  }
  if (!isAccountSyncedSettingKey(key)) {
    logger.warn("[Sync] Skipping local-only setting sync:", key);
    return;
  }

  const userId = await validateSyncOwner(expectedOwnerUserId, "Setting sync");
  // Explicit validation to prevent RLS violations with undefined user_id
  if (!supabase) {
    if (options.requireRemoteCommit) {
      throw new Error("Supabase client is unavailable for the diary vault migration");
    }
    return;
  }
  if (!userId) {
    logger.warn("[Sync] Cannot sync setting: User not authenticated");
    if (options.requireRemoteCommit) {
      throw new RequiredRemoteCommitError("no-op");
    }
    return;
  }

  if (!(await canUploadAccountSetting(key, value))) {
    logger.warn("[Sync] Skipping stale or inactive setting sync:", key);
    if (options.requireRemoteCommit) {
      throw new RequiredRemoteCommitError("stale");
    }
    return;
  }
  if (!(await validateSyncOwner(userId, "Setting sync local-state guard"))) {
    if (options.requireRemoteCommit) {
      throw new RequiredRemoteCommitError("no-op");
    }
    return;
  }

  // Offline queue: defer sync when offline (same pattern as syncMood/syncHabit)
  if (!navigator.onLine) {
    if (options.requireRemoteCommit) {
      throw new RequiredRemoteCommitError("queued");
    }
    await offlineQueue.enqueue(
      "UPDATE_SETTINGS",
      key,
      { key, value },
      {
        expectedOwnerUserId: userId,
      }
    );
    return;
  }

  try {
    const updatedAt = new Date().toISOString();
    const payload = { key, value, updatedAt };
    if (!(await validateSyncOwner(userId, "Setting sync"))) {
      if (options.requireRemoteCommit) {
        throw new RequiredRemoteCommitError("no-op");
      }
      return;
    }
    const remoteRequest = usesJournalVaultWrapperCas
      ? supabase.rpc("compare_and_swap_journal_vault_wrapper", {
          p_expected_value: options.journalVaultExpectedValue as Json,
          p_next_value: value as Json,
        })
      : supabase.from("user_settings").upsert(
          {
            user_id: userId,
            key,
            value: value as Json,
            updated_at: updatedAt,
          },
          { onConflict: "user_id,key" }
        );
    const remoteWrite = options.signal
      ? await remoteRequest.abortSignal(options.signal)
      : await remoteRequest;
    throwIfSettingSyncAborted(options.signal, options.requireRemoteCommit === true);
    const { error } = remoteWrite;
    const wrapperCasResult = usesJournalVaultWrapperCas ? remoteWrite.data : null;

    if (error) throw error;
    if (usesJournalVaultWrapperCas && wrapperCasResult !== "committed") {
      throw new RequiredRemoteCommitError("stale");
    }
    const deviceId = await getPersistentDeviceId();
    await writeEventAndBroadcast("setting", key, "upsert", payload, deviceId, {
      expectedOwnerUserId: userId,
    });
    throwIfSettingSyncAborted(options.signal, options.requireRemoteCommit === true);
    logger.log("[Sync] Setting synced:", key);
  } catch (error) {
    // Handle AbortError separately
    if (isAbortError(error)) {
      if (options.requireRemoteCommit) throw new RequiredRemoteCommitError("aborted");
      logger.warn("[Sync] Setting sync aborted:", key);
      return;
    }
    // Network error: queue for retry when online
    if (detectNetworkError(error)) {
      if (options.requireRemoteCommit) throw new RequiredRemoteCommitError("queued");
      await offlineQueue.enqueue(
        "UPDATE_SETTINGS",
        key,
        { key, value },
        {
          expectedOwnerUserId: userId,
        }
      );
      return;
    }
    logger.error("[Sync] Failed to sync setting:", error);
    // P0-4 Fix: Re-throw for offline queue handlers
    throw error;
  }
};

export const deleteSettingFromCloud = async (
  key: string,
  expectedOwnerUserId?: string,
  options: DeleteSettingFromCloudOptions = {}
): Promise<void> => {
  const requiresVaultCommit =
    key === SK.JOURNAL_VAULT_KEY && options.expectedVaultRevision !== undefined;
  if (!shouldDeleteSettingFromCloud(key)) {
    logger.warn("[Sync] Skipping local-only setting delete sync:", key);
    return;
  }

  const userId = await validateSyncOwner(expectedOwnerUserId, "Setting delete");
  if (!supabase) {
    if (requiresVaultCommit) throw new RequiredRemoteCommitError("no-op");
    if (key === SK.JOURNAL_VAULT_KEY && options.journalSecurityRemovalRevision) {
      throw new Error("Supabase client is unavailable for diary protection removal");
    }
    return;
  }
  if (!userId) {
    logger.warn("[Sync] Cannot delete setting: User not authenticated");
    if (requiresVaultCommit) throw new RequiredRemoteCommitError("no-op");
    return;
  }

  if (key === SK.JOURNAL_VAULT_KEY) {
    const removalRevision = options.journalSecurityRemovalRevision;
    if (
      !removalRevision ||
      !(await canDeleteRemoteJournalVault(removalRevision, userId, options.expectedVaultRevision))
    ) {
      logger.warn("[Sync] Skipping journal vault delete without its active removal intent");
      if (requiresVaultCommit) throw new RequiredRemoteCommitError("stale");
      return;
    }
    await validateSyncOwner(userId, "Journal vault delete local-state guard");
  }

  // A legacy account copy of device-local privacy choices must be removed
  // remotely without erasing the current device's durable recovery copy.
  if (key !== SK.PRIVACY) {
    storageRemove(key);
  }

  if (!navigator.onLine) {
    if (options.queueOnNetworkError === false) {
      if (requiresVaultCommit) throw new RequiredRemoteCommitError("queued");
      throw new Error("Online connection is required to complete diary protection removal");
    }
    await offlineQueue.enqueue(
      "DELETE_SETTINGS",
      key,
      { key },
      {
        expectedOwnerUserId: userId,
      }
    );
    return;
  }

  try {
    const deletedAt = new Date().toISOString();
    const payload = { key, deletedAt };
    if (!(await validateSyncOwner(userId, "Setting delete"))) {
      if (requiresVaultCommit) throw new RequiredRemoteCommitError("no-op");
      return;
    }
    if (requiresVaultCommit) {
      const expectedVaultRevision = options.expectedVaultRevision;
      const removalRevision = options.journalSecurityRemovalRevision;
      if (
        expectedVaultRevision === undefined ||
        !Number.isSafeInteger(expectedVaultRevision) ||
        expectedVaultRevision < 0 ||
        !removalRevision ||
        !(await canDeleteRemoteJournalVault(removalRevision, userId, expectedVaultRevision))
      ) {
        throw new RequiredRemoteCommitError("stale");
      }
      const deleteRequest = supabase.rpc("finalize_journal_password_removal", {
        p_expected_vault_revision: expectedVaultRevision,
        p_operation_revision: removalRevision,
      });
      const { data, error } = options.signal
        ? await deleteRequest.abortSignal(options.signal)
        : await deleteRequest;
      if (error) throw error;
      if (data !== "complete") {
        throw new RequiredRemoteCommitError("stale");
      }
    } else {
      const { error } = await supabase
        .from("user_settings")
        .delete()
        .match({ user_id: userId, key });

      if (error) throw error;
    }
    const deviceId = await getPersistentDeviceId();
    await writeEventAndBroadcast("setting", key, "delete", payload, deviceId, {
      expectedOwnerUserId: userId,
    });
    logger.log("[Sync] Setting deleted:", key);
  } catch (error) {
    if (isAbortError(error)) {
      logger.warn("[Sync] Setting delete aborted:", key);
      if (requiresVaultCommit) throw new RequiredRemoteCommitError("aborted");
      return;
    }
    if (detectNetworkError(error)) {
      if (requiresVaultCommit) throw new RequiredRemoteCommitError("queued");
      if (options.queueOnNetworkError === false) throw error;
      await offlineQueue.enqueue(
        "DELETE_SETTINGS",
        key,
        { key },
        {
          expectedOwnerUserId: userId,
        }
      );
      return;
    }
    logger.error("[Sync] Failed to delete setting:", error);
    throw error;
  }
};

export const deleteRemoteJournalVault = async (
  input: RemoteVaultDeleteInput
): Promise<RequiredRemoteCommitResult> => {
  if (
    !input.expectedOwnerUserId ||
    !input.operationRevision ||
    !Number.isSafeInteger(input.expectedVaultRevision) ||
    input.expectedVaultRevision < 0
  ) {
    throw new RequiredRemoteCommitError("stale");
  }

  await deleteSettingFromCloud(SK.JOURNAL_VAULT_KEY, input.expectedOwnerUserId, {
    journalSecurityRemovalRevision: input.operationRevision,
    expectedVaultRevision: input.expectedVaultRevision,
    queueOnNetworkError: false,
    signal: input.signal,
  });
  return REQUIRED_REMOTE_COMMIT_RESULT;
};

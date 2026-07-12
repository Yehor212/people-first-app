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
import {
  canDeleteRemoteJournalVault,
  canUploadAccountSetting,
} from "./journalVaultSyncPolicy";

export interface DeleteSettingFromCloudOptions {
  /** Capability carried only by the durable journal-security removal intent. */
  journalSecurityRemovalRevision?: string;
  /** Journal removal must retry its parent intent instead of creating a stale generic delete. */
  queueOnNetworkError?: boolean;
}

export interface SyncSettingOptions {
  /** Durable security migrations advance only after the remote row is committed. */
  requireRemoteCommit?: boolean;
}

// ============================================
// SETTINGS SYNC
// ============================================

export const syncSetting = async (
  key: string,
  value: unknown,
  expectedOwnerUserId?: string,
  options: SyncSettingOptions = {},
): Promise<void> => {
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
    return;
  }

  if (!(await canUploadAccountSetting(key, value))) {
    logger.warn("[Sync] Skipping stale or inactive setting sync:", key);
    return;
  }
  await validateSyncOwner(userId, "Setting sync local-state guard");

  // Offline queue: defer sync when offline (same pattern as syncMood/syncHabit)
  if (!navigator.onLine) {
    if (options.requireRemoteCommit) {
      throw new Error("Online connection is required to migrate the diary vault");
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
    if (!(await validateSyncOwner(userId, "Setting sync"))) return;
    const { error } = await supabase.from("user_settings").upsert(
      {
        user_id: userId,
        key,
        value: value as Json,
        updated_at: updatedAt,
      },
      { onConflict: "user_id,key" }
    );

    if (error) throw error;
    const deviceId = await getPersistentDeviceId();
    await writeEventAndBroadcast("setting", key, "upsert", payload, deviceId, {
      expectedOwnerUserId: userId,
    });
    logger.log("[Sync] Setting synced:", key);
  } catch (error) {
    // Handle AbortError separately
    if (isAbortError(error)) {
      if (options.requireRemoteCommit) throw error;
      logger.warn("[Sync] Setting sync aborted:", key);
      return;
    }
    // Network error: queue for retry when online
    if (detectNetworkError(error)) {
      if (options.requireRemoteCommit) throw error;
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
  options: DeleteSettingFromCloudOptions = {},
): Promise<void> => {
  if (!shouldDeleteSettingFromCloud(key)) {
    logger.warn("[Sync] Skipping local-only setting delete sync:", key);
    return;
  }

  const userId = await validateSyncOwner(expectedOwnerUserId, "Setting delete");
  if (!supabase) {
    if (
      key === SK.JOURNAL_VAULT_KEY &&
      options.journalSecurityRemovalRevision
    ) {
      throw new Error("Supabase client is unavailable for diary protection removal");
    }
    return;
  }
  if (!userId) {
    logger.warn("[Sync] Cannot delete setting: User not authenticated");
    return;
  }

  if (key === SK.JOURNAL_VAULT_KEY) {
    const removalRevision = options.journalSecurityRemovalRevision;
    if (
      !removalRevision ||
      !(await canDeleteRemoteJournalVault(removalRevision, userId))
    ) {
      logger.warn("[Sync] Skipping journal vault delete without its active removal intent");
      return;
    }
    await validateSyncOwner(userId, "Journal vault delete local-state guard");
  }

  storageRemove(key);

  if (!navigator.onLine) {
    if (options.queueOnNetworkError === false) {
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
    if (!(await validateSyncOwner(userId, "Setting delete"))) return;
    const { error } = await supabase.from("user_settings").delete().match({ user_id: userId, key });

    if (error) throw error;
    const deviceId = await getPersistentDeviceId();
    await writeEventAndBroadcast("setting", key, "delete", payload, deviceId, {
      expectedOwnerUserId: userId,
    });
    logger.log("[Sync] Setting deleted:", key);
  } catch (error) {
    if (isAbortError(error)) {
      logger.warn("[Sync] Setting delete aborted:", key);
      return;
    }
    if (detectNetworkError(error)) {
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

import { runWithDataWriteBarrier } from "@/hooks/useIndexedDB";
import { clearAccountDeviceSurfaces } from "@/lib/accountDeviceCleanup";
import { clearNativeJournalBiometricCredential } from "@/lib/journalBiometricCredentials";
import { clearJournalContentSession } from "@/lib/journalContentSession";
import { logger } from "@/lib/logger";
import { clearAccountNotificationsForBoundary } from "@/lib/localNotifications";
import { offlineQueue } from "@/lib/offlineQueue";
import { runWithOriginExclusiveLock } from "@/lib/originExclusiveLock";
import { removePushToken } from "@/lib/pushNotifications";
import {
  safeLocalStorageSet,
  storageReadRaw,
  storageRemove,
} from "@/lib/safeJson";
import { SK } from "@/lib/storageKeys";
import { supabase } from "@/lib/supabaseClient";
import {
  quiesceCloudSync,
  resumeCloudSync,
  startAutoSync,
} from "@/storage/cloudSync";
import { clearLocalUserData, getLocalDataOwnerId } from "@/storage/db";
import { clearDeviceIdCache } from "@/storage/eventSync";
import { hasPendingJournalSecurityMigrationForOwner } from "@/features/journal";

const ACCOUNT_SIGN_OUT_CLEANUP_LOCK = "zenflow:account-sign-out-cleanup";

export type AccountSignOutCleanupPhase =
  | "awaiting-local-cleanup"
  | "purging-local-data";

export interface PendingAccountSignOutCleanup {
  version: 1;
  ownerUserId: string;
  localDataOwnerUserId: string | null;
  phase: AccountSignOutCleanupPhase;
  createdAt: number;
}

export type OwnerSafeSignOutResult =
  | { status: "signed-out" }
  | { status: "pending-changes" }
  | { status: "cleanup-failed"; sessionEnded: boolean }
  | { status: "sign-out-failed" }
  | { status: "session-changed" }
  | { status: "no-session" };

export type PendingAccountSignOutCleanupResult =
  | { status: "none" }
  | { status: "completed" }
  | { status: "cancelled" }
  | { status: "blocked" };

export interface PerformOwnerSafeSignOutOptions {
  discardPendingChanges?: boolean;
  restorePushRegistration?: () => Promise<unknown>;
}

type MarkerReadResult =
  | { status: "none" }
  | { status: "found"; marker: PendingAccountSignOutCleanup }
  | { status: "blocked"; reason: "storage-unavailable" | "invalid-marker" };

function isNonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

async function readActiveSessionOwner(): Promise<string | null> {
  if (!supabase) return null;
  const { data, error } = await supabase.auth.getSession();
  if (error) {
    const sessionError = new Error("Unable to verify the active session");
    (sessionError as Error & { cause?: unknown }).cause = error;
    throw sessionError;
  }
  const userId = data.session?.user?.id;
  if (data.session && !isNonEmptyString(userId)) {
    throw new Error("The active session has no valid account owner");
  }
  return userId ?? null;
}

function isPendingCleanupMarker(value: unknown): value is PendingAccountSignOutCleanup {
  if (!value || typeof value !== "object") return false;
  const candidate = value as Partial<PendingAccountSignOutCleanup>;
  return (
    candidate.version === 1 &&
    isNonEmptyString(candidate.ownerUserId) &&
    (candidate.localDataOwnerUserId === null ||
      isNonEmptyString(candidate.localDataOwnerUserId)) &&
    (candidate.phase === "awaiting-local-cleanup" ||
      candidate.phase === "purging-local-data") &&
    (candidate.phase !== "purging-local-data" ||
      candidate.localDataOwnerUserId === candidate.ownerUserId) &&
    typeof candidate.createdAt === "number" &&
    Number.isFinite(candidate.createdAt) &&
    candidate.createdAt > 0
  );
}

function readPendingCleanupMarker(): MarkerReadResult {
  const stored = storageReadRaw(SK.PENDING_ACCOUNT_SIGN_OUT_CLEANUP);
  if (!stored.ok) {
    return { status: "blocked", reason: "storage-unavailable" };
  }
  if (stored.value === null) return { status: "none" };

  try {
    const parsed: unknown = JSON.parse(stored.value);
    return isPendingCleanupMarker(parsed)
      ? { status: "found", marker: parsed }
      : { status: "blocked", reason: "invalid-marker" };
  } catch {
    return { status: "blocked", reason: "invalid-marker" };
  }
}

function persistPendingCleanupMarker(marker: PendingAccountSignOutCleanup): boolean {
  if (!safeLocalStorageSet(SK.PENDING_ACCOUNT_SIGN_OUT_CLEANUP, marker)) {
    return false;
  }
  const verified = readPendingCleanupMarker();
  return (
    verified.status === "found" &&
    verified.marker.version === marker.version &&
    verified.marker.ownerUserId === marker.ownerUserId &&
    verified.marker.localDataOwnerUserId === marker.localDataOwnerUserId &&
    verified.marker.phase === marker.phase &&
    verified.marker.createdAt === marker.createdAt
  );
}

function removePendingCleanupMarker(): boolean {
  storageRemove(SK.PENDING_ACCOUNT_SIGN_OUT_CLEANUP);
  const verified = storageReadRaw(SK.PENDING_ACCOUNT_SIGN_OUT_CLEANUP);
  return verified.ok && verified.value === null;
}

async function suspendAccountBoundary(): Promise<void> {
  await quiesceCloudSync();
  try {
    await offlineQueue.suspendForAccountBoundary();
  } catch (error) {
    resumeCloudSync();
    offlineQueue.resumeAfterAccountBoundary();
    throw error;
  }
}

function resumeAccountBoundary(hasActiveSession: boolean): void {
  resumeCloudSync();
  offlineQueue.resumeAfterAccountBoundary();
  if (hasActiveSession) startAutoSync();
}

async function restorePushRegistrationSafely(
  restorePushRegistration: (() => Promise<unknown>) | undefined,
): Promise<void> {
  if (!restorePushRegistration) return;
  try {
    await restorePushRegistration();
  } catch (error) {
    logger.error(
      "[AccountCleanup] Failed to restore push registration after aborted sign-out:",
      error,
    );
  }
}

async function hasDurableOwnerWrites(ownerUserId: string): Promise<boolean> {
  return (
    (await offlineQueue.hasPendingActionsForOwnerReady(ownerUserId)) ||
    (await hasPendingJournalSecurityMigrationForOwner(ownerUserId))
  );
}

async function purgeOwnedLocalRealm(
  marker: PendingAccountSignOutCleanup,
): Promise<boolean> {
  let durableMarker = marker;
  if (marker.phase !== "purging-local-data") {
    durableMarker = { ...marker, phase: "purging-local-data" };
    if (!persistPendingCleanupMarker(durableMarker)) {
      throw new Error("Unable to persist the local purge phase");
    }
  }

  await runWithDataWriteBarrier(
    async () => {
      clearJournalContentSession("sign-out");
      clearDeviceIdCache();
      await clearLocalUserData();
    },
    { deferredWrites: "discard" },
  );

  // clearLocalUserData deliberately cannot delete this marker. Only a verified
  // post-purge removal commits completion; failed removal remains retryable.
  return removePendingCleanupMarker();
}

async function finishPendingCleanup(
  marker: PendingAccountSignOutCleanup,
  activeSessionUserId: string | null,
  options: { boundaryAlreadySuspended?: boolean } = {},
): Promise<PendingAccountSignOutCleanupResult> {
  if (!options.boundaryAlreadySuspended) {
    await suspendAccountBoundary();
  }

  try {
    if (activeSessionUserId === marker.ownerUserId) {
      if (!removePendingCleanupMarker()) {
        throw new Error("Unable to cancel stale cleanup after same-account sign-in");
      }
      resumeAccountBoundary(true);
      return { status: "cancelled" };
    }

    const currentLocalOwnerUserId = await getLocalDataOwnerId();
    const ownedRealmStillPresent = currentLocalOwnerUserId === marker.ownerUserId;
    const interruptedPurgeLostOwner =
      marker.phase === "purging-local-data" && currentLocalOwnerUserId === null;
    const anotherOwnerNowOwnsRealm =
      currentLocalOwnerUserId !== null &&
      currentLocalOwnerUserId !== marker.ownerUserId;

    if (anotherOwnerNowOwnsRealm) {
      if (!removePendingCleanupMarker()) {
        throw new Error("Unable to remove cleanup intent for a different local owner");
      }
      resumeAccountBoundary(activeSessionUserId !== null);
      return { status: "cancelled" };
    }

    if (ownedRealmStillPresent || interruptedPurgeLostOwner) {
      await clearAccountNotificationsForBoundary();
      await clearNativeJournalBiometricCredential();
      await clearAccountDeviceSurfaces();
      await offlineQueue.discardSuspendedActionsForAccountBoundary();
      if (!(await purgeOwnedLocalRealm(marker))) {
        throw new Error("Unable to confirm local cleanup completion");
      }
    } else {
      // Owner-null local-first data is not the signed-out account's realm. Keep
      // its queue and journal credentials intact and only clear safe surfaces.
      await clearAccountNotificationsForBoundary();
      await clearAccountDeviceSurfaces();
      if (!removePendingCleanupMarker()) {
        throw new Error("Unable to confirm owner-null cleanup completion");
      }
    }

    resumeAccountBoundary(activeSessionUserId !== null);
    return { status: "completed" };
  } catch (error) {
    logger.error("[AccountCleanup] Pending sign-out cleanup remains blocked:", error);
    // Keep cloud sync and the queue suspended. The durable marker is the retry
    // authority and prevents another account from inheriting this local realm.
    return { status: "blocked" };
  }
}

async function reconcilePendingCleanupUnlocked(
  activeSessionUserId: string | null,
): Promise<PendingAccountSignOutCleanupResult> {
  const markerRead = readPendingCleanupMarker();
  if (markerRead.status === "none") return { status: "none" };
  if (markerRead.status === "blocked") {
    logger.error("[AccountCleanup] Durable cleanup marker cannot be read safely", {
      reason: markerRead.reason,
    });
    try {
      await suspendAccountBoundary();
    } catch (error) {
      logger.error("[AccountCleanup] Failed to suspend after marker read error:", error);
    }
    return { status: "blocked" };
  }
  return finishPendingCleanup(markerRead.marker, activeSessionUserId);
}

export async function reconcilePendingAccountSignOutCleanup(
  activeSessionUserId: string | null,
): Promise<PendingAccountSignOutCleanupResult> {
  try {
    return await runWithOriginExclusiveLock(ACCOUNT_SIGN_OUT_CLEANUP_LOCK, async () => {
      const verifiedSessionUserId = await readActiveSessionOwner();
      if (verifiedSessionUserId !== activeSessionUserId) {
        logger.warn(
          "[AccountCleanup] Auth state changed before pending cleanup reconciliation",
        );
      }
      return reconcilePendingCleanupUnlocked(verifiedSessionUserId);
    });
  } catch (error) {
    logger.error("[AccountCleanup] Could not acquire cleanup coordinator:", error);
    return { status: "blocked" };
  }
}

async function performOwnerSafeSignOutUnlocked(
  options: PerformOwnerSafeSignOutOptions,
): Promise<OwnerSafeSignOutResult> {
  const existingMarker = readPendingCleanupMarker();
  if (existingMarker.status === "blocked") {
    try {
      await suspendAccountBoundary();
    } catch (error) {
      logger.error("[AccountCleanup] Failed to suspend after marker read error:", error);
    }
    return { status: "cleanup-failed", sessionEnded: false };
  }

  const ownerUserId = await readActiveSessionOwner();
  if (existingMarker.status === "found" && ownerUserId === null) {
    const retry = await finishPendingCleanup(existingMarker.marker, null);
    return retry.status === "completed" || retry.status === "cancelled"
      ? { status: "signed-out" }
      : { status: "cleanup-failed", sessionEnded: true };
  }
  if (
    existingMarker.status === "found" &&
    ownerUserId !== existingMarker.marker.ownerUserId
  ) {
    await finishPendingCleanup(existingMarker.marker, ownerUserId);
    return { status: "session-changed" };
  }
  if (!ownerUserId || !supabase) return { status: "no-session" };

  await suspendAccountBoundary();

  if (
    (await hasDurableOwnerWrites(ownerUserId)) &&
    !options.discardPendingChanges
  ) {
    resumeAccountBoundary(true);
    return { status: "pending-changes" };
  }

  const localDataOwnerUserId = await getLocalDataOwnerId();
  const ownerBeforePushRevocation = await readActiveSessionOwner();
  if (ownerBeforePushRevocation !== ownerUserId) {
    const marker: PendingAccountSignOutCleanup = {
      version: 1,
      ownerUserId,
      localDataOwnerUserId,
      phase: "awaiting-local-cleanup",
      createdAt: Date.now(),
    };
    if (!persistPendingCleanupMarker(marker)) {
      resumeAccountBoundary(ownerBeforePushRevocation !== null);
      return {
        status: "cleanup-failed",
        sessionEnded: ownerBeforePushRevocation === null,
      };
    }
    const reconciled = await finishPendingCleanup(marker, ownerBeforePushRevocation, {
      boundaryAlreadySuspended: true,
    });
    if (ownerBeforePushRevocation !== null) return { status: "session-changed" };
    return reconciled.status === "completed" || reconciled.status === "cancelled"
      ? { status: "signed-out" }
      : { status: "cleanup-failed", sessionEnded: true };
  }

  const pushRevocation = await removePushToken();
  if (pushRevocation.status !== "revoked") {
    await restorePushRegistrationSafely(options.restorePushRegistration);
    resumeAccountBoundary(true);
    return { status: "cleanup-failed", sessionEnded: false };
  }

  const finalSessionOwnerUserId = await readActiveSessionOwner();
  const marker: PendingAccountSignOutCleanup =
    existingMarker.status === "found"
      ? {
          ...existingMarker.marker,
          localDataOwnerUserId,
          phase: "awaiting-local-cleanup",
        }
      : {
          version: 1,
          ownerUserId,
          localDataOwnerUserId,
          phase: "awaiting-local-cleanup",
          createdAt: Date.now(),
        };

  if (!persistPendingCleanupMarker(marker)) {
    await restorePushRegistrationSafely(options.restorePushRegistration);
    resumeAccountBoundary(finalSessionOwnerUserId !== null);
    return {
      status: "cleanup-failed",
      sessionEnded: finalSessionOwnerUserId === null,
    };
  }

  if (finalSessionOwnerUserId !== ownerUserId) {
    const reconciled = await finishPendingCleanup(marker, finalSessionOwnerUserId, {
      boundaryAlreadySuspended: true,
    });
    return finalSessionOwnerUserId === null && reconciled.status === "completed"
      ? { status: "signed-out" }
      : finalSessionOwnerUserId !== null
        ? { status: "session-changed" }
        : { status: "cleanup-failed", sessionEnded: true };
  }

  // No awaited operation belongs between the durable intent and Supabase. A
  // crash or false-negative response therefore always leaves retry authority.
  let signOutError: unknown;
  try {
    ({ error: signOutError } = await supabase.auth.signOut({ scope: "local" }));
  } catch (error) {
    logger.error("[AccountCleanup] Supabase sign-out threw:", error);
    try {
      const activeSessionUserId = await readActiveSessionOwner();
      if (activeSessionUserId === ownerUserId) {
        await restorePushRegistrationSafely(options.restorePushRegistration);
        resumeAccountBoundary(true);
        return { status: "sign-out-failed" };
      }
      const reconciled = await finishPendingCleanup(marker, activeSessionUserId, {
        boundaryAlreadySuspended: true,
      });
      if (activeSessionUserId !== null) return { status: "session-changed" };
      return reconciled.status === "completed" || reconciled.status === "cancelled"
        ? { status: "signed-out" }
        : { status: "cleanup-failed", sessionEnded: true };
    } catch (verificationError) {
      logger.error(
        "[AccountCleanup] Sign-out outcome could not be verified; cleanup remains pending:",
        verificationError,
      );
      return { status: "cleanup-failed", sessionEnded: false };
    }
  }
  if (signOutError) {
    logger.error("[AccountCleanup] Supabase sign-out failed:", signOutError);
    await restorePushRegistrationSafely(options.restorePushRegistration);
    resumeAccountBoundary(true);
    return { status: "sign-out-failed" };
  }

  const cleanup = await finishPendingCleanup(marker, null, {
    boundaryAlreadySuspended: true,
  });
  return cleanup.status === "completed" || cleanup.status === "cancelled"
    ? { status: "signed-out" }
    : { status: "cleanup-failed", sessionEnded: true };
}

export async function performOwnerSafeSignOut(
  options: PerformOwnerSafeSignOutOptions = {},
): Promise<OwnerSafeSignOutResult> {
  try {
    return await runWithOriginExclusiveLock(ACCOUNT_SIGN_OUT_CLEANUP_LOCK, () =>
      performOwnerSafeSignOutUnlocked(options),
    );
  } catch (error) {
    logger.error("[AccountCleanup] Owner-safe sign-out failed before completion:", error);
    await restorePushRegistrationSafely(options.restorePushRegistration);
    // Unknown coordinator/lock/session failures are fail-closed. Explicit
    // pre-sign-out failures above are the only paths allowed to resume writers.
    return { status: "cleanup-failed", sessionEnded: false };
  }
}

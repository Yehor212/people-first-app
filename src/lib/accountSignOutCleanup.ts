import {
  isDataWriteBarrierPostCommitError,
  runWithDataWriteBarrier,
  runWithSettledDataRead,
} from "@/hooks/useIndexedDB";
import { deleteAccount, resumeAccountDeletion } from "@/lib/accountService";
import {
  type AccountDeletionCapability,
  createAccountDeletionCapability,
  isAccountDeletionOperationId,
  isAccountDeletionRecoverySecret,
} from "@/lib/accountDeletionCapability";
import { clearAccountDeviceSurfaces } from "@/lib/accountDeviceCleanup";
import { clearNativeJournalBiometricCredential } from "@/lib/journalBiometricCredentials";
import { clearJournalContentSession } from "@/lib/journalContentSession";
import { logger } from "@/lib/logger";
import {
  assertOriginAccountBoundaryGeneration,
  captureOriginAccountBoundaryGeneration,
  type OriginAccountBoundaryGeneration,
} from "@/storage/accountBoundaryRuntime";
import {
  clearAccountNotificationsForBoundary,
  resumeAccountNotifications,
} from "@/lib/localNotifications";
import { dispatchNativeReminderReconcile } from "@/lib/notificationLifecycle";
import { offlineQueue } from "@/lib/offlineQueue";
import { runWithOriginExclusiveLock } from "@/lib/originExclusiveLock";
import { signOutExpectedOwnerLocally } from "@/lib/ownerBoundAuthSession";
import { leavePresenceForAccountBoundary } from "@/lib/presenceService";
import {
  revokePushForAccountBoundary,
  revokePushForCurrentSession,
} from "@/lib/pushNotifications";
import {
  safeLocalStorageSet,
  storageReadRaw,
  storageRemove,
} from "@/lib/safeJson";
import { SK } from "@/lib/storageKeys";
import { supabase } from "@/lib/supabaseClient";
import {
  getCloudSyncAccountBoundaryEpoch,
  isCloudSyncSuspendedForAccountBoundary,
  quiesceCloudSync,
  resumeCloudSync,
  startAutoSync,
} from "@/storage/cloudSync";
import { clearLocalUserData, getLocalDataOwnerId } from "@/storage/db";
import { clearDeviceIdCache } from "@/storage/eventSync";
import {
  getPendingJournalSecurityMigrationRevisionForOwner,
  hasPendingJournalSecurityMigrationForOwner,
  hasPendingJournalSecurityRemovalForOwner,
} from "@/features/journal";
import {
  areAccountBoundaryWritersSuspended,
  getAccountBoundaryWritersEpoch,
  resumeAccountBoundaryWriters,
  suspendAccountBoundaryWriters,
} from "@/lib/accountBoundaryState";

const ACCOUNT_SIGN_OUT_CLEANUP_LOCK = "zenflow:account-sign-out-cleanup";
const ACCOUNT_OWNER_VERIFICATION_TIMEOUT_MS = 15_000;

export type AccountSignOutCleanupPhase =
  | "remote-deletion-requested"
  | "awaiting-local-cleanup"
  | "purging-local-data";

export type AccountCleanupIntent = "sign-out" | "account-deletion";

interface PendingAccountCleanupBase {
  ownerUserId: string;
  localDataOwnerUserId: string | null;
  createdAt: number;
}

export type PendingAccountSignOutCleanup =
  | (PendingAccountCleanupBase & {
      version: 1;
      /** Missing on legacy markers and therefore interpreted as `sign-out`. */
      intent?: AccountCleanupIntent;
      phase: AccountSignOutCleanupPhase;
      /** Exact revision the user explicitly authorized discarding; never a wildcard. */
      authorizedJournalMigrationRevision?: string | null;
    })
  | (PendingAccountCleanupBase & {
      version: 2;
      intent: "account-deletion";
      phase: "remote-deletion-requested";
      operationId: string;
      recoverySecret: string;
    })
  | (PendingAccountCleanupBase & {
      version: 2;
      intent: "account-deletion";
      phase: "awaiting-local-cleanup" | "purging-local-data";
      operationId: string;
      recoverySecret?: never;
    });

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
  /** Binds retries to the account that initiated them; never reinterpret as a later owner. */
  expectedOwnerUserId?: string;
  /** Distinguishes a later lifecycle of the same account ID from the failed attempt. */
  expectedAccountBoundaryGeneration?: string;
  restorePushRegistration?: () => Promise<unknown>;
}

interface SignOutDiscardAuthorization {
  journalMigrationRevision: string | null;
}

export type RemoteAccountDeletionState =
  | "confirmed"
  | "not-confirmed"
  | "unknown";

export type OwnerSafeAccountDeletionResult =
  | { status: "deleted"; remoteDeletion: "confirmed" }
  | { status: "delete-failed"; remoteDeletion: "not-confirmed" }
  | {
      status: "cleanup-failed";
      remoteDeletion: RemoteAccountDeletionState;
    }
  | {
      status: "session-changed";
      remoteDeletion: RemoteAccountDeletionState;
    }
  | { status: "no-session"; remoteDeletion: "not-confirmed" };

export interface PerformOwnerSafeAccountDeletionOptions {
  restorePushRegistration?: () => Promise<unknown>;
}

type MarkerReadResult =
  | { status: "none" }
  | { status: "found"; marker: PendingAccountSignOutCleanup }
  | { status: "blocked"; reason: "storage-unavailable" | "invalid-marker" };

function isNonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

function cleanupIntent(marker: PendingAccountSignOutCleanup): AccountCleanupIntent {
  return marker.intent ?? "sign-out";
}

function markerDiscardAuthorization(
  marker: PendingAccountSignOutCleanup,
): SignOutDiscardAuthorization | undefined {
  if (
    marker.version !== 1 ||
    cleanupIntent(marker) !== "sign-out" ||
    !("authorizedJournalMigrationRevision" in marker)
  ) {
    return undefined;
  }
  return {
    journalMigrationRevision: marker.authorizedJournalMigrationRevision ?? null,
  };
}

async function readActiveSessionOwner(): Promise<string | null> {
  if (!supabase) return null;
  let timeoutId: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<never>((_resolve, reject) => {
    timeoutId = setTimeout(() => {
      reject(new Error("Timed out while verifying the active session owner"));
    }, ACCOUNT_OWNER_VERIFICATION_TIMEOUT_MS);
  });
  let sessionResult: Awaited<ReturnType<typeof supabase.auth.getSession>>;
  try {
    sessionResult = await Promise.race([supabase.auth.getSession(), timeout]);
  } finally {
    if (timeoutId !== undefined) clearTimeout(timeoutId);
  }
  const { data, error } = sessionResult;
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

export function isPendingAccountCleanupMarker(
  value: unknown,
): value is PendingAccountSignOutCleanup {
  if (!value || typeof value !== "object") return false;
  const candidate = value as Record<string, unknown>;
  const commonIsValid =
    isNonEmptyString(candidate.ownerUserId) &&
    (candidate.localDataOwnerUserId === null ||
      isNonEmptyString(candidate.localDataOwnerUserId)) &&
    (candidate.phase === "remote-deletion-requested" ||
      candidate.phase === "awaiting-local-cleanup" ||
      candidate.phase === "purging-local-data") &&
    (candidate.phase !== "purging-local-data" ||
      candidate.localDataOwnerUserId === candidate.ownerUserId) &&
    typeof candidate.createdAt === "number" &&
    Number.isFinite(candidate.createdAt) &&
    candidate.createdAt > 0;
  if (!commonIsValid) return false;

  if (candidate.version === 1) {
    const intent = candidate.intent ?? "sign-out";
    const hasDiscardAuthorization = Object.prototype.hasOwnProperty.call(
      candidate,
      "authorizedJournalMigrationRevision",
    );
    const discardAuthorizationIsValid =
      !hasDiscardAuthorization ||
      (intent === "sign-out" &&
        (candidate.authorizedJournalMigrationRevision === null ||
          isNonEmptyString(candidate.authorizedJournalMigrationRevision)));
    return (
      (intent === "sign-out" || intent === "account-deletion") &&
      (candidate.phase !== "remote-deletion-requested" ||
        intent === "account-deletion") &&
      candidate.operationId === undefined &&
      candidate.recoverySecret === undefined &&
      discardAuthorizationIsValid
    );
  }

  if (
    candidate.version !== 2 ||
    candidate.intent !== "account-deletion" ||
    !isAccountDeletionOperationId(candidate.operationId)
  ) {
    return false;
  }
  return candidate.phase === "remote-deletion-requested"
    ? isAccountDeletionRecoverySecret(candidate.recoverySecret)
    : candidate.recoverySecret === undefined;
}

function readPendingCleanupMarker(): MarkerReadResult {
  const stored = storageReadRaw(SK.PENDING_ACCOUNT_SIGN_OUT_CLEANUP);
  if (!stored.ok) {
    return { status: "blocked", reason: "storage-unavailable" };
  }
  if (stored.value === null) return { status: "none" };

  try {
    const parsed: unknown = JSON.parse(stored.value);
    return isPendingAccountCleanupMarker(parsed)
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
    cleanupIntent(verified.marker) === cleanupIntent(marker) &&
    verified.marker.ownerUserId === marker.ownerUserId &&
    verified.marker.localDataOwnerUserId === marker.localDataOwnerUserId &&
    verified.marker.phase === marker.phase &&
    verified.marker.createdAt === marker.createdAt &&
    (marker.version !== 1 ||
      (verified.marker.version === 1 &&
        markerDiscardAuthorization(verified.marker)?.journalMigrationRevision ===
          markerDiscardAuthorization(marker)?.journalMigrationRevision)) &&
    (marker.version !== 2 ||
      (verified.marker.version === 2 &&
        verified.marker.operationId === marker.operationId &&
        verified.marker.recoverySecret === marker.recoverySecret))
  );
}

function removePendingCleanupMarker(): boolean {
  storageRemove(SK.PENDING_ACCOUNT_SIGN_OUT_CLEANUP);
  const verified = storageReadRaw(SK.PENDING_ACCOUNT_SIGN_OUT_CLEANUP);
  return verified.ok && verified.value === null;
}

export async function preparePendingAccountSwitchCleanup(
  sourceOwnerUserId: string,
): Promise<boolean> {
  return runWithOriginExclusiveLock(ACCOUNT_SIGN_OUT_CLEANUP_LOCK, async () => {
    if (readPendingCleanupMarker().status !== "none") return false;
    return persistPendingCleanupMarker({
      version: 1,
      intent: "sign-out",
      ownerUserId: sourceOwnerUserId,
      localDataOwnerUserId: sourceOwnerUserId,
      phase: "purging-local-data",
      authorizedJournalMigrationRevision: null,
      createdAt: Date.now(),
    });
  });
}

export async function completePendingAccountSwitchCleanup(
  sourceOwnerUserId: string,
  targetOwnerUserId: string,
): Promise<boolean> {
  return runWithOriginExclusiveLock(ACCOUNT_SIGN_OUT_CLEANUP_LOCK, async () => {
    const markerRead = readPendingCleanupMarker();
    if (
      markerRead.status !== "found" ||
      markerRead.marker.version !== 1 ||
      cleanupIntent(markerRead.marker) !== "sign-out" ||
      markerRead.marker.ownerUserId !== sourceOwnerUserId ||
      markerRead.marker.localDataOwnerUserId !== sourceOwnerUserId ||
      markerRead.marker.phase !== "purging-local-data"
    ) {
      return false;
    }
    if ((await getLocalDataOwnerId()) !== targetOwnerUserId) return false;
    return removePendingCleanupMarker();
  });
}

/**
 * Commits an account-switch local mutation under the canonical lock order:
 * cleanup coordinator first, DATA barrier second (inside `mutation`). Keeping
 * the durable marker lifecycle in this outer coordinator prevents a second tab
 * from reconciling cleanup while the first tab waits on DATA, and avoids the
 * inverse DATA -> cleanup ordering that can deadlock with reconciliation.
 */
export async function commitPendingAccountSwitchCleanup(
  sourceOwnerUserId: string,
  targetOwnerUserId: string,
  mutation: (prepareCleanupIntent: () => boolean) => Promise<void>,
): Promise<boolean> {
  if (
    !isNonEmptyString(sourceOwnerUserId) ||
    !isNonEmptyString(targetOwnerUserId) ||
    sourceOwnerUserId === targetOwnerUserId
  ) {
    return false;
  }

  return runWithOriginExclusiveLock(ACCOUNT_SIGN_OUT_CLEANUP_LOCK, async () => {
    const markerRead = readPendingCleanupMarker();
    if (markerRead.status === "blocked") return false;
    let markerPrepared = markerRead.status === "found";
    if (markerRead.status === "found" && (
      markerRead.marker.version !== 1 ||
      cleanupIntent(markerRead.marker) !== "sign-out" ||
      markerRead.marker.ownerUserId !== sourceOwnerUserId ||
      markerRead.marker.localDataOwnerUserId !== sourceOwnerUserId ||
      markerRead.marker.phase !== "purging-local-data"
    )) {
      return false;
    }

    const currentOwnerUserId = await getLocalDataOwnerId();
    if (currentOwnerUserId === targetOwnerUserId) {
      return markerPrepared ? removePendingCleanupMarker() : true;
    }
    const canMutateSourceRealm =
      currentOwnerUserId === sourceOwnerUserId ||
      (markerPrepared && currentOwnerUserId === null);
    if (!canMutateSourceRealm) return false;

    const prepareCleanupIntent = (): boolean => {
      if (markerPrepared) return true;
      markerPrepared = persistPendingCleanupMarker({
        version: 1,
        intent: "sign-out",
        ownerUserId: sourceOwnerUserId,
        localDataOwnerUserId: sourceOwnerUserId,
        phase: "purging-local-data",
        authorizedJournalMigrationRevision: null,
        createdAt: Date.now(),
      });
      return markerPrepared;
    };

    await mutation(prepareCleanupIntent);
    if (!markerPrepared) return false;
    const committedMarker = readPendingCleanupMarker();
    if (
      committedMarker.status !== "found" ||
      committedMarker.marker.version !== 1 ||
      cleanupIntent(committedMarker.marker) !== "sign-out" ||
      committedMarker.marker.ownerUserId !== sourceOwnerUserId ||
      committedMarker.marker.localDataOwnerUserId !== sourceOwnerUserId ||
      committedMarker.marker.phase !== "purging-local-data"
    ) {
      return false;
    }
    if ((await getLocalDataOwnerId()) !== targetOwnerUserId) return false;
    return removePendingCleanupMarker();
  });
}

interface AccountBoundarySuspensionOwnership {
  writerEpoch: number;
  cloudEpoch: number;
  queueEpoch: number;
  originGeneration: OriginAccountBoundaryGeneration;
}

let ownedAccountBoundarySuspension: AccountBoundarySuspensionOwnership | null = null;

function ownsAccountBoundarySuspension(
  ownership: AccountBoundarySuspensionOwnership,
): boolean {
  return (
    areAccountBoundaryWritersSuspended() &&
    getAccountBoundaryWritersEpoch() === ownership.writerEpoch &&
    isCloudSyncSuspendedForAccountBoundary() &&
    getCloudSyncAccountBoundaryEpoch() === ownership.cloudEpoch &&
    offlineQueue.isSuspendedForAccountBoundary() &&
    offlineQueue.getAccountBoundaryEpoch() === ownership.queueEpoch
  );
}

async function suspendAccountBoundary(): Promise<void> {
  if (
    ownedAccountBoundarySuspension &&
    ownsAccountBoundarySuspension(ownedAccountBoundarySuspension)
  ) {
    return;
  }
  if (
    areAccountBoundaryWritersSuspended() ||
    isCloudSyncSuspendedForAccountBoundary() ||
    offlineQueue.isSuspendedForAccountBoundary()
  ) {
    ownedAccountBoundarySuspension = null;
    throw new Error("Account-boundary suspension is owned by another lifecycle");
  }

  const expectedWriterEpoch = getAccountBoundaryWritersEpoch() + 1;
  const originGeneration = captureOriginAccountBoundaryGeneration();
  suspendAccountBoundaryWriters();
  const expectedCloudEpoch = getCloudSyncAccountBoundaryEpoch() + 1;
  let expectedQueueEpoch: number | null = null;
  try {
    await quiesceCloudSync();
    if (
      getAccountBoundaryWritersEpoch() !== expectedWriterEpoch ||
      !areAccountBoundaryWritersSuspended() ||
      getCloudSyncAccountBoundaryEpoch() !== expectedCloudEpoch ||
      !isCloudSyncSuspendedForAccountBoundary()
    ) {
      throw new Error("Account-boundary suspension changed while cloud sync quiesced");
    }

    expectedQueueEpoch = offlineQueue.getAccountBoundaryEpoch() + 1;
    await offlineQueue.suspendForAccountBoundary();
    const ownership = {
      writerEpoch: expectedWriterEpoch,
      cloudEpoch: expectedCloudEpoch,
      queueEpoch: expectedQueueEpoch,
      originGeneration,
    };
    assertOriginAccountBoundaryGeneration(originGeneration);
    if (!ownsAccountBoundarySuspension(ownership)) {
      throw new Error("Account-boundary suspension changed while the queue quiesced");
    }
    ownedAccountBoundarySuspension = ownership;
  } catch (error) {
    // Release only if every acquired component is still the exact turn started
    // above. A newer same-ID lifecycle must retain its own suspension.
    const writerStillOwned =
      areAccountBoundaryWritersSuspended() &&
      getAccountBoundaryWritersEpoch() === expectedWriterEpoch;
    const cloudStillOwned =
      isCloudSyncSuspendedForAccountBoundary() &&
      getCloudSyncAccountBoundaryEpoch() === expectedCloudEpoch;
    const queueSuspended = offlineQueue.isSuspendedForAccountBoundary();
    const queueStillOwned =
      expectedQueueEpoch === null
        ? !queueSuspended
        : queueSuspended &&
          offlineQueue.getAccountBoundaryEpoch() === expectedQueueEpoch;
    if (writerStillOwned && cloudStillOwned && queueStillOwned) {
      if (queueSuspended) offlineQueue.resumeAfterAccountBoundary();
      resumeCloudSync();
      resumeAccountBoundaryWriters();
    }
    ownedAccountBoundarySuspension = null;
    throw error;
  }
}

function resumeAccountBoundary(hasActiveSession: boolean): void {
  const ownership = ownedAccountBoundarySuspension;
  if (!ownership || !ownsAccountBoundarySuspension(ownership)) {
    ownedAccountBoundarySuspension = null;
    logger.warn(
      "[AccountCleanup] Refused to resume an account-boundary suspension owned by another lifecycle",
    );
    return;
  }
  resumeCloudSync();
  offlineQueue.resumeAfterAccountBoundary();
  resumeAccountBoundaryWriters();
  ownedAccountBoundarySuspension = null;
  if (hasActiveSession) startAutoSync();
}

function resumeNotificationsAfterVerifiedCleanup(): void {
  resumeAccountNotifications();
  dispatchNativeReminderReconcile("account-cleanup");
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

interface DurableOwnerWriteState {
  hasDiscardableWrites: boolean;
  hasJournalRemoval: boolean;
}

async function readDurableOwnerWriteState(
  ownerUserId: string,
): Promise<DurableOwnerWriteState> {
  const hasQueuedWrites = await offlineQueue.hasPendingActionsForOwnerReady(ownerUserId);
  const hasJournalMigration = await hasPendingJournalSecurityMigrationForOwner(ownerUserId);
  const hasJournalRemoval = await hasPendingJournalSecurityRemovalForOwner(ownerUserId);
  return {
    hasDiscardableWrites: hasQueuedWrites || hasJournalMigration,
    hasJournalRemoval,
  };
}

async function purgeOwnedLocalRealm(
  marker: PendingAccountSignOutCleanup,
  discardAuthorization?: SignOutDiscardAuthorization,
): Promise<boolean> {
  const suspension = ownedAccountBoundarySuspension;
  if (!suspension || !ownsAccountBoundarySuspension(suspension)) {
    throw new Error("Local cleanup does not own the account-boundary suspension");
  }
  let durableMarker = marker;
  if (marker.phase !== "purging-local-data") {
    durableMarker =
      marker.version === 2
        ? {
            version: 2,
            intent: "account-deletion",
            ownerUserId: marker.ownerUserId,
            localDataOwnerUserId: marker.localDataOwnerUserId,
            phase: "purging-local-data",
            createdAt: marker.createdAt,
            operationId: marker.operationId,
          }
        : { ...marker, phase: "purging-local-data" };
    if (!persistPendingCleanupMarker(durableMarker)) {
      throw new Error("Unable to persist the local purge phase");
    }
  }

  try {
    await runWithDataWriteBarrier(
      async () => {
        if (!ownsAccountBoundarySuspension(suspension)) {
          throw new Error("Account-boundary suspension changed before local purge");
        }
      const isSignOut = cleanupIntent(durableMarker) === "sign-out";
      const queueFinalization =
        await offlineQueue.discardSuspendedActionsForAccountBoundary({
          // Account deletion authorizes the entire realm. Sign-out consent is
          // bounded to the preflight snapshot, so every later queue row blocks.
          onlyIfEmpty: isSignOut,
        });
      if (queueFinalization.status === "blocked") {
        throw new Error("Owner-bound offline writes appeared before local purge");
      }
      if (isSignOut) {
        if (
          await hasPendingJournalSecurityRemovalForOwner(
            durableMarker.ownerUserId,
          )
        ) {
          throw new Error(
            "Diary protection removal must finish before local account data can be purged",
          );
        }
        const currentJournalRevision =
          await getPendingJournalSecurityMigrationRevisionForOwner(
            durableMarker.ownerUserId,
          );
        if (
          currentJournalRevision !== null &&
          currentJournalRevision !==
            discardAuthorization?.journalMigrationRevision
        ) {
          throw new Error(
            "A newer diary security migration appeared before local purge",
          );
        }
      }
      clearJournalContentSession("sign-out");
      clearDeviceIdCache();
      await clearLocalUserData();
      },
      {
        deferredWrites: "discard",
        expectedAccountBoundaryGeneration: suspension.originGeneration,
        beforeAccountBoundaryAdvance: async () => {
          if (
            ownedAccountBoundarySuspension !== suspension ||
            !ownsAccountBoundarySuspension(suspension)
          ) {
            throw new Error(
              "Account-boundary suspension changed before local owner validation",
            );
          }
          const currentLocalOwnerUserId = await getLocalDataOwnerId();
          const ownedRealmStillPresent =
            currentLocalOwnerUserId === durableMarker.ownerUserId;
          const interruptedPurgeLostOwner =
            durableMarker.phase === "purging-local-data" &&
            currentLocalOwnerUserId === null;
          if (!ownedRealmStillPresent && !interruptedPurgeLostOwner) {
            throw new Error(
              "Local data owner changed before the account-boundary purge",
            );
          }
        },
      },
    );
    suspension.originGeneration = captureOriginAccountBoundaryGeneration();
  } catch (error) {
    if (isDataWriteBarrierPostCommitError(error)) {
      suspension.originGeneration = error.capturedOriginGeneration;
    }
    throw error;
  }

  // clearLocalUserData deliberately cannot delete this marker. Only a verified
  // post-purge removal commits completion; failed removal remains retryable.
  return removePendingCleanupMarker();
}

async function finishPendingCleanup(
  marker: PendingAccountSignOutCleanup,
  activeSessionUserId: string | null,
  options: {
    boundaryAlreadySuspended?: boolean;
    discardAuthorization?: SignOutDiscardAuthorization;
  } = {},
): Promise<PendingAccountSignOutCleanupResult> {
  const discardAuthorization =
    options.discardAuthorization ?? markerDiscardAuthorization(marker);
  if (!options.boundaryAlreadySuspended) {
    await suspendAccountBoundary();
  }

  if (
    cleanupIntent(marker) === "account-deletion" &&
    marker.phase === "remote-deletion-requested"
  ) {
    logger.error(
      "[AccountCleanup] Refused local cleanup while remote account deletion is unconfirmed",
    );
    return { status: "blocked" };
  }

  try {
    if (activeSessionUserId === marker.ownerUserId) {
      if (cleanupIntent(marker) === "account-deletion") {
        throw new Error(
          "Confirmed account deletion cleanup cannot purge while its local session is active",
        );
      }
      if (!removePendingCleanupMarker()) {
        throw new Error("Unable to cancel stale cleanup after same-account sign-in");
      }
      resumeAccountBoundary(true);
      resumeNotificationsAfterVerifiedCleanup();
      return { status: "cancelled" };
    }

    const currentLocalOwnerUserId = await getLocalDataOwnerId();
    const ownedRealmStillPresent = currentLocalOwnerUserId === marker.ownerUserId;
    const interruptedPurgeLostOwner =
      marker.phase === "purging-local-data" && currentLocalOwnerUserId === null;
    const ownerEvidenceLostBeforePurge =
      marker.localDataOwnerUserId !== null &&
      currentLocalOwnerUserId === null &&
      marker.phase !== "purging-local-data";
    const anotherOwnerNowOwnsRealm =
      currentLocalOwnerUserId !== null &&
      currentLocalOwnerUserId !== marker.ownerUserId;

    if (ownerEvidenceLostBeforePurge) {
      throw new Error(
        "Local data owner disappeared before account-boundary purge",
      );
    }

    if (anotherOwnerNowOwnsRealm) {
      if (!removePendingCleanupMarker()) {
        throw new Error("Unable to remove cleanup intent for a different local owner");
      }
      resumeAccountBoundary(activeSessionUserId !== null);
      resumeNotificationsAfterVerifiedCleanup();
      return { status: "cancelled" };
    }

    if (ownedRealmStillPresent || interruptedPurgeLostOwner) {
      await clearAccountNotificationsForBoundary();
      await clearNativeJournalBiometricCredential();
      await clearAccountDeviceSurfaces();
      if (!(await purgeOwnedLocalRealm(marker, discardAuthorization))) {
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
    resumeNotificationsAfterVerifiedCleanup();
    return { status: "completed" };
  } catch (error) {
    logger.error("[AccountCleanup] Pending sign-out cleanup remains blocked:", error);
    // Keep cloud sync and the queue suspended. The durable marker is the retry
    // authority and prevents another account from inheriting this local realm.
    return { status: "blocked" };
  }
}

async function finishConfirmedAccountDeletionCleanup(
  marker: PendingAccountSignOutCleanup,
  activeSessionUserId: string | null,
  options: { boundaryAlreadySuspended?: boolean } = {},
): Promise<PendingAccountSignOutCleanupResult> {
  if (
    cleanupIntent(marker) !== "account-deletion" ||
    marker.phase === "remote-deletion-requested"
  ) {
    logger.error(
      "[AccountCleanup] Refused local deletion cleanup without confirmed remote deletion",
    );
    return { status: "blocked" };
  }

  if (!options.boundaryAlreadySuspended) {
    try {
      await suspendAccountBoundary();
    } catch (error) {
      logger.error(
        "[AccountCleanup] Could not suspend writers for confirmed account deletion:",
        error,
      );
      return { status: "blocked" };
    }
  }

  if (!supabase && activeSessionUserId !== null) {
    logger.error(
      "[AccountCleanup] Supabase became unavailable before local deletion sign-out",
    );
    return { status: "blocked" };
  }

  try {
    await leavePresenceForAccountBoundary(marker.ownerUserId);
  } catch {
    logger.error(
      "[AccountCleanup] Presence teardown was not acknowledged before local deletion cleanup",
    );
    return { status: "blocked" };
  }

  let sessionAfterLocalSignOut = activeSessionUserId;
  try {
    const localSignOut = await signOutExpectedOwnerLocally(marker.ownerUserId);
    if (localSignOut.status === "unsupported") {
      logger.error(
        "[AccountCleanup] Owner-bound local deletion sign-out is unavailable",
      );
      return { status: "blocked" };
    }
    sessionAfterLocalSignOut =
      localSignOut.status === "owner-changed" ? localSignOut.userId : null;
  } catch (error) {
    logger.error(
      "[AccountCleanup] Owner-bound local sign-out after account deletion failed:",
      error,
    );
    return { status: "blocked" };
  }

  return finishPendingCleanup(marker, sessionAfterLocalSignOut, {
    boundaryAlreadySuspended: true,
  });
}

async function continuePendingRemoteAccountDeletion(
  marker: PendingAccountSignOutCleanup,
  activeSessionUserId: string | null,
  options: { boundaryAlreadySuspended?: boolean } = {},
): Promise<PendingAccountSignOutCleanupResult> {
  if (
    cleanupIntent(marker) !== "account-deletion" ||
    marker.phase !== "remote-deletion-requested"
  ) {
    return { status: "blocked" };
  }

  if (!options.boundaryAlreadySuspended) {
    try {
      await suspendAccountBoundary();
    } catch (error) {
      logger.error(
        "[AccountCleanup] Could not suspend writers while resuming account deletion:",
        error,
      );
      return { status: "blocked" };
    }
  }

  if (marker.version !== 2) {
    logger.error(
      "[AccountCleanup] Legacy deletion marker has no recovery capability; manual redress is required",
    );
    return { status: "blocked" };
  }

  try {
    await leavePresenceForAccountBoundary(marker.ownerUserId);
  } catch {
    logger.error(
      "[AccountCleanup] Presence teardown was not acknowledged before resuming account deletion",
    );
    return { status: "blocked" };
  }

  const capability: AccountDeletionCapability = {
    operationId: marker.operationId,
    recoverySecret: marker.recoverySecret,
  };
  const firstRemoteResult =
    activeSessionUserId === marker.ownerUserId
      ? await deleteAccount(marker.ownerUserId, capability)
      : await resumeAccountDeletion(capability);
  // A deleted Auth user may still appear in the SDK's cached session. The
  // authenticated endpoint then rejects that stale JWT, while the deletion-only
  // capability can still read or continue the operation that was already
  // authorized. The recovery endpoint cannot create a deletion operation.
  const remote =
    firstRemoteResult.status === "deleted" ||
    activeSessionUserId !== marker.ownerUserId
      ? firstRemoteResult
      : await resumeAccountDeletion(capability);
  if (remote.status !== "deleted") {
    logger.error(
      "[AccountCleanup] Remote account deletion remains unconfirmed; durable intent retained",
      { code: remote.code },
    );
    return { status: "blocked" };
  }

  const confirmedMarker: PendingAccountSignOutCleanup = {
    version: 2,
    intent: "account-deletion",
    ownerUserId: marker.ownerUserId,
    localDataOwnerUserId: marker.localDataOwnerUserId,
    phase: "awaiting-local-cleanup",
    createdAt: marker.createdAt,
    operationId: marker.operationId,
  };
  if (!persistPendingCleanupMarker(confirmedMarker)) {
    logger.error(
      "[AccountCleanup] Remote deletion succeeded but its local cleanup phase could not be persisted",
    );
    return { status: "blocked" };
  }

  return finishConfirmedAccountDeletionCleanup(
    confirmedMarker,
    activeSessionUserId,
    { boundaryAlreadySuspended: true },
  );
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
  if (cleanupIntent(markerRead.marker) === "account-deletion") {
    return markerRead.marker.phase === "remote-deletion-requested"
      ? continuePendingRemoteAccountDeletion(markerRead.marker, activeSessionUserId)
      : finishConfirmedAccountDeletionCleanup(
          markerRead.marker,
          activeSessionUserId,
        );
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
  const expectedGenerationIsCurrent = (): boolean => {
    if (!options.expectedAccountBoundaryGeneration) return true;
    try {
      assertOriginAccountBoundaryGeneration(
        options.expectedAccountBoundaryGeneration,
      );
      return true;
    } catch {
      return false;
    }
  };
  if (!expectedGenerationIsCurrent()) {
    return { status: "session-changed" };
  }

  const existingMarker = readPendingCleanupMarker();
  if (existingMarker.status === "blocked") {
    if (options.expectedOwnerUserId) {
      try {
        const currentOwnerUserId = await readActiveSessionOwner();
        if (!expectedGenerationIsCurrent()) {
          return { status: "session-changed" };
        }
        if (currentOwnerUserId !== options.expectedOwnerUserId) {
          return currentOwnerUserId === null
            ? { status: "cleanup-failed", sessionEnded: true }
            : { status: "session-changed" };
        }
      } catch (error) {
        logger.error(
          "[AccountCleanup] Could not verify the owner of a blocked cleanup retry:",
          error,
        );
        return { status: "cleanup-failed", sessionEnded: false };
      }
    }
    try {
      await suspendAccountBoundary();
    } catch (error) {
      logger.error("[AccountCleanup] Failed to suspend after marker read error:", error);
    }
    return { status: "cleanup-failed", sessionEnded: false };
  }

  const ownerUserId = await readActiveSessionOwner();
  if (!expectedGenerationIsCurrent()) {
    return { status: "session-changed" };
  }
  if (options.expectedOwnerUserId) {
    if (
      existingMarker.status === "found" &&
      existingMarker.marker.ownerUserId !== options.expectedOwnerUserId
    ) {
      return { status: "session-changed" };
    }
    if (ownerUserId !== null && ownerUserId !== options.expectedOwnerUserId) {
      return { status: "session-changed" };
    }
    if (ownerUserId === null && existingMarker.status === "none") {
      return { status: "no-session" };
    }
  }
  if (
    existingMarker.status === "found" &&
    cleanupIntent(existingMarker.marker) === "account-deletion"
  ) {
    const retry = await reconcilePendingCleanupUnlocked(ownerUserId);
    if (retry.status === "completed") return { status: "signed-out" };
    if (ownerUserId === null) {
      return { status: "cleanup-failed", sessionEnded: true };
    }
    return ownerUserId === existingMarker.marker.ownerUserId
      ? { status: "cleanup-failed", sessionEnded: false }
      : { status: "session-changed" };
  }
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

  if (!expectedGenerationIsCurrent()) {
    return { status: "session-changed" };
  }
  await suspendAccountBoundary();

  const durableOwnerWrites = await readDurableOwnerWriteState(ownerUserId);
  if (
    durableOwnerWrites.hasJournalRemoval ||
    (durableOwnerWrites.hasDiscardableWrites && !options.discardPendingChanges)
  ) {
    resumeAccountBoundary(true);
    return { status: "pending-changes" };
  }

  let discardAuthorization: SignOutDiscardAuthorization | undefined;
  if (options.discardPendingChanges) {
    // Consent applies only to work that exists in this DATA-serialized
    // snapshot. A queue row or migration revision created later must survive
    // and block sign-out instead of inheriting the earlier consent.
    discardAuthorization = await runWithSettledDataRead(async () => {
      const journalMigrationRevision =
        await getPendingJournalSecurityMigrationRevisionForOwner(ownerUserId);
      const queueDiscard =
        await offlineQueue.discardSuspendedActionsForAccountBoundary({
          onlyIfEmpty: false,
        });
      if (queueDiscard.status !== "discarded") {
        throw new Error("Unable to discard the authorized offline writes");
      }
      return { journalMigrationRevision };
    });
  }

  try {
    await leavePresenceForAccountBoundary(ownerUserId);
  } catch {
    logger.error(
      "[AccountCleanup] Presence teardown was not acknowledged before sign-out",
    );
    let ownerAfterPresenceFailure: string | null | undefined;
    try {
      ownerAfterPresenceFailure = await readActiveSessionOwner();
    } catch {
      ownerAfterPresenceFailure = undefined;
    }
    if (ownerAfterPresenceFailure === ownerUserId) {
      resumeAccountBoundary(true);
    }
    if (
      ownerAfterPresenceFailure !== undefined &&
      ownerAfterPresenceFailure !== null &&
      ownerAfterPresenceFailure !== ownerUserId
    ) {
      return { status: "session-changed" };
    }
    return {
      status: "cleanup-failed",
      sessionEnded: ownerAfterPresenceFailure === null,
    };
  }

  const localDataOwnerUserId = await getLocalDataOwnerId();
  const ownerBeforePushRevocation = await readActiveSessionOwner();
  if (ownerBeforePushRevocation !== ownerUserId) {
    const marker: PendingAccountSignOutCleanup = {
      version: 1,
      intent: "sign-out",
      ownerUserId,
      localDataOwnerUserId,
      phase: "awaiting-local-cleanup",
      createdAt: Date.now(),
      ...(discardAuthorization
        ? {
            authorizedJournalMigrationRevision:
              discardAuthorization.journalMigrationRevision,
          }
        : {}),
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
      discardAuthorization,
    });
    if (ownerBeforePushRevocation !== null) return { status: "session-changed" };
    return reconciled.status === "completed" || reconciled.status === "cancelled"
      ? { status: "signed-out" }
      : { status: "cleanup-failed", sessionEnded: true };
  }

  const pushRevocation = await revokePushForCurrentSession(ownerUserId);
  if (pushRevocation.status !== "revoked") {
    await restorePushRegistrationSafely(options.restorePushRegistration);
    resumeAccountBoundary(true);
    return { status: "cleanup-failed", sessionEnded: false };
  }

  const finalSessionOwnerUserId = await readActiveSessionOwner();
  const marker: PendingAccountSignOutCleanup =
    existingMarker.status === "found" && existingMarker.marker.version === 1
      ? {
          ...existingMarker.marker,
          intent: "sign-out",
          localDataOwnerUserId,
          phase: "awaiting-local-cleanup",
          ...(discardAuthorization
            ? {
                authorizedJournalMigrationRevision:
                  discardAuthorization.journalMigrationRevision,
              }
            : {}),
        }
      : {
          version: 1,
          intent: "sign-out",
          ownerUserId,
          localDataOwnerUserId,
          phase: "awaiting-local-cleanup",
          createdAt: Date.now(),
          ...(discardAuthorization
            ? {
                authorizedJournalMigrationRevision:
                  discardAuthorization.journalMigrationRevision,
              }
            : {}),
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
      discardAuthorization,
    });
    return finalSessionOwnerUserId === null && reconciled.status === "completed"
      ? { status: "signed-out" }
      : finalSessionOwnerUserId !== null
        ? { status: "session-changed" }
        : { status: "cleanup-failed", sessionEnded: true };
  }

  type FinalSignOutAttempt =
    | { status: "pending-changes" }
    | { status: "signed-out" }
    | { status: "session-changed"; userId: string }
    | { status: "unsupported" };

  // Hold DATA across the final queue/migration decision and the local auth
  // transition. An accepted writer therefore either commits first and blocks
  // sign-out, or waits until the session transition has completed. The durable
  // marker remains retry authority for a crash or ambiguous auth response.
  try {
    const finalAttempt = await runWithSettledDataRead(
      async (): Promise<FinalSignOutAttempt> => {
        const queueFinalization =
          await offlineQueue.discardSuspendedActionsForAccountBoundary({
            onlyIfEmpty: true,
          });
        if (queueFinalization.status === "blocked") {
          return { status: "pending-changes" };
        }

        const currentJournalRevision =
          await getPendingJournalSecurityMigrationRevisionForOwner(ownerUserId);
        if (await hasPendingJournalSecurityRemovalForOwner(ownerUserId)) {
          return { status: "pending-changes" };
        }
        if (
          currentJournalRevision !== null &&
          currentJournalRevision !==
            discardAuthorization?.journalMigrationRevision
        ) {
          return { status: "pending-changes" };
        }

        const localSignOut = await signOutExpectedOwnerLocally(ownerUserId);
        if (
          localSignOut.status === "signed-out" ||
          localSignOut.status === "no-session"
        ) {
          return { status: "signed-out" };
        }
        if (localSignOut.status === "owner-changed") {
          return {
            status: "session-changed",
            userId: localSignOut.userId,
          };
        }
        return { status: "unsupported" };
      },
    );

    if (finalAttempt.status === "pending-changes") {
      const markerRemoved = removePendingCleanupMarker();
      await restorePushRegistrationSafely(options.restorePushRegistration);
      if (!markerRemoved) {
        return { status: "cleanup-failed", sessionEnded: false };
      }
      resumeAccountBoundary(true);
      return { status: "pending-changes" };
    }
    if (finalAttempt.status === "session-changed") {
      await finishPendingCleanup(marker, finalAttempt.userId, {
        boundaryAlreadySuspended: true,
        discardAuthorization,
      });
      return { status: "session-changed" };
    }
    if (finalAttempt.status === "unsupported") {
      logger.error(
        "[AccountCleanup] Owner-qualified local sign-out is unavailable",
      );
      await restorePushRegistrationSafely(options.restorePushRegistration);
      resumeAccountBoundary(true);
      return { status: "sign-out-failed" };
    }
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
        discardAuthorization,
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

  const cleanup = await finishPendingCleanup(marker, null, {
    boundaryAlreadySuspended: true,
    discardAuthorization,
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

async function restoreAbortedAccountDeletion(
  options: PerformOwnerSafeAccountDeletionOptions,
): Promise<void> {
  await restorePushRegistrationSafely(options.restorePushRegistration);
  resumeAccountBoundary(true);
  resumeNotificationsAfterVerifiedCleanup();
}

async function performOwnerSafeAccountDeletionUnlocked(
  expectedOwnerUserId: string,
  options: PerformOwnerSafeAccountDeletionOptions,
): Promise<OwnerSafeAccountDeletionResult> {
  const existingMarker = readPendingCleanupMarker();
  if (existingMarker.status === "blocked") {
    try {
      await suspendAccountBoundary();
    } catch (error) {
      logger.error(
        "[AccountCleanup] Failed to suspend after deletion marker read error:",
        error,
      );
    }
    return { status: "cleanup-failed", remoteDeletion: "unknown" };
  }

  const activeOwnerUserId = await readActiveSessionOwner();
  if (existingMarker.status === "found") {
    if (
      cleanupIntent(existingMarker.marker) !== "account-deletion" ||
      existingMarker.marker.ownerUserId !== expectedOwnerUserId
    ) {
      logger.error(
        "[AccountCleanup] Another account-bound cleanup must finish before account deletion",
      );
      return { status: "cleanup-failed", remoteDeletion: "unknown" };
    }

    const retry =
      existingMarker.marker.phase === "remote-deletion-requested"
        ? await continuePendingRemoteAccountDeletion(
            existingMarker.marker,
            activeOwnerUserId,
          )
        : await finishConfirmedAccountDeletionCleanup(
            existingMarker.marker,
            activeOwnerUserId,
          );
    if (retry.status === "completed") {
      return { status: "deleted", remoteDeletion: "confirmed" };
    }

    const markerAfterRetry = readPendingCleanupMarker();
    const remoteDeletionConfirmed =
      existingMarker.marker.phase !== "remote-deletion-requested" ||
      (markerAfterRetry.status === "found" &&
        cleanupIntent(markerAfterRetry.marker) === "account-deletion" &&
        markerAfterRetry.marker.ownerUserId === expectedOwnerUserId &&
        markerAfterRetry.marker.phase !== "remote-deletion-requested");
    return {
      status: "cleanup-failed",
      remoteDeletion: remoteDeletionConfirmed ? "confirmed" : "unknown",
    };
  }

  if (!supabase || !activeOwnerUserId) {
    return { status: "no-session", remoteDeletion: "not-confirmed" };
  }
  if (activeOwnerUserId !== expectedOwnerUserId) {
    return { status: "session-changed", remoteDeletion: "not-confirmed" };
  }

  let capability: AccountDeletionCapability;
  try {
    capability = createAccountDeletionCapability();
  } catch {
    logger.error("[AccountCleanup] Secure deletion recovery is unavailable", {
      code: "secure-random-unavailable",
    });
    return { status: "delete-failed", remoteDeletion: "not-confirmed" };
  }

  await suspendAccountBoundary();

  const localDataOwnerUserId = await getLocalDataOwnerId();
  if (
    localDataOwnerUserId !== null &&
    localDataOwnerUserId !== expectedOwnerUserId
  ) {
    resumeAccountBoundary(true);
    resumeNotificationsAfterVerifiedCleanup();
    return { status: "session-changed", remoteDeletion: "not-confirmed" };
  }

  try {
    await leavePresenceForAccountBoundary(expectedOwnerUserId);
  } catch {
    logger.error(
      "[AccountCleanup] Presence teardown was not acknowledged before account deletion",
    );
    let ownerAfterPresenceFailure: string | null | undefined;
    try {
      ownerAfterPresenceFailure = await readActiveSessionOwner();
    } catch {
      ownerAfterPresenceFailure = undefined;
    }
    if (ownerAfterPresenceFailure === expectedOwnerUserId) {
      resumeAccountBoundary(true);
      resumeNotificationsAfterVerifiedCleanup();
      return { status: "delete-failed", remoteDeletion: "not-confirmed" };
    }
    if (
      ownerAfterPresenceFailure !== undefined &&
      ownerAfterPresenceFailure !== null
    ) {
      return { status: "session-changed", remoteDeletion: "not-confirmed" };
    }
    return { status: "cleanup-failed", remoteDeletion: "not-confirmed" };
  }

  const ownerBeforePushRevocation = await readActiveSessionOwner();
  if (ownerBeforePushRevocation !== expectedOwnerUserId) {
    // The account-switch coordinator owns writer recovery once another session
    // appears. Resuming here could let the new session inherit the old realm.
    return { status: "session-changed", remoteDeletion: "not-confirmed" };
  }

  const pushRevocation = await revokePushForAccountBoundary(expectedOwnerUserId);
  if (pushRevocation.status !== "revoked") {
    await restoreAbortedAccountDeletion(options);
    return { status: "delete-failed", remoteDeletion: "not-confirmed" };
  }

  const marker: PendingAccountSignOutCleanup = {
    version: 2,
    intent: "account-deletion",
    ownerUserId: expectedOwnerUserId,
    localDataOwnerUserId,
    phase: "remote-deletion-requested",
    createdAt: Date.now(),
    operationId: capability.operationId,
    recoverySecret: capability.recoverySecret,
  };
  if (!persistPendingCleanupMarker(marker)) {
    await restoreAbortedAccountDeletion(options);
    return { status: "delete-failed", remoteDeletion: "not-confirmed" };
  }

  const ownerBeforeRemoteDeletion = await readActiveSessionOwner();
  if (ownerBeforeRemoteDeletion !== expectedOwnerUserId) {
    if (!removePendingCleanupMarker()) {
      return { status: "cleanup-failed", remoteDeletion: "unknown" };
    }
    // Do not restore or resume global writers for a new account. Its account
    // transition owns both operations and must first reconcile the old realm.
    return { status: "session-changed", remoteDeletion: "not-confirmed" };
  }

  const remote = await deleteAccount(expectedOwnerUserId, capability);
  if (remote.status !== "deleted") {
    if (remote.code === "not-configured") {
      if (!removePendingCleanupMarker()) {
        return { status: "cleanup-failed", remoteDeletion: "not-confirmed" };
      }
      await restoreAbortedAccountDeletion(options);
      return { status: "delete-failed", remoteDeletion: "not-confirmed" };
    }
    if (remote.code === "owner-changed") {
      if (!removePendingCleanupMarker()) {
        return { status: "cleanup-failed", remoteDeletion: "unknown" };
      }
      return { status: "session-changed", remoteDeletion: "not-confirmed" };
    }

    // An invocation failure or malformed response can be a lost success
    // response. Keep the pre-request marker and all writers suspended so a
    // retry cannot leak the old realm or falsely report that deletion failed.
    logger.error(
      "[AccountCleanup] Remote deletion outcome is ambiguous; durable retry intent retained",
      { code: remote.code },
    );
    return { status: "cleanup-failed", remoteDeletion: "unknown" };
  }

  const confirmedMarker: PendingAccountSignOutCleanup = {
    version: 2,
    intent: "account-deletion",
    ownerUserId: marker.ownerUserId,
    localDataOwnerUserId: marker.localDataOwnerUserId,
    phase: "awaiting-local-cleanup",
    createdAt: marker.createdAt,
    operationId: marker.operationId,
  };
  if (!persistPendingCleanupMarker(confirmedMarker)) {
    return { status: "cleanup-failed", remoteDeletion: "confirmed" };
  }

  const cleanup = await finishConfirmedAccountDeletionCleanup(
    confirmedMarker,
    expectedOwnerUserId,
    { boundaryAlreadySuspended: true },
  );
  return cleanup.status === "completed"
    ? { status: "deleted", remoteDeletion: "confirmed" }
    : { status: "cleanup-failed", remoteDeletion: "confirmed" };
}

export async function performOwnerSafeAccountDeletion(
  expectedOwnerUserId: string,
  options: PerformOwnerSafeAccountDeletionOptions = {},
): Promise<OwnerSafeAccountDeletionResult> {
  if (!isNonEmptyString(expectedOwnerUserId)) {
    return { status: "no-session", remoteDeletion: "not-confirmed" };
  }

  try {
    return await runWithOriginExclusiveLock(
      ACCOUNT_SIGN_OUT_CLEANUP_LOCK,
      () =>
        performOwnerSafeAccountDeletionUnlocked(
          expectedOwnerUserId,
          options,
        ),
    );
  } catch (error) {
    logger.error(
      "[AccountCleanup] Owner-safe account deletion failed before completion:",
      error,
    );
    // Unknown failures stay fail-closed. A durable marker, when present,
    // remains the only authority for the next retry or cold-start recovery.
    return { status: "cleanup-failed", remoteDeletion: "unknown" };
  }
}

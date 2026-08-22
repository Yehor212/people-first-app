import { clearNativeJournalBiometricCredential } from "@/lib/journalBiometricCredentials";
import {
  assertJournalSecurityBoundary,
  captureJournalSecurityBoundary,
  ensureJournalSecurityRemovalQueued,
  getJournalSecurityRemovalIntent,
  hasLocalJournalProtectionArtifacts,
  journalSecurityRemovalIntentMatchesBoundary,
  pruneJournalPasswordRemovalMediaStage,
  recoverPendingJournalPasswordRemovalAbort,
  recordOrphanedRemoteJournalPasswordRemoval,
  recordJournalSecurityRemovalNativeCleanup,
} from "./journalSecurityMigration";
import { recoverRemoteJournalPasswordRemoval } from "@/storage/sync/journalRemovalRemote";

export type JournalPasswordRemovalRecoveryResult = "none" | "pending" | "completed";

const JOURNAL_REMOVAL_ORPHAN_PROBE_TIMEOUT_MS = 5_000;
const JOURNAL_REMOVAL_ORPHAN_PROBE_FAILURE_BACKOFF_MS = 15_000;
const JOURNAL_REMOVAL_ORPHAN_PROBE_SUCCESS_TTL_MS = 60_000;
const orphanProbeByOwner = new Map<
  string,
  Promise<Awaited<ReturnType<typeof recoverRemoteJournalPasswordRemoval>>>
>();
const orphanProbeBackoffUntilByOwner = new Map<string, number>();
const orphanProbeSuccessByOwner = new Map<
  string,
  {
    expiresAt: number;
    result: Awaited<ReturnType<typeof recoverRemoteJournalPasswordRemoval>>;
  }
>();

class JournalRemovalOrphanProbeDeferredError extends Error {
  constructor() {
    super("Diary removal orphan probe is temporarily deferred");
    this.name = "JournalRemovalOrphanProbeDeferredError";
  }
}

function probeOrphanedRemoteJournalPasswordRemoval(
  ownerUserId: string,
): Promise<Awaited<ReturnType<typeof recoverRemoteJournalPasswordRemoval>>> {
  const cachedSuccess = orphanProbeSuccessByOwner.get(ownerUserId);
  if (cachedSuccess && cachedSuccess.expiresAt > Date.now()) {
    return Promise.resolve(cachedSuccess.result);
  }
  if (cachedSuccess) orphanProbeSuccessByOwner.delete(ownerUserId);
  const existing = orphanProbeByOwner.get(ownerUserId);
  if (existing) return existing;
  if ((orphanProbeBackoffUntilByOwner.get(ownerUserId) ?? 0) > Date.now()) {
    return Promise.reject(new JournalRemovalOrphanProbeDeferredError());
  }

  const operationRef: {
    current?: Promise<Awaited<ReturnType<typeof recoverRemoteJournalPasswordRemoval>>>;
  } = {};
  const operation = (async () => {
    const controller = new AbortController();
    let timeoutId: ReturnType<typeof setTimeout> | undefined;
    try {
      const recovery = await Promise.race([
        recoverRemoteJournalPasswordRemoval({
          expectedOwnerUserId: ownerUserId,
          signal: controller.signal,
        }),
        new Promise<never>((_resolve, reject) => {
          timeoutId = setTimeout(() => {
            const timeout = new JournalRemovalOrphanProbeDeferredError();
            controller.abort(timeout);
            reject(timeout);
          }, JOURNAL_REMOVAL_ORPHAN_PROBE_TIMEOUT_MS);
        }),
      ]);
      orphanProbeBackoffUntilByOwner.delete(ownerUserId);
      orphanProbeSuccessByOwner.set(ownerUserId, {
        expiresAt: Date.now() + JOURNAL_REMOVAL_ORPHAN_PROBE_SUCCESS_TTL_MS,
        result: recovery,
      });
      return recovery;
    } catch (error) {
      orphanProbeBackoffUntilByOwner.set(
        ownerUserId,
        Date.now() + JOURNAL_REMOVAL_ORPHAN_PROBE_FAILURE_BACKOFF_MS,
      );
      throw error;
    } finally {
      if (timeoutId !== undefined) clearTimeout(timeoutId);
      if (orphanProbeByOwner.get(ownerUserId) === operationRef.current) {
        orphanProbeByOwner.delete(ownerUserId);
      }
    }
  })();
  operationRef.current = operation;
  orphanProbeByOwner.set(ownerUserId, operation);
  return operation;
}

export function resetJournalPasswordRemovalRecoveryProbeStateForTests(): void {
  orphanProbeByOwner.clear();
  orphanProbeBackoffUntilByOwner.clear();
  orphanProbeSuccessByOwner.clear();
}

export async function resumePendingJournalPasswordRemoval(): Promise<
  JournalPasswordRemovalRecoveryResult
> {
  let intent = await getJournalSecurityRemovalIntent();
  let boundary = await captureJournalSecurityBoundary();
  try {
    await pruneJournalPasswordRemovalMediaStage(intent, boundary);
  } catch {
    // Ciphertext staging is never authority to continue removal. A later retry
    // revalidates or replaces it; the durable intent remains fail-closed.
    if (intent) return "pending";
  }
  if (!intent) {
    if (
      !boundary.sessionOwnerUserId ||
      boundary.localOwnerUserId !== boundary.sessionOwnerUserId
    ) {
      return "none";
    }
    try {
      const recovery = await probeOrphanedRemoteJournalPasswordRemoval(
        boundary.sessionOwnerUserId,
      );
      if (
        recovery.status === "abortable" ||
        recovery.status === "manual-recovery-required" ||
        recovery.status === "complete"
      ) {
        const recoveryDisposition = await recordOrphanedRemoteJournalPasswordRemoval(
          {
            operationRevision: recovery.operationRevision,
            vaultRevision: recovery.vaultRevision,
            remoteStatus: recovery.status,
          },
          boundary,
        );
        if (recoveryDisposition === "stale") return "none";
        intent = await getJournalSecurityRemovalIntent();
      } else {
        return "none";
      }
    } catch {
      // Older deployments may not expose the recovery RPC yet. With no local
      // intent there is no authorized native or local mutation to resume.
      return "none";
    }
  }

  if (!intent) return "pending";

  boundary = await captureJournalSecurityBoundary();

  if (!journalSecurityRemovalIntentMatchesBoundary(intent, boundary)) {
    return "pending";
  }

  if (intent.phase === "abort-pending") {
    try {
      const abortRecovery = await recoverPendingJournalPasswordRemovalAbort(
        intent,
        boundary,
      );
      if (abortRecovery !== "aborted") return "pending";
      return (await getJournalSecurityRemovalIntent()) ? "pending" : "completed";
    } catch {
      return "pending";
    }
  }

  if (intent.phase === "remote-recovery") {
    if (!boundary.sessionOwnerUserId) return "pending";
    try {
      const recovery = await recoverRemoteJournalPasswordRemoval({
        expectedOwnerUserId: boundary.sessionOwnerUserId,
      });
      if (recovery.status === "not-pending") return "pending";
      if (
        recovery.operationRevision !== intent.operationRevision ||
        recovery.vaultRevision !== intent.expectedVaultRevision
      ) {
        return "pending";
      }
      await recordOrphanedRemoteJournalPasswordRemoval(
        {
          operationRevision: recovery.operationRevision,
          vaultRevision: recovery.vaultRevision,
          remoteStatus: recovery.status,
        },
        boundary,
      );
      intent = await getJournalSecurityRemovalIntent();
      if (!intent) return "pending";
      if (await hasLocalJournalProtectionArtifacts(boundary)) return "pending";
      if (recovery.status !== "complete") {
        // Absence of local ciphertext does not prove that this installation
        // holds a complete copy of the remote journal. Adopting the fence from
        // an empty or partially hydrated IndexedDB could overwrite backup-only
        // data with empty collections. Keep the exact remote operation paused
        // until an explicit, inventory-bound recovery flow proves completeness.
        return "pending";
      }
    } catch {
      return "pending";
    }
  }

  if (
    intent.phase === "preflight-pending" ||
    intent.phase === "remote-fenced" ||
    intent.phase === "blocked"
  ) {
    return "pending";
  }

  // A persisted phase is not authority to cross the local commit boundary.
  // Corrupt, stale, or partially written state must never clear the
  // installation-wide biometric credential or start cloud conversion while
  // password/vault/ciphertext artifacts still exist locally.
  if (await hasLocalJournalProtectionArtifacts(boundary)) {
    return "pending";
  }

  if (
    intent.nativeCleanup.status !== "complete" &&
    intent.nativeCleanup.status !== "not-applicable"
  ) {
    let boundaryVerified = false;
    try {
      await assertJournalSecurityBoundary(boundary);
      boundaryVerified = true;
      const cleanup = await clearNativeJournalBiometricCredential();
      await recordJournalSecurityRemovalNativeCleanup(
        intent.operationRevision,
        cleanup === "removed" ? "complete" : "not-applicable"
      );
    } catch {
      try {
        await recordJournalSecurityRemovalNativeCleanup(
          intent.operationRevision,
          boundaryVerified ? "failed" : "owner-changed"
        );
      } catch {
        // The retained intent is already the fail-closed recovery signal.
      }
    }
  }

  intent = await getJournalSecurityRemovalIntent();
  if (!intent) return "completed";

  if (
    intent.cloudCleanup.status === "pending" ||
    intent.cloudCleanup.status === "blocked"
  ) {
    try {
      await ensureJournalSecurityRemovalQueued(intent);
    } catch {
      return "pending";
    }
  }

  return (await getJournalSecurityRemovalIntent()) ? "pending" : "completed";
}

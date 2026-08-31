import { clearNativeJournalBiometricCredential } from "@/lib/journalBiometricCredentials";
import {
  assertJournalSecurityBoundary,
  captureJournalSecurityBoundary,
  ensureJournalSecurityRemovalQueued,
  getJournalSecurityRemovalIntent,
  hasLocalJournalProtectionArtifacts,
  journalSecurityRemovalIntentMatchesBoundary,
  recordOrphanedRemoteJournalPasswordRemoval,
  recordJournalSecurityRemovalNativeCleanup,
  removeJournalPasswordProtectionAtomically,
} from "./journalSecurityMigration";
import { recoverRemoteJournalPasswordRemoval } from "@/storage/sync/journalRemovalRemote";

export type JournalPasswordRemovalRecoveryResult = "none" | "pending" | "completed";

export async function resumePendingJournalPasswordRemoval(): Promise<
  JournalPasswordRemovalRecoveryResult
> {
  let intent = await getJournalSecurityRemovalIntent();
  let boundary = await captureJournalSecurityBoundary();
  if (!intent) {
    if (
      !boundary.sessionOwnerUserId ||
      boundary.localOwnerUserId !== boundary.sessionOwnerUserId
    ) {
      return "none";
    }
    try {
      const recovery = await recoverRemoteJournalPasswordRemoval({
        expectedOwnerUserId: boundary.sessionOwnerUserId,
      });
      if (recovery.status === "manual-recovery-required" || recovery.status === "complete") {
        await recordOrphanedRemoteJournalPasswordRemoval(
          {
            operationRevision: recovery.operationRevision,
            vaultRevision: recovery.vaultRevision,
            remoteStatus: recovery.status,
          },
          boundary,
        );
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
      if (recovery.status === "manual-recovery-required") {
        await removeJournalPasswordProtectionAtomically(null, boundary);
        intent = await getJournalSecurityRemovalIntent();
        if (!intent) return "completed";
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
      return "pending";
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

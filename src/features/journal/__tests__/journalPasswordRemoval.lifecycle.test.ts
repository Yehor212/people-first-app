import { beforeEach, describe, expect, it, vi } from "vitest";
import { readFileSync } from "node:fs";

const mocks = vi.hoisted(() => ({
  getIntent: vi.fn(),
  captureBoundary: vi.fn(),
  assertBoundary: vi.fn(),
  recordNativeCleanup: vi.fn(),
  ensureQueued: vi.fn(),
  recoverRemote: vi.fn(),
  recordRemoteRecovery: vi.fn(),
  hasLocalProtection: vi.fn(),
  removeAtomically: vi.fn(),
  clearNativeCredential: vi.fn(),
}));

vi.mock("../journalSecurityMigration", () => ({
  getJournalSecurityRemovalIntent: mocks.getIntent,
  captureJournalSecurityBoundary: mocks.captureBoundary,
  assertJournalSecurityBoundary: mocks.assertBoundary,
  recordJournalSecurityRemovalNativeCleanup: mocks.recordNativeCleanup,
  ensureJournalSecurityRemovalQueued: mocks.ensureQueued,
  recordOrphanedRemoteJournalPasswordRemoval: mocks.recordRemoteRecovery,
  hasLocalJournalProtectionArtifacts: mocks.hasLocalProtection,
  removeJournalPasswordProtectionAtomically: mocks.removeAtomically,
  journalSecurityRemovalIntentMatchesBoundary: (
    intent: { ownerUserId: string },
    boundary: { sessionOwnerUserId: string | null; localOwnerUserId: string | null },
  ) =>
    intent.ownerUserId === boundary.sessionOwnerUserId &&
    intent.ownerUserId === boundary.localOwnerUserId,
}));

vi.mock("@/storage/sync/journalRemovalRemote", () => ({
  recoverRemoteJournalPasswordRemoval: mocks.recoverRemote,
}));

vi.mock("@/lib/journalBiometricCredentials", () => ({
  clearNativeJournalBiometricCredential: mocks.clearNativeCredential,
}));

import { resumePendingJournalPasswordRemoval } from "../journalSecurityRemovalLifecycle";

function pendingIntent(overrides: Record<string, unknown> = {}) {
  return {
    version: 2,
    revision: "operation-1",
    operationRevision: "operation-1",
    expectedVaultRevision: 101,
    ownerUserId: "account-a",
    phase: "cleanup-pending",
    nativeCleanup: { status: "pending", attemptCount: 0 },
    cloudCleanup: { status: "pending" },
    ...overrides,
  };
}

describe("journal password removal app lifecycle", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.captureBoundary.mockResolvedValue({
      generation: 1,
      sessionOwnerUserId: "account-a",
      localOwnerUserId: "account-a",
    });
    mocks.assertBoundary.mockResolvedValue(undefined);
    mocks.recordNativeCleanup.mockResolvedValue(undefined);
    mocks.ensureQueued.mockResolvedValue(true);
    mocks.recoverRemote.mockResolvedValue({ status: "not-pending" });
    mocks.recordRemoteRecovery.mockResolvedValue(undefined);
    mocks.hasLocalProtection.mockResolvedValue(false);
    mocks.removeAtomically.mockResolvedValue({
      cloudMigrationPending: true,
      removalRevision: "operation-1",
    });
    mocks.clearNativeCredential.mockResolvedValue("removed");
  });

  it("does nothing when no durable removal operation exists", async () => {
    mocks.getIntent.mockResolvedValue(null);

    await expect(resumePendingJournalPasswordRemoval()).resolves.toBe("none");

    expect(mocks.clearNativeCredential).not.toHaveBeenCalled();
    expect(mocks.ensureQueued).not.toHaveBeenCalled();
    expect(mocks.recoverRemote).toHaveBeenCalledWith({
      expectedOwnerUserId: "account-a",
    });
  });

  it("recreates a fail-closed local marker when the server reports partial orphan progress", async () => {
    mocks.getIntent.mockResolvedValue(null);
    mocks.recoverRemote.mockResolvedValue({
      status: "manual-recovery-required",
      operationRevision: "100:orphanoperation",
      vaultRevision: 101,
    });

    await expect(resumePendingJournalPasswordRemoval()).resolves.toBe("pending");

    expect(mocks.recordRemoteRecovery).toHaveBeenCalledWith(
      {
        operationRevision: "100:orphanoperation",
        vaultRevision: 101,
        remoteStatus: "manual-recovery-required",
      },
      {
        generation: 1,
        sessionOwnerUserId: "account-a",
        localOwnerUserId: "account-a",
      },
    );
    expect(mocks.clearNativeCredential).not.toHaveBeenCalled();
  });

  it("keeps an offline protected device pending after another device finalizes the server", async () => {
    const remoteIntent = pendingIntent({
      revision: "100:orphanoperation",
      operationRevision: "100:orphanoperation",
      phase: "remote-recovery",
      cloudCleanup: { status: "blocked" },
      nativeCleanup: { status: "not-started" },
    });
    mocks.getIntent.mockResolvedValue(remoteIntent);
    mocks.recoverRemote.mockResolvedValue({
      status: "complete",
      operationRevision: "100:orphanoperation",
      vaultRevision: 101,
    });
    mocks.hasLocalProtection.mockResolvedValue(true);

    await expect(resumePendingJournalPasswordRemoval()).resolves.toBe("pending");

    expect(mocks.recordRemoteRecovery).toHaveBeenCalledWith(
      {
        operationRevision: "100:orphanoperation",
        vaultRevision: 101,
        remoteStatus: "complete",
      },
      expect.objectContaining({ sessionOwnerUserId: "account-a" }),
    );
    expect(mocks.hasLocalProtection).toHaveBeenCalled();
    expect(mocks.clearNativeCredential).not.toHaveBeenCalled();
    expect(mocks.ensureQueued).not.toHaveBeenCalled();
  });

  it("clears an orphan marker after the server and local plaintext both converge", async () => {
    const remoteIntent = pendingIntent({
      revision: "100:orphanoperation",
      operationRevision: "100:orphanoperation",
      phase: "remote-recovery",
      cloudCleanup: { status: "blocked" },
      nativeCleanup: { status: "not-started" },
    });
    const serverCompleteIntent = pendingIntent({
      revision: "100:orphanoperation",
      operationRevision: "100:orphanoperation",
      phase: "remote-recovery",
      cloudCleanup: { status: "complete" },
      nativeCleanup: { status: "not-started" },
    });
    mocks.getIntent
      .mockResolvedValueOnce(remoteIntent)
      .mockResolvedValueOnce(serverCompleteIntent)
      .mockResolvedValueOnce(null);
    mocks.recoverRemote.mockResolvedValue({
      status: "complete",
      operationRevision: "100:orphanoperation",
      vaultRevision: 101,
    });

    await expect(resumePendingJournalPasswordRemoval()).resolves.toBe("completed");

    expect(mocks.hasLocalProtection).toHaveBeenCalled();
    expect(mocks.clearNativeCredential).toHaveBeenCalledTimes(1);
    expect(mocks.recordNativeCleanup).toHaveBeenCalledWith(
      "100:orphanoperation",
      "complete",
    );
    expect(mocks.ensureQueued).not.toHaveBeenCalled();
  });

  it("adopts a manual server fence automatically only when local truth is already plaintext", async () => {
    const remoteIntent = pendingIntent({
      revision: "100:orphanoperation",
      operationRevision: "100:orphanoperation",
      phase: "remote-recovery",
      cloudCleanup: { status: "blocked" },
      nativeCleanup: { status: "not-started" },
    });
    const localCommittedIntent = pendingIntent({
      revision: "100:orphanoperation",
      operationRevision: "100:orphanoperation",
      phase: "local-committed",
      cloudCleanup: { status: "pending" },
      nativeCleanup: { status: "pending", attemptCount: 0 },
    });
    mocks.getIntent
      .mockResolvedValueOnce(remoteIntent)
      .mockResolvedValueOnce(remoteIntent)
      .mockResolvedValueOnce(localCommittedIntent)
      .mockResolvedValue(localCommittedIntent);
    mocks.recoverRemote.mockResolvedValue({
      status: "manual-recovery-required",
      operationRevision: "100:orphanoperation",
      vaultRevision: 101,
    });

    await expect(resumePendingJournalPasswordRemoval()).resolves.toBe("pending");

    expect(mocks.removeAtomically).toHaveBeenCalledWith(
      null,
      expect.objectContaining({ sessionOwnerUserId: "account-a" }),
    );
    expect(mocks.clearNativeCredential).toHaveBeenCalledTimes(1);
    expect(mocks.ensureQueued).toHaveBeenCalledTimes(1);
  });

  it.each(["preflight-pending", "remote-fenced", "blocked"] as const)(
    "never starts native or cloud cleanup while local removal is %s",
    async (phase) => {
      mocks.getIntent.mockResolvedValue(
        pendingIntent({
          phase,
          blocker: phase === "blocked" ? "decrypt-entry" : undefined,
          nativeCleanup: { status: "not-started" },
          cloudCleanup: { status: "not-started" },
        }),
      );

      await expect(resumePendingJournalPasswordRemoval()).resolves.toBe("pending");

      expect(mocks.clearNativeCredential).not.toHaveBeenCalled();
      expect(mocks.recordNativeCleanup).not.toHaveBeenCalled();
      expect(mocks.ensureQueued).not.toHaveBeenCalled();
    },
  );

  it("resumes native cleanup and cloud enqueue without mounting JournalModule", async () => {
    mocks.getIntent
      .mockResolvedValueOnce(pendingIntent())
      .mockResolvedValue(
        pendingIntent({ nativeCleanup: { status: "complete" } })
      );

    await expect(resumePendingJournalPasswordRemoval()).resolves.toBe("pending");

    expect(mocks.assertBoundary).toHaveBeenCalledTimes(1);
    expect(mocks.clearNativeCredential).toHaveBeenCalledTimes(1);
    expect(mocks.recordNativeCleanup).toHaveBeenCalledWith("operation-1", "complete");
    expect(mocks.ensureQueued).toHaveBeenCalledTimes(1);
  });

  it("never touches an installation-wide credential for another owner", async () => {
    mocks.getIntent.mockResolvedValue(pendingIntent());
    mocks.captureBoundary.mockResolvedValue({
      generation: 2,
      sessionOwnerUserId: "account-b",
      localOwnerUserId: "account-b",
    });

    await expect(resumePendingJournalPasswordRemoval()).resolves.toBe("pending");

    expect(mocks.assertBoundary).not.toHaveBeenCalled();
    expect(mocks.clearNativeCredential).not.toHaveBeenCalled();
    expect(mocks.ensureQueued).not.toHaveBeenCalled();
  });

  it("reports completion after the final native-only acknowledgement removes the intent", async () => {
    mocks.getIntent
      .mockResolvedValueOnce(
        pendingIntent({ cloudCleanup: { status: "complete" } })
      )
      .mockResolvedValueOnce(null);
    mocks.clearNativeCredential.mockResolvedValue("not-native");

    await expect(resumePendingJournalPasswordRemoval()).resolves.toBe("completed");

    expect(mocks.recordNativeCleanup).toHaveBeenCalledWith(
      "operation-1",
      "not-applicable"
    );
    expect(mocks.ensureQueued).not.toHaveBeenCalled();
  });

  it("is owned by the shared startup and resume lifecycle rather than JournalModule", () => {
    const mainSource = readFileSync("src/main.tsx", "utf8");
    const journalModuleSource = readFileSync(
      "src/features/journal/JournalModule.tsx",
      "utf8"
    );

    expect(mainSource.match(/resumePendingJournalPasswordRemoval/g)?.length).toBeGreaterThanOrEqual(
      3
    );
    expect(journalModuleSource).not.toContain("resumePendingJournalPasswordRemoval");
  });
});

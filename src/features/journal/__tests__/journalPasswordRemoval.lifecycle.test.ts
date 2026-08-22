import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
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
  pruneStage: vi.fn(),
  recoverAbort: vi.fn(),
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
  pruneJournalPasswordRemovalMediaStage: mocks.pruneStage,
  recoverPendingJournalPasswordRemovalAbort: mocks.recoverAbort,
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

import {
  resetJournalPasswordRemovalRecoveryProbeStateForTests,
  resumePendingJournalPasswordRemoval,
} from "../journalSecurityRemovalLifecycle";

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
  afterEach(() => {
    vi.useRealTimers();
  });

  beforeEach(() => {
    vi.clearAllMocks();
    resetJournalPasswordRemovalRecoveryProbeStateForTests();
    mocks.captureBoundary.mockResolvedValue({
      generation: 1,
      sessionOwnerUserId: "account-a",
      localOwnerUserId: "account-a",
    });
    mocks.assertBoundary.mockResolvedValue(undefined);
    mocks.recordNativeCleanup.mockResolvedValue(undefined);
    mocks.ensureQueued.mockResolvedValue(true);
    mocks.recoverRemote.mockResolvedValue({ status: "not-pending" });
    mocks.recordRemoteRecovery.mockResolvedValue("recorded");
    mocks.hasLocalProtection.mockResolvedValue(false);
    mocks.pruneStage.mockResolvedValue(undefined);
    mocks.recoverAbort.mockResolvedValue("pending");
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
      signal: expect.any(AbortSignal),
    });
  });

  it("bounds a hung orphan probe so ordinary authenticated lifecycle work can continue", async () => {
    vi.useFakeTimers();
    mocks.getIntent.mockResolvedValue(null);
    mocks.recoverRemote.mockReturnValueOnce(new Promise(() => undefined));

    const recovery = resumePendingJournalPasswordRemoval();
    await vi.advanceTimersByTimeAsync(5_000);
    const disposition = await Promise.race([
      recovery,
      Promise.resolve("still-blocked" as const),
    ]);

    expect(disposition).toBe("none");
  });

  it("shares one orphan probe across concurrent startup and resume callers", async () => {
    mocks.getIntent.mockResolvedValue(null);
    let releaseProbe!: () => void;
    mocks.recoverRemote.mockImplementationOnce(
      () => new Promise((resolve) => {
        releaseProbe = () => resolve({ status: "not-pending" });
      }),
    );

    const startup = resumePendingJournalPasswordRemoval();
    const resume = resumePendingJournalPasswordRemoval();
    await vi.waitFor(() => expect(mocks.recoverRemote).toHaveBeenCalledTimes(1));
    releaseProbe();

    await expect(Promise.all([startup, resume])).resolves.toEqual(["none", "none"]);
    expect(mocks.recoverRemote).toHaveBeenCalledTimes(1);
  });

  it("reuses a fresh successful no-orphan receipt across sequential lifecycle callers", async () => {
    mocks.getIntent.mockResolvedValue(null);

    await expect(resumePendingJournalPasswordRemoval()).resolves.toBe("none");
    await expect(resumePendingJournalPasswordRemoval()).resolves.toBe("none");

    expect(mocks.recoverRemote).toHaveBeenCalledTimes(1);
  });

  it("does not let an older completed server removal block a newer local vault", async () => {
    mocks.getIntent.mockResolvedValue(null);
    mocks.recoverRemote.mockResolvedValue({
      status: "complete",
      operationRevision: "99:olderoperation",
      vaultRevision: 100,
    });
    mocks.recordRemoteRecovery.mockResolvedValue("stale");

    await expect(resumePendingJournalPasswordRemoval()).resolves.toBe("none");

    expect(mocks.recordRemoteRecovery).toHaveBeenCalledWith(
      {
        operationRevision: "99:olderoperation",
        vaultRevision: 100,
        remoteStatus: "complete",
      },
      expect.objectContaining({
        sessionOwnerUserId: "account-a",
        localOwnerUserId: "account-a",
      }),
    );
    expect(mocks.getIntent).toHaveBeenCalledTimes(1);
    expect(mocks.removeAtomically).not.toHaveBeenCalled();
    expect(mocks.clearNativeCredential).not.toHaveBeenCalled();
    expect(mocks.ensureQueued).not.toHaveBeenCalled();
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

  it("recreates and aborts an exact no-mutation orphan fence after local intent loss", async () => {
    const abortIntent = pendingIntent({
      revision: "100:orphanoperation",
      operationRevision: "100:orphanoperation",
      phase: "abort-pending",
      blocker: "storage-failed",
      nativeCleanup: { status: "not-started" },
      cloudCleanup: { status: "not-started" },
    });
    mocks.getIntent
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce(abortIntent)
      .mockResolvedValueOnce(null);
    mocks.recoverRemote.mockResolvedValue({
      status: "abortable",
      operationRevision: "100:orphanoperation",
      vaultRevision: 101,
    });
    mocks.recoverAbort.mockResolvedValueOnce("aborted");

    await expect(resumePendingJournalPasswordRemoval()).resolves.toBe("completed");

    expect(mocks.recordRemoteRecovery).toHaveBeenCalledWith(
      {
        operationRevision: "100:orphanoperation",
        vaultRevision: 101,
        remoteStatus: "abortable",
      },
      expect.objectContaining({
        sessionOwnerUserId: "account-a",
        localOwnerUserId: "account-a",
      }),
    );
    expect(mocks.recoverAbort).toHaveBeenCalledWith(
      abortIntent,
      expect.any(Object),
    );
    expect(mocks.clearNativeCredential).not.toHaveBeenCalled();
    expect(mocks.ensureQueued).not.toHaveBeenCalled();
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

  it("never adopts a manual server fence from absence-only local evidence", async () => {
    const remoteIntent = pendingIntent({
      revision: "100:orphanoperation",
      operationRevision: "100:orphanoperation",
      phase: "remote-recovery",
      cloudCleanup: { status: "blocked" },
      nativeCleanup: { status: "not-started" },
    });
    mocks.getIntent
      .mockResolvedValueOnce(remoteIntent)
      .mockResolvedValue(remoteIntent);
    mocks.recoverRemote.mockResolvedValue({
      status: "manual-recovery-required",
      operationRevision: "100:orphanoperation",
      vaultRevision: 101,
    });

    await expect(resumePendingJournalPasswordRemoval()).resolves.toBe("pending");

    expect(mocks.hasLocalProtection).toHaveBeenCalledTimes(1);
    expect(mocks.removeAtomically).not.toHaveBeenCalled();
    expect(mocks.clearNativeCredential).not.toHaveBeenCalled();
    expect(mocks.ensureQueued).not.toHaveBeenCalled();
  });

  it("never cleans up an abortable server fence from absence-only local evidence", async () => {
    const remoteIntent = pendingIntent({
      revision: "100:orphanoperation",
      operationRevision: "100:orphanoperation",
      phase: "remote-recovery",
      cloudCleanup: { status: "blocked" },
      nativeCleanup: { status: "not-started" },
    });
    mocks.getIntent
      .mockResolvedValueOnce(remoteIntent)
      .mockResolvedValue(remoteIntent);
    mocks.recoverRemote.mockResolvedValue({
      status: "abortable",
      operationRevision: "100:orphanoperation",
      vaultRevision: 101,
    });

    await expect(resumePendingJournalPasswordRemoval()).resolves.toBe("pending");

    expect(mocks.hasLocalProtection).toHaveBeenCalledTimes(1);
    expect(mocks.recoverAbort).not.toHaveBeenCalled();
    expect(mocks.clearNativeCredential).not.toHaveBeenCalled();
    expect(mocks.ensureQueued).not.toHaveBeenCalled();
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

  it("retries the exact pre-commit remote abort after restart before any cleanup", async () => {
    const abortIntent = pendingIntent({
      phase: "abort-pending",
      blocker: "storage-failed",
      nativeCleanup: { status: "not-started" },
      cloudCleanup: { status: "not-started" },
    });
    mocks.getIntent.mockResolvedValueOnce(abortIntent).mockResolvedValueOnce(null);
    mocks.recoverAbort.mockResolvedValueOnce("aborted");

    await expect(resumePendingJournalPasswordRemoval()).resolves.toBe("completed");

    expect(mocks.recoverAbort).toHaveBeenCalledWith(
      abortIntent,
      expect.objectContaining({
        sessionOwnerUserId: "account-a",
        localOwnerUserId: "account-a",
      }),
    );
    expect(mocks.clearNativeCredential).not.toHaveBeenCalled();
    expect(mocks.ensureQueued).not.toHaveBeenCalled();
  });

  it("keeps an exact abort-pending operation fail-closed when remote abort cannot be proven", async () => {
    const abortIntent = pendingIntent({
      phase: "abort-pending",
      blocker: "storage-failed",
      nativeCleanup: { status: "not-started" },
      cloudCleanup: { status: "not-started" },
    });
    mocks.getIntent.mockResolvedValue(abortIntent);
    mocks.recoverAbort.mockResolvedValueOnce("pending");

    await expect(resumePendingJournalPasswordRemoval()).resolves.toBe("pending");

    expect(mocks.clearNativeCredential).not.toHaveBeenCalled();
    expect(mocks.ensureQueued).not.toHaveBeenCalled();
  });

  it("does not trust a cleanup phase while local protection artifacts still exist", async () => {
    mocks.getIntent.mockResolvedValue(pendingIntent({ phase: "cleanup-pending" }));
    mocks.hasLocalProtection.mockResolvedValue(true);

    await expect(resumePendingJournalPasswordRemoval()).resolves.toBe("pending");

    expect(mocks.hasLocalProtection).toHaveBeenCalledTimes(1);
    expect(mocks.clearNativeCredential).not.toHaveBeenCalled();
    expect(mocks.recordNativeCleanup).not.toHaveBeenCalled();
    expect(mocks.ensureQueued).not.toHaveBeenCalled();
  });

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

  it("still enqueues cloud cleanup when bounded native cleanup fails", async () => {
    mocks.getIntent.mockResolvedValue(pendingIntent());
    mocks.clearNativeCredential.mockRejectedValueOnce(
      new Error("Native diary credential cleanup timed out"),
    );

    await expect(resumePendingJournalPasswordRemoval()).resolves.toBe("pending");

    expect(mocks.recordNativeCleanup).toHaveBeenCalledWith("operation-1", "failed");
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

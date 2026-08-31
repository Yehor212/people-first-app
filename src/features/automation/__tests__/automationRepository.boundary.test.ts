import { beforeEach, describe, expect, it, vi } from "vitest";

const OWNER_ID = "11111111-1111-4111-8111-111111111111";
const TRANSACTION_ID = "22222222-2222-4222-8222-222222222222";
const CONSENT_EPOCH = "33333333-3333-4333-8333-333333333333";
const AFTER_REVISION = "44444444-4444-4444-8444-444444444444";
const SOURCE_KEY = `sha256:${"a".repeat(64)}`;
const HASH = `sha256:${"b".repeat(64)}`;

const runtime = vi.hoisted<{
  currentGeneration: string;
  ownerUserId: string | null;
  vaultKey: string | null;
  vaultRevision: number | null;
}>(() => ({
  currentGeneration: "boundary-a",
  ownerUserId: "11111111-1111-4111-8111-111111111111",
  vaultKey: "vault-key",
  vaultRevision: 7,
}));

const mocks = vi.hoisted(() => ({
  commitAutomationTransaction: vi.fn(),
  decryptAutomationRevision: vi.fn(),
}));

const lockRuntime = vi.hoisted<{
  beforeDataWrite: (() => Promise<void>) | null;
  dataWriteEntries: number;
}>(() => ({
  beforeDataWrite: null,
  dataWriteEntries: 0,
}));

vi.mock("../automationCloud", () => ({
  commitAutomationTransaction: mocks.commitAutomationTransaction,
}));

vi.mock("../revisionCrypto", () => ({
  decryptAutomationRevision: mocks.decryptAutomationRevision,
}));

vi.mock("@/features/journal/journalContentSession", () => ({
  getJournalContentVaultKey: vi.fn(() => runtime.vaultKey),
  getJournalContentVaultRevision: vi.fn(() => runtime.vaultRevision),
}));

vi.mock("@/storage/sync/syncOwner", () => ({
  validateSyncOwner: vi.fn(async (expected?: string) =>
    runtime.ownerUserId === expected ? runtime.ownerUserId : null
  ),
}));

vi.mock("@/storage/accountBoundaryRuntime", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/storage/accountBoundaryRuntime")>();
  return {
    ...actual,
    captureOriginAccountBoundaryGeneration: vi.fn(() => runtime.currentGeneration),
    isOriginAccountBoundaryGenerationCurrent: vi.fn(
      (generation: string) => generation === runtime.currentGeneration
    ),
  };
});

vi.mock("@/lib/originExclusiveLock", () => ({
  runWithOriginExclusiveLock: vi.fn(async (name: string, operation: () => unknown) => {
    if (name === "zenflow:data-write-barrier") {
      lockRuntime.dataWriteEntries += 1;
      await lockRuntime.beforeDataWrite?.();
    }
    return operation();
  }),
}));

import { processQueuedAutomationCommit } from "../automationRepository";
import type {
  AutomationCommitQueueIntent,
  AutomationRevisionEnvelope,
  AutomationTransactionStoreRow,
} from "../types";
import { db } from "@/storage/db";
import { notifyAccountSessionTransition } from "@/storage/accountBoundaryRuntime";

const intent: AutomationCommitQueueIntent = {
  schemaVersion: 1,
  transactionId: TRANSACTION_ID,
  expectedPreferenceRevision: 4,
  expectedHistoryGeneration: 2,
  deviceId: "android-install-1",
};

const transaction: AutomationTransactionStoreRow = {
  kind: "transaction",
  id: TRANSACTION_ID,
  ownerUserId: OWNER_ID,
  consentEpoch: CONSENT_EPOCH,
  sourceKey: SOURCE_KEY,
  ruleId: "mood.note-to-journal.v1",
  ruleVersion: 1,
  sourceType: "mood",
  sourceId: "mood-1",
  status: "commit_pending",
  revisionCiphertext: "zenflow:automation-revision:v1:encrypted",
  createdAt: 100,
  updatedAt: 100,
  schemaVersion: 1,
};

const revision: AutomationRevisionEnvelope = {
  schemaVersion: 1,
  transactionId: TRANSACTION_ID,
  ownerUserId: OWNER_ID,
  consentEpoch: CONSENT_EPOCH,
  sourceKey: SOURCE_KEY,
  ruleId: "mood.note-to-journal.v1",
  ruleVersion: 1,
  source: {
    schemaVersion: 1,
    type: "mood",
    id: "mood-1",
    revision: "updatedAt:100",
    committedAt: 100,
  },
  mutations: [
    {
      entityType: "journal",
      entityId: "journal-1",
      operation: "upsert",
      before: null,
      after: { id: "journal-1", content: "encrypted" },
      beforeHash: HASH,
      afterHash: HASH,
      beforeRevisionToken: null,
      afterRevisionToken: AFTER_REVISION,
    },
  ],
  plannedAt: 101,
};

function deferred<T>() {
  let resolve!: (value: T | PromiseLike<T>) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((resolvePromise, rejectPromise) => {
    resolve = resolvePromise;
    reject = rejectPromise;
  });
  return { promise, reject, resolve };
}

describe("queued automation account and vault boundaries", () => {
  beforeEach(async () => {
    vi.clearAllMocks();
    runtime.currentGeneration = "boundary-a";
    runtime.ownerUserId = OWNER_ID;
    runtime.vaultKey = "vault-key";
    runtime.vaultRevision = 7;
    lockRuntime.beforeDataWrite = null;
    lockRuntime.dataWriteEntries = 0;

    await db.open();
    await db.transaction(
      "rw",
      [db.automationTransactions, db.automationHistoryMarkers],
      async () => {
        await db.automationTransactions.clear();
        await db.automationHistoryMarkers.clear();
      }
    );
    await db.automationTransactions.put(transaction);
    mocks.decryptAutomationRevision.mockResolvedValue(revision);
    mocks.commitAutomationTransaction.mockResolvedValue({
      schemaVersion: 1,
      code: "COMMITTED",
      transactionId: TRANSACTION_ID,
      serverSequence: 12,
      historyGeneration: 2,
      completedAt: 110,
    });
  });

  it("rejects sign-out before decrypting or contacting the server", async () => {
    runtime.ownerUserId = null;

    await expect(processQueuedAutomationCommit(intent, OWNER_ID)).rejects.toMatchObject({
      code: "AUTOMATION_COMMIT_OWNER_UNAVAILABLE",
    });
    expect(mocks.decryptAutomationRevision).not.toHaveBeenCalled();
    expect(mocks.commitAutomationTransaction).not.toHaveBeenCalled();
  });

  it("rejects a removed vault before decrypting or contacting the server", async () => {
    runtime.vaultKey = null;
    runtime.vaultRevision = null;

    await expect(processQueuedAutomationCommit(intent, OWNER_ID)).rejects.toMatchObject({
      code: "AUTOMATION_COMMIT_VAULT_LOCKED",
    });
    expect(mocks.decryptAutomationRevision).not.toHaveBeenCalled();
    expect(mocks.commitAutomationTransaction).not.toHaveBeenCalled();
  });

  it("does not contact the server after the owner changes during decrypt", async () => {
    const decrypt = deferred<AutomationRevisionEnvelope>();
    mocks.decryptAutomationRevision.mockReturnValueOnce(decrypt.promise);
    const processing = processQueuedAutomationCommit(intent, OWNER_ID);
    await vi.waitFor(() => expect(mocks.decryptAutomationRevision).toHaveBeenCalledOnce());

    runtime.ownerUserId = null;
    decrypt.resolve(revision);

    await expect(processing).rejects.toMatchObject({
      code: "AUTOMATION_COMMIT_OWNER_UNAVAILABLE",
    });
    expect(mocks.commitAutomationTransaction).not.toHaveBeenCalled();
    await expect(db.automationTransactions.get(TRANSACTION_ID)).resolves.toMatchObject({
      status: "commit_pending",
    });
  });

  it("does not contact the server after the vault is rewrapped during decrypt", async () => {
    const decrypt = deferred<AutomationRevisionEnvelope>();
    mocks.decryptAutomationRevision.mockReturnValueOnce(decrypt.promise);
    const processing = processQueuedAutomationCommit(intent, OWNER_ID);
    await vi.waitFor(() => expect(mocks.decryptAutomationRevision).toHaveBeenCalledOnce());

    runtime.vaultRevision = 8;
    decrypt.resolve(revision);

    await expect(processing).rejects.toMatchObject({
      code: "AUTOMATION_COMMIT_VAULT_LOCKED",
    });
    expect(mocks.commitAutomationTransaction).not.toHaveBeenCalled();
    await expect(db.automationTransactions.get(TRANSACTION_ID)).resolves.toMatchObject({
      status: "commit_pending",
    });
  });

  it("does not acknowledge a late response after the account generation changes", async () => {
    const commit = deferred<{
      schemaVersion: 1;
      code: "COMMITTED";
      transactionId: string;
      serverSequence: number;
      historyGeneration: number;
      completedAt: number;
    }>();
    mocks.commitAutomationTransaction.mockReturnValueOnce(commit.promise);
    const processing = processQueuedAutomationCommit(intent, OWNER_ID);
    await vi.waitFor(() => expect(mocks.commitAutomationTransaction).toHaveBeenCalledOnce());

    runtime.currentGeneration = "boundary-b";
    commit.resolve({
      schemaVersion: 1,
      code: "COMMITTED",
      transactionId: TRANSACTION_ID,
      serverSequence: 12,
      historyGeneration: 2,
      completedAt: 110,
    });

    await expect(processing).rejects.toMatchObject({
      code: "AUTOMATION_COMMIT_BOUNDARY_CHANGED",
    });
    await expect(db.automationTransactions.get(TRANSACTION_ID)).resolves.toMatchObject({
      status: "commit_pending",
    });
  });

  it("does not acknowledge a late response after an ABA session transition", async () => {
    const commit = deferred<{
      schemaVersion: 1;
      code: "COMMITTED";
      transactionId: string;
      serverSequence: number;
      historyGeneration: number;
      completedAt: number;
    }>();
    mocks.commitAutomationTransaction.mockReturnValueOnce(commit.promise);
    const processing = processQueuedAutomationCommit(intent, OWNER_ID);
    await vi.waitFor(() => expect(mocks.commitAutomationTransaction).toHaveBeenCalledOnce());

    notifyAccountSessionTransition();
    notifyAccountSessionTransition();
    commit.resolve({
      schemaVersion: 1,
      code: "COMMITTED",
      transactionId: TRANSACTION_ID,
      serverSequence: 12,
      historyGeneration: 2,
      completedAt: 110,
    });

    await expect(processing).rejects.toThrow(/account boundary|session changed/i);
    await expect(db.automationTransactions.get(TRANSACTION_ID)).resolves.toMatchObject({
      status: "commit_pending",
    });
  });

  it("serializes an accepted acknowledgement behind account cleanup without restoring old-owner state", async () => {
    lockRuntime.beforeDataWrite = async () => {
      runtime.currentGeneration = "boundary-b";
      runtime.ownerUserId = null;
      await db.automationTransactions.clear();
    };

    await expect(processQueuedAutomationCommit(intent, OWNER_ID)).rejects.toMatchObject({
      code: "AUTOMATION_COMMIT_OWNER_UNAVAILABLE",
    });
    expect(lockRuntime.dataWriteEntries).toBe(1);
    await expect(db.automationTransactions.get(TRANSACTION_ID)).resolves.toBeUndefined();
  });

  it("keeps a rejected outer-inner binding away from the server", async () => {
    mocks.decryptAutomationRevision.mockRejectedValueOnce(
      Object.assign(new Error("binding mismatch"), {
        code: "AUTOMATION_REVISION_BINDING_MISMATCH",
      })
    );

    await expect(processQueuedAutomationCommit(intent, OWNER_ID)).rejects.toMatchObject({
      code: "AUTOMATION_REVISION_BINDING_MISMATCH",
    });
    expect(mocks.commitAutomationTransaction).not.toHaveBeenCalled();
    await expect(db.automationTransactions.get(TRANSACTION_ID)).resolves.toMatchObject({
      status: "commit_pending",
    });
  });
});

import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  commitAutomationTransaction: vi.fn(),
  decryptAutomationRevision: vi.fn(),
  getJournalContentVaultKey: vi.fn(),
  getJournalContentVaultRevision: vi.fn(),
  validateSyncOwner: vi.fn(),
}));

vi.mock("../automationCloud", () => ({
  commitAutomationTransaction: mocks.commitAutomationTransaction,
}));

vi.mock("../revisionCrypto", () => ({
  decryptAutomationRevision: mocks.decryptAutomationRevision,
}));

vi.mock("@/features/journal/journalContentSession", () => ({
  getJournalContentVaultKey: mocks.getJournalContentVaultKey,
  getJournalContentVaultRevision: mocks.getJournalContentVaultRevision,
}));

vi.mock("@/storage/sync/syncOwner", () => ({
  validateSyncOwner: mocks.validateSyncOwner,
}));

import { processQueuedAutomationCommit } from "../automationRepository";
import { hashAutomationValue } from "../canonicalJson";
import type {
  AutomationCommitQueueIntent,
  AutomationRevisionEnvelope,
  AutomationTransactionStoreRow,
} from "../types";
import { db } from "@/storage/db";

const OWNER_ID = "11111111-1111-4111-8111-111111111111";
const TRANSACTION_ID = "22222222-2222-4222-8222-222222222222";
const CONSENT_EPOCH = "33333333-3333-4333-8333-333333333333";
const AFTER_REVISION = "44444444-4444-4444-8444-444444444444";
const SOURCE_KEY = `sha256:${"a".repeat(64)}`;
const HASH = `sha256:${"b".repeat(64)}`;
const OPTIMISTIC_JOURNAL = {
  id: "journal-1",
  date: "2026-08-08",
  title: "",
  content: "zenflow:journal-content:v1:encrypted",
  stickers: [],
  photoIds: [],
  audioIds: [],
  tags: ["mood"],
  createdAt: 100,
  updatedAt: 101,
};
const OPTIMISTIC_JOURNAL_PROJECTION = {
  id: "journal-1",
  date: "2026-08-08",
  title: "",
  content: "zenflow:journal-content:v1:encrypted",
  stickers: [],
  mood: null,
  tags: ["mood"],
  template_id: null,
  habit_snapshot: null,
  photo_ids: [],
  audio_ids: [],
  created_at: 100,
  updated_at: 101,
  bg_intensity: null,
  bg_pattern: null,
  font: null,
  font_size: null,
  ink_color: null,
  paper_color: null,
  paper_texture: null,
  particle_speed: null,
  photo_layout: null,
  theme: null,
};

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
      after: { id: "journal-1", content: "private text" },
      beforeHash: HASH,
      afterHash: HASH,
      beforeRevisionToken: null,
      afterRevisionToken: AFTER_REVISION,
    },
  ],
  plannedAt: 101,
};

async function seedOwnedOptimisticJournal(): Promise<AutomationRevisionEnvelope> {
  const afterHash = await hashAutomationValue(OPTIMISTIC_JOURNAL_PROJECTION);
  const ownedRevision: AutomationRevisionEnvelope = {
    ...revision,
    mutations: [
      {
        ...revision.mutations[0],
        after: OPTIMISTIC_JOURNAL_PROJECTION,
        beforeHash: await hashAutomationValue(null),
        afterHash,
      },
    ],
  };
  await db.journalEntries.put(OPTIMISTIC_JOURNAL);
  await db.automationTransactions.bulkPut([
    transaction,
    {
      kind: "record_revision",
      id: "record_revision:journal:journal-1",
      schemaVersion: 1,
      ownerUserId: OWNER_ID,
      entityType: "journal",
      entityId: "journal-1",
      recordExists: true,
      revisionToken: AFTER_REVISION,
      stateHash: afterHash,
      mutationGeneration: 1,
      transactionId: TRANSACTION_ID,
      updatedAt: 101,
    },
  ]);
  mocks.decryptAutomationRevision.mockResolvedValue(ownedRevision);
  return ownedRevision;
}

describe("queued automation commit repository", () => {
  beforeEach(async () => {
    vi.clearAllMocks();
    await db.open();
    await db.transaction(
      "rw",
      [db.automationTransactions, db.automationHistoryMarkers, db.journalEntries],
      async () => {
        await db.automationTransactions.clear();
        await db.automationHistoryMarkers.clear();
        await db.journalEntries.clear();
      },
    );
    mocks.validateSyncOwner.mockResolvedValue(OWNER_ID);
    mocks.getJournalContentVaultKey.mockReturnValue("vault-key");
    mocks.getJournalContentVaultRevision.mockReturnValue(1);
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

  it("reconstructs private mutations only after decrypt and marks exact server acceptance", async () => {
    await db.automationTransactions.put(transaction);

    await expect(processQueuedAutomationCommit(intent, OWNER_ID)).resolves.toEqual({
      status: "committed",
    });

    expect(mocks.decryptAutomationRevision).toHaveBeenCalledWith(
      transaction.revisionCiphertext,
      "vault-key",
      expect.objectContaining({
        transactionId: TRANSACTION_ID,
        ownerUserId: OWNER_ID,
        sourceType: "mood",
        sourceId: "mood-1",
      }),
    );
    expect(mocks.commitAutomationTransaction).toHaveBeenCalledWith(
      expect.objectContaining({
        transactionId: TRANSACTION_ID,
        mutations: revision.mutations,
      }),
      OWNER_ID,
    );
    await expect(db.automationTransactions.get(TRANSACTION_ID)).resolves.toMatchObject({
      status: "committed",
      serverSequence: 12,
      historyGeneration: 2,
    });
  });

  it("fails closed while the vault is locked without exposing the encrypted row to cloud", async () => {
    await db.automationTransactions.put(transaction);
    mocks.getJournalContentVaultKey.mockReturnValue(null);

    await expect(processQueuedAutomationCommit(intent, OWNER_ID)).rejects.toMatchObject({
      code: "AUTOMATION_COMMIT_VAULT_LOCKED",
    });
    expect(mocks.decryptAutomationRevision).not.toHaveBeenCalled();
    expect(mocks.commitAutomationTransaction).not.toHaveBeenCalled();
  });

  it("terminally compensates an exact owned optimistic row after stale-epoch rejection", async () => {
    await seedOwnedOptimisticJournal();
    mocks.commitAutomationTransaction.mockResolvedValue({
      schemaVersion: 1,
      code: "STALE_CONSENT_EPOCH",
      transactionId: TRANSACTION_ID,
      currentPreferenceRevision: 5,
      historyGeneration: 2,
    });

    await expect(processQueuedAutomationCommit(intent, OWNER_ID)).resolves.toEqual({
      status: "obsolete",
      reason: "server-rejected",
    });
    await expect(db.journalEntries.get("journal-1")).resolves.toBeUndefined();
    await expect(
      db.automationTransactions.get("record_revision:journal:journal-1"),
    ).resolves.toMatchObject({
      recordExists: false,
      revisionToken: null,
      transactionId: null,
    });
    await expect(db.automationTransactions.get(TRANSACTION_ID)).resolves.toMatchObject({
      status: "revoked",
    });
  });

  it("preserves a newer manual row and terminally marks conflict instead of retrying forever", async () => {
    await seedOwnedOptimisticJournal();
    const manualJournal = {
      ...OPTIMISTIC_JOURNAL,
      content: "zenflow:journal-content:v1:newer-manual-edit",
      updatedAt: 150,
    };
    const manualProjection = {
      ...OPTIMISTIC_JOURNAL_PROJECTION,
      content: manualJournal.content,
      updated_at: 150,
    };
    await db.journalEntries.put(manualJournal);
    await db.automationTransactions.put({
      kind: "record_revision",
      id: "record_revision:journal:journal-1",
      schemaVersion: 1,
      ownerUserId: OWNER_ID,
      entityType: "journal",
      entityId: "journal-1",
      recordExists: true,
      revisionToken: "66666666-6666-4666-8666-666666666666",
      stateHash: await hashAutomationValue(manualProjection),
      mutationGeneration: 2,
      transactionId: null,
      updatedAt: 150,
    });
    mocks.commitAutomationTransaction.mockResolvedValue({
      schemaVersion: 1,
      code: "TARGET_REVISION_CONFLICT",
      transactionId: TRANSACTION_ID,
      currentPreferenceRevision: 4,
      historyGeneration: 2,
    });

    await expect(processQueuedAutomationCommit(intent, OWNER_ID)).resolves.toEqual({
      status: "obsolete",
      reason: "server-rejected",
    });
    await expect(db.journalEntries.get("journal-1")).resolves.toEqual(manualJournal);
    await expect(db.automationTransactions.get(TRANSACTION_ID)).resolves.toMatchObject({
      status: "commit_conflict",
    });
  });

  it("classifies a rejected commit without an owned local token as terminal conflict", async () => {
    await db.automationTransactions.put(transaction);
    mocks.commitAutomationTransaction.mockResolvedValue({
      schemaVersion: 1,
      code: "TARGET_REVISION_CONFLICT",
      transactionId: TRANSACTION_ID,
      currentPreferenceRevision: 4,
      historyGeneration: 2,
    });

    await expect(processQueuedAutomationCommit(intent, OWNER_ID)).resolves.toEqual({
      status: "obsolete",
      reason: "server-rejected",
    });
    await expect(db.automationTransactions.get(TRANSACTION_ID)).resolves.toMatchObject({
      status: "commit_conflict",
    });
  });

  it("does not alias ciphertext when the server canonical transaction identity differs", async () => {
    await db.automationTransactions.put(transaction);
    mocks.commitAutomationTransaction.mockResolvedValue({
      schemaVersion: 1,
      code: "ALREADY_COMMITTED",
      transactionId: "55555555-5555-4555-8555-555555555555",
      serverSequence: 12,
      historyGeneration: 2,
      completedAt: 110,
    });

    await expect(processQueuedAutomationCommit(intent, OWNER_ID)).rejects.toMatchObject({
      code: "AUTOMATION_COMMIT_CANONICAL_MISMATCH",
    });
  });

  it("treats a purged local row as obsolete and rejects prose-bearing queue payloads", async () => {
    await expect(processQueuedAutomationCommit(intent, OWNER_ID)).resolves.toEqual({
      status: "obsolete",
      reason: "transaction-missing",
    });
    await expect(
      processQueuedAutomationCommit(
        { ...intent, privateText: "must not persist" } as AutomationCommitQueueIntent,
        OWNER_ID,
      ),
    ).rejects.toMatchObject({ code: "AUTOMATION_COMMIT_INTENT_INVALID" });
    expect(mocks.commitAutomationTransaction).not.toHaveBeenCalled();
  });

  it("does not resurrect an accepted commit whose response arrives after a history generation purge", async () => {
    await db.automationTransactions.put(transaction);
    let resolveCommit: ((value: unknown) => void) | undefined;
    mocks.commitAutomationTransaction.mockImplementationOnce(
      () => new Promise(resolve => {
        resolveCommit = resolve;
      }),
    );

    const processing = processQueuedAutomationCommit(intent, OWNER_ID);
    await vi.waitFor(() => {
      expect(mocks.commitAutomationTransaction).toHaveBeenCalledOnce();
    });
    await db.automationHistoryMarkers.put({
      schemaVersion: 1,
      ownerUserId: OWNER_ID,
      historyGeneration: 3,
      snapshotSequence: 13,
      lastAppliedServerSequence: 13,
      bootstrapCompletedAt: 120,
      allHistoryPurgedAt: 120,
      updatedAt: 120,
    });
    resolveCommit?.({
      schemaVersion: 1,
      code: "COMMITTED",
      transactionId: TRANSACTION_ID,
      serverSequence: 12,
      historyGeneration: 2,
      completedAt: 110,
    });

    await expect(processing).resolves.toEqual({
      status: "obsolete",
      reason: "transaction-terminal",
    });
    await expect(db.automationTransactions.get(TRANSACTION_ID)).resolves.toBeUndefined();
  });
});

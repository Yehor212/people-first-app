import { beforeEach, describe, expect, it, vi } from "vitest";

const boundary = vi.hoisted(() => ({
  current: true,
  generation: "boundary-a",
  owner: "11111111-1111-4111-8111-111111111111",
  vaultKey: "vault-key",
  vaultRevision: 7,
}));

const mocks = vi.hoisted(() => ({
  decryptAutomationRevision: vi.fn(),
  undoAutomationTransaction: vi.fn(),
}));

vi.mock("../automationCloud", () => ({
  undoAutomationTransaction: mocks.undoAutomationTransaction,
}));

vi.mock("../revisionCrypto", () => ({
  decryptAutomationRevision: mocks.decryptAutomationRevision,
}));

vi.mock("@/features/journal/journalContentSession", () => ({
  getJournalContentVaultKey: vi.fn(() => boundary.vaultKey),
  getJournalContentVaultRevision: vi.fn(() => boundary.vaultRevision),
}));

vi.mock("@/storage/sync/syncOwner", () => ({
  validateSyncOwner: vi.fn(async () => boundary.owner),
}));

vi.mock("@/storage/accountBoundaryRuntime", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/storage/accountBoundaryRuntime")>();
  return {
    ...actual,
    captureOriginAccountBoundaryGeneration: vi.fn(() => boundary.generation),
    isOriginAccountBoundaryGenerationCurrent: vi.fn(() => boundary.current),
  };
});

vi.mock("@/lib/originExclusiveLock", () => ({
  runWithOriginExclusiveLock: vi.fn(async (_name: string, operation: () => unknown) => operation()),
}));

import {
  deriveAutomationUndoRevisionToken,
  processQueuedAutomationUndo,
  requestAutomationUndo,
} from "../automationUndo";
import { hashAutomationValue } from "../canonicalJson";
import type {
  AutomationRevisionEnvelope,
  AutomationTransactionStoreRow,
} from "../types";
import { db, type OfflineQueueItem } from "@/storage/db";
import { getDeletedJournalEntryIds } from "@/storage/deletionTracker";

const OWNER_ID = boundary.owner;
const TRANSACTION_ID = "22222222-2222-4222-8222-222222222222";
const CONSENT_EPOCH = "33333333-3333-4333-8333-333333333333";
const AFTER_REVISION = "44444444-4444-4444-8444-444444444444";
const OPERATION_ID = "55555555-5555-4555-8555-555555555555";
const CANONICAL_UNDO_ID = "66666666-6666-4666-8666-666666666666";
const SOURCE_KEY = `sha256:${"a".repeat(64)}`;

const journal = {
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

const journalProjection = {
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

let revision: AutomationRevisionEnvelope;

function committedTransaction(): AutomationTransactionStoreRow {
  return {
    kind: "transaction",
    id: TRANSACTION_ID,
    ownerUserId: OWNER_ID,
    consentEpoch: CONSENT_EPOCH,
    sourceKey: SOURCE_KEY,
    ruleId: "mood.note-to-journal.v1",
    ruleVersion: 1,
    sourceType: "mood",
    sourceId: "mood-1",
    status: "committed",
    revisionCiphertext: "zenflow:automation-revision:v1:encrypted",
    createdAt: 100,
    updatedAt: 110,
    serverSequence: 12,
    historyGeneration: 2,
    schemaVersion: 1,
  };
}

async function seedCommittedJournal(): Promise<void> {
  const afterHash = await hashAutomationValue(journalProjection);
  revision = {
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
        after: journalProjection,
        beforeHash: await hashAutomationValue(null),
        afterHash,
        beforeRevisionToken: null,
        afterRevisionToken: AFTER_REVISION,
      },
    ],
    plannedAt: 101,
  };
  await db.journalEntries.put(journal);
  await db.automationTransactions.bulkPut([
    committedTransaction(),
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
  await db.automationHistoryMarkers.put({
    schemaVersion: 1,
    ownerUserId: OWNER_ID,
    historyGeneration: 2,
    snapshotSequence: 0,
    lastAppliedServerSequence: 12,
    bootstrapCompletedAt: 90,
    updatedAt: 110,
  });
  mocks.decryptAutomationRevision.mockResolvedValue(revision);
}

describe("durable automation undo", () => {
  beforeEach(async () => {
    vi.clearAllMocks();
    boundary.current = true;
    boundary.owner = OWNER_ID;
    boundary.generation = "boundary-a";
    boundary.vaultKey = "vault-key";
    boundary.vaultRevision = 7;
    vi.spyOn(globalThis.crypto, "randomUUID").mockReturnValue(OPERATION_ID);
    await db.open();
    await db.transaction(
      "rw",
      [
        db.journalEntries,
        db.settings,
        db.offlineQueue,
        db.automationTransactions,
        db.automationHistoryMarkers,
      ],
      async () => {
        await db.journalEntries.clear();
        await db.settings.clear();
        await db.offlineQueue.clear();
        await db.automationTransactions.clear();
        await db.automationHistoryMarkers.clear();
      },
    );
    await seedCommittedJournal();
    mocks.undoAutomationTransaction.mockResolvedValue({
      schemaVersion: 1,
      code: "UNDONE",
      transactionId: TRANSACTION_ID,
      undoTransactionId: OPERATION_ID,
      serverSequence: 13,
      historyGeneration: 2,
      completedAt: 120,
    });
  });

  it("derives stable distinct RFC UUIDv8 revision identities without asynchronous replay work", () => {
    const first = deriveAutomationUndoRevisionToken(OPERATION_ID, 0);
    expect(first).toBe(deriveAutomationUndoRevisionToken(OPERATION_ID, 0));
    expect(first).not.toBe(deriveAutomationUndoRevisionToken(OPERATION_ID, 1));
    expect(first).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-8[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/,
    );
  });

  it("persists undo_pending and one opaque stable outbox without mutating the domain row", async () => {
    await expect(
      requestAutomationUndo(TRANSACTION_ID, OWNER_ID, "android-install-1"),
    ).resolves.toEqual({ status: "pending", operationId: OPERATION_ID });

    await expect(db.journalEntries.get("journal-1")).resolves.toEqual(journal);
    await expect(db.automationTransactions.get(TRANSACTION_ID)).resolves.toMatchObject({
      status: "undo_pending",
    });
    const outbox = await db.offlineQueue.toArray();
    expect(outbox).toEqual([
      expect.objectContaining({
        id: `automation-undo:${TRANSACTION_ID}`,
        operationId: OPERATION_ID,
        type: "UNDO_AUTOMATION_TRANSACTION",
        entityId: TRANSACTION_ID,
        payload: {
          schemaVersion: 1,
          operationId: OPERATION_ID,
          transactionId: TRANSACTION_ID,
          expectedServerSequence: 12,
          expectedHistoryGeneration: 2,
          deviceId: "android-install-1",
        },
      }),
    ]);
    expect(JSON.stringify(outbox)).not.toContain(journal.content);
  });

  it("applies an accepted server CAS, records a permanent tombstone and becomes idempotently undone", async () => {
    const pending = await requestAutomationUndo(
      TRANSACTION_ID,
      OWNER_ID,
      "android-install-1",
    );
    if (pending.status !== "pending") throw new Error("expected pending undo");
    const queueItem = await db.offlineQueue.get(`automation-undo:${TRANSACTION_ID}`);
    if (!queueItem) throw new Error("expected durable undo row");

    await expect(
      processQueuedAutomationUndo(queueItem.payload, OWNER_ID),
    ).resolves.toEqual({ status: "committed" });

    await expect(db.journalEntries.get("journal-1")).resolves.toBeUndefined();
    await expect(getDeletedJournalEntryIds()).resolves.toEqual(new Set(["journal-1"]));
    await expect(db.automationTransactions.get(TRANSACTION_ID)).resolves.toMatchObject({
      status: "undone",
      undoTransactionId: OPERATION_ID,
      serverSequence: 13,
      historyGeneration: 2,
    });
    await expect(
      requestAutomationUndo(TRANSACTION_ID, OWNER_ID, "android-install-1"),
    ).resolves.toEqual({ status: "already-undone", operationId: OPERATION_ID });
  });

  it("does not advance the automation cursor across an unseen predecessor", async () => {
    mocks.undoAutomationTransaction.mockResolvedValue({
      schemaVersion: 1,
      code: "UNDONE",
      transactionId: TRANSACTION_ID,
      undoTransactionId: OPERATION_ID,
      serverSequence: 14,
      historyGeneration: 2,
      completedAt: 120,
    });
    const pending = await requestAutomationUndo(
      TRANSACTION_ID,
      OWNER_ID,
      "android-install-1",
    );
    if (pending.status !== "pending") throw new Error("expected pending undo");
    const queueItem = await db.offlineQueue.get(`automation-undo:${TRANSACTION_ID}`);

    await expect(
      processQueuedAutomationUndo(queueItem?.payload, OWNER_ID),
    ).resolves.toEqual({ status: "committed" });

    await expect(db.automationTransactions.get(TRANSACTION_ID)).resolves.toMatchObject({
      status: "undone",
      serverSequence: 14,
    });
    await expect(db.automationHistoryMarkers.get(OWNER_ID)).resolves.toMatchObject({
      lastAppliedServerSequence: 12,
    });
  });

  it("converges to another device's canonical already-undone operation", async () => {
    const pending = await requestAutomationUndo(
      TRANSACTION_ID,
      OWNER_ID,
      "android-install-1",
    );
    if (pending.status !== "pending") throw new Error("expected pending undo");
    const queueItem = await db.offlineQueue.get(`automation-undo:${TRANSACTION_ID}`);
    if (!queueItem) throw new Error("expected durable undo row");
    mocks.undoAutomationTransaction.mockResolvedValue({
      schemaVersion: 1,
      code: "ALREADY_UNDONE",
      transactionId: TRANSACTION_ID,
      undoTransactionId: CANONICAL_UNDO_ID,
      serverSequence: 13,
      historyGeneration: 2,
      completedAt: 120,
    });

    await expect(
      processQueuedAutomationUndo(queueItem.payload, OWNER_ID),
    ).resolves.toEqual({ status: "committed" });

    await expect(db.journalEntries.get("journal-1")).resolves.toBeUndefined();
    await expect(db.automationTransactions.get(TRANSACTION_ID)).resolves.toMatchObject({
      status: "undone",
      undoTransactionId: CANONICAL_UNDO_ID,
    });
    await expect(
      db.automationTransactions.get("record_revision:journal:journal-1"),
    ).resolves.toMatchObject({
      transactionId: CANONICAL_UNDO_ID,
      revisionToken: null,
    });
  });

  it("preserves an A-B-A manual revision and marks a rejected server CAS terminally conflicted", async () => {
    const pending = await requestAutomationUndo(
      TRANSACTION_ID,
      OWNER_ID,
      "android-install-1",
    );
    if (pending.status !== "pending") throw new Error("expected pending undo");
    await db.automationTransactions.put({
      kind: "record_revision",
      id: "record_revision:journal:journal-1",
      schemaVersion: 1,
      ownerUserId: OWNER_ID,
      entityType: "journal",
      entityId: "journal-1",
      recordExists: true,
      revisionToken: "66666666-6666-4666-8666-666666666666",
      stateHash: await hashAutomationValue(journalProjection),
      mutationGeneration: 3,
      transactionId: null,
      updatedAt: 119,
    });
    mocks.undoAutomationTransaction.mockResolvedValue({
      schemaVersion: 1,
      code: "TARGET_REVISION_CONFLICT",
      transactionId: TRANSACTION_ID,
      historyGeneration: 2,
    });
    const queueItem = await db.offlineQueue.get(`automation-undo:${TRANSACTION_ID}`);

    await expect(
      processQueuedAutomationUndo(queueItem?.payload, OWNER_ID),
    ).resolves.toEqual({ status: "obsolete", reason: "server-rejected" });
    await expect(db.journalEntries.get("journal-1")).resolves.toEqual(journal);
    await expect(db.automationTransactions.get(TRANSACTION_ID)).resolves.toMatchObject({
      status: "conflict",
    });
  });

  it("reuses the pending operation and rolls back status when the outbox is full", async () => {
    const first = await requestAutomationUndo(
      TRANSACTION_ID,
      OWNER_ID,
      "android-install-1",
    );
    const second = await requestAutomationUndo(
      TRANSACTION_ID,
      OWNER_ID,
      "android-install-1",
    );
    expect(second).toEqual(first);
    await expect(db.offlineQueue.count()).resolves.toBe(1);

    await db.offlineQueue.clear();
    await db.automationTransactions.put(committedTransaction());
    const fullQueue: OfflineQueueItem[] = Array.from({ length: 1_000 }, (_, index) => ({
      id: `existing-${index}`,
      operationId: `operation-${index}`,
      type: "UPDATE_SETTINGS",
      entityId: `setting-${index}`,
      ownerUserId: OWNER_ID,
      payload: null,
      timestamp: index,
      retries: 0,
      maxRetries: 5,
    }));
    await db.offlineQueue.bulkAdd(fullQueue);

    await expect(
      requestAutomationUndo(TRANSACTION_ID, OWNER_ID, "android-install-1"),
    ).rejects.toThrow("Offline queue full");
    await expect(db.automationTransactions.get(TRANSACTION_ID)).resolves.toMatchObject({
      status: "committed",
    });
  });
});

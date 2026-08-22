import { beforeEach, describe, expect, it, vi } from "vitest";

const OWNER_ID = "11111111-1111-4111-8111-111111111111";
const TRANSACTION_ID = "22222222-2222-4222-8222-222222222222";
const CONSENT_EPOCH = "33333333-3333-4333-8333-333333333333";
const AFTER_REVISION = "44444444-4444-4444-8444-444444444444";
const OPERATION_ID = "55555555-5555-4555-8555-555555555555";
const SOURCE_KEY = `sha256:${"a".repeat(64)}`;

const runtime = vi.hoisted(() => ({
  boundaryCurrent: true,
  boundaryGeneration: "boundary-a",
  ownerUserId: "11111111-1111-4111-8111-111111111111",
  vaultKey: "vault-key",
  vaultRevision: 7,
}));

const mocks = vi.hoisted(() => ({
  decryptAutomationRevision: vi.fn(),
  undoAutomationTransaction: vi.fn(),
  purgeAutomationHistory: vi.fn(),
  triggerDataRefresh: vi.fn(),
}));

vi.mock("@/lib/supabaseClient", () => ({
  supabase: null,
  getCurrentUserId: vi.fn(async () => runtime.ownerUserId),
}));

vi.mock("@/storage/sync/syncOwner", () => ({
  validateSyncOwner: vi.fn(async (expected?: string) =>
    !expected || expected === runtime.ownerUserId ? runtime.ownerUserId : null,
  ),
  SyncOwnerBoundaryError: class SyncOwnerBoundaryError extends Error {},
}));

vi.mock("@/storage/accountBoundaryRuntime", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/storage/accountBoundaryRuntime")>();
  return {
    ...actual,
    captureOriginAccountBoundaryGeneration: vi.fn(() => runtime.boundaryGeneration),
    isOriginAccountBoundaryGenerationCurrent: vi.fn(() => runtime.boundaryCurrent),
  };
});

vi.mock("@/lib/originExclusiveLock", () => ({
  runWithOriginExclusiveLock: vi.fn(async (_name: string, operation: () => unknown) =>
    operation(),
  ),
}));

vi.mock("@/features/journal/journalContentSession", () => ({
  getJournalContentVaultKey: vi.fn(() => runtime.vaultKey),
  getJournalContentVaultRevision: vi.fn(() => runtime.vaultRevision),
}));

vi.mock("@/features/journal/journalSecurityWriteLock", () => ({
  runWithJournalSecurityWriteLock: vi.fn(async (operation: () => unknown) => operation()),
}));

vi.mock("@/features/automation/revisionCrypto", () => ({
  decryptAutomationRevision: mocks.decryptAutomationRevision,
}));

vi.mock("@/features/automation/automationCloud", () => ({
  commitAutomationTransaction: vi.fn(),
  fetchAutomationHistorySnapshot: vi.fn(),
  purgeAutomationHistory: mocks.purgeAutomationHistory,
  undoAutomationTransaction: mocks.undoAutomationTransaction,
}));

vi.mock("@/hooks/useIndexedDB", () => ({
  triggerDataRefresh: mocks.triggerDataRefresh,
}));

vi.mock("@/lib/syncBroadcast", () => ({
  broadcastChange: vi.fn(),
}));

vi.mock("@/lib/logger", () => ({
  logger: {
    error: vi.fn(),
    log: vi.fn(),
    sync: vi.fn(),
    warn: vi.fn(),
  },
}));

import {
  processQueuedAutomationUndo,
  requestAutomationUndo,
} from "@/features/automation/automationUndo";
import { hashAutomationValue } from "@/features/automation/canonicalJson";
import type {
  AutomationRevisionEnvelope,
  AutomationTransactionStoreRow,
} from "@/features/automation/types";
import { applyDelta, type SyncEvent } from "@/storage/eventSync";
import { db, setLocalDataOwnerId } from "@/storage/db";
import { getDeletedJournalEntryIds } from "@/storage/deletionTracker";

const journal = {
  id: "journal-created-by-automation",
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
  id: journal.id,
  date: journal.date,
  title: journal.title,
  content: journal.content,
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
    sourceId: "mood-source",
    status: "committed",
    revisionCiphertext: "zenflow:automation-revision:v1:encrypted",
    createdAt: 100,
    updatedAt: 110,
    serverSequence: 12,
    historyGeneration: 2,
    schemaVersion: 1,
  };
}

async function seedAutomationCreatedJournal(): Promise<void> {
  const afterHash = await hashAutomationValue(journalProjection);
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
      id: "mood-source",
      revision: "updatedAt:100",
      committedAt: 100,
    },
    mutations: [
      {
        entityType: "journal",
        entityId: journal.id,
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
      id: `record_revision:journal:${journal.id}`,
      schemaVersion: 1,
      ownerUserId: OWNER_ID,
      entityType: "journal",
      entityId: journal.id,
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

describe("automation undo permanent deletion", () => {
  beforeEach(async () => {
    vi.clearAllMocks();
    localStorage.clear();
    runtime.boundaryCurrent = true;
    runtime.boundaryGeneration = "boundary-a";
    runtime.ownerUserId = OWNER_ID;
    runtime.vaultKey = "vault-key";
    runtime.vaultRevision = 7;
    vi.spyOn(globalThis.crypto, "randomUUID").mockReturnValue(OPERATION_ID);

    await db.open();
    await db.transaction(
      "rw",
      [
        db.journalEntries,
        db.journalPhotos,
        db.journalAudio,
        db.settings,
        db.offlineQueue,
        db.automationTransactions,
        db.automationHistoryMarkers,
        db.automationRemoteEvents,
      ],
      async () => {
        await db.journalEntries.clear();
        await db.journalPhotos.clear();
        await db.journalAudio.clear();
        await db.settings.clear();
        await db.offlineQueue.clear();
        await db.automationTransactions.clear();
        await db.automationHistoryMarkers.clear();
        await db.automationRemoteEvents.clear();
      },
    );
    await setLocalDataOwnerId(OWNER_ID);
    await seedAutomationCreatedJournal();
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

  it("waits for server CAS, then tombstones the created record against stale sync", async () => {
    await expect(
      requestAutomationUndo(TRANSACTION_ID, OWNER_ID, "android-install-1"),
    ).resolves.toEqual({ status: "pending", operationId: OPERATION_ID });

    await expect(db.journalEntries.get(journal.id)).resolves.toEqual(journal);
    await expect(getDeletedJournalEntryIds()).resolves.toEqual(new Set());
    expect(mocks.undoAutomationTransaction).not.toHaveBeenCalled();

    const queued = await db.offlineQueue.get(`automation-undo:${TRANSACTION_ID}`);
    if (!queued) throw new Error("expected durable undo intent");
    await expect(
      processQueuedAutomationUndo(queued.payload, OWNER_ID),
    ).resolves.toEqual({ status: "committed" });

    expect(mocks.undoAutomationTransaction).toHaveBeenCalledWith(
      expect.objectContaining({
        operationId: OPERATION_ID,
        transactionId: TRANSACTION_ID,
        expectedServerSequence: 12,
        expectedHistoryGeneration: 2,
        compensatingMutations: [
          expect.objectContaining({
            entityType: "journal",
            entityId: journal.id,
            operation: "delete",
            before: journalProjection,
            after: null,
            beforeRevisionToken: AFTER_REVISION,
            afterRevisionToken: null,
          }),
        ],
      }),
      OWNER_ID,
    );
    await expect(db.journalEntries.get(journal.id)).resolves.toBeUndefined();
    await expect(getDeletedJournalEntryIds()).resolves.toEqual(new Set([journal.id]));

    const staleUpsert: SyncEvent = {
      id: "77777777-7777-4777-8777-777777777777",
      seq: 1,
      entity_type: "journal",
      entity_id: journal.id,
      op: "upsert",
      payload: { ...journal, updatedAt: 999 },
      device_id: "stale-device",
      created_at: "2026-08-08T00:00:01.000Z",
    };
    await expect(
      applyDelta([staleUpsert], "current-device", { expectedOwnerUserId: OWNER_ID }),
    ).resolves.toBe(0);
    await expect(db.journalEntries.get(journal.id)).resolves.toBeUndefined();
    await expect(getDeletedJournalEntryIds()).resolves.toEqual(new Set([journal.id]));
  });
});

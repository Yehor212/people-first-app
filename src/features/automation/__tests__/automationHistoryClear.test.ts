import { beforeEach, describe, expect, it, vi } from "vitest";

const OWNER_ID = "11111111-1111-4111-8111-111111111111";
const TRANSACTION_ID = "22222222-2222-4222-8222-222222222222";
const CONSENT_EPOCH = "33333333-3333-4333-8333-333333333333";
const REVISION_TOKEN = "44444444-4444-4444-8444-444444444444";
const NEW_TRANSACTION_ID = "55555555-5555-4555-8555-555555555555";
const NEW_CONSENT_EPOCH = "66666666-6666-4666-8666-666666666666";

const runtime = vi.hoisted<{ vaultKey: string | null; vaultRevision: number | null }>(() => ({
  vaultKey: "vault-key",
  vaultRevision: 4,
}));

const mocks = vi.hoisted(() => ({
  purgeAutomationHistory: vi.fn(),
  undoAutomationTransaction: vi.fn(),
  decryptAutomationRevision: vi.fn(),
  validateSyncOwner: vi.fn(),
  broadcastChange: vi.fn(),
  loggerWarn: vi.fn(),
}));

vi.mock("@/lib/logger", () => ({
  logger: {
    log: vi.fn(),
    info: vi.fn(),
    warn: mocks.loggerWarn,
    error: vi.fn(),
    sync: vi.fn(),
    auth: vi.fn(),
  },
}));

vi.mock("../automationCloud", () => ({
  purgeAutomationHistory: mocks.purgeAutomationHistory,
  undoAutomationTransaction: mocks.undoAutomationTransaction,
}));

vi.mock("../revisionCrypto", () => ({
  decryptAutomationRevision: mocks.decryptAutomationRevision,
}));

vi.mock("@/features/journal/journalContentSession", () => ({
  getJournalContentVaultKey: vi.fn(() => runtime.vaultKey),
  getJournalContentVaultRevision: vi.fn(() => runtime.vaultRevision),
}));

vi.mock("@/features/journal/journalSecurityWriteLock", () => ({
  runWithJournalSecurityWriteLock: vi.fn(async (operation: () => unknown) => operation()),
}));

vi.mock("@/storage/sync/syncOwner", () => ({
  validateSyncOwner: mocks.validateSyncOwner,
}));

vi.mock("@/lib/syncBroadcast", () => ({
  broadcastChange: mocks.broadcastChange,
}));

import {
  clearAllAutomationHistory,
  forgetAutomationTransactions,
  reconcilePendingAutomationHistoryPurges,
} from "../automationHistoryClear";
import { hashAutomationValue } from "../canonicalJson";
import { computeAutomationSourceKey } from "../sourceKey";
import { persistPrimaryRecordWithAutomationIntent } from "../automationRepository";
import {
  processQueuedAutomationUndo,
  requestAutomationUndo,
} from "../automationUndo";
import {
  AUTOMATION_PREFERENCE_SETTING_KEY,
  type AutomationRevisionEnvelope,
} from "../types";
import { offlineQueue } from "@/lib/offlineQueue";
import { db, setLocalDataOwnerId } from "@/storage/db";
import { captureOriginAccountBoundaryGeneration } from "@/storage/accountBoundaryRuntime";

function transaction() {
  return {
    kind: "transaction" as const,
    id: TRANSACTION_ID,
    ownerUserId: OWNER_ID,
    consentEpoch: CONSENT_EPOCH,
    sourceKey: `sha256:${"a".repeat(64)}`,
    ruleId: "mood.note-to-journal.v1" as const,
    ruleVersion: 1 as const,
    sourceType: "mood" as const,
    sourceId: "mood-1",
    status: "committed" as const,
    revisionCiphertext: "zenflow:automation-revision:v1:encrypted",
    createdAt: 100,
    updatedAt: 110,
    serverSequence: 12,
    historyGeneration: 2,
    schemaVersion: 1 as const,
  };
}

describe("vault-authorized automation history clear", () => {
  beforeEach(async () => {
    vi.clearAllMocks();
    runtime.vaultKey = "vault-key";
    runtime.vaultRevision = 4;
    mocks.validateSyncOwner.mockResolvedValue(OWNER_ID);
    mocks.decryptAutomationRevision.mockResolvedValue({ schemaVersion: 1 });
    await db.open();
    await db.transaction(
      "rw",
      [
        db.settings,
        db.moods,
        db.journalEntries,
        db.offlineQueue,
        db.deadLetterQueue,
        db.automationTransactions,
        db.automationHistoryMarkers,
        db.automationRemoteEvents,
      ],
      async () => {
        await db.settings.clear();
        await db.moods.clear();
        await db.journalEntries.clear();
        await db.offlineQueue.clear();
        await db.deadLetterQueue.clear();
        await db.automationTransactions.clear();
        await db.automationHistoryMarkers.clear();
        await db.automationRemoteEvents.clear();
      },
    );
    await setLocalDataOwnerId(OWNER_ID);
    await db.automationHistoryMarkers.put({
      schemaVersion: 1,
      ownerUserId: OWNER_ID,
      historyGeneration: 2,
      snapshotSequence: 12,
      lastAppliedServerSequence: 12,
      bootstrapCompletedAt: 90,
      updatedAt: 110,
    });
  });

  it("writes the server tombstone before removing one local ciphertext row", async () => {
    await db.automationTransactions.bulkPut([
      transaction(),
      {
        kind: "record_revision",
        id: "record_revision:journal:journal-1",
        schemaVersion: 1,
        ownerUserId: OWNER_ID,
        entityType: "journal",
        entityId: "journal-1",
        recordExists: true,
        revisionToken: REVISION_TOKEN,
        stateHash: await hashAutomationValue({ id: "journal-1" }),
        mutationGeneration: 1,
        transactionId: TRANSACTION_ID,
        updatedAt: 110,
      },
    ]);
    await db.offlineQueue.put({
      id: `automation-undo:${TRANSACTION_ID}`,
      operationId: REVISION_TOKEN,
      type: "UNDO_AUTOMATION_TRANSACTION",
      entityId: TRANSACTION_ID,
      ownerUserId: OWNER_ID,
      payload: null,
      timestamp: 120,
      retries: 0,
      maxRetries: 5,
    });
    mocks.purgeAutomationHistory.mockImplementationOnce(async (request: { operationId: string }) => {
      expect(await db.automationTransactions.get(TRANSACTION_ID)).toBeDefined();
      return {
        schemaVersion: 1,
        operationId: request.operationId,
        historyGeneration: 2,
        serverSequence: 13,
        completedAt: 130,
        allHistoryPurgedAt: null,
        purgedTransactionIds: [TRANSACTION_ID],
        preference: null,
      };
    });

    await expect(
      forgetAutomationTransactions([TRANSACTION_ID], OWNER_ID, "android-install-1"),
    ).resolves.toEqual({ purged: 1, all: false });

    await expect(db.automationTransactions.get(TRANSACTION_ID)).resolves.toBeUndefined();
    await expect(
      db.automationTransactions.get("record_revision:journal:journal-1"),
    ).resolves.toMatchObject({ transactionId: null, revisionToken: REVISION_TOKEN });
    await expect(db.offlineQueue.get(`automation-undo:${TRANSACTION_ID}`)).resolves.toBeUndefined();
    await expect(db.automationHistoryMarkers.get(OWNER_ID)).resolves.toMatchObject({
      historyGeneration: 2,
      snapshotSequence: 13,
      lastAppliedServerSequence: 13,
      purgedTransactionIds: [TRANSACTION_ID],
    });
    expect(mocks.broadcastChange).toHaveBeenCalledWith("automation", 13);
  });

  it("keeps a purge receipt pending until every preceding server sequence is applied", async () => {
    await db.automationTransactions.put(transaction());
    mocks.purgeAutomationHistory.mockImplementation(async (request: { operationId: string }) => ({
      schemaVersion: 1,
      operationId: request.operationId,
      historyGeneration: 2,
      serverSequence: 14,
      completedAt: 140,
      allHistoryPurgedAt: null,
      purgedTransactionIds: [TRANSACTION_ID],
      preference: null,
    }));

    await expect(
      forgetAutomationTransactions([TRANSACTION_ID], OWNER_ID, "android-install-1"),
    ).resolves.toEqual({ purged: 1, all: false });

    await expect(db.automationTransactions.get(TRANSACTION_ID)).resolves.toBeUndefined();
    await expect(db.automationHistoryMarkers.get(OWNER_ID)).resolves.toMatchObject({
      lastAppliedServerSequence: 12,
    });
    await expect(
      db.automationTransactions.where("kind").equals("purge_pending").count(),
    ).resolves.toBe(1);

    await db.automationHistoryMarkers.update(OWNER_ID, {
      snapshotSequence: 13,
      lastAppliedServerSequence: 13,
      updatedAt: 139,
    });
    await expect(db.automationHistoryMarkers.get(OWNER_ID)).resolves.toMatchObject({
      lastAppliedServerSequence: 13,
    });
    const recovery = await reconcilePendingAutomationHistoryPurges(OWNER_ID);
    expect(mocks.loggerWarn).not.toHaveBeenCalled();
    expect(recovery).toEqual({
      reconciled: 1,
      deferred: 0,
    });
    await expect(db.automationHistoryMarkers.get(OWNER_ID)).resolves.toMatchObject({
      lastAppliedServerSequence: 14,
    });
    await expect(
      db.automationTransactions.where("kind").equals("purge_pending").count(),
    ).resolves.toBe(0);
  });

  it("advances generation, disables the local preference and clears every pending ciphertext only after server acceptance", async () => {
    await db.automationTransactions.bulkPut([
      transaction(),
      {
        kind: "record_revision",
        id: "record_revision:journal:journal-1",
        schemaVersion: 1,
        ownerUserId: OWNER_ID,
        entityType: "journal",
        entityId: "journal-1",
        recordExists: true,
        revisionToken: REVISION_TOKEN,
        stateHash: await hashAutomationValue({ id: "journal-1" }),
        mutationGeneration: 1,
        transactionId: TRANSACTION_ID,
        updatedAt: 110,
      },
    ]);
    await db.settings.put({
      key: AUTOMATION_PREFERENCE_SETTING_KEY,
      value: {
        schemaVersion: 1,
        enabled: true,
        serverRevision: 4,
        consentEpoch: CONSENT_EPOCH,
        consentedAt: 80,
        revokedAt: null,
        revocationPending: false,
        enabledRuleIds: ["mood.note-to-journal.v1"],
        focusHabitId: null,
        focusMinimumMinutes: 25,
        planningHabitMappings: {},
        updatedAt: 80,
      },
    });
    mocks.purgeAutomationHistory.mockImplementation(async (request: { operationId: string }) => ({
      schemaVersion: 1,
      operationId: request.operationId,
      historyGeneration: 3,
      serverSequence: 13,
      completedAt: 130,
      allHistoryPurgedAt: 130,
      purgedTransactionIds: [TRANSACTION_ID],
      preference: {
        schemaVersion: 1,
        enabled: false,
        serverRevision: 5,
        consentEpoch: null,
        consentedAt: 80,
        revokedAt: 130,
        revocationPending: false,
        enabledRuleIds: [],
        focusHabitId: null,
        focusMinimumMinutes: 25,
        planningHabitMappings: {},
        updatedAt: 130,
      },
    }));

    await expect(
      clearAllAutomationHistory(OWNER_ID, "android-install-1"),
    ).resolves.toEqual({ purged: 1, all: true });

    await expect(db.automationTransactions.get(TRANSACTION_ID)).resolves.toBeUndefined();
    await expect(
      db.automationTransactions.get("record_revision:journal:journal-1"),
    ).resolves.toMatchObject({ transactionId: null, revisionToken: REVISION_TOKEN });
    await expect(db.automationRemoteEvents.count()).resolves.toBe(0);
    await expect(db.settings.get(AUTOMATION_PREFERENCE_SETTING_KEY)).resolves.toMatchObject({
      value: expect.objectContaining({ enabled: false, serverRevision: 5 }),
    });
    await expect(db.automationHistoryMarkers.get(OWNER_ID)).resolves.toMatchObject({
      historyGeneration: 3,
      allHistoryPurgedAt: 130,
    });
    expect(await db.automationHistoryMarkers.get(OWNER_ID)).not.toHaveProperty(
      "purgedTransactionIds",
    );
  });

  it("compensates an unaccepted optimistic mutation before clear-all removes its ledger and outbox", async () => {
    const journalId = "journal-pending-1";
    const journal = {
      id: journalId,
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
      id: journalId,
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
    const afterHash = await hashAutomationValue(journalProjection);
    const revision: AutomationRevisionEnvelope = {
      schemaVersion: 1,
      transactionId: TRANSACTION_ID,
      ownerUserId: OWNER_ID,
      consentEpoch: CONSENT_EPOCH,
      sourceKey: `sha256:${"a".repeat(64)}`,
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
          entityId: journalId,
          operation: "upsert",
          before: null,
          after: journalProjection,
          beforeHash: await hashAutomationValue(null),
          afterHash,
          beforeRevisionToken: null,
          afterRevisionToken: REVISION_TOKEN,
        },
      ],
      plannedAt: 101,
    };
    await db.journalEntries.put(journal);
    await db.automationTransactions.bulkPut([
      { ...transaction(), status: "commit_pending", serverSequence: undefined, historyGeneration: undefined },
      {
        kind: "record_revision",
        id: `record_revision:journal:${journalId}`,
        schemaVersion: 1,
        ownerUserId: OWNER_ID,
        entityType: "journal",
        entityId: journalId,
        recordExists: true,
        revisionToken: REVISION_TOKEN,
        stateHash: afterHash,
        mutationGeneration: 1,
        transactionId: TRANSACTION_ID,
        updatedAt: 101,
      },
    ]);
    await db.offlineQueue.put({
      id: `automation-commit:${TRANSACTION_ID}`,
      operationId: TRANSACTION_ID,
      type: "COMMIT_AUTOMATION_TRANSACTION",
      entityId: TRANSACTION_ID,
      ownerUserId: OWNER_ID,
      payload: null,
      timestamp: 101,
      retries: 0,
      maxRetries: 5,
    });
    mocks.decryptAutomationRevision.mockResolvedValue(revision);
    mocks.purgeAutomationHistory.mockImplementation(async (request: { operationId: string }) => ({
      schemaVersion: 1,
      operationId: request.operationId,
      historyGeneration: 3,
      serverSequence: 13,
      completedAt: 130,
      allHistoryPurgedAt: 130,
      purgedTransactionIds: [],
      preference: {
        schemaVersion: 1,
        enabled: false,
        serverRevision: 5,
        consentEpoch: null,
        consentedAt: 80,
        revokedAt: 130,
        revocationPending: false,
        enabledRuleIds: [],
        focusHabitId: null,
        focusMinimumMinutes: 25,
        planningHabitMappings: {},
        updatedAt: 130,
      },
    }));

    await expect(clearAllAutomationHistory(OWNER_ID, "android-install-1")).resolves.toEqual({
      purged: 0,
      all: true,
    });

    await expect(db.journalEntries.get(journalId)).resolves.toBeUndefined();
    await expect(db.automationTransactions.get(TRANSACTION_ID)).resolves.toBeUndefined();
    await expect(db.offlineQueue.get(`automation-commit:${TRANSACTION_ID}`)).resolves.toBeUndefined();
    await expect(
      db.automationTransactions.get(`record_revision:journal:${journalId}`),
    ).resolves.toMatchObject({
      recordExists: false,
      revisionToken: null,
      transactionId: null,
    });
  });

  it("retains a pending projection that the server accepted before clear-all", async () => {
    const moodId = "77777777-7777-4777-8777-777777777777";
    const moodProjection = {
      id: moodId,
      mood: "good",
      note: null,
      tags: null,
      date: "2026-08-08",
      timestamp: 100,
      updated_at: 100,
      valence: null,
      log_type: null,
      emotion_tags: null,
      contexts: null,
      emotion: null,
    };
    const afterHash = await hashAutomationValue(moodProjection);
    const revision: AutomationRevisionEnvelope = {
      schemaVersion: 1,
      transactionId: TRANSACTION_ID,
      ownerUserId: OWNER_ID,
      consentEpoch: CONSENT_EPOCH,
      sourceKey: `sha256:${"a".repeat(64)}`,
      ruleId: "journal.mood-to-checkin.v1",
      ruleVersion: 1,
      source: {
        schemaVersion: 1,
        type: "journal",
        id: "journal-source-1",
        revision: "updatedAt:100",
        committedAt: 100,
      },
      mutations: [
        {
          entityType: "mood",
          entityId: moodId,
          operation: "upsert",
          before: null,
          after: moodProjection,
          beforeHash: await hashAutomationValue(null),
          afterHash,
          beforeRevisionToken: null,
          afterRevisionToken: REVISION_TOKEN,
        },
      ],
      plannedAt: 100,
    };
    await db.moods.put({
      id: moodId,
      mood: "good",
      date: "2026-08-08",
      timestamp: 100,
      updatedAt: 100,
    });
    await db.automationTransactions.bulkPut([
      {
        ...transaction(),
        status: "commit_pending",
        ruleId: "journal.mood-to-checkin.v1",
        sourceType: "journal",
        sourceId: "journal-source-1",
        serverSequence: undefined,
        historyGeneration: undefined,
      },
      {
        kind: "record_revision",
        id: `record_revision:mood:${moodId}`,
        schemaVersion: 1,
        ownerUserId: OWNER_ID,
        entityType: "mood",
        entityId: moodId,
        recordExists: true,
        revisionToken: REVISION_TOKEN,
        stateHash: afterHash,
        mutationGeneration: 1,
        transactionId: TRANSACTION_ID,
        updatedAt: 100,
      },
    ]);
    mocks.decryptAutomationRevision.mockResolvedValue(revision);
    mocks.purgeAutomationHistory.mockImplementation(async (request: { operationId: string }) => ({
      schemaVersion: 1,
      operationId: request.operationId,
      historyGeneration: 3,
      serverSequence: 13,
      completedAt: 130,
      allHistoryPurgedAt: 130,
      purgedTransactionIds: [TRANSACTION_ID],
      preference: {
        schemaVersion: 1,
        enabled: false,
        serverRevision: 5,
        consentEpoch: null,
        consentedAt: 80,
        revokedAt: 130,
        revocationPending: false,
        enabledRuleIds: [],
        focusHabitId: null,
        focusMinimumMinutes: 25,
        planningHabitMappings: {},
        updatedAt: 130,
      },
    }));

    await expect(clearAllAutomationHistory(OWNER_ID, "android-install-1")).resolves.toEqual({
      purged: 1,
      all: true,
    });

    await expect(db.moods.get(moodId)).resolves.toMatchObject({ id: moodId, mood: "good" });
    await expect(db.automationTransactions.get(TRANSACTION_ID)).resolves.toBeUndefined();
    await expect(
      db.automationTransactions.get(`record_revision:mood:${moodId}`),
    ).resolves.toMatchObject({ transactionId: null, recordExists: true });
  });

  it("serializes an accepted undo through local reconciliation before clear-all", async () => {
    const journalId = "journal-undo-race";
    const journal = {
      id: journalId,
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
      id: journalId,
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
    const afterHash = await hashAutomationValue(journalProjection);
    const revision: AutomationRevisionEnvelope = {
      schemaVersion: 1,
      transactionId: TRANSACTION_ID,
      ownerUserId: OWNER_ID,
      consentEpoch: CONSENT_EPOCH,
      sourceKey: `sha256:${"a".repeat(64)}`,
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
          entityId: journalId,
          operation: "upsert",
          before: null,
          after: journalProjection,
          beforeHash: await hashAutomationValue(null),
          afterHash,
          beforeRevisionToken: null,
          afterRevisionToken: REVISION_TOKEN,
        },
      ],
      plannedAt: 101,
    };
    await db.journalEntries.put(journal);
    await db.automationTransactions.bulkPut([
      transaction(),
      {
        kind: "record_revision",
        id: `record_revision:journal:${journalId}`,
        schemaVersion: 1,
        ownerUserId: OWNER_ID,
        entityType: "journal",
        entityId: journalId,
        recordExists: true,
        revisionToken: REVISION_TOKEN,
        stateHash: afterHash,
        mutationGeneration: 1,
        transactionId: TRANSACTION_ID,
        updatedAt: 101,
      },
    ]);
    mocks.decryptAutomationRevision.mockResolvedValue(revision);
    const undoRequest = await requestAutomationUndo(
      TRANSACTION_ID,
      OWNER_ID,
      "android-install-1",
    );
    if (undoRequest.status !== "pending") throw new Error("expected pending undo");
    const queueItem = await db.offlineQueue.get(`automation-undo:${TRANSACTION_ID}`);
    if (!queueItem) throw new Error("expected undo outbox");

    let acceptUndo!: (value: unknown) => void;
    mocks.undoAutomationTransaction.mockReturnValueOnce(
      new Promise((resolve) => {
        acceptUndo = resolve;
      }),
    );
    const undo = processQueuedAutomationUndo(queueItem.payload, OWNER_ID);
    await vi.waitFor(() => expect(mocks.undoAutomationTransaction).toHaveBeenCalledOnce());

    mocks.purgeAutomationHistory.mockImplementation(async (request: { operationId: string }) => ({
      schemaVersion: 1,
      operationId: request.operationId,
      historyGeneration: 3,
      serverSequence: 14,
      completedAt: 130,
      allHistoryPurgedAt: 130,
      purgedTransactionIds: [TRANSACTION_ID],
      preference: {
        schemaVersion: 1,
        enabled: false,
        serverRevision: 5,
        consentEpoch: null,
        consentedAt: 80,
        revokedAt: 130,
        revocationPending: false,
        enabledRuleIds: [],
        focusHabitId: null,
        focusMinimumMinutes: 25,
        planningHabitMappings: {},
        updatedAt: 130,
      },
    }));
    const clear = clearAllAutomationHistory(OWNER_ID, "android-install-1");
    await new Promise((resolve) => setTimeout(resolve, 25));
    expect(mocks.purgeAutomationHistory).not.toHaveBeenCalled();

    acceptUndo({
      schemaVersion: 1,
      code: "UNDONE",
      transactionId: TRANSACTION_ID,
      undoTransactionId: undoRequest.operationId,
      serverSequence: 13,
      historyGeneration: 2,
      completedAt: 120,
    });
    await expect(undo).resolves.toEqual({ status: "committed" });
    await expect(clear).resolves.toEqual({ purged: 1, all: true });
    await expect(db.journalEntries.get(journalId)).resolves.toBeUndefined();
    await expect(db.automationTransactions.get(TRANSACTION_ID)).resolves.toBeUndefined();
  });

  it("does not let a delayed accepted clear-all response erase a later consent epoch", async () => {
    await db.automationTransactions.bulkPut([
      transaction(),
      {
        kind: "record_revision",
        id: "record_revision:journal:journal-old",
        schemaVersion: 1,
        ownerUserId: OWNER_ID,
        entityType: "journal",
        entityId: "journal-old",
        recordExists: true,
        revisionToken: REVISION_TOKEN,
        stateHash: await hashAutomationValue({ id: "journal-old" }),
        mutationGeneration: 1,
        transactionId: TRANSACTION_ID,
        updatedAt: 110,
      },
    ]);
    await db.settings.put({
      key: AUTOMATION_PREFERENCE_SETTING_KEY,
      value: {
        schemaVersion: 1,
        enabled: true,
        serverRevision: 4,
        consentEpoch: CONSENT_EPOCH,
        consentedAt: 80,
        revokedAt: null,
        revocationPending: false,
        enabledRuleIds: ["mood.note-to-journal.v1"],
        focusHabitId: null,
        focusMinimumMinutes: 25,
        planningHabitMappings: {},
        updatedAt: 80,
      },
    });
    mocks.purgeAutomationHistory.mockImplementation(async (request: { operationId: string }) => ({
      schemaVersion: 1,
      operationId: request.operationId,
      historyGeneration: 3,
      serverSequence: 13,
      completedAt: 130,
      allHistoryPurgedAt: 130,
      purgedTransactionIds: [TRANSACTION_ID],
      preference: {
        schemaVersion: 1,
        enabled: false,
        serverRevision: 5,
        consentEpoch: null,
        consentedAt: 80,
        revokedAt: 130,
        revocationPending: false,
        enabledRuleIds: [],
        focusHabitId: null,
        focusMinimumMinutes: 25,
        planningHabitMappings: {},
        updatedAt: 130,
      },
    }));
    const discard = vi
      .spyOn(offlineQueue, "discardAutomationHistoryActions")
      .mockImplementationOnce(async () => {
        await db.settings.put({
          key: AUTOMATION_PREFERENCE_SETTING_KEY,
          value: {
            schemaVersion: 1,
            enabled: true,
            serverRevision: 6,
            consentEpoch: NEW_CONSENT_EPOCH,
            consentedAt: 140,
            revokedAt: null,
            revocationPending: false,
            enabledRuleIds: ["mood.note-to-journal.v1"],
            focusHabitId: null,
            focusMinimumMinutes: 25,
            planningHabitMappings: {},
            updatedAt: 140,
          },
        });
        await db.automationHistoryMarkers.put({
          schemaVersion: 1,
          ownerUserId: OWNER_ID,
          historyGeneration: 4,
          snapshotSequence: 14,
          lastAppliedServerSequence: 14,
          bootstrapCompletedAt: 90,
          allHistoryPurgedAt: 140,
          updatedAt: 140,
        });
        await db.automationTransactions.bulkPut([
          {
            ...transaction(),
            id: NEW_TRANSACTION_ID,
            consentEpoch: NEW_CONSENT_EPOCH,
            sourceKey: `sha256:${"b".repeat(64)}`,
            sourceId: "mood-new",
            createdAt: 141,
            updatedAt: 141,
            serverSequence: 15,
            historyGeneration: 4,
          },
          {
            kind: "source_pending",
            id: "source_pending:mood-new",
            schemaVersion: 1,
            ownerUserId: OWNER_ID,
            consentEpoch: NEW_CONSENT_EPOCH,
            accountBoundaryGeneration: "owner-boundary-2",
            source: {
              schemaVersion: 1,
              type: "mood",
              id: "mood-new",
              revision: "updatedAt:141",
              committedAt: 141,
            },
            candidateRuleIds: ["mood.note-to-journal.v1"],
            sourceKey: `sha256:${"c".repeat(64)}`,
            createdAt: 141,
            updatedAt: 141,
          },
        ]);
        return 0;
      });

    try {
      await expect(
        clearAllAutomationHistory(OWNER_ID, "android-install-1"),
      ).resolves.toEqual({ purged: 1, all: true });

      expect(discard).toHaveBeenCalledWith(OWNER_ID, [TRANSACTION_ID], {
        dataWriteLockHeld: true,
      });
      await expect(db.automationTransactions.get(TRANSACTION_ID)).resolves.toBeUndefined();
      await expect(db.automationTransactions.get(NEW_TRANSACTION_ID)).resolves.toBeDefined();
      await expect(
        db.automationTransactions.get("source_pending:mood-new"),
      ).resolves.toBeDefined();
      await expect(
        db.automationTransactions.get("record_revision:journal:journal-old"),
      ).resolves.toMatchObject({ transactionId: null });
      await expect(db.settings.get(AUTOMATION_PREFERENCE_SETTING_KEY)).resolves.toMatchObject({
        value: expect.objectContaining({
          enabled: true,
          serverRevision: 6,
          consentEpoch: NEW_CONSENT_EPOCH,
        }),
      });
      await expect(db.automationHistoryMarkers.get(OWNER_ID)).resolves.toMatchObject({
        historyGeneration: 4,
        lastAppliedServerSequence: 14,
        allHistoryPurgedAt: 140,
      });
    } finally {
      discard.mockRestore();
    }
  });

  it("serializes an old-epoch source write across clear-all and preserves only its primary mood", async () => {
    await db.automationTransactions.put(transaction());
    await db.settings.put({
      key: AUTOMATION_PREFERENCE_SETTING_KEY,
      value: {
        schemaVersion: 1,
        enabled: true,
        serverRevision: 4,
        consentEpoch: CONSENT_EPOCH,
        consentedAt: 80,
        revokedAt: null,
        revocationPending: false,
        enabledRuleIds: ["mood.note-to-journal.v1"],
        focusHabitId: null,
        focusMinimumMinutes: 25,
        planningHabitMappings: {},
        updatedAt: 80,
      },
    });

    let acceptPurge!: () => void;
    mocks.purgeAutomationHistory.mockImplementation(
      (request: { operationId: string }) =>
        new Promise((resolve) => {
          acceptPurge = () =>
            resolve({
              schemaVersion: 1,
              operationId: request.operationId,
              historyGeneration: 3,
              serverSequence: 13,
              completedAt: 130,
              allHistoryPurgedAt: 130,
              purgedTransactionIds: [TRANSACTION_ID],
              preference: {
                schemaVersion: 1,
                enabled: false,
                serverRevision: 5,
                consentEpoch: null,
                consentedAt: 80,
                revokedAt: 130,
                revocationPending: false,
                enabledRuleIds: [],
                focusHabitId: null,
                focusMinimumMinutes: 25,
                planningHabitMappings: {},
                updatedAt: 130,
              },
            });
        }),
    );

    const clear = clearAllAutomationHistory(OWNER_ID, "android-install-1");
    await vi.waitFor(() => expect(mocks.purgeAutomationHistory).toHaveBeenCalledTimes(1));

    const mood = {
      id: "mood-during-purge",
      mood: "good" as const,
      note: "Primary text stays with the user's mood",
      date: "2026-08-08",
      timestamp: 125,
      updatedAt: 125,
    };
    const sourceKey = await computeAutomationSourceKey({
      ownerUserId: OWNER_ID,
      consentEpoch: CONSENT_EPOCH,
      ruleId: "mood.note-to-journal.v1",
      ruleVersion: 1,
      sourceType: "mood",
      sourceId: mood.id,
      sourceRevision: "updatedAt:125",
    });
    const latePrimaryWrite = persistPrimaryRecordWithAutomationIntent(
      mood,
      {
        kind: "source_pending",
        id: `source_pending:${sourceKey}`,
        schemaVersion: 1,
        ownerUserId: OWNER_ID,
        consentEpoch: CONSENT_EPOCH,
        accountBoundaryGeneration: captureOriginAccountBoundaryGeneration(),
        source: {
          schemaVersion: 1,
          type: "mood",
          id: mood.id,
          revision: "updatedAt:125",
          committedAt: 125,
        },
        candidateRuleIds: ["mood.note-to-journal.v1"],
        sourceKey,
        createdAt: 125,
        updatedAt: 125,
      },
      OWNER_ID,
    );

    const completedBeforeServerAcceptance = await Promise.race([
      latePrimaryWrite.then(() => true),
      new Promise<false>((resolve) => setTimeout(() => resolve(false), 50)),
    ]);
    acceptPurge();
    await Promise.all([clear, latePrimaryWrite]);

    expect(completedBeforeServerAcceptance).toBe(false);
    await expect(db.moods.get(mood.id)).resolves.toMatchObject({ id: mood.id });
    await expect(
      db.automationTransactions.get(`source_pending:${sourceKey}`),
    ).resolves.toBeUndefined();
  });

  it("keeps all local history when cloud authorization fails and never calls cloud while locked", async () => {
    await db.automationTransactions.put(transaction());
    mocks.purgeAutomationHistory.mockRejectedValueOnce(new Error("offline"));
    await expect(
      forgetAutomationTransactions([TRANSACTION_ID], OWNER_ID, "android-install-1"),
    ).rejects.toThrow("offline");
    await expect(db.automationTransactions.get(TRANSACTION_ID)).resolves.toBeDefined();

    runtime.vaultKey = null;
    await expect(
      forgetAutomationTransactions([TRANSACTION_ID], OWNER_ID, "android-install-1"),
    ).rejects.toMatchObject({ code: "AUTOMATION_HISTORY_CLEAR_VAULT_LOCKED" });
    expect(mocks.purgeAutomationHistory).toHaveBeenCalledTimes(1);
  });

  it("persists one stable purge receipt before the RPC and resumes it after a post-acceptance crash", async () => {
    await db.automationTransactions.put(transaction());
    const acceptedResult = {
      schemaVersion: 1 as const,
      operationId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
      historyGeneration: 2,
      serverSequence: 13,
      completedAt: 130,
      allHistoryPurgedAt: null,
      purgedTransactionIds: [TRANSACTION_ID],
      preference: null,
    };
    mocks.purgeAutomationHistory.mockImplementation(async (request: { operationId: string }) => ({
      ...acceptedResult,
      operationId: request.operationId,
    }));
    const discard = vi
      .spyOn(offlineQueue, "discardAutomationHistoryActions")
      .mockRejectedValueOnce(new Error("simulated process death after server acceptance"));

    try {
      await expect(
        forgetAutomationTransactions([TRANSACTION_ID], OWNER_ID, "android-install-1"),
      ).rejects.toThrow("simulated process death after server acceptance");

      const receipt = (await db.automationTransactions.toArray()).find(
        (row) => row.kind === "purge_pending",
      );
      expect(receipt).toMatchObject({
        kind: "purge_pending",
        ownerUserId: OWNER_ID,
        transactionIds: [TRANSACTION_ID],
        all: false,
        deviceId: "android-install-1",
        acceptedResult: expect.objectContaining({
          operationId: receipt?.operationId,
          serverSequence: acceptedResult.serverSequence,
        }),
      });
      expect(mocks.purgeAutomationHistory).toHaveBeenCalledWith(
        expect.objectContaining({ operationId: receipt?.operationId }),
        OWNER_ID,
      );

      discard.mockResolvedValue(0);
      const historyModule = await import("../automationHistoryClear");
      const reconcile = (
        historyModule as unknown as {
          reconcilePendingAutomationHistoryPurges?: (
            ownerUserId: string,
          ) => Promise<{ reconciled: number; deferred: number }>;
        }
      ).reconcilePendingAutomationHistoryPurges;
      expect(reconcile).toBeTypeOf("function");
      await expect(reconcile?.(OWNER_ID)).resolves.toEqual({ reconciled: 1, deferred: 0 });

      expect(mocks.purgeAutomationHistory).toHaveBeenCalledTimes(1);
      await expect(db.automationTransactions.get(TRANSACTION_ID)).resolves.toBeUndefined();
      await expect(db.automationTransactions.get(receipt?.id || "missing")).resolves.toBeUndefined();
    } finally {
      discard.mockRestore();
    }
  });

  it("discards an accepted per-item receipt subsumed by a newer all-history generation", async () => {
    const operationId = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
    await db.automationTransactions.put({
      kind: "purge_pending",
      id: `automation-purge:${operationId}`,
      schemaVersion: 1,
      operationId,
      ownerUserId: OWNER_ID,
      transactionIds: [TRANSACTION_ID],
      capturedTransactionIds: [TRANSACTION_ID],
      capturedSourceIntentIds: [],
      all: false,
      deviceId: "android-install-1",
      acceptedResult: {
        schemaVersion: 1,
        operationId,
        historyGeneration: 1,
        serverSequence: 13,
        completedAt: 130,
        allHistoryPurgedAt: null,
        purgedTransactionIds: [TRANSACTION_ID],
        preference: null,
      },
      createdAt: 120,
      updatedAt: 130,
    });
    await db.automationHistoryMarkers.put({
      schemaVersion: 1,
      ownerUserId: OWNER_ID,
      historyGeneration: 2,
      snapshotSequence: 14,
      lastAppliedServerSequence: 14,
      bootstrapCompletedAt: 90,
      allHistoryPurgedAt: 140,
      updatedAt: 140,
    });

    await expect(reconcilePendingAutomationHistoryPurges(OWNER_ID)).resolves.toEqual({
      reconciled: 1,
      deferred: 0,
    });
    await expect(
      db.automationTransactions.get(`automation-purge:${operationId}`),
    ).resolves.toBeUndefined();
    expect(mocks.purgeAutomationHistory).not.toHaveBeenCalled();
  });
});

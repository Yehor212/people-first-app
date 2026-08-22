import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/logger", () => ({
  logger: { log: vi.fn(), warn: vi.fn(), error: vi.fn(), sync: vi.fn(), auth: vi.fn() },
}));

import {
  automationHistoryMarkersRepo,
  automationRemoteEventsRepo,
  automationTransactionsRepo,
  clearLocalUserData,
  db,
} from "@/storage/db";
import type {
  AutomationHistoryMarker,
  AutomationRemoteEvent,
  AutomationSourceIntent,
  AutomationTransactionStoreRow,
} from "@/features/automation/types";
import { AUTOMATION_PREFERENCE_SETTING_KEY } from "@/features/automation/types";

const OWNER_ID = "11111111-1111-4111-8111-111111111111";
const TRANSACTION_ID = "22222222-2222-4222-8222-222222222222";
const CONSENT_EPOCH = "33333333-3333-4333-8333-333333333333";
const SOURCE_KEY = `sha256:${"a".repeat(64)}`;

function sourceIntent(): AutomationSourceIntent {
  return {
    kind: "source_pending",
    id: `source_pending:${SOURCE_KEY}`,
    schemaVersion: 1,
    ownerUserId: OWNER_ID,
    consentEpoch: CONSENT_EPOCH,
    accountBoundaryGeneration: "boundary-a",
    source: {
      schemaVersion: 1,
      type: "mood",
      id: "mood-1",
      revision: "updatedAt:100",
      committedAt: 100,
    },
    candidateRuleIds: ["mood.note-to-journal.v1"],
    sourceKey: SOURCE_KEY,
    createdAt: 100,
    updatedAt: 100,
  };
}

function remoteEvent(): AutomationRemoteEvent {
  return {
    id: "automation-remote-event:aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
    schemaVersion: 1,
    ownerUserId: OWNER_ID,
    syncEventId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
    syncEventSequence: 12,
    transactionId: TRANSACTION_ID,
    historyGeneration: 1,
    serverSequence: 1,
    deliveryKind: "delta",
    transaction: {
      id: TRANSACTION_ID,
      consentEpoch: CONSENT_EPOCH,
      sourceKey: SOURCE_KEY,
      ruleId: "mood.note-to-journal.v1",
      ruleVersion: 1,
      sourceType: "mood",
      sourceId: "mood-1",
      status: "committed",
      revisionCiphertext: "zenflow:automation-revision:v1:encrypted",
      createdAt: 100,
      updatedAt: 100,
      serverSequence: 1,
      historyGeneration: 1,
      schemaVersion: 1,
    },
    receivedAt: 100,
  };
}

function transactionRow(): AutomationTransactionStoreRow {
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
    status: "commit_pending",
    revisionCiphertext: "zenflow:automation-revision:v1:encrypted",
    createdAt: 100,
    updatedAt: 100,
    schemaVersion: 1,
  };
}

function historyMarker(): AutomationHistoryMarker {
  return {
    schemaVersion: 1,
    ownerUserId: OWNER_ID,
    historyGeneration: 1,
    snapshotSequence: 0,
    lastAppliedServerSequence: 0,
    bootstrapCompletedAt: null,
    updatedAt: 100,
  };
}

describe("Dexie v11 automation stores", () => {
  beforeEach(async () => {
    await db.open();
    await db.transaction(
      "rw",
      [db.automationTransactions, db.automationHistoryMarkers, db.automationRemoteEvents],
      async () => {
        await db.automationTransactions.clear();
        await db.automationHistoryMarkers.clear();
        await db.automationRemoteEvents.clear();
      },
    );
  });

  it("defines account-bound transaction and history-marker stores with replay indexes", () => {
    expect(db.verno).toBe(11);
    expect(db.tables.map((table) => table.name)).toEqual(
      expect.arrayContaining([
        "automationTransactions",
        "automationHistoryMarkers",
        "automationRemoteEvents",
      ]),
    );

    const transactionIndexes = db.automationTransactions.schema.indexes.map(
      (index) => index.name,
    );
    expect(transactionIndexes).toEqual(
      expect.arrayContaining([
        "ownerUserId",
        "kind",
        "status",
        "sourceKey",
        "createdAt",
        "serverSequence",
        "[ownerUserId+sourceKey]",
        "[ownerUserId+status]",
        "[ownerUserId+serverSequence]",
      ]),
    );
    expect(db.automationHistoryMarkers.schema.primKey.name).toBe("ownerUserId");
    expect(db.automationRemoteEvents.schema.indexes.map((index) => index.name)).toEqual(
      expect.arrayContaining([
        "ownerUserId",
        "syncEventSequence",
        "transactionId",
        "historyGeneration",
        "serverSequence",
        "[ownerUserId+historyGeneration+serverSequence]",
      ]),
    );
  });

  it("persists source_pending and encrypted transaction rows through typed repositories", async () => {
    await automationTransactionsRepo.bulkPut([sourceIntent(), transactionRow()]);

    await expect(automationTransactionsRepo.get(sourceIntent().id)).resolves.toEqual(
      sourceIntent(),
    );
    await expect(automationTransactionsRepo.get(TRANSACTION_ID)).resolves.toEqual(
      transactionRow(),
    );
  });

  it("persists one owner marker for ordered bootstrap and purge fencing", async () => {
    await automationHistoryMarkersRepo.put(historyMarker());

    await expect(automationHistoryMarkersRepo.get(OWNER_ID)).resolves.toEqual(historyMarker());
  });

  it("clears automation rows and markers at sign-out/account switch", async () => {
    await automationTransactionsRepo.bulkPut([sourceIntent(), transactionRow()]);
    await automationHistoryMarkersRepo.put(historyMarker());
    await automationRemoteEventsRepo.put(remoteEvent());
    await db.settings.put({
      key: AUTOMATION_PREFERENCE_SETTING_KEY,
      value: { schemaVersion: 1, enabled: false, serverRevision: 1 },
    });

    await clearLocalUserData();

    await expect(automationTransactionsRepo.count()).resolves.toBe(0);
    await expect(automationHistoryMarkersRepo.count()).resolves.toBe(0);
    await expect(automationRemoteEventsRepo.count()).resolves.toBe(0);
    await expect(db.settings.get(AUTOMATION_PREFERENCE_SETTING_KEY)).resolves.toBeUndefined();
  });

  it("recreates v11 without retaining automation rows when transactional cleanup fails", async () => {
    await automationTransactionsRepo.put(transactionRow());
    await automationHistoryMarkersRepo.put(historyMarker());
    await automationRemoteEventsRepo.put(remoteEvent());
    const transactionSpy = vi
      .spyOn(db, "transaction")
      .mockRejectedValueOnce(new Error("transactional cleanup failed"));

    try {
      await clearLocalUserData();
    } finally {
      transactionSpy.mockRestore();
    }

    expect(db.verno).toBe(11);
    await expect(automationTransactionsRepo.count()).resolves.toBe(0);
    await expect(automationHistoryMarkersRepo.count()).resolves.toBe(0);
    await expect(automationRemoteEventsRepo.count()).resolves.toBe(0);
  });
});

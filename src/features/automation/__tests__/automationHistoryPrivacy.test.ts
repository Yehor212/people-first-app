import { beforeEach, describe, expect, it, vi } from "vitest";

const OWNER_ID = "11111111-1111-4111-8111-111111111111";
const OTHER_OWNER_ID = "99999999-9999-4999-8999-999999999999";
const TRANSACTION_ID = "22222222-2222-4222-8222-222222222222";
const OTHER_TRANSACTION_ID = "88888888-8888-4888-8888-888888888888";
const CONSENT_EPOCH = "33333333-3333-4333-8333-333333333333";
const AFTER_REVISION = "77777777-7777-4777-8777-777777777777";
const SYNC_EVENT_ID = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const VAULT_KEY = "YXV0b21hdGlvbi10ZXN0LXZhdWx0LWtleS0zMmI="; // gitleaks:allow - synthetic test vault key
const BACKUP_SOURCE_KEY = `sha256:${"a".repeat(64)}`;

const vault = vi.hoisted(() => ({
  key: "YXV0b21hdGlvbi10ZXN0LXZhdWx0LWtleS0zMmI=", // gitleaks:allow - synthetic test vault key
  revision: 7,
}));

vi.mock("@/features/journal/journalContentSession", () => ({
  getJournalContentVaultKey: vi.fn(() => vault.key),
  getJournalContentVaultRevision: vi.fn(() => vault.revision),
}));

vi.mock("@/lib/journalContentSession", () => ({
  getJournalContentVaultKey: vi.fn(() => vault.key),
  consumeJournalReplaceAuthorization: vi.fn(() => true),
}));

vi.mock("@/storage/sync/syncOwner", () => ({
  validateSyncOwner: vi.fn(async (expectedOwnerUserId?: string) =>
    expectedOwnerUserId === OWNER_ID ? OWNER_ID : null,
  ),
}));

import { encryptJournalContent } from "@/features/journal/journalCrypto";
import { SK } from "@/lib/storageKeys";
import { db, setLocalDataOwnerId } from "@/storage/db";
import {
  importBackup,
  type BackupPayloadV4,
} from "@/storage/backup";
import { canonicalizeAutomationValue, hashAutomationValue } from "../canonicalJson";
import { reconcilePendingAutomationEvents } from "../automationRemoteSync";
import {
  AUTOMATION_REVISION_PREFIX,
  decryptAutomationRevision,
  encryptAutomationRevision,
  getAutomationRevisionBinding,
} from "../revisionCrypto";
import { computeAutomationSourceKey } from "../sourceKey";
import {
  automationRemoteEventSchema,
  type AutomationHistoryMarker,
  type AutomationRevisionEnvelope,
  type AutomationTransactionStoreRow,
} from "../types";

const emptyData = {
  moods: [],
  habits: [],
  focusSessions: [],
  gratitudeEntries: [],
  settings: [],
};

function marker(
  historyGeneration: number,
  overrides: Partial<AutomationHistoryMarker> = {},
): AutomationHistoryMarker {
  return {
    schemaVersion: 1,
    ownerUserId: OWNER_ID,
    historyGeneration,
    snapshotSequence: historyGeneration,
    lastAppliedServerSequence: historyGeneration,
    bootstrapCompletedAt: 1,
    updatedAt: historyGeneration,
    purgedTransactionIds: [],
    ...overrides,
  };
}

function backupPayload(
  automationTransactions: BackupPayloadV4["data"]["automationTransactions"],
  automationHistoryMarkers: BackupPayloadV4["data"]["automationHistoryMarkers"],
): BackupPayloadV4 {
  return {
    schemaVersion: 4,
    createdAt: "2026-08-08T00:00:00.000Z",
    deviceId: "privacy-test-device",
    data: {
      ...emptyData,
      automationTransactions,
      automationHistoryMarkers,
    },
  };
}

function backupRevision(
  ownerUserId = OWNER_ID,
  transactionId = TRANSACTION_ID,
): AutomationRevisionEnvelope {
  return {
    schemaVersion: 1,
    transactionId,
    ownerUserId,
    consentEpoch: CONSENT_EPOCH,
    sourceKey: BACKUP_SOURCE_KEY,
    ruleId: "mood.note-to-journal.v1",
    ruleVersion: 1,
    source: {
      schemaVersion: 1,
      type: "mood",
      id: "mood-source-1",
      revision: "updatedAt:100",
      committedAt: 100,
    },
    mutations: [
      {
        entityType: "journal",
        entityId: "journal-derived-1",
        operation: "upsert",
        before: null,
        after: { id: "journal-derived-1", content: "private user-authored text" },
        beforeHash: `sha256:${"0".repeat(64)}`,
        afterHash: `sha256:${"1".repeat(64)}`,
        beforeRevisionToken: null,
        afterRevisionToken: AFTER_REVISION,
      },
    ],
    plannedAt: 100,
  };
}

async function backupRow(options: {
  ownerUserId?: string;
  transactionId?: string;
  historyGeneration?: number;
  serverSequence?: number;
} = {}): Promise<AutomationTransactionStoreRow> {
  const ownerUserId = options.ownerUserId ?? OWNER_ID;
  const transactionId = options.transactionId ?? TRANSACTION_ID;
  const historyGeneration = options.historyGeneration ?? 1;
  const revision = backupRevision(ownerUserId, transactionId);

  return {
    kind: "transaction",
    id: transactionId,
    ownerUserId,
    consentEpoch: CONSENT_EPOCH,
    sourceKey: BACKUP_SOURCE_KEY,
    ruleId: revision.ruleId,
    ruleVersion: revision.ruleVersion,
    sourceType: revision.source.type,
    sourceId: revision.source.id,
    status: "committed",
    revisionCiphertext: await encryptAutomationRevision(revision, VAULT_KEY),
    createdAt: 100,
    updatedAt: 100,
    serverSequence: options.serverSequence ?? historyGeneration,
    historyGeneration,
    schemaVersion: 1,
  };
}

function moodProjection(id: string) {
  return {
    id,
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
}

describe("automation history privacy and anti-resurrection", () => {
  beforeEach(async () => {
    vi.clearAllMocks();
    vault.key = VAULT_KEY;
    vault.revision = 7;
    await db.open();
    await db.transaction(
      "rw",
      [
        db.moods,
        db.settings,
        db.offlineQueue,
        db.automationTransactions,
        db.automationHistoryMarkers,
        db.automationRemoteEvents,
      ],
      async () => {
        await db.moods.clear();
        await db.settings.clear();
        await db.offlineQueue.clear();
        await db.automationTransactions.clear();
        await db.automationHistoryMarkers.clear();
        await db.automationRemoteEvents.clear();
      },
    );
    await setLocalDataOwnerId(OWNER_ID);
    await db.settings.put({
      key: SK.JOURNAL_VAULT_KEY,
      value: { wrappedKey: "owner-bound", updatedAt: 1 },
    });
  });

  it("rejects ciphertext moved to different outer metadata and an outer/inner mismatch", async () => {
    const revision = backupRevision();
    const ciphertext = await encryptAutomationRevision(revision, VAULT_KEY);
    const binding = getAutomationRevisionBinding(revision);

    await expect(
      decryptAutomationRevision(ciphertext, VAULT_KEY, {
        ...binding,
        transactionId: OTHER_TRANSACTION_ID,
      }),
    ).rejects.toThrow();

    const mismatchedOuterBinding = {
      ...binding,
      sourceId: "different-source-id",
    };
    const innerMismatchCiphertext =
      AUTOMATION_REVISION_PREFIX +
      (await encryptJournalContent(
        canonicalizeAutomationValue(revision),
        VAULT_KEY,
        { additionalData: canonicalizeAutomationValue(mismatchedOuterBinding) },
      ));

    await expect(
      decryptAutomationRevision(
        innerMismatchCiphertext,
        VAULT_KEY,
        mismatchedOuterBinding,
      ),
    ).rejects.toThrow();
  });

  it("imports authenticated same-owner ciphertext and rejects cross-owner history atomically", async () => {
    const sameOwner = await backupRow();

    await expect(
      importBackup(backupPayload([sameOwner], [marker(1)]), "merge", {
        expectedOwnerUserId: OWNER_ID,
      }),
    ).resolves.toMatchObject({
      automationTransactions: { added: 1, updated: 0, skipped: 0 },
    });
    await expect(db.automationTransactions.get(TRANSACTION_ID)).resolves.toEqual(sameOwner);

    await db.automationTransactions.clear();
    await db.automationHistoryMarkers.clear();
    const crossOwner = await backupRow({ ownerUserId: OTHER_OWNER_ID });
    await expect(
      importBackup(
        backupPayload(
          [crossOwner],
          [marker(1, { ownerUserId: OTHER_OWNER_ID })],
        ),
        "merge",
        { expectedOwnerUserId: OWNER_ID },
      ),
    ).rejects.toMatchObject({ code: "AUTOMATION_HISTORY_OWNER_MISMATCH" });
    await expect(db.automationTransactions.count()).resolves.toBe(0);
    await expect(db.automationHistoryMarkers.count()).resolves.toBe(0);
  });

  it("preserves a permanent per-item purge fence during same-generation replace", async () => {
    await db.automationHistoryMarkers.put(
      marker(1, {
        snapshotSequence: 2,
        lastAppliedServerSequence: 2,
        purgedTransactionIds: [TRANSACTION_ID],
        updatedAt: 200,
      }),
    );
    const staleRow = await backupRow({ serverSequence: 1 });

    const report = await importBackup(
      backupPayload([staleRow], [marker(1)]),
      "replace",
      { expectedOwnerUserId: OWNER_ID },
    );

    expect(report.automationTransactions).toEqual({ added: 0, updated: 0, skipped: 1 });
    await expect(db.automationTransactions.get(TRANSACTION_ID)).resolves.toBeUndefined();
    await expect(db.automationHistoryMarkers.get(OWNER_ID)).resolves.toMatchObject({
      historyGeneration: 1,
      snapshotSequence: 2,
      lastAppliedServerSequence: 2,
      purgedTransactionIds: [TRANSACTION_ID],
      updatedAt: 200,
    });
  });

  it("rejects an older all-history generation during replace without deleting the local fence", async () => {
    const localMarker = marker(2, {
      snapshotSequence: 2,
      lastAppliedServerSequence: 2,
      allHistoryPurgedAt: 200,
      updatedAt: 200,
    });
    await db.automationHistoryMarkers.put(localMarker);
    const oldGenerationRow = await backupRow({
      historyGeneration: 1,
      serverSequence: 1,
    });

    await expect(
      importBackup(
        backupPayload([oldGenerationRow], [marker(1)]),
        "replace",
        { expectedOwnerUserId: OWNER_ID },
      ),
    ).rejects.toMatchObject({ code: "AUTOMATION_HISTORY_STALE" });

    await expect(db.automationTransactions.get(TRANSACTION_ID)).resolves.toBeUndefined();
    await expect(db.automationHistoryMarkers.get(OWNER_ID)).resolves.toEqual(localMarker);
  });

  it("applies a missing ordered domain event without restoring its purged ciphertext or undo row", async () => {
    const entityId = "55555555-5555-4555-8555-555555555555";
    const sourceRevision = "updatedAt:100";
    const sourceKey = await computeAutomationSourceKey({
      ownerUserId: OWNER_ID,
      consentEpoch: CONSENT_EPOCH,
      ruleId: "journal.mood-to-checkin.v1",
      ruleVersion: 1,
      sourceType: "journal",
      sourceId: "journal-source-1",
      sourceRevision,
    });
    const after = moodProjection(entityId);
    const revision: AutomationRevisionEnvelope = {
      schemaVersion: 1,
      transactionId: TRANSACTION_ID,
      ownerUserId: OWNER_ID,
      consentEpoch: CONSENT_EPOCH,
      sourceKey,
      ruleId: "journal.mood-to-checkin.v1",
      ruleVersion: 1,
      source: {
        schemaVersion: 1,
        type: "journal",
        id: "journal-source-1",
        revision: sourceRevision,
        committedAt: 100,
      },
      mutations: [
        {
          entityType: "mood",
          entityId,
          operation: "upsert",
          before: null,
          after,
          beforeHash: await hashAutomationValue(null),
          afterHash: await hashAutomationValue(after),
          beforeRevisionToken: null,
          afterRevisionToken: AFTER_REVISION,
        },
      ],
      plannedAt: 100,
    };
    const transaction = {
      id: TRANSACTION_ID,
      consentEpoch: CONSENT_EPOCH,
      sourceKey,
      ruleId: revision.ruleId,
      ruleVersion: revision.ruleVersion,
      sourceType: revision.source.type,
      sourceId: revision.source.id,
      status: "committed" as const,
      revisionCiphertext: await encryptAutomationRevision(revision, VAULT_KEY),
      createdAt: 100,
      updatedAt: 100,
      serverSequence: 101,
      historyGeneration: 1,
      schemaVersion: 1 as const,
    };
    await db.automationHistoryMarkers.put(
      marker(1, {
        snapshotSequence: 100,
        lastAppliedServerSequence: 100,
        bootstrapCompletedAt: 90,
        purgedTransactionIds: [TRANSACTION_ID],
        updatedAt: 100,
      }),
    );
    await db.automationRemoteEvents.put(
      automationRemoteEventSchema.parse({
        id: "automation-delta:101",
        schemaVersion: 1,
        ownerUserId: OWNER_ID,
        syncEventId: SYNC_EVENT_ID,
        syncEventSequence: 101,
        transactionId: TRANSACTION_ID,
        historyGeneration: 1,
        serverSequence: 101,
        deliveryKind: "delta",
        transaction,
        receivedAt: 101,
      }),
    );

    await expect(reconcilePendingAutomationEvents(OWNER_ID)).resolves.toEqual({
      applied: 1,
      deferred: 0,
      lastAppliedServerSequence: 101,
    });

    await expect(db.moods.get(entityId)).resolves.toMatchObject({ id: entityId, mood: "good" });
    await expect(db.automationTransactions.get(TRANSACTION_ID)).resolves.toBeUndefined();
    await expect(db.automationHistoryMarkers.get(OWNER_ID)).resolves.toMatchObject({
      lastAppliedServerSequence: 101,
      purgedTransactionIds: [TRANSACTION_ID],
    });
  });
});

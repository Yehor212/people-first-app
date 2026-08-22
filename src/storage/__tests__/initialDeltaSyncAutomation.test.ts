import { beforeEach, describe, expect, it, vi } from "vitest";

const OWNER_ID = "11111111-1111-4111-8111-111111111111";
const TRANSACTION_ID = "22222222-2222-4222-8222-222222222222";
const CONSENT_EPOCH = "33333333-3333-4333-8333-333333333333";
const RECORD_REVISION = "44444444-4444-4444-8444-444444444444";
const MOOD_ID = "55555555-5555-4555-8555-555555555555";
const NEWER_LOCAL_REVISION = "66666666-6666-4666-8666-666666666666";

function indexedUuid(index: number): string {
  return `00000000-0000-4000-8000-${index.toString(16).padStart(12, "0")}`;
}

const runtime = vi.hoisted(() => ({
  ownerUserId: "11111111-1111-4111-8111-111111111111",
  vaultKey: null as string | null,
  vaultRevision: null as number | null,
}));

const mocks = vi.hoisted(() => ({
  decryptAutomationRevision: vi.fn(),
}));

vi.mock("@/storage/sync/syncOwner", () => ({
  validateSyncOwner: vi.fn(async (expected?: string) =>
    !expected || expected === runtime.ownerUserId ? runtime.ownerUserId : null,
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

import { applyAutomationHistorySnapshot } from "@/features/automation/automationBootstrap";
import { reconcilePendingAutomationEvents } from "@/features/automation/automationRemoteSync";
import { hashAutomationValue } from "@/features/automation/canonicalJson";
import { computeAutomationSourceKey } from "@/features/automation/sourceKey";
import type {
  AutomationHistorySnapshot,
  AutomationRevisionEnvelope,
} from "@/features/automation/types";
import { db, setLocalDataOwnerId } from "@/storage/db";

const moodProjection = {
  id: MOOD_ID,
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
} as const;

describe("first 2.1 automation history bootstrap", () => {
  let snapshot: AutomationHistorySnapshot;
  let revision: AutomationRevisionEnvelope;

  beforeEach(async () => {
    vi.clearAllMocks();
    runtime.ownerUserId = OWNER_ID;
    runtime.vaultKey = null;
    runtime.vaultRevision = null;
    await db.open();
    await db.transaction(
      "rw",
      [
        db.moods,
        db.settings,
        db.automationTransactions,
        db.automationHistoryMarkers,
        db.automationRemoteEvents,
      ],
      async () => {
        await db.moods.clear();
        await db.settings.clear();
        await db.automationTransactions.clear();
        await db.automationHistoryMarkers.clear();
        await db.automationRemoteEvents.clear();
      },
    );
    await setLocalDataOwnerId(OWNER_ID);
    await db.moods.put({
      id: MOOD_ID,
      mood: "good",
      date: "2026-08-08",
      timestamp: 100,
      updatedAt: 100,
    });

    const sourceKey = await computeAutomationSourceKey({
      ownerUserId: OWNER_ID,
      consentEpoch: CONSENT_EPOCH,
      ruleId: "journal.mood-to-checkin.v1",
      ruleVersion: 1,
      sourceType: "journal",
      sourceId: "journal-1",
      sourceRevision: "updatedAt:100",
    });
    const afterHash = await hashAutomationValue(moodProjection);
    revision = {
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
        id: "journal-1",
        revision: "updatedAt:100",
        committedAt: 100,
      },
      mutations: [
        {
          entityType: "mood",
          entityId: MOOD_ID,
          operation: "upsert",
          before: null,
          after: moodProjection,
          beforeHash: await hashAutomationValue(null),
          afterHash,
          beforeRevisionToken: null,
          afterRevisionToken: RECORD_REVISION,
        },
      ],
      plannedAt: 100,
    };
    mocks.decryptAutomationRevision.mockResolvedValue(revision);
    snapshot = {
      schemaVersion: 1,
      historyGeneration: 2,
      snapshotSequence: 7,
      tombstones: [],
      transactions: [
        {
          id: TRANSACTION_ID,
          consentEpoch: CONSENT_EPOCH,
          sourceKey,
          ruleId: "journal.mood-to-checkin.v1",
          ruleVersion: 1,
          sourceType: "journal",
          sourceId: "journal-1",
          status: "committed",
          revisionCiphertext: "zenflow:automation-revision:v1:encrypted",
          createdAt: 100,
          updatedAt: 100,
          serverSequence: 7,
          historyGeneration: 2,
          schemaVersion: 1,
        },
      ],
      recordRevisions: [
        {
          entityType: "mood",
          entityId: MOOD_ID,
          recordExists: true,
          revisionToken: RECORD_REVISION,
          stateHash: afterHash,
          mutationGeneration: 1,
          transactionId: TRANSACTION_ID,
          updatedAt: 100,
        },
      ],
    };
  });

  it("retains a locked snapshot independently of the legacy cursor and adopts exact server revisions after unlock", async () => {
    await expect(applyAutomationHistorySnapshot(snapshot, OWNER_ID, 120)).resolves.toEqual({
      status: "accepted",
      deferred: 1,
      lastAppliedServerSequence: 0,
    });
    await expect(db.automationRemoteEvents.count()).resolves.toBe(1);
    await expect(db.automationHistoryMarkers.get(OWNER_ID)).resolves.toMatchObject({
      historyGeneration: 2,
      snapshotSequence: 7,
      lastAppliedServerSequence: 0,
      bootstrapCompletedAt: 120,
    });

    runtime.vaultKey = "vault-key";
    runtime.vaultRevision = 8;
    await expect(reconcilePendingAutomationEvents(OWNER_ID)).resolves.toEqual({
      applied: 1,
      deferred: 0,
      lastAppliedServerSequence: 7,
    });
    await expect(db.automationTransactions.get(TRANSACTION_ID)).resolves.toMatchObject({
      status: "committed",
      serverSequence: 7,
    });
    await expect(db.automationRemoteEvents.count()).resolves.toBe(0);
  });

  it("persists more than 2048 paged purge tombstones without losing the anti-resurrection fence", async () => {
    const tombstones = Array.from({ length: 2_049 }, (_, index) => ({
      transactionId: indexedUuid(index + 100),
      purgedAt: index + 1,
      serverSequence: index + 1,
    }));

    await expect(
      applyAutomationHistorySnapshot(
        {
          schemaVersion: 1,
          historyGeneration: 2,
          snapshotSequence: 3_000,
          tombstones,
          transactions: [],
          recordRevisions: [],
        },
        OWNER_ID,
        3_001,
      ),
    ).resolves.toEqual({
      status: "accepted",
      deferred: 0,
      lastAppliedServerSequence: 3_000,
    });
    const marker = await db.automationHistoryMarkers.get(OWNER_ID);
    expect(marker?.purgedTransactionIds).toHaveLength(2_049);
    expect(marker?.purgedTransactionIds?.[2_048]).toBe(
      tombstones[2_048].transactionId,
    );
  });

  it("rejects a stale generation and atomically rejects a mismatched domain projection", async () => {
    await db.automationHistoryMarkers.put({
      schemaVersion: 1,
      ownerUserId: OWNER_ID,
      historyGeneration: 3,
      snapshotSequence: 9,
      lastAppliedServerSequence: 9,
      bootstrapCompletedAt: 110,
      updatedAt: 110,
    });
    await expect(applyAutomationHistorySnapshot(snapshot, OWNER_ID, 120)).rejects.toMatchObject({
      code: "AUTOMATION_BOOTSTRAP_STALE",
    });

    await db.automationHistoryMarkers.clear();
    await db.moods.put({
      id: MOOD_ID,
      mood: "bad",
      date: "2026-08-08",
      timestamp: 200,
      updatedAt: 200,
    });
    await expect(applyAutomationHistorySnapshot(snapshot, OWNER_ID, 121)).rejects.toMatchObject({
      code: "AUTOMATION_BOOTSTRAP_TARGET_MISMATCH",
    });
    await expect(db.automationHistoryMarkers.get(OWNER_ID)).resolves.toBeUndefined();
    await expect(db.automationRemoteEvents.count()).resolves.toBe(0);
  });

  it("applies the authoritative per-item tombstone before forgetting ciphertext", async () => {
    await db.automationTransactions.put({
      kind: "transaction",
      id: TRANSACTION_ID,
      ownerUserId: OWNER_ID,
      consentEpoch: CONSENT_EPOCH,
      sourceKey: snapshot.transactions[0].sourceKey,
      ruleId: "journal.mood-to-checkin.v1",
      ruleVersion: 1,
      sourceType: "journal",
      sourceId: "journal-1",
      status: "committed",
      revisionCiphertext: "zenflow:automation-revision:v1:encrypted",
      createdAt: 100,
      updatedAt: 100,
      serverSequence: 7,
      historyGeneration: 2,
      schemaVersion: 1,
    });

    await expect(
      applyAutomationHistorySnapshot(
        {
          ...snapshot,
          transactions: [],
          recordRevisions: [],
          tombstones: [
            { transactionId: TRANSACTION_ID, purgedAt: 120, serverSequence: 7 },
          ],
        },
        OWNER_ID,
        120,
      ),
    ).resolves.toEqual({
      status: "accepted",
      deferred: 0,
      lastAppliedServerSequence: 7,
    });
    await expect(db.automationTransactions.get(TRANSACTION_ID)).resolves.toBeUndefined();
    await expect(db.automationHistoryMarkers.get(OWNER_ID)).resolves.toMatchObject({
      purgedTransactionIds: [TRANSACTION_ID],
      lastAppliedServerSequence: 7,
    });
  });

  it("accepts only a tombstone-backed ownership detachment without changing the domain projection", async () => {
    const storedRevision = {
      kind: "record_revision" as const,
      id: `record_revision:mood:${MOOD_ID}`,
      schemaVersion: 1 as const,
      ownerUserId: OWNER_ID,
      ...snapshot.recordRevisions[0],
    };
    await db.automationTransactions.bulkPut([
      {
        kind: "transaction",
        ownerUserId: OWNER_ID,
        ...snapshot.transactions[0],
      },
      storedRevision,
    ]);
    await db.automationHistoryMarkers.put({
      schemaVersion: 1,
      ownerUserId: OWNER_ID,
      historyGeneration: 2,
      snapshotSequence: 7,
      lastAppliedServerSequence: 7,
      bootstrapCompletedAt: 100,
      updatedAt: 100,
    });
    const detachedSnapshot: AutomationHistorySnapshot = {
      ...snapshot,
      snapshotSequence: 8,
      transactions: [],
      tombstones: [
        { transactionId: TRANSACTION_ID, purgedAt: 120, serverSequence: 8 },
      ],
      recordRevisions: [
        { ...snapshot.recordRevisions[0], transactionId: null, updatedAt: 120 },
      ],
    };

    await expect(
      applyAutomationHistorySnapshot(detachedSnapshot, OWNER_ID, 120),
    ).resolves.toMatchObject({ status: "accepted", lastAppliedServerSequence: 8 });
    await expect(db.moods.get(MOOD_ID)).resolves.toMatchObject({ mood: "good" });
    await expect(
      db.automationTransactions.get(`record_revision:mood:${MOOD_ID}`),
    ).resolves.toMatchObject({
      revisionToken: RECORD_REVISION,
      transactionId: null,
      updatedAt: 120,
    });
  });

  it("rejects a generation-advance snapshot that rolls back a newer same-hash local revision", async () => {
    await db.automationTransactions.put({
      kind: "record_revision",
      id: `record_revision:mood:${MOOD_ID}`,
      schemaVersion: 1,
      ownerUserId: OWNER_ID,
      ...snapshot.recordRevisions[0],
      revisionToken: NEWER_LOCAL_REVISION,
      mutationGeneration: 2,
      transactionId: null,
      updatedAt: 110,
    });
    await db.automationHistoryMarkers.put({
      schemaVersion: 1,
      ownerUserId: OWNER_ID,
      historyGeneration: 1,
      snapshotSequence: 6,
      lastAppliedServerSequence: 6,
      bootstrapCompletedAt: 90,
      updatedAt: 110,
    });

    await expect(
      applyAutomationHistorySnapshot(
        {
          ...snapshot,
          transactions: [],
          tombstones: [],
          allHistoryPurgedAt: 120,
          recordRevisions: [
            { ...snapshot.recordRevisions[0], transactionId: null, updatedAt: 120 },
          ],
        },
        OWNER_ID,
        120,
      ),
    ).rejects.toMatchObject({ code: "AUTOMATION_BOOTSTRAP_TARGET_MISMATCH" });

    await expect(
      db.automationTransactions.get(`record_revision:mood:${MOOD_ID}`),
    ).resolves.toMatchObject({
      revisionToken: NEWER_LOCAL_REVISION,
      mutationGeneration: 2,
      transactionId: null,
    });
  });

  it("allows a generation-advance clear-all to detach unchanged automation ownership", async () => {
    await db.automationTransactions.put({
      kind: "record_revision",
      id: `record_revision:mood:${MOOD_ID}`,
      schemaVersion: 1,
      ownerUserId: OWNER_ID,
      ...snapshot.recordRevisions[0],
    });
    await db.automationHistoryMarkers.put({
      schemaVersion: 1,
      ownerUserId: OWNER_ID,
      historyGeneration: 1,
      snapshotSequence: 6,
      lastAppliedServerSequence: 6,
      bootstrapCompletedAt: 90,
      updatedAt: 100,
    });

    await expect(
      applyAutomationHistorySnapshot(
        {
          ...snapshot,
          transactions: [],
          tombstones: [],
          allHistoryPurgedAt: 120,
          recordRevisions: [
            { ...snapshot.recordRevisions[0], transactionId: null, updatedAt: 120 },
          ],
        },
        OWNER_ID,
        120,
      ),
    ).resolves.toMatchObject({ status: "accepted" });
    await expect(
      db.automationTransactions.get(`record_revision:mood:${MOOD_ID}`),
    ).resolves.toMatchObject({
      revisionToken: RECORD_REVISION,
      mutationGeneration: 1,
      transactionId: null,
      updatedAt: 120,
    });
  });

  it("rejects ownership detachment when its transaction has no authoritative tombstone", async () => {
    await db.automationTransactions.put({
      kind: "record_revision",
      id: `record_revision:mood:${MOOD_ID}`,
      schemaVersion: 1,
      ownerUserId: OWNER_ID,
      ...snapshot.recordRevisions[0],
    });
    await db.automationHistoryMarkers.put({
      schemaVersion: 1,
      ownerUserId: OWNER_ID,
      historyGeneration: 2,
      snapshotSequence: 7,
      lastAppliedServerSequence: 7,
      bootstrapCompletedAt: 100,
      updatedAt: 100,
    });

    await expect(
      applyAutomationHistorySnapshot(
        {
          ...snapshot,
          snapshotSequence: 8,
          transactions: [],
          tombstones: [],
          recordRevisions: [
            { ...snapshot.recordRevisions[0], transactionId: null, updatedAt: 120 },
          ],
        },
        OWNER_ID,
        120,
      ),
    ).rejects.toMatchObject({ code: "AUTOMATION_BOOTSTRAP_TARGET_MISMATCH" });
  });

  it("preserves a crash-recovery purge receipt across a newer-generation bootstrap", async () => {
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
      createdAt: 110,
      updatedAt: 110,
    });
    await db.automationHistoryMarkers.put({
      schemaVersion: 1,
      ownerUserId: OWNER_ID,
      historyGeneration: 1,
      snapshotSequence: 1,
      lastAppliedServerSequence: 1,
      bootstrapCompletedAt: 100,
      updatedAt: 100,
    });

    await expect(applyAutomationHistorySnapshot(snapshot, OWNER_ID, 120)).resolves.toMatchObject({
      status: "accepted",
    });
    await expect(
      db.automationTransactions.get(`automation-purge:${operationId}`),
    ).resolves.toMatchObject({ kind: "purge_pending", operationId });
  });
});

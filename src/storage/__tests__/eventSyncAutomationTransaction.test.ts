import { beforeEach, describe, expect, it, vi } from "vitest";

const OWNER_ID = "11111111-1111-4111-8111-111111111111";
const TX_100 = "22222222-2222-4222-8222-222222222222";
const TX_101 = "33333333-3333-4333-8333-333333333333";
const EPOCH = "44444444-4444-4444-8444-444444444444";
const LATER_EPOCH = "abababab-abab-4bab-8bab-abababababab";
const REVISION_100 = "55555555-5555-4555-8555-555555555555";
const REVISION_101 = "66666666-6666-4666-8666-666666666666";
const UNDO_ID = "99999999-9999-4999-8999-999999999999";
const PURGE_OPERATION_ID = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
let SOURCE_KEY_100 = `sha256:${"a".repeat(64)}`;
let SOURCE_KEY_101 = `sha256:${"b".repeat(64)}`;

type DeferredSupabaseClient = {
  from: (table: string) => {
    select: () => {
      eq: () => {
        in: () => Promise<{ data: unknown[]; error: null }>;
      };
    };
  };
};

const runtime: {
  ownerUserId: string;
  vaultKey: string | null;
  vaultRevision: number | null;
  supabase: DeferredSupabaseClient | null;
} = vi.hoisted(() => ({
  ownerUserId: "11111111-1111-4111-8111-111111111111",
  vaultKey: null,
  vaultRevision: null,
  supabase: null,
}));

const mocks = vi.hoisted(() => ({
  decryptAutomationRevision: vi.fn(),
  purgeAutomationHistory: vi.fn(),
  triggerDataRefresh: vi.fn(),
}));

vi.mock("@/lib/supabaseClient", () => ({
  get supabase() {
    return runtime.supabase;
  },
  getCurrentUserId: vi.fn(async () => runtime.ownerUserId),
}));

vi.mock("@/storage/sync/syncOwner", () => ({
  validateSyncOwner: vi.fn(async (expected?: string) =>
    !expected || expected === runtime.ownerUserId ? runtime.ownerUserId : null
  ),
  SyncOwnerBoundaryError: class SyncOwnerBoundaryError extends Error {},
}));

vi.mock("@/hooks/useIndexedDB", () => ({
  triggerDataRefresh: mocks.triggerDataRefresh,
}));

vi.mock("@/lib/syncBroadcast", () => ({
  broadcastChange: vi.fn(),
}));

vi.mock("@/lib/offlineQueue", () => ({
  offlineQueue: {
    enqueue: vi.fn(),
    discardAutomationHistoryActions: vi.fn(async () => 0),
  },
}));

vi.mock("@/features/automation/automationCloud", () => ({
  purgeAutomationHistory: mocks.purgeAutomationHistory,
}));

vi.mock("@/features/journal/journalContentSession", () => ({
  getJournalContentVaultKey: vi.fn(() => runtime.vaultKey),
  getJournalContentVaultRevision: vi.fn(() => runtime.vaultRevision),
}));

vi.mock("@/features/automation/revisionCrypto", () => ({
  decryptAutomationRevision: mocks.decryptAutomationRevision,
}));

vi.mock("@/features/journal/journalSecurityWriteLock", () => ({
  runWithJournalSecurityWriteLock: vi.fn(async (operation: () => unknown) => operation()),
}));

import { applyDelta, reconcilePendingAutomationEvents, type SyncEvent } from "@/storage/eventSync";
import { reconcileAutomationRemoteEventsInCurrentTransaction } from "@/features/automation/automationRemoteSync";
import { hashAutomationValue } from "@/features/automation/canonicalJson";
import { computeAutomationSourceKey } from "@/features/automation/sourceKey";
import type {
  AutomationHistorySnapshotTransaction,
  AutomationRevisionEnvelope,
} from "@/features/automation/types";
import { AUTOMATION_LOCAL_REFRESH_SETTING_KEY } from "@/features/automation/types";
import { db, setLocalDataOwnerId } from "@/storage/db";
import { getDeletedMoodIds } from "@/storage/deletionTracker";
import { forgetAutomationTransactions } from "@/features/automation/automationHistoryClear";
import { notifyAccountSessionTransition } from "@/storage/accountBoundaryRuntime";
import { applyAutomationHistorySnapshot } from "@/features/automation/automationBootstrap";

function moodProjection(id: string, mood: "good" | "okay", timestamp: number) {
  return {
    id,
    mood,
    note: null,
    tags: null,
    date: "2026-08-08",
    timestamp,
    updated_at: timestamp,
    valence: null,
    log_type: null,
    emotion_tags: null,
    contexts: null,
    emotion: null,
  };
}

async function revision(
  transactionId: string,
  sourceKey: string,
  sourceId: string,
  entityId: string,
  afterRevisionToken: string,
  timestamp: number,
  mood: "good" | "okay"
): Promise<AutomationRevisionEnvelope> {
  const after = moodProjection(entityId, mood, timestamp);
  return {
    schemaVersion: 1,
    transactionId,
    ownerUserId: OWNER_ID,
    consentEpoch: EPOCH,
    sourceKey,
    ruleId: "journal.mood-to-checkin.v1",
    ruleVersion: 1,
    source: {
      schemaVersion: 1,
      type: "journal",
      id: sourceId,
      revision: `updatedAt:${timestamp}`,
      committedAt: timestamp,
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
        afterRevisionToken,
      },
    ],
    plannedAt: timestamp,
  };
}

function transactionPayload(
  transactionId: string,
  sourceKey: string,
  sourceId: string,
  serverSequence: number,
  timestamp: number
): AutomationHistorySnapshotTransaction {
  return {
    id: transactionId,
    consentEpoch: EPOCH,
    sourceKey,
    ruleId: "journal.mood-to-checkin.v1",
    ruleVersion: 1,
    sourceType: "journal",
    sourceId,
    status: "committed",
    revisionCiphertext: `zenflow:automation-revision:v1:ciphertext-${transactionId}`,
    createdAt: timestamp,
    updatedAt: timestamp,
    serverSequence,
    historyGeneration: 1,
    schemaVersion: 1,
  };
}

function event(
  eventId: string,
  syncSequence: number,
  payload: AutomationHistorySnapshotTransaction,
  deviceId = "remote-device"
): SyncEvent {
  return {
    id: eventId,
    seq: syncSequence,
    entity_type: "automation_transaction",
    entity_id: payload.id,
    op: "upsert",
    payload: payload as unknown as Record<string, unknown>,
    device_id: deviceId,
    created_at: "2026-08-08T00:00:00.000Z",
  } as unknown as SyncEvent;
}

function purgeEvent(
  eventId: string,
  syncSequence: number,
  payload: Record<string, unknown>
): SyncEvent {
  return {
    id: eventId,
    seq: syncSequence,
    entity_type: "automation_history_purge",
    entity_id: PURGE_OPERATION_ID,
    op: "upsert",
    payload,
    device_id: "remote-device",
    created_at: "2026-08-08T00:00:00.000Z",
  } as unknown as SyncEvent;
}

function moodEvent(
  eventId: string,
  syncSequence: number,
  payload: Record<string, unknown>
): SyncEvent {
  return {
    id: eventId,
    seq: syncSequence,
    entity_type: "mood",
    entity_id: String(payload.id),
    op: "upsert",
    payload,
    device_id: "remote-device",
    created_at: "2026-08-08T00:00:01.000Z",
  } as unknown as SyncEvent;
}

describe("automation transaction event sync", () => {
  let revisions: Map<string, AutomationRevisionEnvelope>;
  let payload100: AutomationHistorySnapshotTransaction;
  let payload101: AutomationHistorySnapshotTransaction;

  beforeEach(async () => {
    vi.clearAllMocks();
    runtime.ownerUserId = OWNER_ID;
    runtime.vaultKey = null;
    runtime.vaultRevision = null;
    runtime.supabase = null;
    await db.open();
    await db.transaction(
      "rw",
      [
        db.moods,
        db.journalEntries,
        db.settings,
        db.offlineQueue,
        db.automationTransactions,
        db.automationHistoryMarkers,
        db.automationRemoteEvents,
      ],
      async () => {
        await db.moods.clear();
        await db.journalEntries.clear();
        await db.settings.clear();
        await db.offlineQueue.clear();
        await db.automationTransactions.clear();
        await db.automationHistoryMarkers.clear();
        await db.automationRemoteEvents.clear();
      }
    );
    await setLocalDataOwnerId(OWNER_ID);
    await db.automationHistoryMarkers.put({
      schemaVersion: 1,
      ownerUserId: OWNER_ID,
      historyGeneration: 1,
      snapshotSequence: 99,
      lastAppliedServerSequence: 99,
      bootstrapCompletedAt: 90,
      updatedAt: 99,
    });

    SOURCE_KEY_100 = await computeAutomationSourceKey({
      ownerUserId: OWNER_ID,
      consentEpoch: EPOCH,
      ruleId: "journal.mood-to-checkin.v1",
      ruleVersion: 1,
      sourceType: "journal",
      sourceId: "journal-100",
      sourceRevision: "updatedAt:100",
    });
    SOURCE_KEY_101 = await computeAutomationSourceKey({
      ownerUserId: OWNER_ID,
      consentEpoch: EPOCH,
      ruleId: "journal.mood-to-checkin.v1",
      ruleVersion: 1,
      sourceType: "journal",
      sourceId: "journal-101",
      sourceRevision: "updatedAt:101",
    });

    const revision100 = await revision(
      TX_100,
      SOURCE_KEY_100,
      "journal-100",
      "77777777-7777-4777-8777-777777777777",
      REVISION_100,
      100,
      "good"
    );
    const revision101 = await revision(
      TX_101,
      SOURCE_KEY_101,
      "journal-101",
      "88888888-8888-4888-8888-888888888888",
      REVISION_101,
      101,
      "okay"
    );
    revisions = new Map([
      [TX_100, revision100],
      [TX_101, revision101],
    ]);
    mocks.decryptAutomationRevision.mockImplementation(
      async (_ciphertext: string, _key: string, binding: { transactionId: string }) => {
        const value = revisions.get(binding.transactionId);
        if (!value) throw new Error("missing revision");
        return value;
      }
    );
    payload100 = transactionPayload(TX_100, SOURCE_KEY_100, "journal-100", 100, 100);
    payload101 = transactionPayload(TX_101, SOURCE_KEY_101, "journal-101", 101, 101);
  });

  it("durably defers locked reversed events, then replays strictly by server sequence", async () => {
    const reversed = [
      event("aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa", 22, payload101),
      event("bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb", 21, payload100),
    ];

    await expect(
      applyDelta(reversed, "current-device", { expectedOwnerUserId: OWNER_ID })
    ).resolves.toBe(0);
    await expect(db.automationRemoteEvents.count()).resolves.toBe(1);
    await expect(db.automationHistoryMarkers.get(OWNER_ID)).resolves.toMatchObject({
      lastAppliedServerSequence: 99,
    });
    await expect(db.settings.get("sync-last-seq")).resolves.toEqual({
      key: "sync-last-seq",
      value: 21,
    });

    runtime.vaultKey = "vault-key";
    runtime.vaultRevision = 7;
    await expect(
      applyDelta(reversed, "current-device", { expectedOwnerUserId: OWNER_ID })
    ).resolves.toBe(2);
    await expect(reconcilePendingAutomationEvents(OWNER_ID)).resolves.toEqual({
      applied: 0,
      deferred: 0,
      lastAppliedServerSequence: 101,
    });
    expect(mocks.triggerDataRefresh).toHaveBeenCalledTimes(1);

    await expect(
      db.moods.bulkGet([
        "77777777-7777-4777-8777-777777777777",
        "88888888-8888-4888-8888-888888888888",
      ])
    ).resolves.toEqual([
      expect.objectContaining({ id: "77777777-7777-4777-8777-777777777777", mood: "good" }),
      expect.objectContaining({ id: "88888888-8888-4888-8888-888888888888", mood: "okay" }),
    ]);
    await expect(db.automationRemoteEvents.count()).resolves.toBe(0);
  });

  it("does not cross a locked automation predecessor inserted while a later batch is fetching", async () => {
    let releaseAudioFetch!: (value: { data: unknown[]; error: null }) => void;
    let markAudioFetchStarted!: () => void;
    const audioFetchStarted = new Promise<void>((resolve) => {
      markAudioFetchStarted = resolve;
    });
    const deferredAudioFetch = new Promise<{ data: unknown[]; error: null }>((resolve) => {
      releaseAudioFetch = resolve;
    });
    runtime.supabase = {
      from: (table: string) => {
        if (table !== "journal_audio") throw new Error(`Unexpected table: ${table}`);
        return {
          select: () => ({
            eq: () => ({
              in: () => {
                markAudioFetchStarted();
                return deferredAudioFetch;
              },
            }),
          }),
        };
      },
    };

    const laterJournal = applyDelta(
      [
        {
          id: "20202020-2020-4020-8020-202020202020",
          seq: 11,
          entity_type: "journal",
          entity_id: "journal-after-locked-automation",
          op: "upsert",
          payload: {
            id: "journal-after-locked-automation",
            date: "2026-08-08",
            title: "Later",
            content: "later event",
            stickers: [],
            photoIds: [],
            audioIds: ["audio-race"],
            tags: [],
            createdAt: 110,
            updatedAt: 110,
          },
          device_id: "remote-device",
          created_at: "2026-08-08T00:00:11.000Z",
        },
      ],
      "current-device",
      { expectedOwnerUserId: OWNER_ID }
    );
    await audioFetchStarted;

    await expect(
      applyDelta(
        [event("10101010-1010-4010-8010-101010101010", 10, payload100)],
        "current-device",
        { expectedOwnerUserId: OWNER_ID }
      )
    ).resolves.toBe(0);
    await expect(db.automationRemoteEvents.count()).resolves.toBe(1);
    await expect(db.settings.get("sync-last-seq")).resolves.toEqual({
      key: "sync-last-seq",
      value: 10,
    });

    releaseAudioFetch({ data: [], error: null });
    await expect(laterJournal).resolves.toBe(0);
    await expect(db.journalEntries.get("journal-after-locked-automation")).resolves.toBeUndefined();
    await expect(db.settings.get("sync-last-seq")).resolves.toEqual({
      key: "sync-last-seq",
      value: 10,
    });
  });

  it("applies an automation predecessor before a later ordinary delta for the same target", async () => {
    runtime.vaultKey = "vault-key";
    runtime.vaultRevision = 7;
    const manualMood = moodProjection("77777777-7777-4777-8777-777777777777", "okay", 200);

    await expect(
      applyDelta(
        [
          event("31313131-3131-4131-8131-313131313131", 40, payload100),
          moodEvent("32323232-3232-4232-8232-323232323232", 41, manualMood),
        ],
        "current-device",
        { expectedOwnerUserId: OWNER_ID }
      )
    ).resolves.toBe(2);

    await expect(db.moods.get("77777777-7777-4777-8777-777777777777")).resolves.toMatchObject({
      mood: "okay",
      updated_at: 200,
    });
    await expect(db.automationTransactions.get(TX_100)).resolves.toMatchObject({
      status: "committed",
    });
    await expect(db.automationRemoteEvents.count()).resolves.toBe(0);
    await expect(db.settings.get("sync-last-seq")).resolves.toEqual({
      key: "sync-last-seq",
      value: 41,
    });
  });

  it("bridges an ordinary manual delta to the exact before revision of the next accepted automation", async () => {
    runtime.vaultKey = "vault-key";
    runtime.vaultRevision = 7;
    const entityId = "77777777-7777-4777-8777-777777777777";
    const manualRevisionToken = "12121212-1212-4212-8212-121212121212";
    const manualMood = moodProjection(entityId, "good", 150);
    const manualMoodEventPayload = {
      id: entityId,
      mood: "good",
      date: "2026-08-08",
      timestamp: 150,
      updatedAt: 150,
    };
    const automatedMood = moodProjection(entityId, "okay", 151);
    const baseRevision = revisions.get(TX_100);
    if (!baseRevision) throw new Error("missing base revision");
    revisions.set(TX_100, {
      ...baseRevision,
      mutations: [
        {
          entityType: "mood",
          entityId,
          operation: "upsert",
          before: manualMood,
          after: automatedMood,
          beforeHash: await hashAutomationValue(manualMood),
          afterHash: await hashAutomationValue(automatedMood),
          beforeRevisionToken: manualRevisionToken,
          afterRevisionToken: REVISION_100,
        },
      ],
      plannedAt: 151,
    });
    payload100 = transactionPayload(TX_100, SOURCE_KEY_100, "journal-100", 100, 151);

    await expect(
      applyDelta(
        [
          moodEvent("51515151-5151-4151-8151-515151515151", 43, manualMoodEventPayload),
          event("52525252-5252-4252-8252-525252525252", 44, payload100),
        ],
        "current-device",
        { expectedOwnerUserId: OWNER_ID }
      )
    ).resolves.toBe(2);

    await expect(db.moods.get(entityId)).resolves.toMatchObject({
      id: entityId,
      mood: "okay",
      timestamp: 151,
      updatedAt: 151,
    });
    await expect(
      db.automationTransactions.get(`record_revision:mood:${entityId}`)
    ).resolves.toMatchObject({
      revisionToken: REVISION_100,
      stateHash: await hashAutomationValue(automatedMood),
      transactionId: TX_100,
    });
    await expect(db.settings.get("sync-last-seq")).resolves.toEqual({
      key: "sync-last-seq",
      value: 44,
    });
  });

  it("rejects a revision bridge when the manual projection differs from the accepted before hash", async () => {
    runtime.vaultKey = "vault-key";
    runtime.vaultRevision = 7;
    const entityId = "77777777-7777-4777-8777-777777777777";
    const expectedBefore = moodProjection(entityId, "good", 150);
    const actualManualMoodEventPayload = {
      id: entityId,
      mood: "okay",
      date: "2026-08-08",
      timestamp: 150,
      updatedAt: 150,
    };
    const automatedMood = moodProjection(entityId, "okay", 151);
    const baseRevision = revisions.get(TX_100);
    if (!baseRevision) throw new Error("missing base revision");
    revisions.set(TX_100, {
      ...baseRevision,
      mutations: [
        {
          entityType: "mood",
          entityId,
          operation: "upsert",
          before: expectedBefore,
          after: automatedMood,
          beforeHash: await hashAutomationValue(expectedBefore),
          afterHash: await hashAutomationValue(automatedMood),
          beforeRevisionToken: "13131313-1313-4313-8313-131313131313",
          afterRevisionToken: REVISION_100,
        },
      ],
      plannedAt: 151,
    });
    payload100 = transactionPayload(TX_100, SOURCE_KEY_100, "journal-100", 100, 151);

    await expect(
      applyDelta(
        [
          moodEvent("53535353-5353-4353-8353-535353535353", 45, actualManualMoodEventPayload),
          event("54545454-5454-4454-8454-545454545454", 46, payload100),
        ],
        "current-device",
        { expectedOwnerUserId: OWNER_ID }
      )
    ).rejects.toThrow("AUTOMATION_REMOTE_TARGET_CONFLICT");

    await expect(db.moods.get(entityId)).resolves.toBeUndefined();
    await expect(db.automationTransactions.get(TX_100)).resolves.toBeUndefined();
    await expect(db.settings.get("sync-last-seq")).resolves.toBeUndefined();
  });

  it("rebases stale local revision metadata from an authoritative snapshot when the projection matches", async () => {
    const entityId = "77777777-7777-4777-8777-777777777777";
    const projection = moodProjection(entityId, "good", 150);
    const stateHash = await hashAutomationValue(projection);
    await db.moods.put({
      id: entityId,
      mood: "good",
      date: "2026-08-08",
      timestamp: 150,
      updatedAt: 150,
    });
    await db.automationTransactions.put({
      kind: "record_revision",
      id: `record_revision:mood:${entityId}`,
      schemaVersion: 1,
      ownerUserId: OWNER_ID,
      entityType: "mood",
      entityId,
      recordExists: true,
      revisionToken: REVISION_101,
      stateHash,
      mutationGeneration: 1,
      transactionId: TX_101,
      updatedAt: 100,
    });

    await expect(
      applyAutomationHistorySnapshot(
        {
          schemaVersion: 1,
          historyGeneration: 1,
          snapshotSequence: 100,
          tombstones: [],
          transactions: [],
          recordRevisions: [
            {
              entityType: "mood",
              entityId,
              recordExists: true,
              revisionToken: "14141414-1414-4414-8414-141414141414",
              stateHash,
              mutationGeneration: 2,
              transactionId: null,
              updatedAt: 150,
            },
          ],
        },
        OWNER_ID,
        151
      )
    ).resolves.toMatchObject({
      status: "accepted",
      deferred: 0,
      lastAppliedServerSequence: 100,
    });
    await expect(
      db.automationTransactions.get(`record_revision:mood:${entityId}`)
    ).resolves.toMatchObject({
      revisionToken: "14141414-1414-4414-8414-141414141414",
      mutationGeneration: 2,
      transactionId: null,
    });
  });

  it("rolls back an ABA-stale remote apply when the account session changes during decrypt", async () => {
    runtime.vaultKey = "vault-key";
    runtime.vaultRevision = 7;
    let releaseDecrypt!: () => void;
    const decryptGate = new Promise<void>((resolve) => {
      releaseDecrypt = resolve;
    });
    mocks.decryptAutomationRevision.mockImplementationOnce(async () => {
      await decryptGate;
      const value = revisions.get(TX_100);
      if (!value) throw new Error("missing revision");
      return value;
    });

    const applying = applyDelta(
      [event("41414141-4141-4141-8141-414141414141", 42, payload100)],
      "current-device",
      { expectedOwnerUserId: OWNER_ID }
    );
    await vi.waitFor(() => expect(mocks.decryptAutomationRevision).toHaveBeenCalledOnce());
    notifyAccountSessionTransition();
    releaseDecrypt();

    await expect(applying).rejects.toThrow(/account boundary|session changed/i);
    await expect(db.moods.count()).resolves.toBe(0);
    await expect(db.automationRemoteEvents.count()).resolves.toBe(0);
    await expect(db.settings.get("sync-last-seq")).resolves.toBeUndefined();
  });

  it("drains each unlocked automation event before the bounded pending buffer can fill", async () => {
    runtime.vaultKey = "vault-key";
    runtime.vaultRevision = 7;
    const events: SyncEvent[] = [];
    for (let index = 0; index < 513; index += 1) {
      const transactionId = `${(index + 1).toString(16).padStart(8, "0")}-0000-4000-8000-000000000000`;
      const sourceId = `journal-capacity-${index}`;
      const entityId = `mood-capacity-${index}`;
      const serverSequence = 100 + index;
      const sourceKey = await computeAutomationSourceKey({
        ownerUserId: OWNER_ID,
        consentEpoch: EPOCH,
        ruleId: "journal.mood-to-checkin.v1",
        ruleVersion: 1,
        sourceType: "journal",
        sourceId,
        sourceRevision: `updatedAt:${serverSequence}`,
      });
      const revisionToken = `${(index + 1).toString(16).padStart(8, "0")}-0001-4000-8000-000000000000`;
      const payload = transactionPayload(
        transactionId,
        sourceKey,
        sourceId,
        serverSequence,
        serverSequence
      );
      revisions.set(transactionId, {
        schemaVersion: 1,
        transactionId,
        ownerUserId: OWNER_ID,
        consentEpoch: EPOCH,
        sourceKey,
        ruleId: "journal.mood-to-checkin.v1",
        ruleVersion: 1,
        source: {
          schemaVersion: 1,
          type: "journal",
          id: sourceId,
          revision: `updatedAt:${serverSequence}`,
          committedAt: serverSequence,
        },
        mutations: [
          {
            entityType: "mood",
            entityId,
            operation: "upsert",
            before: null,
            after: moodProjection(entityId, "good", serverSequence),
            beforeHash: `sha256:${"0".repeat(64)}`,
            afterHash: `sha256:${"0".repeat(64)}`,
            beforeRevisionToken: null,
            afterRevisionToken: revisionToken,
          },
        ],
        plannedAt: serverSequence,
      });
      events.push(
        event(
          `${(index + 1).toString(16).padStart(8, "0")}-0002-4000-8000-000000000000`,
          1_000 + index,
          payload
        )
      );
    }
    for (const value of revisions.values()) {
      for (const mutation of value.mutations) {
        mutation.beforeHash = await hashAutomationValue(mutation.before);
        mutation.afterHash = await hashAutomationValue(mutation.after);
      }
    }

    await expect(
      applyDelta(events, "current-device", { expectedOwnerUserId: OWNER_ID })
    ).resolves.toBe(513);
    await expect(db.automationRemoteEvents.count()).resolves.toBe(0);
    await expect(db.moods.count()).resolves.toBe(513);
    await expect(db.settings.get("sync-last-seq")).resolves.toEqual({
      key: "sync-last-seq",
      value: 1_512,
    });
  }, 30_000);

  it("delivers a durable refresh after bootstrap-like low-level replay preempts the wrapper", async () => {
    const reversed = [
      event("aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa", 22, payload101),
      event("bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb", 21, payload100),
    ];
    await expect(
      applyDelta(reversed, "current-device", { expectedOwnerUserId: OWNER_ID })
    ).resolves.toBe(0);

    runtime.vaultKey = "vault-key";
    runtime.vaultRevision = 7;
    await db.transaction(
      "rw",
      [
        db.moods,
        db.habits,
        db.settings,
        db.journalEntries,
        db.offlineQueue,
        db.automationTransactions,
        db.automationHistoryMarkers,
        db.automationRemoteEvents,
      ],
      async () => {
        await expect(
          reconcileAutomationRemoteEventsInCurrentTransaction(OWNER_ID)
        ).resolves.toMatchObject({ applied: 1, deferred: 0 });
      }
    );
    expect(mocks.triggerDataRefresh).not.toHaveBeenCalled();
    await expect(db.automationRemoteEvents.count()).resolves.toBe(0);
    await expect(db.settings.get(AUTOMATION_LOCAL_REFRESH_SETTING_KEY)).resolves.toMatchObject({
      value: { ownerUserId: OWNER_ID, revision: 1, deliveredRevision: 0 },
    });

    await expect(reconcilePendingAutomationEvents(OWNER_ID)).resolves.toEqual({
      applied: 0,
      deferred: 0,
      lastAppliedServerSequence: 100,
    });
    expect(mocks.triggerDataRefresh).toHaveBeenCalledTimes(1);
    await expect(db.settings.get(AUTOMATION_LOCAL_REFRESH_SETTING_KEY)).resolves.toMatchObject({
      value: { ownerUserId: OWNER_ID, revision: 1, deliveredRevision: 1 },
    });
  });

  it("retries a durable refresh receipt after transient mounted-state refresh rejection", async () => {
    await expect(
      applyDelta(
        [
          event("aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa", 22, payload101),
          event("bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb", 21, payload100),
        ],
        "current-device",
        { expectedOwnerUserId: OWNER_ID }
      )
    ).resolves.toBe(0);
    runtime.vaultKey = "vault-key";
    runtime.vaultRevision = 7;
    mocks.triggerDataRefresh.mockRejectedValueOnce(new Error("refresh listener unavailable"));

    await expect(reconcilePendingAutomationEvents(OWNER_ID)).rejects.toThrow(
      "refresh listener unavailable"
    );
    await expect(db.automationRemoteEvents.count()).resolves.toBe(0);
    await expect(db.settings.get(AUTOMATION_LOCAL_REFRESH_SETTING_KEY)).resolves.toMatchObject({
      value: { ownerUserId: OWNER_ID, revision: 1, deliveredRevision: 0 },
    });

    await expect(reconcilePendingAutomationEvents(OWNER_ID)).resolves.toEqual({
      applied: 0,
      deferred: 0,
      lastAppliedServerSequence: 100,
    });
    expect(mocks.triggerDataRefresh).toHaveBeenCalledTimes(2);
    await expect(db.settings.get(AUTOMATION_LOCAL_REFRESH_SETTING_KEY)).resolves.toMatchObject({
      value: { ownerUserId: OWNER_ID, revision: 1, deliveredRevision: 1 },
    });
  });

  it("does not deliver a stale refresh receipt through a different account", async () => {
    await db.settings.put({
      key: AUTOMATION_LOCAL_REFRESH_SETTING_KEY,
      value: {
        schemaVersion: 1,
        ownerUserId: OWNER_ID,
        revision: 1,
        deliveredRevision: 0,
      },
    });
    const nextOwner = "22222222-2222-4222-8222-222222222221";
    runtime.ownerUserId = nextOwner;
    await setLocalDataOwnerId(nextOwner);

    await expect(reconcilePendingAutomationEvents(nextOwner)).resolves.toEqual({
      applied: 0,
      deferred: 0,
      lastAppliedServerSequence: 0,
    });
    expect(mocks.triggerDataRefresh).not.toHaveBeenCalled();
    await expect(db.settings.get(AUTOMATION_LOCAL_REFRESH_SETTING_KEY)).resolves.toMatchObject({
      value: { ownerUserId: OWNER_ID, revision: 1, deliveredRevision: 0 },
    });
  });

  it("does not acknowledge a refresh receipt after an ABA session transition", async () => {
    await db.settings.put({
      key: AUTOMATION_LOCAL_REFRESH_SETTING_KEY,
      value: {
        schemaVersion: 1,
        ownerUserId: OWNER_ID,
        revision: 1,
        deliveredRevision: 0,
      },
    });
    mocks.triggerDataRefresh.mockImplementationOnce(async () => {
      notifyAccountSessionTransition();
      notifyAccountSessionTransition();
    });

    await expect(reconcilePendingAutomationEvents(OWNER_ID)).rejects.toThrow(
      /account boundary|session changed/i
    );
    expect(mocks.triggerDataRefresh).toHaveBeenCalledTimes(1);
    await expect(db.settings.get(AUTOMATION_LOCAL_REFRESH_SETTING_KEY)).resolves.toMatchObject({
      value: { ownerUserId: OWNER_ID, revision: 1, deliveredRevision: 0 },
    });
  });

  it("consumes the current device's canonical commit event before a later remote transaction", async () => {
    runtime.vaultKey = "vault-key";
    runtime.vaultRevision = 7;
    const localRevision = revisions.get(TX_100);
    if (!localRevision) throw new Error("missing local revision fixture");
    await db.moods.put({
      id: "77777777-7777-4777-8777-777777777777",
      mood: "good",
      date: "2026-08-08",
      timestamp: 100,
      updatedAt: 100,
    });
    await db.automationTransactions.bulkPut([
      {
        kind: "transaction",
        ...payload100,
        ownerUserId: OWNER_ID,
      },
      {
        kind: "record_revision",
        id: "record_revision:mood:77777777-7777-4777-8777-777777777777",
        schemaVersion: 1,
        ownerUserId: OWNER_ID,
        entityType: "mood",
        entityId: "77777777-7777-4777-8777-777777777777",
        recordExists: true,
        revisionToken: REVISION_100,
        stateHash: localRevision.mutations[0].afterHash,
        mutationGeneration: 1,
        transactionId: TX_100,
        updatedAt: 100,
      },
    ]);

    await expect(
      applyDelta(
        [
          event("cdcdcdcd-cdcd-4dcd-8dcd-cdcdcdcdcdcd", 28, payload100, "current-device"),
          event("dededede-dede-4ede-8ede-dededededede", 29, payload101),
        ],
        "current-device",
        { expectedOwnerUserId: OWNER_ID }
      )
    ).resolves.toBe(2);

    await expect(db.automationHistoryMarkers.get(OWNER_ID)).resolves.toMatchObject({
      lastAppliedServerSequence: 101,
    });
    await expect(db.automationTransactions.get(TX_101)).resolves.toMatchObject({
      status: "committed",
      serverSequence: 101,
    });
  });

  it("orders a current-device undo after its missing remote predecessor", async () => {
    runtime.vaultKey = "vault-key";
    runtime.vaultRevision = 7;
    await applyDelta(
      [event("efefefef-efef-4fef-8fef-efefefefefef", 30, payload100)],
      "current-device",
      { expectedOwnerUserId: OWNER_ID }
    );
    await db.moods.delete("77777777-7777-4777-8777-777777777777");
    await db.automationTransactions.put({
      kind: "record_revision",
      id: "record_revision:mood:77777777-7777-4777-8777-777777777777",
      schemaVersion: 1,
      ownerUserId: OWNER_ID,
      entityType: "mood",
      entityId: "77777777-7777-4777-8777-777777777777",
      recordExists: false,
      revisionToken: null,
      stateHash: await hashAutomationValue(null),
      mutationGeneration: 2,
      transactionId: UNDO_ID,
      updatedAt: 102,
    });
    const undonePayload: AutomationHistorySnapshotTransaction = {
      ...payload100,
      status: "undone",
      updatedAt: 102,
      undoneAt: 102,
      undoTransactionId: UNDO_ID,
      serverSequence: 102,
    };
    await db.automationTransactions.put({
      kind: "transaction",
      ...undonePayload,
      ownerUserId: OWNER_ID,
    });
    await expect(db.automationHistoryMarkers.get(OWNER_ID)).resolves.toMatchObject({
      lastAppliedServerSequence: 100,
    });

    await expect(
      applyDelta(
        [
          event("f1f1f1f1-f1f1-41f1-81f1-f1f1f1f1f1f1", 31, payload101),
          event("f2f2f2f2-f2f2-42f2-82f2-f2f2f2f2f2f2", 32, undonePayload, "current-device"),
        ],
        "current-device",
        { expectedOwnerUserId: OWNER_ID }
      )
    ).resolves.toBe(2);

    await expect(db.automationHistoryMarkers.get(OWNER_ID)).resolves.toMatchObject({
      lastAppliedServerSequence: 102,
    });
    await expect(db.automationTransactions.get(TX_100)).resolves.toMatchObject({
      status: "undone",
      serverSequence: 102,
      undoTransactionId: UNDO_ID,
    });
    await expect(db.automationTransactions.get(TX_101)).resolves.toMatchObject({
      status: "committed",
      serverSequence: 101,
    });
  });

  it("acknowledges an exact local commit event without overwriting a newer manual edit", async () => {
    runtime.vaultKey = "vault-key";
    runtime.vaultRevision = 7;
    const manualProjection = moodProjection("77777777-7777-4777-8777-777777777777", "okay", 150);
    await db.moods.put({
      id: "77777777-7777-4777-8777-777777777777",
      mood: "okay",
      date: "2026-08-08",
      timestamp: 150,
      updatedAt: 150,
    });
    await db.automationTransactions.bulkPut([
      {
        kind: "transaction",
        ...payload100,
        ownerUserId: OWNER_ID,
      },
      {
        kind: "record_revision",
        id: "record_revision:mood:77777777-7777-4777-8777-777777777777",
        schemaVersion: 1,
        ownerUserId: OWNER_ID,
        entityType: "mood",
        entityId: "77777777-7777-4777-8777-777777777777",
        recordExists: true,
        revisionToken: "12121212-1212-4212-8212-121212121212",
        stateHash: await hashAutomationValue(manualProjection),
        mutationGeneration: 2,
        transactionId: null,
        updatedAt: 150,
      },
    ]);

    await expect(
      applyDelta(
        [
          event("a3a3a3a3-a3a3-43a3-83a3-a3a3a3a3a3a3", 33, payload100, "current-device"),
          event("a4a4a4a4-a4a4-44a4-84a4-a4a4a4a4a4a4", 34, payload101),
        ],
        "current-device",
        { expectedOwnerUserId: OWNER_ID }
      )
    ).resolves.toBe(2);

    await expect(db.moods.get("77777777-7777-4777-8777-777777777777")).resolves.toMatchObject({
      mood: "okay",
      updatedAt: 150,
    });
    await expect(db.automationHistoryMarkers.get(OWNER_ID)).resolves.toMatchObject({
      lastAppliedServerSequence: 101,
    });
    await expect(db.automationTransactions.get(TX_101)).resolves.toMatchObject({
      status: "committed",
    });
  });

  it("ignores duplicate and stale-generation rows without resurrecting history", async () => {
    runtime.vaultKey = "vault-key";
    runtime.vaultRevision = 7;
    const first = event("cccccccc-cccc-4ccc-8ccc-cccccccccccc", 23, payload100);
    await applyDelta([first], "current-device", { expectedOwnerUserId: OWNER_ID });
    await applyDelta([first], "current-device", { expectedOwnerUserId: OWNER_ID });

    await db.automationHistoryMarkers.put({
      schemaVersion: 1,
      ownerUserId: OWNER_ID,
      historyGeneration: 2,
      snapshotSequence: 100,
      lastAppliedServerSequence: 100,
      bootstrapCompletedAt: 90,
      updatedAt: 101,
    });
    const stalePayload = { ...payload101, historyGeneration: 1 };
    await applyDelta(
      [event("dddddddd-dddd-4ddd-8ddd-dddddddddddd", 24, stalePayload)],
      "current-device",
      { expectedOwnerUserId: OWNER_ID }
    );

    await expect(db.moods.count()).resolves.toBe(1);
    await expect(db.automationRemoteEvents.count()).resolves.toBe(0);
    await expect(db.automationHistoryMarkers.get(OWNER_ID)).resolves.toMatchObject({
      historyGeneration: 2,
      lastAppliedServerSequence: 100,
    });
  });

  it("applies a canonical remote undo and records a permanent local delete tombstone", async () => {
    runtime.vaultKey = "vault-key";
    runtime.vaultRevision = 7;
    await applyDelta(
      [event("eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee", 25, payload100)],
      "current-device",
      { expectedOwnerUserId: OWNER_ID }
    );

    const undonePayload: AutomationHistorySnapshotTransaction = {
      ...payload100,
      status: "undone",
      updatedAt: 102,
      undoneAt: 102,
      undoTransactionId: UNDO_ID,
      serverSequence: 101,
    };
    runtime.vaultKey = null;
    runtime.vaultRevision = null;
    await expect(
      applyDelta(
        [event("ffffffff-ffff-4fff-8fff-ffffffffffff", 26, undonePayload)],
        "current-device",
        { expectedOwnerUserId: OWNER_ID }
      )
    ).resolves.toBe(0);
    runtime.vaultKey = "vault-key";
    runtime.vaultRevision = 7;
    await expect(reconcilePendingAutomationEvents(OWNER_ID)).resolves.toEqual({
      applied: 1,
      deferred: 0,
      lastAppliedServerSequence: 101,
    });

    await expect(db.moods.get("77777777-7777-4777-8777-777777777777")).resolves.toBeUndefined();
    await expect(getDeletedMoodIds()).resolves.toEqual(
      new Set(["77777777-7777-4777-8777-777777777777"])
    );
    await expect(db.automationTransactions.get(TX_100)).resolves.toMatchObject({
      status: "undone",
      undoTransactionId: UNDO_ID,
      serverSequence: 101,
    });
  });

  it("applies a missing predecessor without resurrecting history after an accepted local purge", async () => {
    runtime.vaultKey = "vault-key";
    runtime.vaultRevision = 7;
    await applyDelta(
      [event("abababab-abab-4bab-8bab-abababababab", 26, payload100)],
      "current-device",
      { expectedOwnerUserId: OWNER_ID }
    );
    mocks.purgeAutomationHistory.mockImplementation(async (request: { operationId: string }) => ({
      schemaVersion: 1,
      operationId: request.operationId,
      historyGeneration: 1,
      serverSequence: 102,
      completedAt: 102,
      allHistoryPurgedAt: null,
      purgedTransactionIds: [TX_100],
      preference: null,
    }));

    await expect(
      forgetAutomationTransactions([TX_100], OWNER_ID, "current-device")
    ).resolves.toEqual({ purged: 1, all: false });
    await expect(db.automationTransactions.get(TX_100)).resolves.toBeUndefined();
    await expect(
      db.automationTransactions.where("kind").equals("purge_pending").count()
    ).resolves.toBe(1);
    await expect(db.automationHistoryMarkers.get(OWNER_ID)).resolves.toMatchObject({
      lastAppliedServerSequence: 100,
      purgedTransactionIds: [TX_100],
    });

    const undonePayload: AutomationHistorySnapshotTransaction = {
      ...payload100,
      status: "undone",
      updatedAt: 101,
      undoneAt: 101,
      undoTransactionId: UNDO_ID,
      serverSequence: 101,
    };
    await expect(
      applyDelta(
        [event("bcbcbcbc-bcbc-4cbc-8cbc-bcbcbcbcbcbc", 27, undonePayload)],
        "current-device",
        { expectedOwnerUserId: OWNER_ID }
      )
    ).resolves.toBeGreaterThan(0);

    await expect(db.moods.get("77777777-7777-4777-8777-777777777777")).resolves.toBeUndefined();
    await expect(db.automationTransactions.get(TX_100)).resolves.toBeUndefined();
    await expect(
      db.automationTransactions.where("kind").equals("purge_pending").count()
    ).resolves.toBe(0);
    await expect(db.automationHistoryMarkers.get(OWNER_ID)).resolves.toMatchObject({
      historyGeneration: 1,
      lastAppliedServerSequence: 102,
      purgedTransactionIds: [TX_100],
    });
  });

  it("rolls back every projection, ledger row, pending event and cursor when replay fails", async () => {
    runtime.vaultKey = "vault-key";
    runtime.vaultRevision = 7;
    const originalPut = db.moods.put.bind(db.moods);
    const putSpy = vi
      .spyOn(db.moods, "put")
      .mockImplementationOnce((value, key) => originalPut(value, key))
      .mockRejectedValueOnce(new Error("injected second projection failure"));

    try {
      await expect(
        applyDelta(
          [
            event("12121212-1212-4212-8212-121212121212", 27, payload100),
            event("13131313-1313-4313-8313-131313131313", 28, payload101),
          ],
          "current-device",
          { expectedOwnerUserId: OWNER_ID }
        )
      ).rejects.toThrow("injected second projection failure");
    } finally {
      putSpy.mockRestore();
    }

    await expect(db.moods.count()).resolves.toBe(0);
    await expect(
      db.automationTransactions.where("kind").equals("transaction").count()
    ).resolves.toBe(0);
    await expect(db.automationRemoteEvents.count()).resolves.toBe(0);
    await expect(db.automationHistoryMarkers.get(OWNER_ID)).resolves.toMatchObject({
      lastAppliedServerSequence: 99,
    });
    await expect(db.settings.get("sync-last-seq")).resolves.toBeUndefined();
  });

  it("retains transaction, purge and following transaction in one authoritative order while locked", async () => {
    const payload102 = { ...payload101, serverSequence: 102 };
    const purgePayload = {
      schemaVersion: 1,
      operationId: PURGE_OPERATION_ID,
      historyGeneration: 1,
      serverSequence: 101,
      completedAt: 101,
      allHistoryPurgedAt: null,
      purgedTransactionIds: [TX_100],
      preference: null,
    };

    await expect(
      applyDelta(
        [
          event("14141414-1414-4414-8414-141414141414", 30, payload100),
          purgeEvent("15151515-1515-4515-8515-151515151515", 31, purgePayload),
          event("16161616-1616-4616-8616-161616161616", 32, payload102),
        ],
        "current-device",
        { expectedOwnerUserId: OWNER_ID }
      )
    ).resolves.toBe(0);
    await expect(db.automationRemoteEvents.count()).resolves.toBe(1);
    await expect(db.automationHistoryMarkers.get(OWNER_ID)).resolves.toMatchObject({
      lastAppliedServerSequence: 99,
    });

    runtime.vaultKey = "vault-key";
    runtime.vaultRevision = 7;
    await expect(
      applyDelta(
        [
          event("14141414-1414-4414-8414-141414141414", 30, payload100),
          purgeEvent("15151515-1515-4515-8515-151515151515", 31, purgePayload),
          event("16161616-1616-4616-8616-161616161616", 32, payload102),
        ],
        "current-device",
        { expectedOwnerUserId: OWNER_ID }
      )
    ).resolves.toBe(3);
    await expect(reconcilePendingAutomationEvents(OWNER_ID)).resolves.toEqual({
      applied: 0,
      deferred: 0,
      lastAppliedServerSequence: 102,
    });
    await expect(db.automationTransactions.get(TX_100)).resolves.toBeUndefined();
    await expect(db.automationTransactions.get(TX_101)).resolves.toMatchObject({
      serverSequence: 102,
    });
    await expect(
      db.automationTransactions.get("record_revision:mood:77777777-7777-4777-8777-777777777777")
    ).resolves.toMatchObject({ transactionId: null });
    await expect(db.automationHistoryMarkers.get(OWNER_ID)).resolves.toMatchObject({
      historyGeneration: 1,
      lastAppliedServerSequence: 102,
      purgedTransactionIds: [TX_100],
    });
  });

  it("does not skip an encrypted domain mutation to apply a following clear-all while locked", async () => {
    await expect(
      applyDelta(
        [
          event("20202020-2020-4020-8020-202020202020", 36, payload100),
          purgeEvent("21212121-2121-4121-8121-212121212121", 37, {
            schemaVersion: 1,
            operationId: PURGE_OPERATION_ID,
            historyGeneration: 2,
            serverSequence: 101,
            completedAt: 101,
            allHistoryPurgedAt: 101,
            purgedTransactionIds: [TX_100],
            preference: {
              schemaVersion: 1,
              enabled: false,
              serverRevision: 5,
              consentEpoch: null,
              consentedAt: 80,
              revokedAt: 101,
              revocationPending: false,
              enabledRuleIds: [],
              focusHabitId: null,
              focusMinimumMinutes: 25,
              planningHabitMappings: {},
              updatedAt: 101,
            },
          }),
        ],
        "current-device",
        { expectedOwnerUserId: OWNER_ID }
      )
    ).resolves.toBe(0);

    await expect(db.automationRemoteEvents.count()).resolves.toBe(1);
    await expect(db.automationHistoryMarkers.get(OWNER_ID)).resolves.toMatchObject({
      historyGeneration: 1,
      lastAppliedServerSequence: 99,
    });
    await expect(db.automationTransactions.get(TX_100)).resolves.toBeUndefined();
    await expect(db.moods.get("77777777-7777-4777-8777-777777777777")).resolves.toBeUndefined();

    runtime.vaultKey = "vault-key";
    runtime.vaultRevision = 7;
    await expect(
      applyDelta(
        [
          event("20202020-2020-4020-8020-202020202020", 36, payload100),
          purgeEvent("21212121-2121-4121-8121-212121212121", 37, {
            schemaVersion: 1,
            operationId: PURGE_OPERATION_ID,
            historyGeneration: 2,
            serverSequence: 101,
            completedAt: 101,
            allHistoryPurgedAt: 101,
            purgedTransactionIds: [TX_100],
            preference: {
              schemaVersion: 1,
              enabled: false,
              serverRevision: 5,
              consentEpoch: null,
              consentedAt: 80,
              revokedAt: 101,
              revocationPending: false,
              enabledRuleIds: [],
              focusHabitId: null,
              focusMinimumMinutes: 25,
              planningHabitMappings: {},
              updatedAt: 101,
            },
          }),
        ],
        "current-device",
        { expectedOwnerUserId: OWNER_ID }
      )
    ).resolves.toBe(2);
    await expect(db.automationRemoteEvents.count()).resolves.toBe(0);
    await expect(db.automationTransactions.get(TX_100)).resolves.toBeUndefined();
  });

  it("applies a next-sequence all-history purge while locked and propagates the disabled preference", async () => {
    await db.settings.put({
      key: "zenflow-connected-records-preferences",
      value: {
        schemaVersion: 1,
        enabled: true,
        serverRevision: 4,
        consentEpoch: EPOCH,
        consentedAt: 80,
        revokedAt: null,
        revocationPending: false,
        enabledRuleIds: ["journal.mood-to-checkin.v1"],
        focusHabitId: null,
        focusMinimumMinutes: 25,
        planningHabitMappings: {},
        updatedAt: 80,
      },
    });
    const disabledPreference = {
      schemaVersion: 1,
      enabled: false,
      serverRevision: 5,
      consentEpoch: null,
      consentedAt: 80,
      revokedAt: 100,
      revocationPending: false,
      enabledRuleIds: [],
      focusHabitId: null,
      focusMinimumMinutes: 25,
      planningHabitMappings: {},
      updatedAt: 100,
    };

    await expect(
      applyDelta(
        [
          purgeEvent("17171717-1717-4717-8717-171717171717", 33, {
            schemaVersion: 1,
            operationId: PURGE_OPERATION_ID,
            historyGeneration: 2,
            serverSequence: 100,
            completedAt: 100,
            allHistoryPurgedAt: 100,
            purgedTransactionIds: [],
            preference: disabledPreference,
          }),
        ],
        "current-device",
        { expectedOwnerUserId: OWNER_ID }
      )
    ).resolves.toBe(1);

    await expect(db.settings.get("zenflow-connected-records-preferences")).resolves.toEqual({
      key: "zenflow-connected-records-preferences",
      value: disabledPreference,
    });
    await expect(db.automationHistoryMarkers.get(OWNER_ID)).resolves.toMatchObject({
      historyGeneration: 2,
      lastAppliedServerSequence: 100,
      allHistoryPurgedAt: 100,
    });
    await expect(db.automationRemoteEvents.count()).resolves.toBe(0);
  });

  it("compensates a local unaccepted mutation and discards its outbox on remote clear-all", async () => {
    const pendingMoodId = "77777777-7777-4777-8777-777777777777";
    const pendingProjection = moodProjection(pendingMoodId, "good", 100);
    await db.moods.put({
      id: pendingMoodId,
      mood: "good",
      date: "2026-08-08",
      timestamp: 100,
      updatedAt: 100,
    });
    await db.automationTransactions.bulkPut([
      {
        kind: "transaction",
        ...payload100,
        ownerUserId: OWNER_ID,
        status: "commit_pending",
        serverSequence: undefined,
        historyGeneration: undefined,
      },
      {
        kind: "record_revision",
        id: `record_revision:mood:${pendingMoodId}`,
        schemaVersion: 1,
        ownerUserId: OWNER_ID,
        entityType: "mood",
        entityId: pendingMoodId,
        recordExists: true,
        revisionToken: REVISION_100,
        stateHash: await hashAutomationValue(pendingProjection),
        mutationGeneration: 1,
        transactionId: TX_100,
        updatedAt: 100,
      },
    ]);
    await db.offlineQueue.put({
      id: `automation-commit:${TX_100}`,
      operationId: TX_100,
      type: "COMMIT_AUTOMATION_TRANSACTION",
      entityId: TX_100,
      ownerUserId: OWNER_ID,
      payload: null,
      timestamp: 100,
      retries: 0,
      maxRetries: 5,
    });
    runtime.vaultKey = "vault-key";
    runtime.vaultRevision = 7;

    await expect(
      applyDelta(
        [
          purgeEvent("19191919-1919-4919-8919-191919191919", 35, {
            schemaVersion: 1,
            operationId: PURGE_OPERATION_ID,
            historyGeneration: 2,
            serverSequence: 100,
            completedAt: 100,
            allHistoryPurgedAt: 100,
            purgedTransactionIds: [],
            preference: {
              schemaVersion: 1,
              enabled: false,
              serverRevision: 5,
              consentEpoch: null,
              consentedAt: 80,
              revokedAt: 100,
              revocationPending: false,
              enabledRuleIds: [],
              focusHabitId: null,
              focusMinimumMinutes: 25,
              planningHabitMappings: {},
              updatedAt: 100,
            },
          }),
        ],
        "current-device",
        { expectedOwnerUserId: OWNER_ID }
      )
    ).resolves.toBe(1);

    await expect(db.moods.get(pendingMoodId)).resolves.toBeUndefined();
    await expect(db.automationTransactions.get(TX_100)).resolves.toBeUndefined();
    await expect(db.offlineQueue.get(`automation-commit:${TX_100}`)).resolves.toBeUndefined();
    await expect(
      db.automationTransactions.get(`record_revision:mood:${pendingMoodId}`)
    ).resolves.toMatchObject({
      recordExists: false,
      revisionToken: null,
      transactionId: null,
    });
  });

  it("keeps a newer server preference and later-epoch pending source when an older purge arrives", async () => {
    const newerPreference = {
      schemaVersion: 1,
      enabled: true,
      serverRevision: 6,
      consentEpoch: LATER_EPOCH,
      consentedAt: 140,
      revokedAt: null,
      revocationPending: false,
      enabledRuleIds: ["mood.note-to-journal.v1"],
      focusHabitId: null,
      focusMinimumMinutes: 25,
      planningHabitMappings: {},
      updatedAt: 140,
    };
    await db.settings.put({
      key: "zenflow-connected-records-preferences",
      value: newerPreference,
    });
    await db.automationTransactions.put({
      kind: "source_pending",
      id: "source_pending:later-mood",
      schemaVersion: 1,
      ownerUserId: OWNER_ID,
      consentEpoch: LATER_EPOCH,
      accountBoundaryGeneration: "owner-boundary-2",
      source: {
        schemaVersion: 1,
        type: "mood",
        id: "later-mood",
        revision: "updatedAt:141",
        committedAt: 141,
      },
      candidateRuleIds: ["mood.note-to-journal.v1"],
      sourceKey: `sha256:${"c".repeat(64)}`,
      createdAt: 141,
      updatedAt: 141,
    });
    await db.automationTransactions.bulkPut([
      {
        kind: "transaction",
        id: TX_101,
        ownerUserId: OWNER_ID,
        consentEpoch: LATER_EPOCH,
        sourceKey: `sha256:${"d".repeat(64)}`,
        ruleId: "mood.note-to-journal.v1",
        ruleVersion: 1,
        sourceType: "mood",
        sourceId: "later-mood",
        status: "committed",
        revisionCiphertext: "zenflow:automation-revision:v1:later-ciphertext",
        createdAt: 141,
        updatedAt: 141,
        serverSequence: 101,
        historyGeneration: 2,
        schemaVersion: 1,
      },
      {
        kind: "record_revision",
        id: "record_revision:mood:later-mood",
        schemaVersion: 1,
        ownerUserId: OWNER_ID,
        entityType: "mood",
        entityId: "later-mood",
        recordExists: true,
        revisionToken: REVISION_101,
        stateHash: await hashAutomationValue(moodProjection("later-mood", "good", 141)),
        mutationGeneration: 1,
        transactionId: TX_101,
        updatedAt: 141,
      },
    ]);

    await expect(
      applyDelta(
        [
          purgeEvent("18181818-1818-4818-8818-181818181818", 34, {
            schemaVersion: 1,
            operationId: PURGE_OPERATION_ID,
            historyGeneration: 2,
            serverSequence: 100,
            completedAt: 100,
            allHistoryPurgedAt: 100,
            purgedTransactionIds: [],
            preference: {
              schemaVersion: 1,
              enabled: false,
              serverRevision: 5,
              consentEpoch: null,
              consentedAt: 80,
              revokedAt: 100,
              revocationPending: false,
              enabledRuleIds: [],
              focusHabitId: null,
              focusMinimumMinutes: 25,
              planningHabitMappings: {},
              updatedAt: 100,
            },
          }),
        ],
        "current-device",
        { expectedOwnerUserId: OWNER_ID }
      )
    ).resolves.toBe(1);

    await expect(db.settings.get("zenflow-connected-records-preferences")).resolves.toEqual({
      key: "zenflow-connected-records-preferences",
      value: newerPreference,
    });
    await expect(db.automationTransactions.get("source_pending:later-mood")).resolves.toBeDefined();
    await expect(db.automationTransactions.get(TX_101)).resolves.toBeDefined();
    await expect(
      db.automationTransactions.get("record_revision:mood:later-mood")
    ).resolves.toMatchObject({ transactionId: TX_101 });
  });
});

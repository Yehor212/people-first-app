import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  rpc: vi.fn(),
  validateSyncOwner: vi.fn(),
}));

vi.mock("@/lib/supabaseClient", () => ({
  supabase: { rpc: mocks.rpc },
}));

vi.mock("@/storage/sync/syncOwner", () => ({
  validateSyncOwner: mocks.validateSyncOwner,
}));

import {
  commitAutomationTransaction,
  fetchAutomationHistorySnapshot,
  purgeAutomationHistory,
  undoAutomationTransaction,
} from "../automationCloud";
import type {
  AutomationCommitRequest,
  AutomationUndoRequest,
} from "../types";

const OWNER_ID = "11111111-1111-4111-8111-111111111111";
const TRANSACTION_ID = "22222222-2222-4222-8222-222222222222";
const OPERATION_ID = "33333333-3333-4333-8333-333333333333";
const CONSENT_EPOCH = "44444444-4444-4444-8444-444444444444";
const SOURCE_KEY = `sha256:${"a".repeat(64)}`;
const HASH_BEFORE = `sha256:${"b".repeat(64)}`;
const HASH_AFTER = `sha256:${"c".repeat(64)}`;
const BEFORE_REVISION = "55555555-5555-4555-8555-555555555555";
const AFTER_REVISION = "66666666-6666-4666-8666-666666666666";

function indexedUuid(index: number): string {
  return `00000000-0000-4000-8000-${index.toString(16).padStart(12, "0")}`;
}

function commitRequest(): AutomationCommitRequest {
  return {
    schemaVersion: 1,
    transactionId: TRANSACTION_ID,
    consentEpoch: CONSENT_EPOCH,
    expectedPreferenceRevision: 4,
    expectedHistoryGeneration: 2,
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
    revisionCiphertext: "zenflow:automation-revision:v1:encrypted",
    deviceId: "android-install-1",
    mutations: [
      {
        entityType: "journal",
        entityId: "journal-1",
        operation: "upsert",
        before: { id: "journal-1", content: "before" },
        after: { id: "journal-1", content: "after" },
        beforeHash: HASH_BEFORE,
        afterHash: HASH_AFTER,
        beforeRevisionToken: BEFORE_REVISION,
        afterRevisionToken: AFTER_REVISION,
      },
    ],
    requestedAt: 101,
  };
}

function undoRequest(): AutomationUndoRequest {
  const original = commitRequest().mutations[0];
  return {
    schemaVersion: 1,
    operationId: OPERATION_ID,
    transactionId: TRANSACTION_ID,
    expectedServerSequence: 12,
    expectedHistoryGeneration: 2,
    deviceId: "android-install-1",
    compensatingMutations: [
      {
        ...original,
        before: original.after,
        after: original.before,
        beforeHash: original.afterHash,
        afterHash: original.beforeHash,
        beforeRevisionToken: original.afterRevisionToken,
        afterRevisionToken: OPERATION_ID,
      },
    ],
    requestedAt: 120,
  };
}

describe("automation cloud adapter", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.validateSyncOwner.mockResolvedValue(OWNER_ID);
  });

  it("owner-fences and validates a commit RPC without reshaping its encrypted request", async () => {
    const request = commitRequest();
    const accepted = {
      schemaVersion: 1,
      code: "COMMITTED",
      transactionId: TRANSACTION_ID,
      serverSequence: 12,
      historyGeneration: 2,
      completedAt: 110,
    } as const;
    mocks.rpc.mockResolvedValue({ data: accepted, error: null });

    await expect(commitAutomationTransaction(request, OWNER_ID)).resolves.toEqual(accepted);

    expect(mocks.rpc).toHaveBeenCalledWith("commit_automation_transaction", {
      p_request: request,
    });
    expect(mocks.validateSyncOwner).toHaveBeenCalledTimes(2);
  });

  it("rejects a malformed commit before any cloud call", async () => {
    const malformed = { ...commitRequest(), deviceId: "" };

    await expect(
      commitAutomationTransaction(malformed, OWNER_ID),
    ).rejects.toMatchObject({ code: "AUTOMATION_CLOUD_INVALID_REQUEST" });
    expect(mocks.rpc).not.toHaveBeenCalled();
  });

  it("fails closed on an unknown response or server error with fixed local codes", async () => {
    mocks.rpc.mockResolvedValueOnce({
      data: { code: "COMMITTED", privateText: "must not escape" },
      error: null,
    });
    await expect(
      commitAutomationTransaction(commitRequest(), OWNER_ID),
    ).rejects.toMatchObject({ code: "AUTOMATION_CLOUD_INVALID_RESPONSE" });

    mocks.rpc.mockResolvedValueOnce({
      data: null,
      error: { message: "raw provider detail must not become the thrown message" },
    });
    await expect(
      commitAutomationTransaction(commitRequest(), OWNER_ID),
    ).rejects.toMatchObject({
      code: "AUTOMATION_CLOUD_UNAVAILABLE",
      message: "AUTOMATION_CLOUD_UNAVAILABLE",
    });
  });

  it("validates an exact undo response through the same owner fence", async () => {
    const accepted = {
      schemaVersion: 1,
      code: "UNDONE",
      transactionId: TRANSACTION_ID,
      undoTransactionId: OPERATION_ID,
      serverSequence: 13,
      historyGeneration: 2,
      completedAt: 121,
    } as const;
    mocks.rpc.mockResolvedValue({ data: accepted, error: null });

    await expect(undoAutomationTransaction(undoRequest(), OWNER_ID)).resolves.toEqual(accepted);
    expect(mocks.rpc).toHaveBeenCalledWith("undo_automation_transaction", {
      p_request: undoRequest(),
    });
  });

  it("fetches a snapshot through bounded cursor pages before exposing one strict result", async () => {
    const snapshotToken = {
      historyGeneration: 2,
      snapshotSequence: 12,
      recordRevisionVersion: 7,
    } as const;
    const nextCursor = {
      transactionAfterSequence: 0,
      tombstoneAfterSequence: 12,
      tombstoneAfterTransactionId: TRANSACTION_ID,
      recordRevisionAfterEntityType: null,
      recordRevisionAfterEntityId: null,
      transactionsComplete: true,
      tombstonesComplete: true,
      recordRevisionsComplete: false,
    } as const;
    const snapshot = {
      schemaVersion: 1,
      historyGeneration: 2,
      snapshotSequence: 12,
      allHistoryPurgedAt: 120,
      tombstones: [
        { transactionId: TRANSACTION_ID, purgedAt: 120, serverSequence: 12 },
      ],
      transactions: [],
      recordRevisions: [
        {
          entityType: "journal",
          entityId: "journal-1",
          recordExists: false,
          revisionToken: null,
          stateHash: `sha256:${"0".repeat(64)}`,
          mutationGeneration: 2,
          transactionId: null,
          updatedAt: 120,
        },
      ],
    } as const;
    mocks.rpc
      .mockResolvedValueOnce({
        data: {
          schemaVersion: 2,
          code: "PAGE",
          snapshotToken,
          allHistoryPurgedAt: 120,
          tombstones: snapshot.tombstones,
          transactions: [],
          recordRevisions: [],
          nextCursor,
        },
        error: null,
      })
      .mockResolvedValueOnce({
        data: {
          schemaVersion: 2,
          code: "PAGE",
          snapshotToken,
          allHistoryPurgedAt: 120,
          tombstones: [],
          transactions: [],
          recordRevisions: snapshot.recordRevisions,
          nextCursor: null,
        },
        error: null,
      });

    await expect(fetchAutomationHistorySnapshot(OWNER_ID)).resolves.toEqual(snapshot);
    expect(mocks.rpc).toHaveBeenNthCalledWith(1, "get_automation_history_snapshot", {
      p_snapshot_token: null,
      p_cursor: null,
    });
    expect(mocks.rpc).toHaveBeenNthCalledWith(2, "get_automation_history_snapshot", {
      p_snapshot_token: snapshotToken,
      p_cursor: nextCursor,
    });
  });

  it("restarts pagination when the authoritative snapshot token changes", async () => {
    const firstToken = {
      historyGeneration: 2,
      snapshotSequence: 12,
      recordRevisionVersion: 7,
    } as const;
    const cursor = {
      transactionAfterSequence: 0,
      tombstoneAfterSequence: 0,
      tombstoneAfterTransactionId: null,
      recordRevisionAfterEntityType: "journal",
      recordRevisionAfterEntityId: "journal-1",
      transactionsComplete: true,
      tombstonesComplete: true,
      recordRevisionsComplete: false,
    } as const;
    mocks.rpc
      .mockResolvedValueOnce({
        data: {
          schemaVersion: 2,
          code: "PAGE",
          snapshotToken: firstToken,
          tombstones: [
            { transactionId: TRANSACTION_ID, purgedAt: 120, serverSequence: 12 },
          ],
          transactions: [],
          recordRevisions: [],
          nextCursor: cursor,
        },
        error: null,
      })
      .mockResolvedValueOnce({
        data: { schemaVersion: 2, code: "SNAPSHOT_STALE" },
        error: null,
      })
      .mockResolvedValueOnce({
        data: {
          schemaVersion: 2,
          code: "PAGE",
          snapshotToken: {
            historyGeneration: 3,
            snapshotSequence: 13,
            recordRevisionVersion: 8,
          },
          allHistoryPurgedAt: 130,
          tombstones: [],
          transactions: [],
          recordRevisions: [],
          nextCursor: null,
        },
        error: null,
      });

    await expect(fetchAutomationHistorySnapshot(OWNER_ID)).resolves.toEqual({
      schemaVersion: 1,
      historyGeneration: 3,
      snapshotSequence: 13,
      allHistoryPurgedAt: 130,
      tombstones: [],
      transactions: [],
      recordRevisions: [],
    });
    expect(mocks.rpc).toHaveBeenCalledTimes(3);
  });

  it("accumulates 2049 tombstones and 4097 revisions through bounded pages", async () => {
    const snapshotToken = {
      historyGeneration: 3,
      snapshotSequence: 5_000,
      recordRevisionVersion: 7_000,
    } as const;
    const tombstones = Array.from({ length: 2_049 }, (_, index) => ({
      transactionId: indexedUuid(index + 1),
      purgedAt: index + 1,
      serverSequence: index + 1,
    }));
    const recordRevisions = Array.from({ length: 4_097 }, (_, index) => ({
      entityType: "habit_completion" as const,
      entityId: `habit-${String(index).padStart(5, "0")}:2026-08-08`,
      recordExists: true,
      revisionToken: indexedUuid(index + 10_000),
      stateHash: `sha256:${"a".repeat(64)}`,
      mutationGeneration: 1,
      transactionId: null,
      updatedAt: index + 1,
    }));
    const pageSize = 128;
    const pageCount = Math.ceil(recordRevisions.length / pageSize);

    for (let pageIndex = 0; pageIndex < pageCount; pageIndex += 1) {
      const start = pageIndex * pageSize;
      const end = start + pageSize;
      const tombstonePage = tombstones.slice(start, end);
      const revisionPage = recordRevisions.slice(start, end);
      const lastTombstone = tombstones[Math.min(end, tombstones.length) - 1];
      const lastRevision = recordRevisions[Math.min(end, recordRevisions.length) - 1];
      mocks.rpc.mockResolvedValueOnce({
        data: {
          schemaVersion: 2,
          code: "PAGE",
          snapshotToken,
          tombstones: tombstonePage,
          transactions: [],
          recordRevisions: revisionPage,
          nextCursor:
            pageIndex === pageCount - 1
              ? null
              : {
                  transactionAfterSequence: 0,
                  tombstoneAfterSequence: lastTombstone.serverSequence,
                  tombstoneAfterTransactionId: lastTombstone.transactionId,
                  recordRevisionAfterEntityType: lastRevision.entityType,
                  recordRevisionAfterEntityId: lastRevision.entityId,
                  transactionsComplete: true,
                  tombstonesComplete: end >= tombstones.length,
                  recordRevisionsComplete: end >= recordRevisions.length,
                },
        },
        error: null,
      });
    }

    await expect(fetchAutomationHistorySnapshot(OWNER_ID)).resolves.toMatchObject({
      historyGeneration: 3,
      snapshotSequence: 5_000,
      tombstones,
      recordRevisions,
    });
    expect(mocks.rpc).toHaveBeenCalledTimes(pageCount);
    expect(mocks.rpc.mock.calls[0]?.[1]).toMatchObject({ p_snapshot_token: null });
    for (const [, args] of mocks.rpc.mock.calls.slice(1)) {
      expect(args?.p_snapshot_token).toEqual(snapshotToken);
    }
  });

  it("sends one bounded per-item or all-history purge request", async () => {
    const result = {
      schemaVersion: 1,
      operationId: OPERATION_ID,
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
        consentedAt: 100,
        revokedAt: 130,
        revocationPending: false,
        enabledRuleIds: [],
        focusHabitId: null,
        focusMinimumMinutes: 25,
        planningHabitMappings: {},
        updatedAt: 130,
      },
    } as const;
    mocks.rpc.mockResolvedValue({ data: result, error: null });

    await expect(
      purgeAutomationHistory(
        {
          operationId: OPERATION_ID,
          transactionIds: [TRANSACTION_ID],
          all: false,
          deviceId: "android-install-1",
        },
        OWNER_ID,
      ),
    ).resolves.toEqual(result);
    expect(mocks.rpc).toHaveBeenCalledWith("purge_automation_history", {
      p_operation_id: OPERATION_ID,
      p_transaction_ids: [TRANSACTION_ID],
      p_all: false,
      p_device_id: "android-install-1",
    });
  });
});

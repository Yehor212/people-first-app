import { describe, expect, it } from "vitest";
import {
  AUTOMATION_RULE_IDS,
  automationCommitRequestSchema,
  automationCommitResultSchema,
  automationHistoryMarkerSchema,
  automationHistorySnapshotPageResultSchema,
  automationHistorySnapshotSchema,
  automationUndoRequestSchema,
  automationUndoResultSchema,
} from "../types";

const TRANSACTION_ID = "22222222-2222-4222-8222-222222222222";
const UNDO_TRANSACTION_ID = "33333333-3333-4333-8333-333333333333";
const CONSENT_EPOCH = "44444444-4444-4444-8444-444444444444";
const BEFORE_REVISION = "55555555-5555-4555-8555-555555555555";
const AFTER_REVISION = "66666666-6666-4666-8666-666666666666";
const SOURCE_KEY = `sha256:${"a".repeat(64)}`;
const BEFORE_HASH = `sha256:${"b".repeat(64)}`;
const AFTER_HASH = `sha256:${"c".repeat(64)}`;

function indexedUuid(index: number): string {
  return `00000000-0000-4000-8000-${index.toString(16).padStart(12, "0")}`;
}

const mutation = {
  entityType: "journal",
  entityId: "journal-1",
  operation: "upsert",
  before: { id: "journal-1", content: "before" },
  after: { id: "journal-1", content: "after" },
  beforeHash: BEFORE_HASH,
  afterHash: AFTER_HASH,
  beforeRevisionToken: BEFORE_REVISION,
  afterRevisionToken: AFTER_REVISION,
} as const;

const commitRequest = {
  schemaVersion: 1,
  transactionId: TRANSACTION_ID,
  consentEpoch: CONSENT_EPOCH,
  expectedPreferenceRevision: 7,
  expectedHistoryGeneration: 3,
  sourceKey: SOURCE_KEY,
  ruleId: AUTOMATION_RULE_IDS[0],
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
  mutations: [mutation],
  requestedAt: 101,
} as const;

describe("automation RPC contracts", () => {
  it("accepts one strict owner-derived commit command and rejects caller-supplied ownership", () => {
    expect(automationCommitRequestSchema.parse(commitRequest)).toEqual(commitRequest);
    expect(
      automationCommitRequestSchema.safeParse({
        ...commitRequest,
        ownerUserId: "11111111-1111-4111-8111-111111111111",
      }).success,
    ).toBe(false);
    expect(
      automationCommitRequestSchema.safeParse({
        ...commitRequest,
        source: { ...commitRequest.source, type: "journal" },
      }).success,
    ).toBe(false);
    const { deviceId: _deviceId, ...withoutDeviceId } = commitRequest;
    expect(automationCommitRequestSchema.safeParse(withoutDeviceId).success).toBe(false);
  });

  it("uses fixed commit outcomes and never accepts arbitrary server error prose", () => {
    expect(
      automationCommitResultSchema.parse({
        schemaVersion: 1,
        code: "COMMITTED",
        transactionId: TRANSACTION_ID,
        serverSequence: 12,
        historyGeneration: 3,
        completedAt: 110,
      }),
    ).toMatchObject({ code: "COMMITTED", serverSequence: 12 });

    expect(
      automationCommitResultSchema.safeParse({
        schemaVersion: 1,
        code: "TARGET_REVISION_CONFLICT",
        transactionId: TRANSACTION_ID,
        currentPreferenceRevision: 7,
        historyGeneration: 3,
        message: "journal content leaked here",
      }).success,
    ).toBe(false);
  });

  it("requires an exact all-target undo command and returns idempotent terminal outcomes", () => {
    const request = {
      schemaVersion: 1,
      operationId: UNDO_TRANSACTION_ID,
      transactionId: TRANSACTION_ID,
      expectedServerSequence: 12,
      expectedHistoryGeneration: 3,
      deviceId: "android-install-1",
      compensatingMutations: [
        {
          ...mutation,
          before: mutation.after,
          after: mutation.before,
          beforeHash: mutation.afterHash,
          afterHash: mutation.beforeHash,
          beforeRevisionToken: mutation.afterRevisionToken,
          afterRevisionToken: UNDO_TRANSACTION_ID,
        },
      ],
      requestedAt: 120,
    } as const;

    expect(automationUndoRequestSchema.parse(request)).toEqual(request);
    expect(
      automationUndoRequestSchema.safeParse({ ...request, compensatingMutations: [] }).success,
    ).toBe(false);
    const { deviceId: _deviceId, ...withoutDeviceId } = request;
    expect(automationUndoRequestSchema.safeParse(withoutDeviceId).success).toBe(false);
    expect(
      automationUndoResultSchema.parse({
        schemaVersion: 1,
        code: "ALREADY_UNDONE",
        transactionId: TRANSACTION_ID,
        undoTransactionId: UNDO_TRANSACTION_ID,
        serverSequence: 13,
        historyGeneration: 3,
        completedAt: 121,
      }).code,
    ).toBe("ALREADY_UNDONE");
  });

  it("requires an ordered snapshot and excludes tombstoned transactions", () => {
    const transaction = {
      id: TRANSACTION_ID,
      consentEpoch: CONSENT_EPOCH,
      sourceKey: SOURCE_KEY,
      ruleId: AUTOMATION_RULE_IDS[0],
      ruleVersion: 1,
      sourceType: "mood",
      sourceId: "mood-1",
      status: "committed",
      revisionCiphertext: "zenflow:automation-revision:v1:encrypted",
      createdAt: 100,
      updatedAt: 110,
      serverSequence: 12,
      historyGeneration: 3,
      schemaVersion: 1,
    } as const;
    const second = {
      ...transaction,
      id: UNDO_TRANSACTION_ID,
      sourceKey: `sha256:${"d".repeat(64)}`,
      sourceId: "mood-2",
      serverSequence: 13,
    } as const;

    expect(
      automationHistorySnapshotSchema.parse({
        schemaVersion: 1,
        historyGeneration: 3,
        snapshotSequence: 13,
        allHistoryPurgedAt: 120,
        tombstones: [],
        transactions: [transaction, second],
        recordRevisions: [
          {
            entityType: "mood",
            entityId: "forgotten-mood",
            recordExists: false,
            revisionToken: null,
            stateHash: `sha256:${"0".repeat(64)}`,
            mutationGeneration: 2,
            transactionId: null,
            updatedAt: 120,
          },
        ],
      }),
    ).toMatchObject({
      allHistoryPurgedAt: 120,
      transactions: expect.arrayContaining([transaction, second]),
      recordRevisions: [expect.objectContaining({ revisionToken: null, transactionId: null })],
    });
    expect(
      automationHistorySnapshotSchema.safeParse({
        schemaVersion: 1,
        historyGeneration: 3,
        snapshotSequence: 13,
        tombstones: [],
        transactions: [second, transaction],
        recordRevisions: [],
      }).success,
    ).toBe(false);
    expect(
      automationHistorySnapshotSchema.safeParse({
        schemaVersion: 1,
        historyGeneration: 3,
        snapshotSequence: 13,
        tombstones: [{ transactionId: TRANSACTION_ID, purgedAt: 111, serverSequence: 13 }],
        transactions: [transaction],
        recordRevisions: [],
      }).success,
    ).toBe(false);
  });

  it("accepts bounded pages and assembles lifetime tombstones and revisions without a hard cap", () => {
    const token = {
      historyGeneration: 3,
      snapshotSequence: 5_000,
      recordRevisionVersion: 7_000,
    } as const;
    expect(
      automationHistorySnapshotPageResultSchema.parse({
        schemaVersion: 2,
        code: "PAGE",
        snapshotToken: token,
        tombstones: [],
        transactions: [],
        recordRevisions: [],
        nextCursor: null,
      }),
    ).toMatchObject({ code: "PAGE", snapshotToken: token });
    expect(
      automationHistorySnapshotPageResultSchema.safeParse({
        schemaVersion: 2,
        code: "PAGE",
        snapshotToken: token,
        tombstones: Array.from({ length: 129 }, (_, index) => ({
          transactionId: indexedUuid(index + 1),
          purgedAt: index + 1,
          serverSequence: index + 1,
        })),
        transactions: [],
        recordRevisions: [],
        nextCursor: null,
      }).success,
    ).toBe(false);

    const aggregatePage = {
      schemaVersion: 2 as const,
      code: "PAGE" as const,
      snapshotToken: token,
      tombstones: Array.from({ length: 43 }, (_, index) => ({
        transactionId: indexedUuid(index + 1_000),
        purgedAt: index + 1,
        serverSequence: index + 1,
      })),
      transactions: Array.from({ length: 43 }, (_, index) => ({
        id: indexedUuid(index + 2_000),
        consentEpoch: CONSENT_EPOCH,
        sourceKey: `sha256:${index.toString(16).padStart(64, "0")}`,
        ruleId: AUTOMATION_RULE_IDS[0],
        ruleVersion: 1,
        sourceType: "mood" as const,
        sourceId: `mood-${index}`,
        status: "committed" as const,
        revisionCiphertext: "zenflow:automation-revision:v1:encrypted",
        createdAt: index + 1,
        updatedAt: index + 1,
        serverSequence: index + 1,
        historyGeneration: 3,
        schemaVersion: 1 as const,
      })),
      recordRevisions: Array.from({ length: 43 }, (_, index) => ({
        entityType: "habit_completion" as const,
        entityId: `aggregate-habit-${index}:2026-08-08`,
        recordExists: true,
        revisionToken: indexedUuid(index + 3_000),
        stateHash: `sha256:${"a".repeat(64)}`,
        mutationGeneration: 1,
        transactionId: null,
        updatedAt: index + 1,
      })),
      nextCursor: null,
    };
    expect(
      aggregatePage.tombstones.length
        + aggregatePage.transactions.length
        + aggregatePage.recordRevisions.length,
    ).toBe(129);
    expect(automationHistorySnapshotPageResultSchema.safeParse(aggregatePage).success).toBe(true);

    const tombstones = Array.from({ length: 2_049 }, (_, index) => ({
      transactionId: indexedUuid(index + 1),
      purgedAt: index + 1,
      serverSequence: index + 1,
    }));
    const recordRevisions = Array.from({ length: 4_097 }, (_, index) => ({
      entityType: "habit_completion" as const,
      entityId: `habit-${index}:2026-08-08`,
      recordExists: true,
      revisionToken: indexedUuid(index + 10_000),
      stateHash: `sha256:${"a".repeat(64)}`,
      mutationGeneration: 1,
      transactionId: null,
      updatedAt: index + 1,
    }));
    const snapshot = {
      schemaVersion: 1 as const,
      historyGeneration: 3,
      snapshotSequence: 5_000,
      tombstones,
      transactions: [],
      recordRevisions,
    };

    expect(automationHistorySnapshotSchema.safeParse(snapshot).success).toBe(true);
    expect(
      automationHistoryMarkerSchema.safeParse({
        schemaVersion: 1,
        ownerUserId: "11111111-1111-4111-8111-111111111111",
        historyGeneration: 3,
        snapshotSequence: 5_000,
        lastAppliedServerSequence: 5_000,
        bootstrapCompletedAt: 5_001,
        purgedTransactionIds: tombstones.map((row) => row.transactionId),
        updatedAt: 5_001,
      }).success,
    ).toBe(true);
  });
});

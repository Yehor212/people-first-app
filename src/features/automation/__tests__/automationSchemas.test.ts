import { describe, expect, it } from "vitest";
import {
  AUTOMATION_RULE_IDS,
  AUTOMATION_TRANSACTION_MAX_CIPHERTEXT_LENGTH,
  automationPreferenceSchema,
  automationMutationSchema,
  automationProvenanceSchema,
  automationHistoryMarkerSchema,
  automationRemoteEventSchema,
  automationSourceEventSchema,
  automationTransactionSchema,
} from "../types";

const OWNER_ID = "11111111-1111-4111-8111-111111111111";
const TRANSACTION_ID = "22222222-2222-4222-8222-222222222222";
const CONSENT_EPOCH = "33333333-3333-4333-8333-333333333333";
const SOURCE_KEY = `sha256:${"0".repeat(64)}`;
const RECORD_REVISION = "44444444-4444-4444-8444-444444444444";

describe("automation contracts", () => {
  it("defaults connected records to a disabled, empty, versioned preference", () => {
    expect(automationPreferenceSchema.parse({ schemaVersion: 1, updatedAt: 10 })).toEqual({
      schemaVersion: 1,
      enabled: false,
      serverRevision: 0,
      consentEpoch: null,
      consentedAt: null,
      revokedAt: null,
      revocationPending: false,
      enabledRuleIds: [],
      focusHabitId: null,
      focusMinimumMinutes: 25,
      planningHabitMappings: {},
      updatedAt: 10,
    });
  });

  it("requires consent and registered unique rules when enabled", () => {
    expect(
      automationPreferenceSchema.safeParse({
        schemaVersion: 1,
        enabled: true,
        enabledRuleIds: [AUTOMATION_RULE_IDS[0]],
        updatedAt: 10,
      }).success,
    ).toBe(false);

    expect(
      automationPreferenceSchema.safeParse({
        schemaVersion: 1,
        enabled: true,
        consentEpoch: CONSENT_EPOCH,
        consentedAt: 9,
        enabledRuleIds: [AUTOMATION_RULE_IDS[0], AUTOMATION_RULE_IDS[0]],
        updatedAt: 10,
      }).success,
    ).toBe(false);

    expect(
      automationPreferenceSchema.safeParse({
        schemaVersion: 1,
        enabled: true,
        consentEpoch: CONSENT_EPOCH,
        consentedAt: 9,
        enabledRuleIds: ["unknown.rule.v1"],
        updatedAt: 10,
      }).success,
    ).toBe(false);
  });

  it("bounds mapping values and rejects revocation before consent", () => {
    expect(
      automationPreferenceSchema.safeParse({
        schemaVersion: 1,
        enabled: false,
        consentedAt: 20,
        revokedAt: 19,
        focusMinimumMinutes: 0,
        updatedAt: 21,
      }).success,
    ).toBe(false);

    expect(
      automationPreferenceSchema.safeParse({
        schemaVersion: 1,
        enabled: false,
        consentedAt: 20,
        revokedAt: 21,
        focusMinimumMinutes: 1440,
        planningHabitMappings: { "habit-1": "schedule-1" },
        updatedAt: 21,
      }).success,
    ).toBe(true);
  });

  it("rejects an active preference that is also marked revoked", () => {
    expect(
      automationPreferenceSchema.safeParse({
        schemaVersion: 1,
        enabled: true,
        serverRevision: 1,
        consentEpoch: CONSENT_EPOCH,
        consentedAt: 20,
        revokedAt: 21,
        enabledRuleIds: [AUTOMATION_RULE_IDS[0]],
        updatedAt: 21,
      }).success,
    ).toBe(false);

    expect(
      automationPreferenceSchema.safeParse({
        schemaVersion: 1,
        enabled: true,
        serverRevision: 1,
        consentEpoch: CONSENT_EPOCH,
        consentedAt: 22,
        revokedAt: null,
        enabledRuleIds: [AUTOMATION_RULE_IDS[0]],
        updatedAt: 22,
      }).success,
    ).toBe(true);

    expect(
      automationPreferenceSchema.safeParse({
        schemaVersion: 1,
        enabled: true,
        consentEpoch: CONSENT_EPOCH,
        consentedAt: 22,
        revokedAt: null,
        enabledRuleIds: [AUTOMATION_RULE_IDS[0]],
        updatedAt: 22,
      }).success,
    ).toBe(false);
  });

  it("accepts a durable pending revoke only in a disabled, timestamped state", () => {
    expect(
      automationPreferenceSchema.safeParse({
        schemaVersion: 1,
        enabled: false,
        serverRevision: 1,
        consentedAt: 20,
        revokedAt: 21,
        revocationPending: true,
        updatedAt: 21,
      }).success,
    ).toBe(true);

    expect(
      automationPreferenceSchema.safeParse({
        schemaVersion: 1,
        enabled: false,
        serverRevision: 1,
        consentedAt: 20,
        revokedAt: null,
        revocationPending: true,
        updatedAt: 21,
      }).success,
    ).toBe(false);
  });

  it("accepts only bounded, versioned source events with stable revisions", () => {
    expect(
      automationSourceEventSchema.parse({
        schemaVersion: 1,
        type: "mood",
        id: "mood-1",
        revision: "updatedAt:100",
        committedAt: 100,
      }),
    ).toEqual({
      schemaVersion: 1,
      type: "mood",
      id: "mood-1",
      revision: "updatedAt:100",
      committedAt: 100,
    });

    expect(
      automationSourceEventSchema.safeParse({
        schemaVersion: 2,
        type: "mood",
        id: "mood-1",
        revision: "updatedAt:100",
        committedAt: 100,
      }).success,
    ).toBe(false);
  });

  it("keeps automation provenance owner-bound, hash-verifiable, and prose-free", () => {
    const provenance = {
      schemaVersion: 1,
      ownerUserId: OWNER_ID,
      transactionId: TRANSACTION_ID,
      consentEpoch: CONSENT_EPOCH,
      sourceKey: SOURCE_KEY,
      ruleId: AUTOMATION_RULE_IDS[0],
      ruleVersion: 1,
      sourceType: "mood",
      sourceId: "mood-1",
      mutationGeneration: 1,
      recordRevisionToken: RECORD_REVISION,
      afterHash: "sha256:aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
      createdAt: 100,
    } as const;

    expect(automationProvenanceSchema.parse(provenance)).toEqual(provenance);
    expect(
      automationProvenanceSchema.safeParse({ ...provenance, note: "private prose" }).success,
    ).toBe(false);
    expect(
      automationProvenanceSchema.safeParse({ ...provenance, mutationGeneration: 0 }).success,
    ).toBe(false);
  });

  it("requires planned-before and exact-after revision tokens on mutations", () => {
    const valid = {
      entityType: "journal",
      entityId: "journal-1",
      operation: "upsert",
      before: null,
      after: { id: "journal-1", content: "user-authored" },
      beforeHash: "sha256:0000000000000000000000000000000000000000000000000000000000000000",
      afterHash: "sha256:1111111111111111111111111111111111111111111111111111111111111111",
      beforeRevisionToken: null,
      afterRevisionToken: RECORD_REVISION,
    } as const;

    expect(automationMutationSchema.parse(valid)).toEqual(valid);
    expect(
      automationMutationSchema.safeParse({ ...valid, afterRevisionToken: null }).success,
    ).toBe(false);
    expect(
      automationMutationSchema.safeParse({ ...valid, before: { id: "journal-1" }, beforeRevisionToken: null }).success,
    ).toBe(false);
    expect(
      automationMutationSchema.safeParse({
        ...valid,
        entityType: "habit_completion",
        entityId: "habit-1:2026-08-08",
      }).success,
    ).toBe(true);
  });

  it("accepts ciphertext-only transaction metadata and rejects plaintext-shaped envelopes", () => {
    const valid = {
      id: TRANSACTION_ID,
      ownerUserId: OWNER_ID,
      consentEpoch: CONSENT_EPOCH,
      sourceKey: SOURCE_KEY,
      ruleId: AUTOMATION_RULE_IDS[0],
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
    } as const;

    expect(automationTransactionSchema.parse(valid)).toEqual(valid);
    expect(
      automationTransactionSchema.safeParse({
        ...valid,
        revisionCiphertext: JSON.stringify({ before: { note: "private" } }),
      }).success,
    ).toBe(false);
    expect(
      automationTransactionSchema.safeParse({
        ...valid,
        revisionCiphertext:
          "zenflow:automation-revision:v1:" +
          "x".repeat(AUTOMATION_TRANSACTION_MAX_CIPHERTEXT_LENGTH + 1),
      }).success,
    ).toBe(false);
  });

  it("distinguishes sparse snapshot delivery from contiguous delta delivery while locked", () => {
    expect(
      automationHistoryMarkerSchema.parse({
        schemaVersion: 1,
        ownerUserId: OWNER_ID,
        historyGeneration: 2,
        snapshotSequence: 7,
        lastAppliedServerSequence: 0,
        bootstrapCompletedAt: 120,
        updatedAt: 120,
      }),
    ).toMatchObject({ snapshotSequence: 7, lastAppliedServerSequence: 0 });

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
      updatedAt: 100,
      serverSequence: 7,
      historyGeneration: 2,
      schemaVersion: 1,
    } as const;
    expect(
      automationRemoteEventSchema.parse({
        id: `automation-snapshot:2:${TRANSACTION_ID}`,
        schemaVersion: 1,
        ownerUserId: OWNER_ID,
        syncEventId: TRANSACTION_ID,
        syncEventSequence: 7,
        transactionId: TRANSACTION_ID,
        historyGeneration: 2,
        serverSequence: 7,
        deliveryKind: "snapshot",
        transaction,
        receivedAt: 120,
      }).deliveryKind,
    ).toBe("snapshot");
  });

  it("requires monotonic status timestamps and a compensating transaction for undone rows", () => {
    const base = {
      id: TRANSACTION_ID,
      ownerUserId: OWNER_ID,
      consentEpoch: CONSENT_EPOCH,
      sourceKey: SOURCE_KEY,
      ruleId: AUTOMATION_RULE_IDS[0],
      ruleVersion: 1,
      sourceType: "mood",
      sourceId: "mood-1",
      status: "undone",
      revisionCiphertext: "zenflow:automation-revision:v1:encrypted",
      createdAt: 100,
      updatedAt: 110,
      undoneAt: 110,
      serverSequence: 7,
      historyGeneration: 2,
      schemaVersion: 1,
    };

    expect(automationTransactionSchema.safeParse(base).success).toBe(false);
    expect(
      automationTransactionSchema.safeParse({
        ...base,
        undoTransactionId: "33333333-3333-4333-8333-333333333333",
      }).success,
    ).toBe(true);
    expect(
      automationTransactionSchema.safeParse({
        ...base,
        updatedAt: 99,
        undoneAt: 99,
        undoTransactionId: "33333333-3333-4333-8333-333333333333",
      }).success,
    ).toBe(false);
  });
});

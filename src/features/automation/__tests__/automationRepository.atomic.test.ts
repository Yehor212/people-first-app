import { beforeEach, describe, expect, it, vi } from "vitest";

const boundary = vi.hoisted(() => ({
  current: true,
  generation: "boundary-a",
  owner: "11111111-1111-4111-8111-111111111111",
  vaultKey: "YXV0b21hdGlvbi10ZXN0LXZhdWx0LWtleS0zMmI=", // gitleaks:allow - synthetic test vault key
  vaultRevision: 7,
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

vi.mock("@/features/journal/journalContentSession", () => ({
  getJournalContentVaultKey: vi.fn(() => boundary.vaultKey),
  getJournalContentVaultRevision: vi.fn(() => boundary.vaultRevision),
}));

import {
  commitLocalAutomationTransaction,
  persistPrimaryRecordWithAutomationIntent,
  readAutomationTargetSnapshot,
} from "../automationRepository";
import { hashAutomationValue } from "../canonicalJson";
import { computeAutomationSourceKey } from "../sourceKey";
import {
  AUTOMATION_PREFERENCE_SETTING_KEY,
  type AutomationMutation,
  type AutomationRevisionEnvelope,
  type AutomationRuleId,
  type AutomationSourceIntent,
  type AutomationSourceType,
} from "../types";
import { db, type OfflineQueueItem } from "@/storage/db";
import type { Habit } from "@/types";
import {
  encryptJournalContent,
  isEncryptedJournalContent,
} from "@/features/journal/journalCrypto";

const OWNER_ID = boundary.owner;
const TRANSACTION_ID = "22222222-2222-4222-8222-222222222222";
const CONSENT_EPOCH = "33333333-3333-4333-8333-333333333333";
const AFTER_REVISION = "44444444-4444-4444-8444-444444444444";

async function journalRevision(): Promise<AutomationRevisionEnvelope> {
  const source = {
    schemaVersion: 1 as const,
    type: "mood" as const,
    id: "mood-1",
    revision: "updatedAt:100",
    committedAt: 100,
  };
  const sourceKey = await computeAutomationSourceKey({
    ownerUserId: OWNER_ID,
    consentEpoch: CONSENT_EPOCH,
    ruleId: "mood.note-to-journal.v1",
    ruleVersion: 1,
    sourceType: source.type,
    sourceId: source.id,
    sourceRevision: source.revision,
  });
  const protectedContent = await encryptJournalContent(
    "private user-authored note",
    boundary.vaultKey,
  );
  const after = {
    id: "journal-1",
    date: "2026-08-08",
    title: "",
    content: protectedContent,
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
  return {
    schemaVersion: 1,
    transactionId: TRANSACTION_ID,
    ownerUserId: OWNER_ID,
    consentEpoch: CONSENT_EPOCH,
    sourceKey,
    ruleId: "mood.note-to-journal.v1",
    ruleVersion: 1,
    source,
    mutations: [
      {
        entityType: "journal",
        entityId: "journal-1",
        operation: "upsert",
        before: null,
        after,
        beforeHash: await hashAutomationValue(null),
        afterHash: await hashAutomationValue(after),
        beforeRevisionToken: null,
        afterRevisionToken: AFTER_REVISION,
      },
    ],
    plannedAt: 101,
  };
}

async function seedGate(): Promise<void> {
  await db.settings.put({
    key: AUTOMATION_PREFERENCE_SETTING_KEY,
    value: {
      schemaVersion: 1,
      enabled: true,
      serverRevision: 4,
      consentEpoch: CONSENT_EPOCH,
      consentedAt: 90,
      revokedAt: null,
      revocationPending: false,
      enabledRuleIds: ["mood.note-to-journal.v1"],
      focusHabitId: null,
      focusMinimumMinutes: 25,
      planningHabitMappings: {},
      updatedAt: 90,
    },
  });
  await db.automationHistoryMarkers.put({
    schemaVersion: 1,
    ownerUserId: OWNER_ID,
    historyGeneration: 2,
    snapshotSequence: 0,
    lastAppliedServerSequence: 0,
    bootstrapCompletedAt: 90,
    updatedAt: 90,
  });
}

async function moodSourceIntent(): Promise<AutomationSourceIntent> {
  const source = {
    schemaVersion: 1 as const,
    type: "mood" as const,
    id: "mood-source-1",
    revision: "updatedAt:120",
    committedAt: 120,
  };
  const sourceKey = await computeAutomationSourceKey({
    ownerUserId: OWNER_ID,
    consentEpoch: CONSENT_EPOCH,
    ruleId: "mood.note-to-journal.v1",
    ruleVersion: 1,
    sourceType: source.type,
    sourceId: source.id,
    sourceRevision: source.revision,
  });
  return {
    kind: "source_pending",
    id: `source_pending:${sourceKey}`,
    schemaVersion: 1,
    ownerUserId: OWNER_ID,
    consentEpoch: CONSENT_EPOCH,
    accountBoundaryGeneration: boundary.generation,
    source,
    candidateRuleIds: ["mood.note-to-journal.v1"],
    sourceKey,
    createdAt: 120,
    updatedAt: 120,
  };
}

function commitOptions() {
  return {
    expectedOwnerUserId: OWNER_ID,
    accountBoundaryGeneration: boundary.generation,
    vaultKey: boundary.vaultKey,
    vaultRevision: boundary.vaultRevision,
    expectedPreferenceRevision: 4,
    expectedHistoryGeneration: 2,
    deviceId: "android-install-1",
  };
}

async function enableOnlyRule(ruleId: AutomationRuleId): Promise<void> {
  const current = await db.settings.get(AUTOMATION_PREFERENCE_SETTING_KEY);
  await db.settings.put({
    key: AUTOMATION_PREFERENCE_SETTING_KEY,
    value: {
      ...(current?.value as Record<string, unknown>),
      enabledRuleIds: [ruleId],
    },
  });
}

async function singleMutationRevision(input: {
  transactionId: string;
  ruleId: AutomationRuleId;
  sourceType: AutomationSourceType;
  sourceId: string;
  mutation: Omit<AutomationMutation, "beforeHash" | "afterHash">;
  plannedAt?: number;
}): Promise<AutomationRevisionEnvelope> {
  const plannedAt = input.plannedAt ?? 200;
  const source = {
    schemaVersion: 1 as const,
    type: input.sourceType,
    id: input.sourceId,
    revision: `updatedAt:${plannedAt}`,
    committedAt: plannedAt,
  };
  const sourceKey = await computeAutomationSourceKey({
    ownerUserId: OWNER_ID,
    consentEpoch: CONSENT_EPOCH,
    ruleId: input.ruleId,
    ruleVersion: 1,
    sourceType: input.sourceType,
    sourceId: input.sourceId,
    sourceRevision: source.revision,
  });
  return {
    schemaVersion: 1,
    transactionId: input.transactionId,
    ownerUserId: OWNER_ID,
    consentEpoch: CONSENT_EPOCH,
    sourceKey,
    ruleId: input.ruleId,
    ruleVersion: 1,
    source,
    mutations: [
      {
        ...input.mutation,
        beforeHash: await hashAutomationValue(input.mutation.before),
        afterHash: await hashAutomationValue(input.mutation.after),
      },
    ],
    plannedAt,
  };
}

describe("atomic local automation repository", () => {
  beforeEach(async () => {
    boundary.current = true;
    boundary.generation = "boundary-a";
    boundary.owner = OWNER_ID;
    boundary.vaultRevision = 7;
    await db.open();
    await db.transaction(
      "rw",
      [
        db.moods,
        db.habits,
        db.focusSessions,
        db.journalEntries,
        db.settings,
        db.offlineQueue,
        db.automationTransactions,
        db.automationHistoryMarkers,
      ],
      async () => {
        await db.moods.clear();
        await db.habits.clear();
        await db.focusSessions.clear();
        await db.journalEntries.clear();
        await db.settings.clear();
        await db.offlineQueue.clear();
        await db.automationTransactions.clear();
        await db.automationHistoryMarkers.clear();
      },
    );
    await seedGate();
  });

  it("writes the derived row, encrypted ledger, revision token and one opaque stable outbox atomically", async () => {
    const revision = await journalRevision();

    await expect(commitLocalAutomationTransaction(revision, commitOptions())).resolves.toMatchObject({
      id: TRANSACTION_ID,
      status: "commit_pending",
    });

    const storedJournal = await db.journalEntries.get("journal-1");
    expect(storedJournal).toMatchObject({
      id: "journal-1",
      photoIds: [],
      createdAt: 100,
      updatedAt: 101,
    });
    expect(storedJournal?.content).not.toContain("private user-authored note");
    expect(isEncryptedJournalContent(storedJournal?.content ?? "")).toBe(true);
    const rows = await db.automationTransactions.toArray();
    expect(rows).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          kind: "transaction",
          id: TRANSACTION_ID,
          revisionCiphertext: expect.stringMatching(/^zenflow:automation-revision:v1:/),
        }),
        expect.objectContaining({
          kind: "record_revision",
          entityType: "journal",
          entityId: "journal-1",
          revisionToken: AFTER_REVISION,
          transactionId: TRANSACTION_ID,
        }),
      ]),
    );
    const outbox = await db.offlineQueue.toArray();
    expect(outbox).toEqual([
      expect.objectContaining({
        id: `automation-commit:${TRANSACTION_ID}`,
        operationId: TRANSACTION_ID,
        type: "COMMIT_AUTOMATION_TRANSACTION",
        entityId: TRANSACTION_ID,
        payload: {
          schemaVersion: 1,
          transactionId: TRANSACTION_ID,
          expectedPreferenceRevision: 4,
          expectedHistoryGeneration: 2,
          deviceId: "android-install-1",
        },
      }),
    ]);
    expect(JSON.stringify(outbox)).not.toContain("private user-authored note");
  });

  it("returns only a hash-coherent owner-bound target snapshot", async () => {
    const revision = await journalRevision();
    await commitLocalAutomationTransaction(revision, commitOptions());

    await expect(
      readAutomationTargetSnapshot(
        { entityType: "journal", entityId: "journal-1" },
        OWNER_ID,
      ),
    ).resolves.toEqual({
      entityType: "journal",
      entityId: "journal-1",
      value: revision.mutations[0].after,
      revisionToken: AFTER_REVISION,
      automationOwned: true,
    });

    const stored = await db.journalEntries.get("journal-1");
    await db.journalEntries.put({ ...stored!, title: "manual drift" });
    await expect(
      readAutomationTargetSnapshot(
        { entityType: "journal", entityId: "journal-1" },
        OWNER_ID,
      ),
    ).rejects.toMatchObject({ code: "AUTOMATION_COMMIT_TARGET_CONFLICT" });
  });

  it("accepts never-created absence but rejects retained-delete absence against stale create", async () => {
    const identity = { entityType: "journal" as const, entityId: "journal-never-created" };
    await expect(readAutomationTargetSnapshot(identity, OWNER_ID)).resolves.toEqual({
      ...identity,
      value: null,
      revisionToken: null,
      automationOwned: false,
    });

    await db.automationTransactions.put({
      kind: "record_revision",
      id: `record_revision:journal:${identity.entityId}`,
      schemaVersion: 1,
      ownerUserId: OWNER_ID,
      entityType: identity.entityType,
      entityId: identity.entityId,
      recordExists: false,
      revisionToken: null,
      stateHash: await hashAutomationValue(null),
      mutationGeneration: 2,
      transactionId: null,
      updatedAt: 200,
    });

    await expect(readAutomationTargetSnapshot(identity, OWNER_ID)).rejects.toMatchObject({
      code: "AUTOMATION_COMMIT_TARGET_CONFLICT",
    });
  });

  it("round-trips every supported journal projection field without changing its CAS hash", async () => {
    const revision = await journalRevision();
    const mutation = revision.mutations[0];
    const after = {
      ...(mutation.after as Record<string, unknown>),
      mood: "good",
      template_id: "template-1",
      habit_snapshot: [
        {
          habitId: "habit-1",
          habitName: "Read",
          habitIcon: "book",
          completed: true,
        },
      ],
      photo_ids: ["photo-1"],
      audio_ids: ["audio-1"],
      bg_intensity: "dim",
      bg_pattern: "aurora",
      font: "cormorant",
      font_size: "large",
      ink_color: "#123456",
      paper_color: "milky",
      paper_texture: "linen",
      particle_speed: "drift",
      photo_layout: {
        "photo-1": { x: 12, y: 24, width: 180, description: "memory" },
      },
      theme: "forest",
    };
    revision.mutations[0] = {
      ...mutation,
      after,
      afterHash: await hashAutomationValue(after),
    };

    await expect(
      commitLocalAutomationTransaction(revision, commitOptions()),
    ).resolves.toMatchObject({ id: TRANSACTION_ID });

    await expect(db.journalEntries.get("journal-1")).resolves.toMatchObject({
      mood: "good",
      templateId: "template-1",
      habitSnapshot: [{ habitId: "habit-1", completed: true }],
      photoIds: ["photo-1"],
      audioIds: ["audio-1"],
      bgIntensity: "dim",
      bgPattern: "aurora",
      font: "cormorant",
      fontSize: "large",
      inkColor: "#123456",
      paperColor: "milky",
      paperTexture: "linen",
      particleSpeed: "drift",
      photoLayout: {
        "photo-1": { x: 12, y: 24, width: 180, description: "memory" },
      },
      theme: "forest",
    });
  });

  it("rejects an invalid mood projection before any personal record or outbox is written", async () => {
    await enableOnlyRule("journal.mood-to-checkin.v1");
    const entityId = "77777777-7777-4777-8777-777777777777";
    const after = {
      id: entityId,
      mood: "not-a-mood",
      note: null,
      tags: null,
      date: "2026-08-08",
      timestamp: 200,
      updated_at: 200,
      valence: null,
      log_type: null,
      emotion_tags: null,
      contexts: null,
      emotion: null,
    };
    const revision = await singleMutationRevision({
      transactionId: "88888888-8888-4888-8888-888888888888",
      ruleId: "journal.mood-to-checkin.v1",
      sourceType: "journal",
      sourceId: "journal-source-1",
      mutation: {
        entityType: "mood",
        entityId,
        operation: "upsert",
        before: null,
        after,
        beforeRevisionToken: null,
        afterRevisionToken: "99999999-9999-4999-8999-999999999999",
      },
    });

    await expect(
      commitLocalAutomationTransaction(revision, commitOptions()),
    ).rejects.toMatchObject({ code: "AUTOMATION_COMMIT_ROW_INVALID" });
    await expect(db.moods.get(entityId)).resolves.toBeUndefined();
    await expect(db.offlineQueue.count()).resolves.toBe(0);
  });

  it("uses the canonical habit completion codec for sub-unit numerical values", async () => {
    await enableOnlyRule("focus.to-mapped-habit.v1");
    const habitId = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
    const habit: Habit = {
      id: habitId,
      name: "Water",
      icon: "drop",
      color: 0,
      position: 0,
      createdAt: 1,
      habitType: "numerical",
      frequency: { numerator: 1, denominator: 1 },
      question: "Water?",
      description: "",
      isArchived: false,
      targetValue: 0.001,
      targetType: "atLeast",
      unit: "L",
      entries: {},
      reminders: [],
    };
    await db.habits.put(habit);
    const entityId = `${habitId}:2026-08-08`;
    const after = {
      habit_id: habitId,
      date: "2026-08-08",
      count: 1,
      duration: 1,
      entry_status: "completed",
      entry_value: 1,
      habit_type: "numerical",
      is_complete: true,
      target_type: "atLeast",
    };
    const revision = await singleMutationRevision({
      transactionId: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
      ruleId: "focus.to-mapped-habit.v1",
      sourceType: "focus",
      sourceId: "focus-source-1",
      mutation: {
        entityType: "habit_completion",
        entityId,
        operation: "upsert",
        before: null,
        after,
        beforeRevisionToken: null,
        afterRevisionToken: "cccccccc-cccc-4ccc-8ccc-cccccccccccc",
      },
    });

    await expect(
      commitLocalAutomationTransaction(revision, commitOptions()),
    ).resolves.toMatchObject({ id: revision.transactionId });
    await expect(db.habits.get(habitId)).resolves.toMatchObject({
      entries: { "2026-08-08": { value: 1 } },
    });
  });

  it("rolls back every derived write when the critical outbox cannot fit", async () => {
    const fullQueue: OfflineQueueItem[] = Array.from({ length: 1000 }, (_, index) => ({
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
      commitLocalAutomationTransaction(await journalRevision(), commitOptions()),
    ).rejects.toThrow("Offline queue full");

    await expect(db.journalEntries.get("journal-1")).resolves.toBeUndefined();
    await expect(db.automationTransactions.count()).resolves.toBe(0);
    await expect(db.offlineQueue.count()).resolves.toBe(1000);
  });

  it("returns the same transaction for an idempotent duplicate source without a second outbox", async () => {
    const revision = await journalRevision();
    const first = await commitLocalAutomationTransaction(revision, commitOptions());
    const second = await commitLocalAutomationTransaction(revision, commitOptions());

    expect(second).toEqual(first);
    await expect(db.offlineQueue.count()).resolves.toBe(1);
    await expect(
      db.automationTransactions.where("kind").equals("transaction").count(),
    ).resolves.toBe(1);
  });

  it("rejects a tombstoned deterministic transaction before any local target mutation", async () => {
    const revision = await journalRevision();
    const marker = await db.automationHistoryMarkers.get(OWNER_ID);
    await db.automationHistoryMarkers.put({
      ...marker!,
      purgedTransactionIds: [revision.transactionId],
    });

    await expect(
      commitLocalAutomationTransaction(revision, commitOptions()),
    ).rejects.toMatchObject({ code: "AUTOMATION_COMMIT_TRANSACTION_PURGED" });

    await expect(db.journalEntries.get("journal-1")).resolves.toBeUndefined();
    await expect(db.offlineQueue.count()).resolves.toBe(0);
    await expect(
      db.automationTransactions.where("kind").equals("transaction").count(),
    ).resolves.toBe(0);
  });

  it("commits the primary mood and prose-free source intent in one owner-bound transaction", async () => {
    const intent = await moodSourceIntent();
    const mood = {
      id: intent.source.id,
      mood: "good" as const,
      note: "private source note",
      date: "2026-08-08",
      timestamp: 120,
      updatedAt: 120,
    };

    await expect(
      persistPrimaryRecordWithAutomationIntent(mood, intent, OWNER_ID),
    ).resolves.toEqual({ intentPersisted: true });

    await expect(db.moods.get(mood.id)).resolves.toEqual(mood);
    await expect(db.automationTransactions.get(intent.id)).resolves.toEqual(intent);
    expect(JSON.stringify(await db.automationTransactions.get(intent.id))).not.toContain(
      "private source note",
    );
  });

  it("keeps the primary record but drops an E1 intent after consent is revoked", async () => {
    const intent = await moodSourceIntent();
    const mood = {
      id: intent.source.id,
      mood: "good" as const,
      note: "primary remains user-owned",
      date: "2026-08-08",
      timestamp: 120,
      updatedAt: 120,
    };
    await db.settings.put({
      key: AUTOMATION_PREFERENCE_SETTING_KEY,
      value: {
        schemaVersion: 1,
        enabled: false,
        serverRevision: 5,
        consentEpoch: null,
        consentedAt: 90,
        revokedAt: 110,
        revocationPending: false,
        enabledRuleIds: [],
        focusHabitId: null,
        focusMinimumMinutes: 25,
        planningHabitMappings: {},
        updatedAt: 110,
      },
    });

    await expect(
      persistPrimaryRecordWithAutomationIntent(mood, intent, OWNER_ID),
    ).resolves.toEqual({ intentPersisted: false });

    await expect(db.moods.get(mood.id)).resolves.toEqual(mood);
    await expect(db.automationTransactions.get(intent.id)).resolves.toBeUndefined();
  });

  it("rejects an owner switch, stale account generation, or stale vault before any derived write", async () => {
    const revision = await journalRevision();

    boundary.owner = "55555555-5555-4555-8555-555555555555";
    await expect(
      commitLocalAutomationTransaction(revision, commitOptions()),
    ).rejects.toMatchObject({ code: "AUTOMATION_COMMIT_OWNER_UNAVAILABLE" });

    boundary.owner = OWNER_ID;
    boundary.current = false;
    await expect(
      commitLocalAutomationTransaction(revision, commitOptions()),
    ).rejects.toMatchObject({ code: "AUTOMATION_COMMIT_BOUNDARY_CHANGED" });

    boundary.current = true;
    await expect(
      commitLocalAutomationTransaction(revision, {
        ...commitOptions(),
        vaultRevision: boundary.vaultRevision + 1,
      }),
    ).rejects.toMatchObject({ code: "AUTOMATION_COMMIT_VAULT_LOCKED" });

    await expect(db.journalEntries.get("journal-1")).resolves.toBeUndefined();
    await expect(db.offlineQueue.count()).resolves.toBe(0);
    await expect(db.automationTransactions.count()).resolves.toBe(0);
  });

  it("rejects a deterministic create collision without altering the existing projection", async () => {
    const first = await journalRevision();
    await commitLocalAutomationTransaction(first, commitOptions());
    await db.offlineQueue.clear();
    await db.automationTransactions.delete(TRANSACTION_ID);

    const secondTransactionId = "66666666-6666-4666-8666-666666666666";
    const secondSource = {
      ...first.source,
      id: "mood-2",
      revision: "updatedAt:200",
      committedAt: 200,
    };
    const secondSourceKey = await computeAutomationSourceKey({
      ownerUserId: OWNER_ID,
      consentEpoch: CONSENT_EPOCH,
      ruleId: first.ruleId,
      ruleVersion: 1,
      sourceType: secondSource.type,
      sourceId: secondSource.id,
      sourceRevision: secondSource.revision,
    });
    const colliding: AutomationRevisionEnvelope = {
      ...first,
      transactionId: secondTransactionId,
      sourceKey: secondSourceKey,
      source: secondSource,
      plannedAt: 200,
    };

    await expect(
      commitLocalAutomationTransaction(colliding, commitOptions()),
    ).rejects.toMatchObject({ code: "AUTOMATION_COMMIT_TARGET_CONFLICT" });

    await expect(db.journalEntries.get("journal-1")).resolves.toMatchObject({
      updatedAt: 101,
    });
    await expect(db.offlineQueue.count()).resolves.toBe(0);
    await expect(db.automationTransactions.get(secondTransactionId)).resolves.toBeUndefined();
  });
});

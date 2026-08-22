import { beforeEach, describe, expect, it, vi } from "vitest";

const boundary = vi.hoisted(() => ({
  current: true,
  generation: "boundary-a",
  owner: "11111111-1111-4111-8111-111111111111",
  vaultKey: "YXV0b21hdGlvbi10ZXN0LXZhdWx0LWtleS0zMmI=", // gitleaks:allow - synthetic test vault key
  vaultRevision: 7,
}));

const mocks = vi.hoisted(() => ({
  commitAutomationTransaction: vi.fn(),
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
  runWithOriginExclusiveLock: vi.fn(async (_name: string, operation: () => unknown) =>
    operation(),
  ),
}));

vi.mock("@/features/journal/journalContentSession", () => ({
  getJournalContentVaultKey: vi.fn(() => boundary.vaultKey),
  getJournalContentVaultRevision: vi.fn(() => boundary.vaultRevision),
}));

vi.mock("../automationCloud", () => ({
  commitAutomationTransaction: mocks.commitAutomationTransaction,
}));

import {
  commitLocalAutomationTransaction,
  processQueuedAutomationCommit,
  recordRevisionId,
} from "../automationRepository";
import { hashAutomationValue } from "../canonicalJson";
import { computeAutomationSourceKey } from "../sourceKey";
import {
  automationCommitQueueIntentSchema,
  AUTOMATION_PREFERENCE_SETTING_KEY,
  type AutomationRevisionEnvelope,
} from "../types";
import { encryptJournalContent } from "@/features/journal/journalCrypto";
import { db } from "@/storage/db";

const OWNER_ID = boundary.owner;
const TRANSACTION_ID = "22222222-2222-4222-8222-222222222222";
const CONSENT_EPOCH = "33333333-3333-4333-8333-333333333333";
const AFTER_REVISION = "44444444-4444-4444-8444-444444444444";

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

async function queuedCommitIntent() {
  const queued = await db.offlineQueue.get(`automation-commit:${TRANSACTION_ID}`);
  if (!queued) throw new Error("expected stable commit outbox");
  return automationCommitQueueIntentSchema.parse(queued.payload);
}

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
    id: "journal-idempotent-1",
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
        entityId: after.id,
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

describe("automation repository idempotency", () => {
  beforeEach(async () => {
    vi.clearAllMocks();
    boundary.current = true;
    boundary.generation = "boundary-a";
    boundary.owner = OWNER_ID;
    boundary.vaultKey = "YXV0b21hdGlvbi10ZXN0LXZhdWx0LWtleS0zMmI="; // gitleaks:allow - synthetic test vault key
    boundary.vaultRevision = 7;

    await db.open();
    await db.transaction(
      "rw",
      [
        db.journalEntries,
        db.settings,
        db.offlineQueue,
        db.automationTransactions,
        db.automationHistoryMarkers,
      ],
      async () => {
        await db.journalEntries.clear();
        await db.settings.clear();
        await db.offlineQueue.clear();
        await db.automationTransactions.clear();
        await db.automationHistoryMarkers.clear();
      },
    );
    await seedGate();
    mocks.commitAutomationTransaction.mockResolvedValue({
      schemaVersion: 1,
      code: "ALREADY_COMMITTED",
      transactionId: TRANSACTION_ID,
      serverSequence: 12,
      historyGeneration: 2,
      completedAt: 110,
    });
  });

  it("coalesces concurrent delivery of one deterministic source", async () => {
    const revision = await journalRevision();
    const [first, second] = await Promise.all([
      commitLocalAutomationTransaction(revision, commitOptions()),
      commitLocalAutomationTransaction(revision, commitOptions()),
    ]);

    expect(second).toEqual(first);
    await expect(db.journalEntries.count()).resolves.toBe(1);
    await expect(
      db.automationTransactions.where("kind").equals("transaction").count(),
    ).resolves.toBe(1);
    await expect(db.offlineQueue.count()).resolves.toBe(1);
    await expect(db.offlineQueue.toArray()).resolves.toEqual([
      expect.objectContaining({
        id: `automation-commit:${TRANSACTION_ID}`,
        operationId: TRANSACTION_ID,
        entityId: TRANSACTION_ID,
        type: "COMMIT_AUTOMATION_TRANSACTION",
      }),
    ]);
  });

  it("converges repeated canonical ALREADY_COMMITTED responses without duplication", async () => {
    await commitLocalAutomationTransaction(await journalRevision(), commitOptions());
    const intent = await queuedCommitIntent();

    await expect(processQueuedAutomationCommit(intent, OWNER_ID)).resolves.toEqual({
      status: "committed",
    });
    await expect(processQueuedAutomationCommit(intent, OWNER_ID)).resolves.toEqual({
      status: "committed",
    });

    expect(mocks.commitAutomationTransaction).toHaveBeenCalledTimes(2);
    expect(mocks.commitAutomationTransaction.mock.calls).toEqual([
      [expect.objectContaining({ transactionId: TRANSACTION_ID }), OWNER_ID],
      [expect.objectContaining({ transactionId: TRANSACTION_ID }), OWNER_ID],
    ]);
    await expect(db.journalEntries.count()).resolves.toBe(1);
    await expect(
      db.automationTransactions.where("kind").equals("transaction").count(),
    ).resolves.toBe(1);
    await expect(db.offlineQueue.count()).resolves.toBe(1);
    await expect(db.automationTransactions.get(TRANSACTION_ID)).resolves.toMatchObject({
      status: "committed",
      serverSequence: 12,
      historyGeneration: 2,
    });
  });

  it("preserves a newer manual target when an offline commit is rejected", async () => {
    const revision = await journalRevision();
    await commitLocalAutomationTransaction(revision, commitOptions());
    const mutation = revision.mutations[0];
    const originalProjection = mutation.after as Record<string, unknown>;
    const manualProjection = {
      ...originalProjection,
      content: "zenflow:journal-content:v1:newer-manual-edit",
      updated_at: 150,
    };
    const manualJournal = {
      id: mutation.entityId,
      date: "2026-08-08",
      title: "",
      content: manualProjection.content,
      stickers: [],
      photoIds: [],
      audioIds: [],
      tags: ["mood"],
      createdAt: 100,
      updatedAt: 150,
    };
    await db.journalEntries.put(manualJournal);
    await db.automationTransactions.put({
      kind: "record_revision",
      id: recordRevisionId("journal", mutation.entityId),
      schemaVersion: 1,
      ownerUserId: OWNER_ID,
      entityType: "journal",
      entityId: mutation.entityId,
      recordExists: true,
      revisionToken: "66666666-6666-4666-8666-666666666666",
      stateHash: await hashAutomationValue(manualProjection),
      mutationGeneration: 2,
      transactionId: null,
      updatedAt: 150,
    });
    mocks.commitAutomationTransaction.mockResolvedValue({
      schemaVersion: 1,
      code: "TARGET_REVISION_CONFLICT",
      transactionId: TRANSACTION_ID,
      currentPreferenceRevision: 4,
      historyGeneration: 2,
    });
    const intent = await queuedCommitIntent();

    await expect(processQueuedAutomationCommit(intent, OWNER_ID)).resolves.toEqual({
      status: "obsolete",
      reason: "server-rejected",
    });

    await expect(db.journalEntries.get(mutation.entityId)).resolves.toEqual(manualJournal);
    await expect(db.automationTransactions.get(TRANSACTION_ID)).resolves.toMatchObject({
      status: "commit_conflict",
    });
  });

  it("rejects a duplicate response that aliases a different transaction", async () => {
    await commitLocalAutomationTransaction(await journalRevision(), commitOptions());
    mocks.commitAutomationTransaction.mockResolvedValue({
      schemaVersion: 1,
      code: "ALREADY_COMMITTED",
      transactionId: "77777777-7777-4777-8777-777777777777",
      serverSequence: 12,
      historyGeneration: 2,
      completedAt: 110,
    });
    const intent = await queuedCommitIntent();

    await expect(processQueuedAutomationCommit(intent, OWNER_ID)).rejects.toMatchObject({
      code: "AUTOMATION_COMMIT_CANONICAL_MISMATCH",
    });
    await expect(db.journalEntries.count()).resolves.toBe(1);
    await expect(db.automationTransactions.get(TRANSACTION_ID)).resolves.toMatchObject({
      status: "commit_pending",
    });
  });
});

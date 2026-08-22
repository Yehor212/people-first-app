import { beforeEach, describe, expect, it, vi } from "vitest";

const state = vi.hoisted(() => ({
  boundaryCurrent: true,
  boundaryGeneration: "boundary-a",
  owner: "11111111-1111-4111-8111-111111111111",
  vaultKey: "YXV0b21hdGlvbi10ZXN0LXZhdWx0LWtleS0zMmI=", // gitleaks:allow - synthetic test vault key
  vaultRevision: 7,
}));

const mocks = vi.hoisted(() => ({
  commitLocalAutomationTransaction: vi.fn(),
  encryptJournalContent: vi.fn(),
  readAutomationTargetSnapshot: vi.fn(),
  validateSyncOwner: vi.fn(),
}));

vi.mock("@/storage/sync/syncOwner", () => ({
  validateSyncOwner: mocks.validateSyncOwner,
}));

vi.mock("@/storage/accountBoundaryRuntime", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/storage/accountBoundaryRuntime")>();
  return {
    ...actual,
    captureOriginAccountBoundaryGeneration: vi.fn(() => state.boundaryGeneration),
    isOriginAccountBoundaryGenerationCurrent: vi.fn(() => state.boundaryCurrent),
  };
});

vi.mock("@/lib/originExclusiveLock", () => ({
  runWithOriginExclusiveLock: vi.fn(async (_name: string, operation: () => unknown) => operation()),
}));

vi.mock("@/features/journal/journalContentSession", () => ({
  getJournalContentVaultKey: vi.fn(() => state.vaultKey),
  getJournalContentVaultRevision: vi.fn(() => state.vaultRevision),
}));

vi.mock("@/features/journal/journalCrypto", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/features/journal/journalCrypto")>();
  return { ...actual, encryptJournalContent: mocks.encryptJournalContent };
});

vi.mock("../automationRepository", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../automationRepository")>();
  return {
    ...actual,
    commitLocalAutomationTransaction: mocks.commitLocalAutomationTransaction,
    readAutomationTargetSnapshot: mocks.readAutomationTargetSnapshot,
  };
});

import { db } from "@/storage/db";
import {
  processAutomationSourceIntent,
  type AutomationCoordinatorDependencies,
} from "../automationCoordinator";
import { computeAutomationSourceKey } from "../sourceKey";
import {
  AUTOMATION_PREFERENCE_SETTING_KEY,
  type AutomationPreference,
  type AutomationSourceIntent,
} from "../types";

const OWNER_ID = state.owner;
const CONSENT_EPOCH = "33333333-3333-4333-8333-333333333333";
const PROTECTED_NOTE = "zenflow:journal-content:v1:coordinator-envelope";

function enabledPreference(): AutomationPreference {
  return {
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
  };
}

async function moodIntent(): Promise<AutomationSourceIntent> {
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
  return {
    kind: "source_pending",
    id: `source_pending:${sourceKey}`,
    schemaVersion: 1,
    ownerUserId: OWNER_ID,
    consentEpoch: CONSENT_EPOCH,
    accountBoundaryGeneration: state.boundaryGeneration,
    source,
    candidateRuleIds: ["mood.note-to-journal.v1"],
    sourceKey,
    createdAt: 100,
    updatedAt: 100,
  };
}

function dependencies(
  resolveFreshServiceGate = vi.fn(async () => ({
    allowed: true as const,
    code: "SERVICE_ENABLED" as const,
  })),
): AutomationCoordinatorDependencies {
  return {
    deviceId: "android-install-1",
    getLocalizedMoodJournalTitle: () => "Mood note",
    resolveFreshServiceGate,
  };
}

async function seed(intent: AutomationSourceIntent, note = "  <b>Slow breath</b> {today}  ") {
  await db.settings.put({ key: AUTOMATION_PREFERENCE_SETTING_KEY, value: enabledPreference() });
  await db.automationHistoryMarkers.put({
    schemaVersion: 1,
    ownerUserId: OWNER_ID,
    historyGeneration: 2,
    snapshotSequence: 0,
    lastAppliedServerSequence: 0,
    bootstrapCompletedAt: 90,
    updatedAt: 90,
  });
  await db.moods.put({
    id: intent.source.id,
    mood: "good",
    note,
    date: "2026-08-08",
    timestamp: 95,
    updatedAt: 100,
  });
  await db.automationTransactions.put(intent);
}

describe("automation source coordinator", () => {
  beforeEach(async () => {
    vi.clearAllMocks();
    state.boundaryCurrent = true;
    state.boundaryGeneration = "boundary-a";
    state.owner = OWNER_ID;
    state.vaultKey = "YXV0b21hdGlvbi10ZXN0LXZhdWx0LWtleS0zMmI="; // gitleaks:allow - synthetic test vault key
    state.vaultRevision = 7;
    mocks.validateSyncOwner.mockResolvedValue(OWNER_ID);
    mocks.encryptJournalContent.mockResolvedValue(PROTECTED_NOTE);
    mocks.readAutomationTargetSnapshot.mockImplementation(
      async (identity: { entityType: string; entityId: string }) => ({
        ...identity,
        value: null,
        revisionToken: null,
        automationOwned: false,
      }),
    );
    mocks.commitLocalAutomationTransaction.mockImplementation(async (revision) => ({
      id: revision.transactionId,
      status: "commit_pending",
    }));
    await db.open();
    await db.transaction(
      "rw",
      [
        db.moods,
        db.habits,
        db.focusSessions,
        db.journalEntries,
        db.settings,
        db.automationTransactions,
        db.automationHistoryMarkers,
      ],
      async () => {
        await db.moods.clear();
        await db.habits.clear();
        await db.focusSessions.clear();
        await db.journalEntries.clear();
        await db.settings.clear();
        await db.automationTransactions.clear();
        await db.automationHistoryMarkers.clear();
      },
    );
  });

  it("protects sanitized mood text, rechecks the gate, commits, then removes the exact intent", async () => {
    const intent = await moodIntent();
    await seed(intent);
    const gate = vi.fn(async () => ({ allowed: true as const, code: "SERVICE_ENABLED" as const }));

    await expect(
      processAutomationSourceIntent(intent.id, dependencies(gate), OWNER_ID),
    ).resolves.toEqual({
      status: "committed",
      transactionId: "56dfaa5d-50e2-8dfe-98cf-d8109fe15230",
    });

    expect(gate).toHaveBeenCalledTimes(2);
    expect(mocks.encryptJournalContent).toHaveBeenCalledWith("Slow breath today", state.vaultKey);
    expect(mocks.readAutomationTargetSnapshot).toHaveBeenCalledWith(
      {
        entityType: "journal",
        entityId: "62a9243c-5054-87b5-be9c-9e68d1a08a6a",
      },
      OWNER_ID,
    );
    expect(mocks.commitLocalAutomationTransaction).toHaveBeenCalledWith(
      expect.objectContaining({
        transactionId: "56dfaa5d-50e2-8dfe-98cf-d8109fe15230",
        sourceKey: intent.sourceKey,
      }),
      {
        expectedOwnerUserId: OWNER_ID,
        accountBoundaryGeneration: state.boundaryGeneration,
        vaultKey: state.vaultKey,
        vaultRevision: state.vaultRevision,
        expectedPreferenceRevision: 4,
        expectedHistoryGeneration: 2,
        deviceId: "android-install-1",
      },
    );
    const committedRevision = mocks.commitLocalAutomationTransaction.mock.calls[0][0];
    expect(JSON.stringify(committedRevision)).not.toContain("Slow breath");
    await expect(db.automationTransactions.get(intent.id)).resolves.toBeUndefined();
  });

  it("retains the intent and makes no write when the second fresh service check closes", async () => {
    const intent = await moodIntent();
    await seed(intent);
    const gate = vi
      .fn()
      .mockResolvedValueOnce({ allowed: true, code: "SERVICE_ENABLED" })
      .mockResolvedValueOnce({ allowed: false, code: "SERVICE_CONTROL_STALE" });

    await expect(
      processAutomationSourceIntent(intent.id, dependencies(gate), OWNER_ID),
    ).resolves.toEqual({ status: "deferred", code: "SERVICE_CONTROL_STALE" });
    expect(mocks.commitLocalAutomationTransaction).not.toHaveBeenCalled();
    await expect(db.automationTransactions.get(intent.id)).resolves.toEqual(intent);
  });

  it("retains the intent while the vault is unavailable", async () => {
    const intent = await moodIntent();
    await seed(intent);
    state.vaultKey = "";

    await expect(
      processAutomationSourceIntent(intent.id, dependencies(), OWNER_ID),
    ).resolves.toEqual({ status: "deferred", code: "VAULT_LOCKED" });
    expect(mocks.encryptJournalContent).not.toHaveBeenCalled();
    expect(mocks.commitLocalAutomationTransaction).not.toHaveBeenCalled();
    await expect(db.automationTransactions.get(intent.id)).resolves.toEqual(intent);
  });

  it("removes an obsolete epoch intent without deriving a record", async () => {
    const intent = await moodIntent();
    await seed(intent);
    await db.settings.put({
      key: AUTOMATION_PREFERENCE_SETTING_KEY,
      value: {
        ...enabledPreference(),
        consentEpoch: "55555555-5555-4555-8555-555555555555",
      },
    });

    await expect(
      processAutomationSourceIntent(intent.id, dependencies(), OWNER_ID),
    ).resolves.toEqual({ status: "noop", code: "PREFERENCE_DISABLED" });
    expect(mocks.encryptJournalContent).not.toHaveBeenCalled();
    expect(mocks.commitLocalAutomationTransaction).not.toHaveBeenCalled();
    await expect(db.automationTransactions.get(intent.id)).resolves.toBeUndefined();
  });

  it("removes a permanent empty-source no-op without writing a transaction", async () => {
    const intent = await moodIntent();
    await seed(intent, "<script></script>");

    await expect(
      processAutomationSourceIntent(intent.id, dependencies(), OWNER_ID),
    ).resolves.toEqual({ status: "noop", code: "SOURCE_EMPTY" });
    expect(mocks.commitLocalAutomationTransaction).not.toHaveBeenCalled();
    await expect(db.automationTransactions.get(intent.id)).resolves.toBeUndefined();
  });

  it("removes an exact source revision whose deterministic transaction was forgotten", async () => {
    const intent = await moodIntent();
    await seed(intent);
    const marker = await db.automationHistoryMarkers.get(OWNER_ID);
    await db.automationHistoryMarkers.put({
      ...marker!,
      purgedTransactionIds: ["56dfaa5d-50e2-8dfe-98cf-d8109fe15230"],
    });

    await expect(
      processAutomationSourceIntent(intent.id, dependencies(), OWNER_ID),
    ).resolves.toEqual({ status: "noop", code: "SOURCE_PURGED" });

    expect(mocks.commitLocalAutomationTransaction).not.toHaveBeenCalled();
    await expect(db.automationTransactions.get(intent.id)).resolves.toBeUndefined();
  });
});

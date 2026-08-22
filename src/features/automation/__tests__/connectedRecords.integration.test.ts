import { beforeEach, describe, expect, it, vi } from "vitest";

const runtime = vi.hoisted(() => ({
  boundaryCurrent: true,
  boundaryGeneration: "boundary-a",
  ownerUserId: "11111111-1111-4111-8111-111111111111",
  vaultKey: "YXV0b21hdGlvbi10ZXN0LXZhdWx0LWtleS0zMmI=", // gitleaks:allow - synthetic test vault key
  vaultRevision: 7,
}));

const mocks = vi.hoisted(() => ({
  commitAutomationTransaction: vi.fn(),
  supabaseFrom: vi.fn(),
}));

vi.mock("@/storage/sync/syncOwner", () => ({
  validateSyncOwner: vi.fn(async (expectedOwnerUserId?: string) =>
    !expectedOwnerUserId || expectedOwnerUserId === runtime.ownerUserId
      ? runtime.ownerUserId
      : null,
  ),
}));

vi.mock("@/storage/accountBoundaryRuntime", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/storage/accountBoundaryRuntime")>();
  return {
    ...actual,
    assertOriginAccountBoundaryGeneration: vi.fn((generation: string) => {
      if (!runtime.boundaryCurrent || generation !== runtime.boundaryGeneration) {
        throw new actual.AccountBoundaryChangedError();
      }
    }),
    captureOriginAccountBoundaryGeneration: vi.fn(() => runtime.boundaryGeneration),
    isOriginAccountBoundaryGenerationCurrent: vi.fn(
      (generation: string) =>
        runtime.boundaryCurrent && generation === runtime.boundaryGeneration,
    ),
  };
});

vi.mock("@/lib/originExclusiveLock", () => ({
  runWithOriginExclusiveLock: vi.fn(
    async (_name: string, operation: () => unknown) => operation(),
  ),
}));

vi.mock("@/features/journal/journalContentSession", () => ({
  getJournalContentVaultKey: vi.fn(() => runtime.vaultKey),
  getJournalContentVaultRevision: vi.fn(() => runtime.vaultRevision),
}));

vi.mock("@/lib/supabaseClient", () => ({
  supabase: { from: mocks.supabaseFrom },
  getCurrentSessionUserId: vi.fn(async () => runtime.ownerUserId),
  getCurrentUserId: vi.fn(async () => runtime.ownerUserId),
}));

vi.mock("@/lib/logger", () => ({
  logger: {
    log: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    sync: vi.fn(),
    auth: vi.fn(),
  },
}));

vi.mock("../automationCloud", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../automationCloud")>();
  return {
    ...actual,
    commitAutomationTransaction: mocks.commitAutomationTransaction,
  };
});

import { isEncryptedJournalContent } from "@/features/journal/journalCrypto";
import type { JournalEntry } from "@/features/journal/types";
import { db } from "@/storage/db";
import { syncSetting } from "@/storage/sync/syncSettings";
import { ENTRY, type Habit } from "@/types";
import { hashAutomationValue } from "../canonicalJson";
import { processAutomationSourceIntent } from "../automationCoordinator";
import {
  persistPrimaryRecordWithAutomationIntent,
  processQueuedAutomationCommit,
  recordRevisionId,
} from "../automationRepository";
import {
  persistFocusSourceRecord,
  persistHabitSourceRecord,
  persistMoodSourceRecord,
  prepareJournalAutomationSourceIntent,
} from "../automationSourcePersistence";
import {
  AUTOMATION_PREFERENCE_SETTING_KEY,
  type AutomationCommitQueueIntent,
  type AutomationPreference,
  type AutomationRuleId,
} from "../types";

const OWNER_ID = runtime.ownerUserId;
const CONSENT_EPOCH_1 = "22222222-2222-4222-8222-222222222222";
const CONSENT_EPOCH_2 = "33333333-3333-4333-8333-333333333333";
const FOCUS_HABIT_ID = "77777777-7777-4777-8777-777777777777";
const DEVICE_ID = "android-install-integration";

function coordinatorDependencies() {
  return {
    deviceId: DEVICE_ID,
    getLocalizedMoodJournalTitle: () => "Mood note",
    resolveFreshServiceGate: vi.fn(async () => ({
      allowed: true as const,
      code: "SERVICE_ENABLED" as const,
    })),
  };
}

function preference(input: {
  rules: AutomationRuleId[];
  epoch?: string;
  revision?: number;
  focusHabitId?: string | null;
  planningHabitMappings?: Record<string, string>;
}): AutomationPreference {
  const epoch = input.epoch ?? CONSENT_EPOCH_1;
  const revision = input.revision ?? 4;
  return {
    schemaVersion: 1,
    enabled: true,
    serverRevision: revision,
    consentEpoch: epoch,
    consentedAt: revision * 10,
    revokedAt: null,
    revocationPending: false,
    enabledRuleIds: input.rules,
    focusHabitId: input.focusHabitId ?? null,
    focusMinimumMinutes: 25,
    planningHabitMappings: input.planningHabitMappings ?? {},
    updatedAt: revision * 10,
  };
}

async function seedPreference(value: AutomationPreference): Promise<void> {
  await db.settings.put({ key: AUTOMATION_PREFERENCE_SETTING_KEY, value });
}

async function seedHistoryMarker(): Promise<void> {
  await db.automationHistoryMarkers.put({
    schemaVersion: 1,
    ownerUserId: OWNER_ID,
    historyGeneration: 2,
    snapshotSequence: 0,
    lastAppliedServerSequence: 0,
    bootstrapCompletedAt: 30,
    updatedAt: 30,
  });
}

function habit(input: Partial<Habit> = {}): Habit {
  return {
    id: FOCUS_HABIT_ID,
    name: "Private habit",
    icon: "check",
    color: 0,
    position: 0,
    createdAt: 1,
    habitType: "boolean",
    frequency: { numerator: 1, denominator: 1 },
    question: "",
    description: "Private description",
    isArchived: false,
    targetValue: 0,
    targetType: "atLeast",
    unit: "",
    entries: {},
    reminders: [],
    ...input,
  };
}

async function transactionRows() {
  return db.automationTransactions.where("kind").equals("transaction").toArray();
}

async function commitQueueRows() {
  return db.offlineQueue
    .where("type")
    .equals("COMMIT_AUTOMATION_TRANSACTION")
    .toArray();
}

describe("connected records local integration", () => {
  beforeEach(async () => {
    vi.clearAllMocks();
    runtime.boundaryCurrent = true;
    runtime.boundaryGeneration = "boundary-a";
    runtime.ownerUserId = OWNER_ID;
    runtime.vaultKey = "YXV0b21hdGlvbi10ZXN0LXZhdWx0LWtleS0zMmI="; // gitleaks:allow - synthetic test vault key
    runtime.vaultRevision = 7;
    Object.defineProperty(navigator, "onLine", {
      configurable: true,
      value: true,
    });
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
    await seedHistoryMarker();
  });

  it("commits mood-to-journal once and preserves the durable outbox across restart", async () => {
    await seedPreference(preference({ rules: ["mood.note-to-journal.v1"] }));
    const source = {
      id: "mood-integration-1",
      mood: "good" as const,
      note: "  <b>Private reflection</b> {today}  ",
      date: "2026-08-08",
      timestamp: 100,
      updatedAt: 100,
    };

    const persisted = await persistMoodSourceRecord(source);
    expect(persisted.intentId).not.toBeNull();
    const first = await processAutomationSourceIntent(
      persisted.intentId!,
      coordinatorDependencies(),
      OWNER_ID,
    );

    expect(first).toMatchObject({ status: "committed" });
    const journals = await db.journalEntries.toArray();
    expect(journals).toHaveLength(1);
    expect(journals[0]).toMatchObject({
      date: source.date,
      title: "Mood note",
      tags: [],
    });
    expect(isEncryptedJournalContent(journals[0].content)).toBe(true);
    expect(JSON.stringify(await transactionRows())).not.toContain("Private reflection");
    expect(await transactionRows()).toHaveLength(1);
    expect(await commitQueueRows()).toHaveLength(1);

    db.close();
    await db.open();
    await expect(
      processAutomationSourceIntent(
        persisted.intentId!,
        coordinatorDependencies(),
        OWNER_ID,
      ),
    ).resolves.toEqual({ status: "missing" });
    expect(await transactionRows()).toHaveLength(1);
    expect(await commitQueueRows()).toHaveLength(1);
    expect(await db.journalEntries.count()).toBe(1);
  });

  it("commits journal-to-mood without copying journal prose or touching another habit", async () => {
    await seedPreference(preference({ rules: ["journal.mood-to-checkin.v1"] }));
    const unrelatedHabit = habit({ id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa" });
    await db.habits.put(unrelatedHabit);
    const entry: JournalEntry = {
      id: "journal-integration-1",
      date: "2026-08-08",
      title: "Private title",
      content: "Private journal prose",
      stickers: [],
      photoIds: [],
      audioIds: [],
      mood: "bad",
      tags: [],
      createdAt: 110,
      updatedAt: 110,
    };
    const intent = await prepareJournalAutomationSourceIntent(entry, OWNER_ID);
    expect(intent).not.toBeNull();
    await persistPrimaryRecordWithAutomationIntent(entry, intent!, OWNER_ID);

    await expect(
      processAutomationSourceIntent(intent!.id, coordinatorDependencies(), OWNER_ID),
    ).resolves.toMatchObject({ status: "committed" });

    const derivedMoods = await db.moods.toArray();
    expect(derivedMoods).toHaveLength(1);
    expect(derivedMoods[0]).toMatchObject({
      mood: "bad",
      date: entry.date,
    });
    expect(derivedMoods[0]).not.toHaveProperty("note");
    expect(JSON.stringify(await transactionRows())).not.toContain(entry.title);
    expect(JSON.stringify(await transactionRows())).not.toContain(entry.content);
    await expect(db.habits.get(unrelatedHabit.id)).resolves.toEqual(unrelatedHabit);
    await expect(db.journalEntries.get(entry.id)).resolves.toEqual(entry);
  });

  it("commits focus-to-habit only to the explicitly mapped completion", async () => {
    const mappedHabit = habit();
    const unrelatedHabit = habit({ id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa" });
    await db.habits.bulkPut([mappedHabit, unrelatedHabit]);
    await seedPreference(
      preference({
        rules: ["focus.to-mapped-habit.v1"],
        focusHabitId: mappedHabit.id,
      }),
    );
    const session = {
      id: "focus-integration-1",
      duration: 25,
      completedAt: 120,
      date: "2026-08-08",
      label: "Private project label",
      status: "completed" as const,
      updatedAt: 120,
    };

    const persisted = await persistFocusSourceRecord(session);
    expect(persisted.intentId).not.toBeNull();
    await expect(
      processAutomationSourceIntent(
        persisted.intentId!,
        coordinatorDependencies(),
        OWNER_ID,
      ),
    ).resolves.toMatchObject({ status: "committed" });

    await expect(db.habits.get(mappedHabit.id)).resolves.toMatchObject({
      entries: { "2026-08-08": { value: ENTRY.YES_MANUAL } },
    });
    await expect(db.habits.get(unrelatedHabit.id)).resolves.toEqual(unrelatedHabit);
    await expect(db.focusSessions.get(session.id)).resolves.toEqual(session);
    expect(JSON.stringify(await transactionRows())).not.toContain(session.label);
    expect(await commitQueueRows()).toHaveLength(1);
  });

  it("commits habit-to-planning without changing an unrelated manual event", async () => {
    const completedAt = Date.parse("2026-08-08T12:00:00.000Z");
    const sourceHabit = habit({
      id: "habit-source-integration",
      entries: {
        "2026-08-08": {
          value: ENTRY.YES_MANUAL,
          source: "quickTap",
          loggedAt: "2026-08-08T12:00:00.000Z",
        },
      },
      updatedAt: "2026-08-08T12:00:00.000Z",
    });
    const manualEvent = {
      id: "user-owned-planning-event",
      title: "Private plan",
      startHour: 7,
      startMinute: 30,
      endHour: 8,
      endMinute: 0,
      color: "#112233",
      date: "2026-08-08",
      source: "manual" as const,
      isEditable: true,
    };
    const ownedEvent = {
      id: "owned-planning-event",
      title: "Dedicated habit block",
      startHour: 8,
      startMinute: 0,
      endHour: 8,
      endMinute: 30,
      color: "#334455",
      date: "2026-08-08",
      source: "habit" as const,
      habitId: sourceHabit.id,
      isAutoGenerated: true,
      isEditable: false,
      completed: false,
    };
    const schedule = [manualEvent, ownedEvent];
    await db.settings.put({ key: "zenflow-schedule-events", value: schedule });
    await db.automationTransactions.put({
      kind: "record_revision",
      id: recordRevisionId("setting", "zenflow-schedule-events"),
      schemaVersion: 1,
      ownerUserId: OWNER_ID,
      entityType: "setting",
      entityId: "zenflow-schedule-events",
      recordExists: true,
      revisionToken: "44444444-4444-4444-8444-444444444444",
      stateHash: await hashAutomationValue(schedule),
      mutationGeneration: 1,
      transactionId: null,
      updatedAt: completedAt - 1,
    });
    await seedPreference(
      preference({
        rules: ["habit.to-planning.v1"],
        planningHabitMappings: { [sourceHabit.id]: ownedEvent.id },
      }),
    );

    const sourceReady = vi.fn();
    window.addEventListener("zenflow:automation-source-ready", sourceReady);
    const persisted = await persistHabitSourceRecord(sourceHabit, "2026-08-08");
    window.removeEventListener("zenflow:automation-source-ready", sourceReady);
    expect(persisted.intentId).not.toBeNull();
    expect(sourceReady).toHaveBeenCalledTimes(1);
    await expect(
      processAutomationSourceIntent(
        persisted.intentId!,
        coordinatorDependencies(),
        OWNER_ID,
      ),
    ).resolves.toMatchObject({ status: "committed" });

    await expect(db.habits.get(sourceHabit.id)).resolves.toEqual(sourceHabit);
    await expect(db.settings.get("zenflow-schedule-events")).resolves.toEqual({
      key: "zenflow-schedule-events",
      value: [manualEvent, { ...ownedEvent, completed: true, completedAt }],
    });
    expect(await transactionRows()).toHaveLength(1);
    expect(await commitQueueRows()).toHaveLength(1);
    expect(JSON.stringify(await transactionRows())).not.toContain(manualEvent.title);
    expect(JSON.stringify(await transactionRows())).not.toContain(ownedEvent.title);
    await expect(db.automationTransactions.get(persisted.intentId!)).resolves.toBeUndefined();
  });

  it("discards an E1 pending intent after E2 re-consent without losing its primary record", async () => {
    await seedPreference(
      preference({ rules: ["mood.note-to-journal.v1"], epoch: CONSENT_EPOCH_1 }),
    );
    const source = {
      id: "mood-epoch-pending",
      mood: "okay" as const,
      note: "Private pending note",
      date: "2026-08-08",
      timestamp: 130,
      updatedAt: 130,
    };
    const persisted = await persistMoodSourceRecord(source);
    expect(persisted.intentId).not.toBeNull();
    await seedPreference(
      preference({
        rules: ["mood.note-to-journal.v1"],
        epoch: CONSENT_EPOCH_2,
        revision: 5,
      }),
    );

    await expect(
      processAutomationSourceIntent(
        persisted.intentId!,
        coordinatorDependencies(),
        OWNER_ID,
      ),
    ).resolves.toEqual({ status: "noop", code: "PREFERENCE_DISABLED" });

    await expect(db.moods.get(source.id)).resolves.toEqual(source);
    expect(await db.journalEntries.count()).toBe(0);
    expect(await transactionRows()).toHaveLength(0);
    expect(await commitQueueRows()).toHaveLength(0);
    await expect(db.automationTransactions.get(persisted.intentId!)).resolves.toBeUndefined();
  });

  it("compensates an E1 optimistic commit rejected after E2 re-consent", async () => {
    await seedPreference(
      preference({ rules: ["mood.note-to-journal.v1"], epoch: CONSENT_EPOCH_1 }),
    );
    const source = {
      id: "mood-epoch-committed",
      mood: "good" as const,
      note: "Private optimistic note",
      date: "2026-08-08",
      timestamp: 140,
      updatedAt: 140,
    };
    const persisted = await persistMoodSourceRecord(source);
    const localResult = await processAutomationSourceIntent(
      persisted.intentId!,
      coordinatorDependencies(),
      OWNER_ID,
    );
    if (localResult.status !== "committed") {
      throw new Error("Expected an optimistic connected-record commit");
    }
    const queueRows = await commitQueueRows();
    expect(queueRows).toHaveLength(1);
    await seedPreference(
      preference({
        rules: ["mood.note-to-journal.v1"],
        epoch: CONSENT_EPOCH_2,
        revision: 5,
      }),
    );
    mocks.commitAutomationTransaction.mockResolvedValue({
      schemaVersion: 1,
      code: "STALE_CONSENT_EPOCH",
      transactionId: localResult.transactionId,
      currentPreferenceRevision: 5,
      historyGeneration: 2,
    });

    await expect(
      processQueuedAutomationCommit(
        queueRows[0].payload as AutomationCommitQueueIntent,
        OWNER_ID,
      ),
    ).resolves.toEqual({ status: "obsolete", reason: "server-rejected" });

    await expect(db.moods.get(source.id)).resolves.toEqual(source);
    expect(await db.journalEntries.count()).toBe(0);
    await expect(
      db.automationTransactions.get(localResult.transactionId),
    ).resolves.toMatchObject({ status: "revoked", consentEpoch: CONSENT_EPOCH_1 });
    await expect(db.settings.get(AUTOMATION_PREFERENCE_SETTING_KEY)).resolves.toMatchObject({
      value: { consentEpoch: CONSENT_EPOCH_2, serverRevision: 5 },
    });
  });

  it("drops stale generic-settings replay for the dedicated consent key", async () => {
    const currentPreference = preference({
      rules: ["mood.note-to-journal.v1"],
      epoch: CONSENT_EPOCH_2,
      revision: 5,
    });
    await seedPreference(currentPreference);
    Object.defineProperty(navigator, "onLine", {
      configurable: true,
      value: false,
    });

    await syncSetting(
      AUTOMATION_PREFERENCE_SETTING_KEY,
      preference({
        rules: ["mood.note-to-journal.v1"],
        epoch: CONSENT_EPOCH_1,
        revision: 4,
      }),
      OWNER_ID,
    );

    await expect(db.settings.get(AUTOMATION_PREFERENCE_SETTING_KEY)).resolves.toEqual({
      key: AUTOMATION_PREFERENCE_SETTING_KEY,
      value: currentPreference,
    });
    expect(mocks.supabaseFrom).not.toHaveBeenCalled();
    expect(await db.offlineQueue.count()).toBe(0);
  });
});

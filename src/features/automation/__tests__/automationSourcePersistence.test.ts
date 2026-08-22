import { beforeEach, describe, expect, it, vi } from "vitest";

const boundary = vi.hoisted((): { current: boolean; generation: string; owner: string | null } => ({
  current: true,
  generation: "boundary-a",
  owner: "11111111-1111-4111-8111-111111111111",
}));

const originLocks = vi.hoisted(() => ({
  tails: new Map<string, Promise<void>>(),
}));

vi.mock("@/storage/sync/syncOwner", () => ({
  validateSyncOwner: vi.fn(async () => boundary.owner),
}));

vi.mock("@/storage/accountBoundaryRuntime", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/storage/accountBoundaryRuntime")>();
  return {
    ...actual,
    assertOriginAccountBoundaryGeneration: vi.fn((generation: string) => {
      if (!boundary.current || generation !== boundary.generation) {
        throw new actual.AccountBoundaryChangedError();
      }
    }),
    captureOriginAccountBoundaryGeneration: vi.fn(() => boundary.generation),
    isOriginAccountBoundaryGenerationCurrent: vi.fn(
      (generation: string) => boundary.current && generation === boundary.generation
    ),
  };
});

vi.mock("@/lib/originExclusiveLock", () => ({
  runWithOriginExclusiveLock: vi.fn(async <T>(name: string, operation: () => T | Promise<T>) => {
    const previous = originLocks.tails.get(name) ?? Promise.resolve();
    let release = (): void => undefined;
    const held = new Promise<void>((resolve) => {
      release = resolve;
    });
    const tail = previous.catch(() => undefined).then(() => held);
    originLocks.tails.set(name, tail);
    await previous.catch(() => undefined);
    try {
      return await operation();
    } finally {
      release();
      if (originLocks.tails.get(name) === tail) originLocks.tails.delete(name);
    }
  }),
}));

import {
  persistFocusSourceRecord,
  persistHabitSourceRecord,
  persistMoodSourceRecord,
  recoverDeferredAutomationSourceIntents,
} from "../automationSourcePersistence";
import { markAutomationSourceRescanRequiredInCurrentTransaction } from "../automationRepository";
import { hashAutomationValue } from "../canonicalJson";
import { AUTOMATION_PREFERENCE_SETTING_KEY, AUTOMATION_SOURCE_RESCAN_SETTING_KEY } from "../types";
import { db, type OfflineQueueItem } from "@/storage/db";
import { offlineQueue } from "@/lib/offlineQueue";
import { notifyAccountSessionTransition } from "@/storage/accountBoundaryRuntime";
import { ACCOUNT_BOUNDARY_DATA_WRITE_LOCK } from "@/storage/accountBoundaryRuntime";
import { runWithOriginExclusiveLock } from "@/lib/originExclusiveLock";
import { SK } from "@/lib/storageKeys";
import type { FocusSession, Habit } from "@/types";
import type { PendingFocusCommit } from "@/types/focusTimerTypes";

const OWNER_ID = "11111111-1111-4111-8111-111111111111";
const CONSENT_EPOCH = "33333333-3333-4333-8333-333333333333";
const HABIT_ID = "44444444-4444-4444-8444-444444444444";

function rejectNextSourceIntentPut(): ReturnType<typeof vi.spyOn> {
  const originalPut = db.automationTransactions.put.bind(db.automationTransactions);
  let rejected = false;
  return vi.spyOn(db.automationTransactions, "put").mockImplementation((value, key) => {
    if (!rejected && value.kind === "source_pending") {
      rejected = true;
      return originalPut(value, key).then(() => {
        throw new Error("source intent storage unavailable");
      });
    }
    return originalPut(value, key);
  });
}

async function seedPreference(enabled: boolean): Promise<void> {
  await db.settings.put({
    key: AUTOMATION_PREFERENCE_SETTING_KEY,
    value: {
      schemaVersion: 1,
      enabled,
      serverRevision: enabled ? 4 : 5,
      consentEpoch: enabled ? CONSENT_EPOCH : null,
      consentedAt: enabled ? 90 : null,
      revokedAt: enabled ? null : 95,
      revocationPending: false,
      enabledRuleIds: enabled ? ["mood.note-to-journal.v1"] : [],
      focusHabitId: null,
      focusMinimumMinutes: 25,
      planningHabitMappings: {},
      updatedAt: enabled ? 90 : 95,
    },
  });
}

async function seedFocusPreference(enabled: boolean): Promise<void> {
  await db.settings.put({
    key: AUTOMATION_PREFERENCE_SETTING_KEY,
    value: {
      schemaVersion: 1,
      enabled,
      serverRevision: enabled ? 6 : 7,
      consentEpoch: enabled ? CONSENT_EPOCH : null,
      consentedAt: enabled ? 90 : null,
      revokedAt: enabled ? null : 95,
      revocationPending: false,
      enabledRuleIds: enabled ? ["focus.to-mapped-habit.v1"] : [],
      focusHabitId: enabled ? "77777777-7777-4777-8777-777777777777" : null,
      focusMinimumMinutes: 25,
      planningHabitMappings: {},
      updatedAt: enabled ? 90 : 95,
    },
  });
}

async function seedHabitPreference(enabled: boolean): Promise<void> {
  await db.settings.put({
    key: AUTOMATION_PREFERENCE_SETTING_KEY,
    value: {
      schemaVersion: 1,
      enabled,
      serverRevision: enabled ? 8 : 9,
      consentEpoch: enabled ? CONSENT_EPOCH : null,
      consentedAt: enabled ? 90 : null,
      revokedAt: enabled ? null : 95,
      revocationPending: false,
      enabledRuleIds: enabled ? ["habit.to-planning.v1"] : [],
      focusHabitId: null,
      focusMinimumMinutes: 25,
      planningHabitMappings: enabled ? { [HABIT_ID]: "planning-block-1" } : {},
      updatedAt: enabled ? 90 : 95,
    },
  });
}

function completedHabit(): Habit {
  return {
    id: HABIT_ID,
    name: "Private habit name",
    icon: "book",
    color: 0,
    position: 0,
    createdAt: 1,
    habitType: "boolean" as const,
    frequency: { numerator: 1, denominator: 1 },
    question: "",
    description: "Private description",
    isArchived: false,
    targetValue: 0,
    targetType: "atLeast" as const,
    unit: "",
    entries: {
      "2026-08-08": {
        value: 2,
        loggedAt: "2026-08-08T12:00:00.000Z",
        source: "quickTap" as const,
      },
    },
    reminders: [],
    updatedAt: "2026-08-08T12:00:00.000Z",
  };
}

describe("mood source persistence", () => {
  beforeEach(async () => {
    originLocks.tails.clear();
    boundary.current = true;
    boundary.generation = "boundary-a";
    boundary.owner = OWNER_ID;
    localStorage.clear();
    await db.open();
    await db.transaction(
      "rw",
      [db.moods, db.focusSessions, db.settings, db.automationTransactions, db.offlineQueue],
      async () => {
        await db.moods.clear();
        await db.focusSessions.clear();
        await db.settings.clear();
        await db.automationTransactions.clear();
        await db.offlineQueue.clear();
      }
    );
  });

  it("atomically persists an eligible mood and a prose-free owner-bound intent", async () => {
    await seedPreference(true);
    const wake = vi.spyOn(offlineQueue, "wakeFromDurableStorage").mockResolvedValue(undefined);
    const mood = {
      id: "55555555-5555-4555-8555-555555555551",
      mood: "good" as const,
      note: "Private user-authored note",
      date: "2026-08-08",
      timestamp: 120,
      updatedAt: 120,
    };
    await db.automationTransactions.put({
      kind: "record_revision",
      id: `record_revision:mood:${mood.id}`,
      schemaVersion: 1,
      ownerUserId: OWNER_ID,
      entityType: "mood",
      entityId: mood.id,
      recordExists: true,
      revisionToken: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
      stateHash: await hashAutomationValue({ previous: true }),
      mutationGeneration: 1,
      transactionId: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
      updatedAt: 1,
    });

    const result = await persistMoodSourceRecord(mood);

    expect(result).toMatchObject({ accountBoundaryGeneration: "boundary-a" });
    expect(result.intentId).toMatch(/^source_pending:sha256:/);
    await expect(db.moods.get(mood.id)).resolves.toEqual(mood);
    if (!result.intentId) throw new Error("Expected an eligible source intent");
    const intent = await db.automationTransactions.get(result.intentId);
    expect(intent).toMatchObject({
      kind: "source_pending",
      ownerUserId: OWNER_ID,
      consentEpoch: CONSENT_EPOCH,
      source: {
        type: "mood",
        id: mood.id,
        revision: "updatedAt:120",
      },
    });
    expect(JSON.stringify(intent)).not.toContain(mood.note);
    await expect(
      db.automationTransactions.get(`record_revision:mood:${mood.id}`)
    ).resolves.toBeUndefined();
    await expect(db.offlineQueue.where("entityId").equals(mood.id).toArray()).resolves.toEqual([
      expect.objectContaining({
        type: "UPDATE_MOOD",
        ownerUserId: OWNER_ID,
        priority: "critical",
      }),
    ]);
    expect(wake).toHaveBeenCalledTimes(1);
  });

  it("persists a primary mood without an intent when the rule has no eligible note", async () => {
    await seedPreference(true);
    const mood = {
      id: "55555555-5555-4555-8555-555555555552",
      mood: "okay" as const,
      date: "2026-08-08",
      timestamp: 130,
      updatedAt: 130,
    };

    await expect(persistMoodSourceRecord(mood)).resolves.toEqual({
      accountBoundaryGeneration: "boundary-a",
      intentId: null,
      syncOutboxPersisted: true,
    });

    await expect(db.moods.get(mood.id)).resolves.toEqual(mood);
    await expect(
      db.automationTransactions.where("kind").equals("source_pending").count()
    ).resolves.toBe(0);
  });

  it("keeps a legacy mood primary without creating an impossible granular outbox row", async () => {
    await seedPreference(false);
    const mood = {
      id: "legacy-mood-id",
      mood: "okay" as const,
      date: "2026-08-08",
      timestamp: 135,
      updatedAt: 135,
    };

    await expect(persistMoodSourceRecord(mood)).resolves.toEqual({
      accountBoundaryGeneration: "boundary-a",
      intentId: null,
      syncOutboxPersisted: false,
    });
    await expect(db.moods.get(mood.id)).resolves.toEqual(mood);
    await expect(db.offlineQueue.count()).resolves.toBe(0);
  });

  it("keeps the primary mood when an enabled rule has no authenticated owner", async () => {
    await seedPreference(true);
    boundary.owner = null;
    const mood = {
      id: "mood-source-3",
      mood: "bad" as const,
      note: "Still belongs to the local user action",
      date: "2026-08-08",
      timestamp: 140,
      updatedAt: 140,
    };

    await expect(persistMoodSourceRecord(mood)).resolves.toEqual({
      accountBoundaryGeneration: "boundary-a",
      intentId: null,
      syncOutboxPersisted: false,
    });
    await expect(db.moods.get(mood.id)).resolves.toEqual(mood);
    await expect(
      db.automationTransactions.where("kind").equals("source_pending").count()
    ).resolves.toBe(0);
  });

  it("fails closed without publishing a stale account-generation write", async () => {
    await seedPreference(false);
    boundary.current = false;

    await expect(
      persistMoodSourceRecord({
        id: "mood-source-4",
        mood: "great",
        date: "2026-08-08",
        timestamp: 150,
        updatedAt: 150,
      })
    ).rejects.toMatchObject({ code: "ACCOUNT_BOUNDARY_CHANGED" });
    await expect(db.moods.get("mood-source-4")).resolves.toBeUndefined();
  });

  it("rolls back a primary mood when the account session changes inside its commit", async () => {
    await seedPreference(false);
    const mood = {
      id: "mood-source-session-race",
      mood: "good" as const,
      date: "2026-08-08",
      timestamp: 160,
      updatedAt: 160,
    };
    const originalPut = db.moods.put.bind(db.moods);
    vi.spyOn(db.moods, "put").mockImplementationOnce((value, key) => {
      const primaryKey = originalPut(value, key);
      notifyAccountSessionTransition();
      notifyAccountSessionTransition();
      return primaryKey;
    });

    await expect(persistMoodSourceRecord(mood)).rejects.toThrow(
      /account boundary|session changed/i
    );

    await expect(db.moods.get(mood.id)).resolves.toBeUndefined();
  });

  it("atomically preserves a rescan marker when eligible mood intent persistence fails", async () => {
    await seedPreference(true);
    const mood = {
      id: "mood-source-recovery",
      mood: "good" as const,
      note: "Private note that must remain recoverable",
      date: "2026-08-08",
      timestamp: 170,
      updatedAt: 170,
    };
    const putSpy = rejectNextSourceIntentPut();

    const result = await persistMoodSourceRecord(mood);
    putSpy.mockRestore();

    expect(result).toMatchObject({ intentId: null, intentDeferred: "recovery" });
    await expect(db.moods.get(mood.id)).resolves.toEqual(mood);
    await expect(db.settings.get(AUTOMATION_SOURCE_RESCAN_SETTING_KEY)).resolves.toMatchObject({
      value: expect.objectContaining({ ownerUserId: OWNER_ID, revision: 1 }),
    });
  });

  it("recovers only sources from the active consent epoch and the earliest failed commit", async () => {
    await seedPreference(true);
    await db.moods.bulkPut([
      {
        id: "mood-before-consent",
        mood: "okay",
        note: "Historical note outside the active consent",
        date: "2026-08-08",
        timestamp: 80,
        updatedAt: 80,
      },
      {
        id: "mood-first-failed-write",
        mood: "good",
        note: "First recoverable note",
        date: "2026-08-08",
        timestamp: 170,
        updatedAt: 170,
      },
      {
        id: "mood-second-failed-write",
        mood: "great",
        note: "Second recoverable note",
        date: "2026-08-08",
        timestamp: 180,
        updatedAt: 180,
      },
    ]);
    await db.settings.put({
      key: AUTOMATION_SOURCE_RESCAN_SETTING_KEY,
      value: {
        schemaVersion: 1,
        ownerUserId: OWNER_ID,
        revision: 1,
        requestedAt: 170,
      },
    });

    await markAutomationSourceRescanRequiredInCurrentTransaction(OWNER_ID, 180);
    await expect(db.settings.get(AUTOMATION_SOURCE_RESCAN_SETTING_KEY)).resolves.toMatchObject({
      value: expect.objectContaining({ requestedAt: 170, revision: 2 }),
    });

    await expect(recoverDeferredAutomationSourceIntents(OWNER_ID)).resolves.toEqual({
      recovered: 2,
      remaining: false,
    });
    const recovered = await db.automationTransactions
      .where("kind")
      .equals("source_pending")
      .toArray();
    expect(recovered.map((row) => row.kind === "source_pending" && row.source.id)).toEqual([
      "mood-first-failed-write",
      "mood-second-failed-write",
    ]);
  });
});

describe("focus source persistence", () => {
  beforeEach(async () => {
    originLocks.tails.clear();
    boundary.current = true;
    boundary.generation = "boundary-a";
    boundary.owner = OWNER_ID;
    localStorage.clear();
    await db.open();
    await db.transaction(
      "rw",
      [db.focusSessions, db.settings, db.automationTransactions, db.offlineQueue],
      async () => {
        await db.focusSessions.clear();
        await db.settings.clear();
        await db.automationTransactions.clear();
        await db.offlineQueue.clear();
      }
    );
    await db.settings.put({ key: SK.DATA_OWNER_ID, value: OWNER_ID });
  });

  it("atomically persists a completed focus session and a prose-free mapped intent", async () => {
    await seedFocusPreference(true);
    const session = {
      id: "focus-source-1",
      duration: 25,
      completedAt: 160,
      date: "2026-08-08",
      label: "Private project label",
      status: "completed" as const,
      updatedAt: 160,
    };

    const result = await persistFocusSourceRecord(session);

    expect(result.intentId).toMatch(/^source_pending:sha256:/);
    expect(result.primaryInserted).toBe(true);
    await expect(db.focusSessions.get(session.id)).resolves.toEqual(session);
    if (!result.intentId) throw new Error("Expected a focus source intent");
    const intent = await db.automationTransactions.get(result.intentId);
    expect(intent).toMatchObject({
      kind: "source_pending",
      ownerUserId: OWNER_ID,
      consentEpoch: CONSENT_EPOCH,
      source: {
        type: "focus",
        id: session.id,
        revision: "updatedAt:160",
      },
      candidateRuleIds: ["focus.to-mapped-habit.v1"],
    });
    expect(JSON.stringify(intent)).not.toContain(session.label);
    await expect(
      db.offlineQueue.where("type").equals("CREATE_FOCUS_SESSION").count()
    ).resolves.toBe(1);

    await expect(persistFocusSourceRecord(session)).resolves.toMatchObject({
      intentId: result.intentId,
      primaryInserted: false,
    });
    const focusOutbox = await db.offlineQueue
      .where("type")
      .equals("CREATE_FOCUS_SESSION")
      .toArray();
    expect(focusOutbox).toHaveLength(1);
    expect(focusOutbox[0]).toMatchObject({
      entityId: session.id,
      ownerUserId: OWNER_ID,
      payload: session,
      operationId: expect.stringMatching(
        /^[0-9a-f]{8}-[0-9a-f]{4}-8[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
      ),
    });

    const stableOperationId = focusOutbox[0].operationId;
    await db.offlineQueue.delete(focusOutbox[0].id);
    await expect(persistFocusSourceRecord(session)).resolves.toMatchObject({
      primaryInserted: false,
    });
    const recreated = await db.offlineQueue
      .where("type")
      .equals("CREATE_FOCUS_SESSION")
      .first();
    expect(recreated?.operationId).toBe(stableOperationId);
  });

  it("persists an aborted focus session without creating an automation intent", async () => {
    await seedFocusPreference(true);
    const session = {
      id: "focus-source-2",
      duration: 10,
      completedAt: 170,
      date: "2026-08-08",
      status: "aborted" as const,
      updatedAt: 170,
    };

    await expect(persistFocusSourceRecord(session)).resolves.toMatchObject({
      intentId: null,
      primaryInserted: true,
    });
    await expect(persistFocusSourceRecord(session)).resolves.toMatchObject({
      intentId: null,
      primaryInserted: false,
    });
    await expect(db.focusSessions.get(session.id)).resolves.toEqual(session);
    await expect(
      db.offlineQueue.where("type").equals("CREATE_FOCUS_SESSION").count()
    ).resolves.toBe(1);
    await expect(
      db.automationTransactions.where("kind").equals("source_pending").count()
    ).resolves.toBe(0);
  });

  it.each([false, true])(
    "uses the durable pending payload as the focus CAS with automation enabled=%s",
    async (automationEnabled) => {
      await seedFocusPreference(automationEnabled);
      await db.settings.put({ key: SK.DATA_OWNER_ID, value: OWNER_ID });
      const base: FocusSession = {
        id: `focus-cas-${automationEnabled ? "enabled" : "disabled"}`,
        duration: 25,
        completedAt: 180,
        date: "2026-08-08",
        label: "Private focus label",
        status: "completed",
        updatedAt: 180,
      };
      const reflectionFour = { ...base, reflection: 4 };
      const reflectionFive = { ...base, reflection: 5 };
      const pending = (session: FocusSession): PendingFocusCommit => ({
        schemaVersion: 1,
        ownerUserId: OWNER_ID,
        accountBoundaryGeneration: boundary.generation,
        session,
        requiresReflection: true,
      });
      const fourPending = pending(reflectionFour);
      localStorage.setItem(SK.FOCUS_PENDING_COMMIT, JSON.stringify(fourPending));

      await expect(
        persistFocusSourceRecord(reflectionFour, {
          ownerUserId: OWNER_ID,
          accountBoundaryGeneration: boundary.generation,
          expectedPending: fourPending,
        })
      ).resolves.toMatchObject({ primaryInserted: true });

      const staleFivePending = pending(reflectionFive);
      await expect(
        persistFocusSourceRecord(reflectionFive, {
          ownerUserId: OWNER_ID,
          accountBoundaryGeneration: boundary.generation,
          expectedPending: staleFivePending,
        })
      ).rejects.toThrow(/receipt changed|gate stale/i);
      await expect(db.focusSessions.get(base.id)).resolves.toEqual(reflectionFour);

      localStorage.setItem(SK.FOCUS_PENDING_COMMIT, JSON.stringify(staleFivePending));
      await expect(
        persistFocusSourceRecord(reflectionFive, {
          ownerUserId: OWNER_ID,
          accountBoundaryGeneration: boundary.generation,
          expectedPending: staleFivePending,
        })
      ).resolves.toMatchObject({ primaryInserted: false });
      await expect(db.focusSessions.get(base.id)).resolves.toEqual(reflectionFive);
      const queued = await db.offlineQueue
        .where("type")
        .equals("CREATE_FOCUS_SESSION")
        .sortBy("timestamp");
      expect(queued.map((row) => (row.payload as FocusSession).reflection)).toEqual([4, 5]);
      expect(new Set(queued.map((row) => row.operationId)).size).toBe(2);
    }
  );

  it.each([false, true])(
    "rolls back the focus primary when its durable outbox is full with automation enabled=%s",
    async (automationEnabled) => {
      await seedFocusPreference(automationEnabled);
      const fullQueue: OfflineQueueItem[] = Array.from({ length: 1000 }, (_, index) => ({
        id: `focus-capacity-existing-${index}`,
        operationId: `focus-capacity-operation-${index}`,
        type: "UPDATE_SETTINGS",
        entityId: `setting-${index}`,
        ownerUserId: OWNER_ID,
        payload: null,
        timestamp: index,
        retries: 0,
        maxRetries: 5,
      }));
      await db.offlineQueue.bulkAdd(fullQueue);
      const session: FocusSession = {
        id: `focus-capacity-${automationEnabled ? "enabled" : "disabled"}`,
        duration: 25,
        completedAt: 190,
        date: "2026-08-08",
        status: "completed",
        updatedAt: 190,
      };

      await expect(persistFocusSourceRecord(session)).rejects.toThrow("Offline queue full");
      await expect(db.focusSessions.get(session.id)).resolves.toBeUndefined();
      await expect(
        db.automationTransactions.where("kind").equals("source_pending").count()
      ).resolves.toBe(0);
      await expect(db.offlineQueue.count()).resolves.toBe(1000);
    }
  );

  it("atomically preserves focus, sync outbox and rescan marker after intent-store failure", async () => {
    await seedFocusPreference(true);
    const session: FocusSession = {
      id: "88888888-8888-4888-8888-888888888888",
      duration: 25,
      completedAt: 200,
      date: "2026-08-08",
      status: "completed",
      updatedAt: 200,
    };
    const putSpy = rejectNextSourceIntentPut();

    const result = await persistFocusSourceRecord(session);
    putSpy.mockRestore();

    expect(result).toMatchObject({
      intentId: null,
      intentDeferred: "recovery",
      syncOutboxPersisted: true,
    });
    await expect(db.focusSessions.get(session.id)).resolves.toEqual(session);
    await expect(
      db.offlineQueue.where("type").equals("CREATE_FOCUS_SESSION").count()
    ).resolves.toBe(1);
    await expect(db.settings.get(AUTOMATION_SOURCE_RESCAN_SETTING_KEY)).resolves.toMatchObject({
      value: expect.objectContaining({ ownerUserId: OWNER_ID, revision: 1 }),
    });
  });
});

describe("habit source persistence", () => {
  beforeEach(async () => {
    originLocks.tails.clear();
    boundary.current = true;
    boundary.generation = "boundary-a";
    boundary.owner = OWNER_ID;
    await db.open();
    await db.transaction("rw", [db.habits, db.settings, db.automationTransactions, db.offlineQueue], async () => {
      await db.habits.clear();
      await db.settings.clear();
      await db.automationTransactions.clear();
      await db.offlineQueue.clear();
    });
  });

  it("atomically persists an explicit mapped manual completion and prose-free intent", async () => {
    await seedHabitPreference(true);
    const habit = completedHabit();

    const result = await persistHabitSourceRecord(habit, "2026-08-08");

    expect(result.intentId).toMatch(/^source_pending:sha256:/);
    await expect(db.habits.get(habit.id)).resolves.toEqual(habit);
    if (!result.intentId) throw new Error("Expected a habit source intent");
    const intent = await db.automationTransactions.get(result.intentId);
    expect(intent).toMatchObject({
      kind: "source_pending",
      ownerUserId: OWNER_ID,
      consentEpoch: CONSENT_EPOCH,
      source: {
        type: "habit",
        id: habit.id,
        revision: "completion:2026-08-08:loggedAt:2026-08-08T12:00:00.000Z",
        committedAt: 1_786_190_400_000,
      },
      candidateRuleIds: ["habit.to-planning.v1"],
    });
    expect(JSON.stringify(intent)).not.toContain(habit.name);
    expect(JSON.stringify(intent)).not.toContain(habit.description);
  });

  it("persists a reset without emitting another automation intent", async () => {
    await seedHabitPreference(true);
    const habit = { ...completedHabit(), entries: {} };

    await expect(persistHabitSourceRecord(habit, null)).resolves.toMatchObject({
      intentId: null,
    });
    await expect(db.habits.get(habit.id)).resolves.toEqual(habit);
    await expect(
      db.automationTransactions.where("kind").equals("source_pending").count()
    ).resolves.toBe(0);
  });

  it("atomically detaches manual completion ownership and persists its durable outbox", async () => {
    await seedHabitPreference(false);
    const habit = completedHabit();
    await db.automationTransactions.put({
      kind: "record_revision",
      id: `record_revision:habit_completion:${habit.id}:2026-08-08`,
      schemaVersion: 1,
      ownerUserId: OWNER_ID,
      entityType: "habit_completion",
      entityId: `${habit.id}:2026-08-08`,
      recordExists: true,
      revisionToken: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
      stateHash: await hashAutomationValue({ previous: true }),
      mutationGeneration: 1,
      transactionId: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
      updatedAt: 1,
    });

    await persistHabitSourceRecord(habit, null, "2026-08-08");

    await expect(
      db.automationTransactions.get(`record_revision:habit_completion:${habit.id}:2026-08-08`)
    ).resolves.toBeUndefined();
    await expect(db.offlineQueue.toArray()).resolves.toEqual([
      expect.objectContaining({
        type: "TOGGLE_HABIT",
        entityId: `${habit.id}_2026-08-08`,
        ownerUserId: OWNER_ID,
        priority: "critical",
        payload: expect.objectContaining({
          habitId: habit.id,
          date: "2026-08-08",
          entryValue: 2,
        }),
      }),
    ]);
  });

  it("does not treat a legacy entry without manual timestamp provenance as a source event", async () => {
    await seedHabitPreference(true);
    const habit = completedHabit();
    habit.entries["2026-08-08"] = { value: 2 };

    await expect(persistHabitSourceRecord(habit, "2026-08-08")).resolves.toMatchObject({
      intentId: null,
    });
    await expect(
      db.automationTransactions.where("kind").equals("source_pending").count()
    ).resolves.toBe(0);
  });

  it("keeps a legacy habit primary without creating an impossible granular outbox row", async () => {
    await seedHabitPreference(false);
    const habit = { ...completedHabit(), id: "legacy-habit-id" };

    await expect(
      persistHabitSourceRecord(habit, null, "2026-08-08"),
    ).resolves.toMatchObject({
      intentId: null,
      syncOutboxPersisted: false,
    });
    await expect(db.habits.get(habit.id)).resolves.toEqual(habit);
    await expect(db.offlineQueue.count()).resolves.toBe(0);
  });

  it("merges a queued stale entry mutation with a different date already committed", async () => {
    await seedHabitPreference(false);
    const base = { ...completedHabit(), entries: {} };
    const firstDate = "2026-08-08";
    const secondDate = "2026-08-09";
    const first = {
      ...base,
      entries: {
        [firstDate]: {
          value: 2,
          loggedAt: "2026-08-08T12:00:00.000Z",
          source: "quickTap" as const,
        },
      },
      updatedAt: "2026-08-08T12:00:00.000Z",
    };
    const staleSecond = {
      ...base,
      entries: {
        [secondDate]: {
          value: 2,
          loggedAt: "2026-08-09T12:00:00.000Z",
          source: "quickTap" as const,
        },
      },
      updatedAt: "2026-08-09T12:00:00.000Z",
    };

    await persistHabitSourceRecord(first, null, firstDate);
    const result = await persistHabitSourceRecord(staleSecond, null, secondDate);

    await expect(db.habits.get(base.id)).resolves.toMatchObject({
      entries: {
        [firstDate]: first.entries[firstDate],
        [secondDate]: staleSecond.entries[secondDate],
      },
    });
    expect(result.habit?.entries).toEqual({
      [firstDate]: first.entries[firstDate],
      [secondDate]: staleSecond.entries[secondDate],
    });
  });

  it("keeps a remote DATA-locked date that commits while a stale local habit mutation waits", async () => {
    await seedHabitPreference(false);
    const base = { ...completedHabit(), entries: {} };
    await db.habits.put(base);
    const localDate = "2026-08-08";
    const remoteDate = "2026-08-09";
    const localEntry = {
      value: 2,
      loggedAt: "2026-08-08T12:00:00.000Z",
      source: "quickTap" as const,
    };
    const remoteEntry = {
      value: 2,
      loggedAt: "2026-08-09T12:00:00.000Z",
      source: "calendar" as const,
    };
    const staleLocal = {
      ...base,
      entries: { [localDate]: localEntry },
      updatedAt: "2026-08-08T12:00:00.000Z",
    };

    let releaseLocalRead = (): void => undefined;
    const localReadBlocked = new Promise<void>((resolve) => {
      releaseLocalRead = resolve;
    });
    let signalLocalRead = (): void => undefined;
    const localReadStarted = new Promise<void>((resolve) => {
      signalLocalRead = resolve;
    });
    const originalGet = db.habits.get.bind(db.habits);
    vi.spyOn(db.habits, "get").mockImplementationOnce((key) =>
      originalGet(key).then(async (value) => {
        signalLocalRead();
        await localReadBlocked;
        return value;
      })
    );

    const localCommit = persistHabitSourceRecord(staleLocal, null, localDate);
    await localReadStarted;
    const remoteCommit = runWithOriginExclusiveLock(
      ACCOUNT_BOUNDARY_DATA_WRITE_LOCK,
      async () => {
        await db.transaction("rw", db.habits, async () => {
          const latest = await db.habits.get(base.id);
          if (!latest) throw new Error("Expected seeded habit");
          await db.habits.put({
            ...latest,
            entries: { ...latest.entries, [remoteDate]: remoteEntry },
            updatedAt: "2026-08-09T12:00:00.000Z",
          });
        });
      }
    );

    await new Promise((resolve) => setTimeout(resolve, 20));
    releaseLocalRead();
    await Promise.all([localCommit, remoteCommit]);

    await expect(db.habits.get(base.id)).resolves.toMatchObject({
      entries: {
        [localDate]: localEntry,
        [remoteDate]: remoteEntry,
      },
    });
  });

  it("advances the aggregate habit revision after a remote DATA writer wins the lock first", async () => {
    await seedHabitPreference(false);
    const base = { ...completedHabit(), entries: {} };
    await db.habits.put(base);
    const localDate = "2026-08-08";
    const remoteDate = "2026-08-09";
    const remoteUpdatedAt = "2026-08-09T12:00:00.000Z";
    const localEntry = {
      value: 2,
      loggedAt: "2026-08-08T12:00:00.000Z",
      source: "quickTap" as const,
    };
    const remoteEntry = {
      value: 2,
      loggedAt: remoteUpdatedAt,
      source: "calendar" as const,
    };
    const staleLocal = {
      ...base,
      entries: { [localDate]: localEntry },
      updatedAt: localEntry.loggedAt,
    };

    let releaseRemote = (): void => undefined;
    const remoteBlocked = new Promise<void>((resolve) => {
      releaseRemote = resolve;
    });
    let signalRemoteLock = (): void => undefined;
    const remoteHasLock = new Promise<void>((resolve) => {
      signalRemoteLock = resolve;
    });
    const remoteCommit = runWithOriginExclusiveLock(
      ACCOUNT_BOUNDARY_DATA_WRITE_LOCK,
      async () => {
        signalRemoteLock();
        await remoteBlocked;
        await db.transaction("rw", db.habits, async () => {
          const latest = await db.habits.get(base.id);
          if (!latest) throw new Error("Expected seeded habit");
          await db.habits.put({
            ...latest,
            entries: { ...latest.entries, [remoteDate]: remoteEntry },
            updatedAt: remoteUpdatedAt,
          });
        });
      }
    );
    await remoteHasLock;
    const localCommit = persistHabitSourceRecord(staleLocal, null, localDate);
    await new Promise((resolve) => setTimeout(resolve, 20));
    releaseRemote();
    await Promise.all([remoteCommit, localCommit]);

    const persisted = await db.habits.get(base.id);
    expect(persisted?.entries).toMatchObject({
      [localDate]: localEntry,
      [remoteDate]: remoteEntry,
    });
    expect(Date.parse(persisted?.updatedAt ?? "")).toBeGreaterThan(
      Date.parse(remoteUpdatedAt)
    );
  });

  it("preserves the primary habit and reports degradation at the source-intent hard bound", async () => {
    await seedHabitPreference(true);
    await db.automationTransactions.bulkPut(
      Array.from({ length: 512 }, (_, index) => {
        const sourceKey = `sha256:${index.toString(16).padStart(64, "0")}`;
        return {
          kind: "source_pending" as const,
          id: `source_pending:${sourceKey}`,
          schemaVersion: 1 as const,
          ownerUserId: OWNER_ID,
          consentEpoch: CONSENT_EPOCH,
          accountBoundaryGeneration: "boundary-a",
          source: {
            schemaVersion: 1 as const,
            type: "habit" as const,
            id: `queued-habit-${index}`,
            revision: `completion:2026-08-01:${index}`,
            committedAt: index + 1,
          },
          candidateRuleIds: ["habit.to-planning.v1" as const],
          sourceKey,
          createdAt: index + 1,
          updatedAt: index + 1,
        };
      })
    );
    const habit = completedHabit();

    await expect(
      persistHabitSourceRecord(habit, "2026-08-08", "2026-08-08")
    ).resolves.toMatchObject({
      intentId: null,
      intentDeferred: "capacity",
    });

    await expect(db.habits.get(habit.id)).resolves.toEqual(habit);
    await expect(
      db.automationTransactions.where("kind").equals("source_pending").count()
    ).resolves.toBe(512);
    await expect(db.settings.get(AUTOMATION_SOURCE_RESCAN_SETTING_KEY)).resolves.toMatchObject({
      value: {
        schemaVersion: 1,
        ownerUserId: OWNER_ID,
        revision: 1,
      },
    });

    const firstQueued = await db.automationTransactions
      .where("kind")
      .equals("source_pending")
      .first();
    if (!firstQueued) throw new Error("Expected a bounded source-intent fixture");
    await db.automationTransactions.delete(firstQueued.id);

    await expect(recoverDeferredAutomationSourceIntents(OWNER_ID)).resolves.toEqual({
      recovered: 1,
      remaining: false,
    });
    await expect(
      db.automationTransactions.where("kind").equals("source_pending").count()
    ).resolves.toBe(512);
    await expect(
      db.automationTransactions
        .where("ownerUserId")
        .equals(OWNER_ID)
        .filter((row) => row.kind === "source_pending" && row.source.id === habit.id)
        .count()
    ).resolves.toBe(1);
    await expect(db.settings.get(AUTOMATION_SOURCE_RESCAN_SETTING_KEY)).resolves.toBeUndefined();
  });

  it("atomically preserves a habit rescan marker after eligible intent-store failure", async () => {
    await seedHabitPreference(true);
    const habit = completedHabit();
    const putSpy = rejectNextSourceIntentPut();

    const result = await persistHabitSourceRecord(habit, "2026-08-08", "2026-08-08");
    putSpy.mockRestore();

    expect(result).toMatchObject({ intentId: null, intentDeferred: "recovery" });
    await expect(db.habits.get(habit.id)).resolves.toEqual(habit);
    await expect(db.settings.get(AUTOMATION_SOURCE_RESCAN_SETTING_KEY)).resolves.toMatchObject({
      value: expect.objectContaining({ ownerUserId: OWNER_ID, revision: 1 }),
    });
  });

  it("rebuilds a deferred source from local truth when the durable rescan marker is malformed", async () => {
    await seedHabitPreference(true);
    const habit = completedHabit();
    await db.habits.put(habit);
    await db.settings.put({
      key: AUTOMATION_SOURCE_RESCAN_SETTING_KEY,
      value: { schemaVersion: 1, ownerUserId: OWNER_ID, revision: 0, requestedAt: 1 },
    });

    await expect(recoverDeferredAutomationSourceIntents(OWNER_ID)).resolves.toEqual({
      recovered: 1,
      remaining: false,
    });
    await expect(
      db.automationTransactions
        .where("ownerUserId")
        .equals(OWNER_ID)
        .filter((row) => row.kind === "source_pending" && row.source.id === habit.id)
        .count()
    ).resolves.toBe(1);
    await expect(db.settings.get(AUTOMATION_SOURCE_RESCAN_SETTING_KEY)).resolves.toBeUndefined();
  });

  it("saturates rescan revisions without rolling back a primary write", async () => {
    await seedHabitPreference(true);
    await db.automationTransactions.bulkPut(
      Array.from({ length: 512 }, (_, index) => {
        const sourceKey = `sha256:${index.toString(16).padStart(64, "0")}`;
        return {
          kind: "source_pending" as const,
          id: `source_pending:${sourceKey}`,
          schemaVersion: 1 as const,
          ownerUserId: OWNER_ID,
          consentEpoch: CONSENT_EPOCH,
          accountBoundaryGeneration: "boundary-a",
          source: {
            schemaVersion: 1 as const,
            type: "habit" as const,
            id: `queued-habit-${index}`,
            revision: `completion:2026-08-01:${index}`,
            committedAt: index + 1,
          },
          candidateRuleIds: ["habit.to-planning.v1" as const],
          sourceKey,
          createdAt: index + 1,
          updatedAt: index + 1,
        };
      })
    );
    await db.settings.put({
      key: AUTOMATION_SOURCE_RESCAN_SETTING_KEY,
      value: {
        schemaVersion: 1,
        ownerUserId: OWNER_ID,
        revision: Number.MAX_SAFE_INTEGER,
        requestedAt: 1,
      },
    });
    const habit = completedHabit();

    await expect(
      persistHabitSourceRecord(habit, "2026-08-08", "2026-08-08")
    ).resolves.toMatchObject({ intentDeferred: "capacity" });
    await expect(db.habits.get(habit.id)).resolves.toEqual(habit);
    await expect(db.settings.get(AUTOMATION_SOURCE_RESCAN_SETTING_KEY)).resolves.toMatchObject({
      value: { revision: Number.MAX_SAFE_INTEGER },
    });
  });

  it("fails the primary commit rather than replacing another owner's rescan marker", async () => {
    await seedHabitPreference(true);
    await db.automationTransactions.bulkPut(
      Array.from({ length: 512 }, (_, index) => {
        const sourceKey = `sha256:${index.toString(16).padStart(64, "0")}`;
        return {
          kind: "source_pending" as const,
          id: `source_pending:${sourceKey}`,
          schemaVersion: 1 as const,
          ownerUserId: OWNER_ID,
          consentEpoch: CONSENT_EPOCH,
          accountBoundaryGeneration: "boundary-a",
          source: {
            schemaVersion: 1 as const,
            type: "habit" as const,
            id: `queued-habit-${index}`,
            revision: `completion:2026-08-01:${index}`,
            committedAt: index + 1,
          },
          candidateRuleIds: ["habit.to-planning.v1" as const],
          sourceKey,
          createdAt: index + 1,
          updatedAt: index + 1,
        };
      })
    );
    const otherOwner = "22222222-2222-4222-8222-222222222222";
    await db.settings.put({
      key: AUTOMATION_SOURCE_RESCAN_SETTING_KEY,
      value: {
        schemaVersion: 1,
        ownerUserId: otherOwner,
        revision: 4,
        requestedAt: 1,
      },
    });
    const habit = completedHabit();

    await expect(
      persistHabitSourceRecord(habit, "2026-08-08", "2026-08-08")
    ).rejects.toThrow("AUTOMATION_COMMIT_OWNER_UNAVAILABLE");
    await expect(db.habits.get(habit.id)).resolves.toBeUndefined();
    await expect(db.settings.get(AUTOMATION_SOURCE_RESCAN_SETTING_KEY)).resolves.toMatchObject({
      value: { ownerUserId: otherOwner, revision: 4 },
    });
  });
});

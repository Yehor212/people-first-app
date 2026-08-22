import { beforeEach, describe, expect, it, vi } from "vitest";

const boundary = vi.hoisted(
  (): { current: boolean; generation: string; owner: string | null } => ({
    current: true,
    generation: "boundary-a",
    owner: "11111111-1111-4111-8111-111111111111",
  }),
);

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
      (generation: string) => boundary.current && generation === boundary.generation,
    ),
  };
});

vi.mock("@/lib/originExclusiveLock", () => ({
  runWithOriginExclusiveLock: vi.fn(async (_name: string, operation: () => unknown) => operation()),
}));

import {
  persistFocusSourceRecord,
  persistHabitSourceRecord,
  persistMoodSourceRecord,
} from "../automationSourcePersistence";
import { AUTOMATION_PREFERENCE_SETTING_KEY } from "../types";
import { db } from "@/storage/db";
import type { Habit } from "@/types";

const OWNER_ID = "11111111-1111-4111-8111-111111111111";
const CONSENT_EPOCH = "33333333-3333-4333-8333-333333333333";

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
      planningHabitMappings: enabled ? { "habit-source-1": "planning-block-1" } : {},
      updatedAt: enabled ? 90 : 95,
    },
  });
}

function completedHabit(): Habit {
  return {
    id: "habit-source-1",
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
    boundary.current = true;
    boundary.generation = "boundary-a";
    boundary.owner = OWNER_ID;
    await db.open();
    await db.transaction(
      "rw",
      [db.moods, db.focusSessions, db.settings, db.automationTransactions],
      async () => {
        await db.moods.clear();
        await db.focusSessions.clear();
        await db.settings.clear();
        await db.automationTransactions.clear();
      },
    );
  });

  it("atomically persists an eligible mood and a prose-free owner-bound intent", async () => {
    await seedPreference(true);
    const mood = {
      id: "mood-source-1",
      mood: "good" as const,
      note: "Private user-authored note",
      date: "2026-08-08",
      timestamp: 120,
      updatedAt: 120,
    };

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
  });

  it("persists a primary mood without an intent when the rule has no eligible note", async () => {
    await seedPreference(true);
    const mood = {
      id: "mood-source-2",
      mood: "okay" as const,
      date: "2026-08-08",
      timestamp: 130,
      updatedAt: 130,
    };

    await expect(persistMoodSourceRecord(mood)).resolves.toEqual({
      accountBoundaryGeneration: "boundary-a",
      intentId: null,
    });

    await expect(db.moods.get(mood.id)).resolves.toEqual(mood);
    await expect(
      db.automationTransactions.where("kind").equals("source_pending").count(),
    ).resolves.toBe(0);
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
    });
    await expect(db.moods.get(mood.id)).resolves.toEqual(mood);
    await expect(
      db.automationTransactions.where("kind").equals("source_pending").count(),
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
      }),
    ).rejects.toMatchObject({ code: "ACCOUNT_BOUNDARY_CHANGED" });
    await expect(db.moods.get("mood-source-4")).resolves.toBeUndefined();
  });
});

describe("focus source persistence", () => {
  beforeEach(async () => {
    boundary.current = true;
    boundary.generation = "boundary-a";
    boundary.owner = OWNER_ID;
    await db.open();
    await db.transaction(
      "rw",
      [db.focusSessions, db.settings, db.automationTransactions],
      async () => {
        await db.focusSessions.clear();
        await db.settings.clear();
        await db.automationTransactions.clear();
      },
    );
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

    await expect(persistFocusSourceRecord(session)).resolves.toMatchObject({ intentId: null });
    await expect(db.focusSessions.get(session.id)).resolves.toEqual(session);
    await expect(
      db.automationTransactions.where("kind").equals("source_pending").count(),
    ).resolves.toBe(0);
  });
});

describe("habit source persistence", () => {
  beforeEach(async () => {
    boundary.current = true;
    boundary.generation = "boundary-a";
    boundary.owner = OWNER_ID;
    await db.open();
    await db.transaction(
      "rw",
      [db.habits, db.settings, db.automationTransactions],
      async () => {
        await db.habits.clear();
        await db.settings.clear();
        await db.automationTransactions.clear();
      },
    );
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
      db.automationTransactions.where("kind").equals("source_pending").count(),
    ).resolves.toBe(0);
  });

  it("does not treat a legacy entry without manual timestamp provenance as a source event", async () => {
    await seedHabitPreference(true);
    const habit = completedHabit();
    habit.entries["2026-08-08"] = { value: 2 };

    await expect(
      persistHabitSourceRecord(habit, "2026-08-08"),
    ).resolves.toMatchObject({ intentId: null });
    await expect(
      db.automationTransactions.where("kind").equals("source_pending").count(),
    ).resolves.toBe(0);
  });
});

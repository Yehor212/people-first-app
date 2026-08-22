import { describe, expect, it } from "vitest";

import { hashAutomationValue } from "../canonicalJson";
import {
  deriveAutomationTargetIdentity,
  planAutomation,
  type AutomationPlannerInput,
  type AutomationTargetSnapshot,
} from "../planner";
import { computeAutomationSourceKey } from "../sourceKey";
import type {
  AutomationPreference,
  AutomationRuleId,
  AutomationSourceEvent,
} from "../types";

const OWNER_ID = "11111111-1111-4111-8111-111111111111";
const CONSENT_EPOCH = "33333333-3333-4333-8333-333333333333";
const FOCUS_HABIT_ID = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const PROTECTED_NOTE = "zenflow:journal-content:v1:test-envelope";

function preference(ruleId: AutomationRuleId): AutomationPreference {
  return {
    schemaVersion: 1,
    enabled: true,
    serverRevision: 4,
    consentEpoch: CONSENT_EPOCH,
    consentedAt: 90,
    revokedAt: null,
    revocationPending: false,
    enabledRuleIds: [ruleId],
    focusHabitId: ruleId === "focus.to-mapped-habit.v1" ? FOCUS_HABIT_ID : null,
    focusMinimumMinutes: 25,
    planningHabitMappings: {},
    updatedAt: 90,
  };
}

async function sourceKey(ruleId: AutomationRuleId, source: AutomationSourceEvent) {
  return computeAutomationSourceKey({
    ownerUserId: OWNER_ID,
    consentEpoch: CONSENT_EPOCH,
    ruleId,
    ruleVersion: 1,
    sourceType: source.type,
    sourceId: source.id,
    sourceRevision: source.revision,
  });
}

async function baseInput(
  ruleId: AutomationRuleId,
  source: AutomationSourceEvent,
  sourceRecord: unknown,
  target: AutomationTargetSnapshot,
  overrides: Partial<AutomationPlannerInput> = {},
): Promise<AutomationPlannerInput> {
  return {
    ruleId,
    ownerUserId: OWNER_ID,
    consentEpoch: CONSENT_EPOCH,
    preference: preference(ruleId),
    sourceKey: await sourceKey(ruleId, source),
    source,
    sourceRecord,
    target,
    ...overrides,
  };
}

describe("connected-record pure planner", () => {
  it("fails closed when the preference or individual rule is disabled", async () => {
    const source = {
      schemaVersion: 1,
      type: "journal",
      id: "journal-1",
      revision: "updatedAt:200",
      committedAt: 200,
    } as const;
    const targetId = await deriveAutomationTargetIdentity({
      ruleId: "journal.mood-to-checkin.v1",
      ownerUserId: OWNER_ID,
      source,
      preference: preference("journal.mood-to-checkin.v1"),
      sourceRecord: { id: source.id, date: "2026-08-08", mood: "good", updatedAt: 200 },
    });
    expect(targetId).toEqual({ entityType: "mood", entityId: "a819230d-4f20-89c1-8628-85b86f50d450" });

    const input = await baseInput(
      "journal.mood-to-checkin.v1",
      source,
      { id: source.id, date: "2026-08-08", mood: "good", updatedAt: 200 },
      {
        ...targetId,
        value: null,
        revisionToken: null,
        automationOwned: false,
      },
    );

    expect(
      await planAutomation({
        ...input,
        preference: {
          ...input.preference,
          enabled: false,
          consentEpoch: null,
          enabledRuleIds: [],
        },
      }),
    ).toEqual({ kind: "noop", code: "PREFERENCE_DISABLED" });
    expect(
      await planAutomation({
        ...input,
        preference: { ...input.preference, enabledRuleIds: [] },
      }),
    ).toEqual({ kind: "noop", code: "RULE_DISABLED" });
  });

  it("plans an exact encrypted journal projection from only a sanitized mood note", async () => {
    const source = {
      schemaVersion: 1,
      type: "mood",
      id: "mood-1",
      revision: "updatedAt:100",
      committedAt: 100,
    } as const;
    const sourceRecord = {
      id: source.id,
      mood: "good",
      date: "2026-08-08",
      timestamp: 95,
      updatedAt: 100,
      note: "  <b>Slow breath</b> {today}  ",
    };
    const targetId = await deriveAutomationTargetIdentity({
      ruleId: "mood.note-to-journal.v1",
      ownerUserId: OWNER_ID,
      source,
      preference: preference("mood.note-to-journal.v1"),
      sourceRecord,
    });
    expect(targetId).toEqual({
      entityType: "journal",
      entityId: "62a9243c-5054-87b5-be9c-9e68d1a08a6a",
    });

    const sanitizedNoteHash = await hashAutomationValue("Slow breath today");
    const input = await baseInput(
      "mood.note-to-journal.v1",
      source,
      sourceRecord,
      {
        ...targetId,
        value: null,
        revisionToken: null,
        automationOwned: false,
      },
      {
        journalProtection: {
          localizedTitle: "Mood note",
          protectedContent: PROTECTED_NOTE,
          sanitizedNoteHash,
        },
      },
    );
    const after = {
      id: targetId.entityId,
      date: "2026-08-08",
      title: "Mood note",
      content: PROTECTED_NOTE,
      stickers: [],
      mood: null,
      tags: [],
      template_id: null,
      habit_snapshot: null,
      photo_ids: [],
      audio_ids: [],
      created_at: 100,
      updated_at: 100,
      theme: null,
      font: null,
      ink_color: null,
      paper_texture: null,
      bg_pattern: null,
      paper_color: null,
      bg_intensity: null,
      particle_speed: null,
      font_size: null,
      photo_layout: null,
    };
    const result = await planAutomation(input);

    expect(result).toEqual({
      kind: "planned",
      revision: {
        schemaVersion: 1,
        transactionId: "56dfaa5d-50e2-8dfe-98cf-d8109fe15230",
        ownerUserId: OWNER_ID,
        consentEpoch: CONSENT_EPOCH,
        sourceKey: "sha256:fc280b099aa8ed04dbcce7ea2d94ac8af4d7dba3a6cc299b1c014128321bc14d",
        ruleId: "mood.note-to-journal.v1",
        ruleVersion: 1,
        source,
        mutations: [
          {
            entityType: "journal",
            entityId: targetId.entityId,
            operation: "upsert",
            before: null,
            after,
            beforeHash: await hashAutomationValue(null),
            afterHash: await hashAutomationValue(after),
            beforeRevisionToken: null,
            afterRevisionToken: "80eef3a4-9a3f-8d06-8bb4-be4af740a5ee", // gitleaks:allow - deterministic test UUID
          },
        ],
        plannedAt: 100,
      },
    });
    expect(JSON.stringify(result)).not.toContain("Slow breath");
    expect(JSON.stringify(result)).not.toContain("<b>");
  });

  it("rejects empty notes, unbound protected content, and manual target collisions", async () => {
    const source = {
      schemaVersion: 1,
      type: "mood",
      id: "mood-1",
      revision: "updatedAt:100",
      committedAt: 100,
    } as const;
    const sourceRecord = {
      id: source.id,
      mood: "good",
      date: "2026-08-08",
      timestamp: 95,
      updatedAt: 100,
      note: "<script></script>",
    };
    const targetId = {
      entityType: "journal",
      entityId: "62a9243c-5054-87b5-be9c-9e68d1a08a6a",
    } as const;
    const input = await baseInput(
      "mood.note-to-journal.v1",
      source,
      sourceRecord,
      { ...targetId, value: null, revisionToken: null, automationOwned: false },
      {
        journalProtection: {
          localizedTitle: "Mood note",
          protectedContent: PROTECTED_NOTE,
          sanitizedNoteHash: await hashAutomationValue("different text"),
        },
      },
    );
    expect(await planAutomation(input)).toEqual({ kind: "noop", code: "SOURCE_EMPTY" });

    const nonEmpty = { ...input, sourceRecord: { ...sourceRecord, note: "actual note" } };
    expect(await planAutomation(nonEmpty)).toEqual({ kind: "noop", code: "SOURCE_INVALID" });
    expect(
      await planAutomation({
        ...nonEmpty,
        journalProtection: {
          ...nonEmpty.journalProtection!,
          sanitizedNoteHash: await hashAutomationValue("actual note"),
        },
        target: {
          ...targetId,
          value: { id: targetId.entityId },
          revisionToken: "44444444-4444-4444-8444-444444444444",
          automationOwned: false,
        },
      }),
    ).toEqual({ kind: "noop", code: "TARGET_NOT_AUTOMATION_OWNED" });
  });

  it("plans one stable linked mood from an explicit journal mood without reading prose", async () => {
    const source = {
      schemaVersion: 1,
      type: "journal",
      id: "journal-1",
      revision: "updatedAt:200",
      committedAt: 200,
    } as const;
    const sourceRecord = {
      id: source.id,
      date: "2026-08-08",
      mood: "bad",
      content: "great wonderful happy",
      updatedAt: 200,
    };
    const targetId = {
      entityType: "mood",
      entityId: "a819230d-4f20-89c1-8628-85b86f50d450",
    } as const;
    const input = await baseInput(
      "journal.mood-to-checkin.v1",
      source,
      sourceRecord,
      { ...targetId, value: null, revisionToken: null, automationOwned: false },
    );
    const after = {
      id: targetId.entityId,
      mood: "bad",
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

    expect(await planAutomation(input)).toEqual({
      kind: "planned",
      revision: {
        schemaVersion: 1,
        transactionId: "b11a08bc-13fe-85ea-91af-03ec06ea7023",
        ownerUserId: OWNER_ID,
        consentEpoch: CONSENT_EPOCH,
        sourceKey: "sha256:9805edc3f70df7f276707aa71da778a142abb21a2557b2aaac427949c9c5da0a",
        ruleId: "journal.mood-to-checkin.v1",
        ruleVersion: 1,
        source,
        mutations: [
          {
            entityType: "mood",
            entityId: targetId.entityId,
            operation: "upsert",
            before: null,
            after,
            beforeHash: await hashAutomationValue(null),
            afterHash: await hashAutomationValue(after),
            beforeRevisionToken: null,
            afterRevisionToken: "eea8c0e7-d1df-84ce-b1cf-8243d843bbe8", // gitleaks:allow - deterministic test UUID
          },
        ],
        plannedAt: 200,
      },
    });

    expect(
      await planAutomation({
        ...input,
        sourceRecord: { ...sourceRecord, mood: undefined, content: "I feel great" },
      }),
    ).toEqual({ kind: "noop", code: "SOURCE_EMPTY" });
  });

  it("completes only the explicitly mapped active habit on the focus date", async () => {
    const source = {
      schemaVersion: 1,
      type: "focus",
      id: "focus-1",
      revision: "updatedAt:300",
      committedAt: 300,
    } as const;
    const sourceRecord = {
      id: source.id,
      duration: 30,
      completedAt: 290,
      date: "2026-08-08",
      status: "completed",
      updatedAt: 300,
    };
    const targetId = await deriveAutomationTargetIdentity({
      ruleId: "focus.to-mapped-habit.v1",
      ownerUserId: OWNER_ID,
      source,
      preference: preference("focus.to-mapped-habit.v1"),
      sourceRecord,
    });
    expect(targetId).toEqual({
      entityType: "habit_completion",
      entityId: `${FOCUS_HABIT_ID}:2026-08-08`,
    });
    const input = await baseInput(
      "focus.to-mapped-habit.v1",
      source,
      sourceRecord,
      { ...targetId, value: null, revisionToken: null, automationOwned: false },
      {
        mappedHabit: {
          id: FOCUS_HABIT_ID,
          isArchived: false,
          habitType: "boolean",
          targetType: "atLeast",
          targetValue: 1,
        },
      },
    );
    const after = {
      habit_id: FOCUS_HABIT_ID,
      date: "2026-08-08",
      count: 1,
      duration: null,
      entry_value: 2,
      entry_status: "completed",
      is_complete: true,
      habit_type: "boolean",
      target_type: null,
    };

    expect(await planAutomation(input)).toEqual({
      kind: "planned",
      revision: {
        schemaVersion: 1,
        transactionId: "1736b570-3e5e-8110-a827-8eebac3d0d61",
        ownerUserId: OWNER_ID,
        consentEpoch: CONSENT_EPOCH,
        sourceKey: "sha256:6d77b93151e5e08f4682fe5c89134ae22f80052f23c5a27d8018a18c85290c18",
        ruleId: "focus.to-mapped-habit.v1",
        ruleVersion: 1,
        source,
        mutations: [
          {
            entityType: "habit_completion",
            entityId: `${FOCUS_HABIT_ID}:2026-08-08`,
            operation: "upsert",
            before: null,
            after,
            beforeHash: await hashAutomationValue(null),
            afterHash: await hashAutomationValue(after),
            beforeRevisionToken: null,
            afterRevisionToken: "5d581dc8-3e70-82cd-b5bc-dcd348374a77", // gitleaks:allow - deterministic test UUID
          },
        ],
        plannedAt: 300,
      },
    });

    expect(
      await planAutomation({ ...input, sourceRecord: { ...sourceRecord, duration: 24 } }),
    ).toEqual({ kind: "noop", code: "THRESHOLD_NOT_MET" });
    expect(
      await planAutomation({ ...input, mappedHabit: { ...input.mappedHabit!, isArchived: true } }),
    ).toEqual({ kind: "noop", code: "TARGET_INACTIVE" });
    expect(
      await planAutomation({
        ...input,
        preference: { ...input.preference, focusHabitId: null },
        mappedHabit: undefined,
      }),
    ).toEqual({ kind: "noop", code: "MAPPING_MISSING" });
  });

  it("rejects a target snapshot larger than the 64 KiB planner boundary", async () => {
    const source = {
      schemaVersion: 1,
      type: "journal",
      id: "journal-1",
      revision: "updatedAt:200",
      committedAt: 200,
    } as const;
    const input = await baseInput(
      "journal.mood-to-checkin.v1",
      source,
      { id: source.id, date: "2026-08-08", mood: "good", updatedAt: 200 },
      {
        entityType: "mood",
        entityId: "a819230d-4f20-89c1-8628-85b86f50d450",
        value: "x".repeat(65_537),
        revisionToken: "44444444-4444-4444-8444-444444444444",
        automationOwned: true,
      },
    );

    expect(await planAutomation(input)).toEqual({ kind: "noop", code: "SOURCE_INVALID" });
  });

  it("rejects a target whose presence and revision token disagree", async () => {
    const source = {
      schemaVersion: 1,
      type: "journal",
      id: "journal-1",
      revision: "updatedAt:200",
      committedAt: 200,
    } as const;
    const input = await baseInput(
      "journal.mood-to-checkin.v1",
      source,
      { id: source.id, date: "2026-08-08", mood: "good", updatedAt: 200 },
      {
        entityType: "mood",
        entityId: "a819230d-4f20-89c1-8628-85b86f50d450",
        value: null,
        revisionToken: "44444444-4444-4444-8444-444444444444",
        automationOwned: false,
      },
    );

    expect(await planAutomation(input)).toEqual({ kind: "noop", code: "SOURCE_INVALID" });
  });

  it("returns ALREADY_CURRENT for an exact existing projection", async () => {
    const source = {
      schemaVersion: 1,
      type: "journal",
      id: "journal-1",
      revision: "updatedAt:200",
      committedAt: 200,
    } as const;
    const exactProjection = {
      id: "a819230d-4f20-89c1-8628-85b86f50d450",
      mood: "good",
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
    const input = await baseInput(
      "journal.mood-to-checkin.v1",
      source,
      { id: source.id, date: "2026-08-08", mood: "good", updatedAt: 200 },
      {
        entityType: "mood",
        entityId: exactProjection.id,
        value: exactProjection,
        revisionToken: "44444444-4444-4444-8444-444444444444",
        automationOwned: true,
      },
    );

    expect(await planAutomation(input)).toEqual({ kind: "noop", code: "ALREADY_CURRENT" });
  });

  it("marks only the explicitly mapped same-date automation-owned planning block complete", async () => {
    const completedAt = Date.parse("2026-08-08T12:00:00.000Z");
    const source = {
      schemaVersion: 1,
      type: "habit",
      id: "habit-1",
      revision: "completion:2026-08-08:loggedAt:2026-08-08T12:00:00.000Z",
      committedAt: completedAt,
    } as const;
    const mappedPreference = {
      ...preference("habit.to-planning.v1"),
      planningHabitMappings: { [source.id]: "planning-event-1" },
    };
    const sourceRecord = {
      id: source.id,
      entries: {
        "2026-08-08": {
          value: 2,
          source: "quickTap",
          loggedAt: "2026-08-08T12:00:00.000Z",
        },
      },
      habitType: "boolean",
      targetType: "atLeast",
      targetValue: 1,
      isArchived: false,
      updatedAt: completedAt,
    };
    const manualEvent = {
      id: "manual-event-1",
      title: "User plan",
      startHour: 7,
      startMinute: 30,
      endHour: 8,
      endMinute: 0,
      color: "#112233",
      date: "2026-08-08",
      source: "manual",
      isEditable: true,
    } as const;
    const mappedEvent = {
      id: "planning-event-1",
      title: "Dedicated habit block",
      startHour: 8,
      startMinute: 0,
      endHour: 8,
      endMinute: 30,
      color: "#334455",
      date: "2026-08-08",
      source: "habit",
      habitId: source.id,
      isAutoGenerated: true,
      isEditable: false,
      completed: false,
    } as const;
    const before = [manualEvent, mappedEvent];
    const input = await baseInput(
      "habit.to-planning.v1",
      source,
      sourceRecord,
      {
        entityType: "setting",
        entityId: "zenflow-schedule-events",
        value: before,
        revisionToken: "44444444-4444-4444-8444-444444444444",
        automationOwned: false,
      },
      { preference: mappedPreference },
    );

    await expect(
      deriveAutomationTargetIdentity({
        ruleId: "habit.to-planning.v1",
        ownerUserId: OWNER_ID,
        source,
        preference: mappedPreference,
        sourceRecord,
      }),
    ).resolves.toEqual({
      entityType: "setting",
      entityId: "zenflow-schedule-events",
    });

    const result = await planAutomation(input);
    expect(result.kind).toBe("planned");
    if (result.kind !== "planned") throw new Error("Expected a planned revision");
    expect(result.revision.mutations).toEqual([
      {
        entityType: "setting",
        entityId: "zenflow-schedule-events",
        operation: "upsert",
        before,
        after: [
          manualEvent,
          { ...mappedEvent, completed: true, completedAt },
        ],
        beforeHash: await hashAutomationValue(before),
        afterHash: await hashAutomationValue([
          manualEvent,
          { ...mappedEvent, completed: true, completedAt },
        ]),
        beforeRevisionToken: "44444444-4444-4444-8444-444444444444",
        afterRevisionToken: "a12e0e63-847c-8321-a5a8-1ec6157be65a",
      },
    ]);
    expect(result.revision.plannedAt).toBe(completedAt);
  });

  it("keeps habit-to-planning disabled, unmapped, manual, duplicate, and stale targets as no-ops", async () => {
    const loggedAt = "2026-08-08T12:00:00.000Z";
    const completedAt = Date.parse(loggedAt);
    const source = {
      schemaVersion: 1,
      type: "habit",
      id: "habit-1",
      revision: `completion:2026-08-08:loggedAt:${loggedAt}`,
      committedAt: completedAt,
    } as const;
    const sourceRecord = {
      id: source.id,
      entries: {
        "2026-08-08": { value: 2, source: "quickTap", loggedAt },
      },
      habitType: "boolean",
      targetType: "atLeast",
      targetValue: 1,
      isArchived: false,
      updatedAt: completedAt,
    };
    const mappedPreference = {
      ...preference("habit.to-planning.v1"),
      planningHabitMappings: { [source.id]: "planning-event-1" },
    };
    const ownedEvent = {
      id: "planning-event-1",
      title: "Dedicated habit block",
      startHour: 8,
      startMinute: 0,
      endHour: 8,
      endMinute: 30,
      color: "#334455",
      date: "2026-08-08",
      source: "habit",
      habitId: source.id,
      isAutoGenerated: true,
      isEditable: false,
      completed: false,
    } as const;
    const input = await baseInput(
      "habit.to-planning.v1",
      source,
      sourceRecord,
      {
        entityType: "setting",
        entityId: "zenflow-schedule-events",
        value: [ownedEvent],
        revisionToken: "44444444-4444-4444-8444-444444444444",
        automationOwned: false,
      },
      { preference: mappedPreference },
    );

    expect(
      await planAutomation({
        ...input,
        preference: {
          ...mappedPreference,
          enabled: false,
          consentEpoch: null,
          enabledRuleIds: [],
        },
      }),
    ).toEqual({ kind: "noop", code: "PREFERENCE_DISABLED" });
    expect(
      await planAutomation({
        ...input,
        preference: { ...mappedPreference, planningHabitMappings: {} },
      }),
    ).toEqual({ kind: "noop", code: "MAPPING_MISSING" });
    expect(
      await planAutomation({
        ...input,
        target: {
          ...input.target,
          value: [{ ...ownedEvent, source: "manual", isAutoGenerated: false, isEditable: true }],
        },
      }),
    ).toEqual({ kind: "noop", code: "TARGET_NOT_AUTOMATION_OWNED" });
    expect(
      await planAutomation({
        ...input,
        target: { ...input.target, value: [ownedEvent, { ...ownedEvent }] },
      }),
    ).toEqual({ kind: "noop", code: "SOURCE_INVALID" });
    expect(
      await planAutomation({
        ...input,
        target: { ...input.target, value: [{ ...ownedEvent, date: "2026-08-09" }] },
      }),
    ).toEqual({ kind: "noop", code: "TARGET_INACTIVE" });
    expect(
      await planAutomation({
        ...input,
        target: {
          ...input.target,
          value: [{ ...ownedEvent, completed: true, completedAt }],
        },
      }),
    ).toEqual({ kind: "noop", code: "ALREADY_CURRENT" });
  });

  it("is retry-stable and rejects a source key or target identity mismatch", async () => {
    const source = {
      schemaVersion: 1,
      type: "journal",
      id: "journal-1",
      revision: "updatedAt:200",
      committedAt: 200,
    } as const;
    const target = {
      entityType: "mood",
      entityId: "a819230d-4f20-89c1-8628-85b86f50d450",
      value: null,
      revisionToken: null,
      automationOwned: false,
    } as const;
    const input = await baseInput(
      "journal.mood-to-checkin.v1",
      source,
      { id: source.id, date: "2026-08-08", mood: "good", updatedAt: 200 },
      target,
    );

    expect(await planAutomation(input)).toEqual(await planAutomation(input));
    expect(
      await planAutomation({ ...input, sourceKey: `sha256:${"0".repeat(64)}` }),
    ).toEqual({ kind: "noop", code: "SOURCE_INVALID" });
    expect(
      await planAutomation({
        ...input,
        target: { ...target, entityId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa" },
      }),
    ).toEqual({ kind: "noop", code: "SOURCE_INVALID" });
  });
});

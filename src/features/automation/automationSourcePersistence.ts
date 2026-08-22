import { logger } from "@/lib/logger";
import { runWithOriginExclusiveLock } from "@/lib/originExclusiveLock";
import { doesNumericalStoredValueMeetTarget } from "@/lib/habits";
import {
  runtimeFocusSessionSchema,
  runtimeHabitSchema,
  runtimeMoodEntrySchema,
} from "@/lib/schemas";
import {
  ACCOUNT_BOUNDARY_DATA_WRITE_LOCK,
  assertOriginAccountBoundaryGeneration,
  captureOriginAccountBoundaryGeneration,
  type OriginAccountBoundaryGeneration,
} from "@/storage/accountBoundaryRuntime";
import { db } from "@/storage/db";
import { validateSyncOwner } from "@/storage/sync/syncOwner";
import { ENTRY, type FocusSession, type Habit, type MoodEntry } from "@/types";
import type { JournalEntry } from "@/features/journal/types";

import { readAutomationPreference } from "./automationPreferences";
import { persistPrimaryRecordWithAutomationIntent } from "./automationRepository";
import { computeAutomationSourceKey } from "./sourceKey";
import { automationSourceIntentSchema, type AutomationSourceIntent } from "./types";

const MOOD_TO_JOURNAL_RULE_ID = "mood.note-to-journal.v1" as const;
const JOURNAL_TO_MOOD_RULE_ID = "journal.mood-to-checkin.v1" as const;
const FOCUS_TO_HABIT_RULE_ID = "focus.to-mapped-habit.v1" as const;
const HABIT_TO_PLANNING_RULE_ID = "habit.to-planning.v1" as const;

export interface PersistedMoodSource {
  readonly accountBoundaryGeneration: OriginAccountBoundaryGeneration;
  readonly intentId: string | null;
}

export interface PersistedFocusSource {
  readonly accountBoundaryGeneration: OriginAccountBoundaryGeneration;
  readonly intentId: string | null;
}

export interface PersistedHabitSource {
  readonly accountBoundaryGeneration: OriginAccountBoundaryGeneration;
  readonly intentId: string | null;
}

export async function prepareJournalAutomationSourceIntent(
  entry: JournalEntry,
  expectedOwnerUserId: string | null,
): Promise<AutomationSourceIntent | null> {
  if (!entry.mood || !expectedOwnerUserId) return null;
  const committedAt = entry.updatedAt;
  if (!Number.isSafeInteger(committedAt) || committedAt < 0) {
    throw new TypeError("Journal persistence requires a safe committed timestamp");
  }
  const accountBoundaryGeneration = captureOriginAccountBoundaryGeneration();
  try {
    const preference = await readAutomationPreference();
    if (
      !preference.enabled ||
      preference.consentEpoch === null ||
      !preference.enabledRuleIds.includes(JOURNAL_TO_MOOD_RULE_ID)
    ) {
      return null;
    }
    const ownerUserId = await validateSyncOwner(
      expectedOwnerUserId,
      "Connected-record journal source",
    );
    if (ownerUserId !== expectedOwnerUserId) return null;
    const source = {
      schemaVersion: 1 as const,
      type: "journal" as const,
      id: entry.id,
      revision: `updatedAt:${committedAt}`,
      committedAt,
    };
    const sourceKey = await computeAutomationSourceKey({
      ownerUserId,
      consentEpoch: preference.consentEpoch,
      ruleId: JOURNAL_TO_MOOD_RULE_ID,
      ruleVersion: 1,
      sourceType: source.type,
      sourceId: source.id,
      sourceRevision: source.revision,
    });
    assertOriginAccountBoundaryGeneration(accountBoundaryGeneration);
    return automationSourceIntentSchema.parse({
      kind: "source_pending",
      id: `source_pending:${sourceKey}`,
      schemaVersion: 1,
      ownerUserId,
      consentEpoch: preference.consentEpoch,
      accountBoundaryGeneration,
      source,
      candidateRuleIds: [JOURNAL_TO_MOOD_RULE_ID],
      sourceKey,
      createdAt: committedAt,
      updatedAt: committedAt,
    });
  } catch {
    assertOriginAccountBoundaryGeneration(accountBoundaryGeneration);
    logger.warn("[Automation] Journal source intent unavailable; preserving the primary entry only");
    return null;
  }
}

function moodCommittedAt(entry: MoodEntry): number {
  const value = entry.updatedAt ?? entry.timestamp;
  if (!Number.isSafeInteger(value) || value < 0) {
    throw new TypeError("Mood persistence requires a safe committed timestamp");
  }
  return value;
}

async function persistMoodOnly(
  entry: MoodEntry,
  accountBoundaryGeneration: OriginAccountBoundaryGeneration,
): Promise<void> {
  await runWithOriginExclusiveLock(ACCOUNT_BOUNDARY_DATA_WRITE_LOCK, async () => {
    assertOriginAccountBoundaryGeneration(accountBoundaryGeneration);
    await db.transaction("rw", db.moods, async () => {
      assertOriginAccountBoundaryGeneration(accountBoundaryGeneration);
      await db.moods.put(entry);
      assertOriginAccountBoundaryGeneration(accountBoundaryGeneration);
    });
  });
  assertOriginAccountBoundaryGeneration(accountBoundaryGeneration);
}

async function buildMoodSourceIntent(
  entry: MoodEntry,
  ownerUserId: string,
  consentEpoch: string,
  accountBoundaryGeneration: OriginAccountBoundaryGeneration,
): Promise<AutomationSourceIntent> {
  const committedAt = moodCommittedAt(entry);
  const source = {
    schemaVersion: 1 as const,
    type: "mood" as const,
    id: entry.id,
    revision: `updatedAt:${committedAt}`,
    committedAt,
  };
  const sourceKey = await computeAutomationSourceKey({
    ownerUserId,
    consentEpoch,
    ruleId: MOOD_TO_JOURNAL_RULE_ID,
    ruleVersion: 1,
    sourceType: source.type,
    sourceId: source.id,
    sourceRevision: source.revision,
  });
  return automationSourceIntentSchema.parse({
    kind: "source_pending",
    id: `source_pending:${sourceKey}`,
    schemaVersion: 1,
    ownerUserId,
    consentEpoch,
    accountBoundaryGeneration,
    source,
    candidateRuleIds: [MOOD_TO_JOURNAL_RULE_ID],
    sourceKey,
    createdAt: committedAt,
    updatedAt: committedAt,
  });
}

/**
 * Persists the user-owned mood before any UI success publication. When the
 * current owner and consent epoch authorize the mood-to-journal rule, the
 * prose-free source intent shares the same Dexie transaction. Automation
 * unavailability never fabricates a result or discards an otherwise valid
 * primary mood; account-boundary changes still fail closed.
 */
export async function persistMoodSourceRecord(rawEntry: MoodEntry): Promise<PersistedMoodSource> {
  const entry = runtimeMoodEntrySchema.parse(rawEntry) as MoodEntry;
  const accountBoundaryGeneration = captureOriginAccountBoundaryGeneration();
  const preference = await readAutomationPreference();
  const hasEligibleNote = typeof entry.note === "string" && entry.note.trim().length > 0;
  const automationEligible =
    hasEligibleNote &&
    preference.enabled &&
    preference.consentEpoch !== null &&
    preference.enabledRuleIds.includes(MOOD_TO_JOURNAL_RULE_ID);

  if (!automationEligible || preference.consentEpoch === null) {
    await persistMoodOnly(entry, accountBoundaryGeneration);
    return { accountBoundaryGeneration, intentId: null };
  }

  try {
    const ownerUserId = await validateSyncOwner(undefined, "Connected-record mood source");
    if (ownerUserId) {
      const intent = await buildMoodSourceIntent(
        entry,
        ownerUserId,
        preference.consentEpoch,
        accountBoundaryGeneration,
      );
      const result = await persistPrimaryRecordWithAutomationIntent(entry, intent, ownerUserId);
      assertOriginAccountBoundaryGeneration(accountBoundaryGeneration);
      return {
        accountBoundaryGeneration,
        intentId: result.intentPersisted ? intent.id : null,
      };
    }
  } catch {
    assertOriginAccountBoundaryGeneration(accountBoundaryGeneration);
    logger.warn("[Automation] Mood source intent unavailable; preserving the primary mood only");
  }

  await persistMoodOnly(entry, accountBoundaryGeneration);
  return { accountBoundaryGeneration, intentId: null };
}

function focusCommittedAt(session: FocusSession): number {
  const value = session.updatedAt ?? session.completedAt;
  if (!Number.isSafeInteger(value) || value < 0) {
    throw new TypeError("Focus persistence requires a safe committed timestamp");
  }
  return value;
}

async function persistFocusOnly(
  session: FocusSession,
  accountBoundaryGeneration: OriginAccountBoundaryGeneration,
): Promise<void> {
  await runWithOriginExclusiveLock(ACCOUNT_BOUNDARY_DATA_WRITE_LOCK, async () => {
    assertOriginAccountBoundaryGeneration(accountBoundaryGeneration);
    await db.transaction("rw", db.focusSessions, async () => {
      assertOriginAccountBoundaryGeneration(accountBoundaryGeneration);
      await db.focusSessions.put(session);
      assertOriginAccountBoundaryGeneration(accountBoundaryGeneration);
    });
  });
  assertOriginAccountBoundaryGeneration(accountBoundaryGeneration);
}

async function buildFocusSourceIntent(
  session: FocusSession,
  ownerUserId: string,
  consentEpoch: string,
  accountBoundaryGeneration: OriginAccountBoundaryGeneration,
): Promise<AutomationSourceIntent> {
  const committedAt = focusCommittedAt(session);
  const source = {
    schemaVersion: 1 as const,
    type: "focus" as const,
    id: session.id,
    revision: `updatedAt:${committedAt}`,
    committedAt,
  };
  const sourceKey = await computeAutomationSourceKey({
    ownerUserId,
    consentEpoch,
    ruleId: FOCUS_TO_HABIT_RULE_ID,
    ruleVersion: 1,
    sourceType: source.type,
    sourceId: source.id,
    sourceRevision: source.revision,
  });
  return automationSourceIntentSchema.parse({
    kind: "source_pending",
    id: `source_pending:${sourceKey}`,
    schemaVersion: 1,
    ownerUserId,
    consentEpoch,
    accountBoundaryGeneration,
    source,
    candidateRuleIds: [FOCUS_TO_HABIT_RULE_ID],
    sourceKey,
    createdAt: committedAt,
    updatedAt: committedAt,
  });
}

export async function persistFocusSourceRecord(
  rawSession: FocusSession,
): Promise<PersistedFocusSource> {
  const session = runtimeFocusSessionSchema.parse(rawSession) as FocusSession;
  const accountBoundaryGeneration = captureOriginAccountBoundaryGeneration();
  const preference = await readAutomationPreference();
  const automationEligible =
    session.status === "completed" &&
    preference.enabled &&
    preference.consentEpoch !== null &&
    preference.focusHabitId !== null &&
    preference.enabledRuleIds.includes(FOCUS_TO_HABIT_RULE_ID);

  if (!automationEligible || preference.consentEpoch === null) {
    await persistFocusOnly(session, accountBoundaryGeneration);
    return { accountBoundaryGeneration, intentId: null };
  }

  try {
    const ownerUserId = await validateSyncOwner(undefined, "Connected-record focus source");
    if (ownerUserId) {
      const intent = await buildFocusSourceIntent(
        session,
        ownerUserId,
        preference.consentEpoch,
        accountBoundaryGeneration,
      );
      const result = await persistPrimaryRecordWithAutomationIntent(
        session,
        intent,
        ownerUserId,
      );
      assertOriginAccountBoundaryGeneration(accountBoundaryGeneration);
      return {
        accountBoundaryGeneration,
        intentId: result.intentPersisted ? intent.id : null,
      };
    }
  } catch {
    assertOriginAccountBoundaryGeneration(accountBoundaryGeneration);
    logger.warn("[Automation] Focus source intent unavailable; preserving the primary focus only");
  }

  await persistFocusOnly(session, accountBoundaryGeneration);
  return { accountBoundaryGeneration, intentId: null };
}

function canonicalCompletionTimestamp(value: string | undefined): number | null {
  if (!value) return null;
  const parsed = Date.parse(value);
  if (!Number.isSafeInteger(parsed) || parsed < 0) return null;
  return new Date(parsed).toISOString() === value ? parsed : null;
}

function isCanonicalDate(value: string): boolean {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/u.exec(value);
  if (!match) return false;
  const date = new Date(
    Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3])),
  );
  return (
    date.getUTCFullYear() === Number(match[1]) &&
    date.getUTCMonth() === Number(match[2]) - 1 &&
    date.getUTCDate() === Number(match[3])
  );
}

function isExplicitManualCompletion(habit: Habit, date: string): boolean {
  const entry = habit.entries[date];
  if (!entry || !["quickTap", "exactInput", "calendar"].includes(entry.source ?? "")) {
    return false;
  }
  if (canonicalCompletionTimestamp(entry.loggedAt) === null) return false;
  return habit.habitType === "boolean"
    ? entry.value === ENTRY.YES_MANUAL
    : doesNumericalStoredValueMeetTarget(habit, entry.value);
}

async function persistHabitOnly(
  habit: Habit,
  accountBoundaryGeneration: OriginAccountBoundaryGeneration,
): Promise<void> {
  await runWithOriginExclusiveLock(ACCOUNT_BOUNDARY_DATA_WRITE_LOCK, async () => {
    assertOriginAccountBoundaryGeneration(accountBoundaryGeneration);
    await db.transaction("rw", db.habits, async () => {
      assertOriginAccountBoundaryGeneration(accountBoundaryGeneration);
      await db.habits.put(habit);
      assertOriginAccountBoundaryGeneration(accountBoundaryGeneration);
    });
  });
  assertOriginAccountBoundaryGeneration(accountBoundaryGeneration);
}

async function buildHabitSourceIntent(
  habit: Habit,
  completionDate: string,
  ownerUserId: string,
  consentEpoch: string,
  accountBoundaryGeneration: OriginAccountBoundaryGeneration,
): Promise<AutomationSourceIntent> {
  const entry = habit.entries[completionDate];
  const committedAt = canonicalCompletionTimestamp(entry?.loggedAt);
  if (committedAt === null || !isCanonicalDate(completionDate)) {
    throw new TypeError("Habit completion requires a canonical date and timestamp");
  }
  const source = {
    schemaVersion: 1 as const,
    type: "habit" as const,
    id: habit.id,
    revision: `completion:${completionDate}:loggedAt:${entry.loggedAt}`,
    committedAt,
  };
  const sourceKey = await computeAutomationSourceKey({
    ownerUserId,
    consentEpoch,
    ruleId: HABIT_TO_PLANNING_RULE_ID,
    ruleVersion: 1,
    sourceType: source.type,
    sourceId: source.id,
    sourceRevision: source.revision,
  });
  return automationSourceIntentSchema.parse({
    kind: "source_pending",
    id: `source_pending:${sourceKey}`,
    schemaVersion: 1,
    ownerUserId,
    consentEpoch,
    accountBoundaryGeneration,
    source,
    candidateRuleIds: [HABIT_TO_PLANNING_RULE_ID],
    sourceKey,
    createdAt: committedAt,
    updatedAt: committedAt,
  });
}

/**
 * Persists a user-owned habit before UI success publication. Only an explicit
 * incomplete-to-complete action may emit a prose-free planning source intent;
 * resets, skips, legacy entries and unmapped habits remain ordinary records.
 */
export async function persistHabitSourceRecord(
  rawHabit: Habit,
  completionDate: string | null,
): Promise<PersistedHabitSource> {
  const habit = runtimeHabitSchema.parse(rawHabit) as Habit;
  const accountBoundaryGeneration = captureOriginAccountBoundaryGeneration();
  const preference = await readAutomationPreference();
  const mappedEventId = preference.planningHabitMappings[habit.id];
  const automationEligible =
    completionDate !== null &&
    isCanonicalDate(completionDate) &&
    isExplicitManualCompletion(habit, completionDate) &&
    typeof mappedEventId === "string" &&
    mappedEventId.length > 0 &&
    preference.enabled &&
    preference.consentEpoch !== null &&
    preference.enabledRuleIds.includes(HABIT_TO_PLANNING_RULE_ID);

  if (!automationEligible || preference.consentEpoch === null || completionDate === null) {
    await persistHabitOnly(habit, accountBoundaryGeneration);
    return { accountBoundaryGeneration, intentId: null };
  }

  try {
    const ownerUserId = await validateSyncOwner(undefined, "Connected-record habit source");
    if (ownerUserId) {
      const intent = await buildHabitSourceIntent(
        habit,
        completionDate,
        ownerUserId,
        preference.consentEpoch,
        accountBoundaryGeneration,
      );
      const result = await persistPrimaryRecordWithAutomationIntent(
        habit,
        intent,
        ownerUserId,
      );
      assertOriginAccountBoundaryGeneration(accountBoundaryGeneration);
      return {
        accountBoundaryGeneration,
        intentId: result.intentPersisted ? intent.id : null,
      };
    }
  } catch {
    assertOriginAccountBoundaryGeneration(accountBoundaryGeneration);
    logger.warn("[Automation] Habit source intent unavailable; preserving the primary habit only");
  }

  await persistHabitOnly(habit, accountBoundaryGeneration);
  return { accountBoundaryGeneration, intentId: null };
}

import { logger } from "@/lib/logger";
import { offlineQueue } from "@/lib/offlineQueue";
import { runWithOriginExclusiveLock } from "@/lib/originExclusiveLock";
import { isDataWriteBarrierPostCommitError, runWithDataWriteBarrier } from "@/hooks/useIndexedDB";
import {
  createFocusSessionOutboxIdentity,
  persistFocusSessionOutboxInCurrentTransaction,
} from "@/lib/focusSessionOutbox";
import { doesNumericalStoredValueMeetTarget } from "@/lib/habits";
import {
  runtimeFocusSessionSchema,
  runtimeHabitSchema,
  runtimeMoodEntrySchema,
} from "@/lib/schemas";
import {
  ACCOUNT_BOUNDARY_DATA_WRITE_LOCK,
  assertAccountSessionTransitionGeneration,
  assertOriginAccountBoundaryGeneration,
  captureAccountSessionTransitionGeneration,
  captureOriginAccountBoundaryGeneration,
  type AccountSessionTransitionGeneration,
  type OriginAccountBoundaryGeneration,
} from "@/storage/accountBoundaryRuntime";
import { db, getLocalDataOwnerId } from "@/storage/db";
import { validateSyncOwner } from "@/storage/sync/syncOwner";
import { ENTRY, type FocusSession, type Habit, type MoodEntry } from "@/types";
import {
  pendingFocusCommitMatches,
  readPendingFocusCommit,
  type PendingFocusCommit,
} from "@/types/focusTimerTypes";
import type { JournalEntry } from "@/features/journal/types";

import { readAutomationPreference } from "./automationPreferences";
import {
  markAutomationSourceRescanRequiredInCurrentTransaction,
  persistManualHabitCompletionOutboxInCurrentTransaction,
  persistManualMoodOutboxInCurrentTransaction,
  persistPrimaryRecordWithAutomationIntent,
  persistRecoveredAutomationSourceIntents,
  type RecoveredAutomationSourceIntents,
} from "./automationRepository";
import { signalAutomationSourceReady } from "./automationRuntimeSignals";
import { computeAutomationSourceKey } from "./sourceKey";
import {
  AUTOMATION_SOURCE_RESCAN_SETTING_KEY,
  automationSourceIntentSchema,
  automationSourceRescanMarkerSchema,
  type AutomationPreference,
  type AutomationSourceIntent,
} from "./types";

const MOOD_TO_JOURNAL_RULE_ID = "mood.note-to-journal.v1" as const;
const JOURNAL_TO_MOOD_RULE_ID = "journal.mood-to-checkin.v1" as const;
const FOCUS_TO_HABIT_RULE_ID = "focus.to-mapped-habit.v1" as const;
const HABIT_TO_PLANNING_RULE_ID = "habit.to-planning.v1" as const;
const HABIT_ENTRY_WRITE_LOCK = "zenflow:habit-entry-write";

interface PrimaryWriteBoundaryContext {
  readonly accountBoundaryGeneration: OriginAccountBoundaryGeneration;
  readonly sessionGeneration: AccountSessionTransitionGeneration;
}

function capturePrimaryWriteBoundaryContext(): PrimaryWriteBoundaryContext {
  return {
    accountBoundaryGeneration: captureOriginAccountBoundaryGeneration(),
    sessionGeneration: captureAccountSessionTransitionGeneration(),
  };
}

function assertPrimaryWriteBoundaryContext(context: PrimaryWriteBoundaryContext): void {
  assertOriginAccountBoundaryGeneration(context.accountBoundaryGeneration);
  assertAccountSessionTransitionGeneration(context.sessionGeneration);
}

export interface PersistedMoodSource {
  readonly accountBoundaryGeneration: OriginAccountBoundaryGeneration;
  readonly intentId: string | null;
  readonly intentDeferred?: "capacity" | "recovery";
  readonly syncOutboxPersisted?: boolean;
}

export interface PersistedFocusSource {
  readonly accountBoundaryGeneration: OriginAccountBoundaryGeneration;
  readonly intentId: string | null;
  readonly intentDeferred?: "capacity" | "recovery";
  readonly primaryInserted: boolean;
  readonly syncOutboxPersisted: boolean;
}

export interface FocusPersistenceBoundary {
  readonly ownerUserId: string | null;
  readonly accountBoundaryGeneration: OriginAccountBoundaryGeneration;
  readonly expectedPending?: PendingFocusCommit;
}

export interface PersistedHabitSource {
  readonly accountBoundaryGeneration: OriginAccountBoundaryGeneration;
  readonly intentId: string | null;
  readonly intentDeferred?: "capacity" | "recovery";
  readonly habit?: Habit;
  readonly syncOutboxPersisted?: boolean;
}

interface AutomationSourceRecoveryMarker {
  readonly ownerUserId: string;
  readonly requestedAt: number;
}

export interface PreparedJournalAutomationSourceCommit {
  readonly intent: AutomationSourceIntent | null;
  readonly recoveryMarker: AutomationSourceRecoveryMarker | null;
}

async function buildJournalSourceIntent(
  entry: JournalEntry,
  ownerUserId: string,
  consentEpoch: string,
  accountBoundaryGeneration: OriginAccountBoundaryGeneration
): Promise<AutomationSourceIntent> {
  const committedAt = entry.updatedAt;
  if (!Number.isSafeInteger(committedAt) || committedAt < 0) {
    throw new TypeError("Journal persistence requires a safe committed timestamp");
  }
  const source = {
    schemaVersion: 1 as const,
    type: "journal" as const,
    id: entry.id,
    revision: `updatedAt:${committedAt}`,
    committedAt,
  };
  const sourceKey = await computeAutomationSourceKey({
    ownerUserId,
    consentEpoch,
    ruleId: JOURNAL_TO_MOOD_RULE_ID,
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
    candidateRuleIds: [JOURNAL_TO_MOOD_RULE_ID],
    sourceKey,
    createdAt: committedAt,
    updatedAt: committedAt,
  });
}

export async function prepareJournalAutomationSourceCommit(
  entry: JournalEntry,
  expectedOwnerUserId: string | null
): Promise<PreparedJournalAutomationSourceCommit> {
  if (!entry.mood || !expectedOwnerUserId) {
    return { intent: null, recoveryMarker: null };
  }
  const accountBoundaryGeneration = captureOriginAccountBoundaryGeneration();
  try {
    const preference = await readAutomationPreference();
    if (
      !preference.enabled ||
      preference.consentEpoch === null ||
      !preference.enabledRuleIds.includes(JOURNAL_TO_MOOD_RULE_ID)
    ) {
      return { intent: null, recoveryMarker: null };
    }
    const ownerUserId = await validateSyncOwner(
      expectedOwnerUserId,
      "Connected-record journal source"
    );
    if (ownerUserId !== expectedOwnerUserId) {
      return {
        intent: null,
        recoveryMarker: { ownerUserId: expectedOwnerUserId, requestedAt: entry.updatedAt },
      };
    }
    assertOriginAccountBoundaryGeneration(accountBoundaryGeneration);
    return {
      intent: await buildJournalSourceIntent(
        entry,
        ownerUserId,
        preference.consentEpoch,
        accountBoundaryGeneration
      ),
      recoveryMarker: null,
    };
  } catch {
    assertOriginAccountBoundaryGeneration(accountBoundaryGeneration);
    logger.warn(
      "[Automation] Journal source intent unavailable; preserving the primary entry only"
    );
    return {
      intent: null,
      recoveryMarker: { ownerUserId: expectedOwnerUserId, requestedAt: entry.updatedAt },
    };
  }
}

export async function prepareJournalAutomationSourceIntent(
  entry: JournalEntry,
  expectedOwnerUserId: string | null
): Promise<AutomationSourceIntent | null> {
  return (await prepareJournalAutomationSourceCommit(entry, expectedOwnerUserId)).intent;
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
  boundaryContext: PrimaryWriteBoundaryContext,
  recoveryMarker?: AutomationSourceRecoveryMarker,
  outboxOwnerUserId: string | null = null
): Promise<boolean> {
  const syncOutboxPersisted = await runWithOriginExclusiveLock(
    ACCOUNT_BOUNDARY_DATA_WRITE_LOCK,
    async () => {
      assertPrimaryWriteBoundaryContext(boundaryContext);
      return db.transaction(
        "rw",
        [db.moods, db.settings, db.automationTransactions, db.offlineQueue],
        async () => {
          assertPrimaryWriteBoundaryContext(boundaryContext);
          await db.moods.put(entry);
          const outboxPersisted = await persistManualMoodOutboxInCurrentTransaction(
            entry,
            outboxOwnerUserId
          );
          if (recoveryMarker) {
            await markAutomationSourceRescanRequiredInCurrentTransaction(
              recoveryMarker.ownerUserId,
              recoveryMarker.requestedAt
            );
          }
          assertPrimaryWriteBoundaryContext(boundaryContext);
          return outboxPersisted;
        }
      );
    }
  );
  assertPrimaryWriteBoundaryContext(boundaryContext);
  return syncOutboxPersisted;
}

async function buildMoodSourceIntent(
  entry: MoodEntry,
  ownerUserId: string,
  consentEpoch: string,
  accountBoundaryGeneration: OriginAccountBoundaryGeneration
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
  const boundaryContext = capturePrimaryWriteBoundaryContext();
  const { accountBoundaryGeneration } = boundaryContext;
  const outboxOwnerUserId = await validateSyncOwner(undefined, "Manual mood outbox");
  assertPrimaryWriteBoundaryContext(boundaryContext);
  const preference = await readAutomationPreference();
  assertPrimaryWriteBoundaryContext(boundaryContext);
  const hasEligibleNote = typeof entry.note === "string" && entry.note.trim().length > 0;
  const automationEligible =
    hasEligibleNote &&
    preference.enabled &&
    preference.consentEpoch !== null &&
    preference.enabledRuleIds.includes(MOOD_TO_JOURNAL_RULE_ID);

  if (!automationEligible || preference.consentEpoch === null) {
    const syncOutboxPersisted = await persistMoodOnly(
      entry,
      boundaryContext,
      undefined,
      outboxOwnerUserId
    );
    if (syncOutboxPersisted) {
      try {
        await offlineQueue.wakeFromDurableStorage();
      } catch {
        logger.warn("[Automation] Durable mood queue wake deferred");
      }
    }
    return { accountBoundaryGeneration, intentId: null, syncOutboxPersisted };
  }

  let recoveryOwnerUserId: string | null = null;
  try {
    const ownerUserId = await validateSyncOwner(undefined, "Connected-record mood source");
    if (ownerUserId) {
      recoveryOwnerUserId = ownerUserId;
      const intent = await buildMoodSourceIntent(
        entry,
        ownerUserId,
        preference.consentEpoch,
        accountBoundaryGeneration
      );
      const result = await persistPrimaryRecordWithAutomationIntent(
        entry,
        intent,
        ownerUserId,
        boundaryContext.sessionGeneration
      );
      assertPrimaryWriteBoundaryContext(boundaryContext);
      if (result.syncOutboxPersisted) {
        try {
          await offlineQueue.wakeFromDurableStorage();
        } catch {
          logger.warn("[Automation] Durable mood queue wake deferred");
        }
      }
      return {
        accountBoundaryGeneration,
        intentId: result.intentPersisted ? intent.id : null,
        ...(result.intentDeferred ? { intentDeferred: result.intentDeferred } : {}),
        syncOutboxPersisted: result.syncOutboxPersisted,
      };
    }
  } catch {
    assertPrimaryWriteBoundaryContext(boundaryContext);
    logger.warn("[Automation] Mood source intent unavailable; preserving the primary mood only");
  }

  const syncOutboxPersisted = await persistMoodOnly(
    entry,
    boundaryContext,
    recoveryOwnerUserId
      ? { ownerUserId: recoveryOwnerUserId, requestedAt: moodCommittedAt(entry) }
      : undefined,
    outboxOwnerUserId
  );
  if (recoveryOwnerUserId) signalAutomationSourceReady();
  if (syncOutboxPersisted) {
    try {
      await offlineQueue.wakeFromDurableStorage();
    } catch {
      logger.warn("[Automation] Durable mood queue wake deferred");
    }
  }
  return {
    accountBoundaryGeneration,
    intentId: null,
    ...(recoveryOwnerUserId ? { intentDeferred: "recovery" as const } : {}),
    syncOutboxPersisted,
  };
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
  boundaryContext: PrimaryWriteBoundaryContext,
  expectedBoundary?: FocusPersistenceBoundary,
  recoveryMarker?: AutomationSourceRecoveryMarker
): Promise<{ primaryInserted: boolean; syncOutboxPersisted: boolean }> {
  const result = await runWithOriginExclusiveLock(ACCOUNT_BOUNDARY_DATA_WRITE_LOCK, async () => {
    assertPrimaryWriteBoundaryContext(boundaryContext);
    const localOwnerUserId = await getLocalDataOwnerId();
    if (
      expectedBoundary &&
      (localOwnerUserId !== expectedBoundary.ownerUserId ||
        expectedBoundary.accountBoundaryGeneration !== boundaryContext.accountBoundaryGeneration)
    ) {
      throw new Error("Focus persistence boundary changed");
    }
    assertExpectedFocusPending(session, expectedBoundary);
    const outboxIdentity = localOwnerUserId
      ? await createFocusSessionOutboxIdentity(session, localOwnerUserId)
      : null;
    return db.transaction("rw", [db.focusSessions, db.offlineQueue, db.settings], async () => {
      assertPrimaryWriteBoundaryContext(boundaryContext);
      assertExpectedFocusPending(session, expectedBoundary);
      const current = await db.focusSessions.get(session.id);
      const inserted = current === undefined;
      await db.focusSessions.put(session);
      if (localOwnerUserId && outboxIdentity) {
        await persistFocusSessionOutboxInCurrentTransaction(
          session,
          localOwnerUserId,
          outboxIdentity
        );
      }
      if (recoveryMarker) {
        await markAutomationSourceRescanRequiredInCurrentTransaction(
          recoveryMarker.ownerUserId,
          recoveryMarker.requestedAt
        );
      }
      assertExpectedFocusPending(session, expectedBoundary);
      assertPrimaryWriteBoundaryContext(boundaryContext);
      return {
        primaryInserted: inserted,
        syncOutboxPersisted: localOwnerUserId !== null,
      };
    });
  });
  assertPrimaryWriteBoundaryContext(boundaryContext);
  return result;
}

function focusSessionMatches(left: FocusSession, right: FocusSession): boolean {
  return (
    left.id === right.id &&
    left.duration === right.duration &&
    left.completedAt === right.completedAt &&
    left.date === right.date &&
    left.label === right.label &&
    left.status === right.status &&
    left.reflection === right.reflection &&
    left.updatedAt === right.updatedAt
  );
}

function assertExpectedFocusPending(
  session: FocusSession,
  expectedBoundary?: FocusPersistenceBoundary
): void {
  const expected = expectedBoundary?.expectedPending;
  if (!expected) return;
  if (
    expected.ownerUserId !== expectedBoundary.ownerUserId ||
    expected.accountBoundaryGeneration !== expectedBoundary.accountBoundaryGeneration ||
    !focusSessionMatches(expected.session, session)
  ) {
    throw new Error("Focus persistence receipt changed");
  }
  const current = readPendingFocusCommit();
  if (current.status !== "present" || !pendingFocusCommitMatches(current.value, expected)) {
    throw new Error("Focus persistence receipt changed");
  }
}

async function buildFocusSourceIntent(
  session: FocusSession,
  ownerUserId: string,
  consentEpoch: string,
  accountBoundaryGeneration: OriginAccountBoundaryGeneration
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
  expectedBoundary?: FocusPersistenceBoundary
): Promise<PersistedFocusSource> {
  const session = runtimeFocusSessionSchema.parse(rawSession) as FocusSession;
  const boundaryContext = capturePrimaryWriteBoundaryContext();
  const { accountBoundaryGeneration } = boundaryContext;
  if (
    expectedBoundary &&
    expectedBoundary.accountBoundaryGeneration !== accountBoundaryGeneration
  ) {
    throw new Error("Focus persistence boundary changed");
  }
  if (expectedBoundary && (await getLocalDataOwnerId()) !== expectedBoundary.ownerUserId) {
    throw new Error("Focus persistence owner changed");
  }
  assertExpectedFocusPending(session, expectedBoundary);
  const preference = await readAutomationPreference();
  assertPrimaryWriteBoundaryContext(boundaryContext);
  const automationEligible =
    session.status === "completed" &&
    preference.enabled &&
    preference.consentEpoch !== null &&
    preference.focusHabitId !== null &&
    preference.enabledRuleIds.includes(FOCUS_TO_HABIT_RULE_ID);

  if (!automationEligible || preference.consentEpoch === null) {
    const persisted = await persistFocusOnly(session, boundaryContext, expectedBoundary);
    return { accountBoundaryGeneration, intentId: null, ...persisted };
  }

  let recoveryOwnerUserId: string | null = null;
  try {
    const ownerUserId = await validateSyncOwner(undefined, "Connected-record focus source");
    if (ownerUserId) {
      recoveryOwnerUserId = ownerUserId;
      if (expectedBoundary && ownerUserId !== expectedBoundary.ownerUserId) {
        throw new Error("Focus persistence owner changed");
      }
      const intent = await buildFocusSourceIntent(
        session,
        ownerUserId,
        preference.consentEpoch,
        accountBoundaryGeneration
      );
      const result = await persistPrimaryRecordWithAutomationIntent(
        session,
        intent,
        ownerUserId,
        boundaryContext.sessionGeneration,
        expectedBoundary?.expectedPending
      );
      assertPrimaryWriteBoundaryContext(boundaryContext);
      return {
        accountBoundaryGeneration,
        intentId: result.intentPersisted ? intent.id : null,
        primaryInserted: result.primaryInserted,
        syncOutboxPersisted: result.syncOutboxPersisted,
        ...(result.intentDeferred ? { intentDeferred: result.intentDeferred } : {}),
      };
    }
  } catch {
    assertPrimaryWriteBoundaryContext(boundaryContext);
    logger.warn("[Automation] Focus source intent unavailable; preserving the primary focus only");
  }

  const persisted = await persistFocusOnly(
    session,
    boundaryContext,
    expectedBoundary,
    recoveryOwnerUserId
      ? { ownerUserId: recoveryOwnerUserId, requestedAt: focusCommittedAt(session) }
      : undefined
  );
  if (recoveryOwnerUserId) signalAutomationSourceReady();
  return {
    accountBoundaryGeneration,
    intentId: null,
    ...(recoveryOwnerUserId ? { intentDeferred: "recovery" as const } : {}),
    ...persisted,
  };
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
  const date = new Date(Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3])));
  return (
    date.getUTCFullYear() === Number(match[1]) &&
    date.getUTCMonth() === Number(match[2]) - 1 &&
    date.getUTCDate() === Number(match[3])
  );
}

function advanceHabitUpdatedAt(latest: Habit, incoming: Habit): string {
  const latestTime = Date.parse(latest.updatedAt ?? "");
  const incomingTime = Date.parse(incoming.updatedAt ?? "");
  const floor = Math.max(
    Number.isFinite(latestTime) ? latestTime : 0,
    Number.isFinite(incomingTime) ? incomingTime : 0
  );
  if (floor >= 8_640_000_000_000_000) {
    throw new TypeError("Habit revision cannot advance safely");
  }
  return new Date(Math.max(Date.now(), floor + 1)).toISOString();
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
  boundaryContext: PrimaryWriteBoundaryContext,
  dataWriteLockHeld = false,
  recoveryMarker?: AutomationSourceRecoveryMarker,
  manualEntry?: { readonly date: string; readonly ownerUserId: string | null }
): Promise<boolean> {
  const persistInDataBoundary = async () => {
    assertPrimaryWriteBoundaryContext(boundaryContext);
    return db.transaction(
      "rw",
      [db.habits, db.settings, db.automationTransactions, db.offlineQueue],
      async () => {
        assertPrimaryWriteBoundaryContext(boundaryContext);
        await db.habits.put(habit);
        const syncOutboxPersisted = manualEntry
          ? await persistManualHabitCompletionOutboxInCurrentTransaction(
              habit,
              manualEntry.date,
              manualEntry.ownerUserId
            )
          : false;
        if (recoveryMarker) {
          await markAutomationSourceRescanRequiredInCurrentTransaction(
            recoveryMarker.ownerUserId,
            recoveryMarker.requestedAt
          );
        }
        assertPrimaryWriteBoundaryContext(boundaryContext);
        return syncOutboxPersisted;
      }
    );
  };
  let syncOutboxPersisted: boolean;
  if (dataWriteLockHeld) syncOutboxPersisted = await persistInDataBoundary();
  else {
    syncOutboxPersisted = await runWithOriginExclusiveLock(
      ACCOUNT_BOUNDARY_DATA_WRITE_LOCK,
      persistInDataBoundary
    );
  }
  assertPrimaryWriteBoundaryContext(boundaryContext);
  return syncOutboxPersisted;
}

async function buildHabitSourceIntent(
  habit: Habit,
  completionDate: string,
  ownerUserId: string,
  consentEpoch: string,
  accountBoundaryGeneration: OriginAccountBoundaryGeneration
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

async function buildRecoverableSourceIntents(
  preference: AutomationPreference,
  ownerUserId: string,
  accountBoundaryGeneration: OriginAccountBoundaryGeneration,
  requestedAt: number
): Promise<AutomationSourceIntent[]> {
  if (!preference.enabled || preference.consentEpoch === null) return [];
  const recoveryWindowStart = Math.max(preference.consentedAt ?? requestedAt, requestedAt);
  const intents: AutomationSourceIntent[] = [];

  if (preference.enabledRuleIds.includes(MOOD_TO_JOURNAL_RULE_ID)) {
    const moods = await db.moods.toArray();
    moods.sort((left, right) => moodCommittedAt(left) - moodCommittedAt(right));
    for (const entry of moods) {
      if (typeof entry.note !== "string" || entry.note.trim().length === 0) continue;
      if (moodCommittedAt(entry) < recoveryWindowStart) continue;
      intents.push(
        await buildMoodSourceIntent(
          entry,
          ownerUserId,
          preference.consentEpoch,
          accountBoundaryGeneration
        )
      );
    }
  }

  if (preference.enabledRuleIds.includes(JOURNAL_TO_MOOD_RULE_ID)) {
    const entries = await db.journalEntries.orderBy("updatedAt").toArray();
    for (const entry of entries) {
      if (!entry.mood) continue;
      if (entry.updatedAt < recoveryWindowStart) continue;
      intents.push(
        await buildJournalSourceIntent(
          entry,
          ownerUserId,
          preference.consentEpoch,
          accountBoundaryGeneration
        )
      );
    }
  }

  if (
    preference.focusHabitId !== null &&
    preference.enabledRuleIds.includes(FOCUS_TO_HABIT_RULE_ID)
  ) {
    const sessions = await db.focusSessions.toArray();
    sessions.sort((left, right) => focusCommittedAt(left) - focusCommittedAt(right));
    for (const session of sessions) {
      if (session.status !== "completed") continue;
      if (focusCommittedAt(session) < recoveryWindowStart) continue;
      intents.push(
        await buildFocusSourceIntent(
          session,
          ownerUserId,
          preference.consentEpoch,
          accountBoundaryGeneration
        )
      );
    }
  }

  if (preference.enabledRuleIds.includes(HABIT_TO_PLANNING_RULE_ID)) {
    const habits = await db.habits.toArray();
    for (const habit of habits) {
      if (!preference.planningHabitMappings[habit.id]) continue;
      for (const date of Object.keys(habit.entries).sort()) {
        if (!isExplicitManualCompletion(habit, date)) continue;
        const committedAt = canonicalCompletionTimestamp(habit.entries[date]?.loggedAt);
        if (committedAt === null || committedAt < recoveryWindowStart) continue;
        intents.push(
          await buildHabitSourceIntent(
            habit,
            date,
            ownerUserId,
            preference.consentEpoch,
            accountBoundaryGeneration
          )
        );
      }
    }
  }

  return intents;
}

export async function recoverDeferredAutomationSourceIntents(
  expectedOwnerUserId: string
): Promise<RecoveredAutomationSourceIntents> {
  const boundaryContext = capturePrimaryWriteBoundaryContext();
  const markerRow = await db.settings.get(AUTOMATION_SOURCE_RESCAN_SETTING_KEY);
  const marker = automationSourceRescanMarkerSchema.safeParse(markerRow?.value);
  assertPrimaryWriteBoundaryContext(boundaryContext);
  if (!markerRow) return { recovered: 0, remaining: false };
  if (marker.success && marker.data.ownerUserId !== expectedOwnerUserId) {
    throw new Error("Automation source rescan belongs to another account");
  }
  const ownerUserId = await validateSyncOwner(
    expectedOwnerUserId,
    "Connected-record source recovery"
  );
  assertPrimaryWriteBoundaryContext(boundaryContext);
  if (ownerUserId !== expectedOwnerUserId) {
    throw new Error("Connected-record source recovery owner unavailable");
  }

  return persistRecoveredAutomationSourceIntents(
    async (requestedAt) => {
      const preference = await readAutomationPreference();
      assertPrimaryWriteBoundaryContext(boundaryContext);
      return buildRecoverableSourceIntents(
        preference,
        ownerUserId,
        boundaryContext.accountBoundaryGeneration,
        requestedAt
      );
    },
    ownerUserId,
    boundaryContext.accountBoundaryGeneration,
    boundaryContext.sessionGeneration
  );
}

/**
 * Persists a user-owned habit before UI success publication. Only an explicit
 * incomplete-to-complete action may emit a prose-free planning source intent;
 * resets, skips, legacy entries and unmapped habits remain ordinary records.
 */
export async function persistHabitSourceRecord(
  rawHabit: Habit,
  completionDate: string | null,
  entryDate?: string
): Promise<PersistedHabitSource> {
  const parsedHabit = runtimeHabitSchema.parse(rawHabit) as Habit;
  const boundaryContext = capturePrimaryWriteBoundaryContext();
  const { accountBoundaryGeneration } = boundaryContext;
  let result: PersistedHabitSource;
  try {
    result = await runWithOriginExclusiveLock(HABIT_ENTRY_WRITE_LOCK, async () => {
      return runWithDataWriteBarrier(async () => {
        assertPrimaryWriteBoundaryContext(boundaryContext);
        let habit = parsedHabit;
        if (entryDate && isCanonicalDate(entryDate)) {
          const latest = await db.habits.get(parsedHabit.id);
          assertPrimaryWriteBoundaryContext(boundaryContext);
          if (latest) {
            const entries = { ...(latest.entries ?? {}) };
            const incomingEntry = parsedHabit.entries?.[entryDate];
            if (incomingEntry) entries[entryDate] = incomingEntry;
            else delete entries[entryDate];
            habit = runtimeHabitSchema.parse({
              ...latest,
              entries,
              updatedAt: advanceHabitUpdatedAt(latest, parsedHabit),
            }) as Habit;
          }
        }
        const preference = await readAutomationPreference();
        assertPrimaryWriteBoundaryContext(boundaryContext);
        const manualOutboxOwnerUserId = entryDate
          ? await validateSyncOwner(undefined, "Manual habit completion outbox")
          : null;
        assertPrimaryWriteBoundaryContext(boundaryContext);
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
          const syncOutboxPersisted = await persistHabitOnly(
            habit,
            boundaryContext,
            true,
            undefined,
            entryDate ? { date: entryDate, ownerUserId: manualOutboxOwnerUserId } : undefined
          );
          return { accountBoundaryGeneration, intentId: null, habit, syncOutboxPersisted };
        }

        let recoveryOwnerUserId: string | null = null;
        let recoveryRequestedAt: number | null = null;
        try {
          const ownerUserId = await validateSyncOwner(undefined, "Connected-record habit source");
          if (ownerUserId) {
            recoveryOwnerUserId = ownerUserId;
            recoveryRequestedAt = canonicalCompletionTimestamp(
              habit.entries[completionDate]?.loggedAt
            );
            const intent = await buildHabitSourceIntent(
              habit,
              completionDate,
              ownerUserId,
              preference.consentEpoch,
              accountBoundaryGeneration
            );
            const result = await persistPrimaryRecordWithAutomationIntent(
              habit,
              intent,
              ownerUserId,
              boundaryContext.sessionGeneration,
              undefined,
              { dataWriteLockHeld: true, ...(entryDate ? { manualHabitEntryDate: entryDate } : {}) }
            );
            assertPrimaryWriteBoundaryContext(boundaryContext);
            return {
              accountBoundaryGeneration,
              intentId: result.intentPersisted ? intent.id : null,
              ...(result.intentDeferred ? { intentDeferred: result.intentDeferred } : {}),
              habit,
              syncOutboxPersisted: result.syncOutboxPersisted,
            };
          }
        } catch {
          assertPrimaryWriteBoundaryContext(boundaryContext);
          logger.warn(
            "[Automation] Habit source intent unavailable; preserving the primary habit only"
          );
        }

        const syncOutboxPersisted = await persistHabitOnly(
          habit,
          boundaryContext,
          true,
          recoveryOwnerUserId && recoveryRequestedAt !== null
            ? { ownerUserId: recoveryOwnerUserId, requestedAt: recoveryRequestedAt }
            : undefined,
          entryDate ? { date: entryDate, ownerUserId: manualOutboxOwnerUserId } : undefined
        );
        if (recoveryOwnerUserId && recoveryRequestedAt !== null) {
          signalAutomationSourceReady();
        }
        return {
          accountBoundaryGeneration,
          intentId: null,
          ...(recoveryOwnerUserId && recoveryRequestedAt !== null
            ? { intentDeferred: "recovery" as const }
            : {}),
          habit,
          syncOutboxPersisted,
        };
      });
    });
  } catch (error) {
    if (!isDataWriteBarrierPostCommitError<PersistedHabitSource>(error)) throw error;
    assertOriginAccountBoundaryGeneration(error.capturedOriginGeneration);
    logger.warn(
      "[Automation] Habit commit completed with deferred mounted refresh:",
      error.issueKinds
    );
    result = error.committedValue;
  }
  if (result.syncOutboxPersisted) {
    try {
      await offlineQueue.wakeFromDurableStorage();
    } catch {
      logger.warn("[Automation] Durable habit completion queue wake deferred");
    }
  }
  return result;
}

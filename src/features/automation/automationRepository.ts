import {
  getJournalContentVaultKey,
  getJournalContentVaultRevision,
} from "@/features/journal/journalContentSession";
import { isEncryptedJournalContent } from "@/features/journal/journalCrypto";
import {
  journalStyleFieldsToCloud,
  normalizeJournalStyleFieldsFromCloud,
} from "@/features/journal/journalStyleFields";
import { MAX_JOURNAL_PHOTO_DESCRIPTION_LENGTH } from "@/features/journal/photoLayout";
import type { JournalEntry } from "@/features/journal/types";
import { doesNumericalStoredValueMeetTarget } from "@/lib/habits";
import {
  persistCriticalOfflineActionInCurrentTransaction,
} from "@/lib/offlineQueue";
import { runWithOriginExclusiveLock } from "@/lib/originExclusiveLock";
import { runtimeMoodEntrySchema } from "@/lib/schemas";
import type { FocusSession, Habit, MoodEntry } from "@/types";
import Dexie from "dexie";
import { db } from "@/storage/db";
import {
  ACCOUNT_BOUNDARY_DATA_WRITE_LOCK,
  captureOriginAccountBoundaryGeneration,
  isOriginAccountBoundaryGenerationCurrent,
} from "@/storage/accountBoundaryRuntime";
import {
  decodeHabitCompletionFromCloud,
  encodeHabitCompletionForCloud,
  getCloudHabitCompletionSemanticFieldsForSync,
} from "@/storage/sync/habitCompletionCodec";
import { validateSyncOwner } from "@/storage/sync/syncOwner";
import { commitAutomationTransaction } from "./automationCloud";
import { AUTOMATION_SERVER_OPERATION_LOCK } from "./automationOperationLock";
import { signalAutomationSourceReady } from "./automationRuntimeSignals";
import { hashAutomationValue } from "./canonicalJson";
import {
  decryptAutomationRevision,
  encryptAutomationRevision,
} from "./revisionCrypto";
import { requireAutomationRule } from "./ruleCatalog";
import { computeAutomationSourceKey } from "./sourceKey";
import type {
  AutomationTargetIdentity,
  AutomationTargetSnapshot,
} from "./plannerContracts";
import {
  AUTOMATION_PREFERENCE_SETTING_KEY,
  automationCommitQueueIntentSchema,
  automationCommitRequestSchema,
  automationHistoryMarkerSchema,
  automationPreferenceSchema,
  automationRecordRevisionStoreRowSchema,
  automationRevisionEnvelopeSchema,
  automationSourceIntentSchema,
  automationTransactionSchema,
  type AutomationCommitQueueIntent,
  type AutomationCommitResult,
  type AutomationJsonValue,
  type AutomationMutation,
  type AutomationRecordRevisionStoreRow,
  type AutomationRevisionEnvelope,
  type AutomationSourceIntent,
  type AutomationTransaction,
  type AutomationTransactionStoreRow,
} from "./types";

export type AutomationRepositoryErrorCode =
  | "AUTOMATION_COMMIT_INTENT_INVALID"
  | "AUTOMATION_COMMIT_OWNER_UNAVAILABLE"
  | "AUTOMATION_COMMIT_ROW_INVALID"
  | "AUTOMATION_COMMIT_VAULT_LOCKED"
  | "AUTOMATION_COMMIT_GATE_STALE"
  | "AUTOMATION_COMMIT_TRANSACTION_PURGED"
  | "AUTOMATION_COMMIT_BOUNDARY_CHANGED"
  | "AUTOMATION_COMMIT_TARGET_CONFLICT"
  | "AUTOMATION_COMMIT_CANONICAL_MISMATCH";

export class AutomationRepositoryError extends Error {
  readonly code: AutomationRepositoryErrorCode;

  constructor(code: AutomationRepositoryErrorCode) {
    super(code);
    this.name = "AutomationRepositoryError";
    this.code = code;
  }
}

export type QueuedAutomationCommitOutcome =
  | { status: "committed" }
  | {
      status: "obsolete";
      reason: "transaction-missing" | "transaction-terminal" | "server-rejected";
    };

export interface LocalAutomationCommitOptions {
  expectedOwnerUserId: string;
  accountBoundaryGeneration: string;
  vaultKey: string;
  vaultRevision: number;
  expectedPreferenceRevision: number;
  expectedHistoryGeneration: number;
  deviceId: string;
}

export function recordRevisionId(entityType: string, entityId: string): string {
  return `record_revision:${entityType}:${entityId}`;
}

function asObject(value: AutomationJsonValue | null): Record<string, AutomationJsonValue> {
  if (!value || Array.isArray(value) || typeof value !== "object") {
    throw new AutomationRepositoryError("AUTOMATION_COMMIT_ROW_INVALID");
  }
  return value;
}

function requiredString(
  value: AutomationJsonValue | undefined,
  maxLength = 100_000,
): string {
  if (typeof value !== "string" || value.length > maxLength) {
    throw new AutomationRepositoryError("AUTOMATION_COMMIT_ROW_INVALID");
  }
  return value;
}

function requiredNumber(value: AutomationJsonValue | undefined): number {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    throw new AutomationRepositoryError("AUTOMATION_COMMIT_ROW_INVALID");
  }
  return value;
}

function stringArray(value: AutomationJsonValue | undefined): string[] {
  if (!Array.isArray(value) || value.some((item) => typeof item !== "string")) {
    throw new AutomationRepositoryError("AUTOMATION_COMMIT_ROW_INVALID");
  }
  return value as string[];
}

function nullableString(value: AutomationJsonValue | undefined): string | undefined {
  if (value === null || value === undefined) return undefined;
  return requiredString(value);
}

function journalHabitSnapshot(
  value: AutomationJsonValue | undefined,
): JournalEntry["habitSnapshot"] {
  if (value === null || value === undefined) return undefined;
  if (!Array.isArray(value) || value.length > 1_000) {
    throw new AutomationRepositoryError("AUTOMATION_COMMIT_ROW_INVALID");
  }
  return value.map((candidate) => {
    const row = asObject(candidate);
    if (
      Object.keys(row).some(
        (key) => !["habitId", "habitName", "habitIcon", "completed"].includes(key),
      ) ||
      typeof row.completed !== "boolean"
    ) {
      throw new AutomationRepositoryError("AUTOMATION_COMMIT_ROW_INVALID");
    }
    return {
      habitId: requiredString(row.habitId, 512),
      habitName: requiredString(row.habitName, 10_000),
      habitIcon: requiredString(row.habitIcon, 512),
      completed: row.completed,
    };
  });
}

function journalPhotoLayout(
  value: AutomationJsonValue | undefined,
  photoIds: readonly string[],
): JournalEntry["photoLayout"] {
  if (value === null || value === undefined) return undefined;
  const rows = asObject(value);
  const linkedPhotoIds = new Set(photoIds);
  const layout: NonNullable<JournalEntry["photoLayout"]> = {};
  for (const [photoId, candidate] of Object.entries(rows)) {
    if (!linkedPhotoIds.has(photoId)) {
      throw new AutomationRepositoryError("AUTOMATION_COMMIT_ROW_INVALID");
    }
    const row = asObject(candidate);
    if (
      Object.keys(row).some(
        (key) => !["x", "y", "width", "description", "inGallery"].includes(key),
      ) ||
      typeof row.x !== "number" ||
      !Number.isFinite(row.x) ||
      typeof row.y !== "number" ||
      !Number.isFinite(row.y) ||
      typeof row.width !== "number" ||
      !Number.isFinite(row.width) ||
      (row.description !== undefined &&
        row.description !== null &&
        (typeof row.description !== "string" ||
          Array.from(row.description).length > MAX_JOURNAL_PHOTO_DESCRIPTION_LENGTH)) ||
      (row.inGallery !== undefined &&
        row.inGallery !== null &&
        typeof row.inGallery !== "boolean")
    ) {
      throw new AutomationRepositoryError("AUTOMATION_COMMIT_ROW_INVALID");
    }
    layout[photoId] = {
      x: row.x,
      y: row.y,
      width: row.width,
      ...(typeof row.description === "string" ? { description: row.description } : {}),
      ...(row.inGallery === true ? { inGallery: true } : {}),
    };
  }
  return layout;
}

function journalProjectionToLocal(value: AutomationJsonValue): JournalEntry {
  const row = asObject(value);
  const content = requiredString(row.content);
  if (content && !isEncryptedJournalContent(content)) {
    throw new AutomationRepositoryError("AUTOMATION_COMMIT_ROW_INVALID");
  }
  const photoIds = stringArray(row.photo_ids);
  const local: JournalEntry = {
    id: requiredString(row.id, 512),
    date: requiredString(row.date, 10),
    title: requiredString(row.title, 10_000),
    content,
    stickers: stringArray(row.stickers),
    photoIds,
    tags: stringArray(row.tags),
    createdAt: requiredNumber(row.created_at),
    updatedAt: requiredNumber(row.updated_at),
    ...normalizeJournalStyleFieldsFromCloud(row),
  };
  const audioIds = row.audio_ids === null ? undefined : stringArray(row.audio_ids);
  if (audioIds !== undefined) local.audioIds = audioIds;
  const mood = nullableString(row.mood);
  if (mood !== undefined) {
    if (!(["great", "good", "okay", "bad", "terrible"] as const).includes(mood as never)) {
      throw new AutomationRepositoryError("AUTOMATION_COMMIT_ROW_INVALID");
    }
    local.mood = mood as JournalEntry["mood"];
  }
  const templateId = nullableString(row.template_id);
  if (templateId !== undefined) local.templateId = templateId;
  const habitSnapshot = journalHabitSnapshot(row.habit_snapshot);
  if (habitSnapshot !== undefined) local.habitSnapshot = habitSnapshot;
  const photoLayout = journalPhotoLayout(row.photo_layout, photoIds);
  if (photoLayout !== undefined) local.photoLayout = photoLayout;
  return local;
}

function journalLocalToProjection(entry: JournalEntry): AutomationJsonValue {
  return {
    id: entry.id,
    date: entry.date,
    title: entry.title,
    content: entry.content,
    stickers: entry.stickers,
    mood: entry.mood ?? null,
    tags: entry.tags,
    template_id: entry.templateId ?? null,
    habit_snapshot: entry.habitSnapshot ?? null,
    photo_ids: entry.photoIds,
    audio_ids: entry.audioIds ?? [],
    created_at: entry.createdAt,
    updated_at: entry.updatedAt,
    ...journalStyleFieldsToCloud(entry),
    photo_layout: (entry.photoLayout as AutomationJsonValue | undefined) ?? null,
  };
}

function moodProjectionToLocal(value: AutomationJsonValue): MoodEntry {
  const row = asObject(value);
  const candidate: Record<string, unknown> = {
    id: requiredString(row.id, 512),
    mood: requiredString(row.mood, 32),
    date: requiredString(row.date, 10),
    timestamp: requiredNumber(row.timestamp),
  };
  const note = nullableString(row.note);
  if (note !== undefined) candidate.note = note;
  if (Array.isArray(row.tags)) candidate.tags = stringArray(row.tags);
  if (typeof row.updated_at === "number") candidate.updatedAt = row.updated_at;
  if (typeof row.valence === "number") candidate.valence = row.valence;
  const logType = nullableString(row.log_type);
  if (logType !== undefined) candidate.logType = logType;
  if (Array.isArray(row.emotion_tags)) candidate.emotionTags = stringArray(row.emotion_tags);
  if (Array.isArray(row.contexts)) candidate.contexts = stringArray(row.contexts);
  if (row.emotion !== undefined && row.emotion !== null) candidate.emotion = row.emotion;
  const parsed = runtimeMoodEntrySchema.safeParse(candidate);
  if (!parsed.success) {
    throw new AutomationRepositoryError("AUTOMATION_COMMIT_ROW_INVALID");
  }
  return parsed.data as MoodEntry;
}

function moodLocalToProjection(mood: MoodEntry): AutomationJsonValue {
  return {
    id: mood.id,
    mood: mood.mood,
    note: mood.note ?? null,
    tags: mood.tags ?? null,
    date: mood.date,
    timestamp: mood.timestamp,
    updated_at: mood.updatedAt ?? null,
    valence: mood.valence ?? null,
    log_type: mood.logType ?? null,
    emotion_tags: mood.emotionTags ?? null,
    contexts: mood.contexts ?? null,
    emotion: (mood.emotion as AutomationJsonValue | undefined) ?? null,
  };
}

function habitCompletionParts(entityId: string): { habitId: string; date: string } {
  const separator = entityId.lastIndexOf(":");
  if (separator <= 0 || separator === entityId.length - 1) {
    throw new AutomationRepositoryError("AUTOMATION_COMMIT_ROW_INVALID");
  }
  return { habitId: entityId.slice(0, separator), date: entityId.slice(separator + 1) };
}

function habitCompletionLocalToProjection(
  habit: Habit,
  entityId: string,
): AutomationJsonValue | null {
  const { habitId, date } = habitCompletionParts(entityId);
  const entry = habit.entries[date];
  if (!entry) return null;
  const afterValue = entry.value;
  const { count, duration } = encodeHabitCompletionForCloud({
    habitType: habit.habitType,
    entryValue: afterValue,
  });
  return {
    habit_id: habitId,
    date,
    count,
    duration,
    ...getCloudHabitCompletionSemanticFieldsForSync({
      habitType: habit.habitType,
      targetType: habit.targetType,
      entryValue: afterValue,
      isComplete:
        habit.habitType === "numerical"
          ? doesNumericalStoredValueMeetTarget(habit, afterValue)
          : true,
    }),
  };
}

export async function readLocalProjection(
  mutation: Pick<AutomationMutation, "entityType" | "entityId">,
): Promise<AutomationJsonValue | null> {
  switch (mutation.entityType) {
    case "journal": {
      const entry = await db.journalEntries.get(mutation.entityId);
      return entry ? journalLocalToProjection(entry) : null;
    }
    case "mood": {
      const mood = await db.moods.get(mutation.entityId);
      return mood ? moodLocalToProjection(mood) : null;
    }
    case "habit_completion": {
      const { habitId } = habitCompletionParts(mutation.entityId);
      const habit = await db.habits.get(habitId);
      return habit ? habitCompletionLocalToProjection(habit, mutation.entityId) : null;
    }
    case "setting": {
      const setting = await db.settings.get(mutation.entityId);
      return setting?.value === undefined ? null : (setting.value as AutomationJsonValue);
    }
    default:
      throw new AutomationRepositoryError("AUTOMATION_COMMIT_ROW_INVALID");
  }
}

export async function readAutomationTargetSnapshot(
  identity: AutomationTargetIdentity,
  expectedOwnerUserId: string,
): Promise<AutomationTargetSnapshot> {
  await requireOwner(expectedOwnerUserId);
  const snapshot = await db.transaction(
    "r",
    [
      db.moods,
      db.habits,
      db.settings,
      db.journalEntries,
      db.automationTransactions,
    ],
    async () => {
      const value = await readLocalProjection(identity);
      const revision = parseStoredRevision(
        await db.automationTransactions.get(
          recordRevisionId(identity.entityType, identity.entityId),
        ),
      );
      if (revision && revision.ownerUserId !== expectedOwnerUserId) {
        throw new AutomationRepositoryError("AUTOMATION_COMMIT_TARGET_CONFLICT");
      }
      if (value === null) {
        if (revision !== null) {
          throw new AutomationRepositoryError("AUTOMATION_COMMIT_TARGET_CONFLICT");
        }
        return {
          ...identity,
          value: null,
          revisionToken: null,
          automationOwned: false,
        } as const;
      }

      const currentHash = await Dexie.waitFor(hashAutomationValue(value));
      if (
        !revision ||
        !revision.recordExists ||
        revision.revisionToken === null ||
        revision.stateHash !== currentHash
      ) {
        throw new AutomationRepositoryError("AUTOMATION_COMMIT_TARGET_CONFLICT");
      }
      return {
        ...identity,
        value,
        revisionToken: revision.revisionToken,
        automationOwned: revision.transactionId !== null,
      } as const;
    },
  );
  await requireOwner(expectedOwnerUserId);
  return snapshot;
}

export async function applyLocalMutation(mutation: AutomationMutation): Promise<void> {
  if (mutation.entityType === "journal") {
    if (mutation.operation === "delete") await db.journalEntries.delete(mutation.entityId);
    else {
      const entry = journalProjectionToLocal(mutation.after);
      if (entry.id !== mutation.entityId) {
        throw new AutomationRepositoryError("AUTOMATION_COMMIT_ROW_INVALID");
      }
      await db.journalEntries.put(entry);
    }
    return;
  }
  if (mutation.entityType === "mood") {
    if (mutation.operation === "delete") await db.moods.delete(mutation.entityId);
    else {
      const mood = moodProjectionToLocal(mutation.after);
      if (mood.id !== mutation.entityId) {
        throw new AutomationRepositoryError("AUTOMATION_COMMIT_ROW_INVALID");
      }
      await db.moods.put(mood);
    }
    return;
  }
  if (mutation.entityType === "setting") {
    if (mutation.entityId !== "zenflow-schedule-events") {
      throw new AutomationRepositoryError("AUTOMATION_COMMIT_ROW_INVALID");
    }
    if (mutation.operation === "delete") await db.settings.delete(mutation.entityId);
    else if (!Array.isArray(mutation.after)) {
      throw new AutomationRepositoryError("AUTOMATION_COMMIT_ROW_INVALID");
    } else await db.settings.put({ key: mutation.entityId, value: mutation.after });
    return;
  }
  if (mutation.entityType === "habit_completion") {
    const { habitId, date } = habitCompletionParts(mutation.entityId);
    const habit = await db.habits.get(habitId);
    if (!habit) throw new AutomationRepositoryError("AUTOMATION_COMMIT_TARGET_CONFLICT");
    const entries = { ...habit.entries };
    if (mutation.operation === "delete") {
      delete entries[date];
    } else {
      const row = asObject(mutation.after);
      if (row.habit_id !== habitId || row.date !== date) {
        throw new AutomationRepositoryError("AUTOMATION_COMMIT_ROW_INVALID");
      }
      entries[date] = {
        value: decodeHabitCompletionFromCloud({
          habitType: habit.habitType,
          count: typeof row.count === "number" ? row.count : null,
          duration: typeof row.duration === "number" ? row.duration : null,
          entryValue: typeof row.entry_value === "number" ? row.entry_value : null,
        }),
      };
    }
    await db.habits.put({ ...habit, entries });
    return;
  }
  throw new AutomationRepositoryError("AUTOMATION_COMMIT_ROW_INVALID");
}

export function parseStoredTransaction(value: unknown): AutomationTransactionStoreRow {
  if (!value || typeof value !== "object" || (value as { kind?: unknown }).kind !== "transaction") {
    throw new AutomationRepositoryError("AUTOMATION_COMMIT_ROW_INVALID");
  }
  const { kind: _kind, ...candidate } = value as AutomationTransactionStoreRow;
  const parsed = automationTransactionSchema.safeParse(candidate);
  if (!parsed.success) {
    throw new AutomationRepositoryError("AUTOMATION_COMMIT_ROW_INVALID");
  }
  return { kind: "transaction", ...parsed.data };
}

function isTerminalWithoutCommit(transaction: AutomationTransaction): boolean {
  return ["sync_blocked", "commit_conflict", "revoked", "undone", "conflict"].includes(
    transaction.status,
  );
}

async function requireOwner(expectedOwnerUserId: string): Promise<void> {
  const ownerUserId = await validateSyncOwner(
    expectedOwnerUserId,
    "Queued automation commit",
  );
  if (!ownerUserId || ownerUserId !== expectedOwnerUserId) {
    throw new AutomationRepositoryError("AUTOMATION_COMMIT_OWNER_UNAVAILABLE");
  }
}

function assertBoundaryAndVault(options: LocalAutomationCommitOptions): void {
  if (!isOriginAccountBoundaryGenerationCurrent(options.accountBoundaryGeneration)) {
    throw new AutomationRepositoryError("AUTOMATION_COMMIT_BOUNDARY_CHANGED");
  }
  if (
    !options.vaultKey ||
    getJournalContentVaultKey() !== options.vaultKey ||
    getJournalContentVaultRevision() !== options.vaultRevision
  ) {
    throw new AutomationRepositoryError("AUTOMATION_COMMIT_VAULT_LOCKED");
  }
}

export function parseStoredRevision(value: unknown): AutomationRecordRevisionStoreRow | null {
  if (value === undefined) return null;
  const parsed = automationRecordRevisionStoreRowSchema.safeParse(value);
  if (!parsed.success) {
    throw new AutomationRepositoryError("AUTOMATION_COMMIT_ROW_INVALID");
  }
  return parsed.data;
}

export async function compensateUnacceptedAutomationTransactionInCurrentTransaction(
  transaction: AutomationTransactionStoreRow,
  revision: AutomationRevisionEnvelope,
  expectedOwnerUserId: string,
  updatedAt: number,
): Promise<{ compensatedTargets: number; preservedTargets: number }> {
  if (
    !Dexie.currentTransaction ||
    transaction.status !== "commit_pending" ||
    transaction.ownerUserId !== expectedOwnerUserId ||
    revision.ownerUserId !== expectedOwnerUserId ||
    revision.transactionId !== transaction.id
  ) {
    throw new AutomationRepositoryError("AUTOMATION_COMMIT_ROW_INVALID");
  }

  const plannedCompensations: Array<{
    mutation: AutomationMutation;
    currentRevision: AutomationRecordRevisionStoreRow;
  }> = [];
  let preservedTargets = 0;
  for (const mutation of revision.mutations) {
    const currentRevision = parseStoredRevision(
      await db.automationTransactions.get(
        recordRevisionId(mutation.entityType, mutation.entityId),
      ),
    );
    const currentProjection = await readLocalProjection(mutation);
    const currentHash = await Dexie.waitFor(hashAutomationValue(currentProjection));
    const targetStillOwned =
      currentRevision !== null &&
      currentRevision.ownerUserId === expectedOwnerUserId &&
      currentRevision.entityType === mutation.entityType &&
      currentRevision.entityId === mutation.entityId &&
      currentRevision.recordExists === (mutation.after !== null) &&
      currentRevision.revisionToken === mutation.afterRevisionToken &&
      currentRevision.stateHash === mutation.afterHash &&
      currentRevision.transactionId === transaction.id &&
      currentHash === mutation.afterHash;
    if (targetStillOwned && currentRevision !== null) {
      plannedCompensations.push({ mutation, currentRevision });
      continue;
    }
    if (currentRevision?.transactionId === transaction.id) {
      throw new AutomationRepositoryError("AUTOMATION_COMMIT_TARGET_CONFLICT");
    }
    preservedTargets += 1;
  }

  for (const { mutation, currentRevision } of plannedCompensations) {
    const compensation: AutomationMutation = {
      entityType: mutation.entityType,
      entityId: mutation.entityId,
      operation: mutation.before === null ? "delete" : "upsert",
      before: mutation.after,
      after: mutation.before,
      beforeHash: mutation.afterHash,
      afterHash: mutation.beforeHash,
      beforeRevisionToken: mutation.afterRevisionToken,
      afterRevisionToken: mutation.beforeRevisionToken,
    };
    await applyLocalMutation(compensation);
    await db.automationTransactions.put(
      automationRecordRevisionStoreRowSchema.parse({
        kind: "record_revision",
        id: recordRevisionId(mutation.entityType, mutation.entityId),
        schemaVersion: 1,
        ownerUserId: expectedOwnerUserId,
        entityType: mutation.entityType,
        entityId: mutation.entityId,
        recordExists: mutation.before !== null,
        revisionToken: mutation.beforeRevisionToken,
        stateHash: mutation.beforeHash,
        mutationGeneration: currentRevision.mutationGeneration + 1,
        transactionId: null,
        updatedAt,
      }),
    );
    const compensatedProjection = await readLocalProjection(mutation);
    const compensatedHash = await Dexie.waitFor(
      hashAutomationValue(compensatedProjection),
    );
    if (compensatedHash !== mutation.beforeHash) {
      throw new AutomationRepositoryError("AUTOMATION_COMMIT_ROW_INVALID");
    }
  }

  return {
    compensatedTargets: plannedCompensations.length,
    preservedTargets,
  };
}

type AutomationPrimaryRecord = MoodEntry | JournalEntry | FocusSession | Habit;

function createLocalRevisionToken(): string {
  if (typeof globalThis.crypto?.randomUUID !== "function") {
    throw new AutomationRepositoryError("AUTOMATION_COMMIT_ROW_INVALID");
  }
  return globalThis.crypto.randomUUID();
}

async function putPrimaryRecord(
  record: AutomationPrimaryRecord,
  intent: AutomationSourceIntent,
): Promise<void> {
  if (record.id !== intent.source.id) {
    throw new AutomationRepositoryError("AUTOMATION_COMMIT_ROW_INVALID");
  }
  switch (intent.source.type) {
    case "mood":
      await db.moods.put(record as MoodEntry);
      return;
    case "journal":
      await db.journalEntries.put(record as JournalEntry);
      return;
    case "focus":
      await db.focusSessions.put(record as FocusSession);
      return;
    case "habit":
      await db.habits.put(record as Habit);
  }
}

function primaryTargetProjection(
  record: AutomationPrimaryRecord,
  intent: AutomationSourceIntent,
): { entityType: "mood" | "journal"; projection: AutomationJsonValue } | null {
  if (intent.source.type === "mood") {
    return { entityType: "mood", projection: moodLocalToProjection(record as MoodEntry) };
  }
  if (intent.source.type === "journal") {
    return {
      entityType: "journal",
      projection: journalLocalToProjection(record as JournalEntry),
    };
  }
  return null;
}

export async function persistAutomationSourceIntentInCurrentTransaction(
  record: AutomationPrimaryRecord,
  rawIntent: AutomationSourceIntent,
  expectedOwnerUserId: string,
): Promise<{ intentPersisted: boolean }> {
  if (!Dexie.currentTransaction || Dexie.currentTransaction.mode !== "readwrite") {
    throw new AutomationRepositoryError("AUTOMATION_COMMIT_ROW_INVALID");
  }
  const intent = automationSourceIntentSchema.parse(rawIntent);
  if (
    record.id !== intent.source.id ||
    intent.ownerUserId !== expectedOwnerUserId ||
    intent.id !== `source_pending:${intent.sourceKey}` ||
    intent.accountBoundaryGeneration.length === 0 ||
    !isOriginAccountBoundaryGenerationCurrent(intent.accountBoundaryGeneration)
  ) {
    throw new AutomationRepositoryError("AUTOMATION_COMMIT_GATE_STALE");
  }
  const sourceRuleId = intent.candidateRuleIds[0];
  const expectedSourceKey = await Dexie.waitFor(
    computeAutomationSourceKey({
      ownerUserId: intent.ownerUserId,
      consentEpoch: intent.consentEpoch,
      ruleId: sourceRuleId,
      ruleVersion: 1,
      sourceType: intent.source.type,
      sourceId: intent.source.id,
      sourceRevision: intent.source.revision,
    }),
  );
  if (expectedSourceKey !== intent.sourceKey) {
    throw new AutomationRepositoryError("AUTOMATION_COMMIT_GATE_STALE");
  }

  const target = primaryTargetProjection(record, intent);
  if (target) {
    const revisionId = recordRevisionId(target.entityType, record.id);
    const currentRevision = parseStoredRevision(
      await db.automationTransactions.get(revisionId),
    );
    const stateHash = await Dexie.waitFor(hashAutomationValue(target.projection));
    await db.automationTransactions.put(
      automationRecordRevisionStoreRowSchema.parse({
        kind: "record_revision",
        id: revisionId,
        schemaVersion: 1,
        ownerUserId: intent.ownerUserId,
        entityType: target.entityType,
        entityId: record.id,
        recordExists: true,
        revisionToken: createLocalRevisionToken(),
        stateHash,
        mutationGeneration: (currentRevision?.mutationGeneration ?? 0) + 1,
        transactionId: null,
        updatedAt: intent.source.committedAt,
      }),
    );
  }

  const preference = automationPreferenceSchema.safeParse(
    (await db.settings.get(AUTOMATION_PREFERENCE_SETTING_KEY))?.value,
  );
  const intentStillAuthorized =
    preference.success &&
    preference.data.enabled &&
    preference.data.consentEpoch === intent.consentEpoch &&
    intent.candidateRuleIds.every((ruleId) =>
      preference.data.enabledRuleIds.includes(ruleId),
    );
  if (intentStillAuthorized) {
    await db.automationTransactions.put(intent);
  } else {
    await db.automationTransactions.delete(intent.id);
  }
  if (!isOriginAccountBoundaryGenerationCurrent(intent.accountBoundaryGeneration)) {
    throw new AutomationRepositoryError("AUTOMATION_COMMIT_BOUNDARY_CHANGED");
  }
  return { intentPersisted: intentStillAuthorized };
}

export async function persistPrimaryRecordWithAutomationIntent(
  record: AutomationPrimaryRecord,
  rawIntent: AutomationSourceIntent,
  expectedOwnerUserId: string,
): Promise<{ intentPersisted: boolean }> {
  const intent = automationSourceIntentSchema.parse(rawIntent);
  if (
    intent.ownerUserId !== expectedOwnerUserId ||
    intent.id !== `source_pending:${intent.sourceKey}` ||
    intent.accountBoundaryGeneration.length === 0
  ) {
    throw new AutomationRepositoryError("AUTOMATION_COMMIT_GATE_STALE");
  }
  await requireOwner(expectedOwnerUserId);
  if (!isOriginAccountBoundaryGenerationCurrent(intent.accountBoundaryGeneration)) {
    throw new AutomationRepositoryError("AUTOMATION_COMMIT_BOUNDARY_CHANGED");
  }

  const result = await runWithOriginExclusiveLock(
    ACCOUNT_BOUNDARY_DATA_WRITE_LOCK,
    async () => {
      await requireOwner(expectedOwnerUserId);
      if (!isOriginAccountBoundaryGenerationCurrent(intent.accountBoundaryGeneration)) {
        throw new AutomationRepositoryError("AUTOMATION_COMMIT_BOUNDARY_CHANGED");
      }
      return db.transaction(
        "rw",
        [
          db.moods,
          db.habits,
          db.focusSessions,
          db.journalEntries,
          db.settings,
          db.automationTransactions,
        ],
        async () => {
          await putPrimaryRecord(record, intent);
          return persistAutomationSourceIntentInCurrentTransaction(
            record,
            intent,
            expectedOwnerUserId,
          );
        },
      );
    },
  );
  await requireOwner(expectedOwnerUserId);
  if (result.intentPersisted) signalAutomationSourceReady();
  return result;
}

export async function commitLocalAutomationTransaction(
  rawRevision: AutomationRevisionEnvelope,
  options: LocalAutomationCommitOptions,
): Promise<AutomationTransactionStoreRow> {
  const revision = automationRevisionEnvelopeSchema.parse(rawRevision);
  const queueIntent = automationCommitQueueIntentSchema.parse({
    schemaVersion: 1,
    transactionId: revision.transactionId,
    expectedPreferenceRevision: options.expectedPreferenceRevision,
    expectedHistoryGeneration: options.expectedHistoryGeneration,
    deviceId: options.deviceId,
  });
  if (
    revision.ownerUserId !== options.expectedOwnerUserId ||
    revision.source.type === "mood" && revision.ruleId !== "mood.note-to-journal.v1"
  ) {
    throw new AutomationRepositoryError("AUTOMATION_COMMIT_GATE_STALE");
  }
  const expectedSourceKey = await computeAutomationSourceKey({
    ownerUserId: revision.ownerUserId,
    consentEpoch: revision.consentEpoch,
    ruleId: revision.ruleId,
    ruleVersion: revision.ruleVersion,
    sourceType: revision.source.type,
    sourceId: revision.source.id,
    sourceRevision: revision.source.revision,
  });
  if (revision.sourceKey !== expectedSourceKey) {
    throw new AutomationRepositoryError("AUTOMATION_COMMIT_GATE_STALE");
  }
  const rule = requireAutomationRule(revision.ruleId);
  if (
    revision.mutations.length > rule.maxMutations ||
    revision.mutations.some(
      (mutation) => !rule.targetEntityTypes.some((target) => target === mutation.entityType),
    )
  ) {
    throw new AutomationRepositoryError("AUTOMATION_COMMIT_ROW_INVALID");
  }
  await Promise.all(
    revision.mutations.map(async (mutation) => {
      const [beforeHash, afterHash] = await Promise.all([
        hashAutomationValue(mutation.before),
        hashAutomationValue(mutation.after),
      ]);
      if (beforeHash !== mutation.beforeHash || afterHash !== mutation.afterHash) {
        throw new AutomationRepositoryError("AUTOMATION_COMMIT_ROW_INVALID");
      }
    }),
  );

  await requireOwner(options.expectedOwnerUserId);
  assertBoundaryAndVault(options);
  const revisionCiphertext = await encryptAutomationRevision(revision, options.vaultKey);
  assertBoundaryAndVault(options);

  const stored = await runWithOriginExclusiveLock(
    ACCOUNT_BOUNDARY_DATA_WRITE_LOCK,
    async () => {
      await requireOwner(options.expectedOwnerUserId);
      assertBoundaryAndVault(options);
      return db.transaction(
        "rw",
        [
          db.moods,
          db.habits,
          db.settings,
          db.journalEntries,
          db.offlineQueue,
          db.automationTransactions,
          db.automationHistoryMarkers,
        ],
        async () => {
          const marker = automationHistoryMarkerSchema.safeParse(
            await db.automationHistoryMarkers.get(revision.ownerUserId),
          );
          if (
            marker.success &&
            marker.data.purgedTransactionIds?.includes(revision.transactionId)
          ) {
            throw new AutomationRepositoryError("AUTOMATION_COMMIT_TRANSACTION_PURGED");
          }
          const existingRows = await db.automationTransactions
            .where("[ownerUserId+sourceKey]")
            .equals([revision.ownerUserId, revision.sourceKey])
            .toArray();
          const existing = existingRows.find((row) => row.kind === "transaction");
          if (existing) return parseStoredTransaction(existing);

          const preferenceRow = await db.settings.get(AUTOMATION_PREFERENCE_SETTING_KEY);
          const preference = automationPreferenceSchema.safeParse(preferenceRow?.value);
          if (
            !preference.success ||
            !preference.data.enabled ||
            preference.data.consentEpoch !== revision.consentEpoch ||
            preference.data.serverRevision !== options.expectedPreferenceRevision ||
            !preference.data.enabledRuleIds.includes(revision.ruleId) ||
            !marker.success ||
            marker.data.historyGeneration !== options.expectedHistoryGeneration
          ) {
            throw new AutomationRepositoryError("AUTOMATION_COMMIT_GATE_STALE");
          }

          const plannedTargets = [] as Array<{
            mutation: AutomationMutation;
            currentRevision: AutomationRecordRevisionStoreRow | null;
          }>;
          for (const mutation of revision.mutations) {
            const currentRevision = parseStoredRevision(
              await db.automationTransactions.get(
                recordRevisionId(mutation.entityType, mutation.entityId),
              ),
            );
            if (currentRevision && currentRevision.ownerUserId !== revision.ownerUserId) {
              throw new AutomationRepositoryError("AUTOMATION_COMMIT_TARGET_CONFLICT");
            }
            const currentProjection = await readLocalProjection(mutation);
            const currentHash = await Dexie.waitFor(hashAutomationValue(currentProjection));
            if (mutation.before === null) {
              // Never-created absence is the only token-free create state.
              // A retained delete revision is rejected conservatively to avoid
              // absent -> create -> delete -> stale-create ABA.
              if (currentProjection !== null || currentRevision !== null) {
                throw new AutomationRepositoryError("AUTOMATION_COMMIT_TARGET_CONFLICT");
              }
            } else if (
              currentProjection === null ||
              !currentRevision ||
              !currentRevision.recordExists ||
              currentRevision.revisionToken !== mutation.beforeRevisionToken ||
              currentRevision.stateHash !== mutation.beforeHash ||
              currentHash !== mutation.beforeHash
            ) {
              throw new AutomationRepositoryError("AUTOMATION_COMMIT_TARGET_CONFLICT");
            }
            plannedTargets.push({ mutation, currentRevision });
          }

          for (const { mutation, currentRevision } of plannedTargets) {
            await applyLocalMutation(mutation);
            const nextRevision = automationRecordRevisionStoreRowSchema.parse({
              kind: "record_revision",
              id: recordRevisionId(mutation.entityType, mutation.entityId),
              schemaVersion: 1,
              ownerUserId: revision.ownerUserId,
              entityType: mutation.entityType,
              entityId: mutation.entityId,
              recordExists: mutation.operation === "upsert",
              revisionToken: mutation.afterRevisionToken,
              stateHash: mutation.afterHash,
              mutationGeneration: (currentRevision?.mutationGeneration ?? 0) + 1,
              transactionId: revision.transactionId,
              updatedAt: revision.plannedAt,
            });
            await db.automationTransactions.put(nextRevision);
            const appliedProjection = await readLocalProjection(mutation);
            const appliedHash = await Dexie.waitFor(hashAutomationValue(appliedProjection));
            if (appliedHash !== mutation.afterHash) {
              throw new AutomationRepositoryError("AUTOMATION_COMMIT_ROW_INVALID");
            }
          }

          const transaction = automationTransactionSchema.parse({
            id: revision.transactionId,
            ownerUserId: revision.ownerUserId,
            consentEpoch: revision.consentEpoch,
            sourceKey: revision.sourceKey,
            ruleId: revision.ruleId,
            ruleVersion: revision.ruleVersion,
            sourceType: revision.source.type,
            sourceId: revision.source.id,
            status: "commit_pending",
            revisionCiphertext,
            createdAt: revision.plannedAt,
            updatedAt: revision.plannedAt,
            schemaVersion: 1,
          });
          const transactionRow: AutomationTransactionStoreRow = {
            kind: "transaction",
            ...transaction,
          };
          await db.automationTransactions.add(transactionRow);
          await persistCriticalOfflineActionInCurrentTransaction(
            "COMMIT_AUTOMATION_TRANSACTION",
            revision.transactionId,
            queueIntent,
            revision.ownerUserId,
            {
              id: `automation-commit:${revision.transactionId}`,
              operationId: revision.transactionId,
            },
          );
          assertBoundaryAndVault(options);
          return transactionRow;
        },
      );
    },
  );
  await requireOwner(options.expectedOwnerUserId);
  assertBoundaryAndVault(options);
  return stored;
}

async function markAccepted(
  localTransactionId: string,
  expectedOwnerUserId: string,
  result: Extract<AutomationCommitResult, { code: "COMMITTED" | "ALREADY_COMMITTED" }>,
): Promise<QueuedAutomationCommitOutcome> {
  if (result.transactionId !== localTransactionId) {
    throw new AutomationRepositoryError("AUTOMATION_COMMIT_CANONICAL_MISMATCH");
  }

  await requireOwner(expectedOwnerUserId);
  const outcome = await db.transaction(
    "rw",
    [db.automationTransactions, db.automationHistoryMarkers],
    async () => {
    const currentValue = await db.automationTransactions.get(localTransactionId);
    if (currentValue === undefined) {
      return { status: "obsolete", reason: "transaction-missing" } as const;
    }
    const current = parseStoredTransaction(currentValue);
    if (current.ownerUserId !== expectedOwnerUserId) {
      throw new AutomationRepositoryError("AUTOMATION_COMMIT_OWNER_UNAVAILABLE");
    }
    const markerValue = await db.automationHistoryMarkers.get(expectedOwnerUserId);
    const marker = markerValue ? automationHistoryMarkerSchema.parse(markerValue) : null;
    const staleGeneration =
      marker !== null && marker.historyGeneration > result.historyGeneration;
    const transactionPurged = marker?.purgedTransactionIds?.includes(localTransactionId) ?? false;
    if (staleGeneration || transactionPurged) {
      const ownerRows = await db.automationTransactions
        .where("ownerUserId")
        .equals(expectedOwnerUserId)
        .toArray();
      const ownedRevisionRows = ownerRows
        .filter((row) => row.kind === "record_revision")
        .map((row) => parseStoredRevision(row))
        .filter(
          (row): row is AutomationRecordRevisionStoreRow =>
            row !== null && row.transactionId === localTransactionId,
        )
        .map((row) => ({
          ...row,
          transactionId: null,
          updatedAt: Math.max(row.updatedAt, result.completedAt),
        }));
      if (ownedRevisionRows.length > 0) {
        await db.automationTransactions.bulkPut(ownedRevisionRows);
      }
      await db.automationTransactions.delete(localTransactionId);
      return { status: "obsolete", reason: "transaction-terminal" } as const;
    }
    const { kind: _kind, ...currentTransaction } = current;
    const accepted = automationTransactionSchema.parse({
      ...currentTransaction,
      status: "committed",
      serverSequence: result.serverSequence,
      historyGeneration: result.historyGeneration,
      updatedAt: Math.max(current.updatedAt, result.completedAt),
    });
    await db.automationTransactions.put({ kind: "transaction", ...accepted });
    return { status: "committed" } as const;
  });
  await requireOwner(expectedOwnerUserId);
  return outcome;
}

function assertQueuedCommitContext(
  accountBoundaryGeneration: string,
  vaultKey: string,
  vaultRevision: number,
): void {
  if (!isOriginAccountBoundaryGenerationCurrent(accountBoundaryGeneration)) {
    throw new AutomationRepositoryError("AUTOMATION_COMMIT_BOUNDARY_CHANGED");
  }
  if (
    getJournalContentVaultKey() !== vaultKey ||
    getJournalContentVaultRevision() !== vaultRevision
  ) {
    throw new AutomationRepositoryError("AUTOMATION_COMMIT_VAULT_LOCKED");
  }
}

function rejectedCommitStatus(
  code: Exclude<AutomationCommitResult["code"], "COMMITTED" | "ALREADY_COMMITTED">,
): "revoked" | "sync_blocked" | "commit_conflict" {
  if (code === "STALE_CONSENT_EPOCH" || code === "HISTORY_GENERATION_STALE") {
    return "revoked";
  }
  if (code === "TRANSACTION_PURGED") return "revoked";
  if (code === "HISTORY_LIMIT_REACHED") return "sync_blocked";
  return "commit_conflict";
}

async function reconcileRejectedCommit(
  transaction: AutomationTransactionStoreRow,
  revision: AutomationRevisionEnvelope,
  result: Exclude<AutomationCommitResult, { code: "COMMITTED" | "ALREADY_COMMITTED" }>,
  expectedOwnerUserId: string,
  accountBoundaryGeneration: string,
  vaultKey: string,
  vaultRevision: number,
): Promise<QueuedAutomationCommitOutcome> {
  if (result.transactionId !== transaction.id) {
    throw new AutomationRepositoryError("AUTOMATION_COMMIT_CANONICAL_MISMATCH");
  }

  await requireOwner(expectedOwnerUserId);
  assertQueuedCommitContext(
    accountBoundaryGeneration,
    vaultKey,
    vaultRevision,
  );
  const outcome = await runWithOriginExclusiveLock(
    ACCOUNT_BOUNDARY_DATA_WRITE_LOCK,
    async () => {
      await requireOwner(expectedOwnerUserId);
      assertQueuedCommitContext(
        accountBoundaryGeneration,
        vaultKey,
        vaultRevision,
      );
      return db.transaction(
        "rw",
        [
          db.moods,
          db.habits,
          db.settings,
          db.journalEntries,
          db.automationTransactions,
        ],
        async () => {
          const currentValue = await db.automationTransactions.get(transaction.id);
          if (currentValue === undefined) {
            return { status: "obsolete", reason: "transaction-missing" } as const;
          }
          const current = parseStoredTransaction(currentValue);
          if (current.ownerUserId !== expectedOwnerUserId) {
            throw new AutomationRepositoryError("AUTOMATION_COMMIT_OWNER_UNAVAILABLE");
          }
          if (current.status === "committed") return { status: "committed" } as const;
          if (isTerminalWithoutCommit(current)) {
            return { status: "obsolete", reason: "transaction-terminal" } as const;
          }

          const ownedTargets: Array<{
            mutation: AutomationMutation;
            currentRevision: AutomationRecordRevisionStoreRow;
          }> = [];
          let allTargetsStillOwned = true;
          for (const mutation of revision.mutations) {
            const currentRevision = parseStoredRevision(
              await db.automationTransactions.get(
                recordRevisionId(mutation.entityType, mutation.entityId),
              ),
            );
            const currentProjection = await readLocalProjection(mutation);
            const currentHash = await Dexie.waitFor(hashAutomationValue(currentProjection));
            const expectedRecordExists = mutation.after !== null;
            const targetStillOwned =
              currentRevision !== null &&
              currentRevision.ownerUserId === expectedOwnerUserId &&
              currentRevision.entityType === mutation.entityType &&
              currentRevision.entityId === mutation.entityId &&
              currentRevision.recordExists === expectedRecordExists &&
              currentRevision.revisionToken === mutation.afterRevisionToken &&
              currentRevision.stateHash === mutation.afterHash &&
              currentRevision.transactionId === transaction.id &&
              currentHash === mutation.afterHash;
            if (!targetStillOwned || currentRevision === null) {
              allTargetsStillOwned = false;
              continue;
            }
            ownedTargets.push({ mutation, currentRevision });
          }

          const updatedAt = Math.max(current.updatedAt, Date.now());
          if (allTargetsStillOwned && ownedTargets.length === revision.mutations.length) {
            for (const { mutation, currentRevision } of ownedTargets) {
              const compensation: AutomationMutation = {
                entityType: mutation.entityType,
                entityId: mutation.entityId,
                operation: mutation.before === null ? "delete" : "upsert",
                before: mutation.after,
                after: mutation.before,
                beforeHash: mutation.afterHash,
                afterHash: mutation.beforeHash,
                beforeRevisionToken: mutation.afterRevisionToken,
                afterRevisionToken: mutation.beforeRevisionToken,
              };
              await applyLocalMutation(compensation);
              await db.automationTransactions.put(
                automationRecordRevisionStoreRowSchema.parse({
                  kind: "record_revision",
                  id: recordRevisionId(mutation.entityType, mutation.entityId),
                  schemaVersion: 1,
                  ownerUserId: expectedOwnerUserId,
                  entityType: mutation.entityType,
                  entityId: mutation.entityId,
                  recordExists: mutation.before !== null,
                  revisionToken: mutation.beforeRevisionToken,
                  stateHash: mutation.beforeHash,
                  mutationGeneration: currentRevision.mutationGeneration + 1,
                  transactionId: null,
                  updatedAt,
                }),
              );
              const compensatedProjection = await readLocalProjection(mutation);
              const compensatedHash = await Dexie.waitFor(
                hashAutomationValue(compensatedProjection),
              );
              if (compensatedHash !== mutation.beforeHash) {
                throw new AutomationRepositoryError("AUTOMATION_COMMIT_ROW_INVALID");
              }
            }
          }

          const { kind: _kind, ...currentTransaction } = current;
          const terminal = automationTransactionSchema.parse({
            ...currentTransaction,
            status: allTargetsStillOwned
              ? rejectedCommitStatus(result.code)
              : "commit_conflict",
            updatedAt,
          });
          await db.automationTransactions.put({ kind: "transaction", ...terminal });
          assertQueuedCommitContext(
            accountBoundaryGeneration,
            vaultKey,
            vaultRevision,
          );
          return { status: "obsolete", reason: "server-rejected" } as const;
        },
      );
    },
  );
  await requireOwner(expectedOwnerUserId);
  assertQueuedCommitContext(
    accountBoundaryGeneration,
    vaultKey,
    vaultRevision,
  );
  return outcome;
}

async function processQueuedAutomationCommitWithServerOperationLockHeld(
  rawIntent: AutomationCommitQueueIntent,
  expectedOwnerUserId: string,
): Promise<QueuedAutomationCommitOutcome> {
  const parsedIntent = automationCommitQueueIntentSchema.safeParse(rawIntent);
  if (!parsedIntent.success) {
    throw new AutomationRepositoryError("AUTOMATION_COMMIT_INTENT_INVALID");
  }
  const intent = parsedIntent.data;
  const accountBoundaryGeneration = captureOriginAccountBoundaryGeneration();

  await requireOwner(expectedOwnerUserId);
  const storedValue = await db.automationTransactions.get(intent.transactionId);
  if (storedValue === undefined) {
    return { status: "obsolete", reason: "transaction-missing" };
  }
  const transaction = parseStoredTransaction(storedValue);
  if (transaction.ownerUserId !== expectedOwnerUserId) {
    throw new AutomationRepositoryError("AUTOMATION_COMMIT_OWNER_UNAVAILABLE");
  }
  if (isTerminalWithoutCommit(transaction)) {
    return { status: "obsolete", reason: "transaction-terminal" };
  }

  const vaultKey = getJournalContentVaultKey();
  const vaultRevision = getJournalContentVaultRevision();
  if (!vaultKey || vaultRevision === null) {
    throw new AutomationRepositoryError("AUTOMATION_COMMIT_VAULT_LOCKED");
  }
  assertQueuedCommitContext(
    accountBoundaryGeneration,
    vaultKey,
    vaultRevision,
  );
  const revision = await decryptAutomationRevision(
    transaction.revisionCiphertext,
    vaultKey,
    {
      schemaVersion: transaction.schemaVersion,
      transactionId: transaction.id,
      ownerUserId: transaction.ownerUserId,
      consentEpoch: transaction.consentEpoch,
      sourceKey: transaction.sourceKey,
      sourceType: transaction.sourceType,
      sourceId: transaction.sourceId,
      ruleId: transaction.ruleId,
      ruleVersion: transaction.ruleVersion,
    },
  );
  await requireOwner(expectedOwnerUserId);
  assertQueuedCommitContext(
    accountBoundaryGeneration,
    vaultKey,
    vaultRevision,
  );

  const request = automationCommitRequestSchema.parse({
    schemaVersion: 1,
    transactionId: transaction.id,
    consentEpoch: transaction.consentEpoch,
    expectedPreferenceRevision: intent.expectedPreferenceRevision,
    expectedHistoryGeneration: intent.expectedHistoryGeneration,
    sourceKey: transaction.sourceKey,
    ruleId: transaction.ruleId,
    ruleVersion: transaction.ruleVersion,
    source: revision.source,
    revisionCiphertext: transaction.revisionCiphertext,
    deviceId: intent.deviceId,
    mutations: revision.mutations,
    requestedAt: revision.plannedAt,
  });
  const result = await commitAutomationTransaction(request, expectedOwnerUserId);
  await requireOwner(expectedOwnerUserId);
  assertQueuedCommitContext(
    accountBoundaryGeneration,
    vaultKey,
    vaultRevision,
  );
  if (!("currentPreferenceRevision" in result)) {
    return markAccepted(transaction.id, expectedOwnerUserId, result);
  }
  return reconcileRejectedCommit(
    transaction,
    revision,
    result,
    expectedOwnerUserId,
    accountBoundaryGeneration,
    vaultKey,
    vaultRevision,
  );
}

export function processQueuedAutomationCommit(
  rawIntent: AutomationCommitQueueIntent,
  expectedOwnerUserId: string,
): Promise<QueuedAutomationCommitOutcome> {
  return runWithOriginExclusiveLock(AUTOMATION_SERVER_OPERATION_LOCK, () =>
    processQueuedAutomationCommitWithServerOperationLockHeld(
      rawIntent,
      expectedOwnerUserId,
    ),
  );
}

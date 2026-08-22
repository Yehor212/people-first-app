import Dexie from "dexie";

import {
  getJournalContentVaultKey,
  getJournalContentVaultRevision,
} from "@/features/journal/journalContentSession";
import { runWithJournalSecurityWriteLock } from "@/features/journal/journalSecurityWriteLock";
import { db, getLocalDataOwnerId } from "@/storage/db";
import {
  DELETION_TRACKER_KEYS,
  mergeDeletionTrackerIdsInCurrentTransaction,
} from "@/storage/deletionTracker";
import { validateSyncOwner } from "@/storage/sync/syncOwner";
import {
  applyLocalMutation,
  compensateUnacceptedAutomationTransactionInCurrentTransaction,
  parseStoredRevision,
  parseStoredTransaction,
  readLocalProjection,
  recordRevisionId,
} from "./automationRepository";
import { buildAutomationCompensatingMutations } from "./automationUndo";
import { canonicalizeAutomationValue, hashAutomationValue } from "./canonicalJson";
import { decryptAutomationRevision } from "./revisionCrypto";
import { computeAutomationSourceKey } from "./sourceKey";
import { mergeAutomationPreference } from "./automationPreferences";
import {
  AUTOMATION_REMOTE_EVENT_LIMIT,
  AUTOMATION_PREFERENCE_SETTING_KEY,
  automationHistoryMarkerSchema,
  automationHistoryPurgeResultSchema,
  automationHistorySnapshotTransactionSchema,
  automationPreferenceSchema,
  automationRecordRevisionStoreRowSchema,
  automationRemoteEventSchema,
  automationTransactionSchema,
  type AutomationHistoryMarker,
  type AutomationHistoryPurgeResult,
  type AutomationHistorySnapshotTransaction,
  type AutomationMutation,
  type AutomationRemoteEvent,
  type AutomationRevisionEnvelope,
} from "./types";

export type AutomationRemoteSyncErrorCode =
  | "AUTOMATION_REMOTE_EVENT_INVALID"
  | "AUTOMATION_REMOTE_EVENT_CAPACITY"
  | "AUTOMATION_REMOTE_OWNER_UNAVAILABLE"
  | "AUTOMATION_REMOTE_VAULT_CHANGED"
  | "AUTOMATION_REMOTE_CANONICAL_MISMATCH"
  | "AUTOMATION_REMOTE_TARGET_CONFLICT";

export class AutomationRemoteSyncError extends Error {
  readonly code: AutomationRemoteSyncErrorCode;

  constructor(code: AutomationRemoteSyncErrorCode) {
    super(code);
    this.name = "AutomationRemoteSyncError";
    this.code = code;
  }
}

export interface AutomationRemoteEventInput {
  entityType: "automation_transaction" | "automation_history_purge";
  id: string;
  seq: number;
  entityId: string;
  op: "upsert" | "delete";
  payload: Record<string, unknown> | null;
  createdAt: string;
}

export interface AutomationRemoteReconcileResult {
  applied: number;
  deferred: number;
  lastAppliedServerSequence: number;
}

function requireReadWriteTransaction(): void {
  if (!Dexie.currentTransaction || Dexie.currentTransaction.mode !== "readwrite") {
    throw new AutomationRemoteSyncError("AUTOMATION_REMOTE_EVENT_INVALID");
  }
}

function remoteEventId(syncEventId: string): string {
  return `automation-remote-event:${syncEventId}`;
}

function parseReceivedAt(value: string): number {
  const timestamp = Date.parse(value);
  if (!Number.isSafeInteger(timestamp) || timestamp < 0) {
    throw new AutomationRemoteSyncError("AUTOMATION_REMOTE_EVENT_INVALID");
  }
  return timestamp;
}

function rowsMatch(left: AutomationRemoteEvent, right: AutomationRemoteEvent): boolean {
  return canonicalizeAutomationValue(left) === canonicalizeAutomationValue(right);
}

async function requireOwner(expectedOwnerUserId: string): Promise<void> {
  const ownerUserId = await validateSyncOwner(
    expectedOwnerUserId,
    "Automation remote reconciliation",
  );
  const localOwnerUserId = await getLocalDataOwnerId();
  if (ownerUserId !== expectedOwnerUserId || localOwnerUserId !== expectedOwnerUserId) {
    throw new AutomationRemoteSyncError("AUTOMATION_REMOTE_OWNER_UNAVAILABLE");
  }
}

function assertVaultContext(vaultKey: string, vaultRevision: number): void {
  if (
    getJournalContentVaultKey() !== vaultKey ||
    getJournalContentVaultRevision() !== vaultRevision
  ) {
    throw new AutomationRemoteSyncError("AUTOMATION_REMOTE_VAULT_CHANGED");
  }
}

function parseTransactionPayload(
  input: AutomationRemoteEventInput,
): AutomationHistorySnapshotTransaction {
  if (input.op !== "upsert" || input.payload === null) {
    throw new AutomationRemoteSyncError("AUTOMATION_REMOTE_EVENT_INVALID");
  }
  const parsed = automationHistorySnapshotTransactionSchema.safeParse(input.payload);
  if (!parsed.success || parsed.data.id !== input.entityId) {
    throw new AutomationRemoteSyncError("AUTOMATION_REMOTE_EVENT_INVALID");
  }
  return parsed.data;
}

function parsePurgePayload(input: AutomationRemoteEventInput): AutomationHistoryPurgeResult {
  if (input.op !== "upsert" || input.payload === null) {
    throw new AutomationRemoteSyncError("AUTOMATION_REMOTE_EVENT_INVALID");
  }
  const parsed = automationHistoryPurgeResultSchema.safeParse(input.payload);
  if (!parsed.success || parsed.data.operationId !== input.entityId) {
    throw new AutomationRemoteSyncError("AUTOMATION_REMOTE_EVENT_INVALID");
  }
  return parsed.data;
}

export async function persistAutomationRemoteEventInCurrentTransaction(
  input: AutomationRemoteEventInput,
  expectedOwnerUserId: string,
): Promise<"stored" | "ignored"> {
  requireReadWriteTransaction();
  const event =
    input.entityType === "automation_transaction"
      ? (() => {
          const transaction = parseTransactionPayload(input);
          return automationRemoteEventSchema.parse({
            id: remoteEventId(input.id),
            schemaVersion: 1,
            ownerUserId: expectedOwnerUserId,
            syncEventId: input.id,
            syncEventSequence: input.seq,
            transactionId: transaction.id,
            historyGeneration: transaction.historyGeneration,
            serverSequence: transaction.serverSequence,
            deliveryKind: "delta",
            transaction,
            receivedAt: parseReceivedAt(input.createdAt),
          });
        })()
      : (() => {
          const purge = parsePurgePayload(input);
          return automationRemoteEventSchema.parse({
            id: remoteEventId(input.id),
            schemaVersion: 1,
            ownerUserId: expectedOwnerUserId,
            syncEventId: input.id,
            syncEventSequence: input.seq,
            transactionId: null,
            operationId: purge.operationId,
            historyGeneration: purge.historyGeneration,
            serverSequence: purge.serverSequence,
            deliveryKind: "purge",
            purge,
            receivedAt: parseReceivedAt(input.createdAt),
          });
        })();

  const markerValue = await db.automationHistoryMarkers.get(expectedOwnerUserId);
  const marker = markerValue ? automationHistoryMarkerSchema.parse(markerValue) : null;
  if (
    marker &&
    (event.historyGeneration < marker.historyGeneration ||
      (event.historyGeneration === marker.historyGeneration &&
        event.serverSequence <= marker.lastAppliedServerSequence))
  ) {
    await db.automationRemoteEvents.delete(event.id);
    return "ignored";
  }

  const existing = await db.automationRemoteEvents.get(event.id);
  if (existing) {
    const parsedExisting = automationRemoteEventSchema.safeParse(existing);
    if (!parsedExisting.success || !rowsMatch(parsedExisting.data, event)) {
      throw new AutomationRemoteSyncError("AUTOMATION_REMOTE_CANONICAL_MISMATCH");
    }
    return "stored";
  }

  const pendingCount = await db.automationRemoteEvents
    .where("ownerUserId")
    .equals(expectedOwnerUserId)
    .count();
  if (pendingCount >= AUTOMATION_REMOTE_EVENT_LIMIT) {
    throw new AutomationRemoteSyncError("AUTOMATION_REMOTE_EVENT_CAPACITY");
  }
  await db.automationRemoteEvents.add(event);
  return "stored";
}

function assertRevisionBinding(
  revision: AutomationRevisionEnvelope,
  transaction: AutomationHistorySnapshotTransaction,
  expectedOwnerUserId: string,
): void {
  if (
    revision.transactionId !== transaction.id ||
    revision.ownerUserId !== expectedOwnerUserId ||
    revision.consentEpoch !== transaction.consentEpoch ||
    revision.sourceKey !== transaction.sourceKey ||
    revision.ruleId !== transaction.ruleId ||
    revision.ruleVersion !== transaction.ruleVersion ||
    revision.source.type !== transaction.sourceType ||
    revision.source.id !== transaction.sourceId
  ) {
    throw new AutomationRemoteSyncError("AUTOMATION_REMOTE_CANONICAL_MISMATCH");
  }
}

async function mutationMatchesRevision(
  mutation: AutomationMutation,
  expectedValueHash: string,
  expectedRevisionToken: string | null,
  expectedTransactionId: string | null,
): Promise<boolean> {
  const projection = await readLocalProjection(mutation);
  const projectionHash = await Dexie.waitFor(hashAutomationValue(projection));
  const revision = parseStoredRevision(
    await db.automationTransactions.get(recordRevisionId(mutation.entityType, mutation.entityId)),
  );
  if (!revision) return false;
  return (
    revision.recordExists === (projection !== null) &&
    revision.revisionToken === expectedRevisionToken &&
    revision.stateHash === expectedValueHash &&
    revision.transactionId === expectedTransactionId &&
    projectionHash === expectedValueHash
  );
}

async function mutationMatchesBefore(mutation: AutomationMutation): Promise<boolean> {
  const projection = await readLocalProjection(mutation);
  const projectionHash = await Dexie.waitFor(hashAutomationValue(projection));
  const revision = parseStoredRevision(
    await db.automationTransactions.get(recordRevisionId(mutation.entityType, mutation.entityId)),
  );
  if (mutation.before === null) {
    return projection === null && revision === null && projectionHash === mutation.beforeHash;
  }
  return Boolean(
    revision &&
      revision.recordExists &&
      revision.revisionToken === mutation.beforeRevisionToken &&
      revision.stateHash === mutation.beforeHash &&
      projectionHash === mutation.beforeHash,
  );
}

async function rememberAutomationDelete(
  mutation: AutomationMutation,
): Promise<void> {
  if (mutation.operation !== "delete") return;
  if (mutation.entityType === "journal") {
    await mergeDeletionTrackerIdsInCurrentTransaction(
      DELETION_TRACKER_KEYS.journal,
      [mutation.entityId],
    );
  } else if (mutation.entityType === "mood") {
    await mergeDeletionTrackerIdsInCurrentTransaction(
      DELETION_TRACKER_KEYS.mood,
      [mutation.entityId],
    );
  }
}

async function applyMutations(
  mutations: AutomationMutation[],
  expectedCurrent: "before" | "after",
  expectedCurrentTransactionId: string | null,
  resultingTransactionId: string | null,
  updatedAt: number,
  ownerUserId: string,
): Promise<void> {
  for (const mutation of mutations) {
    const alreadyApplied = await mutationMatchesRevision(
      mutation,
      mutation.afterHash,
      mutation.afterRevisionToken,
      resultingTransactionId,
    );
    if (alreadyApplied) continue;

    const currentMatches =
      expectedCurrent === "before"
        ? await mutationMatchesBefore(mutation)
        : await mutationMatchesRevision(
            mutation,
            mutation.beforeHash,
            mutation.beforeRevisionToken,
            expectedCurrentTransactionId,
          );
    if (!currentMatches) {
      throw new AutomationRemoteSyncError("AUTOMATION_REMOTE_TARGET_CONFLICT");
    }

    await applyLocalMutation(mutation);
    const existing = parseStoredRevision(
      await db.automationTransactions.get(
        recordRevisionId(mutation.entityType, mutation.entityId),
      ),
    );
    await db.automationTransactions.put(
      automationRecordRevisionStoreRowSchema.parse({
        kind: "record_revision",
        id: recordRevisionId(mutation.entityType, mutation.entityId),
        schemaVersion: 1,
        ownerUserId,
        entityType: mutation.entityType,
        entityId: mutation.entityId,
        recordExists: mutation.after !== null,
        revisionToken: mutation.afterRevisionToken,
        stateHash: mutation.afterHash,
        mutationGeneration: (existing?.mutationGeneration ?? 0) + 1,
        transactionId: resultingTransactionId,
        updatedAt,
      }),
    );
    await rememberAutomationDelete(mutation);
    const projection = await readLocalProjection(mutation);
    const projectionHash = await Dexie.waitFor(hashAutomationValue(projection));
    if (projectionHash !== mutation.afterHash) {
      throw new AutomationRemoteSyncError("AUTOMATION_REMOTE_TARGET_CONFLICT");
    }
  }
}

function assertExistingTransactionCanonical(
  existingValue: unknown,
  incoming: AutomationHistorySnapshotTransaction,
  ownerUserId: string,
): void {
  if (existingValue === undefined) return;
  const existing = parseStoredTransaction(existingValue);
  if (
    existing.ownerUserId !== ownerUserId ||
    existing.id !== incoming.id ||
    existing.consentEpoch !== incoming.consentEpoch ||
    existing.sourceKey !== incoming.sourceKey ||
    existing.ruleId !== incoming.ruleId ||
    existing.ruleVersion !== incoming.ruleVersion ||
    existing.sourceType !== incoming.sourceType ||
    existing.sourceId !== incoming.sourceId ||
    existing.revisionCiphertext !== incoming.revisionCiphertext
  ) {
    throw new AutomationRemoteSyncError("AUTOMATION_REMOTE_CANONICAL_MISMATCH");
  }
}

function existingTransactionMatchesCanonicalResult(
  existingValue: unknown,
  incoming: AutomationHistorySnapshotTransaction,
  ownerUserId: string,
): boolean {
  if (existingValue === undefined) return false;
  const existing = parseStoredTransaction(existingValue);
  const { kind: _kind, ...existingTransaction } = existing;
  const canonicalIncoming = automationTransactionSchema.parse({
    ...incoming,
    ownerUserId,
  });
  return (
    canonicalizeAutomationValue(existingTransaction) ===
    canonicalizeAutomationValue(canonicalIncoming)
  );
}

type AutomationRemoteTransactionEvent = Exclude<
  AutomationRemoteEvent,
  { deliveryKind: "purge" }
>;

async function applyRemoteTransaction(
  event: AutomationRemoteTransactionEvent,
  ownerUserId: string,
  vaultKey: string,
  historyPurged = false,
): Promise<void> {
  const transaction = event.transaction;
  const revision = await Dexie.waitFor(
    decryptAutomationRevision(transaction.revisionCiphertext, vaultKey, {
      schemaVersion: transaction.schemaVersion,
      transactionId: transaction.id,
      ownerUserId,
      consentEpoch: transaction.consentEpoch,
      sourceKey: transaction.sourceKey,
      sourceType: transaction.sourceType,
      sourceId: transaction.sourceId,
      ruleId: transaction.ruleId,
      ruleVersion: transaction.ruleVersion,
    }),
  );
  assertRevisionBinding(revision, transaction, ownerUserId);
  const expectedSourceKey = await Dexie.waitFor(
    computeAutomationSourceKey({
      ownerUserId,
      consentEpoch: transaction.consentEpoch,
      ruleId: transaction.ruleId,
      ruleVersion: transaction.ruleVersion,
      sourceType: transaction.sourceType,
      sourceId: transaction.sourceId,
      sourceRevision: revision.source.revision,
    }),
  );
  if (expectedSourceKey !== transaction.sourceKey) {
    throw new AutomationRemoteSyncError("AUTOMATION_REMOTE_CANONICAL_MISMATCH");
  }

  const existingValue = await db.automationTransactions.get(transaction.id);
  assertExistingTransactionCanonical(
    existingValue,
    transaction,
    ownerUserId,
  );
  const exactLocalCanonicalResult = existingTransactionMatchesCanonicalResult(
    existingValue,
    transaction,
    ownerUserId,
  );

  if (event.deliveryKind === "snapshot") {
    // The ordinary cloud snapshot has already materialized the current domain
    // projection. Snapshot history is authenticated and retained here, but is
    // never replayed over that newer/current projection.
  } else if (exactLocalCanonicalResult) {
    // The server event acknowledges a local commit/undo that was already
    // finalized atomically. A later manual edit owns the current projection
    // and must not be replayed over merely to advance ordered history.
  } else if (transaction.status === "committed") {
    await applyMutations(
      revision.mutations,
      "before",
      null,
      historyPurged ? null : transaction.id,
      transaction.updatedAt,
      ownerUserId,
    );
  } else {
    if (!transaction.undoTransactionId) {
      throw new AutomationRemoteSyncError("AUTOMATION_REMOTE_CANONICAL_MISMATCH");
    }
    const compensatingMutations = buildAutomationCompensatingMutations(
      revision,
      transaction.undoTransactionId,
    );
    await applyMutations(
      compensatingMutations,
      "after",
      historyPurged ? null : transaction.id,
      historyPurged ? null : transaction.undoTransactionId,
      transaction.updatedAt,
      ownerUserId,
    );
  }

  if (historyPurged) {
    await db.automationTransactions.delete(transaction.id);
  } else {
    const storedTransaction = automationTransactionSchema.parse({
      ...transaction,
      ownerUserId,
    });
    await db.automationTransactions.put({ kind: "transaction", ...storedTransaction });
  }
}

type AutomationRemotePurgeEvent = Extract<
  AutomationRemoteEvent,
  { deliveryKind: "purge" }
>;

async function applyRemotePurge(
  event: AutomationRemotePurgeEvent,
  ownerUserId: string,
  marker: AutomationHistoryMarker,
  vaultKey: string | null,
): Promise<AutomationHistoryMarker | null> {
  const result = event.purge;
  const all = result.allHistoryPurgedAt !== null;
  if (
    event.serverSequence !== marker.lastAppliedServerSequence + 1 ||
    (all
      ? result.historyGeneration !== marker.historyGeneration + 1
      : result.historyGeneration !== marker.historyGeneration)
  ) {
    throw new AutomationRemoteSyncError("AUTOMATION_REMOTE_EVENT_INVALID");
  }

  let ownerRows = await db.automationTransactions
    .where("ownerUserId")
    .equals(ownerUserId)
    .toArray();
  const requested = new Set(result.purgedTransactionIds);
  let preferenceToPersist = result.preference;
  let preservedConsentEpoch: string | null = null;
  if (all && result.preference) {
    const currentPreferenceRow = await db.settings.get(AUTOMATION_PREFERENCE_SETTING_KEY);
    const currentPreference = automationPreferenceSchema.safeParse(currentPreferenceRow?.value);
    preferenceToPersist = currentPreference.success
      ? mergeAutomationPreference(currentPreference.data, result.preference)
      : result.preference;
    if (
      preferenceToPersist.enabled &&
      preferenceToPersist.serverRevision > result.preference.serverRevision
    ) {
      preservedConsentEpoch = preferenceToPersist.consentEpoch;
    }
  }
  const transactions = ownerRows
    .filter((row) => row.kind === "transaction")
    .map((row) => parseStoredTransaction(row));
  const selectedTransactions = all
    ? transactions.filter(
        (transaction) => transaction.consentEpoch !== preservedConsentEpoch,
      )
    : transactions.filter((transaction) => requested.has(transaction.id));
  const pendingTransactions = selectedTransactions.filter(
    (transaction) =>
      transaction.status === "commit_pending" && !requested.has(transaction.id),
  );
  if (pendingTransactions.length > 0 && !vaultKey) return null;
  for (const transaction of pendingTransactions) {
    const revision = await Dexie.waitFor(
      decryptAutomationRevision(transaction.revisionCiphertext, vaultKey as string, {
        schemaVersion: transaction.schemaVersion,
        transactionId: transaction.id,
        ownerUserId: transaction.ownerUserId,
        consentEpoch: transaction.consentEpoch,
        sourceKey: transaction.sourceKey,
        sourceType: transaction.sourceType,
        sourceId: transaction.sourceId,
        ruleId: transaction.ruleId,
        ruleVersion: transaction.ruleVersion,
      }),
    );
    await compensateUnacceptedAutomationTransactionInCurrentTransaction(
      transaction,
      revision,
      ownerUserId,
      result.completedAt,
    );
  }
  if (pendingTransactions.length > 0) {
    ownerRows = await db.automationTransactions
      .where("ownerUserId")
      .equals(ownerUserId)
      .toArray();
  }
  const selectedTransactionIds = new Set(
    selectedTransactions.map((transaction) => transaction.id),
  );
  const ownershipIds = new Set([
    ...result.purgedTransactionIds,
    ...selectedTransactionIds,
  ]);
  for (const transaction of selectedTransactions) {
    if (transaction.undoTransactionId) ownershipIds.add(transaction.undoTransactionId);
  }

  const detachedRevisions = ownerRows
    .filter((row) => row.kind === "record_revision")
    .map((row) => parseStoredRevision(row))
    .filter(
      (revision): revision is NonNullable<typeof revision> =>
        revision !== null &&
        revision.transactionId !== null &&
        ownershipIds.has(revision.transactionId),
    )
    .map((revision) =>
      automationRecordRevisionStoreRowSchema.parse({
        ...revision,
        transactionId: null,
        updatedAt: Math.max(revision.updatedAt, result.completedAt),
      }),
    );
  if (detachedRevisions.length > 0) {
    await db.automationTransactions.bulkPut(detachedRevisions);
  }

  const removableLocalIds = ownerRows
    .filter(
      (row) =>
        (row.kind === "transaction" && selectedTransactionIds.has(row.id)) ||
        (all &&
          row.kind === "source_pending" &&
          row.consentEpoch !== preservedConsentEpoch) ||
        (row.kind === "purge_pending" && row.operationId === result.operationId),
    )
    .map((row) => row.id);
  if (removableLocalIds.length > 0) {
    await db.automationTransactions.bulkDelete(removableLocalIds);
  }

  const removableQueueIds = (await db.offlineQueue.toArray())
    .filter(
      (row) =>
        row.ownerUserId === ownerUserId &&
        (row.type === "COMMIT_AUTOMATION_TRANSACTION" ||
          row.type === "UNDO_AUTOMATION_TRANSACTION") &&
        selectedTransactionIds.has(row.entityId),
    )
    .map((row) => row.id);
  if (removableQueueIds.length > 0) {
    await db.offlineQueue.bulkDelete(removableQueueIds);
  }

  const pendingRemoteRows = await db.automationRemoteEvents
    .where("ownerUserId")
    .equals(ownerUserId)
    .toArray();
  const removableRemoteIds = pendingRemoteRows
    .filter((row) => {
      if (row.id === event.id) return false;
      if (row.serverSequence >= event.serverSequence) return false;
      if (all) return row.historyGeneration < result.historyGeneration;
      return row.deliveryKind !== "purge" && requested.has(row.transactionId);
    })
    .map((row) => row.id);
  if (removableRemoteIds.length > 0) {
    await db.automationRemoteEvents.bulkDelete(removableRemoteIds);
  }

  if (all && preferenceToPersist) {
    await db.settings.put({
      key: AUTOMATION_PREFERENCE_SETTING_KEY,
      value: preferenceToPersist,
    });
  }
  const purgedTransactionIds = all
    ? undefined
    : [
        ...new Set([
          ...(marker.purgedTransactionIds ?? []),
          ...result.purgedTransactionIds,
        ]),
      ].sort();
  const nextMarker = automationHistoryMarkerSchema.parse({
    schemaVersion: 1,
    ownerUserId,
    historyGeneration: result.historyGeneration,
    snapshotSequence: Math.max(marker.snapshotSequence, result.serverSequence),
    lastAppliedServerSequence: result.serverSequence,
    bootstrapCompletedAt: marker.bootstrapCompletedAt,
    ...(purgedTransactionIds ? { purgedTransactionIds } : {}),
    ...(result.allHistoryPurgedAt !== null
      ? { allHistoryPurgedAt: result.allHistoryPurgedAt }
      : marker.allHistoryPurgedAt !== undefined
        ? { allHistoryPurgedAt: marker.allHistoryPurgedAt }
        : {}),
    updatedAt: Math.max(marker.updatedAt, result.completedAt),
  });
  await db.automationHistoryMarkers.put(nextMarker);
  return nextMarker;
}

async function pruneRejectedRemoteRows(
  ownerUserId: string,
  marker: AutomationHistoryMarker,
): Promise<void> {
  const rows = await db.automationRemoteEvents.where("ownerUserId").equals(ownerUserId).toArray();
  const rejectedIds = rows
    .filter(
      (row) =>
        row.historyGeneration < marker.historyGeneration ||
        row.serverSequence <= marker.lastAppliedServerSequence,
    )
    .map((row) => row.id);
  if (rejectedIds.length > 0) await db.automationRemoteEvents.bulkDelete(rejectedIds);
}

export async function reconcileAutomationRemoteEventsInCurrentTransaction(
  expectedOwnerUserId: string,
): Promise<AutomationRemoteReconcileResult> {
  requireReadWriteTransaction();
  const markerValue = await db.automationHistoryMarkers.get(expectedOwnerUserId);
  if (!markerValue) {
    const deferred = await db.automationRemoteEvents
      .where("ownerUserId")
      .equals(expectedOwnerUserId)
      .count();
    return { applied: 0, deferred, lastAppliedServerSequence: 0 };
  }
  let marker = automationHistoryMarkerSchema.parse(markerValue);
  await pruneRejectedRemoteRows(expectedOwnerUserId, marker);
  if (marker.bootstrapCompletedAt === null) {
    const deferred = await db.automationRemoteEvents
      .where("ownerUserId")
      .equals(expectedOwnerUserId)
      .count();
    return {
      applied: 0,
      deferred,
      lastAppliedServerSequence: marker.lastAppliedServerSequence,
    };
  }

  const vaultKey = getJournalContentVaultKey();
  const vaultRevision = getJournalContentVaultRevision();
  const vaultAvailable = vaultKey !== null && vaultKey.length > 0 && vaultRevision !== null;
  if (vaultAvailable) assertVaultContext(vaultKey, vaultRevision);

  const pending = (await db.automationRemoteEvents
    .where("ownerUserId")
    .equals(expectedOwnerUserId)
    .toArray())
    .sort(
      (left, right) =>
        left.serverSequence - right.serverSequence ||
        left.syncEventSequence - right.syncEventSequence ||
        left.id.localeCompare(right.id),
    );

  let applied = 0;
  const snapshotEvents = pending.filter(
    (event): event is AutomationRemoteTransactionEvent =>
      event.deliveryKind === "snapshot",
  );
  for (const event of snapshotEvents) {
    const parsed = automationRemoteEventSchema.safeParse(event);
    if (!parsed.success || parsed.data.deliveryKind !== "snapshot") {
      throw new AutomationRemoteSyncError("AUTOMATION_REMOTE_EVENT_INVALID");
    }
    if (event.serverSequence > marker.snapshotSequence) {
      throw new AutomationRemoteSyncError("AUTOMATION_REMOTE_EVENT_INVALID");
    }
    if (event.serverSequence <= marker.lastAppliedServerSequence) {
      await db.automationRemoteEvents.delete(event.id);
      continue;
    }
    if (!vaultAvailable) {
      const deferred = await db.automationRemoteEvents
        .where("ownerUserId")
        .equals(expectedOwnerUserId)
        .count();
      return {
        applied,
        deferred,
        lastAppliedServerSequence: marker.lastAppliedServerSequence,
      };
    }
    assertVaultContext(vaultKey, vaultRevision);
    await applyRemoteTransaction(parsed.data, expectedOwnerUserId, vaultKey);
    await db.automationRemoteEvents.delete(event.id);
    applied += 1;
  }

  if (marker.lastAppliedServerSequence < marker.snapshotSequence) {
    marker = automationHistoryMarkerSchema.parse({
      ...marker,
      lastAppliedServerSequence: marker.snapshotSequence,
      updatedAt: Math.max(
        marker.updatedAt,
        ...snapshotEvents.map((event) => event.transaction.updatedAt),
      ),
    });
    await db.automationHistoryMarkers.put(marker);
  }

  const deltaEvents = pending.filter((event) => event.deliveryKind !== "snapshot");
  for (const event of deltaEvents) {
    const parsed = automationRemoteEventSchema.safeParse(event);
    if (!parsed.success) {
      throw new AutomationRemoteSyncError("AUTOMATION_REMOTE_EVENT_INVALID");
    }
    const expectedSequence = marker.lastAppliedServerSequence + 1;
    if (event.serverSequence < expectedSequence) {
      await db.automationRemoteEvents.delete(event.id);
      continue;
    }
    if (event.serverSequence > expectedSequence) break;
    if (parsed.data.deliveryKind === "purge") {
      const nextMarker = await applyRemotePurge(
        parsed.data,
        expectedOwnerUserId,
        marker,
        vaultAvailable ? vaultKey : null,
      );
      if (!nextMarker) break;
      marker = nextMarker;
    } else {
      if (parsed.data.historyGeneration !== marker.historyGeneration) {
        throw new AutomationRemoteSyncError("AUTOMATION_REMOTE_EVENT_INVALID");
      }
      if (!vaultAvailable) break;
      assertVaultContext(vaultKey, vaultRevision);
      await applyRemoteTransaction(
        parsed.data,
        expectedOwnerUserId,
        vaultKey,
        marker.purgedTransactionIds?.includes(parsed.data.transaction.id) ?? false,
      );
      marker = automationHistoryMarkerSchema.parse({
        ...marker,
        lastAppliedServerSequence: event.serverSequence,
        updatedAt: Math.max(marker.updatedAt, parsed.data.transaction.updatedAt),
      });
      await db.automationHistoryMarkers.put(marker);
    }
    await db.automationRemoteEvents.delete(event.id);
    applied += 1;
  }
  if (vaultAvailable) assertVaultContext(vaultKey, vaultRevision);
  const deferred = await db.automationRemoteEvents
    .where("ownerUserId")
    .equals(expectedOwnerUserId)
    .count();
  return {
    applied,
    deferred,
    lastAppliedServerSequence: marker.lastAppliedServerSequence,
  };
}

export async function reconcilePendingAutomationEvents(
  expectedOwnerUserId: string,
): Promise<AutomationRemoteReconcileResult> {
  await requireOwner(expectedOwnerUserId);
  const result = await runWithJournalSecurityWriteLock(async () =>
    db.transaction(
      "rw",
      [
        db.moods,
        db.habits,
        db.settings,
        db.journalEntries,
        db.offlineQueue,
        db.automationTransactions,
        db.automationHistoryMarkers,
        db.automationRemoteEvents,
      ],
      async () => {
        await Dexie.waitFor(requireOwner(expectedOwnerUserId));
        const value = await reconcileAutomationRemoteEventsInCurrentTransaction(
          expectedOwnerUserId,
        );
        await Dexie.waitFor(requireOwner(expectedOwnerUserId));
        return value;
      },
    ),
  );
  await requireOwner(expectedOwnerUserId);
  return result;
}

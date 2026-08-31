import Dexie from "dexie";

import {
  getJournalContentVaultKey,
  getJournalContentVaultRevision,
} from "@/features/journal/journalContentSession";
import { offlineQueue, persistCriticalOfflineActionInCurrentTransaction } from "@/lib/offlineQueue";
import { logger } from "@/lib/logger";
import { runWithOriginExclusiveLock } from "@/lib/originExclusiveLock";
import {
  ACCOUNT_BOUNDARY_DATA_WRITE_LOCK,
  assertAccountSessionTransitionGeneration,
  captureAccountSessionTransitionGeneration,
  captureOriginAccountBoundaryGeneration,
  isOriginAccountBoundaryGenerationCurrent,
  type AccountSessionTransitionGeneration,
  type OriginAccountBoundaryGeneration,
} from "@/storage/accountBoundaryRuntime";
import { db } from "@/storage/db";
import {
  DELETION_TRACKER_KEYS,
  mergeDeletionTrackerIdsInCurrentTransaction,
} from "@/storage/deletionTracker";
import { validateSyncOwner } from "@/storage/sync/syncOwner";
import {
  applyLocalMutation,
  parseStoredRevision,
  parseStoredTransaction,
  readLocalProjection,
  recordRevisionId,
} from "./automationRepository";
import { undoAutomationTransaction } from "./automationCloud";
import { AUTOMATION_SERVER_OPERATION_LOCK } from "./automationOperationLock";
import { hashAutomationValue } from "./canonicalJson";
import { decryptAutomationRevision } from "./revisionCrypto";
import {
  automationHistoryMarkerSchema,
  automationMutationSchema,
  automationRecordRevisionStoreRowSchema,
  automationTransactionSchema,
  automationUndoQueueIntentSchema,
  automationUndoRequestSchema,
  type AutomationHistoryMarker,
  type AutomationMutation,
  type AutomationRevisionEnvelope,
  type AutomationTransactionStoreRow,
  type AutomationUndoQueueIntent,
  type AutomationUndoResult,
} from "./types";

export type AutomationUndoErrorCode =
  | "AUTOMATION_UNDO_INVALID_INTENT"
  | "AUTOMATION_UNDO_OWNER_UNAVAILABLE"
  | "AUTOMATION_UNDO_BOUNDARY_CHANGED"
  | "AUTOMATION_UNDO_VAULT_LOCKED"
  | "AUTOMATION_UNDO_TRANSACTION_INVALID"
  | "AUTOMATION_UNDO_NOT_AVAILABLE"
  | "AUTOMATION_UNDO_CANONICAL_MISMATCH";

export class AutomationUndoError extends Error {
  readonly code: AutomationUndoErrorCode;

  constructor(code: AutomationUndoErrorCode) {
    super(code);
    this.name = "AutomationUndoError";
    this.code = code;
  }
}

export type AutomationUndoRequestOutcome =
  | { status: "pending"; operationId: string }
  | { status: "already-undone"; operationId: string };

export type QueuedAutomationUndoOutcome =
  | { status: "committed" }
  | {
      status: "obsolete";
      reason: "transaction-missing" | "transaction-terminal" | "server-rejected";
    };

const undoQueueRowId = (transactionId: string) => `automation-undo:${transactionId}`;

async function requireOwner(expectedOwnerUserId: string): Promise<void> {
  const ownerUserId = await validateSyncOwner(expectedOwnerUserId, "Automation undo");
  if (!ownerUserId || ownerUserId !== expectedOwnerUserId) {
    throw new AutomationUndoError("AUTOMATION_UNDO_OWNER_UNAVAILABLE");
  }
}

function requireVaultContext(): { vaultKey: string; vaultRevision: number } {
  const vaultKey = getJournalContentVaultKey();
  const vaultRevision = getJournalContentVaultRevision();
  if (!vaultKey || vaultRevision === null) {
    throw new AutomationUndoError("AUTOMATION_UNDO_VAULT_LOCKED");
  }
  return { vaultKey, vaultRevision };
}

function assertContext(
  accountBoundaryGeneration: OriginAccountBoundaryGeneration,
  accountSessionGeneration: AccountSessionTransitionGeneration,
  vaultKey: string,
  vaultRevision: number
): void {
  assertAccountSessionTransitionGeneration(accountSessionGeneration);
  if (!isOriginAccountBoundaryGenerationCurrent(accountBoundaryGeneration)) {
    throw new AutomationUndoError("AUTOMATION_UNDO_BOUNDARY_CHANGED");
  }
  if (
    getJournalContentVaultKey() !== vaultKey ||
    getJournalContentVaultRevision() !== vaultRevision
  ) {
    throw new AutomationUndoError("AUTOMATION_UNDO_VAULT_LOCKED");
  }
}

function createOperationId(): string {
  if (typeof globalThis.crypto?.randomUUID !== "function") {
    throw new AutomationUndoError("AUTOMATION_UNDO_NOT_AVAILABLE");
  }
  return globalThis.crypto.randomUUID();
}

export function deriveAutomationUndoRevisionToken(
  operationId: string,
  mutationIndex: number
): string {
  if (
    !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
      operationId
    ) ||
    !Number.isInteger(mutationIndex) ||
    mutationIndex < 0 ||
    mutationIndex > 31
  ) {
    throw new AutomationUndoError("AUTOMATION_UNDO_INVALID_INTENT");
  }
  const octets = operationId.replace(/-/g, "").match(/.{2}/g);
  if (!octets || octets.length !== 16) {
    throw new AutomationUndoError("AUTOMATION_UNDO_INVALID_INTENT");
  }
  const bytes = octets.map((byte: string) => Number.parseInt(byte, 16));
  // The operation UUID supplies 122 random bits. A fixed domain separator and
  // the bounded mutation index produce a stable, collision-resistant custom
  // UUIDv8 without asynchronous crypto inside the atomic Dexie replay.
  bytes[0] ^= 0xa5;
  bytes[1] ^= 0x5a;
  bytes[14] ^= 0xc3;
  bytes[15] ^= mutationIndex;
  bytes[6] = (bytes[6] & 0x0f) | 0x80;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;
  const compact = bytes.map((byte) => byte.toString(16).padStart(2, "0")).join("");
  return `${compact.slice(0, 8)}-${compact.slice(8, 12)}-${compact.slice(12, 16)}-${compact.slice(16, 20)}-${compact.slice(20)}`;
}

export function buildAutomationCompensatingMutations(
  revision: AutomationRevisionEnvelope,
  operationId: string
): AutomationMutation[] {
  return revision.mutations.map((mutation, index) =>
    automationMutationSchema.parse({
      entityType: mutation.entityType,
      entityId: mutation.entityId,
      operation: mutation.before === null ? "delete" : "upsert",
      before: mutation.after,
      after: mutation.before,
      beforeHash: mutation.afterHash,
      afterHash: mutation.beforeHash,
      beforeRevisionToken: mutation.afterRevisionToken,
      afterRevisionToken:
        mutation.before === null ? null : deriveAutomationUndoRevisionToken(operationId, index),
    })
  );
}

export async function requestAutomationUndo(
  transactionId: string,
  expectedOwnerUserId: string,
  deviceId: string
): Promise<AutomationUndoRequestOutcome> {
  const accountBoundaryGeneration = captureOriginAccountBoundaryGeneration();
  const accountSessionGeneration = captureAccountSessionTransitionGeneration();
  const { vaultKey, vaultRevision } = requireVaultContext();
  await requireOwner(expectedOwnerUserId);
  assertContext(accountBoundaryGeneration, accountSessionGeneration, vaultKey, vaultRevision);

  const outcome = await runWithOriginExclusiveLock(ACCOUNT_BOUNDARY_DATA_WRITE_LOCK, async () => {
    await requireOwner(expectedOwnerUserId);
    assertContext(accountBoundaryGeneration, accountSessionGeneration, vaultKey, vaultRevision);
    return db.transaction("rw", [db.automationTransactions, db.offlineQueue], async () => {
      const stored = await db.automationTransactions.get(transactionId);
      if (stored === undefined) {
        throw new AutomationUndoError("AUTOMATION_UNDO_NOT_AVAILABLE");
      }
      const transaction = parseStoredTransaction(stored);
      if (transaction.ownerUserId !== expectedOwnerUserId) {
        throw new AutomationUndoError("AUTOMATION_UNDO_OWNER_UNAVAILABLE");
      }
      if (transaction.status === "undone") {
        if (!transaction.undoTransactionId) {
          throw new AutomationUndoError("AUTOMATION_UNDO_TRANSACTION_INVALID");
        }
        return {
          status: "already-undone",
          operationId: transaction.undoTransactionId,
        } as const;
      }
      if (transaction.status === "undo_pending") {
        const queued = await db.offlineQueue.get(undoQueueRowId(transaction.id));
        const parsed = automationUndoQueueIntentSchema.safeParse(queued?.payload);
        if (
          !parsed.success ||
          queued?.ownerUserId !== expectedOwnerUserId ||
          queued.operationId !== parsed.data.operationId
        ) {
          throw new AutomationUndoError("AUTOMATION_UNDO_TRANSACTION_INVALID");
        }
        return { status: "pending", operationId: parsed.data.operationId } as const;
      }
      if (
        transaction.status !== "committed" ||
        transaction.serverSequence === undefined ||
        transaction.historyGeneration === undefined
      ) {
        throw new AutomationUndoError("AUTOMATION_UNDO_NOT_AVAILABLE");
      }

      const operationId = createOperationId();
      const intent = automationUndoQueueIntentSchema.parse({
        schemaVersion: 1,
        operationId,
        transactionId: transaction.id,
        expectedServerSequence: transaction.serverSequence,
        expectedHistoryGeneration: transaction.historyGeneration,
        deviceId,
      });
      const { kind: _kind, ...transactionValue } = transaction;
      const pending = automationTransactionSchema.parse({
        ...transactionValue,
        status: "undo_pending",
        updatedAt: Math.max(transaction.updatedAt, Date.now()),
      });
      await db.automationTransactions.put({ kind: "transaction", ...pending });
      await persistCriticalOfflineActionInCurrentTransaction(
        "UNDO_AUTOMATION_TRANSACTION",
        transaction.id,
        intent,
        expectedOwnerUserId,
        { id: undoQueueRowId(transaction.id), operationId }
      );
      assertContext(accountBoundaryGeneration, accountSessionGeneration, vaultKey, vaultRevision);
      return { status: "pending", operationId } as const;
    });
  });
  await requireOwner(expectedOwnerUserId);
  assertContext(accountBoundaryGeneration, accountSessionGeneration, vaultKey, vaultRevision);
  if (outcome.status === "pending") {
    try {
      await offlineQueue.wakeFromDurableStorage();
    } catch {
      logger.warn("[Automation] Durable undo queue wake deferred");
    }
  }
  return outcome;
}

async function applyAcceptedUndo(
  transaction: AutomationTransactionStoreRow,
  revision: AutomationRevisionEnvelope,
  compensatingMutations: AutomationMutation[],
  result: Extract<AutomationUndoResult, { code: "UNDONE" | "ALREADY_UNDONE" }>,
  expectedOwnerUserId: string,
  accountBoundaryGeneration: OriginAccountBoundaryGeneration,
  accountSessionGeneration: AccountSessionTransitionGeneration,
  vaultKey: string,
  vaultRevision: number
): Promise<QueuedAutomationUndoOutcome> {
  if (result.transactionId !== transaction.id || result.undoTransactionId === transaction.id) {
    throw new AutomationUndoError("AUTOMATION_UNDO_CANONICAL_MISMATCH");
  }

  return runWithOriginExclusiveLock(ACCOUNT_BOUNDARY_DATA_WRITE_LOCK, async () => {
    await requireOwner(expectedOwnerUserId);
    assertContext(accountBoundaryGeneration, accountSessionGeneration, vaultKey, vaultRevision);
    return db.transaction(
      "rw",
      [
        db.moods,
        db.habits,
        db.settings,
        db.journalEntries,
        db.automationTransactions,
        db.automationHistoryMarkers,
      ],
      async () => {
        const currentValue = await db.automationTransactions.get(transaction.id);
        if (currentValue === undefined) {
          return { status: "obsolete", reason: "transaction-missing" } as const;
        }
        const current = parseStoredTransaction(currentValue);
        if (current.ownerUserId !== expectedOwnerUserId) {
          throw new AutomationUndoError("AUTOMATION_UNDO_OWNER_UNAVAILABLE");
        }
        if (current.status === "undone") {
          if (current.undoTransactionId !== result.undoTransactionId) {
            throw new AutomationUndoError("AUTOMATION_UNDO_CANONICAL_MISMATCH");
          }
          return { status: "committed" } as const;
        }
        if (current.status !== "undo_pending") {
          return { status: "obsolete", reason: "transaction-terminal" } as const;
        }

        const markerValue = await db.automationHistoryMarkers.get(expectedOwnerUserId);
        const marker = markerValue ? automationHistoryMarkerSchema.parse(markerValue) : null;
        if (marker && marker.historyGeneration > result.historyGeneration) {
          return { status: "obsolete", reason: "transaction-terminal" } as const;
        }

        const ownedTargets: Array<{
          original: AutomationMutation;
          compensation: AutomationMutation;
          mutationGeneration: number;
        }> = [];
        let allTargetsStillOwned = true;
        for (const [index, original] of revision.mutations.entries()) {
          const currentRevision = parseStoredRevision(
            await db.automationTransactions.get(
              recordRevisionId(original.entityType, original.entityId)
            )
          );
          const currentProjection = await readLocalProjection(original);
          const currentHash = await Dexie.waitFor(hashAutomationValue(currentProjection));
          const owned =
            currentRevision !== null &&
            currentRevision.ownerUserId === expectedOwnerUserId &&
            currentRevision.recordExists === (original.after !== null) &&
            currentRevision.revisionToken === original.afterRevisionToken &&
            currentRevision.stateHash === original.afterHash &&
            currentRevision.transactionId === transaction.id &&
            currentHash === original.afterHash;
          if (!owned || currentRevision === null) {
            allTargetsStillOwned = false;
            continue;
          }
          ownedTargets.push({
            original,
            compensation: compensatingMutations[index],
            mutationGeneration: currentRevision.mutationGeneration,
          });
        }

        if (allTargetsStillOwned && ownedTargets.length === revision.mutations.length) {
          for (const { original, compensation, mutationGeneration } of ownedTargets) {
            await applyLocalMutation(compensation);
            await db.automationTransactions.put(
              automationRecordRevisionStoreRowSchema.parse({
                kind: "record_revision",
                id: recordRevisionId(original.entityType, original.entityId),
                schemaVersion: 1,
                ownerUserId: expectedOwnerUserId,
                entityType: original.entityType,
                entityId: original.entityId,
                recordExists: compensation.after !== null,
                revisionToken: compensation.afterRevisionToken,
                stateHash: compensation.afterHash,
                mutationGeneration: mutationGeneration + 1,
                transactionId: result.undoTransactionId,
                updatedAt: result.completedAt,
              })
            );
            if (compensation.operation === "delete" && original.entityType === "journal") {
              await mergeDeletionTrackerIdsInCurrentTransaction(DELETION_TRACKER_KEYS.journal, [
                original.entityId,
              ]);
            }
            if (compensation.operation === "delete" && original.entityType === "mood") {
              await mergeDeletionTrackerIdsInCurrentTransaction(DELETION_TRACKER_KEYS.mood, [
                original.entityId,
              ]);
            }
            const appliedProjection = await readLocalProjection(original);
            const appliedHash = await Dexie.waitFor(hashAutomationValue(appliedProjection));
            if (appliedHash !== compensation.afterHash) {
              throw new AutomationUndoError("AUTOMATION_UNDO_TRANSACTION_INVALID");
            }
          }
        }

        const { kind: _kind, ...transactionValue } = current;
        const undone = automationTransactionSchema.parse({
          ...transactionValue,
          status: "undone",
          serverSequence: result.serverSequence,
          historyGeneration: result.historyGeneration,
          updatedAt: Math.max(current.updatedAt, result.completedAt),
          undoneAt: result.completedAt,
          undoTransactionId: result.undoTransactionId,
        });
        await db.automationTransactions.put({ kind: "transaction", ...undone });

        const previousServerSequence = marker?.lastAppliedServerSequence ?? 0;
        const sequenceContiguous =
          result.serverSequence <= previousServerSequence ||
          result.serverSequence === previousServerSequence + 1;
        const nextMarker: AutomationHistoryMarker = automationHistoryMarkerSchema.parse({
          schemaVersion: 1,
          ownerUserId: expectedOwnerUserId,
          historyGeneration: marker?.historyGeneration ?? result.historyGeneration,
          snapshotSequence: marker?.snapshotSequence ?? 0,
          lastAppliedServerSequence: sequenceContiguous
            ? Math.max(previousServerSequence, result.serverSequence)
            : previousServerSequence,
          bootstrapCompletedAt: marker?.bootstrapCompletedAt ?? null,
          ...(marker?.purgedTransactionIds
            ? { purgedTransactionIds: marker.purgedTransactionIds }
            : {}),
          ...(marker?.allHistoryPurgedAt !== undefined
            ? { allHistoryPurgedAt: marker.allHistoryPurgedAt }
            : {}),
          updatedAt: Math.max(marker?.updatedAt ?? 0, result.completedAt),
        });
        await db.automationHistoryMarkers.put(nextMarker);
        assertContext(accountBoundaryGeneration, accountSessionGeneration, vaultKey, vaultRevision);
        return { status: "committed" } as const;
      }
    );
  });
}

async function markRejectedUndo(
  transactionId: string,
  result: Exclude<AutomationUndoResult, { code: "UNDONE" | "ALREADY_UNDONE" }>,
  expectedOwnerUserId: string,
  accountBoundaryGeneration: OriginAccountBoundaryGeneration,
  accountSessionGeneration: AccountSessionTransitionGeneration,
  vaultKey: string,
  vaultRevision: number
): Promise<QueuedAutomationUndoOutcome> {
  if (result.transactionId !== transactionId) {
    throw new AutomationUndoError("AUTOMATION_UNDO_CANONICAL_MISMATCH");
  }
  return runWithOriginExclusiveLock(ACCOUNT_BOUNDARY_DATA_WRITE_LOCK, async () => {
    await requireOwner(expectedOwnerUserId);
    assertContext(accountBoundaryGeneration, accountSessionGeneration, vaultKey, vaultRevision);
    return db.transaction("rw", db.automationTransactions, async () => {
      const currentValue = await db.automationTransactions.get(transactionId);
      if (currentValue === undefined) {
        return { status: "obsolete", reason: "transaction-missing" } as const;
      }
      const current = parseStoredTransaction(currentValue);
      if (current.ownerUserId !== expectedOwnerUserId) {
        throw new AutomationUndoError("AUTOMATION_UNDO_OWNER_UNAVAILABLE");
      }
      if (current.status === "undone") return { status: "committed" } as const;
      if (current.status !== "undo_pending") {
        return { status: "obsolete", reason: "transaction-terminal" } as const;
      }
      const { kind: _kind, ...transactionValue } = current;
      const conflict = automationTransactionSchema.parse({
        ...transactionValue,
        status: "conflict",
        updatedAt: Math.max(current.updatedAt, Date.now()),
      });
      await db.automationTransactions.put({ kind: "transaction", ...conflict });
      assertContext(accountBoundaryGeneration, accountSessionGeneration, vaultKey, vaultRevision);
      return { status: "obsolete", reason: "server-rejected" } as const;
    });
  });
}

async function processQueuedAutomationUndoWithServerOperationLockHeld(
  rawIntent: unknown,
  expectedOwnerUserId: string
): Promise<QueuedAutomationUndoOutcome> {
  const parsedIntent = automationUndoQueueIntentSchema.safeParse(rawIntent);
  if (!parsedIntent.success) {
    throw new AutomationUndoError("AUTOMATION_UNDO_INVALID_INTENT");
  }
  const intent: AutomationUndoQueueIntent = parsedIntent.data;
  const accountBoundaryGeneration = captureOriginAccountBoundaryGeneration();
  const accountSessionGeneration = captureAccountSessionTransitionGeneration();
  const { vaultKey, vaultRevision } = requireVaultContext();
  await requireOwner(expectedOwnerUserId);
  assertContext(accountBoundaryGeneration, accountSessionGeneration, vaultKey, vaultRevision);

  const stored = await db.automationTransactions.get(intent.transactionId);
  if (stored === undefined) {
    return { status: "obsolete", reason: "transaction-missing" };
  }
  const transaction = parseStoredTransaction(stored);
  if (transaction.ownerUserId !== expectedOwnerUserId) {
    throw new AutomationUndoError("AUTOMATION_UNDO_OWNER_UNAVAILABLE");
  }
  if (transaction.status === "undone") return { status: "committed" };
  if (transaction.status !== "undo_pending") {
    return { status: "obsolete", reason: "transaction-terminal" };
  }

  const revision = await decryptAutomationRevision(transaction.revisionCiphertext, vaultKey, {
    schemaVersion: transaction.schemaVersion,
    transactionId: transaction.id,
    ownerUserId: transaction.ownerUserId,
    consentEpoch: transaction.consentEpoch,
    sourceKey: transaction.sourceKey,
    sourceType: transaction.sourceType,
    sourceId: transaction.sourceId,
    ruleId: transaction.ruleId,
    ruleVersion: transaction.ruleVersion,
  });
  const compensatingMutations = buildAutomationCompensatingMutations(revision, intent.operationId);
  assertContext(accountBoundaryGeneration, accountSessionGeneration, vaultKey, vaultRevision);
  const request = automationUndoRequestSchema.parse({
    schemaVersion: 1,
    operationId: intent.operationId,
    transactionId: intent.transactionId,
    expectedServerSequence: intent.expectedServerSequence,
    expectedHistoryGeneration: intent.expectedHistoryGeneration,
    deviceId: intent.deviceId,
    compensatingMutations,
    requestedAt: Date.now(),
  });
  const result = await undoAutomationTransaction(request, expectedOwnerUserId);
  await requireOwner(expectedOwnerUserId);
  assertContext(accountBoundaryGeneration, accountSessionGeneration, vaultKey, vaultRevision);
  if ("undoTransactionId" in result) {
    if (result.code === "UNDONE" && result.undoTransactionId !== intent.operationId) {
      throw new AutomationUndoError("AUTOMATION_UNDO_CANONICAL_MISMATCH");
    }
    const canonicalCompensatingMutations =
      result.undoTransactionId === intent.operationId
        ? compensatingMutations
        : buildAutomationCompensatingMutations(revision, result.undoTransactionId);
    return applyAcceptedUndo(
      transaction,
      revision,
      canonicalCompensatingMutations,
      result,
      expectedOwnerUserId,
      accountBoundaryGeneration,
      accountSessionGeneration,
      vaultKey,
      vaultRevision
    );
  }
  return markRejectedUndo(
    transaction.id,
    result,
    expectedOwnerUserId,
    accountBoundaryGeneration,
    accountSessionGeneration,
    vaultKey,
    vaultRevision
  );
}

export function processQueuedAutomationUndo(
  rawIntent: unknown,
  expectedOwnerUserId: string
): Promise<QueuedAutomationUndoOutcome> {
  return runWithOriginExclusiveLock(AUTOMATION_SERVER_OPERATION_LOCK, () =>
    processQueuedAutomationUndoWithServerOperationLockHeld(rawIntent, expectedOwnerUserId)
  );
}

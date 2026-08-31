import Dexie from "dexie";

import {
  getJournalContentVaultKey,
  getJournalContentVaultRevision,
} from "@/features/journal/journalContentSession";
import { runWithJournalSecurityWriteLock } from "@/features/journal/journalSecurityWriteLock";
import { offlineQueue } from "@/lib/offlineQueue";
import { logger } from "@/lib/logger";
import { runWithOriginExclusiveLock } from "@/lib/originExclusiveLock";
import { broadcastChange } from "@/lib/syncBroadcast";
import { ACCOUNT_BOUNDARY_DATA_WRITE_LOCK } from "@/storage/accountBoundaryRuntime";
import { db, getLocalDataOwnerId } from "@/storage/db";
import { validateSyncOwner } from "@/storage/sync/syncOwner";
import { purgeAutomationHistory } from "./automationCloud";
import { AUTOMATION_SERVER_OPERATION_LOCK } from "./automationOperationLock";
import { mergeAutomationPreference } from "./automationPreferences";
import {
  compensateUnacceptedAutomationTransactionInCurrentTransaction,
  parseStoredRevision,
  parseStoredTransaction,
} from "./automationRepository";
import { decryptAutomationRevision } from "./revisionCrypto";
import {
  AUTOMATION_PREFERENCE_SETTING_KEY,
  automationHistoryMarkerSchema,
  automationHistoryPurgePendingRowSchema,
  automationHistoryPurgeRequestSchema,
  automationHistoryPurgeResultSchema,
  automationPreferenceSchema,
  automationRecordRevisionStoreRowSchema,
  type AutomationHistoryMarker,
  type AutomationHistoryPurgePendingRow,
  type AutomationHistoryPurgeResult,
  type AutomationRecordRevisionStoreRow,
  type AutomationRevisionEnvelope,
  type AutomationTransactionStoreRow,
} from "./types";

export type AutomationHistoryClearErrorCode =
  | "AUTOMATION_HISTORY_CLEAR_INVALID"
  | "AUTOMATION_HISTORY_CLEAR_OWNER_UNAVAILABLE"
  | "AUTOMATION_HISTORY_CLEAR_VAULT_LOCKED"
  | "AUTOMATION_HISTORY_CLEAR_NOT_FOUND"
  | "AUTOMATION_HISTORY_CLEAR_CANONICAL_MISMATCH";

export class AutomationHistoryClearError extends Error {
  readonly code: AutomationHistoryClearErrorCode;

  constructor(code: AutomationHistoryClearErrorCode) {
    super(code);
    this.name = "AutomationHistoryClearError";
    this.code = code;
  }
}

interface VaultContext {
  key: string;
  revision: number;
}

function requireVault(): VaultContext {
  const key = getJournalContentVaultKey();
  const revision = getJournalContentVaultRevision();
  if (!key || revision === null) {
    throw new AutomationHistoryClearError("AUTOMATION_HISTORY_CLEAR_VAULT_LOCKED");
  }
  return { key, revision };
}

function assertVault(context: VaultContext): void {
  if (
    getJournalContentVaultKey() !== context.key ||
    getJournalContentVaultRevision() !== context.revision
  ) {
    throw new AutomationHistoryClearError("AUTOMATION_HISTORY_CLEAR_VAULT_LOCKED");
  }
}

async function requireOwner(expectedOwnerUserId: string): Promise<void> {
  const ownerUserId = await validateSyncOwner(expectedOwnerUserId, "Automation history clear");
  const localOwnerUserId = await getLocalDataOwnerId();
  if (ownerUserId !== expectedOwnerUserId || localOwnerUserId !== expectedOwnerUserId) {
    throw new AutomationHistoryClearError("AUTOMATION_HISTORY_CLEAR_OWNER_UNAVAILABLE");
  }
}

function transactionRows(values: unknown[], ownerUserId: string): AutomationTransactionStoreRow[] {
  const rows: AutomationTransactionStoreRow[] = [];
  for (const value of values) {
    if (
      !value ||
      typeof value !== "object" ||
      (value as { kind?: unknown }).kind !== "transaction"
    ) {
      continue;
    }
    const row = parseStoredTransaction(value);
    if (row.ownerUserId !== ownerUserId) {
      throw new AutomationHistoryClearError("AUTOMATION_HISTORY_CLEAR_OWNER_UNAVAILABLE");
    }
    rows.push(row);
  }
  return rows;
}

async function authenticateTransactions(
  transactions: readonly AutomationTransactionStoreRow[],
  context: VaultContext
): Promise<Map<string, AutomationRevisionEnvelope>> {
  const revisions = new Map<string, AutomationRevisionEnvelope>();
  for (const transaction of transactions) {
    assertVault(context);
    const revision = await decryptAutomationRevision(transaction.revisionCiphertext, context.key, {
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
    revisions.set(transaction.id, revision);
  }
  assertVault(context);
  return revisions;
}

function sameIds(left: readonly string[], right: readonly string[]): boolean {
  if (left.length !== right.length) return false;
  const sortedLeft = [...left].sort();
  const sortedRight = [...right].sort();
  return sortedLeft.every((id, index) => id === sortedRight[index]);
}

function assertCanonicalResult(
  result: AutomationHistoryPurgeResult,
  operationId: string,
  requestedIds: readonly string[],
  all: boolean,
  marker: AutomationHistoryMarker
): void {
  if (result.operationId !== operationId) {
    throw new AutomationHistoryClearError("AUTOMATION_HISTORY_CLEAR_CANONICAL_MISMATCH");
  }
  const markerAlreadyReflectsResult = all
    ? marker.historyGeneration >= result.historyGeneration &&
      marker.allHistoryPurgedAt !== undefined &&
      result.allHistoryPurgedAt !== null &&
      marker.allHistoryPurgedAt >= result.allHistoryPurgedAt
    : marker.historyGeneration === result.historyGeneration &&
      requestedIds.every((id) => marker.purgedTransactionIds?.includes(id));
  if (result.serverSequence <= marker.lastAppliedServerSequence && !markerAlreadyReflectsResult) {
    throw new AutomationHistoryClearError("AUTOMATION_HISTORY_CLEAR_CANONICAL_MISMATCH");
  }
  if (all) {
    if (
      (!markerAlreadyReflectsResult && result.historyGeneration <= marker.historyGeneration) ||
      result.allHistoryPurgedAt === null ||
      result.preference === null
    ) {
      throw new AutomationHistoryClearError("AUTOMATION_HISTORY_CLEAR_CANONICAL_MISMATCH");
    }
    return;
  }
  if (
    result.historyGeneration !== marker.historyGeneration ||
    result.allHistoryPurgedAt !== null ||
    result.preference !== null ||
    !sameIds(result.purgedTransactionIds, requestedIds)
  ) {
    throw new AutomationHistoryClearError("AUTOMATION_HISTORY_CLEAR_CANONICAL_MISMATCH");
  }
}

async function reconcileAcceptedPurge(
  result: AutomationHistoryPurgeResult,
  receipt: AutomationHistoryPurgePendingRow,
  expectedOwnerUserId: string,
  context: VaultContext,
  authenticatedRevisions: ReadonlyMap<string, AutomationRevisionEnvelope>
): Promise<boolean> {
  const { operationId, transactionIds: requestedIds, all } = receipt;
  assertVault(context);
  await requireOwner(expectedOwnerUserId);

  return db.transaction(
    "rw",
    [
      db.settings,
      db.moods,
      db.habits,
      db.journalEntries,
      db.deadLetterQueue,
      db.automationTransactions,
      db.automationHistoryMarkers,
      db.automationRemoteEvents,
    ],
    async () => {
      await Dexie.waitFor(requireOwner(expectedOwnerUserId));
      assertVault(context);
      const markerValue = await db.automationHistoryMarkers.get(expectedOwnerUserId);
      if (!markerValue) {
        throw new AutomationHistoryClearError("AUTOMATION_HISTORY_CLEAR_CANONICAL_MISMATCH");
      }
      const marker = automationHistoryMarkerSchema.parse(markerValue);
      assertCanonicalResult(result, operationId, requestedIds, all, marker);
      const sequenceContiguous =
        result.serverSequence <= marker.lastAppliedServerSequence ||
        result.serverSequence === marker.lastAppliedServerSequence + 1;

      let ownerRows = await db.automationTransactions
        .where("ownerUserId")
        .equals(expectedOwnerUserId)
        .toArray();
      const transactions = transactionRows(ownerRows, expectedOwnerUserId);
      const requestedSet = new Set(requestedIds);
      const capturedTransactionIds = new Set(receipt.capturedTransactionIds);
      const capturedSourceIntentIds = new Set(receipt.capturedSourceIntentIds);
      const selectedTransactions = transactions.filter((transaction) =>
        capturedTransactionIds.has(transaction.id)
      );
      const serverPurgedTransactionIds = new Set(result.purgedTransactionIds);
      for (const transaction of selectedTransactions) {
        if (
          transaction.status !== "commit_pending" ||
          serverPurgedTransactionIds.has(transaction.id)
        ) {
          continue;
        }
        const revision = authenticatedRevisions.get(transaction.id);
        if (!revision) {
          throw new AutomationHistoryClearError("AUTOMATION_HISTORY_CLEAR_CANONICAL_MISMATCH");
        }
        await compensateUnacceptedAutomationTransactionInCurrentTransaction(
          transaction,
          revision,
          expectedOwnerUserId,
          result.completedAt
        );
      }
      ownerRows = await db.automationTransactions
        .where("ownerUserId")
        .equals(expectedOwnerUserId)
        .toArray();
      const ownershipIds = new Set<string>([
        ...result.purgedTransactionIds,
        ...receipt.capturedTransactionIds,
      ]);
      for (const transaction of selectedTransactions) {
        ownershipIds.add(transaction.id);
        if (transaction.undoTransactionId) ownershipIds.add(transaction.undoTransactionId);
      }

      const detachedRevisions: AutomationRecordRevisionStoreRow[] = [];
      for (const value of ownerRows) {
        if (value.kind !== "record_revision") continue;
        const revision = parseStoredRevision(value);
        if (revision && revision.transactionId && ownershipIds.has(revision.transactionId)) {
          detachedRevisions.push(
            automationRecordRevisionStoreRowSchema.parse({
              ...revision,
              transactionId: null,
              updatedAt: Math.max(revision.updatedAt, result.completedAt),
            })
          );
        }
      }
      if (detachedRevisions.length > 0) {
        await db.automationTransactions.bulkPut(detachedRevisions);
      }

      const removableRowIds = ownerRows
        .filter(
          (row) =>
            (row.kind === "source_pending" && capturedSourceIntentIds.has(row.id)) ||
            (row.kind === "transaction" && capturedTransactionIds.has(row.id))
        )
        .map((row) => row.id);
      if (removableRowIds.length > 0) {
        await db.automationTransactions.bulkDelete(removableRowIds);
      }

      const remoteRows = await db.automationRemoteEvents
        .where("ownerUserId")
        .equals(expectedOwnerUserId)
        .toArray();
      const removableRemoteIds = remoteRows
        .filter((row) => {
          if (!sequenceContiguous && row.serverSequence > marker.lastAppliedServerSequence) {
            return false;
          }
          return (
            (all &&
              (row.historyGeneration < result.historyGeneration ||
                row.serverSequence <= result.serverSequence)) ||
            (!all &&
              row.deliveryKind !== "purge" &&
              row.serverSequence <= result.serverSequence &&
              requestedSet.has(row.transactionId))
          );
        })
        .map((row) => row.id);
      if (removableRemoteIds.length > 0) {
        await db.automationRemoteEvents.bulkDelete(removableRemoteIds);
      }

      const deadLetters = await db.deadLetterQueue.toArray();
      const removableDeadLetterIds = deadLetters
        .filter(
          (row) =>
            (row.type === "COMMIT_AUTOMATION_TRANSACTION" ||
              row.type === "UNDO_AUTOMATION_TRANSACTION") &&
            capturedTransactionIds.has(row.entityId)
        )
        .map((row) => row.id);
      if (removableDeadLetterIds.length > 0) {
        await db.deadLetterQueue.bulkDelete(removableDeadLetterIds);
      }

      if (all && result.preference) {
        const currentPreferenceRow = await db.settings.get(AUTOMATION_PREFERENCE_SETTING_KEY);
        const currentPreference = automationPreferenceSchema.safeParse(currentPreferenceRow?.value);
        const preference = currentPreference.success
          ? mergeAutomationPreference(currentPreference.data, result.preference)
          : result.preference;
        await db.settings.put({
          key: AUTOMATION_PREFERENCE_SETTING_KEY,
          value: preference,
        });
      }

      if (!sequenceContiguous) {
        const purgedTransactionIds = [
          ...new Set([...(marker.purgedTransactionIds ?? []), ...result.purgedTransactionIds]),
        ].sort();
        await db.automationHistoryMarkers.put(
          automationHistoryMarkerSchema.parse({
            ...marker,
            ...(purgedTransactionIds.length > 0 ? { purgedTransactionIds } : {}),
            updatedAt: Math.max(marker.updatedAt, result.completedAt),
          })
        );
      } else if (result.historyGeneration > marker.historyGeneration) {
        await db.automationHistoryMarkers.put(
          automationHistoryMarkerSchema.parse({
            schemaVersion: 1,
            ownerUserId: expectedOwnerUserId,
            historyGeneration: result.historyGeneration,
            snapshotSequence: Math.max(marker.snapshotSequence, result.serverSequence),
            lastAppliedServerSequence: Math.max(
              marker.lastAppliedServerSequence,
              result.serverSequence
            ),
            bootstrapCompletedAt: marker.bootstrapCompletedAt,
            ...(result.allHistoryPurgedAt !== null
              ? { allHistoryPurgedAt: result.allHistoryPurgedAt }
              : {}),
            updatedAt: Math.max(marker.updatedAt, result.completedAt),
          })
        );
      } else if (
        result.historyGeneration === marker.historyGeneration &&
        result.serverSequence > marker.lastAppliedServerSequence
      ) {
        const purgedTransactionIds = all
          ? undefined
          : [
              ...new Set([...(marker.purgedTransactionIds ?? []), ...result.purgedTransactionIds]),
            ].sort();
        await db.automationHistoryMarkers.put(
          automationHistoryMarkerSchema.parse({
            ...marker,
            snapshotSequence: Math.max(marker.snapshotSequence, result.serverSequence),
            lastAppliedServerSequence: result.serverSequence,
            ...(purgedTransactionIds ? { purgedTransactionIds } : {}),
            ...(result.allHistoryPurgedAt !== null
              ? {
                  allHistoryPurgedAt: Math.max(
                    marker.allHistoryPurgedAt ?? 0,
                    result.allHistoryPurgedAt
                  ),
                }
              : {}),
            updatedAt: Math.max(marker.updatedAt, result.completedAt),
          })
        );
      }
      if (sequenceContiguous) {
        await db.automationTransactions.delete(receipt.id);
      }
      assertVault(context);
      await Dexie.waitFor(requireOwner(expectedOwnerUserId));
      return sequenceContiguous;
    }
  );
}

async function clearAutomationHistory(
  transactionIds: readonly string[],
  all: boolean,
  expectedOwnerUserId: string,
  deviceId: string
): Promise<{ purged: number; all: boolean }> {
  const operationId = globalThis.crypto.randomUUID();
  const request = automationHistoryPurgeRequestSchema.safeParse({
    operationId,
    transactionIds,
    all,
    deviceId,
  });
  if (!request.success) {
    throw new AutomationHistoryClearError("AUTOMATION_HISTORY_CLEAR_INVALID");
  }
  await requireOwner(expectedOwnerUserId);
  const context = requireVault();

  const accepted = await runWithOriginExclusiveLock(AUTOMATION_SERVER_OPERATION_LOCK, () =>
    runWithOriginExclusiveLock(ACCOUNT_BOUNDARY_DATA_WRITE_LOCK, async () => {
      const acceptedResult = await runWithJournalSecurityWriteLock(async () => {
        await requireOwner(expectedOwnerUserId);
        assertVault(context);
        const markerValue = await db.automationHistoryMarkers.get(expectedOwnerUserId);
        if (!markerValue) {
          throw new AutomationHistoryClearError("AUTOMATION_HISTORY_CLEAR_CANONICAL_MISMATCH");
        }
        const marker = automationHistoryMarkerSchema.parse(markerValue);
        const rows = await db.automationTransactions
          .where("ownerUserId")
          .equals(expectedOwnerUserId)
          .toArray();
        const transactions = transactionRows(rows, expectedOwnerUserId);
        const requestedSet = new Set(transactionIds);
        const selectedTransactions = all
          ? transactions
          : transactions.filter((transaction) => requestedSet.has(transaction.id));
        const capturedTransactionIds = selectedTransactions.map((transaction) => transaction.id);
        const capturedSourceIntentIds = all
          ? rows.filter((row) => row.kind === "source_pending").map((row) => row.id)
          : [];
        if (!all && selectedTransactions.length !== transactionIds.length) {
          throw new AutomationHistoryClearError("AUTOMATION_HISTORY_CLEAR_NOT_FOUND");
        }
        const authenticatedRevisions = await authenticateTransactions(
          selectedTransactions,
          context
        );
        await requireOwner(expectedOwnerUserId);
        assertVault(context);

        const now = Date.now();
        const receipt = automationHistoryPurgePendingRowSchema.parse({
          kind: "purge_pending",
          id: `automation-purge:${operationId}`,
          schemaVersion: 1,
          operationId,
          ownerUserId: expectedOwnerUserId,
          transactionIds: request.data.transactionIds,
          capturedTransactionIds,
          capturedSourceIntentIds,
          all: request.data.all,
          deviceId: request.data.deviceId,
          createdAt: now,
          updatedAt: now,
        });
        await db.automationTransactions.put(receipt);

        const rawResult = await purgeAutomationHistory(request.data, expectedOwnerUserId);
        const result = automationHistoryPurgeResultSchema.safeParse(rawResult);
        if (!result.success) {
          throw new AutomationHistoryClearError("AUTOMATION_HISTORY_CLEAR_CANONICAL_MISMATCH");
        }
        const acceptedReceipt = automationHistoryPurgePendingRowSchema.parse({
          ...receipt,
          acceptedResult: result.data,
          updatedAt: Math.max(receipt.updatedAt, result.data.completedAt),
        });
        await db.automationTransactions.put(acceptedReceipt);
        await requireOwner(expectedOwnerUserId);
        assertVault(context);
        assertCanonicalResult(result.data, operationId, transactionIds, all, marker);
        return { result: result.data, receipt: acceptedReceipt, authenticatedRevisions };
      });

      await offlineQueue.discardAutomationHistoryActions(
        expectedOwnerUserId,
        acceptedResult.receipt.capturedTransactionIds,
        { dataWriteLockHeld: true }
      );
      await runWithJournalSecurityWriteLock(async () => {
        assertVault(context);
        await reconcileAcceptedPurge(
          acceptedResult.result,
          acceptedResult.receipt,
          expectedOwnerUserId,
          context,
          acceptedResult.authenticatedRevisions
        );
      });
      return acceptedResult;
    })
  );
  await requireOwner(expectedOwnerUserId);
  assertVault(context);
  broadcastChange("automation", accepted.result.serverSequence);
  return { purged: accepted.result.purgedTransactionIds.length, all };
}

function pendingPurgeRows(
  values: unknown[],
  ownerUserId: string
): AutomationHistoryPurgePendingRow[] {
  const rows: AutomationHistoryPurgePendingRow[] = [];
  for (const value of values) {
    if (
      !value ||
      typeof value !== "object" ||
      (value as { kind?: unknown }).kind !== "purge_pending"
    ) {
      continue;
    }
    const parsed = automationHistoryPurgePendingRowSchema.safeParse(value);
    if (!parsed.success || parsed.data.ownerUserId !== ownerUserId) {
      throw new AutomationHistoryClearError("AUTOMATION_HISTORY_CLEAR_OWNER_UNAVAILABLE");
    }
    rows.push(parsed.data);
  }
  return rows.sort(
    (left, right) =>
      left.createdAt - right.createdAt || left.operationId.localeCompare(right.operationId)
  );
}

async function discardSubsumedAcceptedPurge(
  receipt: AutomationHistoryPurgePendingRow,
  expectedOwnerUserId: string
): Promise<boolean> {
  if (receipt.acceptedResult === undefined) return false;
  return db.transaction(
    "rw",
    [db.settings, db.automationTransactions, db.automationHistoryMarkers],
    async () => {
      await Dexie.waitFor(requireOwner(expectedOwnerUserId));
      const markerValue = await db.automationHistoryMarkers.get(expectedOwnerUserId);
      if (!markerValue) return false;
      const marker = automationHistoryMarkerSchema.parse(markerValue);
      const subsumedByAllHistoryPurge =
        marker.allHistoryPurgedAt !== undefined &&
        receipt.acceptedResult !== undefined &&
        receipt.acceptedResult.historyGeneration < marker.historyGeneration;
      if (!subsumedByAllHistoryPurge) return false;
      await db.automationTransactions.delete(receipt.id);
      await Dexie.waitFor(requireOwner(expectedOwnerUserId));
      return true;
    }
  );
}

export async function reconcilePendingAutomationHistoryPurges(
  expectedOwnerUserId: string
): Promise<{ reconciled: number; deferred: number }> {
  await requireOwner(expectedOwnerUserId);
  const receipts = pendingPurgeRows(
    await db.automationTransactions.where("ownerUserId").equals(expectedOwnerUserId).toArray(),
    expectedOwnerUserId
  );
  if (receipts.length === 0) return { reconciled: 0, deferred: 0 };

  let reconciled = 0;
  const activeReceipts: AutomationHistoryPurgePendingRow[] = [];
  for (const receipt of receipts) {
    if (await discardSubsumedAcceptedPurge(receipt, expectedOwnerUserId)) {
      reconciled += 1;
    } else {
      activeReceipts.push(receipt);
    }
  }
  if (activeReceipts.length === 0) return { reconciled, deferred: 0 };

  let context: VaultContext;
  try {
    context = requireVault();
  } catch (error) {
    if (
      error instanceof AutomationHistoryClearError &&
      error.code === "AUTOMATION_HISTORY_CLEAR_VAULT_LOCKED"
    ) {
      return { reconciled, deferred: activeReceipts.length };
    }
    throw error;
  }

  let deferred = 0;
  for (const receipt of activeReceipts) {
    try {
      const result = await runWithOriginExclusiveLock(AUTOMATION_SERVER_OPERATION_LOCK, () =>
        runWithOriginExclusiveLock(ACCOUNT_BOUNDARY_DATA_WRITE_LOCK, async () => {
          const acceptedResult = await runWithJournalSecurityWriteLock(async () => {
            await requireOwner(expectedOwnerUserId);
            assertVault(context);
            const markerValue = await db.automationHistoryMarkers.get(expectedOwnerUserId);
            if (!markerValue) {
              throw new AutomationHistoryClearError("AUTOMATION_HISTORY_CLEAR_CANONICAL_MISMATCH");
            }
            const marker = automationHistoryMarkerSchema.parse(markerValue);
            const transactions = transactionRows(
              await db.automationTransactions
                .where("ownerUserId")
                .equals(expectedOwnerUserId)
                .toArray(),
              expectedOwnerUserId
            );
            const captured = new Set(receipt.capturedTransactionIds);
            const authenticatedRevisions = await authenticateTransactions(
              transactions.filter((transaction) => captured.has(transaction.id)),
              context
            );
            const rawResult =
              receipt.acceptedResult ??
              (await purgeAutomationHistory(
                {
                  operationId: receipt.operationId,
                  transactionIds: receipt.transactionIds,
                  all: receipt.all,
                  deviceId: receipt.deviceId,
                },
                expectedOwnerUserId
              ));
            const parsed = automationHistoryPurgeResultSchema.safeParse(rawResult);
            if (!parsed.success) {
              throw new AutomationHistoryClearError("AUTOMATION_HISTORY_CLEAR_CANONICAL_MISMATCH");
            }
            if (receipt.acceptedResult === undefined) {
              await db.automationTransactions.put(
                automationHistoryPurgePendingRowSchema.parse({
                  ...receipt,
                  acceptedResult: parsed.data,
                  updatedAt: Math.max(receipt.updatedAt, parsed.data.completedAt),
                })
              );
            }
            assertCanonicalResult(
              parsed.data,
              receipt.operationId,
              receipt.transactionIds,
              receipt.all,
              marker
            );
            return { result: parsed.data, authenticatedRevisions };
          });

          await offlineQueue.discardAutomationHistoryActions(
            expectedOwnerUserId,
            receipt.capturedTransactionIds,
            { dataWriteLockHeld: true }
          );
          const finalized = await runWithJournalSecurityWriteLock(() =>
            reconcileAcceptedPurge(
              acceptedResult.result,
              receipt,
              expectedOwnerUserId,
              context,
              acceptedResult.authenticatedRevisions
            )
          );
          return { result: acceptedResult.result, finalized };
        })
      );
      if (!result.finalized) {
        deferred += 1;
        continue;
      }
      broadcastChange("automation", result.result.serverSequence);
      reconciled += 1;
    } catch {
      deferred += 1;
      logger.warn("[AutomationHistory][AUTOMATION_HISTORY_PURGE_RETRY_DEFERRED]");
    }
  }
  return { reconciled, deferred };
}

export function forgetAutomationTransactions(
  transactionIds: readonly string[],
  expectedOwnerUserId: string,
  deviceId: string
): Promise<{ purged: number; all: false }> {
  return clearAutomationHistory(transactionIds, false, expectedOwnerUserId, deviceId) as Promise<{
    purged: number;
    all: false;
  }>;
}

export function clearAllAutomationHistory(
  expectedOwnerUserId: string,
  deviceId: string
): Promise<{ purged: number; all: true }> {
  return clearAutomationHistory([], true, expectedOwnerUserId, deviceId) as Promise<{
    purged: number;
    all: true;
  }>;
}

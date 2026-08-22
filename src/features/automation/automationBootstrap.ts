import Dexie from "dexie";

import { runWithJournalSecurityWriteLock } from "@/features/journal/journalSecurityWriteLock";
import { db, getLocalDataOwnerId } from "@/storage/db";
import { validateSyncOwner } from "@/storage/sync/syncOwner";
import { fetchAutomationHistorySnapshot } from "./automationCloud";
import { reconcilePendingAutomationHistoryPurges } from "./automationHistoryClear";
import {
  parseStoredRevision,
  readLocalProjection,
  recordRevisionId,
} from "./automationRepository";
import {
  reconcileAutomationRemoteEventsInCurrentTransaction,
  reconcilePendingAutomationEvents,
} from "./automationRemoteSync";
import { hashAutomationValue } from "./canonicalJson";
import {
  AUTOMATION_REMOTE_EVENT_LIMIT,
  automationHistoryMarkerSchema,
  automationHistorySnapshotSchema,
  automationRecordRevisionStoreRowSchema,
  automationRemoteEventSchema,
  type AutomationHistorySnapshot,
  type AutomationHistorySnapshotRecordRevision,
  type AutomationRecordRevisionStoreRow,
  type AutomationRemoteEvent,
} from "./types";

export type AutomationBootstrapErrorCode =
  | "AUTOMATION_BOOTSTRAP_INVALID"
  | "AUTOMATION_BOOTSTRAP_OWNER_UNAVAILABLE"
  | "AUTOMATION_BOOTSTRAP_STALE"
  | "AUTOMATION_BOOTSTRAP_TARGET_MISMATCH"
  | "AUTOMATION_BOOTSTRAP_CAPACITY";

export class AutomationBootstrapError extends Error {
  readonly code: AutomationBootstrapErrorCode;

  constructor(code: AutomationBootstrapErrorCode) {
    super(code);
    this.name = "AutomationBootstrapError";
    this.code = code;
  }
}

export interface AutomationBootstrapResult {
  status: "accepted";
  deferred: number;
  lastAppliedServerSequence: number;
}

async function requireOwner(expectedOwnerUserId: string): Promise<void> {
  const ownerUserId = await validateSyncOwner(
    expectedOwnerUserId,
    "Automation history bootstrap",
  );
  const localOwnerUserId = await getLocalDataOwnerId();
  if (ownerUserId !== expectedOwnerUserId || localOwnerUserId !== expectedOwnerUserId) {
    throw new AutomationBootstrapError("AUTOMATION_BOOTSTRAP_OWNER_UNAVAILABLE");
  }
}

function revisionRowsMatch(
  existing: AutomationRecordRevisionStoreRow,
  incoming: AutomationHistorySnapshotRecordRevision,
  tombstonedTransactionIds: ReadonlySet<string>,
  allowAllHistoryDetachment: boolean,
): boolean {
  const exactMatch =
    existing.entityType === incoming.entityType &&
    existing.entityId === incoming.entityId &&
    existing.recordExists === incoming.recordExists &&
    existing.revisionToken === incoming.revisionToken &&
    existing.stateHash === incoming.stateHash &&
    existing.mutationGeneration === incoming.mutationGeneration &&
    existing.transactionId === incoming.transactionId &&
    existing.updatedAt === incoming.updatedAt;
  if (exactMatch) return true;

  return (
    existing.entityType === incoming.entityType &&
    existing.entityId === incoming.entityId &&
    existing.recordExists === incoming.recordExists &&
    existing.revisionToken === incoming.revisionToken &&
    existing.stateHash === incoming.stateHash &&
    existing.mutationGeneration === incoming.mutationGeneration &&
    existing.transactionId !== null &&
    incoming.transactionId === null &&
    (allowAllHistoryDetachment || tombstonedTransactionIds.has(existing.transactionId)) &&
    incoming.updatedAt >= existing.updatedAt
  );
}

async function verifyAndBuildRevisionRow(
  revision: AutomationHistorySnapshotRecordRevision,
  ownerUserId: string,
  tombstonedTransactionIds: ReadonlySet<string>,
  allowAllHistoryDetachment: boolean,
): Promise<AutomationRecordRevisionStoreRow> {
  let projection;
  try {
    projection = await readLocalProjection(revision);
  } catch {
    throw new AutomationBootstrapError("AUTOMATION_BOOTSTRAP_TARGET_MISMATCH");
  }
  const projectionHash = await Dexie.waitFor(hashAutomationValue(projection));
  if (
    revision.recordExists !== (projection !== null) ||
    projectionHash !== revision.stateHash
  ) {
    throw new AutomationBootstrapError("AUTOMATION_BOOTSTRAP_TARGET_MISMATCH");
  }

  const id = recordRevisionId(revision.entityType, revision.entityId);
  const existing = parseStoredRevision(await db.automationTransactions.get(id));
  if (
    existing !== null &&
    !revisionRowsMatch(
      existing,
      revision,
      tombstonedTransactionIds,
      allowAllHistoryDetachment,
    )
  ) {
    throw new AutomationBootstrapError("AUTOMATION_BOOTSTRAP_TARGET_MISMATCH");
  }

  return automationRecordRevisionStoreRowSchema.parse({
    kind: "record_revision",
    id,
    schemaVersion: 1,
    ownerUserId,
    ...revision,
  });
}

function snapshotEvent(
  transaction: AutomationHistorySnapshot["transactions"][number],
  ownerUserId: string,
  receivedAt: number,
): AutomationRemoteEvent {
  return automationRemoteEventSchema.parse({
    id: `automation-snapshot:${transaction.historyGeneration}:${transaction.id}`,
    schemaVersion: 1,
    ownerUserId,
    syncEventId: transaction.id,
    syncEventSequence: transaction.serverSequence,
    transactionId: transaction.id,
    historyGeneration: transaction.historyGeneration,
    serverSequence: transaction.serverSequence,
    deliveryKind: "snapshot",
    transaction,
    receivedAt,
  });
}

export async function applyAutomationHistorySnapshot(
  rawSnapshot: AutomationHistorySnapshot,
  expectedOwnerUserId: string,
  acceptedAt = Date.now(),
): Promise<AutomationBootstrapResult> {
  const parsed = automationHistorySnapshotSchema.safeParse(rawSnapshot);
  if (!parsed.success || !Number.isSafeInteger(acceptedAt) || acceptedAt < 0) {
    throw new AutomationBootstrapError("AUTOMATION_BOOTSTRAP_INVALID");
  }
  const snapshot = parsed.data;

  await requireOwner(expectedOwnerUserId);
  const result = await runWithJournalSecurityWriteLock(async () =>
    db.transaction(
      "rw",
      [
        db.moods,
        db.habits,
        db.settings,
        db.journalEntries,
        db.automationTransactions,
        db.automationHistoryMarkers,
        db.automationRemoteEvents,
      ],
      async () => {
        await Dexie.waitFor(requireOwner(expectedOwnerUserId));
        const markerValue = await db.automationHistoryMarkers.get(expectedOwnerUserId);
        const marker = markerValue
          ? automationHistoryMarkerSchema.parse(markerValue)
          : null;
        if (
          marker &&
          (snapshot.historyGeneration < marker.historyGeneration ||
            (snapshot.historyGeneration === marker.historyGeneration &&
              snapshot.snapshotSequence <
                Math.max(marker.snapshotSequence, marker.lastAppliedServerSequence)))
        ) {
          throw new AutomationBootstrapError("AUTOMATION_BOOTSTRAP_STALE");
        }

        const generationAdvanced =
          marker !== null && snapshot.historyGeneration > marker.historyGeneration;
        const tombstonedTransactionIds = new Set(
          snapshot.tombstones.map((tombstone) => tombstone.transactionId),
        );
        const revisionRows: AutomationRecordRevisionStoreRow[] = [];
        for (const revision of snapshot.recordRevisions) {
          revisionRows.push(
            await verifyAndBuildRevisionRow(
              revision,
              expectedOwnerUserId,
              tombstonedTransactionIds,
              generationAdvanced && snapshot.allHistoryPurgedAt !== undefined,
            ),
          );
        }

        if (generationAdvanced) {
          const resetRows = await db.automationTransactions
            .where("ownerUserId")
            .equals(expectedOwnerUserId)
            .toArray();
          const resetIds = resetRows
            .filter((row) => row.kind !== "purge_pending")
            .map((row) => row.id);
          if (resetIds.length > 0) {
            await db.automationTransactions.bulkDelete(resetIds);
          }
          await db.automationRemoteEvents
            .where("ownerUserId")
            .equals(expectedOwnerUserId)
            .delete();
        }

        const purgedIds = snapshot.tombstones.map((tombstone) => tombstone.transactionId);
        if (purgedIds.length > 0) {
          await db.automationTransactions.bulkDelete(purgedIds);
          const pendingRows = await db.automationRemoteEvents
            .where("ownerUserId")
            .equals(expectedOwnerUserId)
            .toArray();
          const purgedSet = new Set(purgedIds);
          await db.automationRemoteEvents.bulkDelete(
            pendingRows
              .filter(
                (row) =>
                  row.transactionId !== null && purgedSet.has(row.transactionId),
              )
              .map((row) => row.id),
          );
        }

        if (revisionRows.length > 0) {
          await db.automationTransactions.bulkPut(revisionRows);
        }

        const existingRemoteRows = await db.automationRemoteEvents
          .where("ownerUserId")
          .equals(expectedOwnerUserId)
          .toArray();
        const priorSnapshotIds = existingRemoteRows
          .filter((row) => row.deliveryKind === "snapshot")
          .map((row) => row.id);
        if (priorSnapshotIds.length > 0) {
          await db.automationRemoteEvents.bulkDelete(priorSnapshotIds);
        }
        const retainedDeltaCount = existingRemoteRows.length - priorSnapshotIds.length;
        if (retainedDeltaCount + snapshot.transactions.length > AUTOMATION_REMOTE_EVENT_LIMIT) {
          throw new AutomationBootstrapError("AUTOMATION_BOOTSTRAP_CAPACITY");
        }
        const remoteRows = snapshot.transactions.map((transaction) =>
          snapshotEvent(transaction, expectedOwnerUserId, acceptedAt),
        );
        if (remoteRows.length > 0) await db.automationRemoteEvents.bulkPut(remoteRows);

        const lastAppliedServerSequence =
          remoteRows.length === 0
            ? Math.max(marker?.lastAppliedServerSequence ?? 0, snapshot.snapshotSequence)
            : marker?.lastAppliedServerSequence ?? 0;
        const markerUpdatedAt = Math.max(
          acceptedAt,
          marker?.updatedAt ?? 0,
          snapshot.allHistoryPurgedAt ?? 0,
          ...snapshot.tombstones.map((tombstone) => tombstone.purgedAt),
        );
        await db.automationHistoryMarkers.put(
          automationHistoryMarkerSchema.parse({
            schemaVersion: 1,
            ownerUserId: expectedOwnerUserId,
            historyGeneration: snapshot.historyGeneration,
            snapshotSequence: snapshot.snapshotSequence,
            lastAppliedServerSequence,
            bootstrapCompletedAt: marker?.bootstrapCompletedAt ?? acceptedAt,
            ...(purgedIds.length > 0 ? { purgedTransactionIds: purgedIds } : {}),
            ...(snapshot.allHistoryPurgedAt !== undefined
              ? { allHistoryPurgedAt: snapshot.allHistoryPurgedAt }
              : {}),
            updatedAt: markerUpdatedAt,
          }),
        );

        const reconciled = await reconcileAutomationRemoteEventsInCurrentTransaction(
          expectedOwnerUserId,
        );
        await Dexie.waitFor(requireOwner(expectedOwnerUserId));
        return {
          status: "accepted",
          deferred: reconciled.deferred,
          lastAppliedServerSequence: reconciled.lastAppliedServerSequence,
        } as const;
      },
    ),
  );
  await requireOwner(expectedOwnerUserId);
  return result;
}

export async function needsAutomationHistoryBootstrap(
  expectedOwnerUserId: string,
): Promise<boolean> {
  await requireOwner(expectedOwnerUserId);
  const marker = automationHistoryMarkerSchema.safeParse(
    await db.automationHistoryMarkers.get(expectedOwnerUserId),
  );
  await requireOwner(expectedOwnerUserId);
  return !marker.success || marker.data.bootstrapCompletedAt === null;
}

export async function bootstrapAutomationHistoryOnce(
  expectedOwnerUserId: string,
): Promise<AutomationBootstrapResult | null> {
  if (!(await needsAutomationHistoryBootstrap(expectedOwnerUserId))) {
    await reconcilePendingAutomationEvents(expectedOwnerUserId);
    await reconcilePendingAutomationHistoryPurges(expectedOwnerUserId);
    return null;
  }
  const snapshot = await fetchAutomationHistorySnapshot(expectedOwnerUserId);
  const result = await applyAutomationHistorySnapshot(snapshot, expectedOwnerUserId);
  const reconciled = await reconcilePendingAutomationEvents(expectedOwnerUserId);
  await reconcilePendingAutomationHistoryPurges(expectedOwnerUserId);
  const marker = automationHistoryMarkerSchema.parse(
    await db.automationHistoryMarkers.get(expectedOwnerUserId),
  );
  return {
    ...result,
    deferred: reconciled.deferred,
    lastAppliedServerSequence: marker.lastAppliedServerSequence,
  };
}

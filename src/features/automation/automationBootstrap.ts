import Dexie from "dexie";

import { runWithJournalSecurityWriteLock } from "@/features/journal/journalSecurityWriteLock";
import { runWithOriginExclusiveLock } from "@/lib/originExclusiveLock";
import { db, getLocalDataOwnerId } from "@/storage/db";
import { validateSyncOwner } from "@/storage/sync/syncOwner";
import { reconcilePendingAutomationEvents } from "@/storage/eventSync";
import {
  ACCOUNT_BOUNDARY_DATA_WRITE_LOCK,
  assertAccountSessionTransitionGeneration,
  assertOriginAccountBoundaryGeneration,
  captureAccountSessionTransitionGeneration,
  captureOriginAccountBoundaryGeneration,
  type AccountSessionTransitionGeneration,
  type OriginAccountBoundaryGeneration,
} from "@/storage/accountBoundaryRuntime";
import { fetchAutomationHistorySnapshot } from "./automationCloud";
import { reconcilePendingAutomationHistoryPurges } from "./automationHistoryClear";
import { parseStoredRevision, readLocalProjection, recordRevisionId } from "./automationRepository";
import { reconcileAutomationRemoteEventsInCurrentTransaction } from "./automationRemoteSync";
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

interface AutomationBootstrapBoundaryContext {
  readonly accountBoundaryGeneration: OriginAccountBoundaryGeneration;
  readonly sessionGeneration: AccountSessionTransitionGeneration;
}

function captureBootstrapBoundaryContext(): AutomationBootstrapBoundaryContext {
  return {
    accountBoundaryGeneration: captureOriginAccountBoundaryGeneration(),
    sessionGeneration: captureAccountSessionTransitionGeneration(),
  };
}

async function assertBootstrapBoundaryContext(
  expectedOwnerUserId: string,
  context: AutomationBootstrapBoundaryContext
): Promise<void> {
  assertOriginAccountBoundaryGeneration(context.accountBoundaryGeneration);
  assertAccountSessionTransitionGeneration(context.sessionGeneration);
  await requireOwner(expectedOwnerUserId);
  assertOriginAccountBoundaryGeneration(context.accountBoundaryGeneration);
  assertAccountSessionTransitionGeneration(context.sessionGeneration);
}

async function requireOwner(expectedOwnerUserId: string): Promise<void> {
  const ownerUserId = await validateSyncOwner(expectedOwnerUserId, "Automation history bootstrap");
  const localOwnerUserId = await getLocalDataOwnerId();
  if (ownerUserId !== expectedOwnerUserId || localOwnerUserId !== expectedOwnerUserId) {
    throw new AutomationBootstrapError("AUTOMATION_BOOTSTRAP_OWNER_UNAVAILABLE");
  }
}

async function verifyAndBuildRevisionRow(
  revision: AutomationHistorySnapshotRecordRevision,
  ownerUserId: string
): Promise<AutomationRecordRevisionStoreRow> {
  let projection;
  try {
    projection = await readLocalProjection(revision);
  } catch {
    throw new AutomationBootstrapError("AUTOMATION_BOOTSTRAP_TARGET_MISMATCH");
  }
  const projectionHash = await Dexie.waitFor(hashAutomationValue(projection));
  if (revision.recordExists !== (projection !== null) || projectionHash !== revision.stateHash) {
    throw new AutomationBootstrapError("AUTOMATION_BOOTSTRAP_TARGET_MISMATCH");
  }

  const id = recordRevisionId(revision.entityType, revision.entityId);
  const existing = parseStoredRevision(await db.automationTransactions.get(id));
  if (existing !== null && existing.ownerUserId !== ownerUserId) {
    throw new AutomationBootstrapError("AUTOMATION_BOOTSTRAP_TARGET_MISMATCH");
  }

  // The paged server snapshot is bound to one recordRevisionVersion. Once the
  // current local projection matches its state hash, the authoritative token
  // may replace stale local/manual metadata. A projection mismatch still
  // rejects the entire snapshot transaction.

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
  receivedAt: number
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
  boundaryContext = captureBootstrapBoundaryContext()
): Promise<AutomationBootstrapResult> {
  const parsed = automationHistorySnapshotSchema.safeParse(rawSnapshot);
  if (!parsed.success || !Number.isSafeInteger(acceptedAt) || acceptedAt < 0) {
    throw new AutomationBootstrapError("AUTOMATION_BOOTSTRAP_INVALID");
  }
  const snapshot = parsed.data;

  await assertBootstrapBoundaryContext(expectedOwnerUserId, boundaryContext);
  const result = await runWithOriginExclusiveLock(ACCOUNT_BOUNDARY_DATA_WRITE_LOCK, async () => {
    await assertBootstrapBoundaryContext(expectedOwnerUserId, boundaryContext);
    return runWithJournalSecurityWriteLock(async () =>
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
          await Dexie.waitFor(assertBootstrapBoundaryContext(expectedOwnerUserId, boundaryContext));
          const markerValue = await db.automationHistoryMarkers.get(expectedOwnerUserId);
          const marker = markerValue ? automationHistoryMarkerSchema.parse(markerValue) : null;
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
          const revisionRows: AutomationRecordRevisionStoreRow[] = [];
          for (const revision of snapshot.recordRevisions) {
            revisionRows.push(await verifyAndBuildRevisionRow(revision, expectedOwnerUserId));
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
                .filter((row) => row.transactionId !== null && purgedSet.has(row.transactionId))
                .map((row) => row.id)
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
            snapshotEvent(transaction, expectedOwnerUserId, acceptedAt)
          );
          if (remoteRows.length > 0) await db.automationRemoteEvents.bulkPut(remoteRows);

          const lastAppliedServerSequence =
            remoteRows.length === 0
              ? Math.max(marker?.lastAppliedServerSequence ?? 0, snapshot.snapshotSequence)
              : (marker?.lastAppliedServerSequence ?? 0);
          const markerUpdatedAt = Math.max(
            acceptedAt,
            marker?.updatedAt ?? 0,
            snapshot.allHistoryPurgedAt ?? 0,
            ...snapshot.tombstones.map((tombstone) => tombstone.purgedAt)
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
            })
          );

          const reconciled =
            await reconcileAutomationRemoteEventsInCurrentTransaction(expectedOwnerUserId);
          await Dexie.waitFor(assertBootstrapBoundaryContext(expectedOwnerUserId, boundaryContext));
          return {
            status: "accepted",
            deferred: reconciled.deferred,
            lastAppliedServerSequence: reconciled.lastAppliedServerSequence,
          } as const;
        }
      )
    );
  });
  await assertBootstrapBoundaryContext(expectedOwnerUserId, boundaryContext);
  return result;
}

export async function needsAutomationHistoryBootstrap(
  expectedOwnerUserId: string,
  boundaryContext = captureBootstrapBoundaryContext()
): Promise<boolean> {
  await assertBootstrapBoundaryContext(expectedOwnerUserId, boundaryContext);
  const marker = automationHistoryMarkerSchema.safeParse(
    await db.automationHistoryMarkers.get(expectedOwnerUserId)
  );
  await assertBootstrapBoundaryContext(expectedOwnerUserId, boundaryContext);
  return !marker.success || marker.data.bootstrapCompletedAt === null;
}

export async function bootstrapAutomationHistoryOnce(
  expectedOwnerUserId: string,
  options: { readonly force?: boolean } = {}
): Promise<AutomationBootstrapResult | null> {
  const boundaryContext = captureBootstrapBoundaryContext();
  await assertBootstrapBoundaryContext(expectedOwnerUserId, boundaryContext);
  if (
    !options.force &&
    !(await needsAutomationHistoryBootstrap(expectedOwnerUserId, boundaryContext))
  ) {
    await reconcilePendingAutomationEvents(expectedOwnerUserId);
    await assertBootstrapBoundaryContext(expectedOwnerUserId, boundaryContext);
    await reconcilePendingAutomationHistoryPurges(expectedOwnerUserId);
    await assertBootstrapBoundaryContext(expectedOwnerUserId, boundaryContext);
    return null;
  }
  const snapshot = await fetchAutomationHistorySnapshot(expectedOwnerUserId);
  await assertBootstrapBoundaryContext(expectedOwnerUserId, boundaryContext);
  const result = await applyAutomationHistorySnapshot(
    snapshot,
    expectedOwnerUserId,
    Date.now(),
    boundaryContext
  );
  const reconciled = await reconcilePendingAutomationEvents(expectedOwnerUserId);
  await assertBootstrapBoundaryContext(expectedOwnerUserId, boundaryContext);
  await reconcilePendingAutomationHistoryPurges(expectedOwnerUserId);
  await assertBootstrapBoundaryContext(expectedOwnerUserId, boundaryContext);
  const marker = automationHistoryMarkerSchema.parse(
    await db.automationHistoryMarkers.get(expectedOwnerUserId)
  );
  return {
    ...result,
    deferred: reconciled.deferred,
    lastAppliedServerSequence: marker.lastAppliedServerSequence,
  };
}

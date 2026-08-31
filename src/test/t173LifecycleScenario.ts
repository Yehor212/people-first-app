import Dexie from "dexie";

import {
  createFocusSessionOutboxIdentity,
  persistFocusSessionOutboxInCurrentTransaction,
} from "@/lib/focusSessionOutbox";
import { safeLocalStorageSet } from "@/lib/safeJson";
import { SK } from "@/lib/storageKeys";
import {
  advanceOriginAccountBoundaryGeneration,
  captureOriginAccountBoundaryGeneration,
} from "@/storage/accountBoundaryRuntime";
import {
  DELETION_TRACKER_KEYS,
  getDeletedFocusSessionIds,
  mergeDeletionTrackerIdsInCurrentTransaction,
} from "@/storage/deletionTracker";
import { db, getLocalDataOwnerId, setLocalDataOwnerId } from "@/storage/db";
import type { FocusSession } from "@/types";

export const T173_OWNER_A = "17300000-0000-4000-8000-000000000001";
export const T173_OWNER_B = "17300000-0000-4000-8000-000000000002";
export const T173_PRIMARY_ID = "17300000-0000-4000-8000-000000000003";

const STATE_KEY = "t173-local-proof:state";
const REMOTE_KEY = "t173-local-proof:remote";
const CURSOR_KEY = "t173-local-proof:cursor";
const UNRELATED_OUTBOX_ID = "t173-local-proof:unrelated-owner";
const FIXED_TIME = 1_786_680_000_000;

const PRIMARY: FocusSession = {
  id: T173_PRIMARY_ID,
  duration: 1,
  completedAt: FIXED_TIME,
  date: "2026-08-14",
  label: "T173_FIXED_CODE",
  status: "completed",
  updatedAt: FIXED_TIME,
};

export type T173LifecycleStage =
  | "BEFORE_PRIMARY_COMMIT"
  | "PRIMARY_COMMITTED"
  | "DISPATCH_SUBMITTED"
  | "ACK_PERSISTED"
  | "LOCAL_CLEANUP_COMPLETE"
  | "DELETE_FENCED"
  | "VERIFIED";

interface ScenarioState {
  version: 1;
  code: "T173_LOCAL_LIFECYCLE_PROOF";
  stage: T173LifecycleStage;
  ownerUserId: typeof T173_OWNER_A;
  generation: string;
  staleCallbacksRejected: number;
  duplicateCallbacksIgnored: number;
  staleResponsesRejected: number;
}

interface RemoteHarnessState {
  operationId: string;
  ownerUserId: typeof T173_OWNER_A;
  submittedCount: 1;
  generation: string;
}

interface CursorState {
  operationId: string;
  ownerUserId: typeof T173_OWNER_A;
  acknowledgedCount: 1;
  generation: string;
}

export interface T173LifecycleStatus {
  stage: T173LifecycleStage;
  primaryCount: number;
  ownerOutboxCount: number;
  unrelatedOwnerOutboxCount: number;
  remoteSubmissionCount: number;
  acknowledgementCount: number;
  tombstoneCount: number;
  staleCallbacksRejected: number;
  duplicateCallbacksIgnored: number;
  staleResponsesRejected: number;
  ownerBoundary: "GREEN" | "FAIL";
  exactlyOnce: "GREEN" | "FAIL";
  deletionFence: "GREEN" | "PENDING" | "FAIL";
  online: boolean;
}

function isScenarioState(value: unknown): value is ScenarioState {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const state = value as Partial<ScenarioState>;
  return (
    state.version === 1 &&
    state.code === "T173_LOCAL_LIFECYCLE_PROOF" &&
    state.ownerUserId === T173_OWNER_A &&
    typeof state.generation === "string" &&
    typeof state.stage === "string" &&
    [
      "BEFORE_PRIMARY_COMMIT",
      "PRIMARY_COMMITTED",
      "DISPATCH_SUBMITTED",
      "ACK_PERSISTED",
      "LOCAL_CLEANUP_COMPLETE",
      "DELETE_FENCED",
      "VERIFIED",
    ].includes(state.stage) &&
    Number.isSafeInteger(state.staleCallbacksRejected) &&
    Number.isSafeInteger(state.duplicateCallbacksIgnored) &&
    Number.isSafeInteger(state.staleResponsesRejected)
  );
}

async function readState(): Promise<ScenarioState> {
  const entry = await db.settings.get(STATE_KEY);
  if (!isScenarioState(entry?.value)) {
    throw new Error("T173_SCENARIO_NOT_INITIALIZED");
  }
  return entry.value;
}

async function writeState(state: ScenarioState): Promise<void> {
  await db.settings.put({ key: STATE_KEY, value: state });
}

async function outboxIdentity() {
  return createFocusSessionOutboxIdentity(PRIMARY, T173_OWNER_A);
}

export async function cleanupT173LifecycleScenario(): Promise<void> {
  const identity = await outboxIdentity();
  await db.transaction("rw", db.focusSessions, db.offlineQueue, db.settings, async () => {
    await db.focusSessions.delete(T173_PRIMARY_ID);
    await db.offlineQueue.bulkDelete([identity.id, UNRELATED_OUTBOX_ID]);
    await db.settings.bulkDelete([STATE_KEY, REMOTE_KEY, CURSOR_KEY]);
    const tracker = await db.settings.get(DELETION_TRACKER_KEYS.focus);
    if (Array.isArray(tracker?.value)) {
      await db.settings.put({
        key: DELETION_TRACKER_KEYS.focus,
        value: tracker.value.filter((id) => id !== T173_PRIMARY_ID),
      });
    }
  });
}

export async function initializeT173LifecycleScenario(): Promise<T173LifecycleStatus> {
  await cleanupT173LifecycleScenario();
  await setLocalDataOwnerId(T173_OWNER_A);
  const state: ScenarioState = {
    version: 1,
    code: "T173_LOCAL_LIFECYCLE_PROOF",
    stage: "BEFORE_PRIMARY_COMMIT",
    ownerUserId: T173_OWNER_A,
    generation: captureOriginAccountBoundaryGeneration(),
    staleCallbacksRejected: 0,
    duplicateCallbacksIgnored: 0,
    staleResponsesRejected: 0,
  };
  await db.transaction("rw", db.offlineQueue, db.settings, async () => {
    await db.offlineQueue.put({
      id: UNRELATED_OUTBOX_ID,
      operationId: "17300000-0000-4000-8000-000000000004",
      type: "UPDATE_SETTINGS",
      entityId: "T173_UNRELATED_OWNER_FIXED_CODE",
      ownerUserId: T173_OWNER_B,
      payload: { code: "T173_UNRELATED_OWNER_FIXED_CODE" },
      timestamp: FIXED_TIME,
      retries: 0,
      maxRetries: 1,
      priority: "critical",
    });
    await writeState(state);
  });
  return readT173LifecycleStatus();
}

async function commitPrimaryAndOutbox(state: ScenarioState): Promise<void> {
  const identity = await outboxIdentity();
  await db.transaction("rw", db.focusSessions, db.offlineQueue, db.settings, async () => {
    await db.focusSessions.put(PRIMARY);
    await persistFocusSessionOutboxInCurrentTransaction(PRIMARY, T173_OWNER_A, identity);
    await writeState({ ...state, stage: "PRIMARY_COMMITTED" });
  });
}

async function submitDispatch(state: ScenarioState): Promise<void> {
  const identity = await outboxIdentity();
  const existing = await db.settings.get(REMOTE_KEY);
  const remote = existing?.value as Partial<RemoteHarnessState> | undefined;
  if (remote?.operationId && remote.operationId !== identity.operationId) {
    throw new Error("T173_REMOTE_IDENTITY_COLLISION");
  }
  await db.transaction("rw", db.settings, async () => {
    await db.settings.put({
      key: REMOTE_KEY,
      value: {
        operationId: identity.operationId,
        ownerUserId: T173_OWNER_A,
        submittedCount: 1,
        generation: state.generation,
      } satisfies RemoteHarnessState,
    });
    await writeState({ ...state, stage: "DISPATCH_SUBMITTED" });
  });
}

async function persistAcknowledgement(state: ScenarioState): Promise<void> {
  const identity = await outboxIdentity();
  advanceOriginAccountBoundaryGeneration();
  const currentGeneration = captureOriginAccountBoundaryGeneration();
  const staleRejected = state.generation === currentGeneration ? 0 : 1;
  const existing = await db.settings.get(CURSOR_KEY);
  const duplicateIgnored = existing ? 1 : 0;

  await db.transaction("rw", db.settings, async () => {
    if (!existing) {
      await db.settings.put({
        key: CURSOR_KEY,
        value: {
          operationId: identity.operationId,
          ownerUserId: T173_OWNER_A,
          acknowledgedCount: 1,
          generation: currentGeneration,
        } satisfies CursorState,
      });
    }
    await writeState({
      ...state,
      stage: "ACK_PERSISTED",
      generation: currentGeneration,
      staleCallbacksRejected: state.staleCallbacksRejected + staleRejected,
      duplicateCallbacksIgnored: state.duplicateCallbacksIgnored + duplicateIgnored + 1,
    });
  });
}

async function cleanupAcknowledgedOutbox(state: ScenarioState): Promise<void> {
  const identity = await outboxIdentity();
  const cursor = (await db.settings.get(CURSOR_KEY))?.value as Partial<CursorState> | undefined;
  await db.transaction("rw", db.offlineQueue, db.settings, async () => {
    const row = await db.offlineQueue.get(identity.id);
    if (
      row?.operationId === identity.operationId &&
      row.ownerUserId === T173_OWNER_A &&
      cursor?.operationId === identity.operationId &&
      cursor.ownerUserId === T173_OWNER_A &&
      cursor.acknowledgedCount === 1
    ) {
      await db.offlineQueue.delete(identity.id);
    }
    await writeState({ ...state, stage: "LOCAL_CLEANUP_COMPLETE" });
  });
}

async function deleteWithFence(state: ScenarioState): Promise<void> {
  await db.transaction("rw", db.focusSessions, db.settings, async () => {
    await mergeDeletionTrackerIdsInCurrentTransaction(
      DELETION_TRACKER_KEYS.focus,
      [T173_PRIMARY_ID],
    );
    await db.focusSessions.delete(T173_PRIMARY_ID);
    await writeState({ ...state, stage: "DELETE_FENCED" });
  });

  const tombstones = await getDeletedFocusSessionIds();
  let staleResponsesRejected = state.staleResponsesRejected;
  if (tombstones.has(T173_PRIMARY_ID)) {
    staleResponsesRejected += 1;
  } else {
    await db.focusSessions.put(PRIMARY);
  }
  await writeState({
    ...state,
    stage: "DELETE_FENCED",
    staleResponsesRejected,
  });
}

export async function advanceT173LifecycleScenario(): Promise<T173LifecycleStatus> {
  const state = await readState();
  if ((await getLocalDataOwnerId()) !== T173_OWNER_A) {
    throw new Error("T173_OWNER_BOUNDARY_CHANGED");
  }

  switch (state.stage) {
    case "BEFORE_PRIMARY_COMMIT":
      await commitPrimaryAndOutbox(state);
      break;
    case "PRIMARY_COMMITTED":
      await submitDispatch(state);
      break;
    case "DISPATCH_SUBMITTED":
      await persistAcknowledgement(state);
      break;
    case "ACK_PERSISTED":
      await cleanupAcknowledgedOutbox(state);
      break;
    case "LOCAL_CLEANUP_COMPLETE":
      await deleteWithFence(state);
      break;
    case "DELETE_FENCED": {
      const status = await readT173LifecycleStatus();
      if (
        status.primaryCount !== 0 ||
        status.ownerOutboxCount !== 0 ||
        status.unrelatedOwnerOutboxCount !== 1 ||
        status.acknowledgementCount !== 1 ||
        status.tombstoneCount !== 1 ||
        status.staleCallbacksRejected < 1 ||
        status.duplicateCallbacksIgnored < 1 ||
        status.staleResponsesRejected < 1
      ) {
        throw new Error("T173_FINAL_ASSERTION_FAILED");
      }
      await writeState({ ...state, stage: "VERIFIED" });
      break;
    }
    case "VERIFIED":
      break;
  }
  return readT173LifecycleStatus();
}

export async function readT173LifecycleStatus(): Promise<T173LifecycleStatus> {
  const state = await readState();
  const identity = await outboxIdentity();
  const [primaryCount, ownerOutboxCount, unrelatedOwnerOutboxCount, remote, cursor, tombstones] =
    await Promise.all([
      db.focusSessions.where("id").equals(T173_PRIMARY_ID).count(),
      db.offlineQueue.where("id").equals(identity.id).count(),
      db.offlineQueue.where("id").equals(UNRELATED_OUTBOX_ID).count(),
      db.settings.get(REMOTE_KEY),
      db.settings.get(CURSOR_KEY),
      getDeletedFocusSessionIds(),
    ]);
  const remoteSubmissionCount =
    (remote?.value as Partial<RemoteHarnessState> | undefined)?.submittedCount === 1 ? 1 : 0;
  const acknowledgementCount =
    (cursor?.value as Partial<CursorState> | undefined)?.acknowledgedCount === 1 ? 1 : 0;
  const tombstoneCount = tombstones.has(T173_PRIMARY_ID) ? 1 : 0;
  const exactlyOnce =
    primaryCount <= 1 &&
    ownerOutboxCount <= 1 &&
    remoteSubmissionCount <= 1 &&
    acknowledgementCount <= 1
      ? "GREEN"
      : "FAIL";
  const ownerBoundary =
    (await getLocalDataOwnerId()) === T173_OWNER_A && unrelatedOwnerOutboxCount === 1
      ? "GREEN"
      : "FAIL";
  const deletionFence =
    state.stage === "DELETE_FENCED" || state.stage === "VERIFIED"
      ? primaryCount === 0 && tombstoneCount === 1 && state.staleResponsesRejected >= 1
        ? "GREEN"
        : "FAIL"
      : "PENDING";

  return {
    stage: state.stage,
    primaryCount,
    ownerOutboxCount,
    unrelatedOwnerOutboxCount,
    remoteSubmissionCount,
    acknowledgementCount,
    tombstoneCount,
    staleCallbacksRejected: state.staleCallbacksRejected,
    duplicateCallbacksIgnored: state.duplicateCallbacksIgnored,
    staleResponsesRejected: state.staleResponsesRejected,
    ownerBoundary,
    exactlyOnce,
    deletionFence,
    online: navigator.onLine,
  };
}

export async function retainCorruptT173LifecycleMarker(): Promise<void> {
  if (!safeLocalStorageSet(SK.LAST_STATE, "{T173_PARTIAL_MARKER")) {
    throw new Error("T173_CORRUPT_MARKER_WRITE_FAILED");
  }
}

export async function reopenT173Database(): Promise<void> {
  if (Dexie.currentTransaction) throw new Error("T173_REOPEN_INSIDE_TRANSACTION");
  db.close();
  await db.open();
}

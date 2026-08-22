import { beforeEach, describe, expect, it } from "vitest";

import {
  computeOfflineQueueRetryDelay,
  getOfflineQueueFailureCode,
  orderOfflineQueueActionsForProcessing,
  persistCriticalOfflineActionInCurrentTransaction,
  type OfflineAction,
} from "../offlineQueue";
import { db, type OfflineQueueItem } from "@/storage/db";

const OWNER_ID = "11111111-1111-4111-8111-111111111111";
const TRANSACTION_ID = "22222222-2222-4222-8222-222222222222";

function action(
  id: string,
  timestamp: number,
  priority: OfflineAction["priority"],
): OfflineAction {
  return {
    id,
    operationId: `operation-${id}`,
    type: "UPDATE_SETTINGS",
    entityId: id,
    ownerUserId: OWNER_ID,
    payload: { key: id, value: true },
    timestamp,
    retries: 0,
    maxRetries: 5,
    priority,
  };
}

describe("offline queue critical ordering and atomic capacity", () => {
  beforeEach(async () => {
    await db.open();
    await db.offlineQueue.clear();
  });

  it("drains critical rows first while preserving FIFO within each priority", () => {
    const normalOld = action("normal-old", 10, "normal");
    const criticalNew = action("critical-new", 30, "critical");
    const criticalOld = action("critical-old", 20, "critical");
    const low = action("low", 1, "low");

    expect(
      orderOfflineQueueActionsForProcessing([
        normalOld,
        criticalNew,
        low,
        criticalOld,
      ]).map((row) => row.id),
    ).toEqual(["critical-old", "critical-new", "normal-old", "low"]);
  });

  it("gives an older non-critical row a bounded turn during a critical backlog", () => {
    const criticalRows = Array.from({ length: 17 }, (_, index) =>
      action(`critical-${String(index).padStart(2, "0")}`, 100 + index, "critical"),
    );
    const normal = action("normal-waiting", 1, "normal");

    const orderedIds = orderOfflineQueueActionsForProcessing([
      ...criticalRows,
      normal,
    ]).map((row) => row.id);

    expect(orderedIds.slice(0, 8)).toEqual(
      criticalRows.slice(0, 8).map((row) => row.id),
    );
    expect(orderedIds[8]).toBe("normal-waiting");
    expect(orderedIds.slice(9)).toEqual(
      criticalRows.slice(8).map((row) => row.id),
    );
  });

  it("adds bounded equal jitter to exponential retry delays", () => {
    expect(computeOfflineQueueRetryDelay(1, 0)).toBe(1_000);
    expect(computeOfflineQueueRetryDelay(1, 0.5)).toBe(1_500);
    expect(computeOfflineQueueRetryDelay(1, 1)).toBe(2_000);
    expect(computeOfflineQueueRetryDelay(99, 1)).toBe(60_000);
  });

  it("persists only fixed failure codes when a handler error contains private text", () => {
    const privateCanary = "journal-canary: never persist this sentence";

    expect(getOfflineQueueFailureCode(new Error(privateCanary))).toBe(
      "QUEUE_HANDLER_FAILED",
    );
    expect(
      getOfflineQueueFailureCode(
        Object.assign(new Error(privateCanary), { name: "TimeoutError" }),
      ),
    ).toBe("QUEUE_HANDLER_TIMEOUT");
    expect(JSON.stringify([
      getOfflineQueueFailureCode(new Error(privateCanary)),
      getOfflineQueueFailureCode(privateCanary),
    ])).not.toContain(privateCanary);
  });

  it("persists a stable transaction identity without plaintext payload fields", async () => {
    const queuePayload = {
      schemaVersion: 1,
      transactionId: TRANSACTION_ID,
      expectedPreferenceRevision: 4,
      expectedHistoryGeneration: 2,
      deviceId: "android-install-1",
    };

    await db.transaction("rw", db.offlineQueue, async () => {
      await persistCriticalOfflineActionInCurrentTransaction(
        "COMMIT_AUTOMATION_TRANSACTION",
        TRANSACTION_ID,
        queuePayload,
        OWNER_ID,
        {
          id: `automation-commit:${TRANSACTION_ID}`,
          operationId: TRANSACTION_ID,
        },
      );
    });

    await expect(db.offlineQueue.get(`automation-commit:${TRANSACTION_ID}`)).resolves.toMatchObject({
      operationId: TRANSACTION_ID,
      entityId: TRANSACTION_ID,
      payload: queuePayload,
      priority: "critical",
    });
  });

  it("rejects the critical write inside the caller transaction when capacity is full", async () => {
    const rows: OfflineQueueItem[] = Array.from({ length: 1000 }, (_, index) => ({
      id: `existing-${index}`,
      operationId: `operation-${index}`,
      type: "UPDATE_SETTINGS",
      entityId: `setting-${index}`,
      ownerUserId: OWNER_ID,
      payload: { key: `setting-${index}`, value: true },
      timestamp: index,
      retries: 0,
      maxRetries: 5,
      priority: "normal",
    }));
    await db.offlineQueue.bulkAdd(rows);

    await expect(
      db.transaction("rw", db.offlineQueue, () =>
        persistCriticalOfflineActionInCurrentTransaction(
          "COMMIT_AUTOMATION_TRANSACTION",
          TRANSACTION_ID,
          { schemaVersion: 1, transactionId: TRANSACTION_ID },
          OWNER_ID,
          { operationId: TRANSACTION_ID },
        ),
      ),
    ).rejects.toThrow("Offline queue full");
    await expect(db.offlineQueue.count()).resolves.toBe(1000);
  });
});

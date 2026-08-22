import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  persistCriticalOfflineActionInCurrentTransaction,
  type OfflineActionType,
} from "@/lib/offlineQueue";
import { db, type OfflineQueueItem } from "@/storage/db";

const OWNER_ID = "11111111-1111-4111-8111-111111111111";
const TRANSACTION_ID = "22222222-2222-4222-8222-222222222222";
const ACTION_TYPE = "COMMIT_AUTOMATION_TRANSACTION" as OfflineActionType;

function existingQueueItem(index: number): OfflineQueueItem {
  return {
    id: `existing-${index}`,
    operationId: `operation-${index}`,
    type: "UPDATE_SETTINGS",
    entityId: `setting-${index}`,
    ownerUserId: OWNER_ID,
    payload: null,
    timestamp: index,
    retries: 0,
    maxRetries: 5,
  };
}

describe("critical automation outbox contract", () => {
  beforeEach(async () => {
    vi.restoreAllMocks();
    await db.open();
    await db.offlineQueue.clear();
  });

  it("persists the caller's stable row and operation identities", async () => {
    const stored = await db.transaction("rw", db.offlineQueue, () =>
      persistCriticalOfflineActionInCurrentTransaction(
        ACTION_TYPE,
        TRANSACTION_ID,
        {
          schemaVersion: 1,
          transactionId: TRANSACTION_ID,
          expectedPreferenceRevision: 4,
          expectedHistoryGeneration: 2,
          deviceId: "android-install-1",
        },
        OWNER_ID,
        {
          id: `automation-commit:${TRANSACTION_ID}`,
          operationId: TRANSACTION_ID,
        },
      ),
    );

    expect(stored).toMatchObject({
      id: `automation-commit:${TRANSACTION_ID}`,
      operationId: TRANSACTION_ID,
      entityId: TRANSACTION_ID,
      ownerUserId: OWNER_ID,
      priority: "critical",
    });
  });

  it("keeps durable FIFO order when two commits observe the same clock", async () => {
    vi.spyOn(Date, "now").mockReturnValue(10_000);

    const [first, second] = await db.transaction("rw", db.offlineQueue, async () => {
      const firstRow = await persistCriticalOfflineActionInCurrentTransaction(
        ACTION_TYPE,
        "transaction-a",
        { transactionId: "transaction-a" },
        OWNER_ID,
      );
      const secondRow = await persistCriticalOfflineActionInCurrentTransaction(
        ACTION_TYPE,
        "transaction-b",
        { transactionId: "transaction-b" },
        OWNER_ID,
      );
      return [firstRow, secondRow] as const;
    });

    expect(second.timestamp).toBeGreaterThan(first.timestamp);
    await expect(db.offlineQueue.orderBy("timestamp").primaryKeys()).resolves.toEqual([
      first.id,
      second.id,
    ]);
  });

  it("rejects a full durable queue without writing a 1001st row", async () => {
    await db.offlineQueue.bulkAdd(
      Array.from({ length: 1_000 }, (_, index) => existingQueueItem(index)),
    );

    await expect(
      db.transaction("rw", db.offlineQueue, () =>
        persistCriticalOfflineActionInCurrentTransaction(
          ACTION_TYPE,
          TRANSACTION_ID,
          { transactionId: TRANSACTION_ID },
          OWNER_ID,
        ),
      ),
    ).rejects.toThrow("Offline queue full");

    await expect(db.offlineQueue.count()).resolves.toBe(1_000);
  });
});

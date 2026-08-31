import { afterAll, beforeEach, describe, expect, it, vi } from "vitest";

const boundary = vi.hoisted(() => ({ generation: "boundary-a", current: true }));
const wakeFromDurableStorage = vi.hoisted(() => vi.fn(async () => undefined));

vi.mock("@/storage/sync/syncOwner", () => ({
  validateSyncOwner: vi.fn(async () => "11111111-1111-4111-8111-111111111111"),
}));

vi.mock("@/storage/accountBoundaryRuntime", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/storage/accountBoundaryRuntime")>();
  return {
    ...actual,
    captureOriginAccountBoundaryGeneration: vi.fn(() => boundary.generation),
    assertOriginAccountBoundaryGeneration: vi.fn((generation: string) => {
      if (!boundary.current || generation !== boundary.generation) {
        throw new actual.AccountBoundaryChangedError();
      }
    }),
  };
});

vi.mock("@/lib/originExclusiveLock", () => ({
  runWithOriginExclusiveLock: vi.fn(async <T>(_name: string, operation: () => Promise<T>) =>
    operation()
  ),
}));

vi.mock("@/lib/offlineQueue", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/offlineQueue")>();
  return {
    ...actual,
    offlineQueue: { wakeFromDurableStorage },
  };
});

import { db } from "@/storage/db";
import { settingSyncRevisionKey } from "@/storage/sync/settingSyncPolicy";
import type { ScheduleEvent } from "@/types";
import { persistManualScheduleEvents } from "../automationTargetPersistence";

const OWNER_ID = "11111111-1111-4111-8111-111111111111";
const SCHEDULE_KEY = "zenflow-schedule-events";

const event = (id: string): ScheduleEvent => ({
  id,
  title: id,
  startHour: 9,
  startMinute: 0,
  endHour: 10,
  endMinute: 0,
  color: "var(--accent)",
  date: "2026-08-13",
  source: "manual",
  isEditable: true,
});

describe("manual automation target persistence", () => {
  beforeEach(async () => {
    boundary.current = true;
    boundary.generation = "boundary-a";
    wakeFromDurableStorage.mockClear();
    await db.open();
    await db.transaction(
      "rw",
      [db.settings, db.automationTransactions, db.offlineQueue],
      async () => {
        await db.settings.clear();
        await db.automationTransactions.clear();
        await db.offlineQueue.clear();
      }
    );
  });

  afterAll(() => db.close());

  it("atomically fences a manual schedule value, detaches automation and persists its outbox", async () => {
    const previous = [event("previous")];
    await db.settings.put({ key: SCHEDULE_KEY, value: previous });
    await db.automationTransactions.put({
      kind: "record_revision",
      id: `record_revision:setting:${SCHEDULE_KEY}`,
      schemaVersion: 1,
      ownerUserId: OWNER_ID,
      entityType: "setting",
      entityId: SCHEDULE_KEY,
      recordExists: true,
      revisionToken: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
      stateHash: `sha256:${"a".repeat(64)}`,
      mutationGeneration: 1,
      transactionId: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
      updatedAt: 1,
    });

    const result = await persistManualScheduleEvents(
      (current) => [...current, event("next")],
      previous
    );

    expect(result.events.map(({ id }) => id)).toEqual(["previous", "next"]);
    await expect(db.settings.get(SCHEDULE_KEY)).resolves.toEqual({
      key: SCHEDULE_KEY,
      value: result.events,
    });
    await expect(db.settings.get(settingSyncRevisionKey(SCHEDULE_KEY))).resolves.toEqual({
      key: settingSyncRevisionKey(SCHEDULE_KEY),
      value: result.updatedAt,
    });
    await expect(
      db.automationTransactions.get(`record_revision:setting:${SCHEDULE_KEY}`)
    ).resolves.toBeUndefined();
    await expect(db.offlineQueue.toArray()).resolves.toEqual([
      expect.objectContaining({
        type: "UPDATE_SETTINGS",
        entityId: SCHEDULE_KEY,
        ownerUserId: OWNER_ID,
        priority: "critical",
        payload: {
          key: SCHEDULE_KEY,
          value: result.events,
          updatedAt: new Date(result.updatedAt).toISOString(),
        },
      }),
    ]);
    expect(wakeFromDurableStorage).toHaveBeenCalledTimes(1);
  });
});

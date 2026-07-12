import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { OfflineAction, OfflineQueueHandlerContext } from "../offlineQueue";

interface PersistedQueueItem {
  id: string;
  type: string;
  entityId: string;
  payload: unknown;
  timestamp: number;
  retries: number;
  maxRetries: number;
  lastError?: string;
  priority?: string;
  ownerUserId?: string;
}

const testState = vi.hoisted(
  (): {
    currentUserId: string | null;
    localOwnerUserId: string | null;
    persistedItems: PersistedQueueItem[];
  } => ({
    currentUserId: "account-a",
    localOwnerUserId: "account-a",
    persistedItems: [],
  })
);

const dbMocks = vi.hoisted(() => {
  const offlineQueueTable = {
    toArray: vi.fn(async () => testState.persistedItems.map((item) => ({ ...item }))),
    clear: vi.fn(async () => {
      testState.persistedItems.splice(0);
    }),
    bulkAdd: vi.fn(async (items: PersistedQueueItem[]) => {
      testState.persistedItems.push(...items.map((item) => ({ ...item })));
    }),
  };

  return {
    offlineQueueTable,
    transaction: vi.fn(async (...args: unknown[]) => {
      const callback = args.at(-1) as () => Promise<unknown>;
      return callback();
    }),
  };
});

vi.mock("@/storage/db", () => ({
  db: {
    offlineQueue: dbMocks.offlineQueueTable,
    transaction: dbMocks.transaction,
  },
  getLocalDataOwnerId: vi.fn(async () => testState.localOwnerUserId),
}));

vi.mock("@/lib/supabaseClient", async () => {
  const actual =
    await vi.importActual<typeof import("@/lib/supabaseClient")>("@/lib/supabaseClient");
  return {
    ...actual,
    getCurrentSessionUserId: vi.fn(async () => testState.currentUserId),
    getCurrentUserId: vi.fn(async () => testState.currentUserId),
  };
});

vi.mock("@/lib/logger", () => ({
  logger: {
    error: vi.fn(),
    log: vi.fn(),
    warn: vi.fn(),
  },
}));

vi.mock("@/observability/syncHealthRecorder", () => ({
  recordSyncHealthReceipt: vi.fn(),
}));

type OfflineQueueModule = typeof import("../offlineQueue");
type OfflineQueueInstance = OfflineQueueModule["offlineQueue"];

let activeQueue: OfflineQueueInstance | null = null;

function setOnline(value: boolean): void {
  Object.defineProperty(window.navigator, "onLine", {
    configurable: true,
    value,
  });
}

async function loadFreshQueue(): Promise<OfflineQueueModule> {
  vi.resetModules();
  const module = await import("../offlineQueue");
  await module.offlineQueue.waitForInit();
  activeQueue = module.offlineQueue;
  return module;
}

function makePersistedAction(ownerUserId?: string): PersistedQueueItem {
  return {
    id: "queued-action",
    type: "UPDATE_SETTINGS",
    entityId: "shared-entity",
    payload: { key: "privacy", value: false },
    timestamp: 1,
    retries: 0,
    maxRetries: 5,
    priority: "normal",
    ...(ownerUserId ? { ownerUserId } : {}),
  };
}

function makeOwnedAction(ownerUserId: string, timestamp: number): OfflineAction {
  return {
    ...makePersistedAction(ownerUserId),
    type: "UPDATE_SETTINGS",
    priority: "normal",
    ownerUserId,
    timestamp,
  };
}

describe("offline queue account boundary", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    testState.currentUserId = "account-a";
    testState.localOwnerUserId = "account-a";
    testState.persistedItems.splice(0);
    localStorage.clear();
    setOnline(false);
  });

  afterEach(() => {
    activeQueue?.destroy();
    activeQueue = null;
    setOnline(true);
  });

  it("stamps a newly enqueued action with its current session owner", async () => {
    const { offlineQueue } = await loadFreshQueue();

    await offlineQueue.enqueue(
      "UPDATE_SETTINGS",
      "shared-entity",
      {
        key: "privacy",
        value: false,
      },
      { expectedOwnerUserId: "account-a" }
    );

    const [action] = offlineQueue.getState().actions;
    expect(action.ownerUserId).toBe("account-a");
    expect(testState.persistedItems[0]?.ownerUserId).toBe("account-a");
  });

  it("waits for persisted actions before answering an owner pending check", async () => {
    let releaseLoad!: (items: PersistedQueueItem[]) => void;
    dbMocks.offlineQueueTable.toArray.mockReturnValueOnce(
      new Promise<PersistedQueueItem[]>((resolve) => {
        releaseLoad = resolve;
      }),
    );
    vi.resetModules();
    const module = await import("../offlineQueue");
    activeQueue = module.offlineQueue;

    let settled = false;
    const pendingCheck = module.offlineQueue
      .hasPendingActionsForOwnerReady("account-a")
      .then((result) => {
        settled = true;
        return result;
      });
    await Promise.resolve();
    expect(settled).toBe(false);

    releaseLoad([makePersistedAction("account-a")]);

    await expect(pendingCheck).resolves.toBe(true);
  });

  it("can suspend destructive work without discarding actions until remote deletion succeeds", async () => {
    const { offlineQueue } = await loadFreshQueue();
    await offlineQueue.enqueue(
      "UPDATE_SETTINGS",
      "privacy",
      { key: "privacy", value: false },
      { expectedOwnerUserId: "account-a" },
    );

    await offlineQueue.suspendForAccountBoundary();

    expect(offlineQueue.getPendingCountForOwner("account-a")).toBe(1);
    await expect(
      offlineQueue.enqueue(
        "UPDATE_SETTINGS",
        "privacy",
        { key: "privacy", value: true },
        { expectedOwnerUserId: "account-a" },
      ),
    ).rejects.toThrow(/suspended/i);

    await offlineQueue.discardSuspendedActionsForAccountBoundary();
    expect(offlineQueue.getPendingCount()).toBe(0);
  });

  it("keeps a user-a action queued instead of executing it under user b", async () => {
    const { offlineQueue } = await loadFreshQueue();
    const handler = vi.fn(async () => undefined);
    offlineQueue.registerHandler("UPDATE_SETTINGS", handler);
    await offlineQueue.enqueue(
      "UPDATE_SETTINGS",
      "shared-entity",
      {
        key: "privacy",
        value: false,
      },
      { expectedOwnerUserId: "account-a" }
    );

    testState.currentUserId = "account-b";
    setOnline(true);
    await offlineQueue.processQueue();

    expect(handler).not.toHaveBeenCalled();
    expect(offlineQueue.getState().actions).toHaveLength(1);
  });

  it("quarantines a legacy ownerless action instead of executing it", async () => {
    testState.persistedItems.push(makePersistedAction());
    const { offlineQueue } = await loadFreshQueue();
    const handler = vi.fn(async () => undefined);
    offlineQueue.registerHandler("UPDATE_SETTINGS", handler);

    setOnline(true);
    await offlineQueue.processQueue();

    expect(handler).not.toHaveBeenCalled();
    expect(offlineQueue.getState().actions).toHaveLength(1);
  });

  it("treats an unclaimed legacy action as pending before destructive account work", async () => {
    testState.persistedItems.push(makePersistedAction());
    const { offlineQueue } = await loadFreshQueue();

    await expect(offlineQueue.hasPendingActionsForOwnerReady("account-a")).resolves.toBe(true);
  });

  it("claims and replays legacy actions only for the matching active local-data owner", async () => {
    testState.persistedItems.push(makePersistedAction());
    const { offlineQueue } = await loadFreshQueue();
    const handler = vi.fn(async () => undefined);
    offlineQueue.registerHandler("UPDATE_SETTINGS", handler);

    const claimLegacyActionsForOwner = (
      offlineQueue as typeof offlineQueue & {
        claimLegacyActionsForOwner: (ownerUserId: string) => Promise<number>;
      }
    ).claimLegacyActionsForOwner;

    await expect(claimLegacyActionsForOwner.call(offlineQueue, "account-a")).resolves.toBe(1);
    expect(offlineQueue.getState().actions[0]?.ownerUserId).toBe("account-a");
    expect(testState.persistedItems[0]?.ownerUserId).toBe("account-a");

    setOnline(true);
    await offlineQueue.processQueue();

    expect(handler).toHaveBeenCalledTimes(1);
    expect(offlineQueue.getState().actions).toEqual([]);
  });

  it("refuses to claim legacy actions for a different active or local-data owner", async () => {
    testState.persistedItems.push(makePersistedAction());
    testState.localOwnerUserId = "account-b";
    const { offlineQueue } = await loadFreshQueue();
    const claimLegacyActionsForOwner = (
      offlineQueue as typeof offlineQueue & {
        claimLegacyActionsForOwner: (ownerUserId: string) => Promise<number>;
      }
    ).claimLegacyActionsForOwner;

    await expect(claimLegacyActionsForOwner.call(offlineQueue, "account-a")).rejects.toThrow(
      /owner|account/i,
    );
    expect(offlineQueue.getState().actions[0]?.ownerUserId).toBeUndefined();
    expect(testState.persistedItems[0]?.ownerUserId).toBeUndefined();
  });

  it("keeps identical entity actions from different owners separate during compaction", async () => {
    const { compactQueue } = await loadFreshQueue();
    const actions = [makeOwnedAction("account-a", 1), makeOwnedAction("account-b", 2)];

    const compacted = compactQueue(actions);

    expect(compacted).toHaveLength(2);
    expect(compacted.map((action) => action.ownerUserId)).toEqual(["account-a", "account-b"]);
  });

  it("does not deduplicate identical entity actions across session owners", async () => {
    const { offlineQueue } = await loadFreshQueue();
    await offlineQueue.enqueue(
      "UPDATE_SETTINGS",
      "shared-entity",
      {
        key: "privacy",
        value: false,
      },
      { expectedOwnerUserId: "account-a" }
    );

    testState.currentUserId = "account-b";
    await offlineQueue.enqueue(
      "UPDATE_SETTINGS",
      "shared-entity",
      {
        key: "privacy",
        value: true,
      },
      { expectedOwnerUserId: "account-b" }
    );

    const actions = offlineQueue.getState().actions;
    expect(actions).toHaveLength(2);
    expect(actions.map((action) => action.ownerUserId)).toEqual(["account-a", "account-b"]);
  });

  it("rejects an account-a payload when account b became active before enqueue", async () => {
    const { offlineQueue } = await loadFreshQueue();
    testState.currentUserId = "account-b";

    await expect(
      offlineQueue.enqueue(
        "UPDATE_SETTINGS",
        "account-a-setting",
        { key: "privacy", value: false },
        { expectedOwnerUserId: "account-a" }
      )
    ).rejects.toThrow(/account.*changed|owner.*mismatch/i);

    expect(offlineQueue.getState().actions).toHaveLength(0);
    expect(testState.persistedItems).toHaveLength(0);
  });

  it("counts pending actions only for the requested owner", async () => {
    testState.persistedItems.push(
      { ...makePersistedAction("account-a"), id: "account-a-action", entityId: "entity-a" },
      { ...makePersistedAction("account-b"), id: "account-b-action", entityId: "entity-b" },
      { ...makePersistedAction(), id: "legacy-action", entityId: "legacy-entity" }
    );
    const { offlineQueue } = await loadFreshQueue();

    expect(offlineQueue.getPendingCountForOwner("account-a")).toBe(1);
    expect(offlineQueue.hasPendingActionsForOwner("account-a")).toBe(true);
    expect(offlineQueue.getPendingCountForOwner("account-b")).toBe(1);
    expect(offlineQueue.hasPendingActionsForOwner("account-c")).toBe(false);
    expect(offlineQueue.getPendingCount()).toBe(3);
  });

  it("keeps the action queued when the account changes during deferred handler work", async () => {
    const { offlineQueue } = await loadFreshQueue();
    let releaseHandler: () => void = () => undefined;
    let markHandlerEntered: () => void = () => undefined;
    const handlerEntered = new Promise<void>((resolve) => {
      markHandlerEntered = resolve;
    });
    const handlerGate = new Promise<void>((resolve) => {
      releaseHandler = resolve;
    });
    const mutations: Array<string | null> = [];

    offlineQueue.registerHandler(
      "UPDATE_SETTINGS",
      async (_action: OfflineAction, context: OfflineQueueHandlerContext) => {
        markHandlerEntered();
        await handlerGate;
        await context.runIfOwnerCurrent(() => {
          mutations.push(testState.currentUserId);
        });
      }
    );
    await offlineQueue.enqueue(
      "UPDATE_SETTINGS",
      "deferred-setting",
      { key: "privacy", value: false },
      { expectedOwnerUserId: "account-a", maxRetries: 1 }
    );

    setOnline(true);
    const processing = offlineQueue.processQueue();
    await handlerEntered;
    testState.currentUserId = "account-b";
    releaseHandler();
    await processing;

    expect(mutations).toEqual([]);
    expect(offlineQueue.getState().actions.map((action) => action.ownerUserId)).toEqual([
      "account-a",
    ]);
  });

  it("does not acknowledge a queue row when the owner switches after its domain mutation", async () => {
    const { offlineQueue } = await loadFreshQueue();
    const domainMutations: string[] = [];
    const orderedEvents: string[] = [];

    offlineQueue.registerHandler(
      "UPDATE_SETTINGS",
      async (_action: OfflineAction, context: OfflineQueueHandlerContext) => {
        await context.runIfOwnerCurrent(() => {
          domainMutations.push(context.ownerUserId);
          testState.currentUserId = "account-b";

          // The ordered-event writer refuses the stale account and returns
          // without creating an event. The original queue row is still the
          // durable intent and must not be acknowledged.
          if (testState.currentUserId !== context.ownerUserId) return;
          orderedEvents.push(context.ownerUserId);
        });
      },
    );
    await offlineQueue.enqueue(
      "UPDATE_SETTINGS",
      "privacy",
      { key: "privacy", value: false },
      { expectedOwnerUserId: "account-a" },
    );

    setOnline(true);
    await offlineQueue.processQueue();

    expect(domainMutations).toEqual(["account-a"]);
    expect(orderedEvents).toEqual([]);
    expect(offlineQueue.getState().actions).toEqual([
      expect.objectContaining({
        type: "UPDATE_SETTINGS",
        entityId: "privacy",
        ownerUserId: "account-a",
      }),
    ]);
    expect(testState.persistedItems).toEqual([
      expect.objectContaining({
        type: "UPDATE_SETTINGS",
        entityId: "privacy",
        ownerUserId: "account-a",
      }),
    ]);
  });

  it("does not acknowledge a queue row after an A to B to A auth transition", async () => {
    const { offlineQueue } = await loadFreshQueue();
    const mutations: string[] = [];

    offlineQueue.observeAuthStateOwner("account-a");
    offlineQueue.registerHandler(
      "UPDATE_SETTINGS",
      async (_action: OfflineAction, context: OfflineQueueHandlerContext) => {
        await context.runIfOwnerCurrent(async () => {
          mutations.push(context.ownerUserId);
          testState.currentUserId = "account-b";
          offlineQueue.observeAuthStateOwner("account-b");
          await Promise.resolve();
          testState.currentUserId = "account-a";
          offlineQueue.observeAuthStateOwner("account-a");
        });
      },
    );
    await offlineQueue.enqueue(
      "UPDATE_SETTINGS",
      "aba-setting",
      { key: "privacy", value: false },
      { expectedOwnerUserId: "account-a" },
    );

    setOnline(true);
    await offlineQueue.processQueue();

    expect(mutations).toEqual(["account-a"]);
    expect(offlineQueue.getState().actions).toEqual([
      expect.objectContaining({
        entityId: "aba-setting",
        ownerUserId: "account-a",
      }),
    ]);
  });

  it("clears singleton and persisted queue state before crossing an account boundary", async () => {
    const { offlineQueue } = await loadFreshQueue();
    await offlineQueue.enqueue(
      "UPDATE_SETTINGS",
      "account-a-setting",
      { key: "privacy", value: false },
      { expectedOwnerUserId: "account-a" },
    );

    await offlineQueue.suspendAndClearForAccountBoundary();

    expect(offlineQueue.getState().actions).toEqual([]);
    expect(testState.persistedItems).toEqual([]);
    await expect(
      offlineQueue.enqueue(
        "UPDATE_SETTINGS",
        "late-account-a-setting",
        { key: "privacy", value: true },
        { expectedOwnerUserId: "account-a" },
      ),
    ).rejects.toThrow(/account boundary|suspended/i);

    testState.currentUserId = "account-b";
    offlineQueue.resumeAfterAccountBoundary();
    await offlineQueue.enqueue(
      "UPDATE_SETTINGS",
      "account-b-setting",
      { key: "privacy", value: true },
      { expectedOwnerUserId: "account-b" },
    );
    expect(offlineQueue.getState().actions.map((action) => action.ownerUserId)).toEqual([
      "account-b",
    ]);
  });

  it("does not remove an action that was requeued by its in-flight handler", async () => {
    vi.useFakeTimers();
    try {
      const { offlineQueue } = await loadFreshQueue();
      let handlerCalls = 0;
      offlineQueue.registerHandler("UPDATE_SETTINGS", async (action) => {
        handlerCalls += 1;
        if (handlerCalls === 1) {
          await offlineQueue.enqueue(
            action.type,
            action.entityId,
            { key: "privacy", value: true },
            { expectedOwnerUserId: "account-a" },
          );
        }
      });
      await offlineQueue.enqueue(
        "UPDATE_SETTINGS",
        "retry-setting",
        { key: "privacy", value: false },
        { expectedOwnerUserId: "account-a" },
      );

      setOnline(true);
      const processing = offlineQueue.processQueue();
      await vi.advanceTimersByTimeAsync(2_100);
      await processing;

      expect(handlerCalls).toBe(2);
      expect(offlineQueue.getState().actions).toEqual([]);
    } finally {
      vi.useRealTimers();
    }
  });

  it("delivers the newest in-flight update with a fresh retry budget", async () => {
    const { offlineQueue } = await loadFreshQueue();
    const deliveredPayloads: unknown[] = [];

    offlineQueue.registerHandler("UPDATE_SETTINGS", async (action) => {
      deliveredPayloads.push(action.payload);
      if (deliveredPayloads.length === 1) {
        await offlineQueue.enqueue(
          action.type,
          action.entityId,
          { key: "privacy", value: true },
          { expectedOwnerUserId: "account-a" },
        );
        setOnline(false);
      }
    });
    await offlineQueue.enqueue(
      "UPDATE_SETTINGS",
      "retry-budget-setting",
      { key: "privacy", value: false },
      { expectedOwnerUserId: "account-a", maxRetries: 1 },
    );

    expect(offlineQueue.getState().actions[0]).toMatchObject({
      retries: 0,
      maxRetries: 1,
    });

    setOnline(true);
    await offlineQueue.processQueue();

    expect(deliveredPayloads).toEqual([{ key: "privacy", value: false }]);
    expect(offlineQueue.getState().actions[0]).toMatchObject({
      payload: { key: "privacy", value: true },
      retries: 0,
      maxRetries: 1,
    });

    setOnline(true);
    await offlineQueue.processQueue();

    expect(deliveredPayloads).toEqual([
      { key: "privacy", value: false },
      { key: "privacy", value: true },
    ]);
    expect(offlineQueue.getState().actions).toEqual([]);
  });

  it("does not hot-loop a critical event after its retry budget is exhausted", async () => {
    const { offlineQueue } = await loadFreshQueue();
    const handler = vi.fn(async () => {
      setOnline(false);
      throw new Error("event store unavailable");
    });
    offlineQueue.registerHandler("WRITE_SYNC_EVENT", handler);
    await offlineQueue.enqueue(
      "WRITE_SYNC_EVENT",
      "critical-event",
      {
        entityType: "journal",
        entityId: "entry-1",
        op: "upsert",
        payload: { id: "entry-1" },
        deviceId: "device-1",
      },
      {
        expectedOwnerUserId: "account-a",
        maxRetries: 1,
        deduplicate: false,
        priority: "critical",
      },
    );

    setOnline(true);
    await offlineQueue.processQueue();
    expect(handler).toHaveBeenCalledTimes(1);
    expect(offlineQueue.getState().actions[0]?.retries).toBe(1);

    setOnline(true);
    await offlineQueue.processQueue();

    expect(handler).toHaveBeenCalledTimes(1);
    expect(offlineQueue.getState().actions).toHaveLength(1);
  });

  it("keeps any critical privacy cleanup blocked and exposes a lossless manual retry", async () => {
    const dispatchSpy = vi.spyOn(window, "dispatchEvent");
    const { offlineQueue } = await loadFreshQueue();
    const handler = vi.fn(async () => {
      setOnline(false);
      throw new Error("temporary storage cleanup failure");
    });
    offlineQueue.registerHandler("DELETE_JOURNAL_PHOTO_STORAGE", handler);
    await offlineQueue.enqueue(
      "DELETE_JOURNAL_PHOTO_STORAGE",
      "journal-photo-migration:photo-1",
      { id: "photo-1", previousStoragePath: "account-a/photo-1.jpg" },
      {
        expectedOwnerUserId: "account-a",
        maxRetries: 1,
        priority: "critical",
      },
    );

    setOnline(true);
    await offlineQueue.processQueue();

    expect(offlineQueue.getState().actions).toEqual([
      expect.objectContaining({
        type: "DELETE_JOURNAL_PHOTO_STORAGE",
        retries: 1,
        lastError: "temporary storage cleanup failure",
      }),
    ]);
    const blockedEvent = dispatchSpy.mock.calls
      .map(([event]) => event)
      .find((event) => event.type === "zenflow:offline-queue-critical-blocked") as
      | CustomEvent<{ retry: () => void }>
      | undefined;
    expect(blockedEvent).toBeDefined();

    blockedEvent?.detail.retry();
    await vi.waitFor(() => {
      expect(offlineQueue.getState().actions[0]).toMatchObject({
        retries: 0,
        lastError: undefined,
      });
    });
  });

  it("re-exposes an actionable retry for an exhausted critical row after reload", async () => {
    testState.persistedItems.push({
      ...makePersistedAction("account-a"),
      id: "persisted-critical-cleanup",
      type: "DELETE_JOURNAL_PHOTO_STORAGE",
      entityId: "journal-photo-delete:photo-1",
      payload: { id: "photo-1", previousStoragePath: "account-a/photo-1.jpg" },
      retries: 1,
      maxRetries: 1,
      lastError: "temporary storage cleanup failure",
      priority: "critical",
    });
    const dispatchSpy = vi.spyOn(window, "dispatchEvent");
    const { offlineQueue } = await loadFreshQueue();
    const handler = vi.fn(async () => undefined);
    offlineQueue.registerHandler("DELETE_JOURNAL_PHOTO_STORAGE", handler);
    await offlineQueue.replayBlockedCriticalActionsForActiveOwner();

    expect(offlineQueue.getPendingCountForOwner("account-a")).toBe(1);
    const blockedEvent = dispatchSpy.mock.calls
      .map(([event]) => event)
      .find((event) => event.type === "zenflow:offline-queue-critical-blocked") as
      | CustomEvent<{ actionType: string; entityId: string; retry: () => void }>
      | undefined;
    expect(blockedEvent).toBeDefined();
    expect(blockedEvent?.detail).toMatchObject({
      actionType: "DELETE_JOURNAL_PHOTO_STORAGE",
      entityId: "journal-photo-delete:photo-1",
      retry: expect.any(Function),
    });

    setOnline(true);
    blockedEvent?.detail.retry();

    await vi.waitFor(() => {
      expect(handler).toHaveBeenCalledTimes(1);
      expect(offlineQueue.getState().actions).toEqual([]);
    });
  });

  it("replays a blocked critical retry after authentication becomes ready", async () => {
    testState.currentUserId = null;
    testState.persistedItems.push({
      ...makePersistedAction("account-a"),
      id: "persisted-critical-before-auth",
      type: "WRITE_SYNC_EVENT",
      entityId: "sync-event:journal:entry-before-auth:upsert",
      retries: 1,
      maxRetries: 1,
      lastError: "event store unavailable",
      priority: "critical",
    });
    const dispatchSpy = vi.spyOn(window, "dispatchEvent");
    const { offlineQueue } = await loadFreshQueue();

    await expect(offlineQueue.replayBlockedCriticalActionsForActiveOwner()).resolves.toBe(0);
    expect(
      dispatchSpy.mock.calls.some(
        ([event]) => event.type === "zenflow:offline-queue-critical-blocked",
      ),
    ).toBe(false);

    testState.currentUserId = "account-a";
    offlineQueue.observeAuthStateOwner("account-a");
    await expect(offlineQueue.replayBlockedCriticalActionsForActiveOwner()).resolves.toBe(1);

    expect(
      dispatchSpy.mock.calls.some(
        ([event]) => event.type === "zenflow:offline-queue-critical-blocked",
      ),
    ).toBe(true);
  });

  it("does not discard restored critical work when retry runs before its handler is ready", async () => {
    testState.persistedItems.push({
      ...makePersistedAction("account-a"),
      id: "persisted-critical-before-handler",
      type: "WRITE_SYNC_EVENT",
      entityId: "sync-event:journal:entry-1:upsert",
      payload: {
        entityType: "journal",
        entityId: "entry-1",
        op: "upsert",
        payload: { id: "entry-1" },
        deviceId: "device-1",
      },
      retries: 1,
      maxRetries: 1,
      lastError: "event store unavailable",
      priority: "critical",
    });
    const dispatchSpy = vi.spyOn(window, "dispatchEvent");
    const { offlineQueue } = await loadFreshQueue();
    await offlineQueue.replayBlockedCriticalActionsForActiveOwner();

    let blockedEvent:
      | CustomEvent<{ actionType: string; entityId: string; retry: () => void }>
      | undefined;
    await vi.waitFor(() => {
      blockedEvent = dispatchSpy.mock.calls
        .map(([event]) => event)
        .find((event) => event.type === "zenflow:offline-queue-critical-blocked") as
        | CustomEvent<{ actionType: string; entityId: string; retry: () => void }>
        | undefined;
      expect(blockedEvent).toBeDefined();
    });

    setOnline(true);
    blockedEvent?.detail.retry();
    await new Promise<void>((resolve) => setTimeout(resolve, 10));

    expect(offlineQueue.getState().actions).toEqual([
      expect.objectContaining({
        id: "persisted-critical-before-handler",
        ownerUserId: "account-a",
      }),
    ]);
    expect(testState.persistedItems).toEqual([
      expect.objectContaining({
        id: "persisted-critical-before-handler",
        ownerUserId: "account-a",
      }),
    ]);

    const handler = vi.fn(async () => undefined);
    offlineQueue.registerHandler("WRITE_SYNC_EVENT", handler);
    await offlineQueue.processQueue();

    expect(handler).toHaveBeenCalledTimes(1);
    expect(offlineQueue.getState().actions).toEqual([]);
  });
});

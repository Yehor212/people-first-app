import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { OfflineAction, OfflineQueueHandlerContext } from "../offlineQueue";
import { SK } from "../storageKeys";
import {
  advanceOriginAccountBoundaryGeneration,
  markPendingLocalBackupAccountClaim,
} from "@/storage/accountBoundaryRuntime";

interface PersistedQueueItem {
  id: string;
  operationId?: string;
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
    bulkPut: vi.fn(async (items: PersistedQueueItem[]) => {
      for (const item of items) {
        const index = testState.persistedItems.findIndex((candidate) => candidate.id === item.id);
        if (index === -1) testState.persistedItems.push({ ...item });
        else testState.persistedItems[index] = { ...item };
      }
    }),
    get: vi.fn(async (id: string) => {
      const item = testState.persistedItems.find((candidate) => candidate.id === id);
      return item ? { ...item } : undefined;
    }),
    update: vi.fn(async (id: string, changes: Partial<PersistedQueueItem>) => {
      const index = testState.persistedItems.findIndex((candidate) => candidate.id === id);
      if (index === -1) return 0;
      testState.persistedItems[index] = { ...testState.persistedItems[index], ...changes };
      return 1;
    }),
    delete: vi.fn(async (id: string) => {
      const index = testState.persistedItems.findIndex((item) => item.id === id);
      if (index !== -1) testState.persistedItems.splice(index, 1);
    }),
    bulkDelete: vi.fn(async (ids: string[]) => {
      const deleted = new Set(ids);
      testState.persistedItems.splice(
        0,
        testState.persistedItems.length,
        ...testState.persistedItems.filter((item) => !deleted.has(item.id))
      );
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

const sessionMocks = vi.hoisted(() => ({
  getCurrentSessionUserId: vi.fn(async () => testState.currentUserId),
  getCurrentUserId: vi.fn(async () => testState.currentUserId),
}));

const loggerMocks = vi.hoisted(() => ({
  error: vi.fn(),
  log: vi.fn(),
  warn: vi.fn(),
}));

const observabilityMocks = vi.hoisted(() => ({
  recordSyncHealthReceipt: vi.fn(),
}));

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
    getCurrentSessionUserId: sessionMocks.getCurrentSessionUserId,
    getCurrentUserId: sessionMocks.getCurrentUserId,
  };
});

vi.mock("@/lib/logger", () => ({
  logger: loggerMocks,
}));

vi.mock("@/observability/syncHealthRecorder", () => ({
  recordSyncHealthReceipt: observabilityMocks.recordSyncHealthReceipt,
}));

type OfflineQueueModule = typeof import("../offlineQueue");
type OfflineQueueInstance = OfflineQueueModule["offlineQueue"];
const COMMITTED = { status: "committed" } as const;

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

type EmptyQueueBoundaryResult =
  | { status: "discarded" }
  | { status: "blocked"; pendingOwnerUserIds: string[] };

async function discardOnlyWhenQueueIsEmpty(
  queue: OfflineQueueInstance
): Promise<EmptyQueueBoundaryResult | undefined> {
  const discard = queue.discardSuspendedActionsForAccountBoundary as unknown as (options: {
    onlyIfEmpty: true;
  }) => Promise<EmptyQueueBoundaryResult | undefined>;
  return discard.call(queue, { onlyIfEmpty: true });
}

describe("offline queue account boundary", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    testState.currentUserId = "account-a";
    testState.localOwnerUserId = "account-a";
    testState.persistedItems.splice(0);
    sessionMocks.getCurrentSessionUserId.mockReset();
    sessionMocks.getCurrentSessionUserId.mockImplementation(async () => testState.currentUserId);
    sessionMocks.getCurrentUserId.mockReset();
    sessionMocks.getCurrentUserId.mockImplementation(async () => testState.currentUserId);
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
    expect(action.operationId).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
    );
    expect(testState.persistedItems[0]?.ownerUserId).toBe("account-a");
    expect(testState.persistedItems[0]?.operationId).toBe(action.operationId);
  });

  it("contains lifecycle processing failures and retries without logging rejection content", async () => {
    vi.useFakeTimers();
    try {
      const { offlineQueue } = await loadFreshQueue();
      const processQueue = vi
        .spyOn(offlineQueue, "processQueue")
        .mockRejectedValueOnce(new Error("private journal content"))
        .mockResolvedValueOnce(undefined);

      setOnline(true);
      window.dispatchEvent(new Event("online"));
      await Promise.resolve();
      await Promise.resolve();

      expect(loggerMocks.error).toHaveBeenCalledWith(
        "[OfflineQueue] Lifecycle processing failed",
        expect.objectContaining({ trigger: "online", retryScheduled: true }),
      );
      expect(JSON.stringify(loggerMocks.error.mock.calls)).not.toContain(
        "private journal content",
      );
      expect(observabilityMocks.recordSyncHealthReceipt).toHaveBeenCalledWith({
        kind: "error",
        source: "queue",
        errorName: "OfflineQueueLifecycleError",
      });

      await vi.advanceTimersByTimeAsync(1_000);

      expect(processQueue).toHaveBeenCalledTimes(2);
      await vi.advanceTimersByTimeAsync(20_000);
      expect(processQueue).toHaveBeenCalledTimes(2);
    } finally {
      vi.useRealTimers();
    }
  });

  it("keeps private entity identity out of queue logs and blocked-event diagnostics", async () => {
    const privateEntityId = "PRIVATE_SENTINEL_QUEUE_ENTITY";
    const privateFailure = "PRIVATE_SENTINEL_HANDLER_FAILURE";
    const dispatchSpy = vi.spyOn(window, "dispatchEvent");
    const { offlineQueue } = await loadFreshQueue();

    await offlineQueue.enqueue(
      "UPDATE_SETTINGS",
      privateEntityId,
      { key: "privacy", value: false },
      { expectedOwnerUserId: "account-a", maxRetries: 1 },
    );
    await offlineQueue.enqueue(
      "UPDATE_SETTINGS",
      privateEntityId,
      { key: "privacy", value: true },
      { expectedOwnerUserId: "account-a", maxRetries: 1 },
    );
    offlineQueue.registerHandler("UPDATE_SETTINGS", async () => {
      throw new Error(privateFailure);
    });

    setOnline(true);
    await offlineQueue.processQueue();

    expect(offlineQueue.getState().actions).toEqual([
      expect.objectContaining({ entityId: privateEntityId, lastError: "QUEUE_HANDLER_FAILED" }),
    ]);
    const diagnostics = JSON.stringify({
      logs: [
        ...loggerMocks.log.mock.calls,
        ...loggerMocks.warn.mock.calls,
        ...loggerMocks.error.mock.calls,
      ],
      events: dispatchSpy.mock.calls.map(([event]) => ({
        type: event.type,
        detail: (event as CustomEvent<unknown>).detail,
      })),
    });
    expect(diagnostics).not.toContain(privateEntityId);
    expect(diagnostics).not.toContain(privateFailure);
  });

  it("keeps a rejected full-queue entity identity out of the UI event", async () => {
    const privateEntityId = "PRIVATE_SENTINEL_FULL_QUEUE_ENTITY";
    testState.persistedItems.push(
      ...Array.from({ length: 1_000 }, (_, index) => ({
        ...makePersistedAction("account-a"),
        id: `full-queue-${index}`,
        operationId: `full-operation-${index}`,
        entityId: `existing-${index}`,
        timestamp: index,
      })),
    );
    const dispatchSpy = vi.spyOn(window, "dispatchEvent");
    const { offlineQueue } = await loadFreshQueue();

    await expect(
      offlineQueue.enqueue(
        "UPDATE_SETTINGS",
        privateEntityId,
        { key: "privacy", value: false },
        { expectedOwnerUserId: "account-a" },
      ),
    ).rejects.toThrow("Offline queue full");

    const queueFullEvent = dispatchSpy.mock.calls
      .map(([event]) => event)
      .find((event) => event.type === "zenflow:offline-queue-full") as
      | CustomEvent<Record<string, unknown>>
      | undefined;
    expect(queueFullEvent).toBeDefined();
    expect(JSON.stringify(queueFullEvent?.detail)).not.toContain(privateEntityId);
    expect(queueFullEvent?.detail).not.toHaveProperty("entityId");
  });

  it("jitters the first online lifecycle retry instead of reconnecting every client together", async () => {
    vi.useFakeTimers();
    const randomSpy = vi.spyOn(Math, "random").mockReturnValue(0);
    try {
      const { offlineQueue } = await loadFreshQueue();
      const processQueue = vi
        .spyOn(offlineQueue, "processQueue")
        .mockRejectedValueOnce(new Error("storage unavailable"))
        .mockResolvedValueOnce(undefined);

      setOnline(true);
      window.dispatchEvent(new Event("online"));
      await Promise.resolve();
      await Promise.resolve();

      expect(processQueue).toHaveBeenCalledTimes(1);
      await vi.advanceTimersByTimeAsync(499);
      expect(processQueue).toHaveBeenCalledTimes(1);
      await vi.advanceTimersByTimeAsync(1);
      expect(processQueue).toHaveBeenCalledTimes(2);
    } finally {
      randomSpy.mockRestore();
      vi.useRealTimers();
    }
  });

  it("stops automatic lifecycle retries after the finite retry budget", async () => {
    vi.useFakeTimers();
    try {
      const { offlineQueue } = await loadFreshQueue();
      const processQueue = vi
        .spyOn(offlineQueue, "processQueue")
        .mockRejectedValue(new Error("storage remains unavailable"));

      setOnline(true);
      window.dispatchEvent(new Event("online"));
      await Promise.resolve();
      await Promise.resolve();
      await vi.advanceTimersByTimeAsync(1_000 + 5_000 + 15_000);

      expect(processQueue).toHaveBeenCalledTimes(4);
      await vi.advanceTimersByTimeAsync(60_000);
      expect(processQueue).toHaveBeenCalledTimes(4);
    } finally {
      vi.useRealTimers();
    }
  });

  it("reconciles fallback actions with a stale IndexedDB snapshot before clearing fallback", async () => {
    testState.persistedItems.push({
      ...makePersistedAction("account-a"),
      id: "stale-idb-action",
      operationId: "stale-operation",
      entityId: "stale-idb-entity",
    });
    const { offlineQueue } = await loadFreshQueue();
    dbMocks.offlineQueueTable.bulkPut.mockRejectedValueOnce(new Error("IndexedDB write failed"));

    await offlineQueue.enqueue(
      "UPDATE_SETTINGS",
      "fallback-only-entity",
      { key: "privacy", value: true },
      { expectedOwnerUserId: "account-a", deduplicate: false }
    );

    const fallback = JSON.parse(localStorage.getItem(SK.OFFLINE_QUEUE) || "{}") as {
      actions?: PersistedQueueItem[];
    };
    expect(fallback.actions?.map((action) => action.entityId).sort()).toEqual([
      "fallback-only-entity",
      "stale-idb-entity",
    ]);

    offlineQueue.destroy();
    activeQueue = null;
    const { offlineQueue: reloadedQueue } = await loadFreshQueue();

    expect(
      reloadedQueue
        .getState()
        .actions.map((action) => action.entityId)
        .sort()
    ).toEqual(["fallback-only-entity", "stale-idb-entity"]);
    expect(testState.persistedItems.map((action) => action.entityId).sort()).toEqual([
      "fallback-only-entity",
      "stale-idb-entity",
    ]);
    expect(localStorage.getItem(SK.OFFLINE_QUEUE)).toBeNull();
  });

  it("keeps a normal action durable while its handler is not registered", async () => {
    const { offlineQueue } = await loadFreshQueue();
    await offlineQueue.enqueue(
      "UPDATE_SETTINGS",
      "handler-not-ready",
      { key: "privacy", value: true },
      { expectedOwnerUserId: "account-a" }
    );

    setOnline(true);
    await offlineQueue.processQueue();

    expect(offlineQueue.getState().actions).toEqual([
      expect.objectContaining({ entityId: "handler-not-ready", retries: 0 }),
    ]);
    expect(testState.persistedItems).toHaveLength(1);
  });

  it("gives a persisted normal action a bounded turn after cold-start hydration", async () => {
    const persistedCritical = Array.from({ length: 9 }, (_, index): PersistedQueueItem => ({
      id: `critical-${index}`,
      operationId: `critical-operation-${index}`,
      type: "UPDATE_SETTINGS",
      entityId: `critical-setting-${index}`,
      ownerUserId: "account-a",
      payload: { key: `critical-setting-${index}`, value: true },
      timestamp: 100 + index,
      retries: 0,
      maxRetries: 5,
      priority: "critical",
    }));
    testState.persistedItems.push(
      ...persistedCritical.reverse(),
      {
        id: "normal-waiting",
        operationId: "normal-operation",
        type: "UPDATE_SETTINGS",
        entityId: "normal-waiting",
        ownerUserId: "account-a",
        payload: { key: "normal-waiting", value: true },
        timestamp: 1,
        retries: 0,
        maxRetries: 5,
        priority: "normal",
      },
    );

    const { offlineQueue } = await loadFreshQueue();
    const deliveredEntityIds: string[] = [];
    offlineQueue.registerHandler("UPDATE_SETTINGS", async (queuedAction) => {
      deliveredEntityIds.push(queuedAction.entityId);
      return COMMITTED;
    });

    setOnline(true);
    await offlineQueue.processQueue();

    expect(deliveredEntityIds.slice(0, 8)).toEqual(
      Array.from({ length: 8 }, (_, index) => `critical-setting-${index}`),
    );
    expect(deliveredEntityIds[8]).toBe("normal-waiting");
    expect(deliveredEntityIds[9]).toBe("critical-setting-8");
    expect(testState.persistedItems).toEqual([]);
  });

  it("processes a verified retry when navigator.onLine is stale false", async () => {
    const { offlineQueue } = await loadFreshQueue();
    const handler = vi.fn(async () => COMMITTED);
    offlineQueue.registerHandler("UPDATE_SETTINGS", handler);
    await offlineQueue.enqueue(
      "UPDATE_SETTINGS",
      "stale-navigator-retry",
      { key: "privacy", value: true },
      { expectedOwnerUserId: "account-a" }
    );

    const connectivityController = new AbortController();
    await offlineQueue.processQueue({
      verifiedConnectivity: {
        source: "same-origin-app-asset",
        signal: connectivityController.signal,
      },
    });

    expect(navigator.onLine).toBe(false);
    expect(handler).toHaveBeenCalledTimes(1);
    expect(offlineQueue.getState().actions).toHaveLength(0);
    expect(testState.persistedItems).toHaveLength(0);
  });

  it("does not run queued cloud work while an imported backup awaits an account choice", async () => {
    const { offlineQueue } = await loadFreshQueue();
    const handler = vi.fn(async () => COMMITTED);
    offlineQueue.registerHandler("UPDATE_SETTINGS", handler);
    await offlineQueue.enqueue(
      "UPDATE_SETTINGS",
      "claim-fenced-retry",
      { key: "privacy", value: true },
      { expectedOwnerUserId: "account-a" }
    );
    localStorage.setItem(
      SK.PENDING_LOCAL_BACKUP_ACCOUNT_CLAIM,
      JSON.stringify({ version: 1, generation: "claim-generation" })
    );

    setOnline(true);
    await offlineQueue.processQueue();

    expect(handler).not.toHaveBeenCalled();
    expect(offlineQueue.getState().actions).toEqual([
      expect.objectContaining({ entityId: "claim-fenced-retry" }),
    ]);
  });

  it("does not admit new queued cloud work while an imported backup awaits a choice", async () => {
    const { offlineQueue } = await loadFreshQueue();
    localStorage.setItem(
      SK.PENDING_LOCAL_BACKUP_ACCOUNT_CLAIM,
      JSON.stringify({ version: 1, generation: "claim-generation" })
    );

    await expect(
      offlineQueue.enqueue(
        "UPDATE_SETTINGS",
        "claim-fenced-admission",
        { key: "privacy", value: true },
        { expectedOwnerUserId: "account-a" }
      )
    ).rejects.toThrow(/account boundary/i);

    expect(offlineQueue.getState().actions).toHaveLength(0);
    expect(testState.persistedItems).toHaveLength(0);
  });

  it("preserves the newest verified retry while an older queue pass is finishing", async () => {
    const { offlineQueue } = await loadFreshQueue();
    let releaseFirst!: () => void;
    let markFirstStarted!: () => void;
    const firstStarted = new Promise<void>((resolve) => {
      markFirstStarted = resolve;
    });
    const firstGate = new Promise<void>((resolve) => {
      releaseFirst = resolve;
    });
    const handler = vi.fn(async (_action: OfflineAction) => {
      if (handler.mock.calls.length === 1) {
        markFirstStarted();
        await firstGate;
      }
      return COMMITTED;
    });
    offlineQueue.registerHandler("UPDATE_SETTINGS", handler);
    await offlineQueue.enqueue(
      "UPDATE_SETTINGS",
      "older-verified-retry",
      { key: "first", value: true },
      { expectedOwnerUserId: "account-a", deduplicate: false }
    );
    await offlineQueue.enqueue(
      "UPDATE_SETTINGS",
      "newer-verified-retry",
      { key: "second", value: true },
      { expectedOwnerUserId: "account-a", deduplicate: false }
    );

    const olderController = new AbortController();
    const olderPass = offlineQueue.processQueue({
      verifiedConnectivity: {
        source: "same-origin-app-asset",
        signal: olderController.signal,
      },
    });
    await firstStarted;

    olderController.abort();
    const newerController = new AbortController();
    const newerPass = offlineQueue.processQueue({
      verifiedConnectivity: {
        source: "same-origin-app-asset",
        signal: newerController.signal,
      },
    });
    releaseFirst();
    await Promise.all([olderPass, newerPass]);

    expect(handler).toHaveBeenCalledTimes(3);
    expect(handler.mock.calls.map(([action]) => action.entityId)).toEqual([
      "older-verified-retry",
      "older-verified-retry",
      "newer-verified-retry",
    ]);
    expect(offlineQueue.getState().actions).toHaveLength(0);
    expect(testState.persistedItems).toHaveLength(0);
  });

  it("pauses an active verified pass when its connectivity evidence is revoked", async () => {
    const { offlineQueue } = await loadFreshQueue();
    let releaseHandler!: () => void;
    let markHandlerStarted!: () => void;
    const handlerStarted = new Promise<void>((resolve) => {
      markHandlerStarted = resolve;
    });
    const handlerGate = new Promise<void>((resolve) => {
      releaseHandler = resolve;
    });
    offlineQueue.registerHandler("UPDATE_SETTINGS", async () => {
      markHandlerStarted();
      await handlerGate;
      return COMMITTED;
    });
    await offlineQueue.enqueue(
      "UPDATE_SETTINGS",
      "revoked-connectivity",
      { key: "privacy", value: true },
      { expectedOwnerUserId: "account-a" }
    );

    const controller = new AbortController();
    const processing = offlineQueue.processQueue({
      verifiedConnectivity: {
        source: "same-origin-app-asset",
        signal: controller.signal,
      },
    });
    await handlerStarted;
    controller.abort();
    releaseHandler();
    await processing;

    expect(offlineQueue.getState()).toMatchObject({
      actions: [expect.objectContaining({ entityId: "revoked-connectivity", retries: 0 })],
      isProcessing: false,
      lastProcessedAt: null,
    });
    expect(testState.persistedItems).toHaveLength(1);
  });

  it("does not acknowledge a handler that omits an explicit commit result", async () => {
    const { offlineQueue } = await loadFreshQueue();
    offlineQueue.registerHandler("UPDATE_SETTINGS", async () => undefined);
    await offlineQueue.enqueue(
      "UPDATE_SETTINGS",
      "missing-ack",
      { key: "privacy", value: true },
      { expectedOwnerUserId: "account-a", maxRetries: 1 }
    );

    setOnline(true);
    await offlineQueue.processQueue();

    expect(offlineQueue.getState().actions).toEqual([
      expect.objectContaining({ entityId: "missing-ack", retries: 1 }),
    ]);
    expect(testState.persistedItems).toHaveLength(1);
  });

  it("preserves actions enqueued from two independently hydrated tabs", async () => {
    const firstModule = await loadFreshQueue();
    const firstQueue = firstModule.offlineQueue;
    const secondModule = await loadFreshQueue();
    const secondQueue = secondModule.offlineQueue;

    try {
      await firstQueue.enqueue(
        "UPDATE_SETTINGS",
        "first-tab-setting",
        { key: "first", value: true },
        { expectedOwnerUserId: "account-a" }
      );
      await secondQueue.enqueue(
        "UPDATE_SETTINGS",
        "second-tab-setting",
        { key: "second", value: true },
        { expectedOwnerUserId: "account-a" }
      );

      expect(testState.persistedItems.map((item) => item.entityId).sort()).toEqual([
        "first-tab-setting",
        "second-tab-setting",
      ]);
    } finally {
      firstQueue.destroy();
      secondQueue.destroy();
    }
  });

  it("lets an enqueue that acquired DATA first block a later account switch without data loss", async () => {
    const firstModule = await loadFreshQueue();
    const firstQueue = firstModule.offlineQueue;
    const secondModule = await loadFreshQueue();
    const secondQueue = secondModule.offlineQueue;
    const { runWithOriginExclusiveLock } = await import("../originExclusiveLock");
    let markPersistStarted!: () => void;
    let releasePersist!: () => void;
    const persistStarted = new Promise<void>((resolve) => {
      markPersistStarted = resolve;
    });
    const persistGate = new Promise<void>((resolve) => {
      releasePersist = resolve;
    });
    dbMocks.offlineQueueTable.bulkPut.mockImplementationOnce(async (items) => {
      markPersistStarted();
      await persistGate;
      for (const item of items) {
        const index = testState.persistedItems.findIndex((candidate) => candidate.id === item.id);
        if (index === -1) testState.persistedItems.push({ ...item });
        else testState.persistedItems[index] = { ...item };
      }
    });

    try {
      await secondQueue.suspendForAccountBoundary();
      const enqueue = firstQueue.enqueue(
        "UPDATE_SETTINGS",
        "enqueue-first-setting",
        { key: "privacy", value: true },
        { expectedOwnerUserId: "account-a" }
      );
      await persistStarted;

      let switchEntered = false;
      const accountSwitch = runWithOriginExclusiveLock("zenflow:data-write-barrier", async () => {
        switchEntered = true;
        const result = await discardOnlyWhenQueueIsEmpty(secondQueue);
        if (result?.status !== "blocked") testState.localOwnerUserId = "account-b";
        return result ?? ({ status: "discarded" } as const);
      });

      await new Promise<void>((resolve) => setTimeout(resolve, 20));
      expect(switchEntered).toBe(false);

      releasePersist();
      await enqueue;
      await expect(accountSwitch).resolves.toEqual({
        status: "blocked",
        pendingOwnerUserIds: ["account-a"],
      });
      expect(testState.localOwnerUserId).toBe("account-a");
      expect(testState.persistedItems).toEqual([
        expect.objectContaining({
          entityId: "enqueue-first-setting",
          ownerUserId: "account-a",
        }),
      ]);
    } finally {
      releasePersist();
      firstQueue.destroy();
      secondQueue.destroy();
      activeQueue = null;
    }
  });

  it("rejects a stale enqueue after an account switch acquired DATA first", async () => {
    const firstModule = await loadFreshQueue();
    const firstQueue = firstModule.offlineQueue;
    const secondModule = await loadFreshQueue();
    const secondQueue = secondModule.offlineQueue;
    const { runWithOriginExclusiveLock } = await import("../originExclusiveLock");
    let markSwitchBound!: () => void;
    let releaseSwitch!: () => void;
    const switchBound = new Promise<void>((resolve) => {
      markSwitchBound = resolve;
    });
    const switchGate = new Promise<void>((resolve) => {
      releaseSwitch = resolve;
    });

    try {
      await secondQueue.suspendForAccountBoundary();
      const accountSwitch = runWithOriginExclusiveLock("zenflow:data-write-barrier", async () => {
        const result = await discardOnlyWhenQueueIsEmpty(secondQueue);
        expect(result ?? { status: "discarded" }).toEqual({ status: "discarded" });
        testState.localOwnerUserId = "account-b";
        markSwitchBound();
        await switchGate;
      });
      await switchBound;

      let enqueueSettled = false;
      const staleEnqueue = firstQueue
        .enqueue(
          "UPDATE_SETTINGS",
          "switch-first-setting",
          { key: "privacy", value: true },
          { expectedOwnerUserId: "account-a" }
        )
        .finally(() => {
          enqueueSettled = true;
        });

      await new Promise<void>((resolve) => setTimeout(resolve, 20));
      expect(enqueueSettled).toBe(false);

      releaseSwitch();
      await accountSwitch;
      await expect(staleEnqueue).rejects.toThrow(/local data owner|owner mismatch/i);
      expect(testState.persistedItems).toEqual([]);
      expect(testState.localOwnerUserId).toBe("account-b");
    } finally {
      releaseSwitch();
      firstQueue.destroy();
      secondQueue.destroy();
      activeQueue = null;
    }
  });

  it("allows only one tab to deliver the same persisted operation", async () => {
    testState.persistedItems.push({
      ...makePersistedAction("account-a"),
      operationId: "11111111-1111-4111-8111-111111111111",
    });
    const firstModule = await loadFreshQueue();
    const firstQueue = firstModule.offlineQueue;
    const secondModule = await loadFreshQueue();
    const secondQueue = secondModule.offlineQueue;
    const deliveries: string[] = [];

    firstQueue.registerHandler("UPDATE_SETTINGS", async () => {
      deliveries.push("first");
      await new Promise<void>((resolve) => setTimeout(resolve, 20));
      return COMMITTED;
    });
    secondQueue.registerHandler("UPDATE_SETTINGS", async () => {
      deliveries.push("second");
      return COMMITTED;
    });

    try {
      setOnline(true);
      await Promise.all([firstQueue.processQueue(), secondQueue.processQueue()]);

      expect(deliveries).toHaveLength(1);
      expect(testState.persistedItems).toEqual([]);
    } finally {
      firstQueue.destroy();
      secondQueue.destroy();
    }
  });

  it("does not resurrect an acknowledged action when IndexedDB deletion used fallback", async () => {
    testState.persistedItems.push({
      ...makePersistedAction("account-a"),
      operationId: "22222222-2222-4222-8222-222222222222",
    });
    const { offlineQueue } = await loadFreshQueue();
    const handler = vi.fn(async () => COMMITTED);
    offlineQueue.registerHandler("UPDATE_SETTINGS", handler);
    dbMocks.offlineQueueTable.delete.mockRejectedValueOnce(new Error("IndexedDB delete failed"));

    setOnline(true);
    await offlineQueue.processQueue();

    expect(handler).toHaveBeenCalledTimes(1);
    expect(offlineQueue.getState().actions).toEqual([]);
    expect(testState.persistedItems).toHaveLength(1);
    expect(JSON.parse(localStorage.getItem(SK.OFFLINE_QUEUE) || "{}")).toMatchObject({
      actions: [],
      mode: "merge-with-tombstones",
      storageVersion: 3,
      removedOperations: [
        {
          id: "queued-action",
          operationId: "22222222-2222-4222-8222-222222222222",
          ownerUserId: "account-a",
        },
      ],
    });

    offlineQueue.destroy();
    activeQueue = null;
    const { offlineQueue: reloadedQueue } = await loadFreshQueue();

    expect(reloadedQueue.getState().actions).toEqual([]);
    expect(testState.persistedItems).toEqual([]);
    expect(localStorage.getItem(SK.OFFLINE_QUEUE)).toBeNull();
    expect(handler).toHaveBeenCalledTimes(1);
  });

  it("does not erase a newer durable operation when reconciling a delete fallback", async () => {
    testState.persistedItems.push({
      ...makePersistedAction("account-a"),
      operationId: "22222222-2222-4222-8222-222222222222",
    });
    const { offlineQueue } = await loadFreshQueue();
    offlineQueue.registerHandler("UPDATE_SETTINGS", async () => COMMITTED);
    dbMocks.offlineQueueTable.delete.mockRejectedValueOnce(new Error("IndexedDB delete failed"));

    setOnline(true);
    await offlineQueue.processQueue();

    const newerOperation: PersistedQueueItem = {
      ...makePersistedAction("account-a"),
      id: "newer-critical-operation",
      operationId: "33333333-3333-4333-8333-333333333333",
      entityId: "newer-critical-entity",
      timestamp: 2,
      priority: "critical",
    };
    testState.persistedItems.push(newerOperation);

    offlineQueue.destroy();
    activeQueue = null;
    const { offlineQueue: reloadedQueue } = await loadFreshQueue();

    expect(reloadedQueue.getState().actions).toEqual([
      expect.objectContaining({
        id: newerOperation.id,
        operationId: newerOperation.operationId,
      }),
    ]);
    expect(testState.persistedItems).toEqual([
      expect.objectContaining({
        id: newerOperation.id,
        operationId: newerOperation.operationId,
      }),
    ]);
    expect(localStorage.getItem(SK.OFFLINE_QUEUE)).toBeNull();
  });

  it("keeps a stale fallback non-destructive when its cleanup fails", async () => {
    testState.persistedItems.push({
      ...makePersistedAction("account-a"),
      operationId: "44444444-4444-4444-8444-444444444444",
    });
    const { offlineQueue } = await loadFreshQueue();
    offlineQueue.registerHandler("UPDATE_SETTINGS", async () => COMMITTED);
    dbMocks.offlineQueueTable.delete.mockRejectedValueOnce(new Error("IndexedDB delete failed"));

    setOnline(true);
    await offlineQueue.processQueue();
    offlineQueue.destroy();
    activeQueue = null;

    const removeItem = vi
      .spyOn(Storage.prototype, "removeItem")
      .mockImplementationOnce(() => {
        throw new Error("localStorage remove failed");
      });
    const { offlineQueue: firstReload } = await loadFreshQueue();
    expect(firstReload.getState().actions).toEqual([]);
    expect(localStorage.getItem(SK.OFFLINE_QUEUE)).not.toBeNull();
    firstReload.destroy();
    activeQueue = null;
    removeItem.mockRestore();

    const newerOperation: PersistedQueueItem = {
      ...makePersistedAction("account-a"),
      id: "post-cleanup-durable-operation",
      operationId: "55555555-5555-4555-8555-555555555555",
      entityId: "post-cleanup-durable-entity",
      timestamp: 3,
      priority: "critical",
    };
    testState.persistedItems.push(newerOperation);
    const { offlineQueue: secondReload } = await loadFreshQueue();

    expect(secondReload.getState().actions).toEqual([
      expect.objectContaining({
        id: newerOperation.id,
        operationId: newerOperation.operationId,
      }),
    ]);
    expect(testState.persistedItems).toEqual([
      expect.objectContaining({
        id: newerOperation.id,
        operationId: newerOperation.operationId,
      }),
    ]);
    expect(localStorage.getItem(SK.OFFLINE_QUEUE)).toBeNull();
  });

  it("unions pending deletion tombstones while fallback cleanup remains unavailable", async () => {
    const firstOperation: PersistedQueueItem = {
      ...makePersistedAction("account-a"),
      id: "first-acknowledged-operation",
      operationId: "91919191-9191-4191-8191-919191919191",
      entityId: "first-acknowledged-entity",
      timestamp: 1,
    };
    const secondOperation: PersistedQueueItem = {
      ...makePersistedAction("account-a"),
      id: "second-acknowledged-operation",
      operationId: "92929292-9292-4292-8292-929292929292",
      entityId: "second-acknowledged-entity",
      timestamp: 2,
    };
    testState.persistedItems.push(firstOperation, secondOperation);
    localStorage.setItem(
      SK.OFFLINE_QUEUE,
      JSON.stringify({
        actions: [secondOperation],
        removedOperations: [
          {
            id: firstOperation.id,
            operationId: firstOperation.operationId,
            ownerUserId: firstOperation.ownerUserId,
          },
        ],
        storageVersion: 3,
        mode: "merge-with-tombstones",
      })
    );
    const removeItem = vi.spyOn(Storage.prototype, "removeItem").mockImplementation(() => {
      throw new Error("localStorage remove failed");
    });
    const { offlineQueue } = await loadFreshQueue();
    offlineQueue.registerHandler("UPDATE_SETTINGS", async () => COMMITTED);
    dbMocks.offlineQueueTable.delete.mockRejectedValueOnce(new Error("IndexedDB delete failed"));

    setOnline(true);
    await offlineQueue.processQueue();

    const fallback = JSON.parse(localStorage.getItem(SK.OFFLINE_QUEUE) || "{}") as {
      removedOperations?: Array<{ id: string }>;
    };
    expect(fallback.removedOperations?.map((item) => item.id).sort()).toEqual([
      firstOperation.id,
      secondOperation.id,
    ]);
    removeItem.mockRestore();
  });

  it("migrates a legacy authoritative fallback without clearing newer IndexedDB rows", async () => {
    const newerOperation: PersistedQueueItem = {
      ...makePersistedAction("account-a"),
      id: "legacy-migration-durable-operation",
      operationId: "66666666-6666-4666-8666-666666666666",
      entityId: "legacy-migration-durable-entity",
      timestamp: 4,
      priority: "critical",
    };
    testState.persistedItems.push(newerOperation);
    localStorage.setItem(
      SK.OFFLINE_QUEUE,
      JSON.stringify({
        actions: [],
        storageVersion: 2,
        mode: "authoritative-snapshot",
      })
    );

    const { offlineQueue } = await loadFreshQueue();

    expect(offlineQueue.getState().actions).toEqual([
      expect.objectContaining({
        id: newerOperation.id,
        operationId: newerOperation.operationId,
      }),
    ]);
    expect(testState.persistedItems).toEqual([
      expect.objectContaining({
        id: newerOperation.id,
        operationId: newerOperation.operationId,
      }),
    ]);
    expect(localStorage.getItem(SK.OFFLINE_QUEUE)).toBeNull();
  });

  it("preserves a newer same-id durable operation over a stale v3 fallback", async () => {
    const durableOperation: PersistedQueueItem = {
      ...makePersistedAction("account-a"),
      operationId: "77777777-7777-4777-8777-777777777777",
      timestamp: 8,
    };
    testState.persistedItems.push(durableOperation);
    localStorage.setItem(
      SK.OFFLINE_QUEUE,
      JSON.stringify({
        actions: [
          {
            ...makeOwnedAction("account-a", 7),
            operationId: "88888888-8888-4888-8888-888888888888",
          },
        ],
        removedOperations: [],
        storageVersion: 3,
        mode: "merge-with-tombstones",
      })
    );

    const { offlineQueue } = await loadFreshQueue();

    expect(offlineQueue.getState().actions).toEqual([
      expect.objectContaining({
        id: durableOperation.id,
        operationId: durableOperation.operationId,
      }),
    ]);
    expect(testState.persistedItems).toEqual([
      expect.objectContaining({ operationId: durableOperation.operationId }),
    ]);
    expect(localStorage.getItem(SK.OFFLINE_QUEUE)).toBeNull();
  });

  it("fails closed when the fallback journal cannot be read", async () => {
    const getItem = vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => {
      throw new Error("localStorage read failed");
    });
    vi.resetModules();
    const module = await import("../offlineQueue");
    activeQueue = module.offlineQueue;

    await expect(module.offlineQueue.waitForInit()).rejects.toThrow(/fallback is unavailable/i);
    getItem.mockRestore();
  });

  it("fails closed when a v3 fallback contains an incomplete deletion tombstone", async () => {
    const acknowledgedOperation: PersistedQueueItem = {
      ...makePersistedAction("account-a"),
      operationId: "89898989-8989-4989-8989-898989898989",
    };
    testState.persistedItems.push(acknowledgedOperation);
    localStorage.setItem(
      SK.OFFLINE_QUEUE,
      JSON.stringify({
        actions: [],
        removedOperations: [
          {
            id: acknowledgedOperation.id,
            operationId: acknowledgedOperation.operationId,
          },
        ],
        storageVersion: 3,
        mode: "merge-with-tombstones",
      })
    );

    vi.resetModules();
    const module = await import("../offlineQueue");
    activeQueue = module.offlineQueue;

    await expect(module.offlineQueue.waitForInit()).rejects.toThrow(
      /fallback is unreadable/i
    );
    expect(testState.persistedItems).toEqual([
      expect.objectContaining({
        id: acknowledgedOperation.id,
        operationId: acknowledgedOperation.operationId,
      }),
    ]);
    expect(localStorage.getItem(SK.OFFLINE_QUEUE)).not.toBeNull();
  });

  it("keeps the account boundary suspended when fallback cleanup cannot be confirmed", async () => {
    const { offlineQueue } = await loadFreshQueue();
    await offlineQueue.enqueue(
      "UPDATE_SETTINGS",
      "boundary-cleanup",
      { key: "privacy", value: false },
      { expectedOwnerUserId: "account-a" }
    );
    await offlineQueue.suspendForAccountBoundary();
    const removeItem = vi.spyOn(Storage.prototype, "removeItem").mockImplementationOnce(() => {
      throw new Error("localStorage remove failed");
    });

    await expect(offlineQueue.discardSuspendedActionsForAccountBoundary()).rejects.toThrow(
      /fallback could not be cleared/i
    );
    expect(offlineQueue.isSuspendedForAccountBoundary()).toBe(true);
    expect(offlineQueue.getState().actions).toEqual([
      expect.objectContaining({ entityId: "boundary-cleanup" }),
    ]);
    removeItem.mockRestore();

    await expect(offlineQueue.discardSuspendedActionsForAccountBoundary()).resolves.toEqual({
      status: "discarded",
    });
    expect(offlineQueue.getState().actions).toEqual([]);
  });

  it("does not erase a newer operation enqueued by another tab during delivery", async () => {
    const firstModule = await loadFreshQueue();
    const firstQueue = firstModule.offlineQueue;
    const secondModule = await loadFreshQueue();
    const secondQueue = secondModule.offlineQueue;
    let releaseDelivery!: () => void;
    let markDeliveryStarted!: () => void;
    const deliveryStarted = new Promise<void>((resolve) => {
      markDeliveryStarted = resolve;
    });
    const deliveryGate = new Promise<void>((resolve) => {
      releaseDelivery = resolve;
    });

    firstQueue.registerHandler("UPDATE_SETTINGS", async () => {
      markDeliveryStarted();
      await deliveryGate;
      return COMMITTED;
    });

    try {
      await firstQueue.enqueue(
        "UPDATE_SETTINGS",
        "cross-tab-setting",
        { key: "privacy", value: false },
        { expectedOwnerUserId: "account-a" }
      );
      setOnline(true);
      const processing = firstQueue.processQueue();
      await deliveryStarted;

      setOnline(false);
      await secondQueue.enqueue(
        "UPDATE_SETTINGS",
        "cross-tab-setting",
        { key: "privacy", value: true },
        { expectedOwnerUserId: "account-a" }
      );
      releaseDelivery();
      await processing;

      expect(testState.persistedItems).toEqual([
        expect.objectContaining({
          entityId: "cross-tab-setting",
          payload: { key: "privacy", value: true },
        }),
      ]);
    } finally {
      firstQueue.destroy();
      secondQueue.destroy();
    }
  });

  it("waits for persisted actions before answering an owner pending check", async () => {
    let releaseLoad!: (items: PersistedQueueItem[]) => void;
    dbMocks.offlineQueueTable.toArray.mockReturnValueOnce(
      new Promise<PersistedQueueItem[]>((resolve) => {
        releaseLoad = resolve;
      })
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
      { expectedOwnerUserId: "account-a" }
    );

    await offlineQueue.suspendForAccountBoundary();

    expect(offlineQueue.getPendingCountForOwner("account-a")).toBe(1);
    await expect(
      offlineQueue.enqueue(
        "UPDATE_SETTINGS",
        "privacy",
        { key: "privacy", value: true },
        { expectedOwnerUserId: "account-a" }
      )
    ).rejects.toThrow(/suspended/i);

    await offlineQueue.discardSuspendedActionsForAccountBoundary();
    expect(offlineQueue.getPendingCount()).toBe(0);
  });

  it("aborts an active handler before an account boundary can continue", async () => {
    const { offlineQueue } = await loadFreshQueue();
    let markHandlerStarted!: () => void;
    const handlerStarted = new Promise<void>((resolve) => {
      markHandlerStarted = resolve;
    });
    let observedSignal: AbortSignal | null = null;

    offlineQueue.registerHandler("UPDATE_SETTINGS", async (_action, context) => {
      observedSignal = context.signal;
      markHandlerStarted();
      return new Promise<typeof COMMITTED>((_resolve, reject) => {
        context.signal.addEventListener(
          "abort",
          () => {
            const reason = context.signal.reason;
            reject(
              reason instanceof Error
                ? reason
                : new DOMException("Offline queue attempt aborted", "AbortError")
            );
          },
          { once: true }
        );
      });
    });
    await offlineQueue.enqueue(
      "UPDATE_SETTINGS",
      "boundary-setting",
      { key: "privacy", value: false },
      { expectedOwnerUserId: "account-a" }
    );

    setOnline(true);
    const processing = offlineQueue.processQueue();
    await handlerStarted;
    await offlineQueue.suspendForAccountBoundary();
    await processing;

    expect((observedSignal as unknown as AbortSignal).aborted).toBe(true);
    expect(offlineQueue.getState().actions).toEqual([
      expect.objectContaining({ entityId: "boundary-setting", retries: 0 }),
    ]);
  });

  it("does not let a non-cooperative handler block an account boundary or acknowledge late success", async () => {
    const { offlineQueue } = await loadFreshQueue();
    let markHandlerStarted!: () => void;
    let releaseHandler!: () => void;
    const handlerStarted = new Promise<void>((resolve) => {
      markHandlerStarted = resolve;
    });
    const handlerGate = new Promise<void>((resolve) => {
      releaseHandler = resolve;
    });

    offlineQueue.registerHandler("UPDATE_SETTINGS", async () => {
      markHandlerStarted();
      await handlerGate;
      return COMMITTED;
    });
    await offlineQueue.enqueue(
      "UPDATE_SETTINGS",
      "non-cooperative-boundary-setting",
      { key: "privacy", value: false },
      { expectedOwnerUserId: "account-a" }
    );

    setOnline(true);
    const processing = offlineQueue.processQueue();
    await handlerStarted;
    const boundary = offlineQueue.suspendForAccountBoundary();
    const boundaryOutcome = await Promise.race([
      boundary.then(() => "resolved" as const),
      new Promise<"timed-out">((resolve) => setTimeout(() => resolve("timed-out"), 50)),
    ]);

    releaseHandler();
    await processing;
    await boundary;

    expect(boundaryOutcome).toBe("resolved");
    expect(offlineQueue.getState().actions).toEqual([
      expect.objectContaining({
        entityId: "non-cooperative-boundary-setting",
        retries: 0,
      }),
    ]);
  });

  it("normalizes non-Error handler rejections at the attempt boundary", async () => {
    const { offlineQueue } = await loadFreshQueue();
    const queueWithAttemptBoundary = offlineQueue as unknown as {
      runHandlerAttempt<T>(handlerPromise: Promise<T>, controller: AbortController): Promise<T>;
    };

    await expect(
      queueWithAttemptBoundary.runHandlerAttempt(
        // eslint-disable-next-line @typescript-eslint/prefer-promise-reject-errors -- verifies containment of a malformed third-party handler
        Promise.reject("handler rejected a string"),
        new AbortController()
      )
    ).rejects.toBeInstanceOf(Error);
  });

  it("times out a non-cooperative handler and retains its durable action", async () => {
    vi.useFakeTimers();
    try {
      const { offlineQueue } = await loadFreshQueue();
      let markHandlerStarted!: () => void;
      const handlerStarted = new Promise<void>((resolve) => {
        markHandlerStarted = resolve;
      });
      let releaseHandler!: () => void;
      const handlerGate = new Promise<typeof COMMITTED>((resolve) => {
        releaseHandler = () => resolve(COMMITTED);
      });
      let observedSignal: AbortSignal | null = null;

      offlineQueue.registerHandler("UPDATE_SETTINGS", async (_action, context) => {
        observedSignal = context.signal;
        markHandlerStarted();
        return handlerGate;
      });
      await offlineQueue.enqueue(
        "UPDATE_SETTINGS",
        "timed-out-setting",
        { key: "privacy", value: false },
        { expectedOwnerUserId: "account-a", maxRetries: 1 }
      );

      setOnline(true);
      const processing = offlineQueue.processQueue();
      await handlerStarted;
      await vi.advanceTimersByTimeAsync(30_000);
      const signalWasAborted = (observedSignal as unknown as AbortSignal).aborted;
      releaseHandler();
      await processing;
      const stateAfterDeadline = offlineQueue.getState().actions;

      expect(signalWasAborted).toBe(true);
      expect(stateAfterDeadline).toEqual([
        expect.objectContaining({
          entityId: "timed-out-setting",
          retries: 1,
          lastError: "QUEUE_HANDLER_TIMEOUT",
        }),
      ]);
    } finally {
      vi.useRealTimers();
    }
  });

  it("ignores a late completion and reuses the same operation identity for manual retry", async () => {
    vi.useFakeTimers();
    try {
      const dispatchSpy = vi.spyOn(window, "dispatchEvent");
      const { offlineQueue } = await loadFreshQueue();
      let releaseFirstAttempt!: () => void;
      let markFirstAttemptStarted!: () => void;
      const firstAttemptStarted = new Promise<void>((resolve) => {
        markFirstAttemptStarted = resolve;
      });
      const firstAttemptGate = new Promise<typeof COMMITTED>((resolve) => {
        releaseFirstAttempt = () => resolve(COMMITTED);
      });
      const deliveredOperationIds: string[] = [];

      offlineQueue.registerHandler("UPDATE_SETTINGS", async (_action, context) => {
        deliveredOperationIds.push(context.operationId);
        if (deliveredOperationIds.length === 1) {
          markFirstAttemptStarted();
          return firstAttemptGate;
        }
        return COMMITTED;
      });
      await offlineQueue.enqueue(
        "UPDATE_SETTINGS",
        "late-completion-setting",
        { key: "privacy", value: false },
        { expectedOwnerUserId: "account-a", maxRetries: 1 },
      );
      const operationId = offlineQueue.getState().actions[0]?.operationId;

      setOnline(true);
      const processing = offlineQueue.processQueue();
      await firstAttemptStarted;
      await vi.advanceTimersByTimeAsync(30_000);
      await processing;

      const blockedEvent = dispatchSpy.mock.calls
        .map(([event]) => event)
        .find((event) => event.type === "zenflow:offline-queue-blocked") as
        | CustomEvent<{ retry: () => Promise<void> }>
        | undefined;
      expect(blockedEvent).toBeDefined();
      expect(offlineQueue.getState().actions).toEqual([
        expect.objectContaining({
          operationId,
          retries: 1,
          lastError: "QUEUE_HANDLER_TIMEOUT",
        }),
      ]);

      releaseFirstAttempt();
      await Promise.resolve();
      expect(offlineQueue.getState().actions).toHaveLength(1);

      await blockedEvent?.detail.retry();
      await vi.waitFor(() => {
        expect(deliveredOperationIds).toEqual([operationId, operationId]);
        expect(offlineQueue.getState().actions).toEqual([]);
      });
    } finally {
      vi.useRealTimers();
    }
  });

  it("keeps a user-a action queued instead of executing it under user b", async () => {
    const { offlineQueue } = await loadFreshQueue();
    const handler = vi.fn(async () => COMMITTED);
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
    const handler = vi.fn(async () => COMMITTED);
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
      /owner|account/i
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

  it("preserves an offline journal delete after a queued edit of an existing entry", async () => {
    const { compactQueue } = await loadFreshQueue();
    const base = {
      entityId: "existing-journal-entry",
      ownerUserId: "account-a",
      retries: 0,
      maxRetries: 5,
      priority: "normal" as const,
    };

    const compacted = compactQueue([
      {
        ...base,
        id: "journal-edit",
        type: "SYNC_JOURNAL_ENTRY",
        payload: { id: base.entityId, content: "offline edit" },
        timestamp: 1,
      },
      {
        ...base,
        id: "journal-delete",
        type: "DELETE_JOURNAL_ENTRY",
        payload: null,
        timestamp: 2,
      },
    ]);

    expect(compacted).toHaveLength(1);
    expect(compacted[0]).toMatchObject({
      id: "journal-delete",
      type: "DELETE_JOURNAL_ENTRY",
      entityId: base.entityId,
      ownerUserId: "account-a",
    });
  });

  it("keeps an offline journal delete authoritative when a stale sync is queued later", async () => {
    const { compactQueue } = await loadFreshQueue();
    const base = {
      entityId: "existing-journal-entry",
      ownerUserId: "account-a",
      retries: 0,
      maxRetries: 5,
      priority: "normal" as const,
    };

    const compacted = compactQueue([
      {
        ...base,
        id: "journal-delete",
        type: "DELETE_JOURNAL_ENTRY",
        payload: null,
        timestamp: 1,
      },
      {
        ...base,
        id: "stale-journal-sync",
        type: "SYNC_JOURNAL_ENTRY",
        payload: { id: base.entityId, content: "stale offline edit" },
        timestamp: 2,
      },
    ]);

    expect(compacted).toHaveLength(1);
    expect(compacted[0]).toMatchObject({
      id: "journal-delete",
      type: "DELETE_JOURNAL_ENTRY",
      entityId: base.entityId,
      ownerUserId: "account-a",
    });
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
    testState.localOwnerUserId = "account-b";
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
      }
    );
    await offlineQueue.enqueue(
      "UPDATE_SETTINGS",
      "privacy",
      { key: "privacy", value: false },
      { expectedOwnerUserId: "account-a" }
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
      }
    );
    await offlineQueue.enqueue(
      "UPDATE_SETTINGS",
      "aba-setting",
      { key: "privacy", value: false },
      { expectedOwnerUserId: "account-a" }
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
      { expectedOwnerUserId: "account-a" }
    );

    await offlineQueue.suspendAndClearForAccountBoundary();

    expect(offlineQueue.getState().actions).toEqual([]);
    expect(testState.persistedItems).toEqual([]);
    await expect(
      offlineQueue.enqueue(
        "UPDATE_SETTINGS",
        "late-account-a-setting",
        { key: "privacy", value: true },
        { expectedOwnerUserId: "account-a" }
      )
    ).rejects.toThrow(/account boundary|suspended/i);

    testState.currentUserId = "account-b";
    testState.localOwnerUserId = "account-b";
    offlineQueue.resumeAfterAccountBoundary();
    await offlineQueue.enqueue(
      "UPDATE_SETTINGS",
      "account-b-setting",
      { key: "privacy", value: true },
      { expectedOwnerUserId: "account-b" }
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
            { expectedOwnerUserId: "account-a" }
          );
        }
        return COMMITTED;
      });
      await offlineQueue.enqueue(
        "UPDATE_SETTINGS",
        "retry-setting",
        { key: "privacy", value: false },
        { expectedOwnerUserId: "account-a" }
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
          { expectedOwnerUserId: "account-a" }
        );
        setOnline(false);
      }
      return COMMITTED;
    });
    await offlineQueue.enqueue(
      "UPDATE_SETTINGS",
      "retry-budget-setting",
      { key: "privacy", value: false },
      { expectedOwnerUserId: "account-a", maxRetries: 1 }
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
      }
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

  it("does not deliver a newer critical focus payload after its predecessor fails", async () => {
    testState.persistedItems.push(
      {
        id: "focus-reflection-4",
        operationId: "44444444-4444-4444-8444-444444444444",
        type: "CREATE_FOCUS_SESSION",
        entityId: "focus-session-ordered",
        payload: { id: "focus-session-ordered", reflection: 4 },
        timestamp: 1,
        retries: 0,
        maxRetries: 1,
        priority: "critical",
        ownerUserId: "account-a",
      },
      {
        id: "focus-reflection-5",
        operationId: "55555555-5555-4555-8555-555555555555",
        type: "CREATE_FOCUS_SESSION",
        entityId: "focus-session-ordered",
        payload: { id: "focus-session-ordered", reflection: 5 },
        timestamp: 2,
        retries: 0,
        maxRetries: 1,
        priority: "critical",
        ownerUserId: "account-a",
      }
    );
    const { offlineQueue } = await loadFreshQueue();
    const deliveredReflections: number[] = [];
    offlineQueue.registerHandler("CREATE_FOCUS_SESSION", async (action) => {
      const reflection = (action.payload as { reflection: number }).reflection;
      deliveredReflections.push(reflection);
      if (reflection === 4) throw new Error("transient focus delivery failure");
      return COMMITTED;
    });

    setOnline(true);
    await offlineQueue.processQueue();

    expect(deliveredReflections).toEqual([4]);
    expect(offlineQueue.getState().actions).toEqual([
      expect.objectContaining({ id: "focus-reflection-4", retries: 1 }),
      expect.objectContaining({ id: "focus-reflection-5", retries: 0 }),
    ]);
  });

  it("does not let critical undo overtake a failed manual target delivery", async () => {
    testState.persistedItems.push(
      {
        id: "manual-schedule-write",
        operationId: "66666666-6666-4666-8666-666666666666",
        type: "UPDATE_SETTINGS",
        entityId: "zenflow-schedule-events",
        payload: { key: "zenflow-schedule-events", value: [{ id: "manual" }] },
        timestamp: 1,
        retries: 0,
        maxRetries: 1,
        priority: "critical",
        ownerUserId: "account-a",
      },
      {
        id: "automation-undo-after-manual",
        operationId: "77777777-7777-4777-8777-777777777777",
        type: "UNDO_AUTOMATION_TRANSACTION",
        entityId: "88888888-8888-4888-8888-888888888888",
        payload: { transactionId: "88888888-8888-4888-8888-888888888888" },
        timestamp: 2,
        retries: 0,
        maxRetries: 1,
        priority: "critical",
        ownerUserId: "account-a",
      }
    );
    const { offlineQueue } = await loadFreshQueue();
    const delivered: string[] = [];
    offlineQueue.registerHandler("UPDATE_SETTINGS", async () => {
      delivered.push("manual");
      throw new Error("manual delivery unavailable");
    });
    offlineQueue.registerHandler("UNDO_AUTOMATION_TRANSACTION", async () => {
      delivered.push("undo");
      return COMMITTED;
    });

    setOnline(true);
    await offlineQueue.processQueue();

    expect(delivered).toEqual(["manual"]);
    expect(offlineQueue.getState().actions).toEqual([
      expect.objectContaining({ id: "manual-schedule-write", retries: 1 }),
      expect.objectContaining({ id: "automation-undo-after-manual", retries: 0 }),
    ]);
  });

  it("retains an exhausted normal action and exposes a manual retry", async () => {
    const dispatchSpy = vi.spyOn(window, "dispatchEvent");
    const { offlineQueue } = await loadFreshQueue();
    const handler = vi.fn(async () => {
      throw new Error("temporary sync failure");
    });
    offlineQueue.registerHandler("UPDATE_SETTINGS", handler);
    await offlineQueue.enqueue(
      "UPDATE_SETTINGS",
      "normal-blocked-setting",
      { key: "privacy", value: true },
      { expectedOwnerUserId: "account-a", maxRetries: 1 }
    );

    setOnline(true);
    await offlineQueue.processQueue();

    expect(offlineQueue.getState().actions).toEqual([
      expect.objectContaining({
        entityId: "normal-blocked-setting",
        retries: 1,
        lastError: "QUEUE_HANDLER_FAILED",
      }),
    ]);
    expect(
      dispatchSpy.mock.calls
        .map(([event]) => event)
        .find((event) => event.type === "zenflow:offline-queue-blocked")
    ).toMatchObject({ detail: { retry: expect.any(Function) } });
  });

  it("keeps an aborted journal sync without consuming its retry budget", async () => {
    const { offlineQueue } = await loadFreshQueue();
    const handler = vi.fn(async () => {
      throw new DOMException("page lifecycle paused the request", "AbortError");
    });
    offlineQueue.registerHandler("SYNC_JOURNAL_ENTRY", handler);
    await offlineQueue.enqueue(
      "SYNC_JOURNAL_ENTRY",
      "journal-entry-aborted",
      { id: "journal-entry-aborted", date: "2026-07-13" },
      {
        expectedOwnerUserId: "account-a",
        maxRetries: 1,
      }
    );

    setOnline(true);
    await offlineQueue.processQueue();

    expect(handler).toHaveBeenCalledTimes(1);
    expect(offlineQueue.getState().actions).toEqual([
      expect.objectContaining({
        entityId: "journal-entry-aborted",
        retries: 0,
      }),
    ]);
  });

  it("retries an aborted journal sync with bounded backoff while online and visible", async () => {
    vi.useFakeTimers();
    try {
      const { offlineQueue } = await loadFreshQueue();
      const handler = vi
        .fn<() => Promise<typeof COMMITTED>>()
        .mockRejectedValueOnce(new DOMException("page lifecycle paused the request", "AbortError"))
        .mockResolvedValue(COMMITTED);
      offlineQueue.registerHandler("SYNC_JOURNAL_ENTRY", handler);
      await offlineQueue.enqueue(
        "SYNC_JOURNAL_ENTRY",
        "journal-entry-aborted-retry",
        { id: "journal-entry-aborted-retry", date: "2026-07-13" },
        { expectedOwnerUserId: "account-a", maxRetries: 1 }
      );

      setOnline(true);
      await offlineQueue.processQueue();
      expect(handler).toHaveBeenCalledTimes(1);

      await vi.advanceTimersByTimeAsync(1_000);
      await vi.waitFor(() => expect(handler).toHaveBeenCalledTimes(2));
      await vi.waitFor(() => expect(offlineQueue.getState().actions).toEqual([]));
    } finally {
      vi.useRealTimers();
    }
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
      }
    );

    setOnline(true);
    await offlineQueue.processQueue();

    expect(offlineQueue.getState().actions).toEqual([
      expect.objectContaining({
        type: "DELETE_JOURNAL_PHOTO_STORAGE",
        retries: 1,
        lastError: "QUEUE_HANDLER_FAILED",
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
    const handler = vi.fn(async () => COMMITTED);
    offlineQueue.registerHandler("DELETE_JOURNAL_PHOTO_STORAGE", handler);
    await offlineQueue.replayBlockedCriticalActionsForActiveOwner();

    expect(offlineQueue.getPendingCountForOwner("account-a")).toBe(1);
    const blockedEvent = dispatchSpy.mock.calls
      .map(([event]) => event)
      .find((event) => event.type === "zenflow:offline-queue-critical-blocked") as
      | CustomEvent<{ actionType: string; retry: () => void }>
      | undefined;
    expect(blockedEvent).toBeDefined();
    expect(blockedEvent?.detail).toMatchObject({
      actionType: "DELETE_JOURNAL_PHOTO_STORAGE",
      retry: expect.any(Function),
    });
    expect(blockedEvent?.detail).not.toHaveProperty("entityId");

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
        ([event]) => event.type === "zenflow:offline-queue-critical-blocked"
      )
    ).toBe(false);

    testState.currentUserId = "account-a";
    offlineQueue.observeAuthStateOwner("account-a");
    await expect(offlineQueue.replayBlockedCriticalActionsForActiveOwner()).resolves.toBe(1);

    expect(
      dispatchSpy.mock.calls.some(
        ([event]) => event.type === "zenflow:offline-queue-critical-blocked"
      )
    ).toBe(true);
  });

  it("does not replay a blocked action when the durable local owner differs", async () => {
    testState.persistedItems.push({
      ...makePersistedAction("account-a"),
      id: "persisted-critical-owner-mismatch",
      type: "WRITE_SYNC_EVENT",
      retries: 1,
      maxRetries: 1,
      lastError: "event store unavailable",
      priority: "critical",
    });
    testState.localOwnerUserId = "account-b";
    const dispatchSpy = vi.spyOn(window, "dispatchEvent");
    const { offlineQueue } = await loadFreshQueue();

    await expect(
      offlineQueue.replayBlockedCriticalActionsForActiveOwner("account-a")
    ).resolves.toBe(0);

    expect(
      dispatchSpy.mock.calls.some(
        ([event]) => event.type === "zenflow:offline-queue-critical-blocked"
      )
    ).toBe(false);
  });

  it("does not dispatch when authentication changes during replay validation", async () => {
    testState.persistedItems.push({
      ...makePersistedAction("account-a"),
      id: "persisted-critical-session-race",
      type: "WRITE_SYNC_EVENT",
      retries: 1,
      maxRetries: 1,
      lastError: "event store unavailable",
      priority: "critical",
    });
    const dispatchSpy = vi.spyOn(window, "dispatchEvent");
    const { offlineQueue } = await loadFreshQueue();
    sessionMocks.getCurrentSessionUserId
      .mockResolvedValueOnce("account-a")
      .mockResolvedValueOnce("account-b");

    await expect(
      offlineQueue.replayBlockedCriticalActionsForActiveOwner("account-a")
    ).resolves.toBe(0);

    expect(
      dispatchSpy.mock.calls.some(
        ([event]) => event.type === "zenflow:offline-queue-critical-blocked"
      )
    ).toBe(false);
  });

  it("does not replay or retry blocked work while an imported backup claim is unresolved", async () => {
    testState.persistedItems.push({
      ...makePersistedAction("account-a"),
      id: "persisted-critical-pending-claim",
      type: "WRITE_SYNC_EVENT",
      retries: 1,
      maxRetries: 1,
      lastError: "event store unavailable",
      priority: "critical",
    });
    expect(markPendingLocalBackupAccountClaim()).toBe(true);
    const dispatchSpy = vi.spyOn(window, "dispatchEvent");
    const { offlineQueue } = await loadFreshQueue();

    await expect(
      offlineQueue.replayBlockedCriticalActionsForActiveOwner("account-a")
    ).resolves.toBe(0);

    expect(
      dispatchSpy.mock.calls.some(
        ([event]) => event.type === "zenflow:offline-queue-critical-blocked"
      )
    ).toBe(false);
  });

  it("rolls back a manual retry when the owner changes during durable persistence", async () => {
    testState.persistedItems.push({
      ...makePersistedAction("account-a"),
      id: "persisted-critical-retry-race",
      type: "WRITE_SYNC_EVENT",
      retries: 1,
      maxRetries: 1,
      lastError: "event store unavailable",
      priority: "critical",
    });
    const dispatchSpy = vi.spyOn(window, "dispatchEvent");
    const { offlineQueue } = await loadFreshQueue();
    await offlineQueue.replayBlockedCriticalActionsForActiveOwner("account-a");
    const blockedEvent = dispatchSpy.mock.calls
      .map(([event]) => event)
      .find((event) => event.type === "zenflow:offline-queue-critical-blocked") as
      | CustomEvent<{ retry: () => Promise<void> }>
      | undefined;
    expect(blockedEvent).toBeDefined();

    let releasePersist!: () => void;
    const persistStarted = new Promise<void>((resolve) => {
      dbMocks.offlineQueueTable.bulkPut.mockImplementationOnce(async (items) => {
        resolve();
        await new Promise<void>((release) => {
          releasePersist = release;
        });
        for (const item of items) {
          const index = testState.persistedItems.findIndex(
            (candidate) => candidate.id === item.id
          );
          if (index === -1) testState.persistedItems.push({ ...item });
          else testState.persistedItems[index] = { ...item };
        }
      });
    });

    const retry = blockedEvent?.detail.retry();
    await persistStarted;
    testState.currentUserId = "account-b";
    testState.localOwnerUserId = "account-b";
    releasePersist();

    await expect(retry).rejects.toMatchObject({ name: "OfflineQueueOwnerBoundaryError" });
    expect(offlineQueue.getState().actions[0]).toMatchObject({
      retries: 1,
      lastError: "event store unavailable",
    });
    expect(testState.persistedItems[0]).toMatchObject({
      retries: 1,
      lastError: "event store unavailable",
    });
  });

  it("does not resurrect a blocked row cleared across a same-user account boundary", async () => {
    testState.persistedItems.push({
      ...makePersistedAction("account-a"),
      id: "persisted-critical-stale-callback",
      operationId: "operation-before-boundary",
      type: "WRITE_SYNC_EVENT",
      retries: 1,
      maxRetries: 1,
      lastError: "event store unavailable",
      priority: "critical",
    });
    const dispatchSpy = vi.spyOn(window, "dispatchEvent");
    const { offlineQueue } = await loadFreshQueue();
    await offlineQueue.replayBlockedCriticalActionsForActiveOwner("account-a");
    const blockedEvent = dispatchSpy.mock.calls
      .map(([event]) => event)
      .find((event) => event.type === "zenflow:offline-queue-critical-blocked") as
      | CustomEvent<{ retry: () => Promise<void> }>
      | undefined;
    expect(blockedEvent).toBeDefined();

    testState.persistedItems.splice(0);
    advanceOriginAccountBoundaryGeneration();
    const writesBeforeRetry = dbMocks.offlineQueueTable.bulkPut.mock.calls.length;

    await expect(blockedEvent?.detail.retry()).rejects.toMatchObject({
      name: "OfflineQueueOwnerBoundaryError",
    });
    expect(testState.persistedItems).toEqual([]);
    expect(dbMocks.offlineQueueTable.bulkPut).toHaveBeenCalledTimes(writesBeforeRetry);
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
      | CustomEvent<{ actionType: string; retry: () => void }>
      | undefined;
    await vi.waitFor(() => {
      blockedEvent = dispatchSpy.mock.calls
        .map(([event]) => event)
        .find((event) => event.type === "zenflow:offline-queue-critical-blocked") as
        | CustomEvent<{ actionType: string; retry: () => void }>
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

    const handler = vi.fn(async () => COMMITTED);
    offlineQueue.registerHandler("WRITE_SYNC_EVENT", handler);
    await offlineQueue.processQueue();

    expect(handler).toHaveBeenCalledTimes(1);
    expect(offlineQueue.getState().actions).toEqual([]);
  });
});

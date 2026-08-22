import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { OfflineAction, OfflineQueueHandlerContext } from "@/lib/offlineQueue";

interface PersistedQueueItem {
  id: string;
  operationId?: string;
  type: string;
  entityId: string;
  ownerUserId?: string;
  payload: unknown;
  timestamp: number;
  retries: number;
  maxRetries: number;
  lastError?: string;
  priority?: string;
}

const OWNER_ID = "11111111-1111-4111-8111-111111111111";
const TRANSACTION_ID = "22222222-2222-4222-8222-222222222222";

const testState = vi.hoisted(() => ({
  persistedItems: [] as PersistedQueueItem[],
}));

const dbMocks = vi.hoisted(() => {
  const offlineQueue = {
    toArray: vi.fn(async () => testState.persistedItems.map((item) => ({ ...item }))),
    clear: vi.fn(async () => {
      testState.persistedItems.splice(0);
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
      const index = testState.persistedItems.findIndex((candidate) => candidate.id === id);
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
    offlineQueue,
    transaction: vi.fn(async (...args: unknown[]) => {
      const callback = args.at(-1) as () => Promise<unknown>;
      return callback();
    }),
  };
});

vi.mock("@/storage/db", () => ({
  db: {
    offlineQueue: dbMocks.offlineQueue,
    transaction: dbMocks.transaction,
  },
  getLocalDataOwnerId: vi.fn(async () => OWNER_ID),
}));

vi.mock("@/lib/supabaseClient", () => ({
  getCurrentSessionUserId: vi.fn(async () => OWNER_ID),
}));

vi.mock("@/storage/accountBoundaryRuntime", () => ({
  captureOriginAccountBoundaryGeneration: vi.fn(() => "generation-a"),
  isOriginAccountBoundaryGenerationCurrent: vi.fn(() => true),
  readPendingLocalBackupAccountClaim: vi.fn(() => ({ status: "none" as const })),
}));

vi.mock("@/lib/originExclusiveLock", () => ({
  runWithOriginExclusiveLock: vi.fn(async (_name: string, operation: () => unknown) => operation()),
}));

vi.mock("@/lib/logger", () => ({
  logger: { error: vi.fn(), log: vi.fn(), warn: vi.fn() },
}));

vi.mock("@/observability/syncHealthRecorder", () => ({
  recordSyncHealthReceipt: vi.fn(),
}));

type OfflineQueueModule = typeof import("@/lib/offlineQueue");
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
  const module = await import("@/lib/offlineQueue");
  await module.offlineQueue.waitForInit();
  activeQueue = module.offlineQueue;
  return module;
}

function persistedAction(overrides: Partial<PersistedQueueItem>): PersistedQueueItem {
  return {
    id: "normal-row",
    operationId: "33333333-3333-4333-8333-333333333333",
    type: "UPDATE_SETTINGS",
    entityId: "unrelated-setting",
    ownerUserId: OWNER_ID,
    payload: { key: "theme", value: "paper" },
    timestamp: 1,
    retries: 0,
    maxRetries: 5,
    priority: "normal",
    ...overrides,
  };
}

describe("automation outbox cold-start durability", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
    testState.persistedItems.splice(0);
    setOnline(false);
  });

  afterEach(() => {
    activeQueue?.destroy();
    activeQueue = null;
    setOnline(true);
  });

  it("rehydrates one stable commit row and delivers it exactly once independent of row order", async () => {
    const stableRow = persistedAction({
      id: `automation-commit:${TRANSACTION_ID}`,
      operationId: TRANSACTION_ID,
      type: "COMMIT_AUTOMATION_TRANSACTION",
      entityId: TRANSACTION_ID,
      payload: {
        schemaVersion: 1,
        transactionId: TRANSACTION_ID,
        expectedPreferenceRevision: 4,
        expectedHistoryGeneration: 2,
        deviceId: "android-install-1",
      },
      timestamp: 2,
      priority: "critical",
    });
    testState.persistedItems.push(persistedAction({}), stableRow);

    const firstProcess = await loadFreshQueue();
    expect(firstProcess.offlineQueue.getState().actions).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: stableRow.id,
          operationId: TRANSACTION_ID,
          entityId: TRANSACTION_ID,
          priority: "critical",
        }),
      ])
    );

    setOnline(true);
    await firstProcess.offlineQueue.processQueue();
    expect(testState.persistedItems).toEqual(expect.arrayContaining([stableRow]));

    setOnline(false);
    firstProcess.offlineQueue.destroy();
    activeQueue = null;

    testState.persistedItems.reverse();
    const restarted = await loadFreshQueue();
    const delivered: Array<{
      action: OfflineAction;
      context: OfflineQueueHandlerContext;
    }> = [];
    restarted.offlineQueue.registerHandler(
      "COMMIT_AUTOMATION_TRANSACTION",
      async (action, context) => {
        delivered.push({ action, context });
        return { status: "committed" };
      }
    );

    setOnline(true);
    await restarted.offlineQueue.processQueue();
    await restarted.offlineQueue.processQueue();

    expect(delivered).toHaveLength(1);
    expect(delivered[0]).toMatchObject({
      action: {
        id: stableRow.id,
        operationId: TRANSACTION_ID,
        entityId: TRANSACTION_ID,
        ownerUserId: OWNER_ID,
      },
      context: {
        operationId: TRANSACTION_ID,
        ownerUserId: OWNER_ID,
      },
    });
    expect(restarted.offlineQueue.getState().actions).toEqual([
      expect.objectContaining({ id: "normal-row", priority: "normal" }),
    ]);
    expect(testState.persistedItems).toEqual([
      expect.objectContaining({ id: "normal-row", priority: "normal" }),
    ]);
  });
});

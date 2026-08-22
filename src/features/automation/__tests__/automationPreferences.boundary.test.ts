import { beforeEach, describe, expect, it, vi } from "vitest";

const OWNER_ID = "11111111-1111-4111-8111-111111111111";
const CONSENT_EPOCH = "22222222-2222-4222-8222-222222222222";

const runtime = vi.hoisted<{
  boundaryGeneration: string;
  ownerUserId: string | null;
}>(() => ({
  boundaryGeneration: "boundary-a",
  ownerUserId: "11111111-1111-4111-8111-111111111111",
}));

const lockRuntime = vi.hoisted<{
  beforeDataWrite: (() => Promise<void>) | null;
  dataWriteEntries: number;
}>(() => ({
  beforeDataWrite: null,
  dataWriteEntries: 0,
}));

const mocks = vi.hoisted(() => ({
  enqueue: vi.fn(),
  persistCritical: vi.fn(),
  processQueue: vi.fn(),
  rpc: vi.fn(),
  triggerDataRefresh: vi.fn(),
}));

vi.mock("@/lib/supabaseClient", () => ({
  supabase: { rpc: mocks.rpc },
}));

vi.mock("@/lib/offlineQueue", () => ({
  persistCriticalOfflineActionInCurrentTransaction: mocks.persistCritical,
  offlineQueue: {
    enqueue: mocks.enqueue,
    getState: () => ({ actions: [] }),
    processQueue: mocks.processQueue,
  },
}));

vi.mock("@/hooks/useIndexedDB", () => ({
  triggerDataRefresh: mocks.triggerDataRefresh,
}));

vi.mock("@/storage/sync/syncOwner", () => ({
  validateSyncOwner: vi.fn(async (expectedOwnerUserId?: string) =>
    runtime.ownerUserId !== null &&
    (!expectedOwnerUserId || expectedOwnerUserId === runtime.ownerUserId)
      ? runtime.ownerUserId
      : null
  ),
}));

vi.mock("@/storage/accountBoundaryRuntime", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/storage/accountBoundaryRuntime")>();
  return {
    ...actual,
    captureOriginAccountBoundaryGeneration: vi.fn(() => runtime.boundaryGeneration),
    isOriginAccountBoundaryGenerationCurrent: vi.fn(
      (generation: string) => generation === runtime.boundaryGeneration
    ),
  };
});

vi.mock("@/lib/originExclusiveLock", () => ({
  runWithOriginExclusiveLock: vi.fn(async (name: string, operation: () => unknown) => {
    if (name === "zenflow:data-write-barrier") {
      lockRuntime.dataWriteEntries += 1;
      await lockRuntime.beforeDataWrite?.();
    }
    return operation();
  }),
}));

vi.mock("@/lib/logger", () => ({
  logger: { log: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

import { db } from "@/storage/db";
import { notifyAccountSessionTransition } from "@/storage/accountBoundaryRuntime";
import {
  enableAutomationPreference,
  flushAutomationPreferenceRevocation,
  refreshAutomationPreference,
  revokeAutomationPreference,
} from "../automationPreferences";
import { AUTOMATION_PREFERENCE_SETTING_KEY, type AutomationPreference } from "../types";

function preference(overrides: Partial<AutomationPreference> = {}): AutomationPreference {
  return {
    schemaVersion: 1,
    enabled: true,
    serverRevision: 4,
    consentEpoch: CONSENT_EPOCH,
    consentedAt: 40,
    revokedAt: null,
    revocationPending: false,
    enabledRuleIds: ["mood.note-to-journal.v1"],
    focusHabitId: null,
    focusMinimumMinutes: 25,
    planningHabitMappings: {},
    updatedAt: 40,
    ...overrides,
  };
}

async function seedPreference(value: AutomationPreference): Promise<void> {
  await db.settings.put({ key: AUTOMATION_PREFERENCE_SETTING_KEY, value });
}

function deferredRpcResult() {
  let resolve!: (value: { data: AutomationPreference; error: null }) => void;
  const promise = new Promise<{ data: AutomationPreference; error: null }>((done) => {
    resolve = done;
  });
  return { promise, resolve };
}

function switchAccountDuringNextDataWrite(): void {
  lockRuntime.beforeDataWrite = async () => {
    runtime.boundaryGeneration = "boundary-b";
    runtime.ownerUserId = null;
    await db.transaction(
      "rw",
      [db.settings, db.offlineQueue, db.automationTransactions],
      async () => {
        await db.settings.clear();
        await db.offlineQueue.clear();
        await db.automationTransactions.clear();
      }
    );
  };
}

describe("automation preference account-boundary writes", () => {
  beforeEach(async () => {
    vi.clearAllMocks();
    runtime.boundaryGeneration = "boundary-a";
    runtime.ownerUserId = OWNER_ID;
    lockRuntime.beforeDataWrite = null;
    lockRuntime.dataWriteEntries = 0;
    Object.defineProperty(navigator, "onLine", { configurable: true, value: true });
    await db.open();
    await db.transaction(
      "rw",
      [db.settings, db.offlineQueue, db.automationTransactions],
      async () => {
        await db.settings.clear();
        await db.offlineQueue.clear();
        await db.automationTransactions.clear();
      }
    );
    mocks.persistCritical.mockImplementation(
      async (
        type: string,
        entityId: string,
        payload: unknown,
        ownerUserId: string,
        identity: { id: string }
      ) => {
        await db.offlineQueue.add({
          id: identity.id,
          operationId: "33333333-3333-4333-8333-333333333333",
          type,
          entityId,
          ownerUserId,
          payload,
          timestamp: 1,
          retries: 0,
          maxRetries: 5,
          priority: "critical",
        });
      }
    );
    mocks.enqueue.mockResolvedValue(undefined);
    mocks.processQueue.mockResolvedValue(undefined);
    mocks.triggerDataRefresh.mockResolvedValue(undefined);
  });

  it("does not restore an enabled preference after account cleanup wins DATA", async () => {
    mocks.rpc.mockResolvedValue({
      data: preference({ serverRevision: 5, consentedAt: 50, updatedAt: 50 }),
      error: null,
    });
    switchAccountDuringNextDataWrite();

    await expect(
      enableAutomationPreference(
        {
          enabledRuleIds: ["mood.note-to-journal.v1"],
          focusHabitId: null,
          focusMinimumMinutes: 25,
          planningHabitMappings: {},
        },
        OWNER_ID
      )
    ).rejects.toMatchObject({ code: "AUTOMATION_PREFERENCE_OWNER_UNAVAILABLE" });

    expect(lockRuntime.dataWriteEntries).toBe(1);
    await expect(db.settings.get(AUTOMATION_PREFERENCE_SETTING_KEY)).resolves.toBeUndefined();
  });

  it("does not write a local revocation after account cleanup wins DATA", async () => {
    await seedPreference(preference());
    Object.defineProperty(navigator, "onLine", { configurable: true, value: false });
    switchAccountDuringNextDataWrite();

    await expect(revokeAutomationPreference(OWNER_ID, 60)).rejects.toMatchObject({
      code: "AUTOMATION_PREFERENCE_OWNER_UNAVAILABLE",
    });

    expect(lockRuntime.dataWriteEntries).toBe(1);
    expect(mocks.enqueue).not.toHaveBeenCalled();
    await expect(db.settings.get(AUTOMATION_PREFERENCE_SETTING_KEY)).resolves.toBeUndefined();
  });

  it("does not restore an accepted revocation after account cleanup wins DATA", async () => {
    await seedPreference(
      preference({ enabled: false, consentEpoch: null, revokedAt: 60, revocationPending: true })
    );
    mocks.rpc.mockResolvedValue({
      data: preference({
        enabled: false,
        serverRevision: 5,
        consentEpoch: null,
        revokedAt: 60,
        revocationPending: false,
        updatedAt: 61,
      }),
      error: null,
    });
    switchAccountDuringNextDataWrite();

    await expect(
      flushAutomationPreferenceRevocation({ schemaVersion: 1, requestedAt: 60 }, OWNER_ID)
    ).rejects.toMatchObject({ code: "AUTOMATION_PREFERENCE_OWNER_UNAVAILABLE" });

    expect(lockRuntime.dataWriteEntries).toBe(1);
    await expect(db.settings.get(AUTOMATION_PREFERENCE_SETTING_KEY)).resolves.toBeUndefined();
  });

  it("does not restore a refreshed preference after account cleanup wins DATA", async () => {
    await seedPreference(preference());
    mocks.rpc.mockResolvedValue({
      data: preference({ serverRevision: 5, updatedAt: 50 }),
      error: null,
    });
    switchAccountDuringNextDataWrite();

    await expect(refreshAutomationPreference(OWNER_ID)).rejects.toMatchObject({
      code: "AUTOMATION_PREFERENCE_OWNER_UNAVAILABLE",
    });

    expect(lockRuntime.dataWriteEntries).toBe(1);
    await expect(db.settings.get(AUTOMATION_PREFERENCE_SETTING_KEY)).resolves.toBeUndefined();
  });

  it("does not write a late enable response after an ABA session transition", async () => {
    mocks.rpc.mockImplementationOnce(async () => {
      notifyAccountSessionTransition();
      notifyAccountSessionTransition();
      return {
        data: preference({ serverRevision: 5, consentedAt: 50, updatedAt: 50 }),
        error: null,
      };
    });

    await expect(
      enableAutomationPreference(
        {
          enabledRuleIds: ["mood.note-to-journal.v1"],
          focusHabitId: null,
          focusMinimumMinutes: 25,
          planningHabitMappings: {},
        },
        OWNER_ID
      )
    ).rejects.toMatchObject({ code: "AUTOMATION_PREFERENCE_OWNER_UNAVAILABLE" });

    expect(lockRuntime.dataWriteEntries).toBe(0);
    await expect(db.settings.get(AUTOMATION_PREFERENCE_SETTING_KEY)).resolves.toBeUndefined();
  });

  it("does not let an older same-owner refresh overwrite a newer server revision", async () => {
    await seedPreference(preference({ serverRevision: 5, updatedAt: 50 }));
    const older = deferredRpcResult();
    const newer = deferredRpcResult();
    mocks.rpc.mockReturnValueOnce(older.promise).mockReturnValueOnce(newer.promise);

    const olderRefresh = refreshAutomationPreference(OWNER_ID);
    await vi.waitFor(() => expect(mocks.rpc).toHaveBeenCalledTimes(1));
    const newerRefresh = refreshAutomationPreference(OWNER_ID);
    await vi.waitFor(() => expect(mocks.rpc).toHaveBeenCalledTimes(2));

    newer.resolve({
      data: preference({ serverRevision: 7, updatedAt: 70 }),
      error: null,
    });
    await expect(newerRefresh).resolves.toMatchObject({ serverRevision: 7 });

    older.resolve({
      data: preference({ serverRevision: 6, updatedAt: 60 }),
      error: null,
    });
    await expect(olderRefresh).resolves.toMatchObject({ serverRevision: 7 });
    await expect(db.settings.get(AUTOMATION_PREFERENCE_SETTING_KEY)).resolves.toMatchObject({
      value: expect.objectContaining({ serverRevision: 7, updatedAt: 70 }),
    });
  });

  it("does not let an in-flight enabled refresh overwrite a newer local revocation", async () => {
    await seedPreference(preference({ serverRevision: 5, updatedAt: 50 }));
    const staleEnabled = deferredRpcResult();
    mocks.rpc.mockReturnValueOnce(staleEnabled.promise);

    const refresh = refreshAutomationPreference(OWNER_ID);
    await vi.waitFor(() => expect(mocks.rpc).toHaveBeenCalledTimes(1));
    await seedPreference(
      preference({
        enabled: false,
        serverRevision: 5,
        consentEpoch: null,
        revokedAt: 80,
        revocationPending: true,
        updatedAt: 80,
      })
    );

    staleEnabled.resolve({
      data: preference({ serverRevision: 6, updatedAt: 60 }),
      error: null,
    });
    await expect(refresh).resolves.toMatchObject({
      enabled: false,
      revocationPending: true,
      updatedAt: 80,
    });
    await expect(db.settings.get(AUTOMATION_PREFERENCE_SETTING_KEY)).resolves.toMatchObject({
      value: expect.objectContaining({
        enabled: false,
        revocationPending: true,
        updatedAt: 80,
      }),
    });
  });
});

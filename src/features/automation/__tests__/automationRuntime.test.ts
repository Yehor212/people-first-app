import { beforeEach, describe, expect, it, vi } from "vitest";

const OWNER_ID = "11111111-1111-4111-8111-111111111111";

const mocks = vi.hoisted(() => ({
  getCurrentUserId: vi.fn(),
  getPersistentDeviceId: vi.fn(),
  bootstrap: vi.fn(),
  purge: vi.fn(),
  remote: vi.fn(),
  refresh: vi.fn(),
  process: vi.fn(),
  triggerDataRefresh: vi.fn(),
  recoverDeferredSources: vi.fn(),
  signalAutomationSourceReady: vi.fn(),
  rows: [] as Array<Record<string, unknown>>,
  warn: vi.fn(),
}));

vi.mock("@/lib/logger", () => ({
  logger: { warn: mocks.warn },
}));
vi.mock("@/lib/supabaseClient", () => ({ getCurrentUserId: mocks.getCurrentUserId }));
vi.mock("@/storage/eventSync", () => ({
  getPersistentDeviceId: mocks.getPersistentDeviceId,
  reconcilePendingAutomationEvents: mocks.remote,
}));
vi.mock("@/hooks/useIndexedDB", () => ({ triggerDataRefresh: mocks.triggerDataRefresh }));
vi.mock("@/storage/db", () => ({
  db: {
    automationTransactions: {
      where: vi.fn(() => ({
        equals: vi.fn(() => ({ toArray: vi.fn(async () => mocks.rows) })),
      })),
    },
  },
}));
vi.mock("../automationBootstrap", () => ({ bootstrapAutomationHistoryOnce: mocks.bootstrap }));
vi.mock("../automationHistoryClear", () => ({
  reconcilePendingAutomationHistoryPurges: mocks.purge,
}));
vi.mock("../automationPreferences", () => ({ refreshAutomationPreference: mocks.refresh }));
vi.mock("../automationCoordinator", () => ({ processAutomationSourceIntent: mocks.process }));
vi.mock("../automationSourcePersistence", () => ({
  recoverDeferredAutomationSourceIntents: mocks.recoverDeferredSources,
}));
vi.mock("../automationRuntimeSignals", () => ({
  signalAutomationSourceReady: mocks.signalAutomationSourceReady,
}));
vi.mock("../automationServiceControl", () => ({
  resolveFreshAutomationServiceGate: vi.fn(),
}));

import { reconcileAutomationRuntime } from "../automationRuntime";
import { notifyAccountSessionTransition } from "@/storage/accountBoundaryRuntime";

describe("connected-record runtime reconciliation", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    Object.defineProperty(navigator, "onLine", { configurable: true, value: true });
    mocks.getCurrentUserId.mockResolvedValue(OWNER_ID);
    mocks.getPersistentDeviceId.mockResolvedValue("android-install-1");
    mocks.bootstrap.mockResolvedValue(null);
    mocks.purge.mockResolvedValue({ reconciled: 0, deferred: 0 });
    mocks.remote.mockResolvedValue({ applied: 0, deferred: 0, lastAppliedServerSequence: 1 });
    mocks.refresh.mockResolvedValue({ enabled: false });
    mocks.process.mockResolvedValue({ status: "noop", code: "PREFERENCE_DISABLED" });
    mocks.triggerDataRefresh.mockResolvedValue(undefined);
    mocks.recoverDeferredSources.mockResolvedValue({ recovered: 0, remaining: false });
    mocks.rows = [];
  });

  it("recovers server state first and processes owner intents in durable creation order", async () => {
    mocks.refresh.mockResolvedValueOnce({ enabled: true });
    mocks.rows = [
      { kind: "source_pending", id: "source_pending:b", createdAt: 20 },
      { kind: "record_revision", id: "record_revision:mood:x", createdAt: 1 },
      { kind: "source_pending", id: "source_pending:a", createdAt: 10 },
    ];

    await reconcileAutomationRuntime({ localizedMoodJournalTitle: "Mood note" });

    expect(mocks.bootstrap.mock.calls).toEqual([[OWNER_ID], [OWNER_ID, { force: true }]]);
    expect(mocks.purge).toHaveBeenCalledWith(OWNER_ID);
    expect(mocks.remote).toHaveBeenCalledWith(OWNER_ID);
    expect(mocks.remote.mock.invocationCallOrder[0]).toBeLessThan(
      mocks.purge.mock.invocationCallOrder[0]
    );
    expect(mocks.refresh).toHaveBeenCalledWith(OWNER_ID);
    expect(mocks.bootstrap.mock.invocationCallOrder[1]).toBeGreaterThan(
      mocks.refresh.mock.invocationCallOrder[0]
    );
    expect(mocks.bootstrap.mock.invocationCallOrder[1]).toBeLessThan(
      mocks.process.mock.invocationCallOrder[0]
    );
    expect(mocks.process.mock.calls.map((call) => call[0])).toEqual([
      "source_pending:a",
      "source_pending:b",
    ]);
    expect(mocks.process.mock.calls[0]?.[1]).toMatchObject({
      deviceId: "android-install-1",
    });
    expect(mocks.process.mock.calls[0]?.[1].getLocalizedMoodJournalTitle()).toBe("Mood note");
  });

  it("keeps source intents pending when authoritative target revisions cannot refresh", async () => {
    mocks.rows = [{ kind: "source_pending", id: "source_pending:a", createdAt: 10 }];
    mocks.refresh.mockResolvedValueOnce({ enabled: true });
    mocks.bootstrap
      .mockResolvedValueOnce(null)
      .mockRejectedValueOnce(new Error("record revision snapshot unavailable"));

    await reconcileAutomationRuntime({ localizedMoodJournalTitle: "Mood note" });

    expect(mocks.bootstrap.mock.calls).toEqual([[OWNER_ID], [OWNER_ID, { force: true }]]);
    expect(mocks.process).not.toHaveBeenCalled();
    expect(mocks.warn).toHaveBeenCalledWith("[AutomationRuntime] Recovery step deferred", {
      step: "revision",
    });
  });

  it("keeps processing stopped while a durable capacity rescan cannot recover", async () => {
    mocks.rows = [{ kind: "source_pending", id: "source_pending:a", createdAt: 10 }];
    mocks.recoverDeferredSources.mockRejectedValueOnce(new Error("rescan unavailable"));

    await reconcileAutomationRuntime({ localizedMoodJournalTitle: "Mood note" });

    expect(mocks.process).not.toHaveBeenCalled();
    expect(mocks.warn).toHaveBeenCalledWith("[AutomationRuntime] Recovery step deferred", {
      step: "source",
    });
  });

  it("queues one trailing pass when a bounded source rescan has more work", async () => {
    mocks.rows = [{ kind: "source_pending", id: "source_pending:a", createdAt: 10 }];
    mocks.recoverDeferredSources.mockResolvedValueOnce({ recovered: 1, remaining: true });

    await reconcileAutomationRuntime({ localizedMoodJournalTitle: "Mood note" });

    expect(mocks.process).toHaveBeenCalledTimes(1);
    expect(mocks.signalAutomationSourceReady).toHaveBeenCalledTimes(1);
  });

  it("does no work without an authenticated owner and blocks intents on failed online preference refresh", async () => {
    mocks.getCurrentUserId.mockResolvedValueOnce(null);
    await reconcileAutomationRuntime({ localizedMoodJournalTitle: "Mood note" });
    expect(mocks.bootstrap).not.toHaveBeenCalled();

    mocks.rows = [{ kind: "source_pending", id: "source_pending:a", createdAt: 10 }];
    mocks.refresh.mockRejectedValueOnce(new Error("unavailable"));
    await reconcileAutomationRuntime({ localizedMoodJournalTitle: "Mood note" });
    expect(mocks.process).not.toHaveBeenCalled();
    expect(mocks.warn).toHaveBeenCalledWith("[AutomationRuntime] Preference refresh deferred");
  });

  it("does not advance a purge receipt when ordered remote replay fails", async () => {
    mocks.remote.mockRejectedValueOnce(new Error("locked predecessor"));

    await reconcileAutomationRuntime({ localizedMoodJournalTitle: "Mood note" });

    expect(mocks.purge).not.toHaveBeenCalled();
    expect(mocks.warn).toHaveBeenCalledWith("[AutomationRuntime] Recovery step deferred", {
      step: "remote",
    });
  });

  it("refreshes mounted data once after one or more local intent commits", async () => {
    mocks.rows = [
      { kind: "source_pending", id: "source_pending:a", createdAt: 10 },
      { kind: "source_pending", id: "source_pending:b", createdAt: 20 },
    ];
    mocks.process
      .mockResolvedValueOnce({ status: "committed", transactionId: "tx-a" })
      .mockResolvedValueOnce({ status: "committed", transactionId: "tx-b" });

    await reconcileAutomationRuntime({ localizedMoodJournalTitle: "Mood note" });

    expect(mocks.process).toHaveBeenCalledTimes(2);
    expect(mocks.triggerDataRefresh).toHaveBeenCalledTimes(1);
    expect(mocks.triggerDataRefresh.mock.invocationCallOrder[0]).toBeGreaterThan(
      mocks.process.mock.invocationCallOrder[1]
    );
  });

  it("does not refresh mounted data when every intent is missing, deferred or a no-op", async () => {
    mocks.rows = [
      { kind: "source_pending", id: "source_pending:a", createdAt: 10 },
      { kind: "source_pending", id: "source_pending:b", createdAt: 20 },
      { kind: "source_pending", id: "source_pending:c", createdAt: 30 },
    ];
    mocks.process
      .mockResolvedValueOnce({ status: "missing" })
      .mockResolvedValueOnce({ status: "deferred", code: "VAULT_LOCKED" })
      .mockResolvedValueOnce({ status: "noop", code: "SOURCE_INVALID" });

    await reconcileAutomationRuntime({ localizedMoodJournalTitle: "Mood note" });

    expect(mocks.triggerDataRefresh).not.toHaveBeenCalled();
  });

  it("retains a failed mounted refresh for the next same-owner reconciliation", async () => {
    mocks.rows = [{ kind: "source_pending", id: "source_pending:a", createdAt: 10 }];
    mocks.process.mockResolvedValueOnce({ status: "committed", transactionId: "tx-a" });
    mocks.triggerDataRefresh.mockRejectedValueOnce(new Error("refresh unavailable"));

    await reconcileAutomationRuntime({ localizedMoodJournalTitle: "Mood note" });
    mocks.rows = [];
    await reconcileAutomationRuntime({ localizedMoodJournalTitle: "Mood note" });

    expect(mocks.triggerDataRefresh).toHaveBeenCalledTimes(2);
    expect(mocks.warn).toHaveBeenCalledWith("[AutomationRuntime] Mounted data refresh deferred");
  });

  it("discards a pending mounted refresh across sign-out and owner change", async () => {
    mocks.rows = [{ kind: "source_pending", id: "source_pending:a", createdAt: 10 }];
    mocks.process.mockResolvedValueOnce({ status: "committed", transactionId: "tx-a" });
    mocks.triggerDataRefresh.mockRejectedValueOnce(new Error("refresh unavailable"));

    await reconcileAutomationRuntime({ localizedMoodJournalTitle: "Mood note" });
    mocks.getCurrentUserId.mockResolvedValueOnce(null);
    await reconcileAutomationRuntime({ localizedMoodJournalTitle: "Mood note" });
    mocks.getCurrentUserId.mockResolvedValue("22222222-2222-4222-8222-222222222222");
    mocks.rows = [];
    await reconcileAutomationRuntime({ localizedMoodJournalTitle: "Mood note" });

    expect(mocks.triggerDataRefresh).toHaveBeenCalledTimes(1);
  });

  it("stops a stale runtime pass after an ABA session transition", async () => {
    mocks.bootstrap.mockImplementationOnce(async () => {
      notifyAccountSessionTransition();
      notifyAccountSessionTransition();
      return null;
    });

    await expect(
      reconcileAutomationRuntime({ localizedMoodJournalTitle: "Mood note" })
    ).rejects.toThrow(/account boundary|session changed/i);

    expect(mocks.remote).not.toHaveBeenCalled();
    expect(mocks.refresh).not.toHaveBeenCalled();
    expect(mocks.process).not.toHaveBeenCalled();
  });
});

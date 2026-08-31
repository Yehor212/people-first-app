import { afterEach, describe, expect, it, vi } from "vitest";
import { storageRemove } from "@/lib/safeJson";
import { SK } from "@/lib/storageKeys";
import {
  SYNC_HEALTH_RESET_EVENT,
  SYNC_HEALTH_RECEIPT_EVENT,
  installSyncHealthRecorder,
  recordSyncHealthReceipt,
  shouldEnableSyncHealthRecorder,
  updateSyncHealthSnapshot,
} from "../syncHealthRecorder";
import { installRuntimeFlightRecorder } from "../runtimeFlightRecorder";
import { diagnosticRouteListenerCount } from "../diagnosticRouteObserver";
import { resetAccountBoundaryRuntimeState } from "@/storage/accountBoundaryRuntime";

type ObserverCb = (list: { getEntries: () => PerformanceEntry[] }) => void;

function installPerformanceObserverMock(): void {
  const ctor = function (_cb: ObserverCb) {
    return { observe: vi.fn(), disconnect: vi.fn() };
  } as unknown as { new (cb: ObserverCb): PerformanceObserver; supportedEntryTypes: string[] };
  ctor.supportedEntryTypes = [];
  vi.stubGlobal("PerformanceObserver", ctor);
}

describe("sync health recorder", () => {
  afterEach(() => {
    resetAccountBoundaryRuntimeState();
    delete window.__zenflowSyncHealth;
    storageRemove(SK.SYNC_HEALTH_RECORDER);
    window.history.replaceState({}, "", "/");
    vi.restoreAllMocks();
  });

  it("sanitizes route, error, action, and priority fields before snapshots and events", () => {
    const canary = "ZF_T172_SYNC_AUTH_6V2K9M4R7Q3N";
    window.history.replaceState({}, "", `/orb/?code=${canary}&state=${canary}#${canary}`);
    const listener = vi.fn();
    window.addEventListener(SYNC_HEALTH_RECEIPT_EVENT, listener);

    expect(installSyncHealthRecorder("?syncHealth=1", "", false)).toBe(true);
    updateSyncHealthSnapshot({ route: `/diary/${canary}?token=${canary}` });
    (updateSyncHealthSnapshot as (patch: unknown) => void)({
      unexpectedPrivateField: canary,
      auth: canary,
      queue: {
        pending: 0,
        criticalPending: 0,
        processing: false,
        lastProcessedAt: null,
        note: canary,
      },
    });
    recordSyncHealthReceipt({
      kind: "error",
      source: "runtime",
      route: `/journal/${canary}?data=${canary}`,
      errorName: canary,
      actionType: canary,
      priority: canary,
    });

    const serialized = JSON.stringify({
      snapshot: window.__zenflowSyncHealth?.snapshot(),
      events: listener.mock.calls.map(([event]) => (event as CustomEvent).detail),
    });
    expect(serialized).not.toContain(canary);
    expect(window.__zenflowSyncHealth?.snapshot().route).toBe("unknown");
    window.removeEventListener(SYNC_HEALTH_RECEIPT_EVENT, listener);
  });

  it("keeps the fixed offline-queue action diagnostic", () => {
    expect(installSyncHealthRecorder("?syncHealth=1", "", false)).toBe(true);
    recordSyncHealthReceipt({
      kind: "queue-draining",
      source: "delta",
      actionType: "offline-queue",
      priority: "normal",
    });

    expect(window.__zenflowSyncHealth?.snapshot().lastReceipt).toMatchObject({
      actionType: "offline-queue",
      priority: "normal",
    });
  });

  it("drops out-of-range counts and future timestamps at the public recorder boundary", () => {
    const now = Date.now();
    expect(installSyncHealthRecorder("?syncHealth=1", "", false)).toBe(true);

    updateSyncHealthSnapshot({ lastSeq: Number.MAX_VALUE });
    recordSyncHealthReceipt({
      kind: "delta-applied",
      source: "delta",
      at: now + 24 * 60 * 60 * 1000,
      seq: Number.MAX_VALUE,
      fetched: Number.MAX_VALUE,
      applied: Number.MAX_VALUE,
    });

    const snapshot = window.__zenflowSyncHealth?.snapshot();
    expect(snapshot?.lastSeq).toBe(0);
    expect(snapshot?.lastReceipt).toEqual({
      kind: "delta-applied",
      source: "delta",
      at: expect.any(Number),
      route: "home",
    });
    expect(snapshot?.lastReceipt?.at).toBeGreaterThanOrEqual(now);
    expect(snapshot?.lastReceipt?.at).toBeLessThanOrEqual(Date.now());
  });

  it("enables from explicit public debug flags without enabling by default in production", () => {
    expect(shouldEnableSyncHealthRecorder("", "", false)).toBe(false);
    expect(shouldEnableSyncHealthRecorder("?syncHealth=1", "", false)).toBe(true);
    expect(shouldEnableSyncHealthRecorder("?syncDebug=true", "", false)).toBe(true);
    expect(shouldEnableSyncHealthRecorder("?runtimeSync=on", "", false)).toBe(true);
    expect(shouldEnableSyncHealthRecorder("?dev=true", "", false)).toBe(false);
    expect(shouldEnableSyncHealthRecorder("", "", true)).toBe(true);
    expect(shouldEnableSyncHealthRecorder("?syncHealth=off", "true", true)).toBe(false);
  });

  it("captures only privacy-safe sync state and receipts", () => {
    expect(installSyncHealthRecorder("?syncHealth=1", "", false)).toBe(true);

    updateSyncHealthSnapshot({
      auth: "authenticated",
      lastSeq: 42,
      online: true,
      queue: {
        pending: 2,
        criticalPending: 1,
        processing: false,
        lastProcessedAt: 123,
      },
    });
    recordSyncHealthReceipt({
      kind: "queued",
      source: "queue",
      actionType: "WRITE_SYNC_EVENT",
      priority: "critical",
    });

    const snapshot = window.__zenflowSyncHealth?.snapshot();
    expect(snapshot?.auth).toBe("authenticated");
    expect(snapshot?.lastSeq).toBe(42);
    expect(snapshot?.queue.pending).toBe(2);
    expect(snapshot?.lastReceipt).toMatchObject({
      kind: "queued",
      source: "queue",
      actionType: "WRITE_SYNC_EVENT",
      priority: "critical",
    });
    expect(JSON.stringify(snapshot)).not.toContain("payload");
    expect(JSON.stringify(snapshot)).not.toContain("entityId");
    expect(JSON.stringify(snapshot)).not.toContain("journal text");
    expect(JSON.stringify(snapshot)).not.toContain("habit name");
  });

  it("emits receipt events so the runtime hook can refresh the snapshot", () => {
    const listener = vi.fn();
    window.addEventListener("zenflow:sync-health-receipt", listener);

    recordSyncHealthReceipt({
      kind: "delta-applied",
      source: "delta",
      seq: 7,
      fetched: 1,
      applied: 1,
    });

    expect(listener).toHaveBeenCalledTimes(1);
    expect((listener.mock.calls[0][0] as CustomEvent).detail).toMatchObject({
      kind: "delta-applied",
      seq: 7,
    });

    window.removeEventListener("zenflow:sync-health-receipt", listener);
  });

  it("detaches both recorders at account reset and reinstalls exactly one listener each", async () => {
    const canary = "ZF_T172_ACCOUNT_ROUTE_2d4f8a91";
    installPerformanceObserverMock();
    window.history.replaceState({}, "", `/?syncHealth=1&perf=1&code=${canary}`);
    expect(installSyncHealthRecorder("?syncHealth=1", "", false)).toBe(true);
    expect(installRuntimeFlightRecorder()).toBe(true);
    const oldSync = window.__zenflowSyncHealth;
    const oldFlight = window.__zenflowRuntimePerf;
    expect(diagnosticRouteListenerCount()).toBe(2);

    resetAccountBoundaryRuntimeState();
    window.history.pushState({}, "", `/diary?token=${canary}`);
    await Promise.resolve();

    expect(window.__zenflowSyncHealth).toBeUndefined();
    expect(window.__zenflowRuntimePerf).toBeUndefined();
    expect(oldSync?.snapshot().receipts).toEqual([]);
    expect(oldFlight?.entries).toEqual([]);
    expect(diagnosticRouteListenerCount()).toBe(0);

    expect(installSyncHealthRecorder("?syncHealth=1", "", false)).toBe(true);
    expect(installRuntimeFlightRecorder()).toBe(true);
    expect(diagnosticRouteListenerCount()).toBe(2);
    expect(JSON.stringify({ sync: window.__zenflowSyncHealth?.snapshot(), flight: window.__zenflowRuntimePerf?.snapshot() })).not.toContain(canary);
    resetAccountBoundaryRuntimeState();
    vi.unstubAllGlobals();
  });

  it("dispatches a fixed reset event for mounted diagnostic UI", () => {
    const listener = vi.fn();
    window.addEventListener(SYNC_HEALTH_RESET_EVENT, listener);
    expect(installSyncHealthRecorder("?syncHealth=1", "", false)).toBe(true);

    resetAccountBoundaryRuntimeState();

    expect(listener).toHaveBeenCalledTimes(1);
    window.removeEventListener(SYNC_HEALTH_RESET_EVENT, listener);
  });
});

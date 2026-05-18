import { afterEach, describe, expect, it, vi } from "vitest";
import { storageRemove } from "@/lib/safeJson";
import { SK } from "@/lib/storageKeys";
import {
  installSyncHealthRecorder,
  recordSyncHealthReceipt,
  shouldEnableSyncHealthRecorder,
  updateSyncHealthSnapshot,
} from "../syncHealthRecorder";

describe("sync health recorder", () => {
  afterEach(() => {
    delete window.__zenflowSyncHealth;
    storageRemove(SK.SYNC_HEALTH_RECORDER);
    vi.restoreAllMocks();
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
});

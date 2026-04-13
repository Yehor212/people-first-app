import { describe, it, expect } from "vitest";
import {
  syncReducer,
  INITIAL_STATE,
  getRetryDelay,
  type SyncMachineState,
} from "../syncStateMachine";

describe("syncStateMachine", () => {
  describe("TRIGGER_DELTA", () => {
    it("transitions from idle to delta", () => {
      const state = syncReducer(INITIAL_STATE, { type: "TRIGGER_DELTA" });
      expect(state.phase).toBe("delta");
    });

    it("transitions from error to delta", () => {
      const errorState: SyncMachineState = {
        ...INITIAL_STATE,
        phase: "error",
        consecutiveErrors: 2,
      };
      const state = syncReducer(errorState, { type: "TRIGGER_DELTA" });
      expect(state.phase).toBe("delta");
    });

    it("does not transition from snapshot to delta", () => {
      const snapshotState: SyncMachineState = { ...INITIAL_STATE, phase: "snapshot" };
      const state = syncReducer(snapshotState, { type: "TRIGGER_DELTA" });
      expect(state.phase).toBe("snapshot");
    });
  });

  describe("DELTA_SUCCESS", () => {
    it("transitions to idle with updated seq", () => {
      const deltaState: SyncMachineState = { ...INITIAL_STATE, phase: "delta" };
      const state = syncReducer(deltaState, { type: "DELTA_SUCCESS", lastSeq: 42 });
      expect(state.phase).toBe("idle");
      expect(state.lastSeq).toBe(42);
      expect(state.consecutiveErrors).toBe(0);
      expect(state.lastSyncAt).toBeGreaterThan(0);
    });

    it("ignores if not in delta phase", () => {
      const state = syncReducer(INITIAL_STATE, { type: "DELTA_SUCCESS", lastSeq: 42 });
      expect(state.phase).toBe("idle");
      expect(state.lastSeq).toBe(0);
    });
  });

  describe("GAP_DETECTED", () => {
    it("transitions from delta to snapshot", () => {
      const deltaState: SyncMachineState = { ...INITIAL_STATE, phase: "delta" };
      const state = syncReducer(deltaState, { type: "GAP_DETECTED" });
      expect(state.phase).toBe("snapshot");
    });
  });

  describe("SNAPSHOT_SUCCESS", () => {
    it("transitions to idle with updated seq", () => {
      const snapshotState: SyncMachineState = { ...INITIAL_STATE, phase: "snapshot" };
      const state = syncReducer(snapshotState, { type: "SNAPSHOT_SUCCESS", lastSeq: 100 });
      expect(state.phase).toBe("idle");
      expect(state.lastSeq).toBe(100);
    });
  });

  describe("WENT_OFFLINE / CAME_ONLINE", () => {
    it("transitions from delta to offline", () => {
      const deltaState: SyncMachineState = { ...INITIAL_STATE, phase: "delta" };
      const state = syncReducer(deltaState, { type: "WENT_OFFLINE" });
      expect(state.phase).toBe("offline");
    });

    it("transitions from offline to online_pending on CAME_ONLINE", () => {
      const offlineState: SyncMachineState = { ...INITIAL_STATE, phase: "offline" };
      const state = syncReducer(offlineState, { type: "CAME_ONLINE" });
      expect(state.phase).toBe("online_pending");
    });

    it("ignores CAME_ONLINE if not offline", () => {
      const state = syncReducer(INITIAL_STATE, { type: "CAME_ONLINE" });
      expect(state.phase).toBe("idle");
    });

    it("transitions from online_pending to idle on QUEUE_DRAINED", () => {
      const pendingState: SyncMachineState = { ...INITIAL_STATE, phase: "online_pending" };
      const state = syncReducer(pendingState, { type: "QUEUE_DRAINED" });
      expect(state.phase).toBe("idle");
    });
  });

  describe("ERROR", () => {
    it("increments consecutiveErrors and sets retryAt", () => {
      const deltaState: SyncMachineState = { ...INITIAL_STATE, phase: "delta" };
      const state = syncReducer(deltaState, { type: "ERROR", retryDelayMs: 2000 });
      expect(state.phase).toBe("error");
      expect(state.consecutiveErrors).toBe(1);
      expect(state.retryAt).toBeGreaterThan(0);
    });

    it("accumulates consecutive errors", () => {
      const errorState: SyncMachineState = {
        ...INITIAL_STATE,
        phase: "delta",
        consecutiveErrors: 3,
      };
      const state = syncReducer(errorState, { type: "ERROR", retryDelayMs: 5000 });
      expect(state.consecutiveErrors).toBe(4);
    });
  });

  describe("RESET", () => {
    it("resets to initial state with given seq", () => {
      const messy: SyncMachineState = {
        phase: "error",
        lastSeq: 99,
        lastSyncAt: 123,
        consecutiveErrors: 5,
        retryAt: 456,
      };
      const state = syncReducer(messy, { type: "RESET", lastSeq: 200 });
      expect(state.phase).toBe("idle");
      expect(state.lastSeq).toBe(200);
      expect(state.consecutiveErrors).toBe(0);
      expect(state.retryAt).toBeNull();
    });
  });

  describe("getRetryDelay", () => {
    it("returns delay between 1s and 31s", () => {
      for (let i = 0; i < 10; i++) {
        const delay = getRetryDelay(i);
        expect(delay).toBeGreaterThanOrEqual(1000);
        expect(delay).toBeLessThanOrEqual(31000);
      }
    });

    it("caps at 30s base for high error counts", () => {
      const delay = getRetryDelay(20);
      expect(delay).toBeLessThanOrEqual(31000);
    });
  });
});

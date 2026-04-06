/**
 * Sync State Machine — Formal FSM for delta sync lifecycle.
 *
 * States: idle, delta, snapshot, offline, error
 * Pure reducer — no side effects, testable in isolation.
 */

export type SyncPhase = "idle" | "delta" | "snapshot" | "offline" | "error";

export interface SyncMachineState {
  phase: SyncPhase;
  lastSeq: number;
  lastSyncAt: number | null;
  consecutiveErrors: number;
  retryAt: number | null;
}

export type SyncAction =
  | { type: "TRIGGER_DELTA" }
  | { type: "DELTA_SUCCESS"; lastSeq: number }
  | { type: "DELTA_EMPTY" }
  | { type: "GAP_DETECTED" }
  | { type: "SNAPSHOT_START" }
  | { type: "SNAPSHOT_SUCCESS"; lastSeq: number }
  | { type: "WENT_OFFLINE" }
  | { type: "CAME_ONLINE" }
  | { type: "ERROR"; retryDelayMs: number }
  | { type: "RESET"; lastSeq: number };

const VALID_TRANSITIONS: Record<SyncPhase, SyncPhase[]> = {
  idle: ["delta", "offline"],
  delta: ["idle", "snapshot", "offline", "error"],
  snapshot: ["idle", "error", "offline"],
  offline: ["delta", "idle"],
  error: ["delta", "idle", "offline"],
};

export const INITIAL_STATE: SyncMachineState = {
  phase: "idle",
  lastSeq: 0,
  lastSyncAt: null,
  consecutiveErrors: 0,
  retryAt: null,
};

function canTransition(from: SyncPhase, to: SyncPhase): boolean {
  return VALID_TRANSITIONS[from]?.includes(to) ?? false;
}

export function syncReducer(state: SyncMachineState, action: SyncAction): SyncMachineState {
  switch (action.type) {
    case "TRIGGER_DELTA": {
      if (!canTransition(state.phase, "delta")) return state;
      return { ...state, phase: "delta", retryAt: null };
    }

    case "DELTA_SUCCESS": {
      if (state.phase !== "delta") return state;
      return {
        ...state,
        phase: "idle",
        lastSeq: action.lastSeq,
        lastSyncAt: Date.now(),
        consecutiveErrors: 0,
        retryAt: null,
      };
    }

    case "DELTA_EMPTY": {
      if (state.phase !== "delta") return state;
      return {
        ...state,
        phase: "idle",
        lastSyncAt: Date.now(),
        consecutiveErrors: 0,
        retryAt: null,
      };
    }

    case "GAP_DETECTED": {
      if (state.phase !== "delta") return state;
      return { ...state, phase: "snapshot" };
    }

    case "SNAPSHOT_START": {
      if (!canTransition(state.phase, "snapshot")) return state;
      return { ...state, phase: "snapshot" };
    }

    case "SNAPSHOT_SUCCESS": {
      if (state.phase !== "snapshot") return state;
      return {
        ...state,
        phase: "idle",
        lastSeq: action.lastSeq,
        lastSyncAt: Date.now(),
        consecutiveErrors: 0,
        retryAt: null,
      };
    }

    case "WENT_OFFLINE": {
      if (!canTransition(state.phase, "offline")) return state;
      return { ...state, phase: "offline", retryAt: null };
    }

    case "CAME_ONLINE": {
      if (state.phase !== "offline") return state;
      // Transition to idle (not delta) so runDeltaSync can call TRIGGER_DELTA
      return { ...state, phase: "idle", retryAt: null };
    }

    case "ERROR": {
      if (!canTransition(state.phase, "error")) return state;
      const errors = state.consecutiveErrors + 1;
      return {
        ...state,
        phase: "error",
        consecutiveErrors: errors,
        retryAt: Date.now() + action.retryDelayMs,
      };
    }

    case "RESET": {
      return {
        ...INITIAL_STATE,
        lastSeq: action.lastSeq,
        lastSyncAt: Date.now(),
      };
    }

    default:
      return state;
  }
}

/** Calculate exponential backoff delay with jitter (1s base, 30s max) */
export function getRetryDelay(consecutiveErrors: number): number {
  const base = Math.min(1000 * Math.pow(2, consecutiveErrors), 30000);
  return base + Math.random() * 1000;
}

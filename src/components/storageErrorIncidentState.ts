export interface StorageErrorEvent {
  type:
    | "write_failed"
    | "read_failed"
    | "quota_exceeded"
    | "localStorage_write_failed"
    | "persist_failed"
    | "load_failed";
  message: string;
  table?: string;
  key?: string;
  error?: string;
  recoverable?: boolean;
  queueSize?: number;
}

export interface IndexedDBTimeoutEvent {
  code: "IDB_OPERATION_TIMEOUT";
  phase: "read";
  deadlineMs: number;
  recoveryState: "cached" | "unavailable" | "unknown";
}

const INDEXEDDB_TIMEOUT_EVENT_KEYS = new Set([
  "code",
  "phase",
  "deadlineMs",
  "recoveryState",
]);

export function isIndexedDBTimeoutEvent(value: unknown): value is IndexedDBTimeoutEvent {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const candidate = value as Record<string, unknown>;
  const keys = Object.keys(candidate);
  return (
    keys.length === INDEXEDDB_TIMEOUT_EVENT_KEYS.size &&
    keys.every((key) => INDEXEDDB_TIMEOUT_EVENT_KEYS.has(key)) &&
    candidate.code === "IDB_OPERATION_TIMEOUT" &&
    candidate.phase === "read" &&
    typeof candidate.deadlineMs === "number" &&
    Number.isInteger(candidate.deadlineMs) &&
    candidate.deadlineMs >= 1_000 &&
    candidate.deadlineMs <= 60_000 &&
    (candidate.recoveryState === "cached" ||
      candidate.recoveryState === "unavailable" ||
      candidate.recoveryState === "unknown")
  );
}

export interface QueueFullEvent {
  queueSize: number;
  maxSize: number;
  message: string;
  actionType?: string;
  entityId?: string;
}

export interface RetryableStatusEvent {
  message: string;
  retryLabel: string;
  retry: () => void | Promise<void>;
}

export interface SessionTimeoutBlockedEvent {
  reason: "pending-changes" | "cleanup-failed" | "sign-out-failed";
  retry: () => void | Promise<void>;
}

export interface AccountCleanupBlockedEvent {
  retry: () => void | Promise<void>;
}

export interface SettingsPostCommitIncidentEvent {
  issueKinds: Array<"deferred-write-replay" | "mounted-refresh">;
  retry?: () => void;
}

export interface CriticalSyncBlockedEvent {
  retry: () => void | Promise<void>;
}

type StorageIncidentPriority = 1 | 2 | 3;

export interface StorageIncident {
  key: string;
  priority: StorageIncidentPriority;
  title: string | null;
  message: string;
  retryAction: {
    label: string;
    run: () => void | Promise<void>;
  } | null;
}

interface StorageIncidentState {
  active: StorageIncident | null;
  pending: StorageIncident[];
}

type StorageIncidentAction =
  | { type: "present"; incident: StorageIncident }
  | { type: "advance" };

export const INITIAL_STORAGE_INCIDENT_STATE: StorageIncidentState = {
  active: null,
  pending: [],
};

function orderPendingIncidents(incidents: StorageIncident[]): StorageIncident[] {
  return [...incidents].sort((left, right) => right.priority - left.priority);
}

function replacePendingIncident(
  pending: StorageIncident[],
  incident: StorageIncident,
): StorageIncident[] {
  return orderPendingIncidents([
    ...pending.filter((candidate) => candidate.key !== incident.key),
    incident,
  ]);
}

export function storageIncidentReducer(
  state: StorageIncidentState,
  action: StorageIncidentAction,
): StorageIncidentState {
  if (action.type === "advance") {
    const [next, ...remaining] = state.pending;
    return { active: next ?? null, pending: remaining };
  }

  const { incident } = action;
  if (!state.active) return { active: incident, pending: state.pending };
  if (state.active.key === incident.key) return { ...state, active: incident };

  if (incident.priority > state.active.priority) {
    return {
      active: incident,
      pending: replacePendingIncident(state.pending, state.active),
    };
  }

  return {
    active: state.active,
    pending: replacePendingIncident(state.pending, incident),
  };
}

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
  timeoutMs: number;
  message: string;
}

export interface QueueFullEvent {
  queueSize: number;
  maxSize: number;
  message: string;
  actionType?: string;
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

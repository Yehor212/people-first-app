import {
  safeLocalStorageGet,
  safeLocalStorageSet,
  safeSessionStorageGet,
  safeSessionStorageSet,
  storageRemove,
} from "@/lib/safeJson";
import { SK, SSK } from "@/lib/storageKeys";

export const RUNTIME_PERFORMANCE_MODE_EVENT = "zenflow:runtime-perf-mode";
export const RUNTIME_PERFORMANCE_STARTUP = "startup";
export const RUNTIME_PERFORMANCE_STRAINED = "strained";
const RUNTIME_PERFORMANCE_DEVICE_TTL_MS = 7 * 24 * 60 * 60 * 1000;

export type RuntimePerformanceMode =
  | "normal"
  | typeof RUNTIME_PERFORMANCE_STARTUP
  | typeof RUNTIME_PERFORMANCE_STRAINED;

export interface RuntimePerformanceModeSnapshot {
  version: 1;
  mode: typeof RUNTIME_PERFORMANCE_STRAINED;
  reason: string;
  duration: number;
  route: string;
  activatedAt: number;
}

export interface RuntimePerformanceDeviceSnapshot {
  version: 1;
  mode: typeof RUNTIME_PERFORMANCE_STARTUP;
  reason: string;
  duration: number;
  activatedAt: number;
  expiresAt: number;
}

function getDocumentMode(): RuntimePerformanceMode {
  if (typeof document === "undefined") {
    return "normal";
  }
  const mode = document.documentElement.dataset.runtimePerf;
  return mode === RUNTIME_PERFORMANCE_STRAINED || mode === RUNTIME_PERFORMANCE_STARTUP
    ? mode
    : "normal";
}

export function readStoredRuntimePerformanceMode(): RuntimePerformanceModeSnapshot | null {
  return safeSessionStorageGet<RuntimePerformanceModeSnapshot | null>(
    SSK.RUNTIME_PERF_GUARD,
    null,
  );
}

export function readStoredRuntimePerformanceDeviceGuard(): RuntimePerformanceDeviceSnapshot | null {
  const stored = safeLocalStorageGet<RuntimePerformanceDeviceSnapshot | null>(
    SK.RUNTIME_PERF_DEVICE_GUARD,
    null,
  );

  if (!stored || stored.version !== 1 || stored.mode !== RUNTIME_PERFORMANCE_STARTUP) {
    return null;
  }

  if (stored.expiresAt <= Date.now()) {
    storageRemove(SK.RUNTIME_PERF_DEVICE_GUARD);
    return null;
  }

  return stored;
}

export function readRuntimePerformanceMode(): RuntimePerformanceMode {
  const documentMode = getDocumentMode();
  if (documentMode !== "normal") {
    return documentMode;
  }

  const stored = readStoredRuntimePerformanceMode();
  return stored?.mode === RUNTIME_PERFORMANCE_STRAINED ? RUNTIME_PERFORMANCE_STRAINED : "normal";
}

export function isRuntimePerformanceStrained(): boolean {
  return readRuntimePerformanceMode() === RUNTIME_PERFORMANCE_STRAINED;
}

export function isRuntimePerformanceLimited(): boolean {
  return readRuntimePerformanceMode() !== "normal";
}

export function applyRuntimePerformanceMode(snapshot: RuntimePerformanceModeSnapshot): void {
  if (typeof document !== "undefined") {
    document.documentElement.dataset.runtimePerf = snapshot.mode;
  }

  safeSessionStorageSet(SSK.RUNTIME_PERF_GUARD, snapshot);
  safeLocalStorageSet(SK.RUNTIME_PERF_DEVICE_GUARD, {
    version: 1,
    mode: RUNTIME_PERFORMANCE_STARTUP,
    reason: snapshot.reason,
    duration: snapshot.duration,
    activatedAt: snapshot.activatedAt,
    expiresAt: snapshot.activatedAt + RUNTIME_PERFORMANCE_DEVICE_TTL_MS,
  } satisfies RuntimePerformanceDeviceSnapshot);

  if (typeof window !== "undefined") {
    window.dispatchEvent(
      new CustomEvent(RUNTIME_PERFORMANCE_MODE_EVENT, {
        detail: snapshot,
      }),
    );
  }
}

export function applyRuntimePerformanceStartup(reason = "device-history"): void {
  if (typeof document !== "undefined") {
    document.documentElement.dataset.runtimePerf = RUNTIME_PERFORMANCE_STARTUP;
  }

  if (typeof window !== "undefined") {
    window.dispatchEvent(
      new CustomEvent(RUNTIME_PERFORMANCE_MODE_EVENT, {
        detail: { mode: RUNTIME_PERFORMANCE_STARTUP, reason },
      }),
    );
  }
}

export function clearRuntimePerformanceMode(options: { clearDevice?: boolean } = {}): void {
  if (typeof document !== "undefined") {
    delete document.documentElement.dataset.runtimePerf;
  }

  try {
    sessionStorage.removeItem(SSK.RUNTIME_PERF_GUARD);
  } catch {
    // Runtime performance mode is best-effort and must never block startup.
  }

  if (options.clearDevice) {
    storageRemove(SK.RUNTIME_PERF_DEVICE_GUARD);
  }

  if (typeof window !== "undefined") {
    window.dispatchEvent(
      new CustomEvent(RUNTIME_PERFORMANCE_MODE_EVENT, {
        detail: { mode: "normal" satisfies RuntimePerformanceMode },
      }),
    );
  }
}

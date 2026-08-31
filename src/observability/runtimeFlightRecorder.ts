import { storageGetRaw } from "@/lib/safeJson";
import { SK } from "@/lib/storageKeys";
import { sanitizeDiagnosticRoute } from "@/lib/diagnosticPrivacy";
import { registerAccountBoundaryRuntimeReset } from "@/storage/accountBoundaryRuntime";
import {
  applyRuntimePerformanceMode,
  applyRuntimePerformanceStartup,
  clearRuntimePerformanceMode,
  readStoredRuntimePerformanceDeviceGuard,
  readStoredRuntimePerformanceMode,
  type RuntimePerformanceModeSnapshot,
} from "./runtimePerformanceMode";
import { sanitizeRuntimeRoute } from "./runtimeRouteSanitizer";
import { subscribeDiagnosticRouteChange } from "./diagnosticRouteObserver";

const MAX_ENTRIES = 80;
const ENABLED_VALUES = new Set(["1", "true", "yes", "on"]);
const DISABLED_VALUES = new Set(["0", "false", "no", "off"]);
const STRAINED_LOAF_MS = 700;
const STRAINED_LOAF_BLOCKING_MS = 250;
const REPEATED_LOAF_MS = 450;
const REPEATED_LOAF_BLOCKING_MS = 120;
const LONG_TASK_STRAINED_MS = 500;
const REPEATED_LOAF_COUNT = 2;
const STARTUP_WARMUP_MS = 6500;

type RuntimePerfKind = "route" | "longtask" | "long-animation-frame";

interface RuntimePerfEntry {
  kind: RuntimePerfKind;
  route: string;
  startTime: number;
  duration: number;
  blockingDuration?: number;
  renderStart?: number;
  styleAndLayoutStart?: number;
  scripts?: Array<{
    duration?: number;
    invoker?: string;
    invokerType?: string;
    sourceFunctionName?: string;
    sourceURL?: string;
    forcedStyleAndLayoutDuration?: number;
  }>;
}

interface RuntimeFlightRecorder {
  enabled: true;
  startedAt: number;
  route: string;
  entries: RuntimePerfEntry[];
  snapshot: () => {
    startedAt: number;
    route: string;
    entries: RuntimePerfEntry[];
    maxLongTaskMs: number;
    maxLongAnimationFrameMs: number;
  };
  markRoute: (route?: string) => void;
}

let activeFlightRecorderDispose: (() => void) | null = null;
let activeFlightRecorderObservers: PerformanceObserver[] = [];
let activeRuntimeGuardObservers: PerformanceObserver[] = [];
let activeRuntimeGuardTimeout: number | null = null;

interface RuntimePerformanceGuard {
  enabled: true;
  startedAt: number;
  activated: boolean;
  route: string;
  repeatedLoAFCount: number;
  maxLongTaskMs: number;
  maxLongAnimationFrameMs: number;
  maxLongAnimationFrameBlockingMs: number;
  snapshot: () => {
    startedAt: number;
    route: string;
    activated: boolean;
    repeatedLoAFCount: number;
    maxLongTaskMs: number;
    maxLongAnimationFrameMs: number;
    maxLongAnimationFrameBlockingMs: number;
  };
}

interface LoAFEntry extends PerformanceEntry {
  blockingDuration?: number;
  renderStart?: number;
  styleAndLayoutStart?: number;
  scripts?: Array<{
    duration?: number;
    invoker?: string;
    invokerType?: string;
    sourceFunctionName?: string;
    sourceURL?: string;
    forcedStyleAndLayoutDuration?: number;
  }>;
}

declare global {
  interface Window {
    __zenflowRuntimePerf?: RuntimeFlightRecorder;
    __zenflowRuntimePerfGuard?: RuntimePerformanceGuard;
  }
}

function normalizeFlag(value: string | null | undefined): boolean {
  return ENABLED_VALUES.has((value || "").trim().toLowerCase());
}

export function shouldEnableRuntimeFlightRecorder(
  search: string,
  storedFlag: string,
  devMode: boolean
): boolean {
  const params = new URLSearchParams(search);
  const explicit =
    params.get("perf") ?? params.get("perfDebug") ?? params.get("runtimePerf") ?? params.get("dev");

  if (explicit !== null) {
    return normalizeFlag(explicit);
  }

  return devMode || normalizeFlag(storedFlag);
}

export function shouldEnableRuntimePerformanceGuard(search: string): boolean {
  const params = new URLSearchParams(search);
  const explicit = params.get("runtimePerfGuard") ?? params.get("perfGuard");

  if (explicit === null) {
    return true;
  }

  const normalized = explicit.trim().toLowerCase();
  if (DISABLED_VALUES.has(normalized)) {
    return false;
  }
  if (ENABLED_VALUES.has(normalized)) {
    return true;
  }

  return true;
}

function sanitizeFlightRecorderRoute(route: string): string {
  // Keep the existing finite query allowlist for known app destinations, but
  // collapse dynamic/deep-link paths before they can retain private IDs.
  if (sanitizeDiagnosticRoute(route) === "unknown") return "unknown";
  return sanitizeRuntimeRoute(route);
}

function currentRoute(): string {
  return sanitizeFlightRecorderRoute(`${window.location.pathname}${window.location.search}`);
}

function currentGuardRoute(): string {
  return sanitizeDiagnosticRoute(window.location.href);
}

function sanitizeFlightEntry(entry: LoAFEntry): RuntimePerfEntry["scripts"] {
  return (entry.scripts || []).slice(0, 5).map((script) => ({
    duration: Number.isFinite(script.duration) ? script.duration : 0,
    invoker: "observed",
    invokerType: "observed",
    sourceFunctionName: "observed",
    sourceURL: "[REDACTED]",
    forcedStyleAndLayoutDuration: Number.isFinite(script.forcedStyleAndLayoutDuration)
      ? script.forcedStyleAndLayoutDuration
      : undefined,
  }));
}

function clearRuntimeFlightRecorderState(): void {
  if (typeof window === "undefined") return;
  window.__zenflowRuntimePerf?.entries.splice(0);
  for (const observer of activeFlightRecorderObservers) observer.disconnect();
  activeFlightRecorderObservers = [];
  activeFlightRecorderDispose?.();
  activeFlightRecorderDispose = null;
  for (const observer of activeRuntimeGuardObservers) observer.disconnect();
  activeRuntimeGuardObservers = [];
  if (activeRuntimeGuardTimeout !== null) {
    window.clearTimeout(activeRuntimeGuardTimeout);
    activeRuntimeGuardTimeout = null;
  }
  delete window.__zenflowRuntimePerf;
  delete window.__zenflowRuntimePerfGuard;
  clearRuntimePerformanceMode({ clearDevice: true });
}

registerAccountBoundaryRuntimeReset(clearRuntimeFlightRecorderState);

function pushEntry(store: RuntimeFlightRecorder, entry: RuntimePerfEntry): void {
  store.entries.push(entry);
  if (store.entries.length > MAX_ENTRIES) {
    store.entries.splice(0, store.entries.length - MAX_ENTRIES);
  }
}

export function installRuntimeFlightRecorder(): boolean {
  if (typeof window === "undefined" || typeof PerformanceObserver === "undefined") {
    return false;
  }

  if (window.__zenflowRuntimePerf) {
    return true;
  }

  const shouldEnable = shouldEnableRuntimeFlightRecorder(
    window.location.search,
    storageGetRaw(SK.RUNTIME_PERF_RECORDER, ""),
    import.meta.env.DEV
  );

  if (!shouldEnable) {
    return false;
  }

  const store: RuntimeFlightRecorder = {
    enabled: true,
    startedAt: performance.now(),
    route: currentRoute(),
    entries: [],
    snapshot: () => {
      const entries = store.entries.slice();
      return {
        startedAt: store.startedAt,
        route: store.route,
        entries,
        maxLongTaskMs: Math.max(
          0,
          ...entries
            .filter((entry) => entry.kind === "longtask")
            .map((entry) => entry.duration || 0)
        ),
        maxLongAnimationFrameMs: Math.max(
          0,
          ...entries
            .filter((entry) => entry.kind === "long-animation-frame")
            .map((entry) => entry.duration || 0)
        ),
      };
    },
    markRoute: (route = currentRoute()) => {
      const sanitizedRoute = sanitizeFlightRecorderRoute(route);
      store.route = sanitizedRoute;
      pushEntry(store, {
        kind: "route",
        route: sanitizedRoute,
        startTime: performance.now(),
        duration: 0,
      });
    },
  };

  window.__zenflowRuntimePerf = store;
  activeFlightRecorderDispose = subscribeDiagnosticRouteChange(() => store.markRoute());
  store.markRoute();

  const supportedEntryTypes = PerformanceObserver.supportedEntryTypes || [];

  try {
    if (supportedEntryTypes.includes("longtask")) {
      const observer = new PerformanceObserver((list) => {
        if (window.__zenflowRuntimePerf !== store) return;
        for (const entry of list.getEntries()) {
          pushEntry(store, {
            kind: "longtask",
            route: store.route,
            startTime: entry.startTime,
            duration: entry.duration,
          });
        }
      });
      activeFlightRecorderObservers.push(observer);
      observer.observe({ type: "longtask", buffered: true });
    }
  } catch {
    // Observability must never block app startup.
  }

  try {
    if (supportedEntryTypes.includes("long-animation-frame")) {
      const observer = new PerformanceObserver((list) => {
        if (window.__zenflowRuntimePerf !== store) return;
        for (const entry of list.getEntries() as LoAFEntry[]) {
          pushEntry(store, {
            kind: "long-animation-frame",
            route: store.route,
            startTime: entry.startTime,
            duration: entry.duration,
            blockingDuration: entry.blockingDuration,
            renderStart: entry.renderStart,
            styleAndLayoutStart: entry.styleAndLayoutStart,
            scripts: sanitizeFlightEntry(entry),
          });
        }
      });
      activeFlightRecorderObservers.push(observer);
      observer.observe({ type: "long-animation-frame", buffered: true });
    }
  } catch {
    // Observability must never block app startup.
  }

  return true;
}

function makeGuardSnapshot(reason: string, duration: number): RuntimePerformanceModeSnapshot {
  return {
    version: 1,
    mode: "strained",
    reason,
    duration: Math.round(duration),
    route: currentRoute(),
    activatedAt: Date.now(),
  };
}

function activateRuntimePerformanceGuard(
  state: RuntimePerformanceGuard,
  reason: string,
  duration: number
): void {
  if (state.activated) {
    return;
  }

  state.activated = true;
  applyRuntimePerformanceMode(makeGuardSnapshot(reason, duration));
}

export function installRuntimePerformanceGuard(): boolean {
  if (typeof window === "undefined") {
    return false;
  }

  if (!shouldEnableRuntimePerformanceGuard(window.location.search)) {
    clearRuntimePerformanceMode({ clearDevice: true });
    return false;
  }

  if (window.__zenflowRuntimePerfGuard) {
    return true;
  }

  const state: RuntimePerformanceGuard = {
    enabled: true,
    startedAt: performance.now(),
    activated: false,
    route: currentGuardRoute(),
    repeatedLoAFCount: 0,
    maxLongTaskMs: 0,
    maxLongAnimationFrameMs: 0,
    maxLongAnimationFrameBlockingMs: 0,
    snapshot: () => ({
      startedAt: state.startedAt,
      route: state.route,
      activated: state.activated,
      repeatedLoAFCount: state.repeatedLoAFCount,
      maxLongTaskMs: state.maxLongTaskMs,
      maxLongAnimationFrameMs: state.maxLongAnimationFrameMs,
      maxLongAnimationFrameBlockingMs: state.maxLongAnimationFrameBlockingMs,
    }),
  };

  window.__zenflowRuntimePerfGuard = state;

  const stored = readStoredRuntimePerformanceMode();
  if (stored?.mode === "strained") {
    state.activated = true;
    applyRuntimePerformanceMode(stored);
  } else if (readStoredRuntimePerformanceDeviceGuard()) {
    applyRuntimePerformanceStartup();
    activeRuntimeGuardTimeout = window.setTimeout(() => {
      if (!state.activated && document.documentElement.dataset.runtimePerf === "startup") {
        clearRuntimePerformanceMode();
      }
      activeRuntimeGuardTimeout = null;
    }, STARTUP_WARMUP_MS);
  }

  if (typeof PerformanceObserver === "undefined") {
    return true;
  }

  const supportedEntryTypes = PerformanceObserver.supportedEntryTypes || [];

  try {
    if (supportedEntryTypes.includes("long-animation-frame")) {
      const observer = new PerformanceObserver((list) => {
        if (window.__zenflowRuntimePerfGuard !== state) return;
        for (const entry of list.getEntries()) {
          const duration = entry.duration || 0;
          const blockingDuration = (entry as LoAFEntry).blockingDuration || 0;
          if ((entry.startTime || 0) < state.startedAt) {
            continue;
          }

          state.maxLongAnimationFrameMs = Math.max(state.maxLongAnimationFrameMs, duration);
          state.maxLongAnimationFrameBlockingMs = Math.max(
            state.maxLongAnimationFrameBlockingMs,
            blockingDuration
          );

          if (duration >= REPEATED_LOAF_MS && blockingDuration >= REPEATED_LOAF_BLOCKING_MS) {
            state.repeatedLoAFCount += 1;
          }

          if (duration >= STRAINED_LOAF_MS && blockingDuration >= STRAINED_LOAF_BLOCKING_MS) {
            activateRuntimePerformanceGuard(state, "blocking-long-animation-frame", duration);
          } else if (state.repeatedLoAFCount >= REPEATED_LOAF_COUNT) {
            activateRuntimePerformanceGuard(
              state,
              "repeated-blocking-long-animation-frame",
              duration
            );
          }
        }
      });
      activeRuntimeGuardObservers.push(observer);
      observer.observe({ type: "long-animation-frame", buffered: true });
    }
  } catch {
    // Runtime perf guard must never block app startup.
  }

  try {
    if (supportedEntryTypes.includes("longtask")) {
      const observer = new PerformanceObserver((list) => {
        if (window.__zenflowRuntimePerfGuard !== state) return;
        for (const entry of list.getEntries()) {
          const duration = entry.duration || 0;
          if ((entry.startTime || 0) < state.startedAt) {
            continue;
          }

          state.maxLongTaskMs = Math.max(state.maxLongTaskMs, duration);

          if (duration >= LONG_TASK_STRAINED_MS) {
            activateRuntimePerformanceGuard(state, "longtask", duration);
          }
        }
      });
      activeRuntimeGuardObservers.push(observer);
      observer.observe({ type: "longtask", buffered: true });
    }
  } catch {
    // Runtime perf guard must never block app startup.
  }

  return true;
}

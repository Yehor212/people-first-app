import { storageGetRaw } from "@/lib/safeJson";
import { SK } from "@/lib/storageKeys";

const MAX_ENTRIES = 80;
const ENABLED_VALUES = new Set(["1", "true", "yes", "on"]);

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
  }
}

function normalizeFlag(value: string | null | undefined): boolean {
  return ENABLED_VALUES.has((value || "").trim().toLowerCase());
}

export function shouldEnableRuntimeFlightRecorder(
  search: string,
  storedFlag: string,
  devMode: boolean,
): boolean {
  const params = new URLSearchParams(search);
  const explicit =
    params.get("perf") ??
    params.get("perfDebug") ??
    params.get("runtimePerf") ??
    params.get("dev");

  if (explicit !== null) {
    return normalizeFlag(explicit);
  }

  return devMode || normalizeFlag(storedFlag);
}

function currentRoute(): string {
  return `${window.location.pathname}${window.location.search}`;
}

function pushEntry(store: RuntimeFlightRecorder, entry: RuntimePerfEntry): void {
  store.entries.push(entry);
  if (store.entries.length > MAX_ENTRIES) {
    store.entries.splice(0, store.entries.length - MAX_ENTRIES);
  }
}

function patchHistory(store: RuntimeFlightRecorder): void {
  const patchMethod = <T extends "pushState" | "replaceState">(method: T) => {
    const original = window.history[method];
    window.history[method] = function patchedHistoryMethod(
      this: History,
      ...args: Parameters<History[T]>
    ) {
      const result = original.apply(this, args);
      queueMicrotask(() => store.markRoute());
      return result;
    } as History[T];
  };

  patchMethod("pushState");
  patchMethod("replaceState");
  window.addEventListener("popstate", () => store.markRoute(), { passive: true });
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
    import.meta.env.DEV,
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
            .map((entry) => entry.duration || 0),
        ),
        maxLongAnimationFrameMs: Math.max(
          0,
          ...entries
            .filter((entry) => entry.kind === "long-animation-frame")
            .map((entry) => entry.duration || 0),
        ),
      };
    },
    markRoute: (route = currentRoute()) => {
      store.route = route;
      pushEntry(store, {
        kind: "route",
        route,
        startTime: performance.now(),
        duration: 0,
      });
    },
  };

  window.__zenflowRuntimePerf = store;
  patchHistory(store);
  store.markRoute();

  const supportedEntryTypes = PerformanceObserver.supportedEntryTypes || [];

  try {
    if (supportedEntryTypes.includes("longtask")) {
      new PerformanceObserver((list) => {
        for (const entry of list.getEntries()) {
          pushEntry(store, {
            kind: "longtask",
            route: store.route,
            startTime: entry.startTime,
            duration: entry.duration,
          });
        }
      }).observe({ type: "longtask", buffered: true });
    }
  } catch {
    // Observability must never block app startup.
  }

  try {
    if (supportedEntryTypes.includes("long-animation-frame")) {
      new PerformanceObserver((list) => {
        for (const entry of list.getEntries() as LoAFEntry[]) {
          pushEntry(store, {
            kind: "long-animation-frame",
            route: store.route,
            startTime: entry.startTime,
            duration: entry.duration,
            blockingDuration: entry.blockingDuration,
            renderStart: entry.renderStart,
            styleAndLayoutStart: entry.styleAndLayoutStart,
            scripts: (entry.scripts || []).slice(0, 5),
          });
        }
      }).observe({ type: "long-animation-frame", buffered: true });
    }
  } catch {
    // Observability must never block app startup.
  }

  return true;
}

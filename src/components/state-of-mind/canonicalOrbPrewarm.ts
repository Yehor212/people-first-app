import { safeSessionStorageGet, safeSessionStorageSet } from "@/lib/safeJson";
import { SSK } from "@/lib/storageKeys";
import { valenceToHSL } from "./colorUtils";
import { getShapeParams } from "./orbRenderer";

const PREWARM_VERSION = 1;
const PREWARM_SIZE = 96;
const PREWARM_TIMEOUT_MS = 6000;

type CanonicalOrbPrewarmSnapshot = {
  version: typeof PREWARM_VERSION;
  completedAt: number;
  durationMs: number;
  reason: string;
};

type PrewarmResult =
  | { ok: true; durationMs: number; reused: boolean }
  | { ok: false; reason: string; durationMs: number };

type WorkerStatusMessage =
  | { type: "ready" }
  | { type: "failed"; reason?: string }
  | { type: "rendered"; requestId: string };

let inFlight: Promise<PrewarmResult> | null = null;

function readPrewarmSnapshot(): CanonicalOrbPrewarmSnapshot | null {
  const snapshot = safeSessionStorageGet<CanonicalOrbPrewarmSnapshot | null>(
    SSK.ORB_WEBGL_PREWARMED,
    null,
  );

  return snapshot?.version === PREWARM_VERSION ? snapshot : null;
}

function canUseCanonicalOrbPrewarm(): boolean {
  try {
    return (
      typeof Worker !== "undefined" &&
      typeof OffscreenCanvas !== "undefined" &&
      typeof window !== "undefined" &&
      typeof document !== "undefined"
    );
  } catch {
    return false;
  }
}

function createPrewarmPayload() {
  const valence = 0;
  return {
    valence,
    time: 0,
    size: PREWARM_SIZE,
    dpr: 1,
    isDark: document.documentElement.classList.contains("dark"),
    color: valenceToHSL(valence),
    shape: getShapeParams(valence),
    particles: [],
    genesis: 1,
    touch: { x: 0, y: 0, age: 0 },
    shimmer: 0,
  };
}

export function hasCanonicalOrbPrewarmSession(): boolean {
  return readPrewarmSnapshot() !== null;
}

export function prewarmCanonicalOrbWebGL(reason = "idle"): Promise<PrewarmResult> {
  const existing = readPrewarmSnapshot();
  if (existing) {
    return Promise.resolve({ ok: true, durationMs: existing.durationMs, reused: true });
  }

  if (inFlight) {
    return inFlight;
  }

  if (!canUseCanonicalOrbPrewarm()) {
    return Promise.resolve({ ok: false, reason: "unsupported", durationMs: 0 });
  }

  inFlight = new Promise<PrewarmResult>((resolve) => {
    const started = performance.now();
    const requestId = `canonical-orb-prewarm:${Math.round(started)}`;
    const canvas = new OffscreenCanvas(PREWARM_SIZE, PREWARM_SIZE);
    const worker = new Worker(new URL("./orbWorker.ts", import.meta.url), {
      type: "module",
      name: "zenflow-canonical-orb-prewarm",
    });

    let settled = false;
    const finish = (result: PrewarmResult) => {
      if (settled) return;
      settled = true;
      window.clearTimeout(timeoutId);
      try {
        worker.postMessage({ type: "dispose" });
      } catch {
        worker.terminate();
      }
      if (result.ok) {
        safeSessionStorageSet(SSK.ORB_WEBGL_PREWARMED, {
          version: PREWARM_VERSION,
          completedAt: Date.now(),
          durationMs: result.durationMs,
          reason,
        } satisfies CanonicalOrbPrewarmSnapshot);
      }
      inFlight = null;
      resolve(result);
    };

    const timeoutId = window.setTimeout(() => {
      finish({
        ok: false,
        reason: "timeout",
        durationMs: performance.now() - started,
      });
    }, PREWARM_TIMEOUT_MS);

    worker.onerror = () => {
      finish({
        ok: false,
        reason: "worker-error",
        durationMs: performance.now() - started,
      });
    };

    worker.onmessage = (event: MessageEvent<WorkerStatusMessage>) => {
      if (event.data.type === "failed") {
        finish({
          ok: false,
          reason: event.data.reason || "worker-failed",
          durationMs: performance.now() - started,
        });
        return;
      }

      if (event.data.type === "ready") {
        worker.postMessage({
          type: "render",
          requestId,
          payload: createPrewarmPayload(),
        });
        return;
      }

      if (event.data.type === "rendered" && event.data.requestId === requestId) {
        finish({ ok: true, durationMs: performance.now() - started, reused: false });
      }
    };

    worker.postMessage({
      type: "init",
      canvas,
      size: PREWARM_SIZE,
      dpr: 1,
    }, [canvas]);
  });

  return inFlight;
}

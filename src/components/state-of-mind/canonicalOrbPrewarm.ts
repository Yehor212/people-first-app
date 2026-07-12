import { safeSessionStorageGet, safeSessionStorageSet } from "@/lib/safeJson";
import { SSK } from "@/lib/storageKeys";
import { recordError } from "@/lib/crashReporting";
import { valenceToHSL } from "./colorUtils";
import { getShapeParams } from "./orbRenderer";

const PREWARM_VERSION = 1;
const PREWARM_SIZE = 96;
export const CANONICAL_ORB_PREWARM_TIMEOUT_MS = 12000;

function recordCanonicalOrbPrewarmFailure(action: string) {
  recordError(
    new Error(`Canonical orb prewarm failure: ${action}`),
    { component: "ValenceOrb", action },
  );
}

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
  | { type: "rendered"; requestId: number };

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
    organicTime: 0,
    paletteTime: 0,
    motionPhase: 0,
    noisePhase: 0,
    pulsePhase: 0,
    breathPhase: 0,
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
    const requestId = 1;
    let settled = false;
    let timeoutId = 0;
    let worker: Worker | null = null;
    const finish = (result: PrewarmResult) => {
      if (settled) return;
      settled = true;
      if (timeoutId !== 0) window.clearTimeout(timeoutId);
      if (worker) {
        try {
          worker.postMessage({ type: "dispose" });
        } catch {
          recordCanonicalOrbPrewarmFailure("canonical-orb-prewarm-dispose");
        } finally {
          worker.terminate();
        }
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

    queueMicrotask(() => {
      let canvas: OffscreenCanvas;
      try {
        canvas = new OffscreenCanvas(PREWARM_SIZE, PREWARM_SIZE);
        worker = new Worker(new URL("./orbWorker.ts", import.meta.url), {
          type: "module",
          name: "zenflow-canonical-orb-prewarm",
        });
      } catch {
        recordCanonicalOrbPrewarmFailure("canonical-orb-prewarm-construction");
        finish({
          ok: false,
          reason: "worker-construction-failed",
          durationMs: performance.now() - started,
        });
        return;
      }

      timeoutId = window.setTimeout(() => {
        finish({
          ok: false,
          reason: "timeout",
          durationMs: performance.now() - started,
        });
      }, CANONICAL_ORB_PREWARM_TIMEOUT_MS);

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
          try {
            worker?.postMessage({
              type: "render",
              requestId,
              payload: createPrewarmPayload(),
            });
          } catch {
            recordCanonicalOrbPrewarmFailure("canonical-orb-prewarm-render");
            finish({
              ok: false,
              reason: "worker-render-failed",
              durationMs: performance.now() - started,
            });
          }
          return;
        }

        if (event.data.type === "rendered" && event.data.requestId === requestId) {
          finish({ ok: true, durationMs: performance.now() - started, reused: false });
        }
      };

      try {
        worker.postMessage({
          type: "init",
          canvas,
          size: PREWARM_SIZE,
          dpr: 1,
        }, [canvas]);
      } catch {
        recordCanonicalOrbPrewarmFailure("canonical-orb-prewarm-init");
        finish({
          ok: false,
          reason: "worker-init-failed",
          durationMs: performance.now() - started,
        });
      }
    });
  });

  return inFlight;
}

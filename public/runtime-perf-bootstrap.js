const key = "zenflow-runtime-perf-device-guard";
const motionKey = "zenflow_reduce_motion";
const version = 2;
const startup = "startup";
const offValues = new Set(["0", "false", "no", "off"]);

const disabledByQuery = () => {
  const params = new URLSearchParams(window.location.search);
  const explicit = params.get("runtimePerfGuard") ?? params.get("perfGuard");
  return explicit !== null && offValues.has(explicit.trim().toLowerCase());
};

const shouldApply = (rawGuard) => {
  if (!rawGuard) return false;
  try {
    const guard = JSON.parse(rawGuard);
    return (
      guard?.version === version &&
      guard?.mode === startup &&
      typeof guard?.expiresAt === "number" &&
      guard.expiresAt > Date.now()
    );
  } catch {
    return false;
  }
};

// In-app reduce-motion preference, applied pre-React so the first paint
// has no animation flash. React owns the same data-reduced-motion
// attribute and can therefore restore motion without a reload.
const reduceMotionEnabled = (rawPref) => {
  if (!rawPref) return false;
  try {
    return JSON.parse(rawPref)?.reduceMotion === true;
  } catch {
    return false;
  }
};

try {
  if (typeof window !== "undefined" && typeof document !== "undefined") {
    if (!disabledByQuery() && shouldApply(window.localStorage.getItem(key))) {
      document.documentElement.dataset.runtimePerf = startup;
    }
    if (reduceMotionEnabled(window.localStorage.getItem(motionKey))) {
      document.documentElement.dataset.reducedMotion = "true";
    }
  }
} catch {
  // Best-effort startup guard: never block app boot if storage is unavailable.
}

type RouteListener = () => void;

const listeners = new Set<RouteListener>();
let installed = false;

function notifyRouteListeners(): void {
  queueMicrotask(() => {
    for (const listener of [...listeners]) {
      try {
        listener();
      } catch {
        // A diagnostic subscriber cannot break navigation or other subscribers.
      }
    }
  });
}

function ensureInstalled(): void {
  if (installed || typeof window === "undefined") return;
  installed = true;

  const originalPushState = window.history.pushState.bind(window.history);
  const originalReplaceState = window.history.replaceState.bind(window.history);
  window.history.pushState = (...args: Parameters<History["pushState"]>) => {
    const result = originalPushState(...args);
    notifyRouteListeners();
    return result;
  };
  window.history.replaceState = (...args: Parameters<History["replaceState"]>) => {
    const result = originalReplaceState(...args);
    notifyRouteListeners();
    return result;
  };
  window.addEventListener("popstate", notifyRouteListeners, { passive: true });
}

/**
 * One app-lifetime history observer with detachable data-owning listeners.
 * The wrapper holds only this module's Set, so account reset cannot resurrect
 * a disposed recorder through nested history monkey patches.
 */
export function subscribeDiagnosticRouteChange(listener: RouteListener): () => void {
  ensureInstalled();
  listeners.add(listener);
  return () => listeners.delete(listener);
}

/** Test-only count for proving reset/reinstall does not stack listeners. */
export function diagnosticRouteListenerCount(): number {
  return listeners.size;
}

/**
 * `scheduleIdle` — unified requestIdleCallback polyfill for Safari <16.4 and
 * older WKWebView. Centralizes the 4-line `if ("requestIdleCallback" in window)`
 * pattern that was duplicated across main.tsx and App.tsx.
 *
 * Use for non-critical init that should yield to the first paint:
 * telemetry bootstrap, asset preloads, cache warming.
 *
 * Source: caniuse "requestidlecallback" (Safari 16.4+, 2023); MDN recommends
 * `setTimeout(fn, 2000)` as canonical fallback. The 20-line inline polyfill
 * from `requestidlecallback-polyfill` is unnecessary for non-react init.
 *
 * Do not use for per-frame work — that's `requestAnimationFrame`.
 * Do not use where IdleDeadline API is inspected — this fallback fakes it.
 */
export interface IdleHandle {
  cancel: () => void;
}

type IdleFn = () => void;

export function scheduleIdle(fn: IdleFn, fallbackMs = 2000): IdleHandle {
  if (typeof window === "undefined") {
    return { cancel: () => {} };
  }
  if ("requestIdleCallback" in window) {
    const id = window.requestIdleCallback(fn);
    return { cancel: () => window.cancelIdleCallback(id) };
  }
  const id = window.setTimeout(fn, fallbackMs);
  return { cancel: () => window.clearTimeout(id) };
}

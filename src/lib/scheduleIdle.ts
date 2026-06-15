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

export function scheduleIdle(fn: IdleFn, fallbackMs = 2000, minDelayMs = 0): IdleHandle {
  const win = typeof window === "undefined" ? null : window;
  if (!win) {
    return { cancel: () => {} };
  }

  if (minDelayMs > 0) {
    let innerHandle: IdleHandle | null = null;
    const delayId = globalThis.setTimeout(() => {
      innerHandle = scheduleIdle(fn, fallbackMs, 0);
    }, minDelayMs);

    return {
      cancel: () => {
        globalThis.clearTimeout(delayId);
        innerHandle?.cancel();
      },
    };
  }

  if (
    typeof win.requestIdleCallback === "function" &&
    typeof win.cancelIdleCallback === "function"
  ) {
    const id = win.requestIdleCallback(fn, { timeout: fallbackMs });
    return { cancel: () => win.cancelIdleCallback(id) };
  }
  const id = globalThis.setTimeout(fn, fallbackMs);
  return { cancel: () => globalThis.clearTimeout(id) };
}

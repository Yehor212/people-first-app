/**
 * Core Web Vitals — dev-only attribution reporter.
 *
 * ## Why this is dev-only
 *
 * Sentry v10's `browserTracingIntegration` ALREADY captures CLS/FCP/INP/LCP/TTFB
 * as measurements on the pageload transaction — internally it bundles
 * `web-vitals`. Adding a second `web-vitals` loop in production would:
 *   1. Double-count metrics
 *   2. Waste bundle bytes (@sentry/* already ships the library)
 *   3. Use the deprecated `Sentry.setMeasurement()` API (v10 removed it)
 *
 * Therefore, in PRODUCTION this module is a no-op. In DEVELOPMENT, it loads
 * `web-vitals/attribution` (extra ~1.5 KB brotli over standard) to surface
 * the DOM node / event target / LoAF entry that caused each violation —
 * context Sentry does not expose through its own wrapper.
 *
 * ## Why call synchronously from main.tsx (not requestIdleCallback)
 *
 * web-vitals registers passive PerformanceObservers. Deferring to idle would
 * miss LCP entries that fire before the subscription. The library itself does
 * not block render; its listeners are zero-cost until an entry arrives.
 *
 * ## bfcache
 *
 * web-vitals v4+ handles `pageshow` with `persisted=true` internally. Do NOT
 * add custom `pagehide` / `unload` handlers — `unload` actively disables
 * bfcache eligibility.
 *
 * Sources:
 *   - web.dev/articles/inp (INP replaced FID in March 2024)
 *   - github.com/GoogleChrome/web-vitals#attribution-build
 *   - docs.sentry.io/product/insights/web-vitals/
 *   - docs.sentry.io/platforms/javascript/migration/v9-to-v10/ (setMeasurement deprecation)
 *   - web.dev/articles/bfcache#observe-when-a-page-is-restored-from-bfcache
 */

/**
 * Color-codes a metric's rating for console output. Red = poor, yellow = needs
 * improvement, green = good, gray = unknown. Follows the Core Web Vitals
 * thresholds published by web.dev for each metric.
 */
const RATING_STYLES: Record<string, string> = {
  good: "color: #10b981; font-weight: 600;",
  "needs-improvement": "color: #f59e0b; font-weight: 600;",
  poor: "color: #ef4444; font-weight: 600;",
};

/** Minimal shape we need from `web-vitals/attribution` — decoupled from SDK version. */
interface AttributedMetric {
  name: string;
  value: number;
  rating: string;
  delta: number;
  id: string;
  navigationType: string;
  attribution?: Record<string, unknown>;
}

/**
 * Store the last-seen metric for devtools inspection. Cumulative — overwrites
 * on subsequent reports (e.g. CLS can report multiple times). Attached to
 * window so developers can inspect `window.__zenflowVitals` in DevTools.
 */
interface VitalsInspection {
  [metric: string]: AttributedMetric;
}

declare global {
  interface Window {
    __zenflowVitals?: VitalsInspection;
  }
}

/**
 * Format a metric value with the appropriate unit.
 * CLS is unitless (0-1 range). Others are milliseconds.
 */
function formatValue(name: string, value: number): string {
  if (name === "CLS") return value.toFixed(3);
  return `${Math.round(value)} ms`;
}

/**
 * Log a metric to the console with color-coding and the attribution payload
 * (the DOM node / event / script that caused the violation).
 */
function logMetric(metric: AttributedMetric): void {
  const style = RATING_STYLES[metric.rating] ?? "color: #6b7280;";
  const formatted = formatValue(metric.name, metric.value);
  // eslint-disable-next-line no-console
  console.log(
    `[CWV] %c${metric.name}%c  ${formatted}  (${metric.rating})`,
    style,
    "color: inherit;",
    metric.attribution ?? {},
  );
}

/**
 * Register Core Web Vitals listeners in DEV only. No-op in production —
 * Sentry's `browserTracingIntegration` already captures these metrics.
 *
 * Safe to call multiple times: subsequent calls re-register listeners
 * (web-vitals dedupes internally per metric ID).
 *
 * Async because of the dynamic import. Never throws — errors are swallowed
 * to guarantee the app boot path is never blocked by observability code.
 */
export async function initWebVitalsDev(): Promise<void> {
  if (!import.meta.env.DEV) return;

  try {
    const mod = await import("web-vitals/attribution");
    const store: VitalsInspection = (window.__zenflowVitals ??= {});

    const onMetric = (metric: AttributedMetric): void => {
      store[metric.name] = metric;
      logMetric(metric);
    };

    mod.onCLS(onMetric);
    mod.onFCP(onMetric);
    mod.onINP(onMetric);
    mod.onLCP(onMetric);
    mod.onTTFB(onMetric);
  } catch (err) {
    // eslint-disable-next-line no-console
    console.warn("[CWV] web-vitals load failed (non-fatal):", err);
  }
}

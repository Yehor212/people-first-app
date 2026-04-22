/**
 * Long Animation Frame (LoAF) + Long Task — dev-only observability.
 *
 * ## Why this is dev-only
 *
 * Sentry v10 `browserTracingIntegration` already captures Long Tasks as spans
 * but does NOT yet surface `long-animation-frame` attribution (roadmap). This
 * module fills that gap locally without shipping bytes to production.
 * PerformanceObserver has per-frame overhead — leave it off in prod.
 *
 * ## LoAF vs Long Task
 *
 *   - `longtask`            : any task >50ms. No attribution for *what*.
 *   - `long-animation-frame`: any rendering frame >50ms, with `scripts[]`
 *                             attribution (invoker, sourceURL, sourceFunctionName,
 *                             executionStart, duration). INP root-cause tool.
 *
 * ## Coexistence with web-vitals
 *
 * `web-vitals/attribution` v4+ bundles LoAF entries inside `onINP` attribution.
 * That only captures ONE frame (the one behind the worst INP). A standalone
 * observer captures *every* slow frame — useful for broad jank hunting during
 * dev. The two are complementary; neither supersedes the other.
 *
 * ## Safari / Firefox fallback
 *
 * As of 2026-04, LoAF ships in Chrome/Edge/Opera 123+ and Chrome-Android. Safari
 * and Firefox do not support it. We probe `PerformanceObserver.supportedEntryTypes`
 * and fall back to `longtask` where available. Never throws.
 *
 * Sources:
 *   - web.dev/articles/long-animation-frames (LoAF spec + entry shape)
 *   - developer.chrome.com/docs/web-platform/long-animation-frames
 *   - web.dev/articles/optimize-long-tasks (Long Task background)
 *   - caniuse.com mdn-api_performancelonganimationframetiming (browser matrix)
 *   - MDN PerformanceObserver.supportedEntryTypes (feature detection)
 *   - MDN PerformanceObserver.observe (`buffered: true` replays past entries)
 *   - github.com/GoogleChrome/web-vitals CHANGELOG v4+ (INP+LoAF bundle)
 */

/** Shape we need from a LoAF entry — spec-aligned, SDK-independent. */
interface LoAFScript {
  invoker?: string;
  invokerType?: string;
  executionStart?: number;
  duration: number;
  sourceURL?: string;
  sourceFunctionName?: string;
}
interface LoAFEntry extends PerformanceEntry {
  renderStart?: number;
  styleAndLayoutStart?: number;
  blockingDuration?: number;
  scripts?: LoAFScript[];
}

/** Rolling per-source blocking stats, keyed by sourceURL (or 'anonymous'). */
interface ScriptStat {
  count: number;
  totalDuration: number;
  worstDuration: number;
  lastFunction: string;
}

interface LoAFInspection {
  slowFrames: LoAFEntry[];
  topOffenders: Map<string, ScriptStat>;
  longTasks: number;
  supported: { loaf: boolean; longtask: boolean };
}

declare global {
  interface Window {
    __zenflowLoAF?: LoAFInspection;
  }
}

const WINDOW_MS = 60_000;
const FLUSH_MS = 30_000;
const TOP_N = 5;

/** Track a single LoAF entry into the rolling map. */
function recordScripts(
  store: LoAFInspection,
  entry: LoAFEntry,
): void {
  store.slowFrames.push(entry);
  const cutoff = performance.now() - WINDOW_MS;
  store.slowFrames = store.slowFrames.filter((f) => f.startTime >= cutoff);

  for (const s of entry.scripts ?? []) {
    const key = s.sourceURL || s.invoker || "anonymous";
    const prev = store.topOffenders.get(key) ?? {
      count: 0,
      totalDuration: 0,
      worstDuration: 0,
      lastFunction: "",
    };
    prev.count += 1;
    prev.totalDuration += s.duration;
    prev.worstDuration = Math.max(prev.worstDuration, s.duration);
    prev.lastFunction = s.sourceFunctionName || prev.lastFunction;
    store.topOffenders.set(key, prev);
  }
}

/** Dump a collapsed summary if any slow frames observed this window. */
function flushSummary(store: LoAFInspection): void {
  if (store.slowFrames.length === 0 && store.longTasks === 0) return;
  const top = [...store.topOffenders.entries()]
    .sort((a, b) => b[1].totalDuration - a[1].totalDuration)
    .slice(0, TOP_N);
  // eslint-disable-next-line no-console
  console.groupCollapsed(
    `[LoAF] ${store.slowFrames.length} slow frames, ${store.longTasks} long tasks (last ${FLUSH_MS / 1000}s)`,
  );
  for (const [url, stat] of top) {
    // eslint-disable-next-line no-console
    console.log(
      `${Math.round(stat.totalDuration)}ms (worst ${Math.round(stat.worstDuration)}ms, x${stat.count}) — ${url} ${stat.lastFunction}`,
    );
  }
  // eslint-disable-next-line no-console
  console.groupEnd();
  store.topOffenders.clear();
  store.longTasks = 0;
}

/**
 * Register LoAF + Long Task observers in DEV only. Never throws — wraps every
 * failure path in try/catch so observability code cannot break app boot.
 * Exposes `window.__zenflowLoAF` for DevTools inspection.
 */
export function initLongTaskObserverDev(): void {
  if (!import.meta.env.DEV) return;
  if (typeof PerformanceObserver === "undefined") return;
  if (window.__zenflowLoAF) return;

  const supported = PerformanceObserver.supportedEntryTypes ?? [];
  const hasLoAF = supported.includes("long-animation-frame");
  const hasLongTask = supported.includes("longtask");
  if (!hasLoAF && !hasLongTask) return;

  const store: LoAFInspection = (window.__zenflowLoAF = {
    slowFrames: [],
    topOffenders: new Map(),
    longTasks: 0,
    supported: { loaf: hasLoAF, longtask: hasLongTask },
  });

  try {
    if (hasLoAF) {
      new PerformanceObserver((list) => {
        for (const entry of list.getEntries()) {
          recordScripts(store, entry);
        }
      }).observe({ type: "long-animation-frame", buffered: true });
    } else if (hasLongTask) {
      // Safari/Firefox fallback: coarse signal, no script attribution.
      new PerformanceObserver((list) => {
        store.longTasks += list.getEntries().length;
      }).observe({ type: "longtask", buffered: true });
    }
  } catch {
    // Swallow — never block boot path on observability.
    return;
  }

  // Flush summary on interval; cap memory even if dev tab runs for hours.
  window.setInterval(() => flushSummary(store), FLUSH_MS);
}

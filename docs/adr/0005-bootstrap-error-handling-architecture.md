# ADR-0005 — Bootstrap Error-Handling Architecture

## Status

Accepted — 2026-04-19

## Context

During the 2026-04-18 tech-debt audit, deep inspection of `src/main.tsx` (406 LOC)
and `src/App.tsx` (156 LOC) revealed three distinct error-observability gaps at
the app bootstrap layer:

1. **Pre-Sentry silent-drop window.** Sentry is lazy-loaded via
   `requestIdleCallback` (~2s after first paint) to keep `@sentry/*` off the
   critical rendering path. Any error thrown between module-eval and idle-init
   completion hit the global handlers with `captureError === null`, returning
   a no-op. First-paint errors were invisible to telemetry.

2. **Missing `vite:preloadError` handler.** Vite dispatches a dedicated typed
   event on `<link rel="modulepreload">` / `import()` failures. Existing
   `setupChunkErrorHandler` (UpdateRequiredDialog.tsx:119) string-matches the
   generic `error` event for `"Failed to fetch dynamically imported module"`
   — this catches dynamic-import failures but misses preload-link failures
   (CSS chunks, early module preloads).

3. **`ErrorBoundary` positioned inside providers.** Eight provider wrappers
   (`AnimationGate` / `QueryClient` / `Language` / `RtlDirection` /
   `FeatureFlags` / `EmotionTheme` / `AICoach` / `XpPopup` / `FlyingEmoji`)
   nest around the `ErrorBoundary`. If any provider throws during render or
   init, the boundary never mounts → white screen, no fallback UI, no
   telemetry.

## Decision

Three surgical additions, zero visual regression:

### 1. Pre-Sentry error buffer

A 50-slot FIFO queue (`preSentryErrorBuffer`) captures Error instances before
Sentry's idle-init completes. The `captureOrBuffer(error, context)` helper
replaces direct `captureError(...)` calls at the global handler sites. Flush
happens in the `idleInit` callback after `captureError` is wired, forwarding
all buffered errors with a `buffered: true` context tag.

Cap at 50 bounds memory during pathological crash loops. Pattern mirrors
Sentry's JS Loader `onLoad` queue.

### 2. Typed `vite:preloadError` handler

Added in `main.tsx` alongside the other global handlers. Calls
`event.preventDefault()` to block Vite's default auto-reload (user loses
unsaved state) and dispatches the existing `CHUNK_LOAD_ERROR_EVENT` so the
`UpdateRequiredDialog` handles the user-facing refresh prompt. Type safety via
`WindowEventMap` augmentation in `src/types/vite-preload.d.ts`.

### 3. `RootErrorBoundary` (context-free outermost)

A new export from `ErrorBoundary.tsx` that uses the same `ErrorBoundaryBase`
class (no hook calls — safe anywhere) with hardcoded English fallback strings.
Wraps the entire provider tree as the outermost layer in `App.tsx`. Inner
`ErrorBoundary` (with localized UX via `useLanguage`) stays in place for
non-provider errors.

Three-tier error containment:
- `RootErrorBoundary` — provider crashes, English fallback
- `ErrorBoundary` — app-level, localized UX
- `ModalErrorBoundary` / `LazyErrorBoundary` — feature-level

All three route through the same `componentDidCatch` → `logError` (localStorage)
+ `crashReporting.recordError` (native) + `lazyCaptureError` (Sentry) pipeline.

### 4. `onRecoverableError` on `createRoot`

React 18 supports `onRecoverableError` in `createRoot` options. Recoverable
errors (concurrent render errors, hydration mismatches) now forward to Sentry
via `captureOrBuffer` with `type: "recoverable"` tag. React 19 will add
`onCaughtError` / `onUncaughtError` — wire them during that upgrade.

### 5. `scheduleIdle` utility

DRY extraction of the three-line `requestIdleCallback` + `setTimeout(2000)`
polyfill that was duplicated three times (main.tsx:1, App.tsx:2). Returns an
`IdleHandle` with `.cancel()` for symmetry.

## Consequences

### Positive

- Zero silent-drop window for bootstrap errors.
- Provider-layer crashes now show fallback UI + report to telemetry.
- Preload-link failures now route through the same user-facing dialog as
  dynamic-import failures.
- Three-tier boundary hierarchy means a feature-level crash does not take out
  the whole app.

### Trade-offs

- `RootErrorBoundary` uses English-only strings. Acceptable: it only shows
  when a provider (including `LanguageProvider`) has crashed, so translations
  would be unavailable anyway.
- 50-slot buffer could theoretically lose errors in a pathological crash
  loop. Bounded by design — unbounded queue risks memory exhaustion.
- `vite:preloadError` typed via ambient `.d.ts` augmentation — requires
  maintenance if Vite ever changes the event shape. Low risk; Vite has kept
  this API stable since v4.

### Neutral

- Three new files: `src/lib/scheduleIdle.ts`, `src/lib/__tests__/scheduleIdle.test.ts`,
  `src/types/vite-preload.d.ts`.
- Tests grew from 3786 → 3843 grep-count (+57 over baseline, of which +3 are
  new `scheduleIdle` unit tests). Ratchet floor auto-bumps.

## Sources

- docs.sentry.io/platforms/javascript/install/lazy-load-sentry/ (2025) —
  `onLoad` queue pattern
- vite.dev/guide/build.html#load-error-handling — `vite:preloadError` event
- vitejs/vite#11804 — preload error handling thread
- react.dev/reference/react-dom/client/createRoot — `onRecoverableError`
- MDN `Window/unhandledrejection_event`
- caniuse "requestidlecallback" — Safari 16.4+ support matrix

## Related

- ADR-0002 — Zustand/Dexie bridge pattern (same session)
- ADR-0003 — 28-law enforcement hooks
- `memory/project_tech_debt_roadmap_2026-04-18.md` — Stage 6 section
- `docs/tech-debt-audit-2026-04-18.md` — full audit

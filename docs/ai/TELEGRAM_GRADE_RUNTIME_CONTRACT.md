# Telegram-Grade Runtime Contract

Purpose: keep ZenFlow responsive, synchronized, and visually stable across V1,
V2, web, PWA, Android, iOS, desktop, phone layout, sidebar, and drawer.

This is an operator contract for future agents. Read it before changing
performance, startup, sync, navigation, service workers, WebGL/canvas, the
canonical orb family, IndexedDB/Dexie, Supabase, offline queue, app lifecycle,
or any cross-platform user flow.

## North Star

The app must feel immediate even when the network, storage, WebGL, or device is
slow. The latest user action must converge everywhere after sync settles, and
the user must not see visual regressions while performance is improved.

Telegram is the model at the architecture level, not a code source to copy:
local durable state, ordered updates, async work, resilient recovery, and fast
UI handoff.

## Non-Negotiable Invariants

1. **No visual regression as a performance fix.**
   - Do not replace premium visuals with cheaper approximations.
   - Do not change the canonical orb appearance to make a metric pass.
   - If a performance change touches UI, collect screenshot or trace evidence.

2. **Canonical orb family is frozen.**
   - Full state-of-mind surfaces use `ValenceOrb`.
   - Compact, portal, diary, sidebar, and drawer surfaces use `MiniValenceOrb`.
   - CSS-only, SVG, icon, Lottie, static gradient, or second canvas orb systems
     are regressions unless there is an explicit product-level visual migration.
   - Keep `docs/ai/CANONICAL_ORB_INVARIANT.md` and
     `npm run check:canonical-orbs` authoritative.

3. **First paint comes before non-critical work.**
   - Startup must render the useful shell before Sentry, cache warming, backup
     sync, chart code, export code, stickers, optional audio, or non-critical
     analytics.
   - Work that can wait must be scheduled after first paint, idle, or user
     intent.

4. **Heavy work must yield or move off the main thread.**
   - Long loops, bulk imports, exports, snapshot merges, and expensive rendering
     setup must be chunked, workerized, or delayed.
   - A route fix is incomplete if Chrome still shows a route long task over the
     agreed budget.

5. **Ordered sync beats arrival order.**
   - `sync_events.seq` owns cross-device ordering.
   - BroadcastChannel, Supabase Realtime, service worker messages, and native
     resume events are wake-up signals, not durable ordering sources.
   - V1 and V2 shells must both mount `useTelegramGradeSyncRuntime()` so direct
     `/orb`, `/habits`, `/diary`, and `/settings` entry points receive the same
     ordered-delta runtime as classic V1.
   - `docs/ai/SYNC_CONTRACT.md` is the sync source of truth.

6. **Deletes are durable and anti-resurrection by default.**
   - Tombstones beat stale snapshots, stale IndexedDB hydration, backup import,
     and delayed remote pulls.
   - A delete fix needs V1 to V2 to V1 proof when both shells can touch the data.

7. **One sync owner per browser profile when possible.**
   - Multiple tabs are a supported platform.
   - Use `runWithSyncLeaderLock()` for delta pull/apply loops. It uses Web Locks
     where available and a short localStorage lease fallback for WebView/WKWebView
     contexts that do not expose Web Locks.
   - BroadcastChannel, Supabase Broadcast, visibility, and native resume events
     may wake sync, but they must not advance the cursor outside the owner lock.

8. **Cross-platform means behavior, not only layout.**
   - Web, PWA, Android WebView, iOS/WKWebView, desktop, phone layout, sidebar,
     and drawer must preserve the same data semantics and visual canon.
   - Native lifecycle events must not duplicate browser lifecycle work.

9. **Public-user claims need public-user proof.**
   - If the reported issue is on GitHub Pages, verify the deployed artifact or
     public URL with a cache-buster before claiming it is fixed.
   - Local preview is necessary but not sufficient for production-deploy claims.

10. **No evidence means not complete.**
    - Metrics, screenshots, sync proof, or command output must back every PASS.
    - Static inference can guide work, but runtime claims need runtime evidence.

## Performance Model

### Budgets

Use the current route budgets unless a task explicitly sets stricter ones:

- `longtask` over `500ms`: fail.
- `longtask` over `300ms`: warn and investigate.
- `long-animation-frame` over `250ms`: warn and inspect attribution when Chrome
  supports it.
- Route budgets live in `config/chrome-performance-budgets.json`; do not bury
  new performance thresholds inside test code.
- Chrome route smoke must report cold-boot and steady-state separately. Cold boot
  keeps the long-task fail budget; steady-state owns the animation-frame warning
  budget after the first route paint has settled.
- Interaction path should paint before non-critical async work starts.
- Service worker update checks must not block regular first render except on
  recovery-critical paths.

The browser standard long-task threshold is `50ms`; the ZenFlow budgets above
are release gates, not a definition of smoothness.

### Startup Order

Default startup priority:

1. Route shell, theme, language, safe areas, critical error handling.
2. IndexedDB hydration needed for the visible route.
3. First paint.
4. User-blocking event handlers and visible route data.
5. Deferred reliability work: version check, sync wake-up, telemetry, cache
   warming, non-visible route preload.
6. Optional work: charts, exports, stickers, ambient audio, heavy reports.

### Allowed Patterns

- Dynamic imports for routes and heavy feature modules.
- `requestAnimationFrame` for visual frame work.
- `scheduleIdle` for non-critical bootstrap work.
- Chunking large local work into small slices with a yield between slices.
- Web Workers or OffscreenCanvas for CPU/GPU setup that can leave the main
  thread.
- Progressive readiness states that keep the same visual design.

### Forbidden Patterns

- Synchronous full-backup export/import during initial render.
- Starting expensive chart, Lottie, export, sticker, or telemetry bundles before
  the route needs them.
- Replacing canonical WebGL orb visuals with a cheaper look to reduce blocking.
- Late visible renderer swaps that change the orb look or perceived motion.
- Long-running loops inside render, layout effects, or input handlers.
- Multiple lifecycle listeners triggering the same sync work without dedupe.

## Sync Model

ZenFlow uses Telegram-style semantics through local state plus ordered deltas:

- Write user action locally first when safe.
- Persist or queue the action durably.
- Write an ordered sync event for remote convergence.
- Apply remote events in `seq` order.
- Save cursor only after local apply succeeds.
- Detect gaps and recover before claiming convergence.
- Use tombstones for deletes and anti-resurrection.
- Treat backup/snapshot sync as bootstrap or repair, not normal ordering.

Before sync edits, inspect:

- `docs/ai/SYNC_CONTRACT.md`
- `src/storage/eventSync.ts`
- `src/hooks/useTelegramGradeSyncRuntime.ts`
- `src/hooks/useDeltaSyncEffects.ts`
- `src/hooks/useCloudSyncEffects.ts`
- `src/lib/syncBroadcast.ts`
- `src/lib/syncLeader.ts`
- `src/lib/syncGapDetector.ts`
- `src/lib/syncStateMachine.ts`
- `src/lib/syncOrchestrator.ts`
- `src/storage/realtimeSync.ts`
- `src/storage/cloudSync.ts`
- `src/storage/backup.ts`
- `src/storage/deletionTracker.ts`
- `src/lib/offlineQueue.ts`
- `supabase/migrations/*sync*.sql`

## Platform Matrix

Every runtime-sensitive change must account for this matrix.

| Platform | Required proof |
| --- | --- |
| Web local preview | Production build, preview route smoke, console/network check |
| GitHub Pages/PWA | Public URL with cache-buster, stale service worker/update behavior |
| Android WebView | `build:android` or explicit UNVERIFIED note, pause/resume/back behavior |
| iOS/WKWebView | Explicit UNVERIFIED note if simulator/device proof is unavailable |
| Desktop wide | Sidebar/drawer route parity, long task budget, canonical orb parity |
| Phone layout | 449x698 or equivalent route smoke, safe area, bottom nav, scrollability |
| Multi-tab browser | Broadcast/lock ownership and latest-action convergence |
| Offline/slow network | Offline queue, resume, retry, no stale snapshot overwrite |

## Agent Workflow

Use this sequence for performance, sync, navigation, orb, or cross-platform work:

1. Read this contract.
2. Read `docs/ai/PREFLIGHT_OPERATOR_TEMPLATE.md`.
3. Read `docs/ai/SYNC_CONTRACT.md` for data/sync work.
4. Read `docs/ai/CANONICAL_ORB_INVARIANT.md` for orb or visual primitive work.
5. Gather current repo evidence with search and file reads.
6. Reproduce or measure the issue before proposing fixes.
7. Identify the root cause and the affected platforms.
8. Implement the smallest change that fixes the root cause.
9. Run the required gates.
10. Verify public deployment when the user-reported issue is public.

## Evidence Requirements

Performance work needs:

- Route name and URL.
- Viewport/device profile.
- Max long task and max long animation frame when available.
- Console errors and failed requests.
- Before/after comparison when changing runtime behavior.
- Public Chrome diagnostics can be enabled with `?perf=1`, `?runtimePerf=true`,
  `?dev=true`, or localStorage key `zenflow-runtime-perf-recorder`. Inspect
  `window.__zenflowRuntimePerf.snapshot()` in DevTools after the first
  idle period. This recorder is lazy-loaded after first paint, is for
  measurement only, and must not drive UI state.

Sync work needs:

- Entity type.
- Source action.
- Event or queue path.
- Delta apply path.
- Delete/tombstone behavior when relevant.
- V1 to V2 to V1 or two-tab proof when relevant.

Visual work needs:

- Screenshot or trace evidence.
- Phone and desktop coverage when the surface exists in both.
- Dark/light or theme-switch proof when the issue is theme-sensitive.
- Canonical orb guard when state-of-mind visuals are touched.

Deployment work needs:

- Commit or asset hash when available.
- CI/deploy result.
- Public URL with cache-buster.
- Service-worker stale-cache check when relevant.

## Required Gates

Minimum local gates for this contract:

```bash
npm run check:canonical-orbs
npm run check:sync-contract
npm run check:all
npm run smoke:chrome-performance
```

Add these based on scope:

```bash
npm run bundle:report:strict
npm run check:size
npm run check:supabase-migration-prefixes
npm run build:android
npm run ci:remote:wait
```

Sync-specific tests should include the relevant event, gap, offline queue,
deletion tracker, and V1/V2 round-trip tests.

`npm run check:sync-contract` is the mechanical guard for future sync tasks. It
does not replace runtime proof, but it must stay green before claiming that
ordered deltas, snapshot bootstrap, server tombstones, docs, and CI wiring are
still intact.

## Stop Conditions

Stop and report instead of claiming completion if:

- No route metric was collected for a performance claim.
- No screenshot or trace was collected for a visual claim.
- No sync convergence proof was collected for a sync claim.
- Public deploy state was not verified for a public URL claim.
- A fix changes canonical orb visuals.
- A sync change can resurrect deleted data.
- A snapshot path can overwrite newer event-log state.
- A native platform is affected but only web was checked.
- Tooling is blocked and the remaining state would be overstated as PASS.

## References

- Internal: `docs/ai/SYNC_CONTRACT.md`
- Internal: `docs/ai/CANONICAL_ORB_INVARIANT.md`
- Internal: `docs/ai/PREFLIGHT_OPERATOR_TEMPLATE.md`
- Internal: `scripts/smoke-chrome-performance.cjs`
- Internal: `scripts/check-canonical-orbs.mjs`
- External: Telegram TDLib, local-first ordered update architecture
- External: Chrome Long Tasks and Long Animation Frames documentation
- External: Supabase RLS and Realtime documentation

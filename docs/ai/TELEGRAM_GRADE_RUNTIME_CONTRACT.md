# Telegram-Grade Runtime Contract

Purpose: keep ZenFlow responsive, synchronized, and visually stable across V1,
V2, web, PWA, Android, iOS, desktop, phone layout, sidebar, and drawer.

This is an operator contract for future agents. Read it before changing
performance, startup, sync, navigation, service workers, WebGL/canvas, the
canonical orb family, IndexedDB/Dexie, Supabase, offline queue, app lifecycle,
or any cross-platform user flow.

When the user asks for best practices, deep research, complete implementation,
or hidden gaps, expand implied cross-platform requirements first with
`docs/ai/BEST_PRACTICES_IMPLIED_REQUIREMENTS_GATE.md`, then close the work with
the Done Packet in `docs/ai/TASK_COMPLETION_PROTOCOL.md`.

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
   - A successful domain write with a failed `sync_events` insert must enter the
     critical `WRITE_SYNC_EVENT` outbox and broadcast only after the durable
     event row exists.
   - `sync_events.idempotency_key` must be a UUID compatible with the live
     Supabase schema. Keep device/entity/op identity in their own columns and
     normalize legacy queued string keys before retrying.
   - User-state sync functions must await the durable event/outbox write before
     resolving. A background `.then(writeEventAndBroadcast)` can be dropped by
     tab close, app pause, WebView suspension, or native process eviction.
   - Offline/outbox queue mutations must wait for IndexedDB or fallback storage
     persistence before reporting success.
   - V1 and V2 shells must both mount `useTelegramGradeSyncRuntime()` so direct
     `/orb`, `/habits`, `/diary`, and `/settings` entry points receive the same
     ordered-delta runtime as classic V1.
   - `device_sessions` records coarse account-device sync presence from that
     shared runtime. It is for UX, sync health, and support; it must not store
     raw browser fingerprints, content, payloads, or IP addresses.
   - `docs/ai/SYNC_CONTRACT.md` is the sync source of truth.
   - `docs/ai/TELEGRAM_GRADE_20_IDEA_LEDGER.md` maps the Telegram-inspired
     product controls that sit on top of the sync/runtime invariants.

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
- `long-animation-frame.blockingDuration` over `120ms`: warn as likely
  interaction jank.
- Non-blocking long animation frames with no costly script attribution are
  diagnostics, not a PASS by themselves and not a reason to hide real lag. Keep
  them in the report so render/compositor pressure can still be tracked without
  confusing it with main-thread input blocking.
- Runtime performance guard may downgrade optional motion only from long tasks,
  severe blocking LoAF, or repeated blocking LoAF. It must not downgrade
  canonical visuals or motion because of render-only LoAF with zero blocking.
- On the Android paper-theme Orb, runtime strain must not replace the
  consolidated daylight compositor with the multi-layer CSS fallback. Only the
  user/OS reduced-motion preference or the existing critical-battery gate may
  stop that ambient motion. Keep this behavior protected by
  `CosmicBgAdapter.androidVisualStability.test.tsx`; a day-theme change is not
  complete if the same ADB drag/drawer flow reintroduces Chromium tile-memory
  exhaustion or makes required controls disappear.
- On Android, an active canonical Orb worker must process `dispose`, release its
  WebGL resources and acknowledge `disposed` before the main thread terminates
  it. Keep a bounded termination fallback for a silent or broken Android
  worker; do not restore synchronous `postMessage({ type: 'dispose' })` plus
  `terminate()` on that platform. Preserve the existing immediate termination
  behavior outside Android until those platforms receive their own runtime
  scope and evidence. Android theme/lifecycle verification must repeat the
  semantic drawer flow and confirm that worker canvases and compositor layers
  do not accumulate between paper/ink cycles.
- For Android WebView disappearance reports, a complete UIAutomator/accessibility
  tree proves interaction reachability, not visible raster output. The required
  proof is one uninterrupted external-window video of the semantic interaction,
  aligned with `logcat` tile-memory/context-loss signals and the same installed
  APK hash. Still frames are phase locators only. Any reproducible
  `tile memory limits exceeded, some content may not draw` signal or required
  control missing in the video keeps Visual Runtime and Motion at `FAIL`, even
  when React tests, DOM probes, accessibility checkpoints, and builds pass.
  The same installed APK hash must be captured immediately before and after the
  accepted interaction; a changed package path, version, PID, or digest rejects
  that run instead of weakening the evidence requirement.
- `.codex/hooks/android-visual-runtime-gate.cjs` enforces this boundary for
  Android visual/motion success claims. Its `UserPromptSubmit` contract requires
  semantic Android input, local and installed APK SHA-256 before and after the
  same run, a recording of the specific Android Emulator window or physical
  device screen, and a separate CDP-off performance pass. Its `Stop` check reads
  a fresh packet under `output/`, recomputes every referenced artifact hash, and
  blocks `PASS` when the APK changed, the capture target was a desktop region,
  any referenced file is missing, motion was not reviewed, or tile-memory,
  context-loss, ANR/crash, deadline-miss, or frame-gap gates fail. Keep honest
  `FAIL` and `UNVERIFIED` reporting available. The hook is defense in depth:
  tracked registration and static checks do not prove that an already-running
  Codex client loaded a newly changed hook.
- Fix Android disappearance and jank one reproduced cause at a time. Align the
  semantic-action timestamp with the external video, WebView/CDP evidence, and
  FrameTimeline/logcat signal; write the smallest RED test or characterization;
  patch only the attributed overlay, lifecycle, main-thread, worker, surface, or
  compositor defect; then repeat the identical route. Reject a candidate that
  does not improve the Android runtime or that changes accepted geometry,
  colors, blur, opacity, assets, duration, easing, motion trajectory, or visual
  density.
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
- Replacing canonical WebGPU/WebGL orb visuals with a cheaper look to reduce blocking.
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
- `src/storage/deviceSessions.ts`
- `src/hooks/useTelegramGradeSyncRuntime.ts`
- `src/hooks/useDeviceSessionRuntime.ts`
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

Every runtime-sensitive change must account for this matrix. V2 fullscreen and safe-area work must also follow `docs/ai/V2_FULLSCREEN_EDGE_TO_EDGE_CONTRACT.md`.

| Platform | Required proof |
| --- | --- |
| Web local preview | Production build, preview route smoke, console/network check |
| GitHub Pages/PWA | Public URL with cache-buster, stale service worker/update behavior |
| Android WebView | `build:android` or explicit UNVERIFIED note, pause/resume/back behavior |
| iOS/WKWebView | `npm run cap:sync:ios` plus the GitHub Actions `ios-gate` macOS simulator build, or explicit UNVERIFIED note if simulator/device proof is unavailable |
| Desktop wide | Sidebar/drawer route parity, long task budget, canonical orb parity |
| Phone layout | 449x698 or equivalent route smoke, safe area, bottom nav, scrollability |
| Multi-tab browser | Broadcast/lock ownership and latest-action convergence |
| Offline/slow network | Offline queue, resume, retry, no stale snapshot overwrite |

## Agent Workflow

Use this sequence for performance, sync, navigation, orb, or cross-platform work:

1. Read this contract.
2. Read `docs/ai/PREFLIGHT_OPERATOR_TEMPLATE.md`.
3. Read `docs/ai/TASK_COMPLETION_PROTOCOL.md` before claiming a task is done.
4. Read `docs/ai/V2_FULLSCREEN_EDGE_TO_EDGE_CONTRACT.md` for V2 fullscreen, safe-area, viewport, and native edge-to-edge work.
5. Read `docs/ai/SYNC_CONTRACT.md` for data/sync work.
6. Read `docs/ai/TELEGRAM_GRADE_SYNC_100_PERCENT_CLOSURE.md` for any sync,
   account, cross-shell, offline, resume, or Supabase convergence work.
7. Read `docs/ai/TELEGRAM_GRADE_20_IDEA_LEDGER.md` for sync/runtime/account
   tasks and map every touched row to evidence.
8. Read `docs/ai/CANONICAL_ORB_INVARIANT.md` for orb or visual primitive work.
9. Gather current repo evidence with search and file reads.
10. Reproduce or measure the issue before proposing fixes.
11. Identify the root cause and the affected platforms.
12. Implement the smallest change that fixes the root cause.
13. Run the required gates.
14. Verify public deployment when the user-reported issue is public.
15. Write the Done Packet from `docs/ai/TASK_COMPLETION_PROTOCOL.md`.

## Evidence Requirements

Performance work needs:

- Route name and URL.
- Viewport/device profile.
- Max long task and max long animation frame when available.
- Max LoAF `blockingDuration` and whether long frames are attributed to scripts
  or non-blocking render work.
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
- Optional public/debug diagnostics: enable `?syncHealth=1`, `?syncDebug=true`,
  `?runtimeSync=on`, or local key
  `zenflow-sync-health-recorder`, then inspect
  `window.__zenflowSyncHealth.snapshot()` for route, auth state, online state,
  queue counts, last cursor, and sync receipts. This recorder must stay
  privacy-safe: no payloads, entity ids, journal text, habit names, or user
  content. It is evidence for runtime state, not a replacement for live
  same-account sync proof.
- For repeatable browser proof of that diagnostic surface, run
  `cmd /c npm run smoke:sync-health`. For deployed GitHub Pages checks, set
  `ZENFLOW_SYNC_HEALTH_URL` to the public cache-busted route before running it.

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
npm run check:sync-contract
npm run check:canonical-orbs
npm run check:all
npm run smoke:chrome-performance
npm run smoke:telegram-sync-drill
```

Add these based on scope:

```bash
npm run bundle:report:strict
npm run check:size
npm run check:supabase-migration-prefixes
npm run build:android
npm run cap:sync:ios
npm run ci:remote:wait
```

Sync-specific tests should include the relevant event, gap, offline queue,
deletion tracker, and V1/V2 round-trip tests.

`npm run check:sync-contract` is the mechanical guard for future sync tasks. It
does not replace runtime proof, but it must stay green before claiming that
ordered deltas, snapshot bootstrap, server tombstones, docs, and CI wiring are
still intact.

`npm run smoke:telegram-sync-drill` is the mechanical completion drill for sync
claims. It combines the local invariant checks, targeted sync tests, canonical
orb guard, migration-prefix guard, optional browser sync-health proof, and
optional same-account Supabase proof into one `PASS` / `PARTIAL` / `FAIL`
status. A `PARTIAL` drill must be reported as a remaining proof gap, not as
completion.

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
- Internal: `docs/ai/TASK_COMPLETION_PROTOCOL.md`
- Internal: `scripts/smoke-chrome-performance.cjs`
- Internal: `scripts/check-canonical-orbs.mjs`
- External: Telegram TDLib, local-first ordered update architecture
- External: Chrome Long Tasks and Long Animation Frames documentation
- External: Supabase RLS and Realtime documentation

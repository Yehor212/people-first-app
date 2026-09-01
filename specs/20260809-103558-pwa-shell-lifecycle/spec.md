# Feature Specification: PWA Shell Lifecycle

**Feature directory**: `specs/20260809-103558-pwa-shell-lifecycle`  
**Created**: 2026-08-09  
**Status**: Pre-implementation, clarified  
**Scope**: Installed PWA and Web/Vite shell only; installation, service-worker update, cache ownership, offline fallback, and privacy-safe PWA diagnostics.

## User failure and current evidence

An installed ZenFlow user can lose the browser's install opportunity when `beforeinstallprompt` arrives before the Settings surface mounts, be reloaded by an automatically activated service worker while a durable writer is unfinished, or have an unrelated same-origin cache cleared during stale-chunk recovery. These are shell-lifecycle failures, not failures of the user's local data.

Current local evidence: `src/hooks/usePwaInstall.ts` subscribes only when its consuming component mounts; `src/sw.ts` calls `skipWaiting()` during install and deletes every Cache Storage name on `CLEAR_CACHES`; `vite.config.ts` uses `registerType: "autoUpdate"`; and `public/offline.html` already provides eight-locale copy but reads the language through direct localStorage. `public/manifest.webmanifest` and `docs/manifest.webmanifest` share a stable `id`, but declare only `portrait-primary` orientation.

## Explicit requirements

- The PWA shell has one runtime-surface resolver and one application-lifetime install-event owner.
- PWA manifest identity remains stable; both orientations, progressive locale metadata, square/maskable icon declarations, and manual Safari installation help are covered. No automatic install banner is introduced.
- A waiting service-worker update is visible to the user; activation/reload must wait for an explicit user choice and a bounded dirty-writer barrier, including stale-chunk recovery.
- Cache deletion is limited to ZenFlow-owned cache names; an unrelated same-origin cache must survive.
- PWA diagnostics receive only a sanitized route identifier, never raw query parameters or fragments.
- The emergency offline page remains localized, accessible, and honest about local availability without claiming remote convergence.

## Non-goals

- No Android/Capacitor, iOS/WKWebView, or Desktop/Tauri source change.
- No migration, new persistent user-data record, remote write, Sync API semantic change, dependency, paid service, public deploy, publication, or native install/update feature.
- No automatic browser install prompt/banner, automatic update activation, forced reload, cache-wide deletion, or claim that sync converges while all PWA clients are closed.
- No visual redesign, canonical-orb change, logo geometry change, audio work, or feature `002-habit-model-library` activation.

## Clarifications

### Session 2026-08-09

- Q: Which PWA installation surface should own the deferred browser event? → A: One application-lifetime shell owner, exposed to Settings only after capture.
- Q: Should a waiting worker activate automatically when it appears? → A: No; only after an explicit user action and a successful bounded writer barrier.
- Q: Which update recovery is in scope? → A: Both normal waiting-worker updates and stale-chunk recovery use the same safe update contract.
- Q: Which cache names may recovery delete? → A: Only names owned by ZenFlow; unrelated same-origin caches must remain.
- Q: What install path is required where `beforeinstallprompt` is unavailable? → A: Manual Safari install help, without synthetic availability or an automatic banner.

## User scenarios and testing

### User Story 1 — Install from Settings after early prompt (Priority: P1)

An eligible Web/PWA user opens ZenFlow, receives the browser install event before visiting Settings, and later chooses the Settings installation action. The action accurately reflects availability and can start the retained browser prompt once. If the browser does not expose the prompt, the surface offers manual Safari instructions only where applicable; it does not promise installability.

**Why this priority**: The existing hook starts listening only after its consumer mounts, so the user can lose an actual browser-provided opportunity.

**Independent test**: A focused test dispatches the deferred browser event before a Settings consumer mounts and proves that the consumer receives it; accepted, dismissed, error, installed, unavailable, and standalone states remain distinguishable.

**Acceptance scenarios**:

1. **Given** the event was captured at app start and Settings mounts later, **when** the user selects Install, **then** the saved event's prompt is invoked once and the recorded result is accepted, dismissed, or error.
2. **Given** the app is already standalone or the runtime cannot install, **when** Settings opens, **then** it does not advertise a browser prompt; Safari receives manual help only.
3. **Given** the browser sends `appinstalled`, **when** the shell receives it, **then** availability is cleared and the installed state is reported without storing an invented success result.

### User Story 2 — Choose a safe update (Priority: P1)

An installed PWA user sees a waiting update rather than an unexpected reload. When the user accepts, ZenFlow waits for all registered dirty writers to settle or reject within the documented timeout before asking the waiting worker to activate. A rejected or timed-out writer prevents reload and leaves recovery visible.

**Why this priority**: `src/sw.ts` currently activates immediately, which can interrupt a user-visible local write or stale-chunk recovery.

**Independent test**: A lifecycle contract test simulates normal and stale-chunk update paths with clean, resolving, rejecting, and timing-out writer barriers and asserts zero or one reload as appropriate.

**Acceptance scenarios**:

1. **Given** a waiting worker and no dirty writer, **when** the user chooses Update, **then** the worker receives the approved activation signal and the document reloads at most once.
2. **Given** a dirty writer resolves before the timeout, **when** the user chooses Update, **then** activation occurs only after it resolves.
3. **Given** a dirty writer rejects or times out, **when** the user chooses Update, **then** the document does not reload and the user can continue or retry from a visible state.
4. **Given** a chunk-load failure detects a stale shell, **when** recovery starts, **then** it reuses the same barrier and cannot bypass it.

### User Story 3 — Recover offline without crossing ownership or privacy boundaries (Priority: P2)

An offline PWA user receives an accessible emergency page in their supported language, can retry after reconnecting, and is not shown invented remote-sync success. Shell diagnostics describe only a sanitized route identifier. Update recovery removes only ZenFlow cache names.

**Why this priority**: cache ownership and route privacy are security and reliability boundaries; an offline page is used when the normal localized runtime may be unavailable.

**Independent test**: Static and service-worker tests assert eight-language offline copy, RTL direction selection, owned-cache filtering, unrelated-cache survival, and exclusion of query/hash values from diagnostic payloads.

**Acceptance scenarios**:

1. **Given** a navigation request fails offline and the app shell is unavailable, **when** the emergency page appears, **then** it has a programmatic main landmark, localized title/retry text, a 44px retry control, and no claim that cloud sync has completed.
2. **Given** an update recovery requests cache cleanup, **when** an unrelated same-origin cache exists, **then** it remains untouched.
3. **Given** a route contains sensitive query or fragment values, **when** a lifecycle diagnostic is recorded, **then** it contains a route identifier without those values.

## Edge cases and recovery states

- Repeated `beforeinstallprompt`, repeated `appinstalled`, or a remounted Settings surface cannot produce duplicate prompt ownership or a false installed state.
- Browsers without `beforeinstallprompt`, Cache Storage, Service Worker, or standalone display-mode support expose only the capability they can honestly provide.
- Safari manual instructions are separate from the Chromium deferred-prompt path; there is no fake `canInstall` state.
- A waiting worker that disappears, receives no controller change, or reports an untrusted message leaves the update pending/error state instead of reloading.
- Writer registration after the barrier closes is rejected for that activation attempt; a failed, cancelled, or timed-out attempt can be retried from a new explicit action.
- A closed PWA client receives no claim of background convergence; the service worker may wake an open client but does not become the authoritative sync owner.
- Cache names with a ZenFlow-like substring but outside the defined ownership prefix are preserved. Cache API failures surface a bounded error state.
- A malformed location, unsupported locale, storage exception, or offline-page script failure falls back to English structural text; it does not block the retry control.
- RTL (`ar`, `he`), reduced motion, keyboard focus, screen reader naming, narrow phone safe-area, and desktop-width presentation are specified for user-visible shell surfaces.

## Requirements

### Functional requirements

- **FR-001 Runtime surface**: The shell MUST expose the exact internal contract `AppRuntimeSurface = "browser" | "installed-pwa" | "capacitor" | "tauri"`. Android/Capacitor and iOS/WKWebView both resolve to `capacitor`; browser Safari Home Screen resolves to `installed-pwa`. Installation, Web service-worker update, and Web cache-recovery behavior MUST run only for `browser` or `installed-pwa`.
- **FR-002 Lifetime install owner**: The Web/PWA app entry MUST install exactly one owner before Settings can mount, retain the latest valid deferred install event until consumed/installed/disposed, and expose a subscribable snapshot to Settings consumers without requiring a direct global browser event listener per consumer.
- **FR-003 Install states**: The owner MUST expose the exact state contract `PwaInstallState = "installed" | "promptable" | "manual" | "unavailable" | "prompting" | "dismissed" | "error"`. Browser prompt outcome `accepted` is an ephemeral action result, not proof of installation and not a state value; only `appinstalled` or an independently detected standalone surface may produce `installed`. A consumed deferred event MUST be cleared, and dismissal/error MUST remain distinguishable without invented success.
- **FR-004 Manual install**: Where a browser cannot supply `beforeinstallprompt`, Settings MUST provide localized manual Safari installation help only when the resolved Web runtime is Safari-like and not already standalone. It MUST not show an automatic banner, claim prompt availability, or infer installation from a query flag.
- **FR-005 Stable manifest**: The public and GitHub Pages manifests MUST retain one stable `id`, start URL, scope, and icon revision. Generic `icons` MUST contain square `192x192` and `512x512` `purpose: "any"` entries plus a square `512x512` `purpose: "maskable"` entry; wide/splash packaging assets MUST NOT be declared as generic app icons, and the Apple touch icon remains generator-owned. The manifest MUST permit both portrait and landscape and may expose standard localized members only as progressive enhancement with English fallback and without a second app identity.
- **FR-006 Waiting update**: A discovered Web/PWA worker update MUST follow the exact phase contract `PwaUpdatePhase = "idle" | "waiting" | "preparing" | "blocked" | "activating" | "error"`. Neither the build registration configuration nor the worker lifecycle may activate/reload it automatically. The user may dismiss/defer a noncritical shell update without losing the current usable shell.
- **FR-007 Writer barrier**: Before any explicit update activation or stale-chunk recovery reload, the shell MUST enter `preparing`, close a multi-tab-aware writer barrier, and wait for journal, habit, mood, settings, offline-queue, and future registered writers within a bounded documented timeout. Rejection, cancellation, or timeout MUST enter `blocked`, perform zero reloads, and leave a readable recovery draft/status so the user can continue or retry. No writer payload or user content may enter diagnostics.
- **FR-008 Single-reload contract**: One accepted activation attempt MUST produce at most one document reload, and only after an approved waiting-worker activation plus controller-change confirmation. Repeated worker messages, repeated clicks, or stale-chunk callbacks cannot bypass this guard.
- **FR-009 Cache ownership**: Service-worker cache cleanup MUST delete only cache names produced by the ZenFlow ownership predicate. It MUST preserve unrelated same-origin caches and report cleanup failure without retrying destructive deletion broadly.
- **FR-010 Offline fallback**: The emergency offline page MUST provide title, description, and retry text for `en`, `uk`, `es`, `de`, `fr`, `ja`, `ar`, and `he`; set RTL direction for `ar` and `he`; preserve reduced-motion behavior; and state local/offline availability without asserting that remote sync will occur.
- **FR-011 Privacy-safe diagnostics**: Lifecycle diagnostics MUST receive only a normalized route identifier derived from pathname after base-path validation. Raw query parameters, fragments, credentials, user content, IDs, and OAuth values MUST be excluded.
- **FR-012 Trust boundary**: The page MUST accept only same-origin, script-URL-validated service-worker messages with known types. Unknown/untrusted lifecycle messages MUST not change install, update, writer, cache, or reload state.

### Key entities and state transitions

- **AppRuntimeSurface**: Exact ephemeral union `browser | installed-pwa | capacitor | tauri`; Safari-like capability is separate derived metadata, not a fifth surface and not persisted.
- **InstallSnapshot**: Holds exact `PwaInstallState`, manual-help capability, optional error class, and the opaque browser event only in memory. Prompt acceptance is an action outcome; only `appinstalled`/standalone yields `installed`.
- **UpdateSnapshot**: Holds exact `PwaUpdatePhase`, attempt ID, and failure class. `preparing` covers the writer barrier and controller-change preparation; `activating` begins only after barrier success. Reload is a guarded side effect, not a public phase.
- **DirtyWriterRegistration**: In-memory name plus a promise factory registered by a feature that must finish a durable local write before reload. It has no user data, no new IndexedDB schema, and is released after its barrier attempt.
- **PwaLifecycleDiagnostic**: A bounded diagnostic event containing transition, outcome category, and sanitized route identifier only. It cannot contain raw URL search/hash, browser prompt event, cache key list, or user record.

## Success criteria

- **SC-001**: A deferred install event delivered before a Settings consumer mounts remains available to that consumer in a focused automated test; accepted action result and the exact `promptable`, `prompting`, `dismissed`, `error`, `installed`, `manual`, and `unavailable` states are individually asserted. Firefox must receive an honest Web/offline fallback and no synthetic install-prompt promise.
- **SC-002**: In focused lifecycle tests, a clean or settling writer permits one accepted update/reload sequence, while rejected, cancelled, or timed-out writers permit zero reloads.
- **SC-003**: The service-worker cache-cleanup test proves every configured ZenFlow cache candidate is handled by the ownership predicate and an unrelated same-origin cache remains after recovery.
- **SC-004**: The manifest and offline-page contract tests cover both orientations, all eight supported locales, both RTL locales, nonempty accessible retry naming, only the required square `192/512 any` and `512 maskable` generic icons, generator-owned Apple touch icon continuity, public/docs identity parity, and negative controls for byte- and dimension-mutated icons.
- **SC-005**: Diagnostic contract tests demonstrate that representative query and fragment values never appear in the emitted lifecycle diagnostic while the normalized route identifier does.
- **SC-006**: A production-equivalent installed-PWA browser scenario, when run, shows no automatic update reload and no console error during normal update, stale-chunk recovery, offline retry, and install-path selection. This runtime proof is `UNVERIFIED` until executed.

## Assumptions and dependencies

- `src/main.tsx` remains the earliest safe Web/PWA entry point for a shell-lifetime owner; `src/pages/Index.tsx` and Settings remain consumers, not competing owners.
- Existing Dexie/IndexedDB and offline queue remain authoritative for user data. The writer barrier coordinates reload timing only and never replaces persistence or sync ordering.
- Existing public/docs manifest parity and generator-owned icon geometry remain required; implementation changes must follow the logo visual integrity protocol before altering icon assets.
- Localized product strings use existing i18n keys and all eight locales. Copy for manual Safari help is implementation work and requires translation-quality checks.
- The required actual device/manual evidence is not available in this planning task: Safari macOS/iOS Home Screen, Android, iOS native, Desktop/Tauri, public deployment, user acceptance, and artistic/craft review are `UNVERIFIED`.

## Platform and domain matrix

| Surface | Impact | Required implementation/proof boundary |
| --- | --- | --- |
| Web/Vite | Changed | Runtime resolver, no installed-only claims, browser tests, local preview and console/network proof before PASS. |
| Installed PWA | Changed; primary | Install owner, waiting update, cache ownership, offline lifecycle; installed Chrome/Edge and Safari Home Screen proof remain `UNVERIFIED` before execution. |
| Android/Capacitor | No source change | Resolver prevents Web SW behavior; owner compatibility receipt is required if shared modules change. |
| iOS/WKWebView | No source change | Resolver prevents Web SW behavior; Safari Web/PWA manual-install proof differs from native WKWebView and remains `UNVERIFIED`. |
| Desktop/Tauri | No source change | Resolver prevents Web SW behavior; desktop-width compatibility receipt is required if shared modules change. |
| Accessibility/i18n | Changed | Eight locales, `ar`/`he` RTL, visible focus, screen-reader names, 44px retry/action targets, and reduced motion are required. |
| Security/privacy | Changed | Trusted SW messaging, owned-cache predicate, and query/hash-free diagnostics require focused tests and a scoped security scan. |
| Performance | Changed | First paint precedes deferred update work; no automatic reload; route metrics and installed-PWA runtime evidence remain `UNVERIFIED` until run. |
| Store/release/operations | Not authorized | No deploy, store submission, commit, push, PR, or release. Publication/runtime receipts remain `UNVERIFIED`. |

## Rollback and kill criteria

Rollback is a normal revert of the complete shell-lifecycle change set (resolver, owner, update controller, worker behavior, manifests, offline page, tests, and evidence), restoring the prior version only after verifying the revert does not reintroduce automatic reload or broad cache deletion through a partial rollback. Do not roll back only the barrier tests or only the service-worker change.

Stop implementation and return `STOP` if an implementation cannot prove that a rejected/timed-out writer prevents reload, cache ownership cannot preserve an unrelated cache, raw query/hash can reach a diagnostic sink, a native surface starts executing Web/PWA lifecycle code, or current manifest identity would need to change. Do not replace these controls with a generic retry, a fake install state, or an unbounded cache clear.

## Evidence ledger

| Claim | Current evidence | Status |
| --- | --- | --- |
| Existing early-mount install gap | `src/hooks/usePwaInstall.ts` captures only after hook mount | VERIFIED (static source) |
| Existing automatic activation and broad cleanup | `src/sw.ts` install calls `skipWaiting()`; `CLEAR_CACHES` enumerates every cache | VERIFIED (static source) |
| Existing manifest identity and icon parity | `public/manifest.webmanifest`, `docs/manifest.webmanifest`, `scripts/__tests__/public-webmanifest-contract.test.ts` | VERIFIED (static source) |
| Existing eight-locale emergency copy | `public/offline.html`, `scripts/__tests__/offline-page-i18n.test.ts` | VERIFIED (static source) |
| Runtime update/install/offline behavior | No fresh browser/device execution in this artifact task | UNVERIFIED |
| Native compatibility | Native source/device/build receipt not run in this artifact task | UNVERIFIED |
| Public deployed behavior | No cache-busted public verification or deployment is authorized | UNVERIFIED |
| Proposed constitution review | Status gate returned `PROPOSAL_CRITERIA_ONLY` | PROPOSED_CONSTITUTION_CONSIDERATION |

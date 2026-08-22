# Research Decisions: PWA Shell Lifecycle

## Grounding examined

| Source | Observed fact | Planning consequence |
| --- | --- | --- |
| `src/hooks/usePwaInstall.ts` | Listener exists only during hook mount; prompt event is opaque React state. | Move capture to an application-lifetime owner and make the hook a consumer. |
| `src/main.tsx` | It is the earliest Web entry and already owns service-worker message and chunk-recovery wiring. | Install the shell owner before React rendering; extract lifecycle code only where it makes ownership testable. |
| `src/sw.ts` | Install immediately calls `skipWaiting`; cache clear loops over all Cache Storage keys. | Replace automatic activation with explicit trusted message; apply one owned-cache predicate. |
| `vite.config.ts` | PWA is disabled for Capacitor but enabled with Vite PWA `injectManifest` and `registerType: "autoUpdate"`. | Preserve native exclusion; change registration/update behavior so a waiting worker is surfaced rather than auto-applied. |
| `src/lib/serviceWorkerMessages.ts` | Page-side messages already validate origin, worker script origin, and known types. | Extend rather than bypass this boundary for lifecycle messages. |
| `public/offline.html` | It contains static eight-locale text and its retry control, but describes future sync as certainty and reads language through direct localStorage. | Keep the emergency static page; make its copy honest and language selection fail-safe without placing content-bearing data in storage. |
| `scripts/__tests__/public-webmanifest-contract.test.ts` | Public/docs manifests are checked for equality, stable base identity, V2 shortcuts, and icon revision. | Extend the same contract for orientation/metadata; do not replace identity or assets. |

## Decisions

### D-001: One explicit runtime-surface resolver

**Decision**: Create `src/lib/pwaShellRuntime.ts` as the only resolver of Web/Vite, installed PWA, Android/Capacitor, iOS/WKWebView, Desktop/Tauri, and Safari-like browser capabilities needed by this feature.

**Rationale**: `src/lib/appUpdateCapability.ts` already distinguishes native Android, Web reload, and unavailable. Installation, manifest, and service-worker actions need the same explicit capability boundary so native shells cannot accidentally acquire Web/PWA behavior.

**Alternatives rejected**:

- Scattered `window.matchMedia`, user-agent, and `isNative` checks: rejected because testable platform behavior would drift between install/update/recovery paths.
- A new persistent store: rejected because this is ephemeral shell capability, not user data; it would violate the no-new-schema goal.

### D-002: Retain the browser event only in memory

**Decision**: Create `src/lib/pwaInstallOwner.ts` at app start, keep the opaque deferred browser event only in memory, and expose snapshot/subscription plus explicit `promptInstall()`/manual-help action to `src/hooks/usePwaInstall.ts` and Settings.

**Rationale**: Browser install events cannot be serialized safely. The event must survive Settings' late mount but must vanish after `appinstalled`/successful acceptance or app lifetime end.

**Alternatives rejected**:

- Store the event in Zustand/IndexedDB/localStorage: rejected because event objects are non-serializable, it would falsely imply durability, and localStorage is forbidden for this new PWA content-bearing path.
- Keep `InstallBanner` as the owner: rejected because automatic banner behavior is explicitly excluded and mount timing is not application lifetime.

### D-003: User-chosen activation guarded by a writer barrier

**Decision**: Create `src/lib/pwaUpdateLifecycle.ts` with a singleton in-memory dirty-writer registry. A user action must close the registry for that attempt, await registered writers with a bounded timeout, send an explicit trusted activation message to `registration.waiting`, and reload only after one controller-change confirmation.

**Rationale**: The existing worker calls `skipWaiting()` automatically while the main entry contains both SW message and stale-chunk recovery paths. One state machine prevents one path from bypassing the other.

**Alternatives rejected**:

- Keep Vite `autoUpdate` and add an alert after reload: rejected because it cannot protect a dirty writer.
- Wait indefinitely: rejected because it can strand a user on an un-updatable shell; timeout must block reload rather than force it.
- Let the service worker inspect Dexie or sync state: rejected because SW is not the local truth/sync owner and it would widen access to user data.

### D-004: Exact cache ownership predicate

**Decision**: Add a pure `isZenflowOwnedCacheName(name)` predicate in `src/sw.ts` (or an imported SW-safe module) that matches only prefixes/names created by this service worker; apply it to cleanup and stale-chunk recovery.

**Rationale**: Cache Storage is same-origin shared. Deleting every key can remove unrelated application caches on GitHub Pages or local review origins.

**Alternatives rejected**:

- `caches.delete` every cache: rejected by FR-009.
- Match names containing `zenflow`: rejected because substring matching is not an ownership proof.

### D-005: Preserve manifest identity while making install metadata complete

**Decision**: Update the source manifest configuration and the checked public/docs manifests together, retaining `id`, `start_url`, `scope`, icon revision, square/maskable icons, and V2 shortcut URLs. Add supported orientation declaration and locale metadata derived from current language only where platform support allows, with a fixed fallback to the existing English manifest identity.

**Rationale**: Existing parity checks make the static manifests a release contract. A changed identity can cause the browser to treat the app as a different installation.

**Alternatives rejected**:

- Replace generated/static manifests independently: rejected because `public` and `docs` must be equal.
- Add translated product content to browser storage: rejected because it is unnecessary and outside the data-integrity boundary.

### D-006: Offline page is an isolated honest fallback

**Decision**: Keep `public/offline.html` self-contained, select language from safe browser signals with a guarded legacy read only when available, and revise its text to promise only local/offline access plus a retry. Preserve semantic main, focus styling, 44px minimum retry action, and reduced motion.

**Rationale**: The offline fallback may run before the React/i18n bundle. It cannot claim a future cloud outcome because every PWA client might be closed.

**Alternatives rejected**:

- Load the React app/i18n dynamically from the offline page: rejected because it is unavailable precisely during offline fallback.
- Include user data or cached sync receipt in the page: rejected by privacy and production-data integrity policy.

## Standards and applicability

- [Web App Manifest](https://www.w3.org/TR/appmanifest/) applies to stable identity, orientation, display mode, scope, and icon declarations in FR-005.
- [Service Workers](https://www.w3.org/TR/service-workers/) applies to the waiting/activation/controller lifecycle in FR-006 through FR-009.
- [WCAG 2.2](https://www.w3.org/TR/WCAG22/) applies to keyboard/focus, target size, status communication, and language/direction requirements in FR-004 and FR-010.
- `docs/ai/TELEGRAM_GRADE_RUNTIME_CONTRACT.md` applies because service worker, startup, offline, and lifecycle behavior change; it requires first paint before deferred work and evidence separated by platform.

These sources establish the intended contract, not current installed-PWA or device behavior. Those runtime claims remain `UNVERIFIED` until the tasks' browser/device evidence runs.

## Open proof boundaries

- Exact browser support for per-locale manifest variants, Safari installation help wording, iOS Home Screen update behavior, Android native compatibility, Desktop/Tauri compatibility, and public GitHub Pages behavior are `UNVERIFIED` pending implementation/runtime receipts.
- The constitution status was checked and is proposal-only; it adds no blocking finding.

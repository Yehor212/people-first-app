# Research: Installed PWA Modernization for macOS and Windows

**Date**: 2026-08-04
**Repository subject**: `13ca51a80d23220574deba762851fe5a32372e46`
**Evidence rule**: Official platform material defines applicable constraints; ZenFlow source/build/runtime evidence determines whether ZenFlow satisfies them.

## Source Registry

| Source | Applicability | Limit |
|---|---|---|
| [Microsoft Edge PWA best practices](https://learn.microsoft.com/en-gb/microsoft-edge/progressive-web-apps/how-to/best-practices) | Windows/Edge install UX, OS shortcuts, offline expectations, desktop responsiveness | Does not prove ZenFlow behavior or Windows policy state |
| [Microsoft Edge PWA debugging](https://learn.microsoft.com/en-us/microsoft-edge/devtools/progressive-web-apps/) | Manifest, worker, cache, offline inspection in Edge DevTools | DevTools inspection is not a Store or multi-device pass |
| [W3C Web Application Manifest](https://www.w3.org/TR/appmanifest/) | Normative meaning of `orientation`, `display`, `scope`, and `shortcuts` | Individual browser support remains implementation-specific |
| [Apple WWDC23: What's new in web apps](https://developer.apple.com/videos/play/wwdc2023/10120/) | macOS Add to Dock, scope, storage/cookie separation, keyboard, permissions, push/badging | Presentation predates later Safari additions; use current WebKit notes for deltas |
| [Apple Support: Use Safari web apps on Mac](https://support.apple.com/en-la/104996) | Add to Dock requires macOS Sonoma 14 or later; current user-owned File/Share path | Support instructions do not prove ZenFlow installed runtime behavior |
| [WebKit Safari 17.2](https://webkit.org/blog/14787/webkit-features-in-safari-17-2/) | macOS storage separation and opaque full-bleed 1024px/SVG maskable icon guidance | Does not constitute artistic or real-device acceptance |
| [WebKit Safari 17.4](https://webkit.org/blog/15063/webkit-features-in-safari-17-4/) | macOS manifest shortcuts in File and Dock menus | Older Safari versions may not expose them |
| [WebKit Safari 18.0](https://webkit.org/blog/15865/webkit-features-in-safari-18-0/) | Current Add to Dock user path and standalone app behavior | Does not expose a Chromium-style programmatic install event |
| [web.dev: Customize the install experience](https://web.dev/articles/customize-install) | Chromium `beforeinstallprompt`, one-shot `userChoice`, and install-promotion lifecycle | Prompt acceptance does not prove a real OS-shell run on this host |
| [web.dev: Detect installed PWAs](https://web.dev/learn/pwa/detection) | `appinstalled` and standalone display-mode detection | Browser/OS support differs; real installed platforms remain separate evidence |
| [web.dev service worker lifecycle](https://web.dev/articles/service-worker-lifecycle?hl=en) | `skipWaiting`, `clients.claim`, mixed worker generations, origin-wide cache risk | General lifecycle guidance; ZenFlow still needs local race/data checks |

## Local Findings and Decisions

### R-001 — Installed PWA is a distinct product surface

**Observation**: Repository policy lists Web/PWA and Desktop/Tauri as different release targets. Existing entry documentation explicitly excludes real installed PWA launch, and its last recorded proof predates this feature. Existing Playwright scenarios set a standalone media query or `navigator.standalone` rather than installing an OS app.

**Decision**: Treat Safari/Edge installed PWA as the primary surface. Use Tauri only as a no-regression boundary. Simulated standalone tests remain useful contract evidence but cannot close real Add to Dock or Windows shell rows.

**Rejected alternative**: Rebrand Tauri as the desktop PWA. This would hide two different storage, update, distribution, and permission models.

### R-002 — Remove manifest declarations that contradict a desktop window

**Observation**: `vite.config.ts:220-221`, `public/manifest.webmanifest`, `docs/manifest.webmanifest`, and `scripts/generate-icons.cjs` declare `portrait-primary`. W3C defines orientation as the default orientation for the web application's top-level contexts when supported. Both OS shortcuts append `navLayout=phone` in `vite.config.ts:330-344` and generated manifests. `NavV2Orchestrator.shouldForceWebNavigation()` honors layout/debug forcing only in development; current production layout derives from the device tier. The query parameter is therefore stale production contract surface, not proof of a currently forced production phone shell.

**Decision**: Omit the orientation member and remove the stale development-only layout parameter from Mood/Habit shortcut URLs. Preserve `nav=v2` for backward-compatible explicit V2 entry. Verify narrow and wide windows without claiming the removed parameter previously controlled production layout.

**Rejected alternatives**:

- Set `orientation: any`: valid but redundant; omission leaves platform ownership explicit and avoids implying an orientation preference.
- Replace `phone` with `desktop`: breaks narrow windows and mobile installed PWAs.
- Remove shortcuts: discards useful macOS/Windows OS integration rather than fixing it.

### R-003 — Safari Add to Dock has a real local-state boundary

**Observation**: Apple states that cookies can be copied at creation but local storage is not; after installation, web-app and browser storage remain separate. ZenFlow explicitly persists the Supabase session in `window.localStorage` (`src/lib/supabaseClient.ts:93-103,126-149`) and uses IndexedDB as local product truth. The current hook only exposes Chromium's `beforeinstallprompt`; Settings renders no safe manual Safari path (`src/hooks/usePwaInstall.ts:13-58`, `src/pages/nav-v2/settings/V2SettingsAboutPanel.tsx:135-143`).

**Decision**: Add a pure, testable install-capability classification. Recognize standards display mode plus Safari standalone, consume Chromium events once, and surface macOS Safari guidance that warns about separate saved information and possible re-authentication before documenting both Apple-supported paths: File > Add to Dock and Share > Add to Dock. Apple documents this capability as requiring macOS Sonoma 14 or later; because Safari does not expose a reliable Add-to-Dock feature probe, the copy names that requirement and keeps the instruction conditional when neither command appears. A signed-in session does not prove online backup is enabled, current, or available, so the guidance requires a manual ZenFlow backup even for account users, preserves its device-only limitations, and tells the user to retain Safari state until the installed app is checked. ZenFlow's account-realm guard permits file import only before an account is connected, so the copy distinguishes online restore from manual recovery and states that the manual file must be imported first.

**Reachability limit**: Safari's File > Add to Dock command is OS/browser-owned and can be invoked without visiting Settings. This batch improves the existing user-initiated Settings help path; it does not claim every direct-menu install is warned first. A global interruption was rejected without user evidence because it would pressure every Safari session to act on a rare operation.

**Rejected alternatives**:

- Automatically copy localStorage/IndexedDB into the new Safari web app: browsers do not expose that bridge, and inventing one would cross auth/privacy/data-migration authority.
- Tell every Mac browser to use Safari's File menu: incorrect for Chrome/Edge and older Safari.
- Mount the legacy global `InstallBanner`: it is currently unreachable, Chromium-only, and interruption-heavy; Settings is the existing user-initiated install surface.

### R-004 — Deferred install prompts must be one-shot

**Observation**: `usePwaInstall` clears the deferred event only after acceptance. Dismissal or a thrown `prompt()` leaves `canInstall` true, even though the event is consumed and may not be called again.

**Decision**: Start one browser-only page-lifetime capture during `main.tsx` bootstrap so a prompt emitted before the lazy Settings footer is retained. Capacitor and Tauri runtimes are excluded. Clear the event before invoking it, validate its shape before storing it, keep installed terminal if a late prompt appears, and let a later browser event restore capability only while not installed. An accepted `userChoice` confirms the one-shot promotion was accepted but does not set ZenFlow's installed-success UI; `appinstalled` or a later standalone-runtime check owns that terminal state. Test early capture, acceptance, dismissal, failure, malformed event, installed media query, Safari standalone, late-prompt ordering, and Tauri exclusion.

**Rejected alternative**: Retry the same event. The browser owns prompting and the stored event is not a reusable application command.

### R-005 — Offline fallback is present but currently untrustworthy

**Observation**: `public/offline.html:74-94` indexes translations with the raw `localStorage` value, while ZenFlow stores JSON-serialized primitives; a stored `"ar"` therefore misses and falls back to English while setting an invalid language token. Lines 70 and 78-85 claim all data is saved locally and will sync, which is broader than ZenFlow's actual per-capability storage/sync contracts. `src/sw.ts:314-331` returns `Response.error()` if the precached app shell is unavailable even though `offline.html` is included in the PWA assets.

**Decision**: Parse the stored locale defensively, constrain it to eight supported locales, treat syntactically invalid or valid-JSON non-string stored values as English fallback, use a supported browser locale only when the preference is absent, localize title/direction, replace the universal data promise with a precise degraded-state message, and use the precached offline document only after the app-shell fallback fails. Narrow the changed PWA manifest description from universal "Works offline" wording to previously opened areas with an explicit internet-dependent-feature caveat.

**Release residual**: `docs/STORE_LISTING.md` and the inherited public privacy copy still make broader offline claims. Changing store/legal promises requires human ownership under the audit authority gates, so these statements remain an attributed release blocker rather than being silently edited or validated by the local fallback tests.

**Rejected alternatives**:

- Keep the optimistic message because the app is local-first: local-first does not prove every remote-only or unsupported action is persisted and syncable.
- Always serve `offline.html`: this would unnecessarily discard the richer working app shell and local-first features.

### R-006 — Remove an origin-wide, unreachable cache-deletion capability

**Observation**: `src/sw.ts:26,352-374` accepts `CLEAR_CACHES` and deletes every Cache Storage entry on the GitHub Pages origin. The tracked app has no sender for `CLEAR_CACHES` or `SKIP_WAITING`; the worker already calls `skipWaiting()` during install. The offline queue registers Background Sync directly and does not send `REGISTER_SYNC`. Separately, the live persistent-chunk-error path in `src/lib/lazyWithRetry.ts` enumerates and deletes every origin cache before reload. web.dev specifically warns shared-origin apps to delete only app-prefixed caches.

**Decision**: Remove the three unused message types and handlers and remove the live chunk-recovery origin purge. Retain only the used runtime-audio warm command, rename literal runtime caches under the `zenflow-` namespace, and make cache-busted reload preserve Cache Storage under service-worker ownership. Retain Background Sync registration in the existing foreground client and the worker's `sync` event, but describe that event accurately: it can notify already-open clients and performs no queue work when none are open. This removes behavior rather than weakening the trusted-origin check.

**Residual**: Existing installs can retain the old generic runtime caches. Cache Storage is origin-wide and the GitHub Pages origin can host multiple project paths, so ownership of every legacy entry is not proven. Automatic deletion is rejected; bounded quota cleanup remains `UNVERIFIED` rather than using an origin-wide purge.

**Rejected alternatives**:

- Keep `CLEAR_CACHES` and filter cache names: no current caller needs it, so even a bounded destructive message is unnecessary attack/recovery surface.
- Clear caches during every update: risks other clients and is incompatible with offline recovery.

### R-007 — macOS needs a high-resolution maskable icon

**Observation**: The manifest supplies an opaque maskable 512x512 icon. WebKit recommends an opaque full-bleed maskable SVG or 1024x1024 bitmap so macOS can render sharp icons across Finder, Dock, Launchpad, and Spotlight. ZenFlow's generator is the canonical logo source and can emit the same frozen leaf at 1024px.

**Decision**: Extend the existing generator/check/manifest contract with `pwa-maskable-1024.png`, retain the frozen `LEAF_BODY` and `LEAF_STEM`, bump the install-icon revision only if the generator contract requires cache invalidation, and inspect the generated proof sheet. Technical proof and artistic/craft judgment remain separate.

**Rejected alternatives**:

- Upscale the 512px raster: preserves pixels, not high-resolution source detail.
- Hand-edit or AI-generate a replacement icon: violates the canonical generator and rebrand authority.
- Add screenshots in this batch: useful for richer install presentation, but it requires a separately maintained visual/copy asset set and real Windows install-dialog validation; keep `UNVERIFIED` rather than adding stale imagery.

### R-008 — Update policy stays conservative

**Observation**: ZenFlow already performs no-store version checks, filters reload query parameters, drops fragments, and dispatches `zenflow:before-app-reload` so durable writers can extend reload preparation. The worker uses immediate activation, then clients version-check and reload.

**Decision**: Preserve the worker activation model and durable-preparation contract without clearing caches. Automatic SW, resume, startup, and post-startup version checks now use one caught reload helper: preparation failure or the reload-loop guard leaves the current app rendered and queues the existing retry dialog even if the React dialog has not mounted yet. Browser automatic-update ownership is disabled in Tauri, which retains its own updater. A two-client old-worker/new-worker runtime transition was not added to this bounded batch and remains `UNVERIFIED`; a later change to waiting/user-confirmed activation requires its own state/migration analysis.

**Rejected alternative**: Replace auto-update with a generic prompt now. That changes interruption/staleness behavior across all platforms without evidence that it resolves the reported desktop defects.

## Unknowns That Remain Explicit

- Real Windows Edge install dialog, Start/taskbar shortcut rendering, enterprise policy, uninstall, update, and OS notification behavior.
- Real Android/iOS browser-installed PWA rotation, safe-area, and home-screen launch after the shared orientation member is removed.
- Public GitHub Pages manifest/service-worker cache refresh after deployment.
- macOS Add to Dock state transfer with ZenFlow's actual production auth configuration and an authorized test account.
- Human screen-reader, switch/voice input, native-speaker, and artistic acceptance.
- Whether localized OS manifest metadata warrants eight separately served manifests; current static hosting/browser cache behavior needs a separate scoped decision.
- Whether Microsoft Store packaging is desired; no submission or package update is authorized.
- Ownership-safe retirement of legacy generic runtime cache names and their actual quota impact on existing installs.

## Research Verdict

`GO` for the bounded local implementation described above. `STOP` for auth/data migration, public deployment, Store packaging, or claims of real Windows completion. No cited source is treated as local runtime proof.

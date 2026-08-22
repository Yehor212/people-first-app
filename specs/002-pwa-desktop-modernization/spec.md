# Feature Specification: Installed PWA Modernization for macOS and Windows

**Spec Kit Feature ID**: `002-pwa-desktop-modernization`  
**Git Delivery Branch**: `codex/pwa-desktop-modernization`  
**Created**: 2026-08-04  
**Status**: Clarified  
**Input**: Modernize ZenFlow's installed browser PWA on macOS and Windows, remove proven obsolete behavior and old defects, cover platform-specific nuances, and execute the work through the full repository Spec Kit workflow.

## Scope and Evidence Boundary

This feature starts from clean repository commit `13ca51a80d23220574deba762851fe5a32372e46` in an isolated locked Codex worktree. Its primary product is the installed browser PWA: Safari web apps added to the Dock on macOS and Chromium/Edge-installed apps on Windows. Ordinary Web/Vite behavior is part of the same delivery surface. Because the manifest is shared, mobile browser-installed PWA behavior is an explicit regression boundary distinct from Android/Capacitor and iOS/WKWebView. Desktop/Tauri is also a regression boundary, not an alternative name for the PWA.

The current execution host is macOS. Source, build, automated Chromium/WebKit, and local macOS evidence can be produced here. A real Windows installed-app run, Windows shell integration, public GitHub Pages provenance, Microsoft Store packaging, and human/native-speaker acceptance remain `UNVERIFIED` until those environments or approvals are actually available. No old report, simulated display mode, or another agent's summary can upgrade those rows to `PASS`.

This feature authorizes local, reversible repository changes and private test artifacts. It does not authorize push, deployment, Store submission, signing, production-data access, production writes, auth-storage migration, IndexedDB/schema migration, or deletion of user data.

## User Scenarios and Testing

### User Story 1 - Install without losing context or local work (Priority: P1)

As a ZenFlow user on macOS or Windows, I need the app to explain and perform the install path that my browser actually supports, while warning me when the installed container will not inherit browser-local state.

**Why this priority**: Safari's macOS web app has a separate post-install storage container, while ZenFlow persists session and local product state in browser storage. Treating the Chromium install prompt as universal can hide the install path or create a perceived data-loss incident.

**Independent Test**: Exercise Chromium's deferred install event, macOS Safari detection, already-installed detection, accepted/dismissed/error paths, and the rendered safe-install guidance without using production accounts or user records.

**Acceptance Scenarios**:

1. **Given** an installable Chromium/Edge browser window, **when** the browser supplies an install prompt and the user accepts it, **then** ZenFlow invokes and consumes that one prompt but records installation success only after `appinstalled` or a subsequent standalone-runtime check.
2. **Given** the user dismisses or the browser rejects the prompt, **when** the install action settles, **then** ZenFlow does not keep offering an already-consumed prompt and does not claim installation succeeded.
3. **Given** an installed Safari or Chromium PWA, **when** Settings renders, **then** ZenFlow recognizes standalone mode and does not offer a second installation.
4. **Given** Safari on macOS outside installed mode, **when** the user opens install help, **then** ZenFlow explains the supported Add to Dock path and the separate-local-storage consequence before directing the user to install.
5. **Given** an unsupported or unidentified browser, **when** no programmatic install event exists, **then** ZenFlow does not fabricate an install action or success state.
6. **Given** Chromium emits its single-use install event before the lazy Settings footer mounts, **when** the user later opens Settings, **then** the still-valid event remains available exactly once.

---

### User Story 2 - Launch into a real desktop layout (Priority: P1)

As an installed PWA user, I need normal launch and operating-system shortcuts to open the requested ZenFlow task without carrying a stale development-only layout parameter or locking the app to portrait behavior.

**Why this priority**: The current manifest declares `portrait-primary`, while both OS shortcuts append `navLayout=phone`. Current production code ignores that layout parameter outside development, so it is misleading stale contract surface rather than proof that production currently forces a phone shell.

**Independent Test**: Inspect the built manifest and launch each shortcut in a production build at narrow and wide desktop sizes, verifying the route, adaptive shell, focusable navigation, and absence of the stale layout parameter.

**Acceptance Scenarios**:

1. **Given** a resizable installed desktop window, **when** it launches or changes aspect ratio, **then** no manifest rule requests a portrait-only orientation.
2. **Given** the Mood or Habit operating-system shortcut, **when** it opens in a desktop-sized window, **then** the target route is correct, the stale development layout parameter is absent, and current device-tier logic selects the layout from the actual viewport.
3. **Given** the same shortcut on a narrow PWA window, **when** it opens, **then** ZenFlow still selects its compact layout through existing responsive logic.
4. **Given** a shortcut URL or external deep link, **when** authentication or startup gates intervene, **then** the intended in-scope route survives without exposing secret query or fragment values.
5. **Given** the shared manifest is used by a mobile browser PWA, **when** the viewport rotates between portrait and landscape, **then** no manifest orientation lock prevents the existing responsive shell from adapting.

---

### User Story 3 - Recover offline and update without false promises (Priority: P1)

As an installed PWA user, I need visited core routes to reopen during a network interruption, an honest degraded state when the shell is unavailable, and an update path that waits for durable writes before reloading.

**Why this priority**: Installed apps are expected to launch in unreliable networks. The existing standalone offline document both misreads ZenFlow's JSON-serialized locale preference and overclaims that all data will sync.

**Independent Test**: Build and serve the production PWA over the repository HTTPS preview, establish service-worker control, reload visited routes offline, exercise the standalone fallback in all eight locales including RTL, and run update/reload tests against pending durable writes.

**Acceptance Scenarios**:

1. **Given** a previously visited core route and active service worker, **when** the network becomes unavailable, **then** the app shell and locally supported task state remain reachable without an uncaught page error.
2. **Given** the app shell cannot be recovered, **when** the standalone offline document is shown, **then** it uses the stored locale when valid, sets language/direction/title consistently, offers retry, and does not promise that every datum is local or syncable.
3. **Given** a new worker becomes active while a durable write is pending, **when** ZenFlow determines a reload is required, **then** reload preparation is awaited or a bounded, visible failure is recorded; the update path does not clear unrelated origin caches.
4. **Given** a browser without Background Sync, **when** connectivity returns while ZenFlow is open or resumes later, **then** the existing foreground recovery path remains the supported fallback and unsupported background execution is not claimed.

---

### User Story 4 - Use the installed app as a desktop application (Priority: P2)

As a keyboard, pointer, screen-reader, zoom, RTL, reduced-motion, or Windows High Contrast user, I need the installed PWA to remain operable across normal desktop window states.

**Why this priority**: A desktop PWA can be freely resized and operated without touch. A single 1280-pixel screenshot with a mocked standalone flag does not prove those behaviors.

**Independent Test**: Run the same primary task at representative narrow, medium, and wide desktop windows with keyboard-only input, 200% text/reflow pressure, light/dark/system themes, reduced motion, forced colors where the engine supports it, and Arabic/Hebrew direction.

**Acceptance Scenarios**:

1. **Given** a window resized across ZenFlow's existing layout breakpoints, **when** navigation changes form, **then** the active task and focus path remain available and the document does not develop horizontal overflow.
2. **Given** keyboard-only input, **when** the user navigates, opens an overlay, dismisses it, and saves a supported local action, **then** focus remains visible and returns to a logical control.
3. **Given** reduced motion, high contrast, or RTL, **when** install, offline, update, and primary-shell UI appears, **then** meaning and controls remain perceivable without motion-only or directionally incorrect cues.

---

### User Story 5 - Release with evidence and rollback (Priority: P2)

As the product owner, I need PWA fixes separated into reviewable decisions, with current evidence, platform limits, monitoring criteria, and rollback instructions.

**Why this priority**: A local build cannot prove Windows integration, public deployment, or safe rollout; those claims need explicit release gates rather than optimistic completion language.

**Independent Test**: Validate the Spec Kit packet, run focused and broad repository gates, inspect the final diff and artifacts, execute the local rollback drill for changed runtime contracts, and ensure unavailable platform evidence remains `UNVERIFIED`.

**Acceptance Scenarios**:

1. **Given** a proposed PWA change, **when** its batch is reviewed, **then** it contains one user-facing decision, one regression proof, and one rollback path.
2. **Given** unavailable Windows, public, Store, or signed runtime evidence, **when** the final matrix is generated, **then** the corresponding row is `UNVERIFIED`, never `PASS` by inference.
3. **Given** any failing P0/P1 regression, data-integrity check, or hard security finding caused by the feature, **when** convergence is evaluated, **then** release status is `STOP` until fixed or rolled back.

## Edge Cases

- Safari on macOS can add a site to the Dock without `beforeinstallprompt`; its web app does not share localStorage or IndexedDB with the existing Safari tab after installation.
- Safari's File > Add to Dock command can be used from any page and bypass the Settings-only guidance; that direct path remains an explicit product/research gap rather than a universally mitigated flow.
- Safari may be older than the macOS Add to Dock capability. Guidance must be conditional and must not claim that an unavailable menu item exists.
- Chromium fires a deferred install event once; accepted, dismissed, or failed prompts cannot remain reusable UI state.
- An accepted install choice consumes the promotion but is not itself rendered as ZenFlow's installed-success state; `appinstalled` or standalone runtime is the terminal signal.
- A user can rename a macOS web app or install multiple instances. ZenFlow must not use the visible installed name as an account or storage identity.
- A narrow desktop window can legitimately use the compact shell; removing the production-inert development parameter must not force desktop layout everywhere.
- Multiple open PWA/browser clients can temporarily run different service-worker generations. Cache and update behavior must avoid cross-origin or cross-project deletion and must preserve durable writes.
- GitHub Pages shares an origin across project paths. Cache cleanup may touch only ZenFlow-owned names and scope.
- Legacy generic runtime cache names can remain after the namespace change; their ownership is ambiguous on a shared origin, so this feature must not delete them automatically and must retain their quota impact as `UNVERIFIED` until a bounded ownership proof exists.
- A Background Sync event with no open ZenFlow client cannot run the current application queue handlers; queued actions remain durable and retry when an eligible client returns.
- The network may return HTML for a missing JSON/version URL. Version checks must remain unavailable/error rather than accepting it as current.
- Storage quota, private browsing, permission denial, system Focus/notification settings, clock changes, sleep/resume, and service-worker eviction must degrade honestly.
- Manifest shortcuts and install metadata can remain cached by the OS after a source change; public behavior is not fixed until a deployed cache-busted manifest is verified.
- Manifest-localized members have browser-specific delivery and caching constraints. English-only OS metadata is not silently claimed as eight-locale parity.
- Windows enterprise policies can disable installation or service workers. ZenFlow must expose browser/OS ownership rather than overriding policy.

## Requirements

### Explicit Requirements

- **ER-001**: The installed browser PWA on macOS and Windows MUST be audited and modernized through the repository's full Spec Kit workflow.
- **ER-002**: Proven obsolete, useless, or defective PWA behavior MUST be removed or corrected without fabricated data or evidence.
- **ER-003**: Platform-specific macOS and Windows install, launch, offline, update, desktop-input, accessibility, and release nuances MUST be accounted for.

### Implied Requirements

- **IR-001**: Work MUST use a clean isolated `codex/` worktree and preserve unrelated user work.
- **IR-002**: The primary target MUST remain the installed browser PWA on macOS/Windows; mobile browser PWA, Tauri, Android/Capacitor, and iOS/WKWebView MUST be explicit and distinct regression boundaries.
- **IR-003**: Manifest `id`, scope, start URL, icons, shortcuts, display, orientation, language, and public/docs/build parity MUST be validated as user-visible OS contracts.
- **IR-004**: Install guidance MUST distinguish Chromium's programmatic prompt from Safari's user-owned Add to Dock flow and disclose Safari's separate browser storage before install.
- **IR-005**: The app MUST NOT claim that every local action syncs, that background sync is universally supported, or that an install/update succeeded without direct evidence.
- **IR-006**: Service-worker updates MUST preserve durable state, avoid unrelated cache deletion, and retain a bounded offline fallback.
- **IR-007**: Desktop resizing, pointer/keyboard use, reflow, RTL, reduced motion, safe areas, forced colors, and focus recovery MUST be verified where applicable.
- **IR-008**: No production business data, account tokens, journal entries, device identifiers, or contact data may enter tests, screenshots, or tracked artifacts.
- **IR-009**: Existing IndexedDB local truth, hydration ordering, sync contracts, canonical orb visuals, auth flows, and route ownership MUST remain unchanged unless a separately approved task proves a required change.
- **IR-010**: Web/Vite, installed desktop PWA, installed mobile browser PWA, Android/Capacitor, iOS/WKWebView, Desktop/Tauri, Store/Release, Accessibility, Performance, Security/Privacy, Testing, and Operations impacts MUST each receive `PASS`, `FAIL`, `N/A`, or `UNVERIFIED` evidence.
- **IR-011**: Local automation MUST include RED then GREEN proof, production build output, browser runtime, manifest/service-worker contracts, production-data-integrity checks, security scan, and final diff/status review.
- **IR-012**: Public deploy, Store packaging, signing, push, and production writes MUST remain blocked until separately authorized.

### Functional Requirements

- **FR-001**: ZenFlow MUST identify already-installed mode through standards-supported desktop and Safari signals before offering installation.
- **FR-002**: ZenFlow MUST consume a programmatic install prompt at most once and MUST clear it after acceptance, dismissal, or failure.
- **FR-003**: ZenFlow MUST provide platform-appropriate, non-deceptive install guidance when no programmatic prompt is available and the platform has a known manual path.
- **FR-004**: macOS Safari install guidance MUST warn that information and the signed-in session do not automatically transfer to the new web-app container, may require sign-in again, and MUST tell the user to preserve Safari state, save a manual ZenFlow backup even when using an account, and verify the installed state without claiming online backup is current or that the manual backup covers every device-only setting.
- **FR-005**: The installed PWA manifest MUST allow the host window to use its current orientation on desktop and mobile browsers and MUST NOT publish the stale development-only `navLayout` parameter in OS shortcuts.
- **FR-006**: Manifest shortcut URLs MUST remain in scope, open the intended V2 task, and contain no secret, account, or test parameters.
- **FR-007**: The generated build manifest and tracked public/docs manifests MUST express the same install identity and shortcut behavior.
- **FR-008**: The offline fallback MUST parse ZenFlow's stored locale representation safely, support all eight declared locales, set RTL for Arabic/Hebrew, localize the document title, use English for malformed or non-string stored values, and use a supported browser locale (or English) when no stored value exists.
- **FR-009**: Offline copy MUST distinguish locally available behavior from network-dependent behavior and MUST NOT promise universal synchronization.
- **FR-010**: Navigation fallback MUST return the versioned app shell when available and a bounded offline document when the shell is unavailable, rather than an unexplained network error.
- **FR-011**: Service-worker cache operations and new runtime cache names MUST be restricted to the ZenFlow namespace; unused message capabilities that can delete origin-wide caches MUST not remain reachable.
- **FR-012**: Update-triggered reload MUST await existing durable-write preparation and preserve current safe route parameters while dropping auth tokens and fragments.
- **FR-013**: The PWA MUST retain existing foreground online/visibility/resume recovery when Background Sync is absent, and MUST describe the current sync event only as a wake hint for already-open clients rather than closed-browser queue processing.
- **FR-014**: Install/offline/update controls MUST meet existing 44px, visible-focus, keyboard, reflow, reduced-motion, theme-token, and RTL contracts.
- **FR-015**: The production PWA build MUST exclude service-worker registration, manifest behavior, and desktop PWA-only install assets from Capacitor bundles; Tauri runtime MUST expose no browser-PWA install action or guidance and MUST retain its own update ownership.
- **FR-016**: Browser install-event capture MUST start during non-native page bootstrap, before lazy install UI mounts, and MUST remain memory-only.

### Key Entities

- **Install Capability**: Current runtime state: installed, programmatic prompt available, safe manual macOS path, or unavailable/unknown. It contains no account or product data.
- **Manifest Identity**: Stable install ID, start URL, scope, display metadata, icons, and OS shortcuts shared by source, generated build, and public artifact.
- **Offline Recovery State**: Shell available, standalone offline document available, or unrecoverable. It is runtime evidence, not a claim that all feature data is writable.
- **Update Generation**: Client build, server build, worker generation, and reload-preparation result used to decide whether the active client should reload.
- **Platform Evidence Row**: Subject, environment, engine/OS version, scenario, artifact hash, result, and limitation. It contains no user data.

## Platform and Quality Matrix

| Surface | Required evidence | Current specification state |
|---|---|---|
| Web/Vite | Build, manifest parity, install fallback, responsive browser smoke | Planned |
| Installed PWA | Real or production-equivalent install/update/offline/shortcut lifecycle | macOS local planned; Windows real runtime `UNVERIFIED` |
| Mobile browser PWA | Shared manifest orientation, portrait/landscape resize, overflow, safe-area boundary | Production-equivalent resize planned; real installed launch/safe-area `UNVERIFIED` |
| Android/Capacitor | PWA disabled, manifest/registerSW absent, focused regression | Planned regression boundary |
| iOS/WKWebView | Native shell unchanged; Safari-related shared code regression | Planned regression boundary; real device `UNVERIFIED` |
| Desktop/Tauri | PWA changes do not claim or replace Tauri updater/shell | Planned regression boundary |
| Store/Release | Manifest/package implications and rollout/rollback documented | No submission authorized; acceptance `UNVERIFIED` |
| Accessibility | Keyboard, focus, reflow, RTL, reduced motion, forced colors | Planned; human assistive-tech acceptance `UNVERIFIED` |
| Performance | Install/precache size, startup, offline response, resize stability | Planned local budgets; device fleet `UNVERIFIED` |
| Security and Privacy | Scope/cache boundaries, safe URLs, no secrets/PII, scanner | Planned |
| Testing | RED/GREEN, unit/contract/E2E/build, negative controls | Planned |
| Operations | Cache/update rollback, deploy provenance, monitoring criteria | Local drill planned; public monitoring `UNVERIFIED` |

## Success Criteria

- **SC-001**: The full `specify → clarify → plan → checklist → tasks → analyze → implement → converge` artifact chain is present, internally consistent, and contains no unresolved critical clarification.
- **SC-002**: All tracked and built manifests omit a portrait-only requirement and every OS shortcut reaches its intended V2 route without the stale `navLayout=phone` parameter.
- **SC-003**: Programmatic install tests prove early page-lifetime capture plus one-shot handling for acceptance, dismissal, malformed events, and thrown prompts; installed-mode tests cover display-mode, Safari's standalone signal, late-prompt rejection after installation, and Tauri exclusion.
- **SC-004**: The macOS Safari guidance is rendered only in the applicable non-installed context, discloses separate saved information and possible re-authentication without universal transfer claims, is keyboard/reflow/RTL safe, and has translation parity across `en`, `uk`, `es`, `de`, `fr`, `ja`, `ar`, and `he`.
- **SC-005**: Production-service-worker tests prove a visited core route boots offline and the standalone fallback correctly handles supported JSON-serialized locales, syntactically invalid and valid-JSON non-string storage, absent-storage browser locale, Arabic/Hebrew direction, retry, and honest degraded copy.
- **SC-006**: No service-worker message can delete caches outside ZenFlow's owned prefix, all newly used literal runtime cache names are ZenFlow-prefixed, and no new worker reload bypasses the existing durable-write preparation contract.
- **SC-007**: Targeted desktop PWA checks at narrow, medium, and wide states plus production-equivalent mobile portrait/landscape checks report no unexpected horizontal overflow, uncaught page errors, failed in-scope navigation, or keyboard-inaccessible install/update/offline action.
- **SC-008**: Applicable type, test, i18n, visual, production-data-integrity, security, build, bundle, PWA, and governance commands finish with fresh recorded results. Any candidate-caused or unattributed P0/P1/applicable failure blocks local convergence; an independently attributed inherited failure remains `FAIL` and blocks merge/release without being relabeled as a candidate failure.
- **SC-009**: Final platform rows use exactly `PASS`, `FAIL`, `N/A`, or `UNVERIFIED`; Windows and mobile installed runtime, public deployment, Store, signing, real-device, human accessibility, artistic, and native-speaker claims are not inferred.
- **SC-010**: The final diff contains no mock/demo/sample production records, secrets, user data, placeholder copy, weakened gate, unrelated refactor, or unowned generated artifact.

## Clarifications and Decisions

### Session 2026-08-04

- **Decision**: “PWA for Mac and Windows” means the browser-installed PWA. Desktop/Tauri remains separate and is checked only for regression unless the user creates a Tauri-specific goal.
- **Decision**: Preserve the current ZenFlow product model, routes, canonical orb, IndexedDB local truth, auth provider behavior, and sync semantics. This task fixes PWA delivery and platform behavior; it does not redesign the product shell.
- **Decision**: Use progressive enhancement. Chromium's install event may enable a direct button; Safari gets truthful manual guidance; unknown browsers get no fabricated action.
- **Decision**: Do not migrate Supabase auth or IndexedDB to bridge Safari's separate web-app container inside this feature. That would cross auth/privacy/data-migration authority. Mitigate the risk with explicit pre-install guidance and preserve a separately reviewable blocker.
- **Decision**: Remove the stale, production-inert `navLayout=phone` parameter from OS shortcuts and preserve existing responsive device-tier shell selection; do not replace it with a forced desktop layout.
- **Decision**: Removing the global orientation lock requires a mobile browser PWA regression boundary; it does not authorize Android/iOS native-shell changes or prove a real installed mobile launch.
- **Decision**: The proposed Spec Kit constitution is advisory because its status is `PROPOSAL_CRITERIA_ONLY`; active `AGENTS.md` and repository policies supply all blocking gates.
- **Decision**: No push, deployment, GitHub Pages mutation, Windows Store action, or signed artifact is part of local implementation.

## Assumptions

- Current stable Microsoft Edge/Chromium and Safari versions implement the platform capabilities cited in `research.md`; unsupported versions must degrade to ordinary browser use.
- Existing export/import and authenticated sync remain user-owned safety paths before a separate Safari web-app container is created, but neither is treated as a universal transfer or as completed automatically; the user-facing warning requires verification in the new app before Safari data is removed.
- Existing test fixtures remain isolated and synthetic. They are not production records and will not enter production bundles.
- Public GitHub Pages can continue serving the app under `/people-first-app/`; any public-runtime claim requires cache-busted post-deploy verification bound to the deployed commit.

## Non-Goals

- Replacing the installed PWA with Tauri, Electron, or a new native wrapper.
- Migrating auth tokens, IndexedDB schemas, sync ownership, or user data between Safari containers.
- Adding analytics, ads, push campaigns, badges, file/protocol handlers, widgets, or Store packaging without an independently evidenced user job and separate approval.
- Redesigning ZenFlow navigation, brand, canonical orb, or daily product capabilities.
- Claiming Windows, public, Store, legal, human accessibility, or native-speaker acceptance from local macOS automation.

## Kill and Rollback Criteria

Stop or roll back the affected batch if it causes a new data-loss path, cache deletion outside ZenFlow, unrecoverable update loop, auth callback regression, unavailable core route offline after prior use, manifest identity change, Android/iOS/Tauri ownership regression, P0/P1 accessibility failure, or security scanner HIGH finding in changed first-party code. Rollback restores the prior manifest/install/offline/service-worker contract, regenerates canonical artifacts where applicable, and reruns the same focused proof; it never deletes user data or clears origin-wide storage.

# Implementation Plan: PWA Shell Lifecycle

## Technical context

| Area | Decision |
| --- | --- |
| Existing stack | React 18, TypeScript, Vite, Workbox injectManifest, Capacitor 8, Tauri; no dependency addition. |
| Runtime owner | `src/main.tsx` initializes one Web/PWA shell owner before React mount; `AppRuntimeSurface`, `PwaInstallState`, and `PwaUpdatePhase` use the exact approved unions; Settings receives consumer state through existing patterns. |
| Service worker | `src/sw.ts` stays the service-worker owner. It receives only trusted explicit client messages; no install-time `skipWaiting`, no broad cache cleanup. |
| Local data | No new persistence. Dexie/IndexedDB remains local truth; dirty-writer registry is in-memory reload coordination only. |
| UI | Existing Settings/Overlay ownership and i18n patterns; no automatic install banner. |
| Diagnostics | Existing logging/observability boundary receives fixed outcome enum plus sanitized pathname only. |
| Native | Runtime resolver prevents Web/PWA lifecycle actions for Capacitor and Tauri. Native files are out of scope. |

## Preconditions and boundaries

- The user's 2026-08-09 implementation instruction authorizes this scoped local source/test work after RED evidence. It does not authorize dependency installation, production/private writes, deploy, commit, push, PR, merge, handoff, or issue creation; `speckit-taskstoissues` remains explicitly prohibited.
- The workspace edit doctor command was unavailable in this worktree (`npm run doctor` missing; `scripts/agent-workspace.ts` absent). Worktree-lock proof is therefore `UNVERIFIED`; the parent-owned lane is the controlling scope boundary.
- Constitution status was checked: `PROPOSED_CONSTITUTION_CONSIDERATION`, not a binding gate.
- Before production edits, create a fresh `.preflight-token` with the test-first and skill-routing fields required by `docs/ai/TEST_FIRST_AGENT_POLICY.md`, then run the RED tasks below.

## Architecture and change map

```text
src/main.tsx
  -> pwaShellRuntime (capabilities)
  -> pwaInstallOwner (capture before Settings)
  -> pwaUpdateLifecycle (waiting worker + dirty-writer barrier)
       -> serviceWorkerMessages (trusted message types)
       -> src/sw.ts (explicit activation + owned cache cleanup)
  -> Settings / existing overlay consumers

public + docs manifests <-> vite.config.ts (one stable identity contract)
public/offline.html (isolated localized emergency fallback)
```

Expected implementation paths are limited to `src/main.tsx`, `src/lib/pwaShellRuntime.ts`, `src/lib/pwaInstallOwner.ts`, `src/lib/pwaUpdateLifecycle.ts`, `src/hooks/usePwaInstall.ts`, Settings-owned install presentation files discovered during RED characterization, `src/lib/serviceWorkerMessages.ts`, `src/sw.ts`, `vite.config.ts`, `public/manifest.webmanifest`, `docs/manifest.webmanifest`, `public/offline.html`, their focused tests, and this feature's evidence. Actual write scope must be rechecked after RED characterization; no native path is approved.

## Phase 0 — Characterize current behavior and lock contracts

1. Capture focused RED/characterization evidence for the late install event, automatic worker activation, unbounded cache deletion, stale-chunk recovery reload route, manifest orientation, offline-page honest copy, and diagnostics sanitization.
2. Inspect actual Settings install consumer and existing version/chunk-recovery code after the RED assertions identify their exact owner files; do not move unrelated native app-update behavior.
3. Write a feature-local preflight evidence packet with source revisions, task/request hashes, expected failures, platform matrix, and rollback target.

## Phase 1 — Runtime ownership and install path

1. Add a pure runtime resolver and unit-test the exact four surface values, including both native mobile platforms mapping to `capacitor` and Safari Home Screen mapping to `installed-pwa`.
2. Add the singleton event owner at the main entry; turn `usePwaInstall` into a thin state/action consumer.
3. Add only an explicit Settings installation action and Safari manual help. Preserve no-banner policy and current standalone detection.
4. Add full locale keys, translation parity and RTL tests before visual runtime claims.

## Phase 2 — Update and cache safety

1. Add the in-memory writer registry/state machine with exact outcome states and finite timeout.
2. Route normal waiting-worker update and stale-chunk recovery through the same controller; remove any direct automatic activation/reload bypass.
3. Change generated registration/worker lifecycle to waiting behavior. Require explicit user action, barrier success, trusted message, and controller-change before one reload.
4. Add the owned-cache predicate and use it for all feature recovery cleanup; add negative-control cache survival tests.

## Phase 3 — Offline and metadata integrity

1. Preserve manifest identity and public/docs parity while permitting both orientations and progressive locale metadata; generic icons are limited to square `192/512 any` and `512 maskable`, with generator-owned Apple touch output checked separately and wide/splash assets excluded from generic icons.
2. Make the static fallback page semantically accessible, eight-locale/RTL safe, reduced-motion safe, and honest about remote availability.
3. Add route sanitizer and bounded diagnostic payload assertions.

## Phase 4 — Verification, recovery, and review

1. Rerun the exact RED tests green, then run path-specific Vitest, typecheck, lint, i18n/translation, manifest/offline checks, PWA build, production-data integrity diff/source/bundle, scoped security scan, and relevant browser tests.
2. Collect installed Chrome/Edge PWA evidence and Safari Home Screen/manual-install evidence where available; native owners supply compatibility receipts after shared-module change.
3. Record artifacts, hashes, command results, screenshots/console/network capture, rollback rehearsal, and explicit `UNVERIFIED` rows. Review `git diff` and `git status` before handoff.

## Failure handling and rollback

| Failure | Required behavior | Rollback/recovery |
| --- | --- | --- |
| install event absent | Present no Chromium install action; Safari gets manual help only when capability allows. | Keep normal web Settings usable. |
| writer rejects/times out | Block reload, state why without data, allow explicit retry after new attempt. | Never force skip-waiting/reload. |
| waiting worker missing/untrusted | Mark update failed/pending; do not change controller/cache. | Preserve running shell and retry discovery later. |
| cache cleanup fails | Preserve all non-owned keys; surface failure. | Do not broaden predicate or loop all keys. |
| stale chunk occurs | Enter the same barrier state machine. | Restore usable current shell or manual retry; avoid direct reload bypass. |
| manifest regression | Reject change before shipping when identity/parity/icon/orientation contract fails. | Revert complete manifest/config update together. |

Normal rollback is one revert of the complete lifecycle change series in reverse dependency order: offline/manifest/diagnostics, worker/update lifecycle, then install/runtime owner. Do not revert only a test, only `skipWaiting`, or only cache cleanup; each partial rollback could restore an unsafe bypass.

## Platform/domain verification matrix

| Surface | Plan status before implementation | Required later proof |
| --- | --- | --- |
| Web/Vite | Planned | Local production build/preview, console/network, unit/component tests. |
| Installed PWA | Planned primary | Chrome/Edge installed update/install/offline tests; Safari Home Screen manual path. |
| Android/Capacitor | No source change planned | Resolver unit proof and owner compatibility receipt; build/device `UNVERIFIED` until supplied. |
| iOS/WKWebView | No source change planned | Resolver unit proof and compatibility receipt; simulator/device `UNVERIFIED` until supplied. |
| Desktop/Tauri | No source change planned | Resolver unit proof and desktop receipt; app runtime `UNVERIFIED` until supplied. |
| Accessibility/i18n | Planned | RTL, keyboard/focus, screen-reader name, reflow/safe-area visual proof. |
| Security/privacy | Planned | Trusted-message, cache-isolation, route-redaction tests and scoped scanner. |
| Performance | Planned | First-paint/nonblocking update trace and Chrome performance smoke. |
| Release/operations | Not authorized | No publication; public and store proof `UNVERIFIED`. |

## Proposed-constitution consideration

The constitution status is `PROPOSAL_CRITERIA_ONLY`. Its lifecycle, data, evidence, and rollback guidance is consistent with this plan but does not create a binding finding or task by itself. Active requirements come from the master PWA plan, `AGENTS.md`, Test-First, Production Data Integrity, runtime contract, and Spec Kit policy.

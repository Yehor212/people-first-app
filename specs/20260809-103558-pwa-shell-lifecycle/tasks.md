# Tasks: PWA Shell Lifecycle

**Feature**: PWA Shell Lifecycle  
**Prerequisite**: `spec.md`, `plan.md`, `research.md`, `data-model.md`, `contracts/ui-lifecycle-contract.md`, `quickstart.md`, and checklists are reviewed.  
**Implementation authority**: Not granted by this file. Start only after a fresh test-first token and the parent task's authorization.

## Dependency graph

```text
T001–T006 -> T007–T011 -> US1 (T012–T018)
T007–T011 -> US2 (T019–T030)
T007–T011 -> US3 (T031–T038)
US1 + US2 + US3 -> T039–T046
```

User Story 1 is the minimum independently valuable slice. User Story 2 depends on the shared resolver/trust scaffolding but not on install UI behavior. User Story 3 depends on the shared resolver and service-worker ownership predicate. No task authorizes native mutation or release.

## Phase 1 — Setup and evidence lock

- [ ] T001 Record normalized request SHA-256, current source baseline hashes, feature artifact hashes, and target worktree/branch in `specs/20260809-103558-pwa-shell-lifecycle/evidence/preimplementation-analysis.md`.
- [ ] T002 Create a fresh structured test-first/skill-routing token in `.preflight-token` for the PWA shell paths before production edits.
- [ ] T003 Capture and retain RED/characterization output for the existing late-mount event, automatic worker activation, broad cache cleanup, and direct recovery reload paths in `specs/20260809-103558-pwa-shell-lifecycle/evidence/`.
- [ ] T004 [P] Capture a clean manifest/offline baseline with `scripts/__tests__/public-webmanifest-contract.test.ts` and `scripts/__tests__/offline-page-i18n.test.ts` in `specs/20260809-103558-pwa-shell-lifecycle/evidence/`.
- [ ] T005 [P] Inspect and hash the exact Settings install consumer and stale-chunk owner source paths referenced from `src/main.tsx` and record them in `specs/20260809-103558-pwa-shell-lifecycle/evidence/preimplementation-analysis.md`.
- [ ] T006 Run `npm run check:production-data-integrity:diff` before source edits and record actual status in `specs/20260809-103558-pwa-shell-lifecycle/evidence/preimplementation-analysis.md`.

## Phase 2 — Foundational runtime and trust contracts

- [ ] T007 Add RED platform-resolution tests in `src/lib/__tests__/pwaShellRuntime.test.ts` for Web/Vite, installed PWA, Android/Capacitor, iOS/WKWebView, and Desktop/Tauri; assert native/Tauri receive no Web service-worker capability.
- [ ] T008 Implement the pure resolver in `src/lib/pwaShellRuntime.ts` and use existing `src/lib/platform.ts` semantics without adding persistence or dependencies.
- [ ] T009 Add RED sanitizer/trusted-message cases in `src/lib/__tests__/serviceWorkerMessages.test.ts` for query/hash/OAuth exclusion, unknown types, wrong origin, and wrong worker script URL.
- [ ] T010 Implement explicit lifecycle message types and pathname-only sanitizer in `src/lib/serviceWorkerMessages.ts`.
- [ ] T011 Add `src/lib/pwaShellRuntime.ts` and `src/lib/serviceWorkerMessages.ts` to the PWA shell source/evidence hash manifest in `specs/20260809-103558-pwa-shell-lifecycle/evidence/preimplementation-analysis.md`.

## Phase 3 — User Story 1: retain and use the install opportunity (P1)

**Goal**: A genuine browser install event survives until the user visits Settings; unsupported browsers receive honest manual help only.

**Independent test**: Event before consumer mount, appinstalled, accepted, dismissed, error, standalone, unsupported, and Safari-manual states pass without an automatic banner.

- [ ] T012 [US1] Add RED owner tests in `src/lib/__tests__/pwaInstallOwner.test.ts` for early event retention, event replacement, appinstalled, accepted/dismissed/error, teardown, and subscriber snapshots.
- [ ] T013 [US1] Add RED consumer tests in `src/hooks/__tests__/usePwaInstall.test.ts` for late Settings mount, no duplicate listener/owner, standalone, and no false Safari availability.
- [ ] T014 [US1] Implement the in-memory application-lifetime owner in `src/lib/pwaInstallOwner.ts`; do not serialize the browser event or emit it to diagnostics.
- [ ] T015 [US1] Initialize/dispose the install owner in `src/main.tsx` before React mounting and only when `src/lib/pwaShellRuntime.ts` permits Web/PWA ownership.
- [ ] T016 [US1] Refactor `src/hooks/usePwaInstall.ts` into a snapshot/action consumer of `src/lib/pwaInstallOwner.ts` while preserving explicit user initiation.
- [ ] T017 [US1] Add explicit localized Settings install/manual-Safari presentation at the exact owner file identified by T005, using existing i18n and overlay patterns; do not mount `src/components/InstallBanner.tsx` automatically.
- [ ] T018 [US1] Add locale parity, RTL, accessible-name, focus, and 44px action tests at the Settings owner test path identified by T005 and in `src/i18n/__tests__/pwaShellLifecycle.i18n.test.ts`.

## Phase 4 — User Story 2: explicit safe update and stale-chunk recovery (P1)

**Goal**: A user controls a pending PWA update, and neither a normal worker nor a stale chunk can reload across an unsettled writer.

**Independent test**: Clean/resolving writer yields at most one reload; rejected/cancelled/timed-out writer yields zero; duplicate events/actions and untrusted messages cannot bypass the state machine.

- [ ] T019 [US2] Add RED state-machine tests in `src/lib/__tests__/pwaUpdateLifecycle.test.ts` for waiting, defer, resolving/rejecting/cancelled/timed-out writers, missing worker, activation error, controller change, and reload deduplication.
- [ ] T020 [US2] Add RED integration characterization in `src/__tests__/pwaShellLifecycle.static.test.ts` that identifies existing direct worker activation/reload and stale-chunk recovery bypasses in `src/main.tsx`, `src/sw.ts`, and `vite.config.ts`.
- [ ] T021 [US2] Implement process-local dirty-writer registry and bounded update state machine in `src/lib/pwaUpdateLifecycle.ts`; keep callbacks content-free and reject late registration per attempt.
- [ ] T022 [US2] Route waiting-worker discovery and trusted lifecycle messages in `src/main.tsx` through `src/lib/pwaUpdateLifecycle.ts`; remove automatic activation/reload paths only after their RED proof exists.
- [ ] T023 [US2] Route stale-chunk recovery from `src/components/UpdateRequiredDialog.tsx` and its helper path through `src/lib/pwaUpdateLifecycle.ts` without replacing modal ownership.
- [ ] T024 [US2] Update `src/lib/serviceWorkerMessages.ts` and `src/lib/__tests__/serviceWorkerMessages.test.ts` so page/worker lifecycle message types support waiting/activation confirmation without accepting arbitrary commands.
- [ ] T025 [US2] Change `src/sw.ts` so install does not call automatic `skipWaiting`, activation follows only explicit validated client action, and controller/update messages are emitted only through the new contract.
- [ ] T026 [US2] Change `vite.config.ts` PWA registration/update configuration to preserve a discoverable waiting worker rather than auto-update/reload, while retaining Capacitor PWA disablement.
- [ ] T027 [US2] Add update-state presentation using `src/components/OverlayLayer.tsx` and a dedicated `src/components/PwaUpdatePrompt.tsx` or the verified existing update owner; preserve focus/Escape/Android-back behavior when modal.
- [ ] T028 [US2] Add RED/GREEN presentation tests in `src/components/__tests__/PwaUpdatePrompt.test.tsx` or the verified existing owner test file for waiting, defer, blocked, failed, retry, busy, keyboard, and screen-reader behavior.
- [ ] T029 [US2] Add integration tests in `e2e/pwa-shell-lifecycle.spec.ts` using `e2e/helpers/pwa-offline/playwright.config.ts` for one reload maximum and no reload after rejected/timed-out writer.
- [ ] T030 [US2] Record barrier timeout, reload-count, stale-chunk, and controller-change command receipts in `specs/20260809-103558-pwa-shell-lifecycle/evidence/` without user content or raw URLs.

## Phase 5 — User Story 3: owned cache recovery, honest offline page, manifest and diagnostics (P2)

**Goal**: Offline/recovery paths preserve other same-origin caches, preserve privacy, and tell the user only what the shell knows.

**Independent test**: Owned caches are the only cleanup targets; unrelated cache survives; manifest/offline/diagnostic contracts cover stated metadata and redaction.

- [ ] T031 [US3] Add RED owned-cache negative-control tests in `src/__tests__/serviceWorkerCacheOwnership.test.ts` for every ZenFlow cache family and one unrelated same-origin cache.
- [ ] T032 [US3] Implement an exact owned-cache predicate and bounded cleanup in `src/sw.ts`; remove the all-cache deletion loop and preserve cleanup error state.
- [ ] T033 [US3] Add RED manifest parity/orientation/locale/icon tests in `scripts/__tests__/public-webmanifest-contract.test.ts`, including byte- and dimension-mutated icon negative controls and rejection of wide/splash assets in generic `icons`.
- [ ] T034 [US3] Update `vite.config.ts`, `public/manifest.webmanifest`, and `docs/manifest.webmanifest` together to preserve identity/parity while adding both orientations and progressive locale metadata.
- [ ] T035 [US3] Add RED offline semantics/a11y/RTL/no-future-sync-claim tests in `scripts/__tests__/offline-page-i18n.test.ts`.
- [ ] T036 [US3] Update `public/offline.html` with eight-locale honest fallback copy, language/direction handling, semantic retry/focus/reduced-motion contract, and no production data.
- [ ] T037 [US3] Add route-redaction coverage in `src/lib/__tests__/serviceWorkerMessages.test.ts` and wire bounded lifecycle diagnostic emission from `src/main.tsx`/`src/lib/pwaUpdateLifecycle.ts`.
- [ ] T038 [US3] Run source and built-bundle production-data integrity checks after the PWA build; retain exact status/receipt references in `specs/20260809-103558-pwa-shell-lifecycle/evidence/`.

## Phase 6 — Cross-cutting verification, platform receipts, rollback, and handoff

- [ ] T039 Run focused Vitest RED/GREEN suites for `src/lib/__tests__/pwaShellRuntime.test.ts`, `src/lib/__tests__/pwaInstallOwner.test.ts`, `src/lib/__tests__/pwaUpdateLifecycle.test.ts`, `src/hooks/__tests__/usePwaInstall.test.ts`, `src/lib/__tests__/serviceWorkerMessages.test.ts`, and modified component/static tests with `--maxWorkers=1`; retain actual counts in `specs/20260809-103558-pwa-shell-lifecycle/evidence/`.
- [ ] T040 [P] Run `npm run typecheck`, `npm run lint`, `npm run i18n:check`, `npm run i18n:deep`, and `npm run check:translation-quality`; record pass/fail per command in `specs/20260809-103558-pwa-shell-lifecycle/evidence/`.
- [ ] T041 Run `npm run build`, `npm run check:production-data-integrity`, and `npm run check:production-data-integrity:bundle` sequentially; retain artifact hash and check results in `specs/20260809-103558-pwa-shell-lifecycle/evidence/`.
- [ ] T042 [P] Run the narrowest applicable `/Users/yehor/.codex/bin/codex-security-suite.sh` profile and Snyk source scan over modified first-party PWA paths; record tool availability/finding status in `specs/20260809-103558-pwa-shell-lifecycle/evidence/`.
- [ ] T043 Run `npm run check:no-ai-templates`, then inspect final `git diff --check`, `git diff`, and `git status --short`; record owned paths and no-secret/no-production-data review in `specs/20260809-103558-pwa-shell-lifecycle/evidence/`.
- [ ] T044 Run installed Chrome/Edge PWA browser evidence with clean profile, console/network capture, install states, waiting update, writer outcomes, stale-chunk recovery, owned-cache negative control, offline fallback, phone and desktop viewports in `e2e/pwa-shell-lifecycle.spec.ts`; if unavailable mark each exact proof `UNVERIFIED`.
- [ ] T045 Obtain separately owned compatibility receipts for Android/Capacitor, iOS/WKWebView, and Desktop/Tauri after shared runtime modules change; record each result or exact `UNVERIFIED` blocker in `specs/20260809-103558-pwa-shell-lifecycle/evidence/` and do not claim Web test success as native proof.
- [ ] T046 Rehearse a local normal revert of the full PWA shell lifecycle file set, rerun the safety-characterization tests against the revert target, document the result in `specs/20260809-103558-pwa-shell-lifecycle/evidence/`, and hand off without commit/push/PR/deploy.

## Parallel opportunities

- After T001–T003, T004 and T005 can run in parallel because they only capture independent evidence.
- After T008, T009 and T012 can run in parallel; both are RED tests for different pure contracts.
- After T021, T025 and T027 can proceed in parallel only after the shared state-machine interface is settled; both must integrate through T022.
- After T032, T033 and T035 can run in parallel because cache, manifest, and offline contracts use separate files.
- T040 and T042 can run in parallel after source changes are frozen; T041 must be sequential with build-sensitive production-data checks.

## Requirement traceability

| Requirement | Tasks |
| --- | --- |
| FR-001 | T007–T008, T015, T022, T045 |
| FR-002 | T012–T016 |
| FR-003 | T012–T018, T044 |
| FR-004 | T013, T017–T018, T044 |
| FR-005 | T033–T034, T040, T044 |
| FR-006 | T019–T028, T044 |
| FR-007 | T019–T023, T029–T030, T044 |
| FR-008 | T019–T029, T044 |
| FR-009 | T031–T032, T044 |
| FR-010 | T035–T036, T040, T044 |
| FR-011 | T009–T010, T037, T042 |
| FR-012 | T009–T010, T024–T025, T042 |
| SC-001 | T012–T018, T039 |
| SC-002 | T019–T023, T029–T030, T039, T044 |
| SC-003 | T031–T032, T044 |
| SC-004 | T033–T036, T040 |
| SC-005 | T009–T010, T037, T039 |
| SC-006 | T041, T044–T046 |

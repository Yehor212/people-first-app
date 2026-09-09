# Compatibility And Integration Evidence

## Scope And State

Owner-authorized React 19 compatibility and twelve import-cycle repairs for the all-branch main integration. Existing lane: `codex/android-103ms-20260904`. The original fifteen heads and preservation commit `538ff957` are already present under published `d9a71d80`; the compatibility working tree is not yet published. PR #112 remains a draft until final local checks and exact-head CI are evaluated.

No persistence format, schema, recovery algorithm, personal account data, canonical asset, motion timing, translation, native source or paid service was changed by this compatibility repair. Earlier Android changes remain part of the separately preserved input batch. The Android 103 ms acceptance gate remains FAIL in feature 004.

## Explicit And Implied Requirements

Explicit: preserve all inventoried authors' commits and working changes in main; implement the approved React 19 and cycle repairs; use normal protected publication.

Implied and implemented: pair React DOM/types and size-limit peers; use actual boolean interaction protection instead of type casts; preserve the single device cache and event ordering; refresh generated source hashes and stale static expectations; align the backup E2E expectations with the existing unavailable-account local-import contract; update Vitest and its matching coverage package to the existing compatible 4.1.11 patch so dependency audit has no findings. No new production dependency was introduced.

The primary references are the [React 19 upgrade guide](https://react.dev/blog/2024/04/25/react-19-upgrade-guide), [common DOM props](https://react.dev/reference/react-dom/components/common), and [Vitest advisory and patched release](https://github.com/vitest-dev/vitest/security/advisories/GHSA-82fw-gwwq-j7x9), checked on 2026-09-09. These apply to the installed React 19 pair and the existing Vitest development dependency; they do not authorize changes to data semantics or visuals.

## Test-First Sequence

| Stage | Observed result |
|---|---|
| Paired React 19 baseline before production adaptation | 10,330 passed, four failed, 23 skipped and seven todo across 867 files; every failure was a missing actual inert attribute. Separate typecheck failed; configured dependency graph reported twelve cycles. |
| Added RED | Writer/facade identity tests failed before the writer existed. Journal retained-view/nested-confirmation and real Framer Motion orb tests reproduced missing inert before the relevant edits. |
| Initial focused GREEN | Six UI files: 347/347. Twenty-one event/sync/deletion/automation/journal files: 285/285. These runs used Vitest 4.1.8 before the security patch. |
| First full adapted run | 10,336 passed; three static expectations failed because two still expected the obsolete string inert syntax and the generated motion inventory held old hashes. Behavioral assertions were not removed. |
| Static repair on Vitest 4.1.11 | Three files, 37/37 passed. Source-literal checks now require boolean inert; the existing inventory generator refreshed hashes/locators without promoting runtime or artistic labels. |
| Release-contract rerun on Vitest 4.1.11 | 374 workspace tests plus 650 release-contract tests passed. Earlier two 5-second workspace-test timeouts occurred during concurrent heavy runs; the ordinary rerun passed without changing timeout or assertions. |
| Full final preflight on Vitest 4.1.11 | `npm run ci:preflight` exited 0: 10,339 passed, zero failed, 23 skipped and seven todo; 866 passing files and one skipped file. Full coverage execution took 589.43 seconds. |

Ignored detailed receipts are under `output/main-convergence-20260909.hV5KFc/`: `react19-baseline.json`, `compatibility-extra-red.json`, `react19-focused-green.json`, `sync-writer-focused-green.json`, `static-compatibility-green.json`, and `event-extraction-identity.json`. These contain test evidence, not live-user records.

Coverage totals are fresh and nonzero: lines 68.05%, statements 65.84%, functions 63.6%, branches 55.23%; the existing thresholds and coverage-integrity validator passed. The same preflight completed source integrity, 1,024 release/workspace tests, workspace guards, zero-warning ESLint, typecheck, i18n, oxlint, circular analysis, build, bundle integrity, release artifacts, Tailwind/size/orb checks, best-practices/no-template/audio/RAG/completion/sync/schema checks and ratchet validation. Separate `check:all`, doc-counts, constitution freshness, generated-types freshness and 84 migration-prefix checks also passed.

Nonblocking inherited diagnostics were not hidden or weakened: oxlint reports 37 warnings, circular resolution 19 warnings, the color scanner 10 existing canvas-color findings under its existing threshold, and ratchet 70 warnings/unmeasured or older ledger rows. Ratchet's historical score/test-count text is not used as current runtime or test proof. jsdom emitted unsupported-navigation/canvas diagnostics; the test summary still recorded zero failed tests and the real-browser checks are reported separately.

## Source And Dependency Review

AST-based statement comparison against pre-repair `d9a71d80` confirmed all 30 named writer declarations and all 45 retained consumer declarations are text-identical, ignoring only the added export modifier on the shared owner helper. Imports/re-exports and module ownership changed; event write, retry, UUID, owner guard, delta apply and diary recovery bodies did not. Tests prove all nine legacy producer exports share function identity and cache invalidation with the writer.

Permanent deletion keys and their type were moved unchanged to a persistence-free leaf. The settings policy imports the leaf, and the tracker retains its public exports. Two stats imports no longer go through their own barrel. Existing producer checks moved to the writer, consumer checks remained, and seven facade-wiring checks were added: 417 sync-contract invariants passed. Configured circular analysis processed 1,760 files and found zero cycles; its 19 resolver warnings remain visible.

`npm ci` succeeded with React/React DOM 19.2.8, types 19.2.18/19.2.7, size-limit/file 13.0.3 and Vitest/coverage 4.1.11. All five existing Capacitor/native patches applied. `npm audit --audit-level=high` reported zero vulnerabilities. npm 10.9.4 hit an internal peer-resolver null error while updating the Vitest lockfile; a one-shot npm 11.11.1 invocation resolved it, and ordinary npm 10.9.4 then completed `npm ci`. No global npm or project engine change was made.

## Browser Evidence

The production-equivalent local Web build at `http://127.0.0.1:4178/people-first-app/` was exercised in isolated browser contexts. Real sign-in was unavailable; only the existing test harness's onboarding/preferences were initialized. No real account, personal diary, backend mutation or credential was used.

The Settings E2E suite passed 13/13: phone overview/history/focus, direct detail routes, desktop group/detail relationships, appearance persistence, reset disclosure focus, Web-only control boundaries, backup/report separation, 44px footer controls, large text/import-dialog containment, Arabic/Hebrew at 320px, and sound controls. After the final preflight rebuild, these thirteen scenarios plus the delayed-worker Orb resize/readiness regression passed together: 14/14. The old unavailable-backend assertions contradicted `V2SettingsDataPanels.tsx` and its existing unit test; the updated scenario preserves export/report checks and exercises import-dialog focus/viewport checks for that state too.

A direct normal-motion browser observation returned the outgoing Settings detail with `inert: true` and `ariaHidden: "true"`, then showed focus restored to Appearance. Static screenshots were inspected for phone Settings, Appearance, Arabic/Hebrew narrow states, desktop Settings, and the empty diary/editor. They showed readable, scrollable controls without detected clipping or replacement visuals in those states. Empty editor navigation was tested without entering or saving diary content.

The actual Orb step transition simultaneously returned the retained outgoing scene with `inert: true`/`ariaHidden: "true"` and the incoming scene with `inert: false`/no aria-hidden attribute. Its initial phone screenshot was also inspected. No mood was saved. The diary list-to-editor browser observation did not retain a list node long enough to prove an exit boundary; that boundary is covered by the added DOM regression, not misreported as a browser timing result.

Local screenshots and the initial 151-file browser-build digest are retained under `output/playwright/react19-*.png` and `output/playwright/react19-browser-bundle.json`. The final preflight rebuilt that bundle, so the earlier digest is not presented as final-build identity. On the final bundle, all 14 E2E scenarios passed and four further screenshots were directly inspected: `react19-final-settings-phone.png`, `react19-final-settings-desktop.png`, `react19-final-diary-phone.png`, and `react19-final-orb-phone.png`. Its separate digest is `output/playwright/react19-final-browser-bundle.json`. The final screenshot context used reduced motion, had zero browser console errors/warnings, and was closed after inspection. The existing reduced-motion omission of compact decorative orbs is not a new visual replacement.

The earlier Chrome performance smoke covered 14 phone/desktop route profiles, with no console errors, steady-state long task or blocking long-animation frame in the recorded sample. Largest recorded startup task was 476 ms, within that smoke's existing 500 ms budget. Nonblocking frame delays were recorded; this earlier sample is not an exact-final-bundle performance rerun, native presented-frame evidence or the 103 ms target.

## Inline Read-Only Visual Review

Visual Integrity Critic: STOP

This stop applies to broad artistic, full-motion and native-device certification, not to a detected compatibility defect. No new model or visual asset was produced. The eight initial and four final-build local Web screenshots support only the bounded observations above.

Technical: PASS — actual inert/focus observations, 14 final-build browser scenarios, focused DOM regressions and green final build/preflight.

Artistic/Craft: UNVERIFIED — the viewed states are readable and aligned, but no new hash-bound human artistic review was requested or obtained.

Motion: UNVERIFIED — transition interaction protection is proven; complete movement quality and native presented frames are not certified by snapshots or DOM tests.

Model: UNVERIFIED — canonical asset/source replacement was not part of this change; existing model approval is not reissued from these screenshots.

Plan: PASS — exact reproduced defects, preserved data bodies, test-first additions, rollback and five-platform boundaries are traceable.

What is wrong:
- Evidence does not support universal visual/runtime/artistic/native readiness. No new compatibility-specific visual defect was observed in the inspected states.

Required fixes before final:
- Keep those proof limits explicit and complete the remaining technical/publication gates; do not broaden the claim from Web compatibility to device or artistic acceptance.

Do not claim complete because:
- Local screenshots and unit results cannot close the separate Android 103 ms gate, certify installed PWA/native apps or stand in for human artistic approval.

Next best action:
- Finish staged integrity review and protected PR integration under T013–T015 without changing the visual system.

## Security And Integrity

Production-data source/diff, final preflight rebuilt-bundle and final 80-path staged checks passed with zero errors/warnings. The baseline entries and waiver list were directly inspected and are both empty. The staged manifest exactly matches the reviewed write set and contains no ignored output, local configuration, law files or secrets.

The final 80-path scan copy was hash-checked against the reviewed working files with zero mismatches. Gitleaks scanned 8.28 MB with no leaks; TruffleHog scanned 922 chunks and reported zero verified or unverified secrets. The local Snyk fallback again identified only the unchanged test-only `PRIVATE_SETTING_CANARY` string in a logger-privacy regression, not a credential or production secret; no suppression or renaming was applied. Its final metadata request returned 403, so Snyk completion remains UNVERIFIED. The earlier preserved journey-runner finding was also triaged against the actual FileHandle data sink. No whole-repository security or authenticated sync PASS is claimed.

## Platform And Domain Matrix

| Target/domain | Evidence | Remaining boundary |
|---|---|---|
| Web/Vite | Final local production build, 14 browser scenarios, direct inert/focus observation and inspected screenshots | Exact-head CI and public deployment are separate gates |
| Installed PWA | Shared source/build and PWA generation checks | Installed worker/update behavior UNVERIFIED |
| Android/Capacitor | Shared compatibility tests; all existing install-time native patches apply | Exact-head Android CI required; device runtime UNVERIFIED; separate 103 ms FAIL |
| iOS/WKWebView | Shared types/tests and preserved native source | Exact-head iOS CI required; device/safe-area/keyboard runtime UNVERIFIED |
| Desktop/Tauri | Desktop-width Web interaction and shared graph | Packaged Tauri runtime UNVERIFIED |
| Accessibility | DOM inert, focus restoration, reduced motion, ar/he and 44px checks | Human assistive-technology/device checks UNVERIFIED |
| Performance | Existing 14-profile Chrome smoke | Native presented-frame latency UNVERIFIED for this repair |
| Security/privacy/data | Isolated owner/retry/deletion/journal tests, unchanged bodies, audit and integrity scans | Full Snyk completion and eligible live-account sync drill UNVERIFIED |
| Store/release/operations | Original commits retained; protected PR path | No store submission; current required CI and final ancestry still open |

## Rollback And Open Gates

Rollback is a normal inverse compatibility PR reverting the paired dependency/code change together; no data migration needs reversal. Do not delete source copies or original refs, force-push, rewrite history, weaken checks or relabel feature 004.

T013 final review and staged integrity are complete. Remaining ordered gates are T014–T015 in [tasks.md](tasks.md): normal commit/push, exact-tip handoff, current required CI and history-preserving merge. Publication results will be recorded in PR #112 and the final local receipt after they occur; these pre-commit checkboxes do not predict a future merge. Missing artistic, installed-app, device and live-account proof remains explicitly outside a Git-integration completion claim.

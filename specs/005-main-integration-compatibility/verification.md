# Compatibility And Integration Evidence

## Scope And State

Owner-authorized React 19 compatibility and twelve import-cycle repairs for the all-branch main integration. Existing lane: `codex/android-103ms-20260904`. This is a pre-publication snapshot on 2026-09-09, updated after the staging-contract failure on `9502fc467862aca05d0fb679d6cc695ba408c3b5`. That published head includes the original fifteen heads, preservation commit `538ff957`, compatibility and PWA delivery repairs. PR #112 is open; the tested revision-format follow-up below is ready for normal commit/push and fresh CI. Actual publication and final ancestry must be recorded after execution in PR #112 and the ignored final receipt, not predicted here.

No persistence format, schema, recovery algorithm, personal account data, canonical asset, motion timing, translation, native source or paid service was changed by this compatibility repair. Earlier Android changes remain part of the separately preserved input batch. The Android 103 ms acceptance gate remains FAIL in feature 004.

## Explicit And Implied Requirements

Explicit: preserve all inventoried authors' commits and working changes in main; implement the approved React 19 and cycle repairs; use normal protected publication.

Implied and implemented: pair React DOM/types and size-limit peers; use actual boolean interaction protection instead of type casts; preserve the single device cache and event ordering; refresh generated source hashes and stale static expectations; align the backup E2E expectations with the existing unavailable-account local-import contract; update Vitest and its matching coverage package to the existing compatible 4.1.11 patch so dependency audit has no findings. No new production dependency was introduced.

The primary references are the [React 19 upgrade guide](https://react.dev/blog/2024/04/25/react-19-upgrade-guide), [common DOM props](https://react.dev/reference/react-dom/components/common), and [Vitest advisory and patched release](https://github.com/vitest-dev/vitest/security/advisories/GHSA-82fw-gwwq-j7x9), checked on 2026-09-09. These apply to the installed React 19 pair and the existing Vitest development dependency; they do not authorize changes to data semantics or visuals.

## Workbox Revision Compatibility: Local Acceptance At 17:13 UTC

GitHub CI on `9502fc46` passed Android, iOS, production-data integrity, visual regression and all drift checks. Its build job failed specifically at `Stage Pages release artifact`: the new collector's SHA-256 cache revision was rejected by the existing Workbox-MD5 verifier. The same real `dist` failure was reproduced locally. Earlier raw-build and browser successes did not prove this downstream staging boundary.

Before changing the helper, the 24-case collector suite had 22 passes and two expected failures: the existing-byte assertion against `computeWorkboxRevision` and a new actual release-verifier test. The implementation changes only the cache identifier to Workbox's MD5 content format, with an explicit non-security-purpose comment. It does not change the release checker, its byte/tamper checks, SHA-256 artifact seals, worker runtime, application code, payload budget or asset bytes. The new integration case now passes the real release verifier and still rejects a mutated editor file.

Fresh verification: 10364 full-suite tests passed, zero failed, 23 skipped and seven todo across 868 files. Separate collector/prepare/stage/integrity tests passed 55/55; release-contract runs passed 374 workspace and 650 other cases. Separate typecheck and explicit MJS lint passed. The coverage/preflight values in the historical 16:45 section remain bound to that preceding run; this follow-up ran the complete ordinary test suite, build and the previously missing actual prepare/stage path.

Actual Pages preparation sealed 534 uploadable files. Canonical staging, all 78 worker-cache reference/revision checks and staged public-privacy checks passed. Source/diff and rebuilt-bundle production-data integrity passed with zero errors, warnings, baselines or waivers. The final staged worker is 56880 bytes, SHA-256 `82000b05ad2769ffb28547d0438f291417e6831606da9d7c6d150cb7884c0b06`. Its 25 added entries still total 566129 bytes under 655360. Each cache revision matches its actual bytes, and independent SHA-256 file hashes were retained. Hashed output filenames changed with the new build; the manual receipt compares the complete emitted name multiset rather than assuming fixed hashes or manifest order.

Three prepared-build browser repetitions passed all six applicable Chromium/WebKit cases with six existing project-specific skips. A separate run served `output/pages-artifact.nosync` itself and passed the full cold-editor/save/offline-reload/reconnect journey plus WebKit rendering: two passes, two corresponding skips. There was no online editor warming, dropped assertion or data mutation outside isolated tests.

Snyk reported one LOW password-hash warning for the MD5 call, then its metadata request returned 403; a retry with the canonical remote URL also returned 403. Scanner completion is UNVERIFIED, not PASS. Static source/control/sink review establishes that the value comes only from emitted public chunk/asset bytes in the build-only plugin and is consumed as a Workbox cache identifier, not as a password or trust decision. Installed Workbox `get-string-hash.js` uses the same MD5 algorithm; the existing release checker explicitly separates it from `computeSha256`, per-file SHA-256 and the SHA-256 prepared-manifest fingerprint. The password-hash claim is therefore not applicable to this use. No warning was ignored, suppressed, waived or hidden by changing scanner scope. Gitleaks scanned 102572 bytes with zero leaks; TruffleHog scanned 15 chunks/122224 bytes with zero verified or unverified secrets.

Receipts in the existing ignored evidence directory: `ci-build-9502fc46-job.log`, `pwa-workbox-revision-real-red.log`, `pwa-workbox-revision-red.json`, `pwa-workbox-revision-green.json`, `pwa-workbox-full-tests.json`, `pwa-workbox-revision-build.log`, `pwa-workbox-release-contracts.log`, `pwa-workbox-revision-browser.log`, `pwa-workbox-staged-browser.log`, `pwa-workbox-staged-manifest.json`, and both Snyk attempt logs. Publication still requires fresh CI on the next exact head and a normal ancestry-preserving merge. The five-platform, device, artistic, live-account and 103 ms boundaries below remain unchanged.

## Historical Local Acceptance At 16:45 UTC

The explicitly approved 640 KiB PWA follow-up is implemented. No further product/budget decision or implementation gap remains. The complete final `npm run ci:preflight` exited 0: 10363 passed, zero failed, 23 skipped and seven todo across 868 files (867 passed, one skipped). Coverage execution took 652.57 seconds; lines 68.05%, statements 65.84%, functions 63.6% and branches 55.23% passed the unchanged thresholds and nonzero-evidence validator. The same run completed 374 workspace and 650 release-contract tests, separate types, zero-warning ESLint, zero configured cycles, build, source/bundle integrity and all subsequent release/sync/governance checks. Separate `check:all`, doc-counts, constitution freshness, generated-types freshness and all 84 migration prefixes also passed. The earlier documented nonblocking scanner/ratchet/jsdom diagnostics were not suppressed.

The final build emits 78 precache entries. Its 25 added assets total 566129 bytes, below the owner-approved 655360; every added SHA-256 revision matches the written file. The final worker is 57680 bytes, SHA-256 `10335d9fe94480a64fbfb5437046ed9194cfe2f259921692f823c7438be9be1d`. Unrelated optional locale chunks remain excluded. The final-build full offline/WebKit suite exited 0 with two passes and two intentional project-specific skips. This includes a cold editor, durable save, offline reload and reconnect without prior online editor access. Before the final rebuild, three consecutive repetitions passed all six applicable Chromium/WebKit journeys with six corresponding skips.

The final-built combined visual/Settings/resize suite exited 0: 43 passed, 18 existing intentional skips, zero failures, unchanged comparison thresholds. It used an explicitly owned loopback preview and `ZENFLOW_E2E_AUTH_FIXTURE=unavailable`, matching this credential-free build. The earlier two Settings failures used the default signed-out expectation against an unavailable-account build; the correct existing configuration passed without an application or assertion change. Both refreshed Diary draft screenshots were directly inspected again; their text/actions are readable and no new replacement visual was introduced. This is bounded local Web visual-runtime proof, not human artistic or native certification.

The 23 graph/manifest regressions and four-file 149-case neighbor run passed. Both PWA-disabled Web and Capacitor production bundles built; actual resolved configs and HTML omit the collector, worker and registration. The exact eight-file source scan copy was hash-matched after the last test edit: Snyk completed with zero issues; Gitleaks scanned 100739 bytes with no leaks, and TruffleHog scanned 15 chunks/118712 bytes with zero verified or unverified secrets. Dependency audit reports zero vulnerabilities. The earlier whole compatibility-batch Snyk metadata 403 remains explicitly UNVERIFIED; this narrower completed scan does not erase that limit.

A fresh 14-profile Chrome performance smoke exited 0 with strict console/request-failure checks: all routes reached readiness, zero console/request/response errors, largest raw startup task 230 ms under its existing 500 ms guard, and zero steady-state long tasks. One 442 ms nonblocking animation-frame diagnostic remains visible with zero attributed blocking. It ran against an immutable copy of the preflight-input build, worker `fb56253c904c1e59f63f1af8f4a3230792ae0a31fb715aa10dc3aca3a48962fb`, so concurrent build writes could not invalidate the measurement. It is not exact-final-worker or native presented-frame/103 ms proof.

All fifteen original heads remain ancestors of the integration head. Ninety non-package manifest paths match preservation commit `538ff957` byte-for-byte; the additional circular argument is retained, and the control copy's hooks match the preserved head. Original working-copy statuses remain only their initial package/hook edits. The generated motion inventory differs in 21 source fingerprints/locator fields; release and evidence acceptance labels are unchanged.

Spec Kit comparison covered the 11 requirements, five success criteria and 12 user-story acceptance scenarios, including the six compatibility design decisions and the bounded editor/list delivery contract. There is no new buildable-code gap requiring a duplicate task. The remaining FR-006/SC-003 publication outcome is already tracked by T014–T015, with exact-head CI clauses in T016–T018. The constitution is still PROPOSED/nonbinding; extension hooks are empty and disabled. No empty convergence phase or speculative task was added.

Current dimension labels: Technical PASS; Visual Runtime PASS only for the recorded local Web states; Artistic/Craft, full Motion and Model certification UNVERIFIED; implementation Plan PASS with publication execution still pending. Installed OS PWA/update lifecycle, Android/iOS devices, packaged Tauri, real-account sync, store and public runtime remain UNVERIFIED. The separate Android 103 ms result remains FAIL.

Detailed ignored receipts under `output/main-convergence-20260909.hV5KFc/`: `pwa640-final-preflight.log`, `pwa640-final-four-neighbors.json`, `pwa640-final-manifest.json`, `pwa640-final-rebuilt.log`, `pwa640-rebuilt-visual.log`, `pwa-budget640-durable-final.log`, `pwa640-final-platform-config.json`, `snyk-pwa-final-exact-scope.log`, `secrets-pwa-final-exact-scope.log`, `pwa640-final-audit.log`, and `pwa640-performance.json`. The JSON startup field is `bootRawMaxLongTaskMs`; the separate steady-state field must not be mislabeled as startup.

## Historical Approved PWA Checkpoint At 16:32 UTC

The owner approved the measured 640 KiB limit at 16:08 UTC and reiterated normal push/merge to main. The new exact-limit tests were RED before the one-line budget change, then all 23 emitted-graph/manifest tests passed. The already-cached-resource fixture was increased to 700000 bytes so it remains above the approved budget and still detects double charging. The 3 MiB per-file guard and all image bytes remain unchanged.

The production build now succeeds with 78 precache entries. Its 25 added files total 566129 bytes, below 655360; all added SHA-256 revisions match actual emitted files. Worker SHA-256 before the broad preflight rebuild is `fb56253c904c1e59f63f1af8f4a3230792ae0a31fb715aa10dc3aca3a48962fb`. Both PWA-disabled Web and Capacitor bundles built successfully; resolved configurations omit the collector and worker, and their HTML has no worker/manifest registration.

A repeated browser failure exposed an error in the earlier test repair, not proof of committed-record loss: `JournalEntryEditor` switches contenteditable to false while saving, so waiting for `[contenteditable=true]` to disappear was still premature. Diagnostic runs showed failing reloads could precede the journal write transaction; no application deletion was observed. The test now waits for the stable `journal-entry-editor` root to unmount, which follows the awaited durable save and existing return path. All temporary database/proxy/console diagnostics were removed. No arbitrary sleep, cache warm-up, storage change or dropped persistence assertion remains.

The corrected full suite passed three consecutive repetitions: three Chromium cold-editor/save/offline-reload/reconnect journeys and three iPhone WebKit online/metadata journeys, zero failures and six existing project-specific skips. These are browser tests, not OS-installed PWA or device proof. Dependency audit reports zero vulnerabilities. Broad final preflight and the combined 61-case visual/Settings/resize suite are running; no final whole-suite or publication PASS is claimed yet. An earlier preflight stopped on temporary diagnostic-code lint and an initial visual invocation hit a stopped preview server; neither is counted as acceptance. The reruns use cleaned source and an explicitly owned preview server.

Receipts under the existing ignored evidence directory: `diary-budget640-red.json`, `diary-budget640-green.json`, `diary-budget640-build.log`, `diary-budget640-manifest.json`, `pwa-budget640-durable-final.log`, `pwa640-final-platform-config.json`, `pwa640-final-audit.log`. Final preflight and visual outputs are recorded separately. Source stays uncommitted at this checkpoint; main and PR head are unchanged.

## Historical PWA Checkpoint At 15:58 UTC

The owner approved offline editor loading and dependency caching at 15:23 UTC. That authorization is resolved. The current blocker is the newly measured payload exceeding the agent's preliminary 512 KiB design budget; this is not a second request for the original PWA scope. PR #112 remains open at `36cae381`, main remains `939daa7`, and these changes are uncommitted.

The build-only collector uses emitted module identities/static imports/CSS/assets and final writeBundle bytes. It subtracts the existing initial-boot graph of the controlled, visited-route flow, preserves lazy editor/list execution, rejects missing edges and merges revisioned entries without duplicate URLs. The service-worker runtime, private-data storage and visual assets are unchanged. No all-JS glob, eager editor execution or test-only cache warm-up was introduced.

Observed sequence: initial missing-module RED; 20-case boot/lifecycle GREEN after four genuine boot-boundary failures; successful editor-only production build with 69 precache entries and 346515 added bytes across sixteen files. All sixteen SHA-256 revisions matched actual written files. The browser opened the editor offline. The old text assertion could match the still-saving editor, so an additional post-commit editor-close assertion was added before the existing saved-text checks. The next run completed the save and returned to the diary, then failed after offline reload on uncached JournalEntryList, use-transform and journalAiConsent chunks. WebKit's online installed-metadata scenario passed; its offline navigation remains intentionally unsupported by the test harness.

JournalEntryList is now a second explicit lazy root for the required saved-entry reload. Its new graph regressions were RED at 15/21, then GREEN at 21/21. An intermediate incorrectly constructed fixture produced a stack overflow; that run is not counted as behavioral RED. Current editor/storage/prewarm neighbors pass 147/147 across four files; separate typecheck, repository lint and explicit MJS ESLint pass.

**Current production build: FAIL, not publishable.** The complete twenty-five-file cold dependency set is 566129 bytes (552.9 KiB), above the unchanged 524288-byte guard. It includes the existing 107022-byte aurora-mountains WebP used by dark-theme list/space surfaces, plus the list's shared display dependencies. Dropping that image solely to meet the budget would leave a visual offline gap. A later E2E mistakenly pointed at this failed build and could not activate its incomplete service worker; that run is invalid as application acceptance and is retained as failed-build evidence, not a new defect or PASS. Full preflight did not start because final manifest verification correctly failed first.

ASK: authorize revising the agent-selected added-payload limit from 512 to 640 KiB (655360 bytes), then rerun the full build/manifest byte checks, unchanged cold-editor/save/offline-reload/reconnect assertions and all publication gates. The existing 3 MiB per-file maximum stays unchanged. No limit, image quality or original runtime assertion has been relaxed.

Final eight-file source scope: Snyk completed with zero issues; Gitleaks scanned 100010 bytes with zero leaks; TruffleHog scanned fourteen chunks/117743 bytes with zero verified or unverified secrets. This is not full-repository Snyk completion; the earlier compatibility-wide 403 remains unverified. Current source/diff integrity, canonical-orb, best-practices, no-template and architecture freshness checks passed. Bundle integrity passed on the earlier valid editor-only build, not the failed list-inclusive output.

Platform boundaries: Web/PWA final build and whole journey are blocked as above; OS-installed update lifecycle is unverified. Separate PWA-disabled Web and Capacitor builds passed before the final list-root addition, and resolved configs show neither collector nor worker on disabled paths; final artifact-bound native runtime remains unverified. iPhone WebKit online rendering passed, not an iOS-device test. Packaged Desktop/Tauri and the separate Android 103 ms target remain unverified/FAIL respectively. No native source or personal app state was altered. Local Playwright WebKit 2336 was installed to execute the previously unavailable browser check.

Receipts: `diary-precache-list-build.log`, `diary-precache-list-behavior-red.json`, `diary-precache-list-green.json`, `diary-delivery-neighbors.json`, `diary-final-manifest.json`, `diary-platform-config.json`, `snyk-pwa-final-scope.json` under the existing ignored evidence directory; browser traces under `output/playwright/pwa-editor-save-completion/`. Previous partial results below retain their original scope.

## Earlier Current-Head CI Follow-up Through 15:00 UTC

Fresh GitHub readback at 2026-09-09 14:58 UTC confirms Android, iOS and production-data-integrity gates passed for `36cae381`. The build gate failed at the obsolete Diary wallpaper selector; visual regression failed the stale June desktop Diary-draft baseline; Telegram failed an outdated exact action-pin expectation. No required check was bypassed and main remains unchanged.

The Telegram check now expects the already-merged, upstream-verified deploy-pages v5.0.1 full SHA and rejects its unpinned tag without removing older prohibitions. The complete non-mutating Telegram checks passed locally, including 95 tests and 73 workflow invariants. Two directly inspected stale desktop/mobile Diary-draft images were regenerated from the existing approved UI; thresholds and the visual test source are unchanged. The full 47-case local visual suite then passed 29 cases with 18 existing intentional skips.

The offline test now observes the approved Orb background and reduced-motion state while retaining service-worker control, cache, offline banner, editing, saving, reload, reconnect and zero-page-error checks. It exposed an optional prewarm import failure. A single callback-time `navigator.onLine` guard in `src/main.tsx` follows a 19-case regression RED/GREEN. Six neighboring test files passed 76/76; the local production build, separate types/lint, canonical-orb and source-diff integrity checks passed. This is not yet whole-journey acceptance.

The installed Playwright 1.62.1 also resets `navigator.onLine` to true on navigation while requests remain blocked. An independent empty data-URL probe reproduced true → false → true across online, offline and reload; the [upstream issue](https://github.com/microsoft/playwright/issues/42174) describes the same regression family. A test-only Chromium new-document script now keeps the reported signal false while the context's actual network is disabled. It is removed, the browser property restored and the session detached on reconnect; assertions require both offline state across reload and restored real online state. The production app receives no test override, fake records or changed error handler.

With faithful offline emulation, the banner/background/tab checks pass and the journey reaches **a separate real failure**: first opening the editor offline requests uncached `JournalEntryEditor`, `dist`, `GratitudeBloomWidget`, `DiaryBreatheWidget` and `FloatingMediaLayer` chunks, then enters the recovery screen. `vite.config.ts` precaches only the shell/orb path, and `src/sw.ts` caches lazy chunks only after use; `JournalModule.tsx` already used the lazy editor on original main. The proof is retained in `output/playwright/react19-pwa-verified-emulation/`. The editor/save/reload assertions remain unchanged and failing; no test-only cache warm-up or relaxed assertion was added.

At 15:00 UTC publication stopped because the PWA delivery repair needed separate authorization. The owner granted it at 15:23 UTC; T019 is complete. The later implementation and distinct measured-budget blocker are documented above. This earlier snapshot is not the current write-set status.

The four-file source scan before the final test-harness additions completed Snyk with zero issues and both secrets scanners with zero findings. That scoped result does not supersede the earlier full-batch Snyk 403 limitation or certify later test edits. The 21-leaf generated inventory delta contains only source fingerprints/locators; acceptance and release labels are unchanged.

## Test-First Sequence Before Commit 36cae381

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

## Earlier Compatibility Browser Evidence Before The PWA Follow-up

The production-equivalent local Web build at `http://127.0.0.1:4178/people-first-app/` was exercised in isolated browser contexts. Real sign-in was unavailable; only the existing test harness's onboarding/preferences were initialized. No real account, personal diary, backend mutation or credential was used.

The Settings E2E suite passed 13/13: phone overview/history/focus, direct detail routes, desktop group/detail relationships, appearance persistence, reset disclosure focus, Web-only control boundaries, backup/report separation, 44px footer controls, large text/import-dialog containment, Arabic/Hebrew at 320px, and sound controls. After the final preflight rebuild, these thirteen scenarios plus the delayed-worker Orb resize/readiness regression passed together: 14/14. The old unavailable-backend assertions contradicted `V2SettingsDataPanels.tsx` and its existing unit test; the updated scenario preserves export/report checks and exercises import-dialog focus/viewport checks for that state too.

A direct normal-motion browser observation returned the outgoing Settings detail with `inert: true` and `ariaHidden: "true"`, then showed focus restored to Appearance. Static screenshots were inspected for phone Settings, Appearance, Arabic/Hebrew narrow states, desktop Settings, and the empty diary/editor. They showed readable, scrollable controls without detected clipping or replacement visuals in those states. Empty editor navigation was tested without entering or saving diary content.

The actual Orb step transition simultaneously returned the retained outgoing scene with `inert: true`/`ariaHidden: "true"` and the incoming scene with `inert: false`/no aria-hidden attribute. Its initial phone screenshot was also inspected. No mood was saved. The diary list-to-editor browser observation did not retain a list node long enough to prove an exit boundary; that boundary is covered by the added DOM regression, not misreported as a browser timing result.

Local screenshots and the initial 151-file browser-build digest are retained under `output/playwright/react19-*.png` and `output/playwright/react19-browser-bundle.json`. The final preflight rebuilt that bundle, so the earlier digest is not presented as final-build identity. On the final bundle, all 14 E2E scenarios passed and four further screenshots were directly inspected: `react19-final-settings-phone.png`, `react19-final-settings-desktop.png`, `react19-final-diary-phone.png`, and `react19-final-orb-phone.png`. Its separate digest is `output/playwright/react19-final-browser-bundle.json`. The final screenshot context used reduced motion, had zero browser console errors/warnings, and was closed after inspection. The existing reduced-motion omission of compact decorative orbs is not a new visual replacement.

The earlier Chrome performance smoke covered 14 phone/desktop route profiles, with no console errors, steady-state long task or blocking long-animation frame in the recorded sample. Largest recorded startup task was 476 ms, within that smoke's existing 500 ms budget. Nonblocking frame delays were recorded; this earlier sample is not an exact-final-bundle performance rerun, native presented-frame evidence or the 103 ms target.

## Earlier Compatibility Inline Read-Only Visual Review

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

## Earlier Compatibility Batch Security And Integrity

Production-data source/diff, final preflight rebuilt-bundle and final 80-path staged checks passed with zero errors/warnings. The baseline entries and waiver list were directly inspected and are both empty. The staged manifest exactly matches the reviewed write set and contains no ignored output, local configuration, law files or secrets.

The final 80-path scan copy was hash-checked against the reviewed working files with zero mismatches. Gitleaks scanned 8.28 MB with no leaks; TruffleHog scanned 922 chunks and reported zero verified or unverified secrets. The local Snyk fallback again identified only the unchanged test-only `PRIVATE_SETTING_CANARY` string in a logger-privacy regression, not a credential or production secret; no suppression or renaming was applied. Its final metadata request returned 403, so Snyk completion remains UNVERIFIED. The earlier preserved journey-runner finding was also triaged against the actual FileHandle data sink. No whole-repository security or authenticated sync PASS is claimed.

## Platform And Domain Matrix

| Target/domain | Evidence | Remaining boundary |
|---|---|---|
| Web/Vite | Final local build/preflight, 43 visual/Settings/resize cases, original inert/focus observations and inspected screenshots | Exact-head CI and public deployment are separate gates |
| Installed PWA | Final production-worker cold-editor/save/offline-reload/reconnect browser journey; coherent revision/size proof | Actual OS-installed worker/update behavior UNVERIFIED |
| Android/Capacitor | Shared compatibility tests; fresh disabled-worker bundle; all existing install-time native patches apply | Exact-head Android CI required; device runtime UNVERIFIED; separate 103 ms FAIL |
| iOS/WKWebView | Shared types/tests, fresh disabled-worker bundle and iPhone WebKit online render | Exact-head iOS CI required; device/safe-area/keyboard runtime UNVERIFIED |
| Desktop/Tauri | Desktop-width Web interaction and shared graph | Packaged Tauri runtime UNVERIFIED |
| Accessibility | DOM inert, focus restoration, reduced motion, ar/he and 44px checks | Human assistive-technology/device checks UNVERIFIED |
| Performance | Fresh 14-profile Chrome smoke on immutable preflight-input build | Exact-final-worker/native presented-frame latency UNVERIFIED for this repair |
| Security/privacy/data | Isolated owner/retry/deletion/journal tests, unchanged bodies, audit/integrity and completed eight-file source scan | Earlier full-batch Snyk completion and eligible live-account sync drill UNVERIFIED |
| Store/release/operations | Original commits retained; protected PR path | No store submission; current required CI and final ancestry still open |

## Rollback And Open Gates

Rollback is a normal inverse compatibility PR reverting the paired dependency/code change together; no data migration needs reversal. Do not delete source copies or original refs, force-push, rewrite history, weaken checks or relabel feature 004.

T013 review and staged integrity, compatibility commit/push and exact-tip handoff are complete for `36cae381`. T019 and T023 approvals are resolved; T020–T022 have graph/manifest, broad-preflight and repeated full offline-journey acceptance. T016–T018 have local fixes but remain tied to fresh exact-head CI. T014–T015 still require normal follow-up commit/push, current required checks and merge; the failed checks on the old head are not bypassed. Publication results will be recorded in PR #112 and the final local receipt only after they occur. Missing artistic, installed-app, device and live-account proof remains explicitly outside a Git-integration completion claim.

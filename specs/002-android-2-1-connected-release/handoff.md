# Android 2.1 Connected Release Handoff

> **HISTORICAL HANDOFF:** this predates the recovery rewrite and cannot establish current implementation, artifact or release readiness. The current canonical verdict is `STOP`; no handoff, commit, push, PR, AAB or external change is authorized.

**Verdict**: `STOP` for release, upload and production mutation. The local
implementation is ready for review and further evidence work.

## Identity and authority boundary

| Field | Value |
|---|---|
| Worktree | `/Users/yehor/Projects/ZenFlow/worktrees/codex-android-2-1-connected-release` |
| Branch | `codex/android-2-1-connected-release` |
| Base/current HEAD | `13ca51a80d23220574deba762851fe5a32372e46` |
| Worktree state | Uncommitted implementation packet |
| Task ledger | 128 complete / 148 total / 20 open |
| External effects | No commit, push, PR, Supabase deployment, Google-console mutation, AAB upload or rollout |

No production identifier, signing secret, Play versionCode or console state was
guessed. The release-equivalent APK is diagnostic evidence, not an uploadable
release artifact. Native `versionName`, package metadata, runtime `APP_VERSION`
and the retained Android production-web `version.json` now agree on 2.1.0; the
successful local build does not authorize or imply Web/PWA/iOS/Desktop
publication, upload signing or exact-AAB readiness.

## Implemented local scope

- Default-off Connected Records with explicit consent epoch, three safe
  deterministic planners, atomic primary intent, encrypted ledger, durable
  critical outbox, history, undo, forget-one and clear-all.
- Owner-fenced PostgreSQL RPCs with whole-batch CAS, permanent tombstones,
  authoritative revisions, ordered self/remote events, anti-resurrection fences
  and token-bound paged bootstrap.
- Dexie schema v11 account cleanup and forward-only rollback guard; journal
  password removal cannot orphan encrypted automation history.
- Android 16 predictive/back bridge, explicit modal ownership and a retained
  52-entry Back matrix; `HabitActionSheet` no longer allows Back to trigger its
  first action.
- Adaptive public entry behavior for phone portrait/landscape, `sw600dp`, a
  220dp freeform window, ar/he RTL, large text, reduced motion and public process
  death.
- Theme-aware native status/navigation chrome on API 36. A retained visual RED
  showed light cyan native bars behind light icons in dark mode; the current
  debug APK switches matching native edge backdrops and both icon modes, then
  restores the light palette without restart.
- A persistent, explicit V2 navigation action opens the existing encrypted
  history/undo sheet from phone drawer or desktop sidebar without auto-show;
  visual RED/GREEN review also removed an RTL title/close overlap.
- Rewarded-only `optional_rewards` ads: UMP before GMA, default-deny zone and
  entitlement gates, conservative mood suppression, exact server-metadata
  entitlement behind admitted-owner checks, durable owner-bound exactly-once
  settlement, strict persisted cooldown/cap and reachable privacy withdrawal.
  Malformed same-day cap state now fails closed.
- Android target/compile 36, min 26, R8/resource shrinking, FULL symbols and a
  generated 3,464-line Baseline/Startup Profile packaged in a release-equivalent
  APK.
- Journal sync events and diagnostic transports are metadata-only/fixed-code;
  the unsafe random gratitude projection remains disabled.
- Android ordinary taps no longer create an eager ambient-audio player. The
  exact benchmarkRelease APK retained a 9 -> 9 ZenFlow player count after 32
  theme taps and reported zero current-process audio/AudioFlinger rows; actual
  playback controls still own direct audio unlock.

`habit.to-planning.v1` is intentionally inaccessible. The current planning
model is a user-owned schedule array and has no approved event-level ownership,
completion or CAS contract. Inventing one could overwrite newer user planning.

## Fresh evidence ledger

| Check | Result | Boundary |
|---|---|---|
| Full Vitest coverage | `PASS` inside the fresh exit-`0` `ci:preflight`; the immediately preceding full RED run had 9,468 passing, 3 failing and 7 todo, and the repaired exact slice then passed 33/33 | The PTY truncated the final per-test summary; local tests only |
| TypeScript / ESLint | `PASS` / `PASS`, zero warnings | Current source |
| Sync contract | `PASS`: 409 invariants | Static/local contract |
| Production-data-integrity | `PASS`: bundle scan covered 2,442 artifacts, 826 production-reachable | Does not deploy SQL |
| Production build | `PASS`; main chunk 885.17 kB and seven non-English locale assets emitted separately | Exact AAB absent |
| Playwright critical routes | `PASS`: 21/21 | Local Chromium |
| Android native tests | `PASS`: 8 JVM + 4 API-36 instrumentation | Public/non-auth scope |
| Android release config | `PASS` | Does not prove signing or Play state |
| Visual evidence | `PASS` for named public configurations, local phone/desktop/Hebrew V2 history entry, API-36 light/dark RTL system bars and the exact post-audio-fix benchmarkRelease light-English/dark-Ukrainian entry frames; hash-bound RED/GREEN captures retained | Authenticated history rows, motion, physical devices and human acceptance absent |
| Browser performance | `PASS`: 14 routes, no console/request errors or blocking long-animation frames | Production preview, not native |
| Native frame diagnostics | `FAIL`: the newest exact benchmarkRelease run completes 10/10 iterations but reports CPU P95 77.51 ms and overrun P95 87.91 ms, both above the 32 ms gate. The earlier locale-neutral run reported CPU P95 39.78 ms and three `gfxinfo` runs reported 2.10–2.45% modern jank | AndroidX labels the emulator non-representative; representative physical/private traces remain absent |
| Baseline Profile | `PASS`: 3,464 generated lines and packaged profile assets | Exact-AAB inspection absent |
| Ratchet | `PASS`: quality 9.4/10, zero violations; total JS 3,788 KiB / max 5,062 KiB | 70 warning/no-measurement items remain advisory; local evidence only |
| npm audit / Snyk | npm audit previously passed; a fresh tracked-copy Snyk Code scan of the changed production audio file reports 0 issues | The fresh scan is deliberately narrow; broader historical Snyk closure remains `UNVERIFIED` |
| Supabase type freshness | `FAIL` | No authenticated canonical generator was available |
| AdMob/Play production readiness | `PARTIAL`, release `STOP` | Owner-authenticated read-only evidence proves AdMob app/unit readiness, published `en`/`en-US` privacy-message assignment and Play artifact/declaration state; supported-locale message coverage, `app-ads.txt` request/crawl, corrected Play content, exact signed-AAB binding and upload authority remain absent |
| Rewarded-ad safety regressions | `PASS`: 13 files, 109 tests; entitlement hook 6/6 | Local mocks/contracts only; no production metadata population, live inventory or production traffic |
| Automation outbox cold start | `PASS`: 3 files, 78 tests | Durable-store/module-reload characterization; T146 separately covers local Android process death |
| Automation undo tombstones | `PASS`: 4 files, 33 tests | Local/remote/SQL contract; Supabase migration remains undeployed |
| Pure planner composition | `PASS`: 3 files, 20 tests | Fourth eligible-rule diff remains blocked by the planning ownership decision |
| Repository idempotency | `PASS`: 6 files, 31 tests | Local Dexie/typed-cloud boundary; no live multi-device claim |
| Repository owner/vault races | `PASS`: focused RED 3 failed / 3 passed, then 6/6 GREEN; 12 files, 103 tests | Local owner/account-generation/vault boundary; live Supabase remains unverified |
| Automation-history privacy | `PASS`: focused RED 2 failed / 3 passed, then 5/5 GREEN; 11 files, 146 tests | Local crypto/backup/purge/event boundary; T146 separately covers local PWA/Android lifecycle |
| Installed-PWA / Android lifecycle | `PASS`: Chrome 151 actual PWA install plus A-to-B production service-worker update/relaunch; API-36 WebView force-stop PID 21288 -> 21524; adjacent slice 162/162 | Exact synthetic keys and cleanup only; authenticated cloud, public deploy, iOS PWA, physical device and production-user behavior unverified |
| Connected-record copy / RTL | `PASS`: 20/20 focused tests, 8 locales x 3,631 keys, production-rendered Arabic/Hebrew at 390 x 844 with zero horizontal overflow and zero console messages | Agent visual/linguistic review only; native-speaker and cultural acceptance unverified |

Release-equivalent APK evidence:

- path: `android/app/build/outputs/apk/nonMinifiedRelease/app-nonMinifiedRelease.apk`
- size: `29,196,422` bytes
- SHA-256: `f68eaf40208099f6fe06d17fc8afd5db275ff2c578fd9ed841de0c86812d831f`

Latest post-audio-fix benchmarkRelease APK evidence:

- path: `android/app/build/outputs/apk/benchmarkRelease/app-benchmarkRelease.apk`
- size: `25,455,062` bytes
- SHA-256: `41e296dcb956207bcc084cb351f7be2e23a735d36eb3c3e3e1fcfff5cddd2281`

Retained evidence manifests:

- `docs/release/android-2.1-runtime-evidence.json`
- `docs/release/android-2.1-visual-evidence.json`
- `docs/release/android-2.1-performance-evidence.json`
- `docs/release/android-2.1-back-matrix.json`
- `docs/release/ANDROID_2_1_RUNBOOK.md`

## Platform status

| Platform | Status | Evidence boundary |
|---|---|---|
| Web/Vite | `PASS` locally | Build, browser flows and production-preview performance passed; authenticated cloud behavior remains unverified |
| Installed PWA | `PARTIAL`; T146 lifecycle `PASS` | Actual local install, standalone A-to-B update and relaunch pass; authenticated cloud, offline/public deployment and iOS PWA remain unverified |
| Android/Capacitor | `PARTIAL`, release `STOP` | Public API-36 runtime/visual/back evidence exists; native frames fail and exact signed AAB/private/physical evidence is absent |
| iOS/WKWebView | `UNVERIFIED` | Shared TypeScript/fail-closed fallbacks compile; no fresh iOS runtime/build evidence |
| Desktop/Tauri | `UNVERIFIED` | Shared browser routes ran; no Tauri package/runtime evidence |
| Store/Release | `STOP` | Play maximum versionCode 34 is verified and local Android uses 35; signing/certificate state, all declarations, eight store locales and both AdMob privacy-message assignments were inspected read-only, but owner upload signing, exact-AAB binding, complete consent-language coverage, `app-ads.txt` request/crawl, accurate app access, candidate-aligned health/alarm declarations, corrected localized copy/assets and promotion authority remain absent |

## Remaining blockers

1. Diagnose and meet native frame budgets on representative physical Android;
   rerun public and signed-in critical journeys without emulator suppression.
2. Rehearse the migration in an authorized non-production project and regenerate
   `src/types/supabase.ts` through the canonical generator.
3. Approve an event-level planning ownership/completion contract before enabling
   the fourth connected-record rule.
4. At an explicitly authorized exact-AAB checkpoint, correct app access for
   OAuth/signed-in review paths; reconcile Health Connect/exact-alarm and Data
   safety declarations; replace contradictory ar/he/ja copy and legacy phone
   screenshots; review health/alarm/yoga/fitness tags; provide owner
   upload-signing input; re-query the Play maximum immediately before the build;
   then build and inspect the exact signed AAB once. Local 2.1.0 metadata is
   already synchronized and protected by the Android release checker.
5. At an explicitly authorized AdMob checkpoint, add and native-review the
   supported ZenFlow consent-message languages, obtain fresh `app-ads.txt`
   request/crawl proof, then bind the already verified production identifiers
   and published messages to the exact rebuilt AAB. Do not claim `ar`/`he`
   European-message support when AdMob does not list those languages.
6. Name the authenticated incident operator and alert route, then finish private
   signed-in PWA/Android, PWA-offline, physical-device,
   split/foldable, predictive-cancellation, OAuth/IME, TalkBack traversal,
   translation and human artistic acceptance evidence.
8. Name the incident operator and stage windows before any rollout. The twelve
   historical secret candidates are now value-free triaged with exact-only
   suppressions and fresh Gitleaks/TruffleHog proof.
9. Obtain explicit authorization before commit/push/PR, migration deployment,
   account reactivation, AAB upload or staged 10% -> 50% -> 100% promotion.

## Recovery contract

- Before any schema-v11 distribution, this lane can be reviewed or abandoned
  without changing `main` or production.
- Connected Records and the ad service gate fail closed.
- After any v11-capable binary is distributed, a v10-unaware rollback is
  forbidden; recovery requires a v11-aware replacement or kill switch.
- The same signed AAB must move through internal, 10%, 50% and 100% stages; any
  health-gate failure halts promotion.

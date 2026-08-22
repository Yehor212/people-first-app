# Quickstart: Android 2.1 Connected Release

> **HISTORICAL / DO NOT EXECUTE AS CURRENT RUNBOOK:** the recovery lane is dirty and implementation/upload/deploy are not authorized. Use `plan.md`, `tasks.md`, `owner-external-gates.md` and `release-feasibility.md`; ads/public social remain OFF.

## Safe lane

```bash
cd /Users/yehor/Projects/ZenFlow/worktrees/codex-android-2-1-connected-release
npm run agent:workspace -- doctor --mode edit --agent codex --json
git status --short --branch
```

Expected branch is `codex/android-2-1-connected-release`, locked to the Codex actor. Do not edit from review `main` or the legacy dated checkout.

## Context and Spec Kit

```bash
npm run rag:preflight -- "Android 2.1 connected records encrypted undo Android 16 predictive back rewarded AdMob release"
.specify/scripts/bash/check-zenflow-constitution-status.sh --json
.specify/scripts/bash/check-prerequisites.sh --json --require-tasks --include-tasks
```

The constitution is proposal-only. Complete requirement checklists and cross-artifact analysis before running implementation tasks.

## RED→GREEN loop

For each behavior task:

1. Name the exact behavior and risk in `.preflight-token`.
2. Add the smallest behavioral test.
3. Run the focused test and retain the expected failure.
4. Change only the scoped production files.
5. Rerun the same test green and then the listed blast-radius checks.
6. Update `tasks.md` only when fresh evidence exists.

Example focused commands are recorded beside each task; broad default is sequential Vitest when parallelism is flaky:

```bash
npm test -- --maxWorkers=1 src/features/automation/__tests__
npm test -- --maxWorkers=1
npm run typecheck
npx eslint . --max-warnings=0
```

## Android loop

```bash
npm run build
npx cap sync android
cd android
./gradlew :app:assembleDebug :app:testDebugUnitTest
./gradlew :app:bundleRelease
```

Use the repository's configured API 36 emulator for gesture and three-button navigation, window resize/rotation and accessibility checks. Development ads must use Google's rewarded test unit only. Do not place a demo ID in release configuration.

## Entry storage incident and reflow loop

Retain the user's API-36 Hebrew screenshot as the legacy baseline, but reproduce from the dedicated emulator's clean app profile before attributing the IndexedDB timeout. The 2026-08-09 fresh-install/cleared-profile observation did not emit the timeout in 40 seconds; it is a negative control, not proof that the retained-state trigger is fixed. Capture fixed-code storage phase/deadline/recovery evidence, WebView/app process state, and a screenshot together; never retain database keys, owner IDs, exception text or user records.

Run the new focused RED before production edits, then the identical command GREEN:

```bash
npm test -- src/components/__tests__/StorageIncidentBanner.reflow.test.tsx src/hooks/__tests__/useIndexedDB.timeoutDiagnostics.test.tsx --maxWorkers=1
npm run typecheck
npx eslint src/components/StorageErrorBanner.tsx src/components/StorageIncidentBanner.tsx src/components/storageErrorIncidentState.ts src/hooks/useIndexedDB.ts --max-warnings=0
```

The retained browser proof covers the real AuthScreen at 320 CSS pixels and 200% text in `en`, `es`, `de`, `ar`, and `he`; the focused suite also covers dynamic-height and reduced-motion contracts. The API-36 instrumentation traverses the clean Hebrew entry flow, injects only the strict fixed-code signal, asserts panel→incident→footer geometry, RTL, zero horizontal overflow and a 48dp dismiss target, then retains `output/android21/t151-entry-storage/native-api36/hebrew-storage-incident.png`. Landscape/split window, IME, all-eight-locale visual runtime and signed-in private routes remain separate matrix rows until exercised.

After the entry defect is GREEN, generate the production-reachable fixed-overlay and data-grid inventory. Add one separate RED for each additional reproduced clipping failure; do not apply global overflow hiding or bulk class replacement. Android emulator proof does not prove iOS/WKWebView, Desktop/Tauri, physical devices, signed-in private routes, or human assistive-technology acceptance.

For the first-run language grid, preserve both retained failure phases and rerun
the exact final 32-state matrix plus the inventory validator:

```bash
REFLOW_PHASE=green npx --no-install playwright test --config=e2e/helpers/language-selector-reflow/playwright.config.ts
REFLOW_PHASE=green npx --no-install playwright test --config=e2e/helpers/leaderboard-entry-row-reflow/playwright.config.ts
ZENFLOW_PLAYWRIGHT_USE_LOCAL_SERVER=true ZENFLOW_PLAYWRIGHT_LOCAL_PORT=8103 npx --no-install playwright test e2e/storage-incident-reflow.spec.ts --workers=1 --project=chromium
npm run check:android21-reflow-inventory
```

The language and leaderboard component matrices cover all eight locales at
narrow 200% text, short portrait, landscape and split-window widths. API-36
Chrome evidence is a native-frame component check only; it must not be
reported as an installed Capacitor APK, signed AAB or physical-device result.

## Social, destination, and invitation loop

The V2 shell keeps five destinations. The social path is Habits → Friends &
Challenges → selected challenge → participant leaderboard → invite controls;
the leaderboard is not a global table or sixth tab. Before production edits,
run the focused reachability/invitation tests from T154 and retain the RED that
the ordinary V2 entry is absent and code-only joining fabricates unknown data.

Manual input, HTTPS link and future QR/scanner input must use the same typed
zero-write parser and authoritative resolver. Do not install a QR/scanner
package or add a cloud RPC until the exact source/revision/license/platform
impact and server target are explicitly approved. Copy, Share and manual input
remain the required fallback on all platforms.

The completed component-only participant matrix is:

```bash
REFLOW_PHASE=green npx --no-install playwright test --config=e2e/helpers/participants-leaderboard-reflow/playwright.config.ts
```

It covers all eight locales across four configurations. It does not prove the
signed-in hub, canonical server participants, installed APK/PWA, links, camera
or physical-device craft.

## Five destinations × eight locales

Use exactly `en uk es de fr ja ar he`; never substitute an `en/ar/he` screenshot
sample for completion. For Orb, Habits, Diary, Planning and Settings record
entry, visible exit, nested LIFO, keyboard/Escape applicability, Android Back,
root delegation, retained committed state, 200% text, reduced motion, IME,
portrait, landscape/split and RTL/bidi. The orb is navigation/performance
regression-only and must not be visually redesigned.

## Non-orb motion loop

Start with the existing focused tests and add RED assertions for Framer props,
visible exit and cleanup before changing the effects:

```bash
npm test -- src/features/journal/__tests__/GratitudeBloomWidget.test.tsx src/features/journal/__tests__/BurnThoughtWidget.test.tsx --maxWorkers=1
npm run typecheck
npx eslint src/features/journal/GratitudeBloomWidget.tsx src/features/journal/BurnThoughtWidget.tsx src/features/journal/__tests__/GratitudeBloomWidget.test.tsx src/features/journal/__tests__/BurnThoughtWidget.test.tsx --max-warnings=0
```

Run normal and reduced paths in all eight locales. Native motion evidence uses
a production-equivalent, non-debuggable candidate and records raw frame data,
refresh rate, build/device/thermal state and video. The release rejection line
is frame-duration CPU P95 and frame-overrun P95 over 32ms or a reproducible
frozen frame over 700ms; representative physical-device proof is still
required. Technical checks and direct inspection do not manufacture human
artistic or motion-comfort approval.

## Legal and AdMob truth loop

Generate the candidate disclosure matrix before editing legal prose. Verify
public Privacy, Terms and deletion URLs/content hashes and every locale entry;
use an explicit reviewed-English fallback when an authoritative locale review
is absent. Never infer controller/address, jurisdiction, retention, lawful
basis, transfer mechanism or translation approval.

Keep rewarded-ad evidence layered:

```bash
npm run google-play:admob:release-config-check
npm run google-play:admob:check
npm run google-play:admob:ump-check
npm run google-play:admob:external-check
```

On 2026-08-11 the local API/config/UMP layers passed, but the authenticated
production function inventory lacked `rewarded-ads-gate`; that layer is `FAIL`
and blocks SDK loading by design. Do not deploy it, set its environment, change
AdMob/Play or create a replacement unit without explicit external-action
authorization. After authorization, verify gate state before Google test-unit
and test-device Ad Inspector requests. Live serving stays separate.

## Release stop line

Local source/build/emulator completion does not authorize console actions. Before any upload or AdMob change, bind the authenticated target account/app, current versionCode, signing state, console declarations and intended external action in a new owner checkpoint. Production remains `STOP` while any same-AAB, console, readiness, policy, physical-device or human approval item is missing.

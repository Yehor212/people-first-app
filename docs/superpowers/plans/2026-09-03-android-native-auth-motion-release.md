# Android Auth Return, Fade-Through, And Release Closure Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Return completed Telegram OAuth to the installed Android ZenFlow app, replace the jumpy theme swap with a bounded fade-through, and close the technical Google/audio/release gates without mock runtime data.

**Architecture:** Preserve the existing PKCE attempt-bound custom scheme and add its exact query-bearing shape to the hosted Supabase allow-list through a least-privilege main-only workflow. Use the same one-veil CSS fade-through on every platform; keep Android palette work bounded by suppressing only button color/shadow transitions during the atomic midpoint while retaining press transform/opacity feedback. Keep the existing ten-master single-player implementation and prove each external/release gate separately.

**Tech Stack:** React 18, TypeScript, Zustand, Supabase Auth, Capacitor 8 Browser/App APIs, Android API 36, Vitest, GitHub Actions, Android MCP, ADB, CDP, Perfetto FrameTimeline, `gfxinfo`.

**Spec:** `docs/superpowers/specs/2026-09-03-android-native-auth-motion-release-design.md`

## Global Constraints

- Use only the existing locked `codex/japanese-audio-theme-transition-20260902` lane; create no branch, clone, worktree, or subagent.
- Keep PKCE attempt ownership, trusted callback validation, account-boundary admission, and secret/PII redaction.
- Production runtime contains no mock, demo, sample, placeholder, hardcoded, synthetic, canned, or fallback business records.
- Preserve all canonical `ValenceOrb` and `MiniValenceOrb` pixels, motion density, render tiers, and accepted route layouts.
- Theme motion animates one pointer-transparent CSS veil's opacity only, respects reduced motion, and settles within 300 ms. Rejected native overlay candidates stay absent from production.
- Android acceptance uses the exact local/installed APK hash and semantic emulator interaction; screenshots alone are insufficient.
- Technical audio evidence cannot become artistic approval. Google debug evidence cannot become upload/Play evidence.
- Google Play destination is Internal testing only; Production remains out of scope.

---

### Task 1: Native OAuth Redirect Admission Contract

**Files:**
- Modify: `scripts/check-journal-magic-link-live.cjs`
- Modify: `scripts/apply-supabase-auth-redirect-allow-list.cjs`
- Modify: `scripts/check-auth-providers.cjs`
- Modify: `scripts/__tests__/supabase-auth-redirect-allow-list.test.ts`
- Modify: `scripts/__tests__/auth-providers-readiness.test.ts`
- Modify: `supabase/config.toml`
- Modify: `docs/auth-facebook-telegram-setup.md`

**Interfaces:**
- Produces: `REQUIRED_NATIVE_OAUTH_REDIRECT_URLS` and `HOSTED_NATIVE_OAUTH_REDIRECT_ALLOW_LIST_URLS` containing only the attempt-bound native callback contract.
- Consumes: the existing `PKCE_ATTEMPT_PARAM = "zenflowAuthAttempt"` contract and merge-preserving hosted Auth patcher.

- [ ] **Step 1: Write the failing allow-list tests**

```ts
expect(HOSTED_NATIVE_OAUTH_REDIRECT_ALLOW_LIST_URLS).toEqual([
  "com.zenflow.app://login-callback?zenflowAuthAttempt=*",
]);
expect(urls).toContain("com.zenflow.app://login-callback?zenflowAuthAttempt=*");
expect(urls).toContain(existingUnrelatedRedirect);
```

- [ ] **Step 2: Run RED**

Run:

```bash
npx vitest run scripts/__tests__/supabase-auth-redirect-allow-list.test.ts scripts/__tests__/auth-providers-readiness.test.ts
```

Expected: FAIL because no attempt-bound native OAuth allow-list constant or patch exists.

- [ ] **Step 3: Implement the narrow merged contract**

Add the exact local and hosted pattern, merge it with current URLs, keep the
plain and journal callbacks, and update the live apply readback to reject a
missing attempt-bound pattern.

- [ ] **Step 4: Run GREEN and static blast radius**

Run the RED command again, followed by:

```bash
npm run check:auth-providers -- --strict
npm run check:telegram-oidc-live
npm run check:production-data-integrity:diff
```

---

### Task 2: Approval-Gated Hosted Supabase Apply

**Files:**
- Create: `.github/workflows/supabase-native-auth-redirect.yml`
- Create: `scripts/__tests__/supabase-native-auth-redirect-workflow.test.ts`
- Modify: `package.json`

**Interfaces:**
- Consumes: repository secret `SUPABASE_ACCESS_TOKEN`, variable `SUPABASE_PROJECT_REF`, and `npm run apply:supabase-auth-redirect-allow-list`.
- Produces: a main-only workflow receipt showing validation, patch application, and readback without emitting the redirect inventory or secrets.

- [ ] **Step 1: Write the failing workflow contract**

```ts
expect(workflow).toContain("workflow_dispatch:");
expect(workflow).toContain("refs/heads/main");
expect(workflow).toContain("APPLY_NATIVE_AUTH_REDIRECT");
expect(workflow).toContain("permissions:\n  contents: read");
expect(workflow).toContain("npm run apply:supabase-auth-redirect-allow-list");
expect(workflow).not.toContain("pull_request_target");
```

- [ ] **Step 2: Run RED**

```bash
npx vitest run scripts/__tests__/supabase-native-auth-redirect-workflow.test.ts
```

Expected: FAIL because the dedicated workflow does not exist.

- [ ] **Step 3: Add the main-only least-privilege workflow and register its test**

The workflow validates the exact phrase before checkout or secret use, runs the
dry-run and apply commands, and relies on the script's post-PATCH readback.

- [ ] **Step 4: Run GREEN, workflow security checks, and the security suite**

```bash
npx vitest run scripts/__tests__/supabase-native-auth-redirect-workflow.test.ts scripts/__tests__/supabase-auth-redirect-allow-list.test.ts
/Users/yehor/.codex/bin/codex-security-suite.sh quick .
```

Do not dispatch until the workflow is merged to `main` and its exact target is
revalidated.

---

### Task 3: Two-Phase Android Fade-Through

**Files:**
- Modify: `src/lib/__tests__/themeTransition.test.ts`
- Modify: `src/styles/__tests__/themeTransition.test.ts`
- Modify: `src/stores/__tests__/themeStore.test.ts`
- Modify: `src/components/navigation-v2/__tests__/ThemeToggleV2.test.tsx`
- Modify: `src/lib/themeTransition.ts`
- Modify: `src/stores/themeStore.ts`
- Modify: `src/index.css`

**Interfaces:**
- Produces: `runThemeTransition(commit: () => void): ThemeTransitionHandle` with synchronous reduced-motion commit, latest-request cancellation, bounded enter/release phases, and idempotent cleanup.
- Consumes: persisted theme preference, atomic `applyToDOM`, Android drawer blur-release nodes, and existing status-bar scheduling.

- [ ] **Step 1: Write failing phase and store tests**

```ts
const commits: string[] = [];
const transition = runThemeTransition(() => commits.push("ink"));
expect(commits).toEqual([]);
expect(veil).toHaveAttribute("data-theme-transition-phase", "enter");
fireTransitionEnd(veil, "opacity");
expect(commits).toEqual(["ink"]);
expect(veil).toHaveAttribute("data-theme-transition-phase", "release");
```

Add tests for reduced motion, timeout fallback, persistence failure, rapid
paper→ink→paper requests, cancellation before midpoint, duplicate
`transitionend`, cleanup, and Android drawer temporary classes.

- [ ] **Step 2: Run RED**

```bash
npx vitest run src/lib/__tests__/themeTransition.test.ts src/styles/__tests__/themeTransition.test.ts src/stores/__tests__/themeStore.test.ts src/components/navigation-v2/__tests__/ThemeToggleV2.test.tsx
```

Expected: FAIL because the current coordinator commits immediately and has no
enter/midpoint phase.

- [ ] **Step 3: Implement the minimal phase coordinator and CSS**

Use one requestAnimationFrame, `transitionend` filtered to `opacity`, one bounded
enter fallback, one release cleanup fallback, and a single active handle. Keep
the veil background bound to the outgoing computed token through both phases.

- [ ] **Step 4: Route store commits through the midpoint**

Persist and publish requested preference immediately, but update
`appliedTheme`, DOM attributes, customization tokens, and system-bar scheduling
only through the latest transition's commit callback. Reduced motion remains
synchronous.

- [ ] **Step 5: Run GREEN and visual/static guards**

```bash
npx vitest run src/lib/__tests__/themeTransition.test.ts src/styles/__tests__/themeTransition.test.ts src/stores/__tests__/themeStore.test.ts src/components/navigation-v2/__tests__/ThemeToggleV2.test.tsx
npm run check:canonical-orbs
npm run check:visual
npm run check:no-ai-templates
```

---

### Task 3B: Rejected Android Native Theme Compositor Boundary

**Files:**
- Create: `src/lib/nativeThemeTransition.ts`
- Create: `src/lib/__tests__/nativeThemeTransition.test.ts`
- Modify: `src/lib/__tests__/themeTransition.test.ts`
- Modify: `src/lib/themeTransition.ts`
- Create: `android/app/src/main/java/com/zenflow/app/NativeThemeTransitionPlugin.java`
- Create: `android/app/src/test/java/com/zenflow/app/NativeThemeTransitionContractTest.java`
- Modify: `android/app/src/main/java/com/zenflow/app/MainActivity.java`

**Interfaces:**
- Produces: `NativeThemeTransition.cover`, `reveal`, and `cancel` with one
  generation, bounded readiness fallback, and unconditional WebView restoration.
- Consumes: the outgoing opaque body background, the existing latest-request
  coordinator, `WebView.postVisualStateCallback`, and Material cubic curves.

- [x] **Step 1: Write the failing bridge and coordinator behavior tests**

Cover Android-native sequencing, opaque CSS color normalization, latest-request
cancellation, bridge rejection fallback, reduced motion, and the absence of a
DOM veil on the native path. Each expectation names a user-visible break rather
than merely grepping Java source.

- [x] **Step 2: Run RED**

```bash
npx vitest run src/lib/__tests__/nativeThemeTransition.test.ts src/lib/__tests__/themeTransition.test.ts
```

Expected: FAIL because the native bridge and Android path do not exist.

- [x] **Step 3: Add the native contract test and run RED**

```bash
(cd android && ./gradlew testDebugUnitTest --tests com.zenflow.app.NativeThemeTransitionContractTest --console=plain)
```

Expected: FAIL because the native timing/color/request contract does not exist.

- [x] **Step 4: Implement the smallest native boundary**

Add one local plugin, register it before `BridgeActivity.onCreate`, validate
color/duration inputs, cover on the UI thread, suppress only WebView drawing
after opacity reaches one, restore it before the visual-state wait, and remove
the overlay on every completion/cancel/error path. Do not add a dependency,
bitmap snapshot, extra render engine, or steady-state style change.

- [x] **Step 5: Run GREEN and native compile checks**

```bash
npx vitest run src/lib/__tests__/nativeThemeTransition.test.ts src/lib/__tests__/themeTransition.test.ts src/styles/__tests__/themeTransition.test.ts src/stores/__tests__/themeStore.test.ts src/components/navigation-v2/__tests__/ThemeToggleV2.test.tsx
(cd android && ./gradlew testDebugUnitTest assembleDebug --console=plain)
npm run typecheck
npm run lint
```

- [x] **Step 6: Reject by runtime evidence**

Exact APK runs retained long `WebViewFunctor::drawGl` waits and tile pressure
for the visibility, always-visible, and no-forced-layer variants. The native
plugin, bridge, registration, and tests were removed from the selected source.

---

### Task 3C: Rejected Separate-Window Theme Surface

**Files:**
- Modify: `android/app/src/main/java/com/zenflow/app/NativeThemeTransitionPlugin.java`
- Modify: `android/app/src/test/java/com/zenflow/app/NativeThemeTransitionContractTest.java`
- Modify: `src/styles/__tests__/themeTransition.test.ts`
- Modify: `src/index.css`

**Root-cause evidence:**
- The scoped child-decor candidate `bb28b11c` still produced 32 presentation
  gaps over 100 ms and 383 tile warnings.
- Long slices show Activity `traversal`/`draw-VRI` blocked in `postAndWait` on
  RenderThread `WebViewFunctor::drawGl` for repeated full 1080x2400 draws.

- [x] **Step 1: Preserve the failing runtime characterization**

Retain `perfetto-theme-run1.pftrace`, its summary, `gfxinfo`, and logcat under
the exact APK directory. This is the pre-code RED for a platform surface change
that local JVM tests cannot faithfully render.

- [x] **Step 2: Test one separate app window**

Use a `PopupWindow`/application panel with match-parent dimensions,
`touchable=false`, `focusable=false`, no framework enter/exit transition, no
bitmap, no WebView visibility change, and no child insertion into Activity
decor. Keep the existing color validation, request generation, visual-state
wait, bounded fallback, and lifecycle cleanup.

- [x] **Step 3: Run focused GREEN and compile**

```bash
npx vitest run src/lib/__tests__/nativeThemeTransition.test.ts src/lib/__tests__/themeTransition.test.ts src/styles/__tests__/themeTransition.test.ts
(cd android && ./gradlew testDebugUnitTest assembleDebug --console=plain)
```

- [x] **Step 4: Reject after the first exact-APK run**

Install through Android MCP, compare source and installed hashes, record one
continuous ten-round-trip video, and run one CDP-off Perfetto/gfxinfo cycle. Stop
if the separate surface fails to materially reduce visible gaps and tile-memory
pressure or changes pixels, focus, touch, safe areas, or system bars. Only a
passing first run earns two confirmation runs.

The first run regressed frame gaps and jank and retained tile warnings. The
separate-window source and tests were removed; no confirmation runs were earned.

---

### Task 3D: Accurate Frame Gate And Narrow Button Palette Suppression

**Files:**
- Modify: `scripts/android-motion/evidence-lib.mjs`
- Modify: `scripts/__tests__/android-motion-evidence.test.ts`
- Modify: `src/styles/__tests__/themeTransition.test.ts`
- Modify: `src/index.css`

**Interfaces:**
- Produces: distinct `framesOver103Ms` and
  `presentationTimestampGapsOver100Ms` report fields.
- Preserves: button transform/opacity feedback, backdrop animations, canonical
  Orb rendering, layout, focus, input, and steady-state CSS.

- [x] **Step 1: Write and observe the metric RED**

Require the package-scoped FrameTimeline query to count `dur > 103000000`
separately and reject the ambiguous old timestamp-gap alias.

- [x] **Step 2: Implement and run the metric GREEN**

The retained `8df60b23` trace re-analyzes to 58 actual rows over 103 ms and 25
timestamp gaps, proving that the fields cannot substitute for one another.

- [x] **Step 3: Capture the runtime animation fan-out**

The Settings midpoint probe measured about 140 active animations: 124 belonged
to buttons/theme choices and the remainder to the accepted ambient backdrops.

- [x] **Step 4: Run a no-source A/B and write the CSS RED**

Inject only `html.theme-transition-palette-atomic button`, verify that palette
transitions disappear while press transform feedback remains, and require that
selector in the CSS contract before production editing.

- [x] **Step 5: Implement the minimal CSS GREEN**

Allow only `transform, opacity` on buttons during the atomic handoff. Do not use
the universal descendant selector or stop CSS `animation` tracks.

- [x] **Step 6: Rebuild and accept the technical motion path with exact-APK evidence**

Build/install the current source, compare APK and installed hashes, capture
continuous video and three CDP-off Perfetto/`gfxinfo` cycles, and keep motion
`FAIL` if any action-window visual gap over 103 ms, blank/partial frame,
tile/context/ANR/crash signal, or visual regression remains.

Exact APK `c06f6b23...` matched installed `base.apk`. Three runs reported zero
FrameTimeline rows over 103 ms, maxima 87.48/102.34/100.23 ms, p95
23.18/24.45/23.12 ms, and zero tile/crash/ANR/context-loss signals. The
continuous video/contact sheet shows no partial or mixed-palette frame. Human
motion/artistic review of the exact MP4 remains separate and `UNVERIFIED`.

---

### Task 4: Exact APK Android Runtime Proof

**Files:**
- Produce: `output/android-final/<apk-hash>/ZenFlow-<version>-debug.apk`
- Produce: sanitized Telegram/Google route receipts, continuous theme video,
  `gfxinfo`, logcat, and Perfetto trace under the same hash-bound folder
- Modify: `specs/003-japanese-audio-theme/quickstart.md`
- Modify: `specs/003-japanese-audio-theme/tasks.md`

**Interfaces:**
- Consumes: final web bundle, Capacitor sync, Android debug assembly, hosted
  Supabase patch after merge, and real authorized provider accounts.
- Produces: exact source/APK/install identity plus runtime results that separate
  auth initiation, callback, session, destination, visual, and frame gates.

- [ ] **Step 1: Build, install, and bind identity**

```bash
npm run build
npx cap sync android
(cd android && ./gradlew assembleDebug --console=plain)
adb -s emulator-5554 install -r android/app/build/outputs/apk/debug/app-debug.apk
```

Hash the source APK and pulled installed `base.apk`; reject the run unless they
match.

- [ ] **Step 2: Run Android MCP surface checks**

Exercise account entry, music icon, all five V2 routes, Settings account and
appearance panels, light/dark/OLED/system choices, drawer/back, safe areas,
scroll/reflow, accessibility labels, and lifecycle pause/resume.

- [ ] **Step 3: Run three motion evidence cycles**

Record ten light/dark round trips in one uninterrupted emulator-window video.
Separately capture three CDP-off Perfetto/`gfxinfo` runs aligned to the same
semantic controls. Reject any run with a presentation gap over 103 ms, missing
content, tile-memory/context-loss, ANR, crash, or a changed APK identity.

- [ ] **Step 4: Apply hosted redirect after merged main and prove auth**

Dispatch the dedicated main workflow, verify its exact run, then perform
Telegram warm and cold callbacks plus Google native sign-in. Confirm the final
focused activity is `com.zenflow.app/.MainActivity`, the Custom Tab closes, the
session is admitted to the correct local owner, and the V2 shell is interactive.

---

### Task 5: Ten-Master, Cross-Platform, Security, Main, And Play Closure

**Files:**
- Modify only evidence/status sections in: `docs/audio/zenflow-evening-collection-review.json`
- Modify: `CHANGELOG.md`
- Modify: `docs/release/google-play/GOOGLE_PLAY_LOCALIZED_LISTING_PACKET.json`
- Produce: final signed Android artifacts only when signing identity is available

**Interfaces:**
- Consumes: the existing ten-master catalog/provenance/player, final source
  tree, owner hash decisions, upload key, Play console version/certificate, and
  required GitHub checks.
- Produces: exact reviewed hashes, main commit, signed artifact receipt, and at
  most an Internal testing draft/release.

- [ ] **Step 1: Re-run technical audio gates and emulator output**

```bash
npm run check:app-audio
npm run check:hyperfocus-audio
npx vitest run src/hooks/__tests__/useAppBackgroundMusic.test.tsx src/components/navigation-v2/__tests__/AppBackgroundMusicProvider.test.tsx src/components/navigation-v2/__tests__/BackgroundMusicToggle.test.tsx
```

Verify first-run silence, one player, current+next cache admission, master mute,
comfort policy, interruptions, foreground/background, auth continuity, and
non-silent device output. Do not change `PENDING` human rows.

- [ ] **Step 2: Run the full final tree gates**

```bash
npm run typecheck
npm run lint
npm test -- --maxWorkers=2
npm run check:all
npm run check:production-data-integrity
npm run check:production-data-integrity:diff
npm run build
npm run check:production-data-integrity:bundle
npm run cap:sync:ios
npm run check:release-artifacts:android
npm run check:task-completion
```

Add iOS simulator build, Desktop/Tauri checks, Play listing/privacy/AdMob checks,
and the security suite where available. Missing platform proof stays
`UNVERIFIED`.

- [ ] **Step 3: Obtain exact-hash owner audio decisions**

Present all ten files and SHA-256 values. Record only explicit approve/reject
decisions for the exact hashes. Any `PENDING` or rejected master blocks Play
upload but not an honest code PR.

- [ ] **Step 4: Resolve commit protocol and merge through main**

Read `memory/feedback_commit_pipeline_knowledge.md`. If it remains absent, stop
before `git commit` until the owner supplies it or explicitly waives that exact
instruction. Then stage only scoped files, run separate TypeScript and Vitest
checks, commit with a single-quoted message containing `batch`, push the same
branch, obtain `handoff --json` GO, open the PR, wait for exact-tip checks, and
merge. Verify local and remote `main` equality before removing the lane.

- [ ] **Step 5: Close Google Play gates without substituting identity**

Inspect the current maximum versionCode and upload certificate, verify the
Google Web/upload/Play OAuth clients belong to the same project and exact signer
SHA-1 values, increment versionCode only if required, and build the release AAB
with the existing authorized upload key. If the key is unavailable, keep this
step `UNVERIFIED` and do not generate a replacement key.

- [ ] **Step 6: Upload only to Internal testing**

Verify AAB hash, signer, manifest, package, version, asset inventory, and no-mock
bundle scan. Upload only to Internal testing and stop before rollout unless the
owner gives action-time confirmation for the exact artifact and track.

---

### Task 6: Android Developer Verification Deadline

**External systems:**
- Inspect: Play Console Home and Android developer verification pages
- Inspect: developer identity, package registration, and registered-key states
- Produce only if required: one temporary ownership-verification APK containing
  the Console-provided `adi-registration.properties` snippet

**Interfaces:**
- Consumes: the verified Play owner session, `com.zenflow.app`, the eligible
  certificate list supplied by Play, and an existing matching private key.
- Produces: a sanitized receipt that identifies status by key role without
  exposing private keys, passwords, account identifiers, or the verification
  snippet.

- [ ] **Step 1: Inspect before changing anything**

Confirm developer identity verification, the package-name state, all draft
registrations, and the registered Play App Signing certificate. Do not infer a
ZenFlow failure from the bulk reminder email.

- [ ] **Step 2: Build a role-separated key inventory**

Record only certificate SHA-256 fingerprints and roles: local debug, upload,
Play App Signing, and any key proven to sign an artifact distributed outside
Play. A debug or upload-only key is not an off-Play distribution key merely
because it can sign an APK.

- [ ] **Step 3: Complete only the missing registration path**

If Play already reports `REGISTERED`, make no registration write. If manual
ownership proof is required, use Play's exact eligible key and account-bound
snippet, create a dedicated verification APK, sign it with the matching existing
private key, verify its signature/content, and upload it only to the Android
developer verification flow. Never invent or replace a key.

- [ ] **Step 4: Prove cleanup and final state**

Confirm the package/key state in Play Console, ensure the private snippet is not
in git or any release asset, and record a sanitized receipt. Keep this receipt
separate from Internal testing upload and rollout evidence.

- [ ] **Step 5: Release the product update only after all gates**

Build the signed AAB from exact merged `main`, compare signer/package/version and
no-mock inventory, upload to Internal testing, and stop before rollout unless
the owner confirms the exact artifact and track at action time.

## Plan Self-Review

- Every explicit auth, motion, audio, no-mock, main, Android developer
  verification, and Play release requirement maps to a task.
- Types and interfaces are defined before consumers.
- No task authorizes a new branch, dependency, provider, data migration,
  canonical visual change, or production rollout.
- Every behavior change starts with a focused failing test or the already
  captured exact Android characterization.
- Hosted configuration, real accounts, human audio judgment, signing identity,
  package/key registration, CI, upload, and store rollout remain separate
  evidence gates.

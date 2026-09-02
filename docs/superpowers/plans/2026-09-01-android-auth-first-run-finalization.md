# Android Auth And First-Run Finalization Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Produce and verify one latest-main Android APK whose real auth/sign-out flows reach V2 without Firebase crashes or first-run walkthroughs, while preserving account privacy, multi-device push ownership, canonical visuals, and production-data provenance.

**Architecture:** Split ordinary current-session push cleanup from strict cross-account cleanup, add a least-privilege install-scoped Supabase RPC, and convert missing-Firebase native failures into a typed plugin rejection. Remove the module/notification entry gates while retaining compatibility persistence, then perform exact-artifact Android auth, UI, visual, and motion verification.

**Tech Stack:** React 18, TypeScript, Vitest/Testing Library, Capacitor 8, Java, patch-package, Supabase/Postgres RLS, Gradle, adb/UIAutomator, Android Emulator, gfxinfo, Perfetto.

**Spec:** `docs/superpowers/specs/2026-09-01-android-auth-first-run-finalization-design.md`

## Global Constraints

- Work only in the existing `main`; no branch, clone, worktree, or subagent.
- Do not commit, push, deploy the app, upload an APK/AAB, or publish artifacts without separate authorization.
- Do not introduce a paid API, new production dependency, fake business record, demo mode, seed row, fallback record, or mock module reachable from production.
- Preserve all unrelated user work and the canonical `ValenceOrb`/`MiniValenceOrb` visuals.
- Use UI-tree-derived Android coordinates; screenshots are visual evidence, never coordinate sources.
- A build/test pass is not visual, motion, auth-callback, Supabase-live, or release proof.
- Each behavior change follows RED -> GREEN; each task ends with a diff/status checkpoint instead of a commit because direct-main/no-push execution is explicitly required.

---

### Task 1: Freeze Current Main And Evidence Baselines

**Files:**
- Read: `AGENTS.md`
- Read: `ARCHITECTURE.md`
- Read: `src/lib/pushNotifications.ts`
- Read: `src/lib/accountSignOutCleanup.ts`
- Read: `src/components/AuthGate.tsx`
- Read: `src/lib/authGateRuntime.ts`
- Read: `supabase/migrations/20260718150000_owner_bound_push_revoke.sql`
- Create ignored evidence: `.preflight-token`

**Interfaces:**
- Consumes: current `main`, Android crash trace, live Supabase schema metadata.
- Produces: a fresh edit authorization packet and immutable before-state identifiers.

- [ ] **Step 1: Reconfirm source and remote identity**

Run:

```bash
git fetch origin --prune
git status --short
git branch --show-current
git rev-parse HEAD
git rev-parse origin/main
```

Expected: branch `main`, clean tree before planned writes, and identical HEAD/origin hash. If origin advances, re-read the touched files before continuing.

- [ ] **Step 2: Capture the failing native baseline**

Run the current installed APK sign-out flow with UI-tree-derived taps after clearing logcat, then save:

```bash
adb -s emulator-5554 logcat -c
adb -s emulator-5554 logcat -b crash -d > /tmp/zenflow-signout-before-crash.txt
```

Expected baseline: `IllegalStateException` from `FirebaseMessaging.getInstance()` during `PushNotificationsPlugin.unregister()` and the authenticated session still present after relaunch.

- [ ] **Step 3: Record no-mock and security scope in `.preflight-token`**

Write a fresh token with `test_first` entries for push cleanup and direct entry, selected skill routing, the exact RED commands below, rollback, platform impact, and `verdict: GO`. Do not include credentials, account identifiers, or tokens.

- [ ] **Step 4: Checkpoint the baseline**

Run `git status --short` and confirm only the design/plan documents and ignored preflight evidence are new.

### Task 2: Add RED Tests For Current-Session Push Revocation

**Files:**
- Modify: `src/lib/__tests__/pushNotifications.test.ts`
- Modify: `src/lib/__tests__/accountSignOutCleanup.test.ts`

**Interfaces:**
- Consumes: existing `PushRevocationResult` and mocked Supabase/Capacitor boundaries.
- Produces: desired `revokePushForCurrentSession(expectedOwnerUserId: string): Promise<PushRevocationResult>` contract.

- [ ] **Step 1: Add a current-session RPC mock boundary**

Extend the existing RPC mock so `revoke_current_push_install` can return a validated integer independently from `revoke_push_install`.

- [ ] **Step 2: Add the absent-registration test**

Add a test that leaves both local identifiers absent, calls `revokePushForCurrentSession("user-1")`, and asserts the real result:

```ts
expect(result).toEqual({
  status: "revoked",
  remote: "not-registered",
  native: "not-applicable",
});
expect(mocks.rpc).not.toHaveBeenCalled();
expect(mocks.unregister).not.toHaveBeenCalled();
```

The production mutation this catches is restoring a native Firebase call or broad remote delete when this installation has no registration evidence.

- [ ] **Step 3: Add partial-identifier and multi-device-scope tests**

Cover device-id-only and token-only states. Assert RPC name `revoke_current_push_install`, expected owner, available identifiers, and no request that can delete unrelated device rows.

- [ ] **Step 4: Add owner-change and remote-failure tests**

Assert that an owner mismatch or RPC error returns `partial`, preserves local identifiers, and does not sign out.

- [ ] **Step 5: Add typed missing-Firebase behavior test**

With a verified remote delete and `unregister()` rejecting `{ code: "FIREBASE_NOT_CONFIGURED" }`, assert `revoked / deleted / not-applicable` and local identifier removal. With remote failure, assert the same native rejection cannot upgrade the result to revoked.

- [ ] **Step 6: Route ordinary sign-out to the desired API in the cleanup test**

Change the push mock to expose both APIs and assert `performOwnerSafeSignOut()` calls only `revokePushForCurrentSession("account-a")`; account deletion and account-switch tests continue to assert `revokePushForAccountBoundary()`.

- [ ] **Step 7: Run RED**

Run:

```bash
npx vitest run src/lib/__tests__/pushNotifications.test.ts src/lib/__tests__/accountSignOutCleanup.test.ts
```

Expected: failures because `revokePushForCurrentSession` and its cleanup routing do not yet exist. Existing unrelated tests must not fail.

### Task 3: Implement Current-Session Push Revocation

**Files:**
- Modify: `src/lib/pushNotifications.ts`
- Modify: `src/lib/accountSignOutCleanup.ts`

**Interfaces:**
- Consumes: `SK.PUSH_TOKEN`, `SK.PUSH_INSTALL_ID`, `getCurrentUserId()`, Capacitor `PushNotifications.unregister()`, Supabase `rpc()`.
- Produces: `revokePushForCurrentSession(expectedOwnerUserId)` while preserving `revokePushForAccountBoundary(expectedOwnerUserId)`.

- [ ] **Step 1: Add the narrow RPC client type**

Define `CurrentSessionPushRevocationRpcClient` for `revoke_current_push_install` with `p_expected_owner_user_id`, `p_device_id`, and `p_token`.

- [ ] **Step 2: Add typed native error classification**

Implement a small guard that returns true only for an object whose `code` is exactly `FIREBASE_NOT_CONFIGURED`. Do not match arbitrary error messages.

- [ ] **Step 3: Implement the serialized current-session path**

Reuse the existing push revocation queue. Validate the expected owner, suspend the native push realm, classify local evidence once, compare the active owner before and after the RPC, and return only the result states defined in the spec.

- [ ] **Step 4: Preserve strict boundary behavior**

Do not change the cross-owner RPC arguments, exact token/install matching, account-switch native-preservation behavior, or account-deletion call path.

- [ ] **Step 5: Update ordinary sign-out routing**

Import and call `revokePushForCurrentSession(ownerUserId)` only in `performOwnerSafeSignOut()`. Leave account deletion on `revokePushForAccountBoundary(expectedOwnerUserId)`.

- [ ] **Step 6: Run GREEN and nearby auth tests**

Run:

```bash
npx vitest run src/lib/__tests__/pushNotifications.test.ts src/lib/__tests__/accountSignOutCleanup.test.ts src/hooks/__tests__/useAuthSession.test.ts src/hooks/__tests__/useSessionTimeout.test.ts
```

Expected: all selected tests pass with zero unhandled rejections.

- [ ] **Step 7: Checkpoint scope**

Review `git diff -- src/lib/pushNotifications.ts src/lib/accountSignOutCleanup.ts src/lib/__tests__/pushNotifications.test.ts src/lib/__tests__/accountSignOutCleanup.test.ts` and confirm no account-boundary guard was weakened.

### Task 4: Add And Validate The Supabase Migration

**Files:**
- Create via CLI: `supabase/migrations/<timestamp>_revoke_current_push_install.sql`
- Modify: migration contract test selected by repository search, or create `src/lib/__tests__/currentPushRevocationMigration.test.ts` if no behavioral SQL harness exists.

**Interfaces:**
- Consumes: authenticated JWT owner, optional install id/token, existing RLS on `push_device_tokens`.
- Produces: `revoke_current_push_install(uuid, text, text) returns integer`.

- [ ] **Step 1: Discover the exact CLI command**

Run `npx supabase migration new --help`, then create the file with:

```bash
npx supabase migration new revoke_current_push_install
```

Do not invent the timestamp.

- [ ] **Step 2: Add RED migration behavior evidence**

Use the repository's existing SQL test harness if present. The test matrix must prove: unauthenticated rejection, expected-owner mismatch rejection, missing-capability rejection, device-only delete scoped to current owner, token-only fallback scoped to current owner, another user's row preserved, explicit ACLs, and no INSERT/COPY/user-data seed.

- [ ] **Step 3: Implement the migration**

Use `SECURITY INVOKER`, `SET search_path = ''`, schema-qualified objects, advisory locks for supplied capabilities, explicit `REVOKE`/`GRANT`, comments, `NOTIFY pgrst, 'reload schema';`, and a transaction matching repository convention.

- [ ] **Step 4: Run local migration and integrity checks**

Run:

```bash
npm run check:supabase-migration-prefixes
npm run check:production-data-integrity:diff
npm run check:sync-contract
```

Expected: migration order valid, no synthetic data finding/warning, sync/account contracts unchanged.

- [ ] **Step 5: Run narrow security scans before live DDL**

Discover suite syntax with `/Users/yehor/.codex/bin/codex-security-suite.sh --help`, then run the narrowest suitable auth/migration profile. Run Snyk MCP if callable; otherwise run the documented local Snyk fallback and report auth/network blockers as `UNVERIFIED`.

- [ ] **Step 6: Verify the exact live target and apply only this migration**

Re-read project `bwgfslmxmueyglpumkbf`, its status, existing function signatures, RLS policy, and migration list. Apply only the final reviewed SQL with Supabase MCP `apply_migration` under the migration's snake_case name.

- [ ] **Step 7: Verify live schema and advisors**

Query `pg_proc`, `information_schema.routine_privileges`, and policy metadata without reading token rows. Confirm `SECURITY INVOKER`, only authenticated execute, exact signature, and no broad function. Run Supabase security and performance advisors; classify pre-existing findings separately.

### Task 5: Patch The Android Plugin Without Hiding Failures

**Files:**
- Modify for patch generation: `node_modules/@capacitor/push-notifications/android/src/main/java/com/capacitorjs/plugins/pushnotifications/PushNotificationsPlugin.java`
- Create: `patches/@capacitor+push-notifications+8.0.4.patch`
- Test: a focused patch-package/native contract test found or added under `scripts/__tests__/`

**Interfaces:**
- Consumes: Java `IllegalStateException` from `FirebaseMessaging.getInstance()`.
- Produces: Capacitor rejection code `FIREBASE_NOT_CONFIGURED`, never an uncaught plugin-thread exception.

- [ ] **Step 1: Add RED patch behavior check**

The test must apply/install dependencies in an isolated temp context or compile/execute the relevant plugin boundary; it must prove that missing Firebase rejects the plugin call with the exact code and does not escape as an uncaught exception. A source-text grep alone is insufficient.

- [ ] **Step 2: Patch `register()` and `unregister()`**

Wrap only the Firebase instance acquisition/operation in `try/catch (IllegalStateException exception)` and call:

```java
call.reject(
    "Firebase is not configured for push notifications",
    "FIREBASE_NOT_CONFIGURED",
    exception
);
```

Do not resolve the call and do not catch unrelated exceptions.

- [ ] **Step 3: Generate and inspect patch-package output**

Run `npx patch-package @capacitor/push-notifications`, then inspect the generated patch for package version `8.0.4`, correct paths, and no unrelated dependency changes.

- [ ] **Step 4: Reinstall-patch verification**

Run the repository postinstall patch command against the current dependency tree and rerun the focused native contract test.

### Task 6: Remove The First-Run Walkthrough With RED Tests

**Files:**
- Modify: `src/components/__tests__/AuthGate.test.tsx`
- Modify: `src/components/__tests__/AuthGate.desktopRuntime.test.tsx`
- Modify: applicable entry-gate Playwright tests under `e2e/`
- Delete after GREEN implementation: `src/components/__tests__/OnboardingFlow.reflow.test.ts`

**Interfaces:**
- Consumes: language/auth gate state and existing V2 children.
- Produces: direct post-auth V2 render plus compatibility persistence with no feature/permission mutation.

- [ ] **Step 1: Replace the obsolete onboarding expectation**

For `hasValidSession = true`, `authGateChecked = true`, `onboardingComplete = false`, and `notificationPermissionChecked = false`, assert the real `children` are rendered and neither walkthrough component is present.

- [ ] **Step 2: Assert compatibility state, not invented permissions**

Use `waitFor` to assert `setOnboardingComplete(true)` and storage compatibility are attempted. Assert `setNotificationPermissionChecked` is not called and no `LocalNotifications.requestPermissions()` boundary is reached.

- [ ] **Step 3: Update installed-shell gate test**

Assert `hasStoredCompletedInteractiveGates()` returns true with only language and auth keys true; onboarding/notification keys are absent.

- [ ] **Step 4: Run RED**

Run:

```bash
npx vitest run src/components/__tests__/AuthGate.test.tsx src/components/__tests__/AuthGate.desktopRuntime.test.tsx
```

Expected: current code renders `OnboardingFlow` or requires removed storage keys, so the new direct-entry assertions fail.

### Task 7: Implement Direct Entry And Delete Dead Runtime Components

**Files:**
- Modify: `src/components/AuthGate.tsx`
- Modify: `src/lib/authGateRuntime.ts`
- Delete: `src/components/OnboardingFlow.tsx`
- Delete: `src/components/NotificationPermission.tsx`
- Delete: `src/components/__tests__/OnboardingFlow.reflow.test.ts`
- Modify only if required by compile/tests: store test mocks and entry-gate helpers that directly model removed components.

**Interfaces:**
- Consumes: completed language/account gates.
- Produces: direct children render, old onboarding completion compatibility write, no feature flag writes, no permission API call.

- [ ] **Step 1: Remove the runtime render paths**

Delete the component imports, notification-dismiss state, handlers, and conditional returns. Do not add a substitute modal, toast, fallback data, or permission prompt.

- [ ] **Step 2: Add non-blocking compatibility persistence**

After language and account gates are satisfied, record onboarding completion through the existing storage/store actions. If persistence fails, log the error and keep the V2 shell visible.

- [ ] **Step 3: Narrow installed-shell completion**

Update `hasStoredCompletedInteractiveGates()` to require only language and auth completion.

- [ ] **Step 4: Delete unreachable component files**

Delete `OnboardingFlow` and `NotificationPermission`. Retain unrelated onboarding libraries or translation keys only when another production consumer still exists; confirm with `rg`.

- [ ] **Step 5: Run GREEN and entry contracts**

Run focused AuthGate tests, app/user store tests affected by mocks, and the Android/PWA/iOS/Desktop entry-gate Playwright specs against a production-equivalent build.

- [ ] **Step 6: Run i18n/RTL and no-template checks**

Run:

```bash
npm run i18n:check
npm run i18n:deep
npm run check:translation-quality
npm run check:no-ai-templates
```

Expected: no key parity or RTL regression and no generic/template artifact.

### Task 8: Broad Static, Data, Auth, And Build Verification

**Files:**
- Verify all changed tracked files.
- Produce build artifacts only under existing ignored output directories.

**Interfaces:**
- Consumes: Tasks 2-7 implementation.
- Produces: a debug APK and scoped verification receipts.

- [ ] **Step 1: Run focused and full code gates**

Run TypeScript, ESLint, focused tests, then the full Vitest suite. Record exact file/test counts and failures/skips/todos.

- [ ] **Step 2: Run auth/sync/security contracts**

Run strict auth-provider readiness, Supabase publishable-key check, sync contract, Telegram sync drill, migration prefixes, npm audit when applicable, Snyk/fallback, and the local security suite. A partial Telegram drill remains `PARTIAL`.

- [ ] **Step 3: Run no-mock-data gates**

Run:

```bash
npm run check:production-data-integrity
npm run check:production-data-integrity:diff
npm run check:production-data-integrity:staged
```

Expected: zero errors and zero warnings; an internal checker error is `FAIL`, not clean.

- [ ] **Step 4: Run visual/runtime guards**

Run `check:visual`, `check:canonical-orbs`, `check:best-practices`, and applicable motion bundle checks. Do not update visual baselines to obtain green output.

- [ ] **Step 5: Build Android and native tests**

Run Capacitor sync, Gradle assemble debug, unit tests, and Android lint. Then run `check:production-data-integrity:bundle` against the final production bundle used by the wrapper.

### Task 9: Exact-Artifact Android Auth And UI QA

**Files/Artifacts:**
- Verify: `android/app/build/outputs/apk/debug/app-debug.apk`
- Create outside repo: run-specific `/tmp/zenflow-android-final-*` evidence folder.

**Interfaces:**
- Consumes: final APK, emulator `emulator-5554`, real authorized account sessions.
- Produces: exact installed-artifact, auth, navigation, clipping, crash, and persistence evidence.

- [ ] **Step 1: Bind APK identity**

Record source HEAD, APK path/hash, package/version/versionCode, signer SHA-1, device serial/API, installed package path, and pulled `base.apk` hash. Require local and installed hashes to match exactly.

- [ ] **Step 2: Verify fixed Google sign-out journey**

Launch the existing persisted Google session, navigate through Settings -> Account -> Sign out with UI-tree-derived coordinates, and confirm: no crash buffer entry, process remains controlled, auth screen appears, Supabase session ends, and relaunch remains signed out.

- [ ] **Step 3: Verify Google sign-in and direct V2**

Complete native Google account selection without printing PII. Confirm Supabase session creation, no `Choose Features`, no reminder prompt, no automatic permission dialog, V2 route visible, and session persists after force-stop/relaunch.

- [ ] **Step 4: Verify Telegram sign-in and callback**

Sign out safely, start Telegram login, complete the real callback/confirmation, and verify Supabase session, provider identity, direct V2 destination, and persistence. If Telegram requires user interaction unavailable to the agent, preserve state and report the exact blocker as `UNVERIFIED`.

- [ ] **Step 5: Traverse every V2 route and nested account/settings surface**

Exercise Orb, Habits, Diary, Planning, Settings, drawer, account, authentication links, notification settings, back, scroll, toggles, modal close paths, and state persistence. For each screen, inspect UI tree, raster screenshot, document width/viewport, and logcat.

- [ ] **Step 6: Validate no mock runtime data**

Confirm empty/unavailable states are honest and that no invented habit, mood, journal, sync, profile, or success record appears. Do not create production smoke records in the user's normal account.

### Task 10: Android Motion And Visual-Regression Proof

**Files/Artifacts:**
- Create outside repo: uninterrupted Android emulator video, contact sheet, `gfxinfo` framestats, Perfetto trace, logcat, and artifact hashes.

**Interfaces:**
- Consumes: exact installed APK from Task 9.
- Produces: separate Technical, Visual Runtime, Artistic/Craft, Motion, and Model statuses.

- [ ] **Step 1: Record continuous visual evidence**

Capture one uninterrupted external Android Emulator-window video covering repeated Orb <-> Diary transitions, drawer open/close, and one additional heavy route. Record APK hash immediately before and after the run.

- [ ] **Step 2: Run CDP-off frame evidence**

Reset and capture `dumpsys gfxinfo ... framestats` for the same focused flows, then capture a bounded Perfetto trace when frame deadlines or route mount stalls require attribution.

- [ ] **Step 3: Inspect failure signals**

Require zero crash/ANR/context-loss/tile-memory corruption signals and no missing controls/undrawn blocks in the video. Report frame percentiles/janky-frame counts with emulator-noise caveats.

- [ ] **Step 4: Apply the visual-integrity critic rubric inline**

Because subagents are forbidden, review current screenshots/video in the main context. Compare against the accepted baseline and report `GO`, `FIX`, or `STOP` without conflating technical tests with artistic or motion proof.

### Task 11: Final Diff, Provenance, And Handoff

**Files:**
- Review: every tracked changed file.
- Do not create a commit or push.

**Interfaces:**
- Consumes: all test/runtime evidence.
- Produces: a self-contained Done Packet with exact remaining gaps.

- [ ] **Step 1: Re-run freshness-sensitive checks**

Immediately before any completion claim, rerun the final focused regression tests, TypeScript, ESLint, production-data-integrity source/bundle, visual guard, and APK hash comparison.

- [ ] **Step 2: Inspect repository scope**

Run `git diff --check`, `git diff --stat`, `git diff`, and `git status --short`. Confirm no unrelated file, secret, PII, production-derived data, build artifact, hidden placeholder, test dependency, or mock runtime module entered the change.

- [ ] **Step 3: Reconcile the plan**

Mark each task/evidence row `VERIFIED`, `FAIL`, `UNVERIFIED`, or `SKIP` with reason. Any required failure keeps the task incomplete.

- [ ] **Step 4: Report platform and release truth**

Report Web/PWA, Android, iOS, Desktop, Store/Release, Accessibility, Performance, Security/Privacy, Testing, and Operations separately. Do not claim deployment, store readiness, artistic approval, or 100% sync without fresh evidence.

## Self-Review

- Spec coverage: push privacy, native crash containment, Supabase least privilege, first-run removal, no mock data, Android auth, full route audit, clipping, motion, exact APK identity, rollback, and platform matrix each map to a task above.
- Placeholder scan: no unresolved marker, generic test request, hidden implementation, or unspecified error handling remains.
- Type consistency: `revokePushForCurrentSession(expectedOwnerUserId)` and `revoke_current_push_install(p_expected_owner_user_id, p_device_id, p_token)` are used consistently across tests, JS, SQL, and verification.
- Rejected broad revoke: every task preserves other-device push rows.
- Execution mode: inline in this session under `executing-plans`; the user already selected option 1 and instructed execution, so no further handoff question blocks work.

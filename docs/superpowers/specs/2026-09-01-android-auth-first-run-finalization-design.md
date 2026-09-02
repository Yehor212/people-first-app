# Android Auth And First-Run Finalization Design

## Goal

Ship one latest-main Android APK in which Google/Telegram authentication reaches V2, sign-out cannot crash the process or leak notification ownership, the old first-run module/notification walkthrough never blocks the shell, production runtime contains no synthetic business data, and the accepted V2 visuals remain unchanged.

## Current Evidence

- Repository and remote are both at `ec91a1f0e16c64c84c30f09cdab035503049e15a` on `main`; the worktree was clean before this design was written.
- The exact previous debug APK reproduced sign-out failure in `com.zenflow.app`: `PushNotifications.unregister()` called `FirebaseMessaging.getInstance()` without a default `FirebaseApp`, throwing `IllegalStateException` on the Capacitor plugin thread.
- `src/lib/accountSignOutCleanup.ts` correctly keeps the session fail-closed when push revocation is not proven, but it currently calls the cross-account `revokePushForAccountBoundary()` path even for ordinary current-session sign-out.
- `src/lib/pushNotifications.ts` attempts native unregister when local push identifiers are absent because an expected owner was supplied; that reaches the crashing native plugin.
- Production Supabase has RLS on `public.push_device_tokens` with `user_id = (select auth.uid())`, but its applied migration history currently stops before the local owner-bound push RPC migrations. The new migration must therefore be self-contained and must not apply the unrelated backlog.
- `AuthGate` still renders `OnboardingFlow` and `NotificationPermission` after successful auth. The observed sequence is `Choose Features` then `Allow reminders`, while the requested result is direct V2 entry with no feature preference mutation and no automatic permission request.
- `MoodFirstRunHint` has already been removed on the current `main`.

## Explicit Requirements

1. Work only in the current `main`; create no branch, clone, worktree, or subagent lane.
2. Use the latest merged APK and prove that the installed `base.apk` is byte-identical to the reported artifact.
3. Fix the reproduced auth/sign-out problem in code and in the live Supabase project used by the app.
4. Remove the remaining first-entry tutorial/walkthrough and automatic reminder prompt so authenticated users reach V2 directly.
5. Verify Google and Telegram authentication, session persistence, sign-out, every V2 tab/button path, clipping, crashes, freezes, and route motion in the Android emulator.
6. Preserve the accepted V2 visuals and the canonical `ValenceOrb`/`MiniValenceOrb` family.
7. Absolute prohibition on mock, demo, sample, fallback, canned, or synthetic business records in production runtime, migrations, bundles, sync, analytics, export, or release evidence.

## Implied Requirements

- Preserve account-boundary fail-closed behavior: no session removal while remote notification ownership is unknown.
- Preserve other devices: signing out one installation must never revoke every push token owned by the account.
- Preserve account-switch and account-deletion semantics: the existing cross-owner exact-capability path remains separate from ordinary current-session sign-out.
- Use a forward-only, least-privilege Supabase function with explicit grants and an owner check; do not widen table access or rely on `SECURITY DEFINER` where RLS already provides the required boundary.
- Convert the native Firebase initialization crash into a typed Capacitor rejection so JavaScript can make a fail-closed decision instead of losing the process.
- Do not request Android notification permission automatically. Permission remains user-initiated from the existing notification/settings surface.
- Keep old persisted gate keys readable for compatibility, but remove their ability to block the shell.
- Keep Web/PWA, iOS/WKWebView, and Desktop/Tauri behavior explicit even though the final runtime proof is Android-emulator-first.
- Bind motion claims to continuous video plus CDP-off `gfxinfo`/Perfetto evidence; screenshots alone cannot prove smoothness.

## Architecture

### 1. Current-install push revocation

Add `revokePushForCurrentSession(expectedOwnerUserId)` alongside, not in place of, `revokePushForAccountBoundary(expectedOwnerUserId)`.

The current-session path reads `SK.PUSH_INSTALL_ID` and `SK.PUSH_TOKEN` once and classifies evidence:

- both reads succeed and neither value exists: return `revoked / not-registered / not-applicable`; no Supabase RPC and no native Firebase call are needed because this installation has no local registration evidence;
- at least one identifier exists: call `revoke_current_push_install` with the expected owner and the identifiers that are available;
- storage is unreadable and no identifier can be trusted: return `partial` and keep the session;
- remote revoke fails or owner changes: return `partial` and keep the session;
- remote revoke succeeds and native registration exists: unregister natively;
- native reports the typed `FIREBASE_NOT_CONFIGURED` condition after remote ownership is removed: classify native cleanup as `not-applicable`, clear the local identifiers, and allow sign-out;
- any other native failure remains `partial`.

The existing exact cross-owner path stays unchanged for account switching and account deletion. This prevents a stale cleanup from deleting another account's newly claimed installation.

### 2. Self-contained Supabase RPC

Add one forward-only migration defining:

```sql
public.revoke_current_push_install(
  p_expected_owner_user_id uuid,
  p_device_id text default null,
  p_token text default null
) returns integer
```

Properties:

- `SECURITY INVOKER`, `SET search_path = ''`;
- rejects missing auth, mismatched expected owner, and a request with no usable identifier;
- validates identifier lengths;
- locks the supplied install/token capability before delete;
- deletes only rows where `user_id = auth.uid()` and either the supplied `device_id` matches or, when no device id is available, the supplied token matches;
- returns the exact deleted-row count;
- revokes execute from `PUBLIC` and `anon`, grants only `authenticated`;
- reloads the PostgREST schema cache;
- inserts no rows and contains no production test data.

The RPC deliberately does not delete every token for the user. That rejected design would break multi-device notification continuity.

### 3. Native crash containment

Patch `@capacitor/push-notifications@8.0.4` through the repository's existing `patch-package` pipeline. Both `register()` and `unregister()` catch `IllegalStateException` raised by a missing default Firebase app and reject the plugin call with code `FIREBASE_NOT_CONFIGURED`. No exception may escape the Capacitor plugin thread.

This patch is defense in depth. JavaScript still decides whether the typed rejection is safe to treat as not applicable based on verified remote cleanup.

### 4. Direct first-run V2 entry

Remove the runtime imports and render branches for `OnboardingFlow` and `NotificationPermission` from `AuthGate`, then delete those now-unreachable components and their component-specific tests.

After language and account gates pass, `AuthGate` renders its children immediately. A non-blocking effect records the old onboarding-complete compatibility flag without changing any feature flags. The notification permission flag remains untouched and no permission API is called. Existing settings controls remain the only route to requesting notification permission.

`hasStoredCompletedInteractiveGates()` is reduced to the gates that still exist: language and account/auth. Existing onboarding/notification storage values may remain for backward compatibility but no longer control entry.

## Failure And Recovery States

| State | Required behavior |
| --- | --- |
| Supabase unavailable | Sign-out remains blocked; current session and local data stay intact. |
| Push storage unreadable | No guessed identifiers and no broad revoke; sign-out remains blocked. |
| Active account changes during cleanup | Return `session-changed`; never clear the replacement account. |
| Native Firebase absent after remote revoke | Typed `FIREBASE_NOT_CONFIGURED`; no process crash; complete as native `not-applicable`. |
| Native unregister fails for another reason | Keep session fail-closed and preserve retry identifiers. |
| No local push registration evidence | Do not call Firebase; complete remote/native as not registered/not applicable. |
| Onboarding compatibility persistence fails | V2 still opens; log the storage failure without inventing state or showing the removed walkthrough. |
| Offline first entry | Local shell opens after existing auth/local-owner gates; no fabricated cloud data appears. |

## Cross-Platform Impact

| Surface | Impact |
| --- | --- |
| Web/Vite | Uses current-session Supabase revoke and direct entry; no native unregister. Browser build and auth tests required. |
| Installed PWA | Same as Web; completed interactive-gate startup no longer depends on removed flags. Installed-mode test required. |
| Android/Capacitor | Primary target: native crash containment, real auth/sign-out, APK identity, UI-tree, logcat, video, and frame evidence required. |
| iOS/WKWebView | Shared JS sign-out and first-run behavior changes; native patch is Android-only. `cap:sync:ios`/CI simulator remains required for release parity or `UNVERIFIED`. |
| Desktop/Tauri | Shared direct-entry/sign-out logic; desktop entry contract test required. Native Firebase patch is N/A. |
| Store/Release | No upload or publication is authorized. A debug APK is produced and verified; Play/TestFlight/store status remains `UNVERIFIED`. |

## No-Mock-Data Contract

- The migration performs only DDL and deletes rows owned by the authenticated caller; it seeds no data.
- Production error paths return honest `partial`, unavailable, empty, or error states.
- Tests may use isolated Vitest fixtures/mocks, but no test module may be reachable from `src/main.tsx`, native shipped roots, `public/`, `dist/`, Supabase production functions, analytics, sync, exports, or release evidence.
- Run production-data-integrity source, diff/staged, and final bundle checks. Any warning or internal error is not a pass.

## Verification Strategy

1. Capture RED tests for current-session push revoke, account-cleanup routing, native patch behavior, and AuthGate direct entry.
2. Implement the smallest changes and rerun the same tests GREEN.
3. Run TypeScript, ESLint, sync/auth contracts, migration-prefix checks, production-data-integrity, Snyk or documented fallback, and the local security suite.
4. Apply only the new migration to project `bwgfslmxmueyglpumkbf`, then verify function ACL/body, an authenticated runtime call, auth logs, and Supabase security/performance advisors.
5. Build/sync/install the debug APK, record local and installed hashes, and prove package/version/signer/device identity.
6. Use UI-tree-derived coordinates for all Android interactions. Verify Google login persistence, sign-out without crash, Telegram callback/persistence, direct V2 destination, settings/account controls, all V2 tabs, scroll/clipping, back behavior, and logcat.
7. Record uninterrupted route video and a separate CDP-off `gfxinfo`/Perfetto run for repeated Orb/Diary/drawer transitions. Reject any candidate that changes accepted pixels or worsens attributable jank.
8. Review final diff/status for unrelated changes, secrets, generated junk, mock data, and untracked artifacts. Do not commit, push, deploy, or publish without separate authorization.

## Acceptance Criteria

- The original Android sign-out sequence ends on the auth screen without process death, stale session, or another device's token deletion.
- Re-launch after sign-in returns to V2; re-launch after sign-out returns to auth.
- Google and Telegram each complete a real callback and persist a Supabase session on the exact installed APK, or the provider is reported `UNVERIFIED` with the precise external blocker.
- `Choose Features`, `Allow reminders`, `MoodFirstRunHint`, and their runtime components are absent from the installed first-entry flow.
- No automatic notification permission request occurs.
- Every canonical V2 tab and nested settings/account path is reachable, scrollable, unclipped, and free of crash/ANR evidence.
- Local and installed APK SHA-256 values match before and after the accepted run.
- Production-data-integrity source and bundle scans report zero errors and zero warnings.
- No visual baseline is updated merely to hide a regression; canonical orb guards stay green.

## Rejected Alternatives

- Catch only the Java exception: prevents process death but leaves sign-out permanently fail-closed.
- Ignore push cleanup: can leave a server token attached to the signed-out account.
- Delete every push row for `auth.uid()`: breaks notifications on the user's other devices.
- Apply all missing Supabase migrations: expands scope and risk far beyond the reproduced failure.
- Mark notification permission as granted/checked: fabricates permission state and violates platform consent semantics.
- Remove or simplify Orb/Diary visuals to improve one emulator metric: violates the visual-regression prohibition.

## Remaining Unverified Before Execution

- The final migration has not yet been applied to Supabase.
- Telegram callback may require an interactive confirmation in the user's Telegram account.
- iOS simulator, Desktop package, public GitHub Pages deployment, Play Console, and App Store artifacts are outside the current Android-debug execution and remain unverified unless separately run.

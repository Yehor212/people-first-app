# Feature Specification: Android Habits Banner Dock

**Feature branch**: `codex/banner-only-reserved-dock-20260830`  
**Created**: 2026-08-30  
**Status**: Approved for implementation by the user  
**Scope source**: `BANNER_ONLY_MAIN_CONVERGENCE_PLAN_2026-08-30.md` plus fresh source, test, APK, and emulator evidence.

## User failure

The current Android banner path is not safe to finish as-is. A debug APK without an injected AdMob application ID crashes before the first screen. When configuration exists, the web content reserves no dock until the native size event arrives, so content can shift. Account entitlement is hardcoded as non-premium, mood protection is not bounded to the current local day, native operations can hang, and keyboard/native lifecycle changes are not explicit deny gates.

## User stories

### US1 — The Android app always starts safely

As a user, I can open ZenFlow even when advertising is unavailable or not configured. A development build must never contain an empty AdMob application ID that crashes the process. A QA build may use Google's official sample application and banner identifiers only when an explicit QA flag is set. A publishable build must reject sample or missing identifiers.

### US2 — Ads appear only in the approved calm surface

As an eligible adult free user, I may see one adaptive bottom banner only on the Habits page when at least one habit row is visible today, no protected overlay or keyboard is open, the app is active, consent and UMP permit requests, onboarding grace is complete, and today's emotional state is not `bad` or `terrible`.

### US3 — Uncertainty removes the banner

As a premium user, a user whose entitlement is unknown, a signed-out user during account transition, or a user who revokes consent, I see no banner. Account or lifecycle changes invalidate pending native operations so a late result cannot resurrect a stale view.

### US4 — The page does not jump or become obstructed

As an Android user, Habits reserves the exact adaptive dock geometry before the native banner becomes visible. The last visible habit and 44px actions remain scrollable above the banner and system navigation. No empty dock persists after no-fill, failure, or removal.

### US5 — Other platforms remain ad-free

Web/Vite, installed PWA, iOS/WKWebView, and Desktop/Tauri do not initialize or render this Android banner. Their current layout must not gain banner spacing.

## Functional requirements

- **FR-001** Android startup MUST use a valid manifest application ID in every installable variant; debug defaults to the official sample application ID only to keep the native provider safe, without enabling ad requests.
- **FR-002** An explicit QA build flag MAY enable Google's official sample banner ID and SDK testing mode; production source, production bundles, and publishable artifacts MUST remain sample-free and testing-mode-free.
- **FR-003** Production eligibility MUST require authoritative entitlement `free`. `premium`, `unknown`, load failure, missing account scope, sign-out, and account transition MUST deny and remove ads.
- **FR-004** Habits placement MUST require at least one actual `todaysHabits` row, not merely an active habit elsewhere in the schedule.
- **FR-005** Emotional protection MUST examine entries belonging to the current local date and suppress the banner if any entry that day is `bad` or `terrible`.
- **FR-006** Consent, adult eligibility, UMP can-request status, and grace completion MUST all be true before a native request.
- **FR-007** App inactive/background, document hidden, IME open, protected overlay open, non-Habits route, and unsupported platform MUST deny placement.
- **FR-008** Pending show/load operations MUST have a bounded timeout and epoch invalidation. A late resolution MUST NOT recreate or reveal an invalid banner.
- **FR-009** The exact anchored adaptive height MUST be known and reserved before the native view becomes visible. Width, rotation, split-screen, insets, and IME changes MUST recalculate or suppress safely.
- **FR-010** Native failures and no-fill MUST clear the reservation without automatic retry storms.
- **FR-011** All native listeners and views MUST be removed on provider cleanup, consent revocation, entitlement loss, sign-out/account change, and unsupported state.
- **FR-012** No interstitial, rewarded, app-open, native-feed, scarcity, guilt, or deceptive ad behavior may be introduced.
- **FR-013** `ar` and `he` MUST remain RTL-safe; banner geometry MUST not assume LTR. User-facing copy, if any, MUST preserve all eight locale keys.
- **FR-014** Production runtime MUST contain no mock, fake, sample, canned, or fallback business records. Official Google test identifiers are allowed only in the isolated QA build path.

## Acceptance scenarios

1. With no AdMob environment variables, a debug APK installs and cold-starts without a provider crash and makes no ad request.
2. An explicitly flagged QA APK shows a visibly labelled Google test adaptive banner only on eligible non-empty-today Habits.
3. Opening every local/global protected overlay or the IME removes/hides the native banner before it can cover or intercept that surface.
4. Background/resume, rotation, split-screen, repeated navigation, no-fill, and a timed-out native call produce no duplicate or stale native view.
5. `premium`, `unknown`, consent revoked, non-adult, grace-incomplete, account transition, and any `bad`/`terrible` entry today all remain ad-free.
6. Prior-day emotional entries do not alone suppress today's banner; local-day rollover recomputes the gate.
7. Web, PWA, iOS, and Desktop execute no Android banner path and receive no dock spacing.

## Evidence boundary

Automated tests and an installed QA APK can prove local contracts and Android test-ad layout. They cannot prove live serving, impressions, Play/AdMob console readiness, signed release behavior, physical-device quality, or human artistic acceptance; those remain `UNVERIFIED` until separately exercised.

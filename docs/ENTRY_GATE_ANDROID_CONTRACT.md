# ZenFlow Android Entry Gate Contract

Last verified: 2026-06-16

This document freezes the Android entry-gate expectations for the ZenFlow
first-run language screen and the following sign-in screen. It is intentionally
Android-only. Do not use this file to claim iOS, PWA, or Desktop/Tauri coverage.

## Scope

Applies:

- Android phone entry gate in Android Chrome/WebView-like conditions.
- Android tablet entry gate in Android Chrome/WebView-like conditions.
- Capacitor Android web asset sync and native debug build.
- `LanguageSelector` before the user has selected a language.
- `AuthScreen` after language selection when the user has no valid session and
  auth has not been completed or bypassed.
- Light, dark, and system entry themes.
- RTL spot-checks for Arabic and Hebrew.

Does not apply:

- Physical Android device or emulator runtime launch; no device was attached
  during the 2026-06-15 verification.
- iOS/WKWebView; see `docs/ENTRY_GATE_IOS_CONTRACT.md`.
- Desktop/Tauri and PWA-specific shell behavior.
- Local `?dev=true` bypass, because it skips the entry gates.

## Source Files

Entry orchestration:

- `src/components/AuthGate.tsx`

Shared entry visuals:

- `src/components/EntryGate.css`
- `src/components/EntryGateBackdrop.tsx`
- `src/components/EntryThemeSwitcher.tsx`
- `src/components/ZenFlowBrandMark.tsx`
- `docs/icon-source.svg`

Language screen:

- `src/components/LanguageSelector.tsx`
- `src/i18n/translations.ts`
- `src/i18n/languages/en.ts`
- `src/i18n/languages/uk.ts`
- `src/i18n/languages/es.ts`
- `src/i18n/languages/de.ts`
- `src/i18n/languages/fr.ts`
- `src/i18n/languages/ja.ts`
- `src/i18n/languages/ar.ts`
- `src/i18n/languages/he.ts`

Auth screen:

- `src/components/auth-screen/AuthScreen.tsx`
- `src/components/auth-screen/useAuthHandlers.ts`
- `src/components/auth-screen/useAuthSession.ts`
- `src/components/auth/AuthProviderButton.tsx`
- `src/lib/authProviders.ts`

Android platform:

- `capacitor.config.ts`
- `android/app/src/main/AndroidManifest.xml`
- `android/app/src/main/assets/public/`
- `android/app/build/outputs/apk/debug/app-debug.apk`

Regression tests:

- `src/components/__tests__/EntryGate.safeArea.test.ts`
- `src/components/__tests__/EntryGateBackdrop.test.tsx`
- `src/components/__tests__/LanguageSelector.test.tsx`
- `src/components/auth-screen/__tests__/AuthScreen.providers.test.tsx`
- `src/components/__tests__/AuthGate.test.tsx`
- `e2e/entry-gate-android.spec.ts`

## Gate Flow

`AuthGate` controls the Android entry sequence:

1. Initialization or splash state renders first.
2. Desktop runtime bypass does not apply to Android.
3. If `hasSelectedLanguage` is false, render `LanguageSelector`.
4. If language is selected and `googleAuthChecked` is false, `authBypassFlag` is
   false, and `hasValidSession === false`, render `AuthScreen`.
5. Tutorial, onboarding, notification permission, and the app shell render only
   after entry gates pass.

The Android contract does not permit moving the language/auth checks below
tutorial or onboarding without fresh Android screenshots, focused tests, and
native build proof.

## Element Inventory

### Root Screen

Selectors:

- `main.entry-gate-screen`
- `data-testid="language-selector-screen"`
- `data-testid="auth-screen"`

Android responsibilities:

- Use the full available viewport without horizontal scroll.
- Use `min-height: 100svh` and `min-height: 100dvh`.
- Respect safe-area variables and Capacitor safe-area fallbacks.
- Keep `overflow-x-hidden`.
- Allow vertical scroll when Android browser chrome, keyboard, or accessibility
  scaling reduces the visible area.
- Keep touch targets at least 48 CSS px where practical on Android. The current
  entry buttons exceed this.

Required viewport meta in `index.html`:

- `width=device-width`
- `initial-scale=1.0`
- `maximum-scale=5.0`
- `user-scalable=yes`
- `viewport-fit=cover`
- `interactive-widget=resizes-content`

### Background

Files:

- `src/components/EntryGate.css`
- `src/components/EntryGateBackdrop.tsx`

Contract:

- One `.entry-gate-aurora` layer with `inset: 0`.
- Seven soft orb points.
- Three soft ripple layers.
- Three soft flow-ribbon layers.
- Three soft caustic light layers.
- Four soft current lines.
- One horizon line.
- No star, sparkle, magic, or generic AI glyph decorations.
- No negative full-viewport inset or transform expansion that increases
  `document.documentElement.scrollWidth`.
- Motion must honor `shouldAnimate()`, `body.reduce-motion`,
  `:root[data-runtime-perf]`, and `prefers-reduced-motion: reduce`.

### Brand Logo

File:

- `src/components/ZenFlowBrandMark.tsx`

Contract:

- Source must stay `icon-source.svg` through `zenFlowBrandMarkSrc`.
- Current Android proof loads the logo at natural size 512 by 512.
- Render size is 72px by 72px in the current entry layout.
- The old leaf-only temporary icon must not be reintroduced.

### Theme Switcher

File:

- `src/components/EntryThemeSwitcher.tsx`

Options:

- Light: `paper`
- Dark: `ink`
- System: `auto`

Contract:

- Visible on language and auth screens.
- `role="radiogroup"` with radio controls.
- Each option has `min-h-[44px]`; Android target expectation is 48px or larger
  when practical.
- Must not wrap or overlap at 412px phone width.

### Language Screen

File:

- `src/components/LanguageSelector.tsx`

Contract:

- Exactly 8 supported language options: `en`, `uk`, `es`, `de`, `fr`, `ja`,
  `ar`, `he`.
- Android phone layout is 2 columns.
- Android tablet layout is 4 columns.
- Each option is a radio button with `aria-checked`.
- Arabic and Hebrew labels render with `dir="rtl"` inside the button.
- Continue arrow mirrors in RTL through `rtl:scale-x-[-1]`.
- Continue button resets entry scroll before leaving the screen.

### Auth Screen

Files:

- `src/components/auth-screen/AuthScreen.tsx`
- `src/components/auth/AuthProviderButton.tsx`
- `src/lib/authProviders.ts`

Contract:

- Panel uses `.entry-glass-panel`.
- Provider order comes from `AUTH_SCREEN_PROVIDER_IDS`.
- Current Android auth proof shows `google`, `facebook`, and `telegram`.
- Provider button content keeps the symmetric three-column icon/text/spacer
  grid: `grid-cols-[2rem_minmax(0,1fr)_2rem]`.
- Provider icon rail spread must remain 0 in Android facts: Google, Facebook,
  and Telegram share the same icon-center X within each scenario while the text
  stays centered by the symmetric icon/text/spacer grid.
- Google, Facebook, and Telegram icons render at `h-6 w-6`.
- Telegram SVG contract:
  - `viewBox="0 0 128 128"`
  - gradient stops `#2AABEE` and `#229ED9`

Phone auth:

- `SHOW_PHONE_AUTH` remains false in this contract.
- Enabling it requires a new Android keyboard/inset pass.

## Android Layout Invariants

Before claiming Android entry PASS, these must be true:

- `document.documentElement.scrollWidth <= window.innerWidth`.
- `main.entry-gate-screen.getBoundingClientRect().width <= window.innerWidth`.
- No audited entry element has `left < 0`, `right > viewportWidth`, or width
  greater than the viewport.
- Logo loads with natural size at least 256 by 256.
- Background has 0 stars and 0 old flow marks.
- Background has 7 orbs, 3 ripples, 3 flow ribbons, 3 caustics, 4 current
  lines, and 1 horizon line.
- Theme switcher exists on language and auth screens.
- Language screen has 8 options.
- Auth screen has the enabled provider ids in configured order.
- Provider icon rail spread is 0.
- Telegram SVG contract passes when Telegram is enabled.
- Arabic and Hebrew RTL scenarios set matching `html lang`, `dir="rtl"`, and
  mirrored continue arrow transform.

## Android Best-Practice Basis

Use these primary references when changing the Android entry gate:

- Android Developers, edge-to-edge and system bar insets:
  https://developer.android.com/develop/ui/views/layout/edge-to-edge
- Android Developers, screen compatibility:
  https://developer.android.com/guide/practices/screens_support
- Android Developers, support different screens in web apps:
  https://developer.android.com/develop/ui/views/layout/webapps/targeting
- Material Design 3, touch targets:
  https://m3.material.io/foundations/designing/structure
- MDN, viewport meta:
  https://developer.mozilla.org/en-US/docs/Web/HTML/Reference/Elements/meta/name/viewport

Operational translation for this app:

- Android 15+ edge-to-edge behavior means important content must tolerate
  system bar and gesture insets.
- Android supports many screen sizes and pixel densities; phone-only screenshots
  are not enough.
- Android web rendering can use wide viewport behavior if content forces a wider
  width, so overflow facts are required.
- Material recommends 48 by 48 dp touch targets; this app's entry actions must
  stay at or above that practical Android target.
- Keep zoom enabled and keep `width=device-width` in the viewport meta.

## Verification Contract

Run these checks before claiming Android entry is complete after any entry UI,
layout, auth-provider, logo, i18n, theme, or motion change.

Focused tests:

```bash
npm run test -- src/components/__tests__/EntryGate.safeArea.test.ts src/components/__tests__/EntryGateBackdrop.test.tsx src/components/auth-screen/__tests__/AuthScreen.providers.test.tsx src/components/__tests__/LanguageSelector.test.tsx src/components/__tests__/AuthGate.test.tsx src/lib/__tests__/androidCapacitorPrune.test.ts
```

Scoped entry lint:

```bash
npx eslint e2e/entry-gate-android.spec.ts src/components/LanguageSelector.tsx src/components/auth-screen/AuthScreen.tsx src/components/EntryGateBackdrop.tsx src/components/EntryThemeSwitcher.tsx src/components/ZenFlowBrandMark.tsx src/components/auth/AuthProviderButton.tsx src/lib/authProviders.ts src/components/__tests__/LanguageSelector.test.tsx src/components/auth-screen/__tests__/AuthScreen.providers.test.tsx src/components/__tests__/EntryGate.safeArea.test.ts src/components/__tests__/EntryGateBackdrop.test.tsx src/components/__tests__/AuthGate.test.tsx src/lib/__tests__/androidCapacitorPrune.test.ts scripts/capacitor-prune-assets.cjs --max-warnings=0 --no-warn-ignored
```

Core web checks:

```bash
npm run typecheck
npm run check:colors
npm run build
```

Android build and sync:

```bash
npm run build:android
npm run cap:sync:android
cd android && ./gradlew assembleDebug
adb devices
```

Android visual/runtime proof:

```bash
ZENFLOW_PLAYWRIGHT_BASE_URL=http://127.0.0.1:<preview-port>/people-first-app/ npx playwright test e2e/entry-gate-android.spec.ts --project=chromium --reporter=line --workers=1
```

Visual proof:

- Android phone language light: 412 by 915, DPR 2.625
- Android phone language dark: 412 by 915, DPR 2.625
- Android phone Arabic RTL language: 412 by 915, DPR 2.625
- Android phone Hebrew RTL language: 412 by 915, DPR 2.625
- Android phone auth light: 412 by 915, DPR 2.625
- Android phone auth dark: 412 by 915, DPR 2.625
- Android tablet language system: 800 by 1280, DPR 2
- Android tablet language dark: 800 by 1280, DPR 2
- Android tablet auth dark: 800 by 1280, DPR 2
- Android all-language smoke: `en`, `uk`, `es`, `de`, `fr`, `ja`, `ar`, `he`
  on Android phone Chromium.

Global lint:

- `npm run lint` should be green in a clean repo.
- On 2026-06-15 it was not Android-entry PASS evidence because it failed on
  unrelated generated iOS SPM artifacts:
  - `ios/App/CapApp-SPM/.build/.../native-bridge.js`: stale
    eslint-disable/rule references for `@typescript-eslint/no-unused-vars`

## Current Evidence

Evidence directory:

- `output/playwright/android-entry-20260615/`

Retention note:

- `output/playwright/*/` is ignored by `.gitignore`.
- `android/app/build/` is ignored by `android/.gitignore`.
- A clean checkout or forked agent may not contain these local artifacts. If the
  files are missing, regenerate them with the Verification Contract commands
  before claiming Android PASS.

Facts file:

- `output/playwright/android-entry-20260615/facts.json`
- Generated at: `2026-06-16T23:46:29.365Z`
- Base URL: `http://127.0.0.1:4232/people-first-app/`
- Runtime: Chromium production preview
- SHA-256:
  `82083214ded651de48fa8e38f213a272d1da43417daa98f907bc55c21121881e`

Verification log:

- `output/playwright/android-entry-20260615/verification-log-20260615.txt`
- SHA-256:
  `b3b011c378ab853c62cab78b42aeb41769a3b59ab5e3ea9fffb9f18d218c30a9`

Screenshots:

- `output/playwright/android-entry-20260615/android-phone-language-light.png`
- `output/playwright/android-entry-20260615/android-phone-language-dark.png`
- `output/playwright/android-entry-20260615/android-phone-language-ar-rtl.png`
- `output/playwright/android-entry-20260615/android-phone-language-he-rtl.png`
- `output/playwright/android-entry-20260615/android-phone-auth-light.png`
- `output/playwright/android-entry-20260615/android-phone-auth-dark.png`
- `output/playwright/android-entry-20260615/android-tablet-language-system.png`
- `output/playwright/android-entry-20260615/android-tablet-language-dark.png`
- `output/playwright/android-entry-20260615/android-tablet-auth-dark.png`

Screenshot hashes:

- `android-phone-language-light.png`:
  `0e12e63208d8c57ed21f23b752b04184099896fac26075b96204e442499d3229`
- `android-phone-language-dark.png`:
  `9ff24a442b43cf2be3abd524c28f93f9bd0daa29f2bc3ffa9725605e5ffcafc8`
- `android-phone-language-ar-rtl.png`:
  `de646235cb950c0473056b7af7236f2bd711cdaacacfacbdfd6980f80b27d43b`
- `android-phone-language-he-rtl.png`:
  `6018d41905ae4b2ab1428e3c7e60ebcba900d0dde29dfd37c7bd37b4171b781e`
- `android-phone-auth-light.png`:
  `7006f412654ec9216494391b5606a044d08e1e56c2a7e48d5007aa141b6480ed`
- `android-phone-auth-dark.png`:
  `df5e74ecc6bc51382d159df3718c44d11c37b89135c5b3909d85bc42f3127a68`
- `android-tablet-language-system.png`:
  `cc5cc8d473f0cb93bda1b398fa025bf23162aa17764aa86342bdf3bae9ab93f7`
- `android-tablet-language-dark.png`:
  `bf1e85f70dafbd094307a25cef50a481037bdc7b4657c74c4bcc31df550d9acf`
- `android-tablet-auth-dark.png`:
  `ed61437db9230d62f445c413d6e34dc85513f1bda3602144a0102c7938db46eb`

Native APK:

- `android/app/build/outputs/apk/debug/app-debug.apk`
- Size: 25 MB
- Last rebuilt after duplicate-artifact cleanup fix: `2026-06-15`
- SHA-256:
  `d9a59a7c8ff0d7f2ce1604fc029d516513c1feb38ad7ed3e7124adab5c36005e`

Current facts:

- 9 visual scenarios passed.
- Android all-language smoke passed for `en`, `uk`, `es`, `de`, `fr`, `ja`,
  `ar`, and `he`.
- Document horizontal overflow: false in all scenarios.
- Screen horizontal overflow: false in all scenarios.
- Out-of-bounds audited elements: 0 in all scenarios.
- Logo natural size: 512 by 512 in all scenarios.
- Background: 0 generic AI marks, 7 orbs, 3 ripples, 3 flow ribbons,
  3 caustics, 4 currents, and 1 horizon line.
- Console warnings/errors: 0 in all production-preview visual scenarios.
- Failed network requests: 0 in all production-preview visual scenarios.
- Theme switcher: present in all scenarios.
- Language option count: 8 on language scenarios.
- Auth provider ids: `google`, `facebook`, `telegram` on auth scenarios.
- Auth provider icon rail spread: 0 in all auth scenarios.
- Telegram: `viewBox="0 0 128 128"` with `#2AABEE` and `#229ED9`.
- Arabic RTL scenario sets `html lang="ar"` and `dir="rtl"`.
- Hebrew RTL scenario sets `html lang="he"` and `dir="rtl"`.

## Verification Refresh On 2026-06-16

PASS:

- Production web build: exit 0 against the current main worktree.
- Android visual/runtime matrix: 2/2 Playwright tests PASS against
  `http://127.0.0.1:4232/people-first-app/`, covering 9 screenshots plus all-language smoke.
- Scoped Android entry lint: exit 0 for `e2e/entry-gate-android.spec.ts`.
- Scoped whitespace diff check: exit 0 for `e2e/entry-gate-android.spec.ts`.
- Secret-string scan over the Android entry spec, this contract, and fresh facts/log
  found only the documentation phrase `token-only`; no secret value was present.

Fresh facts:

- Facts SHA-256: `82083214ded651de48fa8e38f213a272d1da43417daa98f907bc55c21121881e`.
- Verification log SHA-256: `b3b011c378ab853c62cab78b42aeb41769a3b59ab5e3ea9fffb9f18d218c30a9`.
- Background counts remained 7 orbs, 3 ripples, 3 ribbons, 3 caustics,
  4 currents, 1 horizon, 0 stars, and 0 old flow marks in every scenario.
- Auth provider ids remained `google`, `facebook`, `telegram`; Google,
  Facebook, and Telegram rendered at 24 by 24; icon rail spread remained 0;
  Telegram kept `viewBox="0 0 128 128"` with `#2AABEE` and `#229ED9`.
- Console warnings/errors: 0 in all production-preview visual scenarios.
- Failed requests: 0 in all production-preview visual scenarios.

Failure handling:

- A fresh run hit Chromium `Page.captureScreenshot` protocol failure after the
  page had already produced a valid PNG. The e2e spec was hardened with a
  test-only PNG validation/retry helper; product UI code was not changed. The
  same matrix was rerun and passed.

UNVERIFIED:

- Physical Android device or emulator runtime remains unverified in this refresh.
- Snyk Code remains unverified because the organization returned
  `403 SNYK-CODE-0005`.

## Verification Results On 2026-06-15

PASS:

- Focused entry/runtime tests: 6 files passed, 18 tests passed.
- Typecheck: exit 0.
- Scoped lint for Android entry files: exit 0.
- Color check: exit 0, no hardcoded colors found.
- Production web build: exit 0.
- Full dependency audit: `npm audit --audit-level=high` exited 0.
- Production-only audit: `npm audit --omit=dev --audit-level=high` exited 0.
- Android build: exit 0.
- `npm run cap:sync:android`: exit 0 after post-sync duplicate cleanup.
- Android native debug build: `BUILD SUCCESSFUL`, 428 actionable tasks
  (27 executed, 401 up-to-date).
- APK generated and hashed.
- Duplicate native artifact search under Android resource/public/plugin folders
  and Android generated/intermediate build folders: 0 matches for `* 2.*`
  after sync/build.
- Android visual/runtime matrix: 2/2 Playwright tests PASS, covering 9
  screenshots plus all-language smoke.

Failure handling:

- A first Android screenshot attempt failed during Chromium full-page capture.
  The partial run was discarded, the capture was changed to viewport screenshots
  plus DOM overflow facts, and the full matrix was rerun.
- A first visual facts rerun included false SafeJSON warnings because the
  Playwright setup wrote `zenflow-language` as raw text. The setup was corrected
  to the app's JSON storage shape, and the full matrix was regenerated.
- A dev-server Android visual run produced Vite-only CSP inline-script console
  errors. The verification target was switched to a production preview build,
  where all 9 visual scenarios reported `console=0` and `failedRequests=0`.
- A Gradle debug build failed because `android/app/src/main/res/xml/config 2.xml`
  was generated with a space in the resource filename. The fix adds a red/green
  regression test for post-sync cleanup, extends
  `scripts/capacitor-prune-assets.cjs` to clean Android app build and Cordova
  plugin duplicates, and makes `npm run cap:sync:android` run the cleanup again
  after `npx cap sync android`.

UNVERIFIED:

- Physical Android device or emulator runtime interaction. `adb devices`
  returned an empty device list.
- Android emulator runtime. `emulator -list-avds` could not run because
  `emulator` is not in `PATH`.
- Snyk Code scan. Local fallback
  `npx snyk code test --severity-threshold=high src/components src/lib/authProviders.ts e2e/entry-gate-android.spec.ts`
  reached Snyk but returned
  `403 Forbidden` because Snyk Code is not enabled for the `yehor212`
  organization.
- Repo-wide `npm run lint` as a global PASS. It failed on unrelated generated
  iOS SPM artifacts under `ios/App/CapApp-SPM/.build/.../native-bridge.js`.
- Clean-console claim for the local dev server. Playwright reported the same
  dev-mode CSP inline-script error in each scenario; Arabic selection also
  triggered non-entry audio/version-check warnings.

Warnings observed, not Android entry blockers:

- Gradle warned that `flatDir` should be avoided.
- Vite reported that `runtime-perf-bootstrap.js` cannot be bundled without a
  `type="module"` attribute.
- Treat clean-console claims on the local dev server as unverified until checked
  against a production-equivalent preview without Vite dev injection.

## Change Control

Allowed without product approval, if the verification contract still passes:

- Android entry copy translation improvements that do not change layout.
- Test-only improvements.
- Narrow token-only visual tuning that keeps all facts green.

Requires explicit approval and new Android proof:

- Changing entry gate order.
- Moving or removing the theme switcher.
- Replacing the logo source.
- Adding, removing, or reordering auth providers.
- Enabling phone auth or another keyboard-driven entry method.
- Replacing the background concept.
- Adding stars, sparkles, magic glyphs, or generic AI decoration.
- Removing safe-area fallback variables.
- Replacing `100svh`/`100dvh` with only `100vh`.
- Adding full-screen decorative layers that can expand horizontal scroll width.
- Changing supported entry languages.
- Changing provider icon layout away from the symmetric rail grid.

## Agent Handoff Rule

Before editing Android entry files, future agents must:

1. Read this document.
2. Read `AGENTS.md` and `ARCHITECTURE.md`.
3. State whether the change touches Android layout, auth logic, i18n, motion,
   branding, or native platform behavior.
4. Run focused tests, Android visual proof, `build:android`,
   `cap:sync:android`, and Gradle debug build after edits.
5. Mark real device/emulator runtime as `UNVERIFIED` unless a device is attached
   and actually exercised.

If a requested change only targets another platform, do not adjust Android entry
behavior without explicit user approval.

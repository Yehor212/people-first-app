# ZenFlow Android Entry Gate Contract

Last verified: 2026-06-14

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
- RTL spot-check for Arabic.

Does not apply:

- Physical Android device or emulator runtime launch; no device was attached
  during the 2026-06-14 verification.
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
- `src/components/__tests__/LanguageSelector.test.tsx`
- `src/components/auth-screen/__tests__/AuthScreen.providers.test.tsx`
- `src/components/__tests__/AuthGate.test.tsx`

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
- Provider icon center spread must remain 0 in Android facts.
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
- Background has 3 ripples, 7 orbs, and 3 flow ribbons.
- Theme switcher exists on language and auth screens.
- Language screen has 8 options.
- Auth screen has the enabled provider ids in configured order.
- Provider icon center spread is 0.
- Telegram SVG contract passes when Telegram is enabled.
- Arabic RTL scenario sets `html lang="ar"`, `dir="rtl"`, and mirrored continue
  arrow transform.

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
npm run test -- src/components/__tests__/EntryGate.safeArea.test.ts src/components/__tests__/LanguageSelector.test.tsx src/components/auth-screen/__tests__/AuthScreen.providers.test.tsx src/components/__tests__/AuthGate.test.tsx
```

Scoped entry lint:

```bash
npx eslint src/components/LanguageSelector.tsx src/components/auth-screen/AuthScreen.tsx src/components/EntryGateBackdrop.tsx src/components/EntryThemeSwitcher.tsx src/components/ZenFlowBrandMark.tsx src/components/auth/AuthProviderButton.tsx src/lib/authProviders.ts src/components/__tests__/LanguageSelector.test.tsx src/components/auth-screen/__tests__/AuthScreen.providers.test.tsx src/components/__tests__/EntryGate.safeArea.test.ts src/components/__tests__/AuthGate.test.tsx
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
npx cap sync android
cd android && ./gradlew assembleDebug
adb devices
```

Visual proof:

- Android phone language light: 412 by 915, DPR 2.625
- Android phone language dark: 412 by 915, DPR 2.625
- Android phone Arabic RTL language: 412 by 915, DPR 2.625
- Android phone auth light: 412 by 915, DPR 2.625
- Android phone auth dark: 412 by 915, DPR 2.625
- Android tablet language system: 800 by 1280, DPR 2
- Android tablet auth dark: 800 by 1280, DPR 2

Global lint:

- `npm run lint` should be green in a clean repo.
- On 2026-06-14 it was not Android-entry PASS evidence because it failed on
  unrelated workspace files:
  - `e2e/helpers/zenflowV2State.ts`: redundant Boolean call
  - `ios/App/CapApp-SPM/.build/.../native-bridge.js`: generated iOS SPM
    artifacts with stale eslint-disable/rule references

## Baseline Evidence

Evidence directory:

- `output/playwright/android-entry-20260614/`

Retention note:

- `output/playwright/*/` is ignored by `.gitignore`.
- `android/app/build/` is ignored by `android/.gitignore`.
- A clean checkout or forked agent may not contain these local artifacts. If the
  files are missing, regenerate them with the Verification Contract commands
  before claiming Android PASS.

Facts file:

- `output/playwright/android-entry-20260614/facts.json`
- SHA-256:
  `a305e6e9ed76249f63dddf3b4ede4204706fbf2c67e7ab9cd68f5c4692b47d6b`

Verification log:

- `output/playwright/android-entry-20260614/verification-log-20260614.txt`
- SHA-256:
  `830952d4ed3cbb9c88ece17b2f4695bf03ac47d5f903f8f78031fe6f8172f264`

Screenshots:

- `output/playwright/android-entry-20260614/android-phone-language-light.png`
- `output/playwright/android-entry-20260614/android-phone-language-dark.png`
- `output/playwright/android-entry-20260614/android-phone-language-ar-rtl.png`
- `output/playwright/android-entry-20260614/android-phone-auth-light.png`
- `output/playwright/android-entry-20260614/android-phone-auth-dark.png`
- `output/playwright/android-entry-20260614/android-tablet-language-system.png`
- `output/playwright/android-entry-20260614/android-tablet-auth-dark.png`

Screenshot hashes:

- `android-phone-language-light.png`:
  `cd93911db1620281fc3fbc038ccd611d96698e06edd74a13cfc9a7f6c717aeac`
- `android-phone-language-dark.png`:
  `5e4fea1c034c1665b2587f118658600f617f6254059dc45df4d4bdcc38df475e`
- `android-phone-language-ar-rtl.png`:
  `8f43cab3814edfb2b00773ec1a9eb3faa134dea45f5130efa31fe7e0bcce20d7`
- `android-phone-auth-light.png`:
  `6fb692b91180fbdb5acdd8c991cd41a9ca98b1e4ee81941193031152ab68b968`
- `android-phone-auth-dark.png`:
  `27cbab0662cf0704908abe3e9b3b3e32601f57948a4d1c9f61d2edc5e42e1998`
- `android-tablet-language-system.png`:
  `f388e866e27237948e5336c3b99cda4e0a7415776b86fdff0e778b08b2b8e607`
- `android-tablet-auth-dark.png`:
  `e3ceaa99700c8fa90622e42113f1bafc2ed7b1b5041d051fe5f160c37013e0c2`

Native APK:

- `android/app/build/outputs/apk/debug/app-debug.apk`
- Size: 24 MB
- SHA-256:
  `101a9bde02ffa1d9f5d31f67dc5e275538f2acb2e0afe53e9b9c41637cb0fb49`

Baseline facts:

- 7 visual scenarios passed.
- Document horizontal overflow: false in all scenarios.
- Screen horizontal overflow: false in all scenarios.
- Out-of-bounds audited elements: 0 in all scenarios.
- Logo natural size: 512 by 512 in all scenarios.
- Background: 0 stars, 0 old flow marks, 3 ripples, 7 orbs, 3 flow ribbons.
- Theme switcher: present in all scenarios.
- Language option count: 8 on language scenarios.
- Auth provider ids: `google`, `facebook`, `telegram` on auth scenarios.
- Provider icon center spread: 0 on auth scenarios.
- Telegram: `viewBox="0 0 128 128"` with `#2AABEE` and `#229ED9`.
- Arabic RTL continue arrow: `matrix(-1, 0, 0, 1, 0, 0)`.

## Verification Results On 2026-06-14

PASS:

- Focused entry tests: 4 files passed, 14 tests passed.
- Typecheck: exit 0.
- Color check: exit 0, no hardcoded colors found.
- Scoped entry lint: exit 0.
- Web production build: exit 0.
- Android build: exit 0.
- `npx cap sync android`: exit 0, 11 Capacitor Android plugins found.
- Android native debug build: `BUILD SUCCESSFUL`, 428 actionable tasks executed.
- APK generated and hashed.
- Android visual matrix: 7/7 PASS.
- Command-output evidence is preserved in
  `output/playwright/android-entry-20260614/verification-log-20260614.txt`.

UNVERIFIED:

- Physical Android device or emulator runtime interaction. `adb devices` started
  the daemon but returned an empty device list.
- Global repo lint. It failed on unrelated existing workspace files listed in
  the Verification Contract section.

Warnings observed, not Android entry blockers:

- Gradle warned that `flatDir` should be avoided.
- `@capgo/capacitor-social-login` Facebook provider removal warning.
- `android:extractNativeLibs` manifest warning.
- Deprecated APIs in third-party Capacitor/AdMob/FileSystem plugins.
- One native library could not be stripped and was packaged as-is.

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
4. Run focused tests, Android visual proof, `build:android`, `cap sync android`,
   and Gradle debug build after edits.
5. Mark real device/emulator runtime as `UNVERIFIED` unless a device is attached
   and actually exercised.

If a requested change only targets another platform, do not adjust Android entry
behavior without explicit user approval.

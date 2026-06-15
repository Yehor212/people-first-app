# ZenFlow iOS Entry Gate Contract

Last verified: 2026-06-14

This document freezes the intended iOS/WKWebView behavior for the ZenFlow entry
gate. It covers the first-run language screen and the following sign-in screen.
Future agents must treat this page as a verified platform contract, not as a
generic auth screen that can be restyled without iOS evidence.

## Scope

Applies:

- iPhone and iPad entry gate in iOS Safari-like viewports and Capacitor
  WKWebView.
- `LanguageSelector` before the user has selected a language.
- `AuthScreen` after language selection when the user has no valid session and
  auth has not been completed or bypassed.
- Light, dark, and system entry themes.
- LTR and RTL entry layouts for the supported languages.

Does not apply:

- The V2 orb app shell after the user passes entry gates.
- Android, Desktop/Tauri, and PWA-specific entry proof. Those platforms need
  their own contract before being declared frozen.
- Local development bypass with `?dev=true`; that query skips the entry gates
  and must not be used as entry-gate verification.

## Source Files

Entry orchestration:

- `src/components/AuthGate.tsx`

Shared visual system:

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

Regression tests:

- `src/components/__tests__/EntryGate.safeArea.test.ts`
- `src/components/__tests__/LanguageSelector.test.tsx`
- `src/components/auth-screen/__tests__/AuthScreen.providers.test.tsx`
- `src/components/__tests__/AuthGate.test.tsx`

## Gate Flow

`AuthGate` controls the sequence. Order matters and must stay explicit:

1. Initialization or splash state renders before all entry pages.
2. Desktop runtime bypasses interactive entry gates.
3. If `hasSelectedLanguage` is false, render `LanguageSelector`.
4. If language is selected and `googleAuthChecked` is false, `authBypassFlag` is
   false, and `hasValidSession === false`, render `AuthScreen`.
5. Tutorial, onboarding, notification permission, and the app shell render only
   after those gates pass.

Do not move the language and auth checks below tutorial/onboarding checks. That
would change first-run behavior and requires new cross-platform proof.

## Element Inventory

### Root Screen

Selector and class:

- `main.entry-gate-screen`
- `data-testid="language-selector-screen"` on the language page
- `data-testid="auth-screen"` on the auth page

Responsibilities:

- Own the full iOS viewport.
- Use `min-height: 100svh` and `min-height: 100dvh`.
- Respect iOS safe areas through `--entry-safe-*` variables.
- Prevent horizontal overflow with `overflow-x-hidden`.
- Allow vertical scrolling with `overflow-y-auto`.
- Keep the content centered on iPad through the existing responsive max-widths.

Required viewport meta:

- `index.html` must keep `width=device-width`.
- `index.html` must keep `initial-scale=1.0`.
- `index.html` must keep `maximum-scale=5.0` and `user-scalable=yes`.
- `index.html` must keep `viewport-fit=cover`.
- `index.html` must keep `interactive-widget=resizes-content`.

### Background

Files:

- `src/components/EntryGate.css`
- `src/components/EntryGateBackdrop.tsx`

Allowed visual layers:

- One `.entry-gate-aurora` layer with `inset: 0`.
- Seven soft orb points from `EntryGateBackdrop`.
- Three soft ripple layers from `EntryGateBackdrop`.
- Three soft flow-ribbon layers from `EntryGateBackdrop`.

Forbidden without explicit approval and fresh iOS proof:

- Sparkles, stars, magic/starburst glyphs, or typical AI decorative icons.
- Decorative layers with negative full-viewport `inset`.
- Decorative layers with transform-based viewport expansion that increases
  `document.documentElement.scrollWidth`.
- Background elements that become the widest element on the page.

Motion rules:

- Background motion must be disabled by `shouldAnimate()`, `body.reduce-motion`,
  `:root[data-runtime-perf]`, or `prefers-reduced-motion: reduce`.
- Keep `-webkit-backdrop-filter` whenever `backdrop-filter` is used.

### Brand Logo

File:

- `src/components/ZenFlowBrandMark.tsx`

Contract:

- Source must be `icon-source.svg` through `zenFlowBrandMarkSrc`.
- Render size on iPhone baseline is 72px by 72px.
- Intrinsic image size must remain at least 512px by 512px in current evidence.
- The old leaf-only temporary icon must not be reintroduced.
- The image must be eager enough for entry render: `loading="eager"` and
  `decoding="async"` are intentional.

Regression symptoms:

- Broken image corner, missing logo, or `naturalWidth` below 256.
- Logo source not ending in `/people-first-app/icon-source.svg`.
- Logo clipped by safe area, title, or top viewport edge.

### Heading

Language page:

- `id="language-selector-title"`
- Text from `t.welcomeTitle`

Auth page:

- `id="auth-title"`
- Text from `t.authWelcomeTitle`

Contract:

- Large but bounded: `max-w-xs` on phone and wider on tablet.
- Must not overlap the logo, theme switcher, or auth panel.
- Must pass for `en`, `ar`, and other supported languages before claiming i18n
  safety.

### Theme Switcher

File:

- `src/components/EntryThemeSwitcher.tsx`

Options:

- Light: store preference `paper`, legacy preference `light`
- Dark: store preference `ink`, legacy preference `dark`
- System: store preference `auto`, legacy preference `system`

Contract:

- Always visible on both language and auth pages.
- `role="radiogroup"` with radio buttons.
- Each control has `min-h-[44px]`.
- Selected state uses theme tokens, not hardcoded app colors.
- Text may truncate, but the control must not wrap into overlapping rows on
  iPhone width.

### Language Grid

File:

- `src/components/LanguageSelector.tsx`

Languages:

- `en`, `uk`, `es`, `de`, `fr`, `ja`, `ar`, `he`

Contract:

- Exactly 8 language choices until product explicitly changes supported entry
  languages.
- Phone layout is 2 columns.
- Tablet layout is 4 columns.
- Each language option is a radio button with `aria-checked`.
- Each option has `min-h-14`, which is above the project 44px minimum target.
- Selected option shows the check icon.
- Arabic and Hebrew labels render with `dir="rtl"` inside the button.
- Continue arrow flips in RTL through `rtl:scale-x-[-1]`.

Regression symptoms:

- A supported language missing from first run.
- Arabic or Hebrew text forced LTR.
- Continue arrow points the wrong direction in RTL.
- Language buttons extend outside the viewport.

### Continue Button

File:

- `src/components/LanguageSelector.tsx`

Contract:

- Single full-width primary action.
- `data-testid="language-continue"`.
- `type="button"`.
- Touch target is at least 44px tall.
- It must only call `onComplete` after language selection state is updated.
- It must reset entry scroll before leaving the language screen.

### Auth Panel

File:

- `src/components/auth-screen/AuthScreen.tsx`

Contract:

- Panel uses `.entry-glass-panel`.
- Title is `t.authContinueWith`.
- `aria-busy` reflects auth session loading.
- Social provider order is controlled by `AUTH_SCREEN_PROVIDER_IDS`.
- Provider buttons remain the primary visible auth controls.
- Legal and privacy text remain below the panel and must not overlap it.

Phone auth:

- `SHOW_PHONE_AUTH` is false in the current contract.
- If enabled later, it is a scope change that needs fresh iOS proof and provider
  flow tests.

### Auth Provider Buttons

Files:

- `src/components/auth/AuthProviderButton.tsx`
- `src/lib/authProviders.ts`

Current entry providers:

- Google
- Facebook, gated by `ENABLE_FACEBOOK_AUTH`
- Telegram, gated by `ENABLE_TELEGRAM_AUTH`

Contract:

- Buttons are at least 56px tall in the entry auth screen.
- Button content uses the three-column grid:
  `grid-cols-[2rem_minmax(0,1fr)_2rem]`.
- Left provider icon rail and right spacer rail must remain symmetric.
- `iconCenterSpread` must stay 0 in iOS visual evidence.
- Google, Facebook, and Telegram icons must all render at `h-6 w-6`.
- Facebook icon uses the official blue circle treatment in code.
- Telegram icon uses `viewBox="0 0 128 128"` with gradient stops
  `#2AABEE` and `#229ED9`.
- Provider brand colors are allowed only inside provider logo SVGs.

Regression symptoms:

- Only Google has a visible logo.
- Telegram icon looks like a generic paper plane or is not centered.
- Provider labels shift because one icon is wider or narrower than the others.
- Provider order changes without product approval.

## iOS Layout Invariants

These facts must remain true before any future agent claims the iOS entry gate is
unchanged or safe:

- `document.documentElement.scrollWidth === window.innerWidth`.
- `main.entry-gate-screen.getBoundingClientRect().width === window.innerWidth`.
- No audited entry element has `left < 0` or `right > viewportWidth`.
- Important content stays inside safe areas on iPhone and iPad.
- No full-screen decorative element creates horizontal overflow.
- Both entry pages use `icon-source.svg`.
- Background has 0 star glyphs and 0 old flow-mark glyphs.
- Background has 3 ripples, 7 orb points, and 3 flow ribbons in the current implementation.
- Theme switcher exists on both entry pages.
- Language screen has 8 options.
- Auth screen has the enabled social providers in configured order.
- Telegram icon exists when Telegram auth is enabled and matches the current SVG
  contract.
- Arabic/Hebrew RTL checks include both text direction and arrow direction.

## Internet Basis

Use these primary references when changing this page:

- Apple Human Interface Guidelines, Layout:
  https://developer.apple.com/design/human-interface-guidelines/layout
- WebKit, Designing Websites for iPhone X:
  https://webkit.org/blog/7929/designing-websites-for-iphone-x/
- MDN, Viewport meta tag:
  https://developer.mozilla.org/en-US/docs/Web/HTML/Reference/Elements/meta/name/viewport
- MDN, CSS `env()`:
  https://developer.mozilla.org/en-US/docs/Web/CSS/env
- W3C WCAG 2.2, Target Size Minimum:
  https://www.w3.org/WAI/WCAG22/Understanding/target-size-minimum.html

Operational translation for this project:

- Follow Apple/WebKit safe-area guidance: use `viewport-fit=cover` only together
  with safe-area padding on content containers.
- Follow WebKit's `max()` pattern: safe-area insets are not a replacement for
  regular margins.
- Follow MDN viewport guidance: keep `width=device-width`, zoom enabled, and
  `interactive-widget=resizes-content` for keyboard-aware layout.
- Follow MDN `env()` guidance: every safe-area usage should include a fallback.
- Follow W3C as the minimum accessibility floor and this repo as the stricter
  rule: interactive entry targets must be at least 44px tall.

## Verification Contract

Run these before claiming the iOS entry gate is still valid after any UI,
layout, auth-provider, theme, logo, i18n, or motion change.

Local quality checks:

```bash
npm run typecheck
npm run lint
npm run check:colors
npm run build
```

Focused tests:

```bash
npm run test -- src/components/__tests__/EntryGate.safeArea.test.ts src/components/__tests__/LanguageSelector.test.tsx src/components/auth-screen/__tests__/AuthScreen.providers.test.tsx src/components/__tests__/AuthGate.test.tsx
```

iOS sync and native compile:

```bash
npm run cap:sync:ios
xcodebuild -project ios/App/App.xcodeproj -scheme App -sdk iphonesimulator -destination 'generic/platform=iOS Simulator' -configuration Debug CODE_SIGNING_ALLOWED=NO build
```

Security:

```bash
npm audit --audit-level=high
```

Snyk:

- Preferred: `snyk_code_scan` MCP tool when callable.
- Fallback: local Snyk CLI against the scoped changed-code path.
- If the org does not have Snyk Code enabled, mark Snyk Code as
  `UNVERIFIED`; do not call it PASS.

Visual proof:

- Use a production-equivalent local build or preview.
- Cover at minimum:
  - iPhone language light, 390 by 844, DPR 3
  - iPhone language Arabic RTL, 390 by 844, DPR 3
  - iPhone auth light, 390 by 844, DPR 3
  - iPhone auth dark, 390 by 844, DPR 3
  - iPad language system, 768 by 1024, DPR 2
  - iPad auth light, 768 by 1024, DPR 2
- Capture screenshots and a JSON facts file.
- The facts file must assert:
  - no document horizontal overflow
  - no screen horizontal overflow
  - 0 out-of-bounds audited elements
  - logo loaded with natural size
  - 0 stars and 0 flow marks
  - 3 ripples, 7 orbs, and 3 flow ribbons
  - theme switcher present
  - 8 language options on the language screen
  - auth providers visible on the auth screen
  - provider icon center spread equals 0
  - Telegram SVG contract is true when Telegram is enabled
  - RTL arrow transform is mirrored for Arabic/Hebrew

## Baseline Evidence

Evidence directory:

- `output/playwright/ios-entry-single-platform-20260614-final/`

Facts file:

- `output/playwright/ios-entry-single-platform-20260614-final/facts.json`
- SHA-256:
  `8077d3a33f883c81c007e531e52f7e342ea7f182618886ab10010a2279dcf1a9`

Screenshots:

- `output/playwright/ios-entry-single-platform-20260614-final/iphone-language-light.png`
- `output/playwright/ios-entry-single-platform-20260614-final/iphone-language-ar-rtl.png`
- `output/playwright/ios-entry-single-platform-20260614-final/iphone-auth-light.png`
- `output/playwright/ios-entry-single-platform-20260614-final/iphone-auth-dark.png`
- `output/playwright/ios-entry-single-platform-20260614-final/ipad-language-system.png`
- `output/playwright/ios-entry-single-platform-20260614-final/ipad-auth-light.png`

Baseline facts:

- 6 scenarios passed.
- Document horizontal overflow: false in all scenarios.
- Screen horizontal overflow: false in all scenarios.
- Out-of-bounds audited elements: 0 in all scenarios.
- Logo source: `/people-first-app/icon-source.svg`.
- Logo natural size: 512 by 512.
- Background: 0 stars, 0 old flow marks, 3 ripples, 7 orbs, 3 flow ribbons.
- Theme switcher: present in all scenarios.
- Language option count: 8 on language scenarios.
- Auth provider ids: `google`, `facebook`, `telegram` on auth scenarios.
- Provider icon center spread: 0 on auth scenarios.
- Telegram: `viewBox="0 0 128 128"` with `#2AABEE` and `#229ED9`.
- Arabic RTL continue arrow: `matrix(-1, 0, 0, 1, 0, 0)`.

## Change Control

Allowed without product approval, if all verification above still passes:

- Copy translation improvements that preserve layout and direction.
- Minor theme-token tuning inside existing token usage.
- Test-only improvements that increase coverage without changing behavior.

Requires explicit approval and fresh iOS evidence:

- Replacing the logo asset or source path.
- Adding, removing, or reordering entry auth providers.
- Enabling phone auth.
- Changing first-run gate order.
- Moving the theme switcher.
- Replacing the background concept.
- Adding decorative stars, sparkle glyphs, or generic AI-style symbols.
- Removing `viewport-fit=cover`.
- Removing safe-area variables or fallbacks.
- Replacing `100svh`/`100dvh` with only `100vh`.
- Adding full-screen decorative layers that use negative insets or horizontal
  transforms.
- Changing language count or supported language set.
- Changing provider icon layout away from the symmetric rail grid.

## Agent Handoff Rule

Before editing any file listed in this document, future agents must:

1. Read this document.
2. Read `AGENTS.md` and `ARCHITECTURE.md`.
3. State whether the change touches iOS entry layout, auth logic, i18n, motion,
   or branding.
4. Run the relevant tests and browser/native proof after the edit.
5. Mark any skipped platform or scanner as `UNVERIFIED`, not PASS.

If a requested change only targets another platform, do not adjust this iOS entry
gate unless the user explicitly asks for an iOS change.

# ZenFlow iOS Entry Gate Contract

Last verified: 2026-06-15

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
- `src/lib/__tests__/localNotifications.test.ts`
- `test/ios-info-plist.test.ts`
- `e2e/entry-gate-ios.spec.ts`

Native startup configuration:

- `ios/App/App/Info.plist`
- `src/lib/localNotifications.ts`

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

## Native Startup Blockers

These are part of the iOS entry contract because they can prevent the entry UI
from appearing even when the React screens are visually correct.

AdMob app id:

- `ios/App/App/Info.plist` must declare `GADApplicationIdentifier`.
- The value must match `ca-app-pub-XXXXXXXXXXXXXXXX~XXXXXXXXXX`.
- The current local/simulator-safe value is Google's public iOS test app id:
  `ca-app-pub-3940256099942544~1458002511`.
- Do not copy the Android sample app id
  `ca-app-pub-3940256099942544~3347511713` into iOS.
- Regression test: `test/ios-info-plist.test.ts`.

Notification permission:

- Background reminder scheduling must not call
  `LocalNotifications.requestPermissions()`.
- The only acceptable native permission prompt trigger is an explicit user
  action from the notification permission/settings UI.
- The first-run language screen must not be covered by the iOS notification
  system alert.
- Regression test: `src/lib/__tests__/localNotifications.test.ts`.

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
- Three low-contrast caustic light fields from `EntryGateBackdrop`.
- Four subtle current strokes from `EntryGateBackdrop`.
- One horizon wash layer from `EntryGateBackdrop`.

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
- SVG source must declare `width="512"`, `height="512"`, and
  `viewBox="0 0 512 512"`.
- WebKit may report SVG `naturalWidth` as the rendered CSS size; use the SVG
  declaration plus rendered size for iOS proof.
- The old leaf-only temporary icon must not be reintroduced.
- The image must be eager enough for entry render: `loading="eager"` and
  `decoding="async"` are intentional.

Regression symptoms:

- Broken image corner, missing logo, or rendered logo below 64px by 64px.
- SVG source missing 512 by 512 declaration or `0 0 512 512` viewBox.
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
- Any supported entry language creates iPhone horizontal overflow or a continue
  button below the 44px touch-target floor.

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
- `icon-source.svg` declares 512 by 512 and renders at least 64px by 64px in
  iOS entry evidence.
- Background has 0 star glyphs and 0 old flow-mark glyphs.
- Background has 3 ripples, 7 orb points, 3 flow ribbons, 3 caustic fields,
  4 current strokes, and 1 horizon wash in the current implementation.
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
npm run test -- src/components/__tests__/EntryGate.safeArea.test.ts src/components/__tests__/LanguageSelector.test.tsx src/components/auth-screen/__tests__/AuthScreen.providers.test.tsx src/components/__tests__/AuthGate.test.tsx src/lib/__tests__/localNotifications.test.ts test/ios-info-plist.test.ts
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
  - iPhone language Hebrew RTL, 390 by 844, DPR 3
  - iPhone auth light, 390 by 844, DPR 3
  - iPhone auth dark, 390 by 844, DPR 3
  - iPad language system, 768 by 1024, DPR 2
  - iPad language dark, 768 by 1024, DPR 2
  - iPad auth light, 768 by 1024, DPR 2
  - iPad auth dark, 768 by 1024, DPR 2
- Also run the compact all-language iPhone WebKit smoke for `en`, `uk`, `es`,
  `de`, `fr`, `ja`, `ar`, and `he`.
- Capture screenshots and a JSON facts file.
- The facts file must assert:
  - no document horizontal overflow
  - no screen horizontal overflow
  - 0 out-of-bounds audited elements
  - logo loaded from `icon-source.svg`
  - logo SVG declares 512 by 512 and `viewBox="0 0 512 512"`
  - logo rendered size is at least 64px by 64px
  - 0 stars and 0 flow marks
  - 3 ripples, 7 orbs, 3 flow ribbons, 3 caustic fields, 4 current strokes,
    and 1 horizon wash
  - theme switcher present
  - 8 language options on the language screen
  - auth providers visible on the auth screen
  - provider icon center spread equals 0
  - Telegram SVG contract is true when Telegram is enabled
  - RTL arrow transform is mirrored for Arabic/Hebrew

## Baseline Evidence

Evidence directory:

- `output/playwright/ios-entry-20260615/`

Facts file:

- `output/playwright/ios-entry-20260615/facts.json`
- SHA-256:
  `41b58a8563b164b0b179ccb853ec2e408be6a9878cdd60405f1f61a71ba30730`

Verification log:

- `output/playwright/ios-entry-20260615/verification-log-20260615.txt`
- SHA-256:
  `391d394b3641a1e794da04070a06985f658be215a00ba5a2c485e77fb3bdbc6d`

Screenshots:

- `output/playwright/ios-entry-20260615/iphone-language-light.png`
  SHA-256:
  `9c71d5c853b94f05dd7c848078050f246d5a83373917405f0203ea56ea22a025`
- `output/playwright/ios-entry-20260615/iphone-language-ar-rtl.png`
  SHA-256:
  `c8eb36a201d58046aafa21e09f5ea1a3aaba128831747933da81a89cdecfbf73`
- `output/playwright/ios-entry-20260615/iphone-language-he-rtl.png`
  SHA-256:
  `e80d7a382179aff1231d846959ff5d6db4f29a35c63bde0aebababc29ca21567`
- `output/playwright/ios-entry-20260615/iphone-auth-light.png`
  SHA-256:
  `1d071f22cffc9103bb1a9bb3cd1dfd1e4566d4fced6bc65c68ac64ae78a62c5e`
- `output/playwright/ios-entry-20260615/iphone-auth-dark.png`
  SHA-256:
  `d7bdcf7547f95f3a160b6664007087697abc1537d90cd5d553ddf2f6d000732d`
- `output/playwright/ios-entry-20260615/ipad-language-system.png`
  SHA-256:
  `38ded1bdc152822a463144758cc1d02065f33d601a66331db81e20c89921ed6b`
- `output/playwright/ios-entry-20260615/ipad-language-dark.png`
  SHA-256:
  `124808e5ffef72126642a147e41ed8d344e2f26af91a4a400efab03d34182a29`
- `output/playwright/ios-entry-20260615/ipad-auth-light.png`
  SHA-256:
  `29f58fed61267204e50e69b0b6a1f52a63bac300871f2d2ba7f1495bbc94f8f8`
- `output/playwright/ios-entry-20260615/ipad-auth-dark.png`
  SHA-256:
  `002e8ce3d51b90d9be1711a0892b3f4b51470e58e21750eef45104e707254c14`

Baseline facts:

- 9 screenshot scenarios passed in WebKit over local HTTPS.
- The same run also passed the compact iPhone WebKit all-language smoke for
  `en`, `uk`, `es`, `de`, `fr`, `ja`, `ar`, and `he`.
- Document horizontal overflow: false in all scenarios.
- Screen horizontal overflow: false in all scenarios.
- Out-of-bounds audited elements: 0 in all scenarios.
- Logo source: `/people-first-app/icon-source.svg`.
- Logo rendered size: 72 by 72.
- Logo SVG: `width="512"`, `height="512"`, `viewBox="0 0 512 512"`.
- Background: 0 stars, 0 old flow marks, 3 ripples, 7 orbs, 3 flow ribbons,
  3 caustic fields, 4 current strokes, 1 horizon wash.
- Theme switcher: present in all scenarios.
- Language option count: 8 on language scenarios.
- Auth provider ids: `google`, `facebook`, `telegram` on auth scenarios.
- Provider icon center spread: 0 on auth scenarios.
- Telegram: `viewBox="0 0 128 128"` with `#2AABEE` and `#229ED9`.
- Arabic RTL continue arrow: `matrix(-1, 0, 0, 1, 0, 0)`.
- Hebrew RTL continue arrow: `matrix(-1, 0, 0, 1, 0, 0)`.
- iPad dark coverage includes both language and auth pages.
- Local iOS WebKit proof used HTTPS because the app CSP intentionally contains
  `upgrade-insecure-requests`; HTTP preview makes WebKit upgrade local asset
  URLs to HTTPS and leaves the app blank.
- Console noise remains limited to WebKit ignoring `interactive-widget` in the
  viewport meta and local Supabase preconnect DNS failure. No failed resource
  requests were recorded in the 8-scenario WebKit matrix.

Shared EntryGate CSS refresh on 2026-06-15:

- This refresh supersedes the WebKit screenshot hashes above for the current
  shared `EntryGate.css`, `LanguageSelector`, and `AuthScreen` compact-height
  pass.
- `npm run cap:sync:ios` passed first, copying the current Vite build into
  `ios/App/App/public`.
- HTTPS native-bundle helper:
  `PORT=4222 node e2e/helpers/ios-diary/serve-ios-spa.mjs`
- Command:
  `ZENFLOW_PLAYWRIGHT_BASE_URL=https://127.0.0.1:4222/people-first-app/ npx playwright test e2e/entry-gate-ios.spec.ts --project=chromium --reporter=line --workers=1`
- Result: 2/2 tests passed, covering 9 WebKit visual scenarios plus iPhone
  all-language smoke.
- Facts SHA-256:
  `dc1fa9a3772f292ff0a9be480ba1feac89729cb384f9c55d1eb158d9a12d1862`
- Verification log SHA-256:
  `245bfe4d00fe7c0ca8badb94d421e89862f8a19ae7c46ce86164ff7189259649`
- Fresh screenshot hashes:
  `iphone-language-light=8d8c2174a7796bcbacd5d064771a58fee16b4d30c64c6e8bdaa38e0e855ff553`,
  `iphone-language-ar-rtl=07ffdab194220a430b5439bdc112bb0a6b0c236eb3435a7040e2be992d46b570`,
  `iphone-language-he-rtl=882e1630136da3cd94cdd04b6ae3a54f45dc73e8b4835699f728f7f68fb40ffc`,
  `iphone-auth-light=0f2a7e5227fdfedf95b6407c1a15e2b1fdf1cff80f3034748fc7487d2268aad6`,
  `iphone-auth-dark=ee62ad7bd9c1d14d1fa16d9724f3dd2d16d5d177a977638855a4f9d329375608`,
  `ipad-language-system=3741e7beec025c81a7d25a13a531defcef8d641d538bff5fc3d7e2a01989ae6f`,
  `ipad-language-dark=695585e9bd205e257ca177619911b4e63fa01103922906547f6c942a075dee62`,
  `ipad-auth-light=89b085af0cac0f9a1f7169785b827e17859c9abd35eeb5bc80269314ba824bb2`,
  `ipad-auth-dark=002e8ce3d51b90d9be1711a0892b3f4b51470e58e21750eef45104e707254c14`.
- Refresh facts: horizontal overflow false, out-of-bounds audited elements 0,
  failed network requests 0, provider icon center spread 0, Telegram viewBox
  `0 0 128 128`, and 0 star/generic AI marks.
- Console caveat: each WebKit scenario still records two local console errors:
  WebKit ignores the `interactive-widget` viewport argument, and local DNS
  cannot resolve the Supabase preconnect host. These are not layout blockers,
  but they must not be claimed as `console=0` evidence.
- Failure handling: running the iOS spec against plain HTTP preview produced a
  blank WebKit page. The root cause matches the HTTPS requirement above; the
  proof was rerun against the synced iOS bundle over HTTPS and passed.

Native iPhone runtime evidence, 2026-06-15:

- Red test before fix:
  `npx vitest run --configLoader runner test/ios-info-plist.test.ts`
  failed because `GADApplicationIdentifier` was missing.
- Red test before fix:
  `npx vitest run --configLoader runner src/lib/__tests__/localNotifications.test.ts`
  failed because `scheduleLocalReminders` called
  `LocalNotifications.requestPermissions()`.
- Green focused tests:
  `npx vitest run --configLoader runner src/lib/__tests__/localNotifications.test.ts test/ios-info-plist.test.ts`
  passed: 2 files, 3 tests.
- `npm run cap:sync:ios` passed.
- `xcodebuild -project ios/App/App.xcodeproj -scheme App -sdk iphonesimulator -destination 'platform=iOS Simulator,name=iPhone 17e,OS=26.5' -configuration Debug -derivedDataPath output/ios-sim-derived CODE_SIGNING_ALLOWED=NO build`
  passed.
- Built app plist proof:
  `plutil -extract GADApplicationIdentifier raw output/ios-sim-derived/Build/Products/Debug-iphonesimulator/App.app/Info.plist`
  returned `ca-app-pub-3940256099942544~1458002511`.
- Simulator launch proof: `xcrun simctl launch ... com.zenflow.app`
  returned PID `42059`; `ps -p 42059` showed the process still alive after
  screenshot capture.
- No newer `App-*.ips` crash reports appeared after launch; latest crash reports
  remained `2026-06-15T03:24:12` and `2026-06-15T03:22:50`.
- Native screenshot:
  `output/native-ios-20260615/iphone-17e-native-entry-no-notification-prompt.png`
- Native screenshot SHA-256:
  `afa56d969e0b5d286334348b5b2d32738b01c47f92f1a874df8a4b5ba0131fed`.

Current native compile evidence, 2026-06-15:

- `npm run cap:sync:ios` passed after the WebKit matrix was added.
- `xcodebuild -project ios/App/App.xcodeproj -scheme App -sdk iphonesimulator -destination 'generic/platform=iOS Simulator' -configuration Debug CODE_SIGNING_ALLOWED=NO build`
  passed with `** BUILD SUCCEEDED **`.
- This current compile proof does not replace a real simulator/device launch
  screenshot; it only proves the current iOS bundle builds.

Remaining native iOS visual risk:

- The iPhone 17e native screenshot proves the entry screen appears without the
  notification system alert, but it does not replace the full eight-scenario
  Playwright visual matrix above.
- Full-bleed status-bar/native safe-area polish is not frozen by this addendum;
  changing global iOS `contentInset` or status-bar behavior requires a separate
  native layout change notice and fresh iPhone plus iPad screenshots.

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

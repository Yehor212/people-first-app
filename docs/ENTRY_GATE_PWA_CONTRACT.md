# ZenFlow PWA Entry Gate Contract

Last verified: 2026-06-16

Current local contract revision: 2026-08-04. The manifest/icon rules below are
superseded by the bounded macOS/Windows PWA modernization packet in
[`specs/002-pwa-desktop-modernization`](../specs/002-pwa-desktop-modernization/spec.md).
Public deployment, real launcher installation, and real mobile safe-area proof
remain `UNVERIFIED`; the older evidence sections in this document do not prove
the revised artifact.

This document freezes the PWA-facing behavior for the ZenFlow first-run
language screen and the following sign-in screen. It is intentionally scoped to
the installable web app surface and must not be used to claim native Android,
iOS, or Desktop/Tauri runtime proof.

Freshness note:

- The latest local PWA verification and the current public GitHub Pages drift
  are tracked in `docs/ENTRY_GATE_PUBLIC_DEPLOYMENT_STATUS.md`.
- The evidence section below is a platform contract snapshot from 2026-06-15;
  generated asset hashes can change after unrelated production rebuilds.

## Fresh Verification Addendum - 2026-06-16

Command:

```bash
ZENFLOW_PLAYWRIGHT_BASE_URL=http://127.0.0.1:4232/people-first-app/ npx playwright test e2e/entry-gate-pwa.spec.ts --project=chromium --reporter=line --workers=1
```

Result: PASS as part of the combined PWA/Desktop run, 5 tests passed.

Evidence:

- Facts: `output/playwright/pwa-entry-20260615/facts.json`
- Facts SHA-256: `30b0ff2ac5a8edf6b5a00f13bd610e8b088857211fcce0788650d3236d8c4695`
- Verification log: `output/playwright/pwa-entry-20260615/verification-log-20260615.txt`
- Verification log SHA-256: `6bfcecf92328512dde1284d6941f2b081516c6f61049f78c2877c3c382288c10`

Scenario summary:

- `pwa-phone-language-light`: language-selector-screen, logo 512x512/72x72, background 7/3/3/3/4/1, forbidden marks 0, providers n/a, overflow false/false.
- `pwa-phone-language-dark`: language-selector-screen, logo 512x512/72x72, background 7/3/3/3/4/1, forbidden marks 0, providers n/a, overflow false/false.
- `pwa-phone-language-ar-rtl`: language-selector-screen, logo 512x512/72x72, background 7/3/3/3/4/1, forbidden marks 0, providers n/a, overflow false/false.
- `pwa-phone-language-he-rtl`: language-selector-screen, logo 512x512/72x72, background 7/3/3/3/4/1, forbidden marks 0, providers n/a, overflow false/false.
- `pwa-phone-auth-light`: auth-screen, logo 512x512/72x72, background 7/3/3/3/4/1, forbidden marks 0, providers google, facebook, telegram, overflow false/false.
- `pwa-phone-auth-dark`: auth-screen, logo 512x512/72x72, background 7/3/3/3/4/1, forbidden marks 0, providers google, facebook, telegram, overflow false/false.
- `pwa-tablet-language-system`: language-selector-screen, logo 512x512/72x72, background 7/3/3/3/4/1, forbidden marks 0, providers n/a, overflow false/false.
- `pwa-desktop-language-light`: language-selector-screen, logo 512x512/72x72, background 7/3/3/3/4/1, forbidden marks 0, providers n/a, overflow false/false.
- `pwa-desktop-auth-dark`: auth-screen, logo 512x512/72x72, background 7/3/3/3/4/1, forbidden marks 0, providers google, facebook, telegram, overflow false/false.

## Scope

Applies:

- Production-built web assets served from `/people-first-app/`.
- PWA manifest and generated service worker assets.
- Mobile, tablet, and desktop standalone display-mode viewport checks.
- `LanguageSelector` before the user has selected a language.
- `AuthScreen` after language selection when the user has no valid session and
  auth has not been completed or bypassed.
- Light, dark, and system entry themes.
- RTL spot-checks for Arabic and Hebrew.

Does not apply:

- Real installed PWA launch from a home screen or desktop launcher.
- Android Capacitor or iOS WKWebView native shells.
- Desktop/Tauri native runtime.
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

PWA assets:

- `index.html`
- `vite.config.ts`
- `public/offline.html`
- `public/runtime-perf-bootstrap.js`
- `dist/manifest.webmanifest` (generated verification asset)
- `dist/sw.js` (generated verification asset)
- `dist/registerSW.js` (generated verification asset)
- `dist/offline.html` (generated verification asset)
- `dist/version.json` (generated verification asset)
- `dist/version-check.js` (generated verification asset, not precached)

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
- `src/components/auth/AuthProviderButton.tsx`
- `src/lib/authProviders.ts`

Regression tests:

- `e2e/entry-gate-pwa.spec.ts`

## PWA Asset Contract

Manifest:

- Path in fresh production verification: `dist/manifest.webmanifest`
- `name`: `ZenFlow - Daily Wellness`
- `short_name`: `ZenFlow`
- `start_url`: `/people-first-app/`
- `scope`: `/people-first-app/`
- `display`: `standalone`
- `orientation`: omitted so each desktop or mobile browser window can follow its current viewport.
- `theme_color`: `#4a9d7c`
- `background_color`: `#071513`
- Icon count: 17
- Includes an `any` 192 by 192 icon plus opaque `maskable` 512 by 512 and 1024 by 1024 icons.
- Mood and Habit shortcuts remain under `/people-first-app/`, use `nav=v2`, and do not carry the retired `navLayout` parameter.
- Shortcut icons declare `type: image/png` consistently in generator, tracked, and built manifests.

Service worker:

- Path in fresh production verification: `dist/sw.js`
- Must be generated by the production build.
- Do not hand-edit generated service worker output.
- Must precache `manifest.webmanifest`, `runtime-perf-bootstrap.js`, and the app
  shell/runtime assets selected in `vite.config.ts`.
- Must not precache `version-check.js`; that asset is intentionally network
  fetched to avoid stale version checks.
- New literal runtime cache names use the `zenflow-` namespace. Legacy generic
  cache ownership on the shared origin is not proven, so this contract does not
  authorize origin-wide or automatic legacy-cache deletion.
- Background Sync wakes already-open ZenFlow clients; with no open client, the
  durable queue waits for the normal online/visibility/resume paths.

Best-practice basis:

- MDN, making PWAs installable:
  https://developer.mozilla.org/en-US/docs/Web/Progressive_web_apps/Guides/Making_PWAs_installable
- MDN, Service Worker API:
  https://developer.mozilla.org/en-US/docs/Web/API/Service_Worker_API
- web.dev, web app manifest:
  https://web.dev/learn/pwa/web-app-manifest
- web.dev, service workers:
  https://web.dev/learn/pwa/service-workers

## Entry UI Contract

Root:

- `main.entry-gate-screen`
- `data-testid="language-selector-screen"` on language.
- `data-testid="auth-screen"` on auth.
- No horizontal overflow; `document.documentElement.scrollWidth` must equal the
  viewport width in PWA mobile proof.

Background:

- One `.entry-gate-aurora` layer.
- Seven soft orb points.
- Three soft ripple layers.
- Three soft flow-ribbon layers.
- Three soft caustic light layers.
- Four soft current lines.
- One horizon line.
- No star, sparkle, magic, or generic AI glyph decorations.
- Motion must honor `shouldAnimate()`, `body.reduce-motion`,
  `:root[data-runtime-perf]`, and `prefers-reduced-motion: reduce`.

Brand:

- Source must remain `icon-source.svg`; production preview may expose it as
  `./icon-source.svg`, while the deployed app exposes
  `/people-first-app/icon-source.svg`.
- Natural image size must remain at least 512 by 512 in current proof.
- Render size is 72 by 72 in the current entry layout.

Theme switcher:

- Visible on both language and auth screens.
- Options: Light, Dark, System.
- `role="radiogroup"` with radio controls.

Language screen:

- Exactly 8 supported language options: `en`, `uk`, `es`, `de`, `fr`, `ja`,
  `ar`, `he`.
- Arabic and Hebrew labels render with local RTL direction.
- Continue arrow mirrors in RTL.

Auth screen:

- Provider order comes from `AUTH_SCREEN_PROVIDER_IDS`.
- Current proof shows Google, Facebook, and Telegram.
- Provider icon layout keeps the symmetric
  `grid-cols-[2rem_minmax(0,1fr)_2rem]` rail.
- Google, Facebook, and Telegram icons render at 24 by 24.
- Telegram uses `viewBox="0 0 128 128"`.
- Telegram gradient stops remain `#2AABEE` and `#229ED9`.

## Current Verification On 2026-06-16

Evidence directory:

- `output/playwright/pwa-entry-20260615/`

Regression spec:

- `e2e/entry-gate-pwa.spec.ts`
- SHA-256:
  `916a95e9ddc7f0a475aca878a37370f8820e30754f0c4a7b1093318cd16225ff`

Facts file:

- `output/playwright/pwa-entry-20260615/facts.json`
- Generated at: `2026-06-16T23:24:02.814Z`
- Base URL: `http://127.0.0.1:4232/people-first-app/`
- Runtime: chromium production preview
- SHA-256:
  `30b0ff2ac5a8edf6b5a00f13bd610e8b088857211fcce0788650d3236d8c4695`

Verification log:

- `output/playwright/pwa-entry-20260615/verification-log-20260615.txt`
- SHA-256:
  `6bfcecf92328512dde1284d6941f2b081516c6f61049f78c2877c3c382288c10`

Screenshots:

- `output/playwright/pwa-entry-20260615/pwa-phone-language-light.png`
  - SHA-256:
    `bd0f589b86f32f10334aabebed037a8a2e61c887f2afda15cc215ca8e4c1c7c4`
- `output/playwright/pwa-entry-20260615/pwa-phone-language-dark.png`
  - SHA-256:
    `5737cc09ccc7155a71ba496f5d291d93a698f60f4cfb3458e7e2ebd4b6c30e5b`
- `output/playwright/pwa-entry-20260615/pwa-phone-language-ar-rtl.png`
  - SHA-256:
    `6e1afc63e71480cd9fee1e6bfa1ce3e751359a158abe0a5e00a9dd389520dc32`
- `output/playwright/pwa-entry-20260615/pwa-phone-language-he-rtl.png`
  - SHA-256:
    `2b86f98455d97d310f216f6c88e541fbe79169d7ba3b101833e2588b747dc398`
- `output/playwright/pwa-entry-20260615/pwa-phone-auth-light.png`
  - SHA-256:
    `350c98b71b029de5a6852243357ebfc9ecb7dcb536587a4661be42bf4728df61`
- `output/playwright/pwa-entry-20260615/pwa-phone-auth-dark.png`
  - SHA-256:
    `dbd9a1619bfe2be32e4439d801caabeca20f5fe13f2e507acbd4bf8e0c3473ed`
- `output/playwright/pwa-entry-20260615/pwa-tablet-language-system.png`
  - SHA-256:
    `5060b84777476facb8f98da68b5416e92f261de25dcde00a564c5722543ab2bb`
- `output/playwright/pwa-entry-20260615/pwa-desktop-language-light.png`
  - SHA-256:
    `385c6c1d438fcc368f33bcd83065763ef206cd93c54e03dd730cb72a86b785ba`
- `output/playwright/pwa-entry-20260615/pwa-desktop-auth-dark.png`
  - SHA-256:
    `9d2c044a2f4344789f3a0d0d3150a8f3c9c0a4946c7de20e1276fa6bd295328b`

Build asset hashes captured during this verification run:

- `dist/index.html`
  - SHA-256:
    `096fd1297a5c547187dd8154eb14858b7377b4650206b25092071c0c986bfb7e`
  - Bytes: 9848
- `dist/manifest.webmanifest`
  - SHA-256:
    `3669272dd2de3e99e348102ef5479cf2afd00adaf9a27fe549c404576f785912`
  - Bytes: 2665
- `dist/sw.js`
  - SHA-256:
    `2de3e5ef470b3db747a25c31ab822ee381fff5f3b38d05b0a7e56ab313247d12`
  - Bytes: 29750
- `dist/registerSW.js`
  - SHA-256:
    `c822482102ca7cafe0a7c459e334a2dce155937eb1edf83b5d169f6eec3a92ec`
  - Bytes: 168
- `dist/offline.html`
  - SHA-256:
    `d898e6946f345c352f170ea80d516543a276cb218f29ca35481f7bd4043c52aa`
  - Bytes: 6696
- `dist/icon-source.svg`
  - SHA-256:
    `4a3b2af600b0833865449b914851191d8b8ce6493b1383d3fd06bb76e923f76b`
  - Bytes: 3027
- `dist/version.json`
  - SHA-256:
    `af70bea1d7e82deb106e929bbb2553d7787d5b64400cf40f5fdad1946c4774eb`
  - Bytes: 54
- `dist/version-check.js`
  - SHA-256:
    `743d65ce79c968f111b37079f42096f7dbb3bee4a306366007de29552c771f7f`
  - Bytes: 1474

Runtime facts:

- Local production preview: `http://127.0.0.1:4232/people-first-app/`.
- PWA phone viewport: 390 by 844, DPR 3.
- PWA tablet viewport: 768 by 1024, DPR 2.
- PWA desktop viewport: 1280 by 900, DPR 1.
- Simulated display mode: standalone true in all visual scenarios.
- Document horizontal overflow: false in all visual scenarios.
- Screen horizontal overflow: false in all visual scenarios.
- Out-of-bounds audited elements: 0 in all visual scenarios.
- Logo natural size: 512 by 512.
- Logo render size: 72 by 72.
- Background: 0 forbidden AI/star/old-flow marks, 7 orbs, 3 ripples,
  3 flow ribbons, 3 caustics, 4 currents, 1 horizon.
- Theme switcher: present with Light, Dark, and System.
- Language options: 8 on language screen.
- Arabic RTL scenario sets `html lang="ar"` and `dir="rtl"`.
- Hebrew RTL scenario sets `html lang="he"` and `dir="rtl"`.
- Auth provider icons: Google, Facebook, Telegram.
- Auth provider icon rail spread: 0.
- Telegram icon: `viewBox="0 0 128 128"`.
- Telegram gradient stops: `#2AABEE`, `#229ED9`.
- Console warnings/errors: 0 in all visual scenarios.
- Failed network requests: 0 in all visual scenarios.
- Service worker generated with `manifest.webmanifest` and
  `runtime-perf-bootstrap.js` in precache and without `version-check.js` in
  precache.

PASS commands:

- `npm run build`
- `npx eslint e2e/entry-gate-pwa.spec.ts --max-warnings=0 --no-warn-ignored`
- Production preview on `127.0.0.1:4232`.
- `ZENFLOW_PLAYWRIGHT_BASE_URL=http://127.0.0.1:4232/people-first-app/ npx playwright test e2e/entry-gate-pwa.spec.ts --project=chromium --reporter=line --workers=1`
- Result: 2/2 Playwright tests passed, covering 9 visual scenarios plus
  standalone all-language smoke for `en`, `uk`, `es`, `de`, `fr`, `ja`, `ar`, `he`.

UNVERIFIED on 2026-06-16:

- Real installed PWA launch from iOS home screen, Android home screen, Windows,
  or macOS launcher.
- Offline runtime behavior after install.
- Push notification permission behavior in installed PWA mode.
- Real browser install prompt availability.
- Public GitHub Pages deployed PWA cache-busted behavior.
- Snyk Code scan. Local fallback reached Snyk but returned `403 Forbidden`
  because Snyk Code is not enabled for the `yehor212` organization.

## Change Control

Allowed without product approval, if this contract still passes:

- Copy translation improvements that preserve layout.
- Narrow token-only visual tuning.
- Test-only improvements.

Requires explicit approval and fresh PWA proof:

- Changing `manifest.webmanifest` `start_url`, `scope`, or `display`.
- Replacing the logo source.
- Moving or removing the theme switcher.
- Adding stars, sparkles, magic glyphs, or generic AI decorations.
- Changing supported entry languages.
- Adding, removing, or reordering auth providers.
- Changing provider icon layout away from the symmetric rail grid.
- Removing service worker generation.
- Changing offline fallback behavior.
- Precaching `version-check.js`.

## Agent Handoff Rule

Before editing PWA entry files, future agents must:

1. Read this document, `AGENTS.md`, and `ARCHITECTURE.md`.
2. State whether the change touches PWA installability, service worker,
   entry layout, auth logic, i18n, motion, or branding.
3. Run a production build and PWA preview proof after edits.
4. Mark installed PWA behavior `UNVERIFIED` unless actually launched from an
   installed app surface.

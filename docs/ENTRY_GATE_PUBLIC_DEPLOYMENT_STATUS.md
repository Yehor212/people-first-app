# ZenFlow Entry Gate Public Deployment Status

Last checked: 2026-06-16

This document records the public deployment status for the first-run language
screen and the following sign-in screen. It complements the platform contracts:

- `docs/ENTRY_GATE_PWA_CONTRACT.md`
- `docs/ENTRY_GATE_ANDROID_CONTRACT.md`
- `docs/ENTRY_GATE_IOS_CONTRACT.md`
- `docs/ENTRY_GATE_DESKTOP_TAURI_CONTRACT.md`

## Current Verdict

Public GitHub Pages entry: PASS on 2026-06-16 after deploy run `27588477374`.

Visual Regression run `27588477332`: PASS.

Local production-equivalent PWA entry: PASS on 2026-06-16.

Local Desktop/Tauri web-boundary entry: PASS on 2026-06-16. Real native Tauri
launch remains outside this public deployment status document.

## Fresh Cache-Busted Smoke - 2026-06-16

Command source: inline Playwright smoke against public GitHub Pages.

URL checked:

```text
https://yehor212.github.io/people-first-app/?_v=1781576224921
```

Result: PASS for three public scenarios.

Scenario summary:

- `public-phone-language-light`: language-selector-screen, logo 512x512/72x72, background 7/3/3/3/4/1, forbidden marks 0, theme switcher present, language options 8, overflow false/false, console 0, failed requests 0.
- `public-phone-auth-dark`: auth-screen, logo 512x512/72x72, background 7/3/3/3/4/1, forbidden marks 0, providers google/facebook/telegram, icon center spread 0, Telegram viewBox `0 0 128 128`, overflow false/false, console 0, failed requests 0.
- `public-desktop-auth-dark`: auth-screen, logo 512x512/72x72, background 7/3/3/3/4/1, forbidden marks 0, providers google/facebook/telegram, icon center spread 0, Telegram viewBox `0 0 128 128`, overflow false/false, console 0, failed requests 0.

## Public GitHub Pages Evidence

Public URL:

```text
https://yehor212.github.io/people-first-app/?_v=<cache-bust>
```

Evidence directory:

- `output/playwright/public-entry-20260616/`

Facts:

- `output/playwright/public-entry-20260616/facts.json`
- Facts SHA-256: `924b9b10cd31aaa31b088d43f8588eda04440cff9ce507c64e7aec565bca51ac`

Public screenshot scenarios:

- `public-phone-language-light`: language-selector-screen, theme Light, logo 512x512/72x72, background 7/3/3/3/4/1, forbidden marks 0, providers n/a, screenshot SHA-256 `cd9c1230a3c5cad97f2262dd3baa8a36bc853049ea91239ea1da659906f935bf`.
- `public-phone-auth-dark`: auth-screen, theme Dark, logo 512x512/72x72, background 7/3/3/3/4/1, forbidden marks 0, providers google, facebook, telegram, screenshot SHA-256 `e05033a195b7c1d1e4056af0547b06128dbcb955f12a9bf4fb1d21c8838c0292`.
- `public-desktop-auth-dark`: auth-screen, theme Dark, logo 512x512/72x72, background 7/3/3/3/4/1, forbidden marks 0, providers google, facebook, telegram, screenshot SHA-256 `a3f2ee3fa264c3a9f21b32443f93f8826b924f05933a2466acd54cb29617f1e7`.

Public contract facts proven by the smoke:

- New logo source remains `icon-source.svg`, natural size at least 512 by 512,
  SVG `viewBox="0 0 512 512"`.
- Background exposes 7 orbs, 3 ripples, 3 flow ribbons, 3 caustics, 4 currents,
  and 1 horizon.
- Forbidden star/sparkle/magic/old flow-mark decorations: 0.
- Theme switcher is present.
- Language screen exposes 8 language options.
- Auth screen exposes Google, Facebook, and Telegram.
- Provider icon center spread is 0.
- Telegram icon uses `viewBox="0 0 128 128"`.
- Horizontal overflow: false.
- Console warnings/errors: 0.
- Failed requests: 0.

## Local PWA Evidence

Command:

```bash
ZENFLOW_PLAYWRIGHT_BASE_URL=http://127.0.0.1:4232/people-first-app/ npx playwright test e2e/entry-gate-pwa.spec.ts --project=chromium --reporter=line --workers=1
```

Result:

- PWA portion of combined run: PASS.
- Combined PWA/Desktop command result: 5 tests passed.
- Facts: `output/playwright/pwa-entry-20260615/facts.json`
- Facts SHA-256: `c3e8c0331de9535bf28e6cc74ff1c78a7201b0be0a24bd50f68195a7e5ac691e`

Scenario summary:

- `pwa-phone-language-light`: language-selector-screen, providers n/a, overflow false/false, forbidden marks 0.
- `pwa-phone-language-dark`: language-selector-screen, providers n/a, overflow false/false, forbidden marks 0.
- `pwa-phone-language-ar-rtl`: language-selector-screen, providers n/a, overflow false/false, forbidden marks 0.
- `pwa-phone-language-he-rtl`: language-selector-screen, providers n/a, overflow false/false, forbidden marks 0.
- `pwa-phone-auth-light`: auth-screen, providers google, facebook, telegram, overflow false/false, forbidden marks 0.
- `pwa-phone-auth-dark`: auth-screen, providers google, facebook, telegram, overflow false/false, forbidden marks 0.
- `pwa-tablet-language-system`: language-selector-screen, providers n/a, overflow false/false, forbidden marks 0.
- `pwa-desktop-language-light`: language-selector-screen, providers n/a, overflow false/false, forbidden marks 0.
- `pwa-desktop-auth-dark`: auth-screen, providers google, facebook, telegram, overflow false/false, forbidden marks 0.

## Local Desktop/Tauri Web-Boundary Evidence

Command:

```bash
ZENFLOW_PLAYWRIGHT_BASE_URL=http://127.0.0.1:4232/people-first-app/ npx playwright test e2e/entry-gate-desktop-tauri.spec.ts --project=chromium --reporter=line --workers=1
```

Result:

- Desktop/Tauri web-boundary portion of combined run: PASS.
- Combined PWA/Desktop command result: 5 tests passed.
- Facts: `output/playwright/desktop-tauri-entry-20260615/facts.json`
- Facts SHA-256: `bb7c999e74d9c5c35d4a83f571ef5497deb9f9a76f9c6094aeb59ff8e5e70c41`

Scenario summary:

- `desktop-default-language-light`: language-selector-screen, providers n/a, overflow false/false, forbidden marks 0.
- `desktop-default-auth-light`: auth-screen, providers google, facebook, telegram, overflow false/false, forbidden marks 0.
- `desktop-default-language-dark`: language-selector-screen, providers n/a, overflow false/false, forbidden marks 0.
- `desktop-default-auth-dark`: auth-screen, providers google, facebook, telegram, overflow false/false, forbidden marks 0.
- `desktop-min-language-dark`: language-selector-screen, providers n/a, overflow false/false, forbidden marks 0.
- `desktop-min-auth-dark`: auth-screen, providers google, facebook, telegram, overflow false/false, forbidden marks 0.
- `desktop-wide-language-system`: language-selector-screen, providers n/a, overflow false/false, forbidden marks 0.
- `desktop-default-language-ar-rtl`: language-selector-screen, providers n/a, overflow false/false, forbidden marks 0.
- `desktop-default-language-he-rtl`: language-selector-screen, providers n/a, overflow false/false, forbidden marks 0.

## Remaining Public Follow-Up

- Native Android and native iOS entry gates are tracked in their platform docs and
  CI gates; this file only records public GitHub Pages and local web-boundary
  evidence.
- Real installed PWA launch and real native Tauri launch remain separate manual
  or native-runner checks.

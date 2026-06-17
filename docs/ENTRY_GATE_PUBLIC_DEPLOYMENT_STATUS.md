# ZenFlow Entry Gate Public Deployment Status

Last checked: 2026-06-16

This document records the public deployment status for the first-run language
screen and the following sign-in screen. It complements the platform contracts:

- `docs/ENTRY_GATE_PWA_CONTRACT.md`
- `docs/ENTRY_GATE_ANDROID_CONTRACT.md`
- `docs/ENTRY_GATE_IOS_CONTRACT.md`
- `docs/ENTRY_GATE_DESKTOP_TAURI_CONTRACT.md`

## Current Verdict

Public GitHub Pages entry: PASS on 2026-06-16 after fresh cache-busted smoke.

Public GitHub Pages V2 route pending-layer fix: DRIFT on 2026-06-16. The
published app still renders `nav-v2-route-pending` at z-index 58 while the
closing drawer is z-index 60 and backdrop is z-index 59. The local main
worktree fix raises pending to z-index 61, but that local fix is not proven
deployed by the public smoke below.

Previous public deploy run: `27588477374`.

Visual Regression run `27588477332`: PASS.

Local production-equivalent PWA entry: PASS on 2026-06-16.

Local Desktop/Tauri web-boundary entry: PASS on 2026-06-16. Real native Tauri
launch remains outside this public deployment status document.

## Fresh Cache-Busted Smoke - 2026-06-16, Current

Command source: inline Playwright smoke against public GitHub Pages.

URL checked:

```text
https://yehor212.github.io/people-first-app/?_v=1781655006647
https://yehor212.github.io/people-first-app/orb?nav=v2&navLayout=phone&_v=1781655006647
```

Result:

- PASS for three public entry scenarios.
- DRIFT for the V2 phone route pending-layer fix: the route opens correctly and
  is not Not Found, but the published pending indicator is still below the
  closing drawer layer.

Scenario summary:

- `public-phone-language-light`: language-selector-screen, logo 512x512/72x72, background 7/3/3/3/4/1, forbidden marks 0, theme switcher present, language options 8, overflow false/false, console 0, failed requests 0.
- `public-phone-auth-dark`: auth-screen, logo 512x512/72x72, background 7/3/3/3/4/1, forbidden marks 0, providers google/facebook/telegram, icon center spread 0, provider icons 24x24, Telegram viewBox `0 0 128 128`, overflow false/false, console 0, failed requests 0.
- `public-desktop-auth-dark`: auth-screen, logo 512x512/72x72, background 7/3/3/3/4/1, forbidden marks 0, providers google/facebook/telegram, icon center spread 0, provider icons 24x24, Telegram viewBox `0 0 128 128`, overflow false/false, console 0, failed requests 0.
- `public-v2-phone-orb`: active page `orb`, layout `phone`, Not Found false,
  pending text `Habits`, z-indexes pending/backdrop/drawer = 58/59/60.

Evidence:

- Facts: `output/playwright/public-entry-current-20260616/facts.json`
- Facts SHA-256: `70ca919906447405cea2e2773b71f07d2da47e05c67b8162366aedc37451d793`
- Verification log:
  `output/playwright/public-entry-current-20260616/verification-log.txt`
- Verification log SHA-256:
  `ef1e88eb23719c81bd50a9858076a0989e20223372dd90cf8790d03af2b4fafa`

## Public GitHub Pages Evidence

Historical 2026-06-16 smoke from deploy run `27588477374`.

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
- Facts SHA-256: `30b0ff2ac5a8edf6b5a00f13bd610e8b088857211fcce0788650d3236d8c4695`

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
- Facts SHA-256: `23725ef37938b8029aeed4a3c6193deb5ea60e49c09490b4d449b634b8ee49ab`

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

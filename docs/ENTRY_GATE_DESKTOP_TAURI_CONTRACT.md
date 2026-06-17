# ZenFlow Desktop/Tauri Entry Gate Contract

Last verified: 2026-06-17

This contract freezes the desktop-width web behavior of the ZenFlow entry gate
and records the native Tauri boundary. A desktop web preview is useful evidence
for layout, branding, auth provider rendering, i18n, and responsive behavior. It
is not native Tauri runtime evidence.

## Status

PASS on 2026-06-15:

- Desktop web entry layout at Tauri default, minimum, and wide window sizes.
- Tauri config/static boundary for shell-first native startup.
- `AuthGate` explicit desktop runtime bypass contract.
- Desktop entry screenshots, facts, and all-language minimum-width smoke.

UNVERIFIED on 2026-06-15:

- Real native Tauri app launch.
- Native Tauri OAuth callback behavior.
- Native desktop storage/session behavior.
- Native window chrome, resize, titlebar, and updater behavior.
- Windows EXE/NSIS packaging and Authenticode release readiness.
- Snyk Code scan, because local Snyk returned `403 Forbidden` for the org.

## Current Artifact Audit - 2026-06-17

Command source: local completion-audit script over the current screenshot/facts
artifacts in `output/playwright/desktop-tauri-entry-20260615/`.

Result: PASS, 9 scenarios checked, 0 failures.

Current evidence:

- Facts: `output/playwright/desktop-tauri-entry-20260615/facts.json`
- Facts SHA-256: `d8cc527c3e040e2e10a8cb7f1de78b1a0f8e7357ff6c56e07ed24ddc9b56d373`
- Verification log:
  `output/playwright/desktop-tauri-entry-20260615/verification-log-20260615.txt`
- Verification log SHA-256:
  `726646dec7f398b27b2060c40c06e1416e4c4acf613baaa5e13190359b69932e`

Audit assertions:

- Desktop default, minimum, wide, Arabic RTL, and Hebrew RTL screenshots exist.
- Language and auth screens have no horizontal overflow.
- Background remains 7 orbs, 3 ripples, 3 ribbons, 3 caustics, 4 currents, 1
  horizon, and 0 forbidden star/sparkle/generic AI marks in every scenario.
- Auth provider ids remain `google`, `facebook`, `telegram`.
- Google, Facebook, and Telegram provider icons render at 24 by 24 in every
  desktop auth scenario.
- Real native Tauri launch remains UNVERIFIED by this audit; this is still a
  desktop web-boundary and static Tauri config proof.

## Fresh Verification Addendum - 2026-06-16

Command:

```bash
ZENFLOW_PLAYWRIGHT_BASE_URL=http://127.0.0.1:4232/people-first-app/ npx playwright test e2e/entry-gate-desktop-tauri.spec.ts --project=chromium --reporter=line --workers=1
```

Result: PASS as part of the combined PWA/Desktop run, 5 tests passed.

Evidence:

- Facts: `output/playwright/desktop-tauri-entry-20260615/facts.json`
- Facts SHA-256: `d8cc527c3e040e2e10a8cb7f1de78b1a0f8e7357ff6c56e07ed24ddc9b56d373`
- Verification log: `output/playwright/desktop-tauri-entry-20260615/verification-log-20260615.txt`
- Verification log SHA-256: `726646dec7f398b27b2060c40c06e1416e4c4acf613baaa5e13190359b69932e`

Scenario summary:

- `desktop-default-language-light`: language-selector-screen, logo 512x512/72x72, background 7/3/3/3/4/1, forbidden marks 0, providers n/a, overflow false/false.
- `desktop-default-auth-light`: auth-screen, logo 512x512/72x72, background 7/3/3/3/4/1, forbidden marks 0, providers google, facebook, telegram, overflow false/false.
- `desktop-default-language-dark`: language-selector-screen, logo 512x512/72x72, background 7/3/3/3/4/1, forbidden marks 0, providers n/a, overflow false/false.
- `desktop-default-auth-dark`: auth-screen, logo 512x512/72x72, background 7/3/3/3/4/1, forbidden marks 0, providers google, facebook, telegram, overflow false/false.
- `desktop-min-language-dark`: language-selector-screen, logo 512x512/64x64, background 7/3/3/3/4/1, forbidden marks 0, providers n/a, overflow false/false.
- `desktop-min-auth-dark`: auth-screen, logo 512x512/64x64, background 7/3/3/3/4/1, forbidden marks 0, providers google, facebook, telegram, overflow false/false.
- `desktop-wide-language-system`: language-selector-screen, logo 512x512/72x72, background 7/3/3/3/4/1, forbidden marks 0, providers n/a, overflow false/false.
- `desktop-default-language-ar-rtl`: language-selector-screen, logo 512x512/72x72, background 7/3/3/3/4/1, forbidden marks 0, providers n/a, overflow false/false.
- `desktop-default-language-he-rtl`: language-selector-screen, logo 512x512/72x72, background 7/3/3/3/4/1, forbidden marks 0, providers n/a, overflow false/false.

Native Tauri app launch remains UNVERIFIED by this addendum; this is a desktop web-boundary and static Tauri config proof.

## Scope

Applies:

- Desktop browser viewport checks for `/people-first-app/`.
- Production-built web assets served by local preview.
- `LanguageSelector` before the user has selected a language.
- `AuthScreen` after language selection when the user has no valid session and
  auth has not been completed or bypassed.
- Light, dark, and system entry themes.
- Static Tauri config, capability, CSP, and desktop runtime gate checks.

Native Tauri boundary:

- `src-tauri/tauri.conf.json` builds with `VITE_DESKTOP_RUNTIME=true`.
- `src-tauri/tauri.conf.json` builds with `VITE_DISABLE_PWA=true`.
- `src-tauri/tauri.conf.json` builds with `VITE_APP_BASE=./`.
- `AuthGate` bypasses interactive entry gates when `IS_DESKTOP_RUNTIME` is true.
- This boundary is a config/code PASS, not a native launch PASS.

Does not apply:

- Real Tauri app launch unless the native app is launched and exercised.
- Android/iOS native shells.
- Installed PWA launch.
- Local `?dev=true` bypass, because it skips entry gates.

## Source Files

Entry orchestration:

- `src/components/AuthGate.tsx`
- `src/lib/env.ts`

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
- `src/components/auth/AuthProviderButton.tsx`
- `src/lib/authProviders.ts`

Desktop/Tauri platform:

- `src-tauri/tauri.conf.json`
- `src-tauri/capabilities/default.json`
- `src-tauri/src/main.rs`
- `src-tauri/Cargo.toml`
- `scripts/check-desktop-exe-contract.cjs`
- `scripts/check-desktop-toolchain.cjs`
- `scripts/check-desktop-release-readiness.cjs`

Regression proof:

- `e2e/entry-gate-desktop-tauri.spec.ts`
- `src/components/__tests__/AuthGate.test.tsx`
- `src/lib/__tests__/env.test.ts`

## Gate Flow

Web desktop:

1. Initialization or splash renders first.
2. If `IS_DESKTOP_RUNTIME` is false and language is not selected, render
   `LanguageSelector`.
3. If language is selected and auth conditions require sign-in, render
   `AuthScreen`.
4. Tutorial, onboarding, and app shell render only after gates pass.

Native Tauri:

1. Initialization or splash renders first.
2. If `IS_DESKTOP_RUNTIME` is true, `AuthGate` bypasses interactive entry gates
   and returns app children.
3. Changing this behavior requires explicit product approval, focused tests, and
   native Tauri launch evidence.

## Desktop-Web UI Contract

Root:

- `main.entry-gate-screen`.
- No horizontal overflow; `document.documentElement.scrollWidth` must not exceed
  the desktop viewport width by more than 1px.
- Content is centered through the existing responsive max-widths.

Background:

- One `.entry-gate-aurora` layer.
- Seven soft orb points.
- Three soft ripple layers.
- Three soft flow-ribbon layers.
- Three soft caustic light layers.
- Four soft current lines.
- One horizon line.
- No star, sparkle, magic, or generic AI glyph decorations.
- Motion must honor reduced-motion and runtime-performance guards.

Brand:

- Source must remain `icon-source.svg`; production preview may expose it as
  `/people-first-app/icon-source.svg`, while Tauri relative builds use
  `./icon-source.svg`.
- Natural image size must remain at least 512 by 512.
- Render size is 72 by 72 in default desktop entry layout and 64 by 64 in the
  compact minimum-height layout.
- Logo SVG width and height remain `512`; `viewBox` remains `0 0 512 512`.

Theme switcher:

- Visible on both language and auth screens.
- Options: Light, Dark, System.
- `role="radiogroup"` with radio controls.

Language screen:

- Exactly 8 supported language options: `en`, `uk`, `es`, `de`, `fr`, `ja`,
  `ar`, `he`.
- Arabic and Hebrew must set `document.documentElement.dir` to `rtl`.
- Arabic and Hebrew continue arrows must be mirrored.
- The language continue touch target is at least 48px tall.

Auth screen:

- Provider order comes from `AUTH_SCREEN_PROVIDER_IDS`.
- Current proof shows Google, Facebook, and Telegram.
- Provider icon layout keeps the symmetric
  `grid-cols-[2rem_minmax(0,1fr)_2rem]` rail.
- Google, Facebook, and Telegram icons render with `h-6 w-6`.
- Icon center spread across providers is `0`.
- Telegram uses `viewBox="0 0 128 128"`.
- Telegram gradient stops remain `#2AABEE` and `#229ED9`.

## Tauri Native Boundary Contract

Config:

- `productName`: `ZenFlow`.
- `identifier`: `app.zenflow.desktop`.
- `version`: `2.0.0`.
- `devUrl`: `http://localhost:8080/people-first-app/`.
- `frontendDist`: `../dist`.
- `beforeBuildCommand` includes `VITE_APP_BASE=./`.
- `beforeBuildCommand` includes `VITE_DISABLE_PWA=true`.
- `beforeBuildCommand` includes `VITE_DESKTOP_RUNTIME=true`.

Window:

- Title: `ZenFlow`.
- Default size: `1200x820`.
- Minimum size: `390x640`.
- Resizable: `true`.
- Fullscreen: `false`.
- Centered: `true`.

Security and permissions:

- Capability is least-privilege: `["core:default"]` for `["main"]`.
- CSP keeps `script-src 'self'`.
- CSP keeps `object-src 'none'`.
- CSP explicitly allows Supabase HTTPS and websocket endpoints for sync.

Runtime:

- `src/lib/env.ts` exposes `IS_DESKTOP_RUNTIME`.
- `src/lib/env.ts` reads `VITE_DESKTOP_RUNTIME`.
- `src/components/AuthGate.tsx` imports `IS_DESKTOP_RUNTIME`.
- `src/components/AuthGate.tsx` uses `shouldBypassDesktopInteractiveGates`.
- `AuthGate` calls `shouldBypassDesktopInteractiveGates(IS_DESKTOP_RUNTIME)`.
- `src-tauri/src/main.rs` runs `tauri::Builder::default()` with generated
  context.

## Historical Verification On 2026-06-15

Evidence directory:

- `output/playwright/desktop-tauri-entry-20260615/`

Facts file:

- `output/playwright/desktop-tauri-entry-20260615/facts.json`
- SHA-256:
  `bb7c999e74d9c5c35d4a83f571ef5497deb9f9a76f9c6094aeb59ff8e5e70c41`

Verification log:

- `output/playwright/desktop-tauri-entry-20260615/verification-log-20260615.txt`
- SHA-256:
  `8ea36201e081cc8fb3a181ee874617ca08a1b1d23455f54ea05e6d5683f97398`

Desktop-web screenshots:

- `desktop-default-language-light.png`
  - SHA-256:
    `1fad6ca1263f6c378a8714ad3c5610d35eefeefe7496974eaa192607cbfa9373`
- `desktop-default-auth-light.png`
  - SHA-256:
    `e509452317e90ecb72fdddbb85f16cfe5c9e1b4ad48cc03507cf10eab8a35d31`
- `desktop-default-language-dark.png`
  - SHA-256:
    `f20af5292edfc39b4cb0bdd47e4b7fe7bdd64f5fdc4ce5c4ae1b2f9a169f3e1c`
- `desktop-default-auth-dark.png`
  - SHA-256:
    `d5aaa78786521fd77d909a295c0f1f3d755cbee4438e3655739ca55c0c06b18d`
- `desktop-min-language-dark.png`
  - SHA-256:
    `fbbfc401c321246daf9feedbbe985fbcb290ada0060b77e6aca7bf0e474b851d`
- `desktop-min-auth-dark.png`
  - SHA-256:
    `6a67f8c82d468397318190983ec7091a1fc86af4fc293bfb7f31ed354ac2873f`
- `desktop-wide-language-system.png`
  - SHA-256:
    `e454764cb5097026165d026b3d0c36861978333421a965f6d11e7da49f58c885`
- `desktop-default-language-ar-rtl.png`
  - SHA-256:
    `df68db4028653b503489d6993f72f0638daa255dd82a3267dea524507e9ba74c`
- `desktop-default-language-he-rtl.png`
  - SHA-256:
    `c9c673d269d7da1f28ba7d97ba1fffe5c01725ab3868e205e1f0e1eca846d0b1`

Runtime facts:

- Local production preview: `http://127.0.0.1:4232/people-first-app/`.
- Tauri default proof viewport: `1200x820`.
- Tauri minimum proof viewport: `390x640`.
- Wide desktop proof viewport: `1440x900`.
- Horizontal overflow: false in all proof scenarios.
- Horizontally out-of-bounds audited elements: 0 in all proof scenarios.
- Logo source: `icon-source.svg` in production preview.
- Logo natural size: 512 by 512.
- Logo render size: 72 by 72 on default/wide desktop and 64 by 64 at the
  `390x640` minimum window proof.
- Background: 0 forbidden AI/star/old-flow marks, 7 orbs, 3 ripples,
  3 flow ribbons, 3 caustics, 4 currents, 1 horizon.
- Theme switcher: present with Light, Dark, and System.
- Language options: 8 on language screen.
- Arabic and Hebrew: `htmlDir=rtl`, mirrored continue arrow.
- Auth provider icons: Google, Facebook, Telegram; all `h-6 w-6`.
- Provider icon center spread: 0.
- Telegram icon: `viewBox="0 0 128 128"`, gradient stops `#2AABEE`
  and `#229ED9`.
- Minimum auth window: privacy copy and legal copy are visible in the first
  viewport.
- Console warnings/errors: 0 in all desktop-web proof scenarios.
- Failed network requests: 0 in all desktop-web proof scenarios.

PASS commands:

- `npx eslint e2e/entry-gate-desktop-tauri.spec.ts --max-warnings=0`
- `npm run test -- src/components/__tests__/AuthGate.test.tsx src/lib/__tests__/env.test.ts`
  - 2 files, 17 tests passed.
- `npm run build`
- Production preview on `127.0.0.1:4232`.
- `ZENFLOW_PLAYWRIGHT_BASE_URL=http://127.0.0.1:4232/people-first-app/ npx playwright test e2e/entry-gate-desktop-tauri.spec.ts --project=chromium --reporter=line --workers=1`
  - 3 tests passed.
- Pre-fix regression proof: the same Playwright command failed on
  `desktop-min-auth-dark legal copy visible in first viewport`; after the
  compact-height fix, it passes.

Partial native command evidence:

- `npm run desktop:check`
  - `scripts/check-desktop-exe-contract.cjs`: PASS, 112 checks.
  - `scripts/check-desktop-toolchain.cjs`: FAIL because local machine has no
    `rustc`, no `cargo`, and no Windows `link.exe`.
- `npm run desktop:build`
  - FAIL because `cargo metadata` cannot run; `cargo` is not installed.

## Native Tauri PASS Requirements

Do not mark native Tauri PASS until all of these have fresh evidence:

1. Rust and Cargo are installed and `npm run desktop:check` passes.
2. On Windows release path, MSVC `link.exe` is available and `npm run
   desktop:build` produces the expected NSIS artifact.
3. Native Tauri app is launched.
4. With `VITE_DESKTOP_RUNTIME=true`, `LanguageSelector` and `AuthScreen` are
   absent after splash and the app shell is visible.
5. Native window default size, minimum resize, and centered launch are exercised.
6. Native OAuth callback/storage/session/updater behavior is either tested or
   explicitly marked `UNVERIFIED`.
7. For release, `npm run desktop:sign` and `npm run desktop:release:check` pass;
   unsigned dev artifacts may use `npm run desktop:release:check:dev`.

## Change Control

Allowed without product approval, if this contract still passes:

- Copy translation improvements that preserve layout.
- Narrow theme-token tuning.
- Test-only improvements.
- Documentation updates that preserve this native/web evidence separation.

Requires explicit approval and fresh desktop/Tauri proof:

- Changing `IS_DESKTOP_RUNTIME` gate behavior.
- Showing interactive entry gates in native Tauri.
- Replacing the logo source.
- Moving or removing the theme switcher.
- Adding stars, sparkles, magic glyphs, or generic AI decorations.
- Changing supported entry languages.
- Adding, removing, or reordering auth providers.
- Changing provider icon layout away from the symmetric rail grid.
- Changing desktop OAuth/session behavior.
- Changing Tauri permissions, CSP, build flags, bundle targets, or updater/signing
  behavior.

## Agent Handoff Rule

Before editing Desktop/Tauri entry files, future agents must:

1. Read this document, `AGENTS.md`, and `ARCHITECTURE.md`.
2. State whether the change touches desktop-web layout, Tauri runtime gating,
   auth logic, i18n, motion, branding, CSP, permissions, or native packaging.
3. Choose the smallest useful pre-code test or characterization proof.
4. Run `e2e/entry-gate-desktop-tauri.spec.ts` after edits.
5. Mark native Tauri behavior `UNVERIFIED` unless the native app is actually
   launched and exercised.

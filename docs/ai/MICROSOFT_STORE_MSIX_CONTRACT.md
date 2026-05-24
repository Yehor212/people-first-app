# ZenFlow Microsoft Store MSIX Contract

Purpose: define the Microsoft Store path for ZenFlow Windows distribution
without changing the desktop runtime, public web app, canonical orbs, sync
semantics, or user data boundaries.

This document must be read before any work on Partner Center, MSIX/MSIXUPLOAD,
Microsoft Store submission, Store identity, Windows signing, desktop update
claims, or the `/desktop` download page.

It extends:

- `docs/ai/DESKTOP_EXE_RUNTIME_CONTRACT.md`
- `docs/ai/TELEGRAM_GRADE_RUNTIME_CONTRACT.md`
- `docs/ai/SYNC_CONTRACT.md`
- `docs/ai/CANONICAL_ORB_INVARIANT.md`
- `docs/ai/TASK_COMPLETION_PROTOCOL.md`

## Current Store State

- Partner Center product exists: `9MZK46FHZV8K`.
- Product type shown in Partner Center: `MSIX or PWA app`.
- Product status shown in Partner Center: `In draft`.
- Do not buy, submit, publish, or enable paid Store commerce without explicit
  user approval.

This state is not a release. It is a reserved product shell.

## Decision

ZenFlow desktop stays a Tauri 2 Windows app. The installed program must open the
same V2 app surface as the desktop EXE contract: V2 shell first, canonical WebGL
orbs, Telegram-grade sync runtime, and no visual fork.

The Store path is a packaging and submission path only. It must not introduce a
second product UI, a simplified orb, a separate sync stack, or a web-only PWA
fallback that pretends to be the desktop app.

## Why Identity Is Blocked Until Partner Center Values Are Copied

Microsoft Store MSIX package identity is not a guessable local setting. It is a
five-part identity: name, version, architecture, resource id, and publisher. The
Store-specific identity values are visible in Partner Center under the product's
Product management / Product Identity area and are case-sensitive.

Agents must not invent these values. A guessed identity can produce a package
that fails certification, cannot update correctly, or does not match the
reserved Store product.

## Non-Negotiables

1. **No visual regression.**
   - Full orbs remain `ValenceOrb`.
   - Mini orbs remain `MiniValenceOrb`.
   - The Store build cannot replace WebGL orbs with CSS, SVG, screenshots,
     icons, or a lighter visual family.

2. **No sync fork.**
   - `sync_events.seq` remains the ordering authority.
   - Tombstones beat stale payloads.
   - Offline queue, gap recovery, device sessions, account boundaries, and
     V1/V2 convergence stay shared with the web and desktop runtime.

3. **No secrets in the app or repository.**
   - PFX files, certificate passwords, GitHub tokens, Supabase service-role
     keys, Sentry auth tokens, Store submission credentials, and updater
     private keys stay outside source control and outside client bundles.

4. **No purchase or final submission automation.**
   - Agents can prepare docs, scripts, local package inputs, checks, and draft
     release evidence.
   - Agents must not purchase certificates, submit Store listings, change app
     pricing, or publish to customers without explicit user approval.

5. **No false Store-ready claims.**
   - If Product Identity values are missing, Store package state is
     `UNVERIFIED`.
   - If Windows App Certification Kit evidence is missing, certification state
     is `UNVERIFIED`.
   - If the package is unsigned or signed with a non-release certificate, public
     Store distribution state is `UNVERIFIED`.

6. **Store language truth.**
   - App i18n, Store listing languages, and package-supported languages are
     separate proof surfaces.
   - English screenshots and descriptions prove only the English Store listing.
   - Additional Store listing languages require localized copy, captions, and
     screenshot decisions for each language.
   - `docs/release/microsoft-store/store-listing-localized.json` is the
     required source of truth for prepared Store listing copy across `en`,
     `uk`, `es`, `de`, `fr`, `ja`, `ar`, and `he`.
   - A language can be called live complete only after Partner Center proof
     shows that language saved as complete. Repo packet proof alone is
     `READY IN REPO / LIVE UNVERIFIED`.
   - `Languages supported in packages` is `UNVERIFIED` until packages are
     uploaded and Partner Center displays the detected language list.

7. **Partner Center tab truth.**
   - Every visible Partner Center tab must be audited through
     `docs/release/microsoft-store/PARTNER_CENTER_TABS_AUDIT.md` and
     `docs/release/microsoft-store/partner-center-tabs-audit.json`.
   - Store listing proof does not prove Packages, package languages,
     Submission Options, Partner Center account verification, or certification
     readiness.
   - `Submit for certification` stays blocked while packages/signing/WACK,
     package-language, or account-verification proof is missing.

## Required Product Identity Values

Copy these values from Partner Center after opening:

`Apps and games` -> `ZenFlow` -> `Product management` -> `Product Identity`.

Record them in `docs/release/microsoft-store/product-identity.public.json`
because these Store identity values are public package metadata, not secrets.
Automation may also mirror them into trusted environment variables or CI
variables:

- `ZENFLOW_STORE_PRODUCT_ID=9MZK46FHZV8K`
- `ZENFLOW_STORE_PACKAGE_IDENTITY_NAME=YehorSha.ZenFlow`
- `ZENFLOW_STORE_PUBLISHER=CN=EEB3FAA5-30F3-4886-A288-B72F7ED6729B`
- `ZENFLOW_STORE_PUBLISHER_DISPLAY_NAME=YehorSha`

Do not commit certificate files, PFX base64 values, passwords, Store account
credentials, or signing private keys. The `CN=...` Publisher string shown in
Partner Center Product Identity is public package metadata and may be recorded
for reproducible package manifests.

## MSIX Packaging Paths

There are three acceptable paths.

### Path A: Convert The Signed Installer

Use Microsoft MSIX Packaging Tool on a clean Windows conversion machine to
convert the signed Tauri NSIS installer into MSIX. This path is operationally
simple and matches the current Tauri output.

Required proof:

- `npm run desktop:build`
- `npm run desktop:sign`
- `npm run desktop:release:check`
- MSIX Packaging Tool conversion log
- Store Product Identity values applied exactly
- Windows App Certification Kit result
- Store package upload accepted in Partner Center draft

### Path B: Manual MSIX Packaging

Create MSIX package components manually with Microsoft command line tooling:
manifest, package layout, MakeAppx, SignTool, and Store identity values.

Required proof:

- `appxmanifest.xml` generated from Partner Center identity values
- version number follows Microsoft Store MSIX rules
- `MakeAppx.exe` package output
- `SignTool.exe` signature proof
- Windows App Certification Kit result
- Store package upload accepted in Partner Center draft

This path is more automation-friendly, but it needs careful manifest and asset
work before it should be wired into CI.

### Path C: Generate The Store MSIXUPLOAD Candidate

Use the repo-owned package generator:

```bash
npm run desktop:store:assets
npm run desktop:store:assets:check
npm run assets:logos:check
npm run desktop:store:package
```

`desktop:store:assets` regenerates the Partner Center logo/artwork PNGs from
the clean ZenFlow leaf source. The source and generated assets must not use SVG
filters or rectangular glow/shadow boxes; previous filter-box exports caused
visible square shader artifacts in Store thumbnails. Golden-ratio proportions
may guide the icon placement, but the acceptance rule is practical: small
thumbnail readability, restrained glow, safe spacing, PNG dimensions, and no
hard-square corners on app-tile assets.

`assets:logos:check` is the wider release guard. It verifies that the same
no-filter ZenFlow logo family is used by web/PWA icons, favicon, Tauri/Windows
icons, Android adaptive and legacy icons, iOS AppIcon, Microsoft Store assets,
and the Store upload-pack mirrors. If any surface still has an old filtered
source, wrong dimensions, alpha where the platform needs opaque art, or a stale
upload-pack copy, Store readiness is `FAIL`.

The command uses Partner Center Product Identity values from
`product-identity.public.json`, generates an `AppxManifest.xml`, creates
official Store logo package assets, runs Windows SDK `MakePri.exe` when
available, runs `MakeAppx.exe`, and writes:

- `tmp/microsoft-store-msix/ZenFlow_1.7.3.0_x64.msix`
- `tmp/microsoft-store-msix/ZenFlow_1.7.3.0_x64.msixupload`
- `tmp/microsoft-store-msix/package-manifest.json`

This is the current preferred repo path for the Partner Center product type
`MSIX or PWA app`. Upload the `.msixupload` file in Partner Center under
`Submission 1` -> `Packages`.

Important distinction: for Microsoft Store MSIX submissions, Microsoft handles
Store package signing after certification. Do not create or buy a PFX just to
produce this Store upload candidate. Direct EXE/NSIS distribution and the
separate MSI/EXE Store path still require Authenticode signing proof.

Required proof:

- `npm run desktop:store:package`
- `tmp/microsoft-store-msix/package-manifest.json`
- `MakeAppx.exe` output in the command log
- Package upload accepted in Partner Center draft
- Windows App Certification Kit result or Partner Center certification result
- Package-language table reviewed after upload

## Release Gate

A Microsoft Store release is complete only when every row is proved from the
final tree or final draft submission:

| Requirement | Status rule |
| --- | --- |
| Product exists in Partner Center | `PASS` only with product id and screenshot or dashboard proof |
| Product Identity copied | `PASS` only with exact Partner Center values available through env/CI, never guessed |
| Desktop runtime unchanged | `PASS` only with `npm run check:desktop-exe-contract` |
| Canonical visuals unchanged | `PASS` only with `npm run check:canonical-orbs` and screenshot/browser proof |
| Store logo pack clean | `PASS` only with `npm run desktop:store:assets:check`, `npm run assets:logos:check`, and visual review of app tile, box art, poster art, super hero art, web/PWA, Windows/Tauri, Android, and iOS logo surfaces |
| Store contract guard | `PASS` only with `npm run desktop:store:check` |
| Store listing languages | `PASS` only when each selected Store listing language has localized copy, captions, screenshots or explicit neutral-screenshot approval, and Partner Center proof |
| Package languages | `PASS` only after package upload shows the expected language list in Partner Center |
| Partner Center tab audit | `PASS` only when `npm run desktop:store:check` validates `partner-center-tabs-audit.json` and every blocker tab has current live proof or remains explicitly blocked |
| Sync unchanged | `PASS` only with `npm run check:sync-contract` and sync drill when account behavior is touched |
| Store upload package generated | `PASS` only with `npm run desktop:store:package` and `package-manifest.json` |
| Direct EXE/NSIS signed | `PASS` only with `npm run desktop:release:check`; required for direct downloads or MSI/EXE Store path, not for the generated Store MSIXUPLOAD candidate |
| Store certification | `PASS` only with Windows App Certification Kit evidence or Partner Center accepted certification result |
| Public claims | `PASS` only when `/desktop` and release notes point to verified signed artifacts |

Anything missing stays `UNVERIFIED`. Do not call the Store release complete from
source-only proof.

## Official References

- Tauri Windows installer output is NSIS setup EXE or WiX MSI:
  https://v2.tauri.app/distribute/windows-installer/
- Microsoft package identity overview:
  https://learn.microsoft.com/en-us/windows/apps/desktop/modernize/package-identity-overview
- Microsoft manual MSIX packaging with MakeAppx:
  https://learn.microsoft.com/en-us/windows/msix/desktop/desktop-to-uwp-manual-conversion
- Microsoft Store MSIX package requirements:
  https://learn.microsoft.com/en-us/windows/apps/publish/publish-your-app/msix/app-package-requirements
- Microsoft upload app packages:
  https://learn.microsoft.com/en-us/windows/apps/publish/publish-your-app/upload-app-packages?pivots=store-installer-msix&source=recommendations
- Microsoft code signing options:
  https://learn.microsoft.com/en-us/windows/apps/package-and-deploy/code-signing-options
- MSIX Packaging Tool conversion from existing installer:
  https://learn.microsoft.com/en-us/windows/msix/packaging-tool/create-app-package

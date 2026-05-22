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
   - `Languages supported in packages` is `UNVERIFIED` until packages are
     uploaded and Partner Center displays the detected language list.

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

There are two acceptable paths.

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

## Release Gate

A Microsoft Store release is complete only when every row is proved from the
final tree or final draft submission:

| Requirement | Status rule |
| --- | --- |
| Product exists in Partner Center | `PASS` only with product id and screenshot or dashboard proof |
| Product Identity copied | `PASS` only with exact Partner Center values available through env/CI, never guessed |
| Desktop runtime unchanged | `PASS` only with `npm run check:desktop-exe-contract` |
| Canonical visuals unchanged | `PASS` only with `npm run check:canonical-orbs` and screenshot/browser proof |
| Store contract guard | `PASS` only with `npm run desktop:store:check` |
| Store listing languages | `PASS` only when each selected Store listing language has localized copy, captions, screenshots or explicit neutral-screenshot approval, and Partner Center proof |
| Package languages | `PASS` only after package upload shows the expected language list in Partner Center |
| Sync unchanged | `PASS` only with `npm run check:sync-contract` and sync drill when account behavior is touched |
| Package signed | `PASS` only with `npm run desktop:release:check` or MSIX SignTool proof |
| Store certification | `PASS` only with Windows App Certification Kit evidence |
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
- MSIX Packaging Tool conversion from existing installer:
  https://learn.microsoft.com/en-us/windows/msix/packaging-tool/create-app-package

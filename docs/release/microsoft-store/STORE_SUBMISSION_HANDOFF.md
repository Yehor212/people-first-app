# ZenFlow Microsoft Store Submission Handoff

Purpose: keep the Partner Center draft moving without confusing prepared assets
with a complete Store release.

This document is the operator checklist for the current `ZenFlow` Microsoft
Store draft. It is intentionally narrow: it covers listing text, screenshots,
Store image assets, and the remaining release gates. It does not authorize
purchasing, final submission, certificate creation, or certification without an
explicit product-owner approval in the active thread.

## Current Draft

- Product: `ZenFlow`
- Product id: `9MZK46FHZV8K`
- Package identity name: `YehorSha.ZenFlow`
- Publisher: `CN=EEB3FAA5-30F3-4886-A288-B72F7ED6729B`
- Publisher display name: `YehorSha`
- Package family name: `YehorSha.ZenFlow_5m5fhwz1wz4xt`
- Store URL: `https://apps.microsoft.com/detail/9MZK46FHZV8K`

Source: `product-identity.public.json`, copied from Partner Center Product
Identity. These values are public package metadata, not signing secrets.

## Listing Copy Status

Use `STORE_LISTING_QUALITY_GATE.md` as the source of truth for:

- product name,
- short description,
- full description,
- release notes,
- product features,
- search terms,
- screenshot captions.

Use `STORE_SUBMISSION_AUDIT.md` as the source of truth for language and
questionnaire completeness. It separates app i18n, Store listing languages, and
package-supported languages.

Use `PARTNER_CENTER_FIELD_PACKET.md` when the Partner Center form is open and
you need the exact copy/paste text, screenshot paths, logo paths, and save
checklist in one place.

Do not add AI buzzwords, medical claims, pricing claims, competitor names, or
future-feature promises. The listing should describe the app as a calm Windows
wellness space with V2 mood flow, habits, journaling, focus, canonical WebGL
visuals, offline-capable workflow, and sync-ready account support.

## Screenshot Upload Set

Use only public GitHub Pages captures or signed desktop-build captures. Do not
upload localhost, debug, browser-toolbar, inspector, private-data, fallback-orb,
or partially loaded frames.

Recommended upload order for Desktop screenshots:

1. `store-screenshots/desktop/01-v2-orb-desktop.png`
   - Caption: `Name your mood in a quiet visual flow that stays out of your way.`
   - Status: recommended first screenshot.
2. `store-screenshots/desktop/02-v2-habits-desktop.png`
   - Caption: `Build steady daily rituals without turning your day into a dashboard.`
   - Status: recommended second screenshot.
3. `store-screenshots/desktop/03-v2-diary-desktop.png`
   - Caption: `Keep private reflection close to your work, with space to start small.`
   - Status: acceptable privacy-safe screenshot.

Do not upload `tmp/store-candidates/04-desktop-download-page-settled.png` in
its current form. The large hero orb intersects the headline, so it does not
meet the visual polish bar for Store screenshots.

Each recommended PNG is committed under `store-screenshots/desktop/`, is
`1440x900`, above Microsoft's `1366x768` desktop minimum, and far below the
`50 MB` screenshot limit.

## Store Image Assets

Use `assets/official-logo/` for Partner Center Store logos:

| Partner Center slot | File |
| --- | --- |
| 1:1 App tile icon / Store logo 300x300 | `assets/official-logo/zenflow-official-app-tile-icon-300.png` |
| 1:1 App tile icon / Store logo 150x150 | `assets/official-logo/zenflow-official-app-tile-icon-150.png` |
| 1:1 App tile icon / Store logo 71x71 | `assets/official-logo/zenflow-official-app-tile-icon-71.png` |
| 1:1 Box art | `assets/official-logo/zenflow-official-box-art-2160.png` |
| 9:16 Poster art | `assets/official-logo/zenflow-official-poster-art-1440x2160.png` |
| 16:9 Super hero art | `assets/official-logo/zenflow-official-super-hero-art-1920x1080.png` |

`assets/orb-draft/` is reference-only. Do not use draft orb exports as the
primary Store logo unless the product owner explicitly chooses an orb-led Store
identity later.

## Manual Partner Center Steps

1. Open Partner Center -> Apps and games -> ZenFlow -> Submission 1 -> Store
   listings.
2. Confirm the English listing fields match `STORE_LISTING_QUALITY_GATE.md`.
3. Upload the three recommended Desktop screenshots in the order listed above.
4. Upload the official-logo assets into their matching Store logo slots.
5. Save the listing, then return to Application overview.
6. Confirm `Store listings` remains `Complete`.
7. Do not click `Submit for certification` until `Packages` is complete and the
   release gates below are green.

## Current Partner Center Evidence

Last checked in Partner Center on 2026-05-21 after saving the English Store
listing:

| Section | Live status | Evidence |
| --- | --- | --- |
| Pricing and availability | `Complete` | `tmp/partner-center-overview-after-save.png` |
| Properties | `Complete` | `tmp/partner-center-overview-after-save.png` |
| Age ratings | `Complete` | `tmp/partner-center-overview-after-save.png` |
| Store listings | `Complete` | `tmp/partner-center-overview-after-save.png` |
| Additional Store listing languages | `English only` | `tmp/partner-center-language-state-audit.png` |
| Languages supported in packages | `Unavailable until package upload` | `tmp/partner-center-language-state-audit.png` |
| Packages | `Not started` | `tmp/partner-center-overview-after-save.png` |

Certification was not submitted because the package upload step is still not
complete.

## Language Release Rule

The app source supports `en`, `uk`, `es`, `de`, `fr`, `ja`, `ar`, and `he`, but
the current Microsoft Store listing is complete only for English. Do not add
other Store listing languages or claim a complete multilingual Store release
until localized listing copy, localized captions, screenshot decisions, and
package language proof are available.

## Release Gates Before Certification

Run these from the repository root after the final package/listing changes:

```bash
npm run check:all
npm run check:sync-contract
npm run check:canonical-orbs
npm run check:task-completion
npm run desktop:store:check
npm run check:desktop-exe-contract
```

For a development-only unsigned artifact, `npm run desktop:release:check:dev`
may pass with an explicit unsigned warning. For public Store certification, a
signed MSIX/package proof or Microsoft Store package acceptance is still
required.

## Stop Conditions

Stop and report `PARTIAL` or `UNVERIFIED` instead of claiming completion when:

- `Packages` is still `Not started`,
- screenshots are below `1366x768`, over `50 MB`, or visually weak,
- Partner Center file upload cannot be confirmed,
- the installer or package remains unsigned for a public release,
- Windows App Certification Kit proof is missing,
- `Submit for certification` is disabled,
- canonical orb, sync, or desktop-release guards fail.

## Done Packet Fields

Every final status update for this Store work must include:

- Partner Center status by section,
- uploaded screenshot count and filenames,
- package/signing status,
- command evidence,
- known gaps,
- whether certification was submitted.

If certification was not submitted, say so explicitly.

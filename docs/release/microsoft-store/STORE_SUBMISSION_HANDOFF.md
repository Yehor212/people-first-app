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

Use `PARTNER_CENTER_TABS_AUDIT.md` as the Partner Center Tabs Audit and source
of truth for every Partner Center tab and live blocker. It records whether each
tab is
`PASS`, `READY_IN_REPO_LIVE_UNVERIFIED`, `BLOCKED_UNTIL_PACKAGE_UPLOAD`,
`BLOCKED_UNTIL_SIGNING`, `UNVERIFIED`, or `NOT_APPLICABLE`.

Use `PARTNER_CENTER_FIELD_PACKET.md` when the Partner Center form is open and
you need the exact copy/paste text, screenshot paths, logo paths, and save
checklist in one place.

Use `STORE_LISTING_LOCALIZED_PACKET.md` and
`store-listing-localized.json` for all non-English Store listing pages. They
contain the prepared copy, feature rows, search terms, and screenshot captions
for English, Ukrainian, Spanish, German, French, Japanese, Arabic, and Hebrew.

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

Old orb-led Store logo drafts are removed from the committed upload set. Do not
reintroduce draft orb exports as Store identity assets unless the product owner
explicitly changes the brand direction in a future task.

## Manual Partner Center Steps

1. Open Partner Center -> Apps and games -> ZenFlow -> Submission 1 -> Store
   listings.
2. Confirm the English listing fields match `STORE_LISTING_QUALITY_GATE.md`.
3. Upload the three recommended Desktop screenshots in the order listed above.
4. Upload the official-logo assets into their matching Store logo slots.
5. Save the listing, then return to Application overview.
6. Confirm `Store listings` remains `Complete`.
7. Generate the Store package with `npm run desktop:store:package`.
8. Open `Submission 1` -> `Packages` and upload
   `tmp/microsoft-store-msix/ZenFlow_2.0.0.0_x64.msixupload`.
9. Confirm Partner Center accepts the package and then review the detected
   package-language table.
10. Do not click `Submit for certification` until `Packages` is complete and the
   release gates below are green.

For additional Store listing languages, do not use coordinate-only checkbox
automation. Use Partner Center `Export listings` / `Import listings`, or save
one language at a time from `store-listing-localized.json` and capture proof
after every language.

## Current Partner Center Evidence

Last checked in Partner Center on 2026-05-21 after saving the English Store
listing:

| Section | Live status | Evidence |
| --- | --- | --- |
| Pricing and availability | `Complete` | `tmp/partner-center-overview-after-save.png` |
| Properties | `Complete` | `tmp/partner-center-overview-after-save.png` |
| Age ratings | `Complete` | `tmp/partner-center-overview-after-save.png` |
| Store listings | `Complete` | `tmp/partner-center-overview-after-save.png` |
| Additional Store listing languages | `READY IN REPO / LIVE UNVERIFIED` for seven non-English listings; live Partner Center still `English only` | `store-listing-localized.json`; `tmp/partner-center-language-state-audit.png` |
| Languages supported in packages | `Unavailable until package upload` | `tmp/partner-center-language-state-audit.png` |
| Store MSIXUPLOAD candidate | `Generated by repo command, live upload still required` | `npm run desktop:store:package`; `tmp/microsoft-store-msix/package-manifest.json` |
| Packages | `Not started until generated package is uploaded and accepted` | `tmp/partner-center-overview-after-save.png` |
| Partner Center tabs audit | `PARTIAL` because package, package-language, account-verification, and certification rows still block submit | `PARTNER_CENTER_TABS_AUDIT.md`; `partner-center-tabs-audit.json` |

Certification was not submitted because the package upload step is still not
complete.

## Language Release Rule

The app source supports `en`, `uk`, `es`, `de`, `fr`, `ja`, `ar`, and `he`.
The repo now contains the full localized Store listing packet for those
languages. The current live Microsoft Store draft is still complete only for
English until the localized packet is imported or manually saved in Partner
Center and proof is captured.

Do not claim a complete live multilingual Store release until Partner Center
shows each added language as complete and package language proof is available.

## Release Gates Before Certification

Run these from the repository root after the final package/listing changes:

```bash
npm run check:all
npm run check:sync-contract
npm run check:canonical-orbs
npm run check:task-completion
npm run desktop:store:package
npm run desktop:store:check
npm run check:desktop-exe-contract
```

For this `MSIX or PWA app` Store path, Microsoft Store signing is handled by
Microsoft after certification. The repo-generated `.msixupload` must still be
accepted in Partner Center and pass Windows App Certification Kit or Store
certification checks. For direct public EXE/NSIS downloads, `npm run
desktop:release:check` still requires Valid Authenticode signatures.

## Stop Conditions

Stop and report `PARTIAL` or `UNVERIFIED` instead of claiming completion when:

- `Packages` is still `Not started`,
- `npm run desktop:store:package` has not generated the `.msixupload`,
- screenshots are below `1366x768`, over `50 MB`, or visually weak,
- Partner Center file upload cannot be confirmed,
- a direct EXE/NSIS public release remains unsigned,
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

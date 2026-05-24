# Microsoft Store Release Pack

This folder holds the non-secret Microsoft Store handoff for ZenFlow.

Current Partner Center state:

- Product: `ZenFlow`
- Product id: `9MZK46FHZV8K`
- Type: `MSIX or PWA app`
- Status: `In draft`

Use this folder for templates, checklists, screenshots, and WACK/MSIX evidence.
Do not place certificates, passwords, generated PFX files, Store credentials, or
private signing keys here.

Before editing Partner Center listing text or screenshots, read
`STORE_LISTING_QUALITY_GATE.md`. It contains the approved copy pack,
screenshot order, caption set, and self-audit checklist for a polished Store
listing.

When filling the live Partner Center form, use
`PARTNER_CENTER_FIELD_PACKET.md` as the one-page copy/upload packet. It repeats
only the current approved fields and keeps final certification blocked until
package/signing proof exists.

For multilingual Store listing work, use
`STORE_LISTING_LOCALIZED_PACKET.md` and
`store-listing-localized.json`. The app supports `en`, `uk`, `es`, `de`, `fr`,
`ja`, `ar`, and `he`; English is only the current live completed Store listing,
not the whole product language strategy.

For the current Partner Center draft, use `STORE_SUBMISSION_HANDOFF.md` as the
operator checklist. It separates safe listing work from the final package upload
and certification actions that need explicit product-owner approval.

Use `STORE_SUBMISSION_AUDIT.md` when checking the Partner Center questionnaires
or language state. The current app source supports `en`, `uk`, `es`, `de`,
`fr`, `ja`, `ar`, and `he`. The localized listing packet is prepared in the
repo for all eight languages, while the live Partner Center draft is currently
complete only for English and package-supported languages cannot be verified
until a package is uploaded.

Use `PARTNER_CENTER_TABS_AUDIT.md` and
`partner-center-tabs-audit.json` when checking every Partner Center tab. This is
the release-blocker matrix for Pricing, Properties, Age ratings, Store
listings, packages, account verification, optional services, and Submit for
certification. It prevents calling the Store submission complete while package,
language, or account proof is still missing.

## What To Copy From Partner Center

Open:

`Apps and games` -> `ZenFlow` -> `Product management` -> `Product Identity`

Copy these into trusted environment variables or CI variables:

- `ZENFLOW_STORE_PRODUCT_ID=9MZK46FHZV8K`
- `ZENFLOW_STORE_PACKAGE_IDENTITY_NAME=YehorSha.ZenFlow`
- `ZENFLOW_STORE_PUBLISHER=CN=EEB3FAA5-30F3-4886-A288-B72F7ED6729B`
- `ZENFLOW_STORE_PUBLISHER_DISPLAY_NAME=YehorSha`

The values are also recorded in `product-identity.public.json` as non-secret
public package metadata. They are case-sensitive. Do not invent or normalize
them.

## Readiness Command

Run:

```bash
npm run desktop:store:assets
npm run desktop:store:assets:check
npm run assets:logos:check
npm run desktop:store:package
npm run desktop:store:check
```

`desktop:store:assets` regenerates the Store logo/artwork pack from the clean
filter-free ZenFlow source. `desktop:store:assets:check` validates dimensions,
PNG file sizes, transparent app-tile corners, and the no-filter/no-hard-square
logo rule before the assets are uploaded.

`assets:logos:check` verifies the broader cross-platform logo chain: web/PWA
icons, maskable icon, favicon, Tauri/Windows icons, Android adaptive and legacy
icons, iOS app icon, Store upload-pack mirrors, and SVG source filters. Use
`npm run assets:logos` after changing logo source files.

`desktop:store:package` writes the current Store upload candidate to
`tmp/microsoft-store-msix/ZenFlow_1.7.3.0_x64.msixupload`.
`desktop:store:check` proves the Store guardrails are wired into the repo. If
Product Identity environment variables are absent, it reports that Store
packaging identity remains `UNVERIFIED`; that is expected until Partner Center
values are copied.

The generated file is not final proof until it becomes an accepted package in the Partner Center draft.

## Release Rule

Microsoft Store release is not complete until:

- `npm run desktop:store:check`
- `npm run assets:logos:check`
- `npm run desktop:store:assets:check`
- `npm run desktop:store:package`
- `npm run check:desktop-exe-contract`
- `npm run check:canonical-orbs`
- `npm run check:sync-contract`
- accepted generated MSIXUPLOAD package in the Partner Center draft
- Windows App Certification Kit proof or Partner Center certification result

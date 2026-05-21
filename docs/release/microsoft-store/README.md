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

For the current Partner Center draft, use `STORE_SUBMISSION_HANDOFF.md` as the
operator checklist. It separates safe listing work from the final package upload
and certification actions that need explicit product-owner approval.

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
npm run desktop:store:check
```

The command proves the Store guardrails are wired into the repo. If Product
Identity environment variables are absent, it reports that Store packaging
identity remains `UNVERIFIED`; that is expected until Partner Center values are
copied.

## Release Rule

Microsoft Store release is not complete until:

- `npm run desktop:store:check`
- `npm run check:desktop-exe-contract`
- `npm run check:canonical-orbs`
- `npm run check:sync-contract`
- signed installer or MSIX signature proof
- Windows App Certification Kit proof
- accepted package in the Partner Center draft

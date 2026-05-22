# ZenFlow Localized Store Listing Packet

Purpose: keep Microsoft Store multilingual listing work accurate, import-ready,
and separate from package-language proof.

This file fixes the Partner Center logic gap: ZenFlow supports more than
English in the app, while the live Store draft currently has only the English
listing saved. English screenshots were intentionally used for the English
Store listing and as the current neutral Desktop screenshot set. They do not
mean ZenFlow is an English-only app.

The field source of truth is:

`docs/release/microsoft-store/store-listing-localized.json`

## Supported Store Listing Languages

The packet covers every current ZenFlow app UI language:

| App locale | Microsoft Store listing language | Direction | Packet state |
| --- | --- | --- | --- |
| `en` | English | `ltr` | Ready and live listing already saved |
| `uk` | Ukrainian | `ltr` | Ready in packet, live Partner Center not yet saved |
| `es` | Spanish | `ltr` | Ready in packet, live Partner Center not yet saved |
| `de` | German | `ltr` | Ready in packet, live Partner Center not yet saved |
| `fr` | French | `ltr` | Ready in packet, live Partner Center not yet saved |
| `ja` | Japanese | `ltr` | Ready in packet, live Partner Center not yet saved |
| `ar` | Arabic | `rtl` | Ready in packet, live Partner Center not yet saved |
| `he` | Hebrew | `rtl` | Ready in packet, live Partner Center not yet saved |

## What Is Now Fixed

- The repo no longer treats `English` as the only prepared Store language.
- Every supported app language now has localized Store copy:
  - short description,
  - full description,
  - release notes,
  - ten feature rows,
  - four to seven search terms,
  - three screenshot captions.
- `npm run desktop:store:check` validates this packet and fails if any
  language is missing or weakly filled.
- Package-supported languages remain a separate Partner Center proof surface.
  They cannot be marked complete until a Store package is uploaded and Partner
  Center displays the detected package language list.

## Live Partner Center Rule

Do not use coordinate-only checkbox automation to add languages in Partner
Center. It is too easy to select the wrong language, especially after search
state or scroll state changes.

Use one of these safe paths:

1. **Export / Import listings, preferred for many languages**
   - In Partner Center, open `Store listings`.
   - Use `Export listings` to download Microsoft's current UTF-8 CSV/schema.
   - Copy values from `store-listing-localized.json` into the matching
     language rows and fields.
   - Import the completed file back through `Import listings`.
   - Save, return to the overview, and capture proof that each language is
     present and complete.

2. **Manual per-language edit, acceptable for one language at a time**
   - Open `Manage additional languages`.
   - Add exactly one language.
   - Save the language selection.
   - Open that language's listing page.
   - Paste only that language's values from
     `store-listing-localized.json`.
   - Save and capture proof before adding the next language.

## Screenshot Decision

The current Desktop screenshot set is:

| Order | File |
| --- | --- |
| 1 | `docs/release/microsoft-store/store-screenshots/desktop/01-v2-orb-desktop.png` |
| 2 | `docs/release/microsoft-store/store-screenshots/desktop/02-v2-habits-desktop.png` |
| 3 | `docs/release/microsoft-store/store-screenshots/desktop/03-v2-diary-desktop.png` |

Decision for this submission: English UI screenshots are the approved neutral
Desktop screenshot set. Non-English Store pages must still use localized copy
and localized captions. If localized UI screenshots are later required for a
market, replace the neutral decision with per-language screenshot evidence and
run the Store checks again.

## Copy Quality Bar

All language copy must stay:

- specific to ZenFlow,
- free of generic hype,
- free of clinical claims,
- honest about desktop, offline, sync-ready, V1/V2, and canonical WebGL orb
  behavior,
- aligned with current app capabilities,
- under Microsoft Store field limits.

Do not add claims that depend on a future package, paid feature, unpublished
updater, or unavailable account workflow.

## Required Proof Before Calling Multilingual Store Listing Complete

| Requirement | PASS evidence |
| --- | --- |
| Localized packet complete | `npm run desktop:store:check` |
| App i18n complete | `npm run i18n:check` and `npm run i18n:deep` |
| Store import/manual save complete | Partner Center proof for every added language |
| Package languages complete | Partner Center package-language table after package upload |
| Screenshots acceptable | File dimensions, PNG format, Store-safe visual review |
| No false submission claim | Certification remains unsubmitted until package/signing/WACK proof exists |

Until Partner Center proof exists, the correct status is:

`READY IN REPO / LIVE UNVERIFIED`

That is a real completion state for the repository packet, not a live Store
submission claim.

## Official Microsoft References

- Store listing fields:
  https://learn.microsoft.com/en-us/windows/apps/publish/publish-your-app/msix/add-and-edit-store-listing-info
- Store screenshots and images:
  https://learn.microsoft.com/en-us/windows/apps/publish/publish-your-app/msix/screenshots-and-images
- Supported Store languages:
  https://learn.microsoft.com/en-us/windows/apps/publish/publish-your-app/supported-languages
- Import and export Store listings:
  https://learn.microsoft.com/en-us/windows/apps/publish/publish-your-app/msix/import-and-export-store-listings
- Package-supported languages:
  https://learn.microsoft.com/en-us/windows/apps/publish/publish-your-app/msix/app-package-requirements#supported-languages

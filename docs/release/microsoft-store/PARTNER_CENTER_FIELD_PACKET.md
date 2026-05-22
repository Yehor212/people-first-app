# ZenFlow Partner Center Field Packet

Purpose: one operator-safe packet for filling the current ZenFlow Microsoft
Store draft without mixing prepared assets with final certification.

Use this file when Partner Center is open at:

`Apps and games` -> `ZenFlow` -> `Submission 1`

Do not click `Submit for certification` from this packet. Certification is a
separate release action that requires package/signing proof and explicit owner
approval in the active thread.
For the current `MSIX or PWA app` path, "package proof" means the generated
MSIXUPLOAD has been accepted in Partner Center; direct EXE/NSIS signing is a
separate distribution path.

## Product Identity

These values are public Partner Center identity fields. They are not secrets.

| Field | Value |
| --- | --- |
| Product name | `ZenFlow` |
| Product id | `9MZK46FHZV8K` |
| Type | `MSIX or PWA app` |
| Package/Identity/Name | `YehorSha.ZenFlow` |
| Package/Identity/Publisher | `CN=EEB3FAA5-30F3-4886-A288-B72F7ED6729B` |
| Package/Properties/PublisherDisplayName | `YehorSha` |
| Package family name | `YehorSha.ZenFlow_5m5fhwz1wz4xt` |
| Store URL | `https://apps.microsoft.com/detail/9MZK46FHZV8K` |

## Store Listing Text

Use this section for the English Store listing only. For every other supported
language, use `STORE_LISTING_LOCALIZED_PACKET.md` and
`store-listing-localized.json`. Do not paste English text into a non-English
listing as a shortcut.

### Short description

```text
A calm Windows wellness space for mood check-ins, habits, journaling, and focus rituals - built around ZenFlow's V2 visual flow and a dedicated desktop runtime.
```

### Full description

```text
ZenFlow turns daily wellness into a quiet desktop ritual.

Open one focused space for mood check-ins, habit tracking, private journaling, and focus sessions. The V2 experience is built around ZenFlow's canonical WebGL orb system: soft, responsive, and visual without turning your day into another noisy dashboard.

Use ZenFlow when you want to slow down for a minute, name what you feel, keep small habits visible, and return to your work without carrying the whole day in your head.

What you can do:

Track your mood with a visual V2 check-in flow.
Build habits and daily rituals without clutter.
Write private journal entries and keep reflection close.
Use focus sessions when you need a clean work block.
Review patterns and personal insights over time.
Keep working offline, then sync when your account is available.
Use the same ZenFlow visual language across V1, V2, web, PWA, and desktop.

Why the desktop version exists:

The desktop shell gives ZenFlow its own controlled Windows space instead of relying on a crowded browser profile with many tabs, extensions, and stale cache. The goal is simple: keep the same ZenFlow visuals, keep the same data contract, and make the app feel steadier on desktop.

ZenFlow is designed for everyday reflection and self-organization. It is not a medical device and does not provide medical advice, diagnosis, or treatment.
```

### What's new in this version

Use this only if Partner Center requires release notes for the draft. If this
is treated as the first submission and Partner Center allows it, leaving it
blank is also valid.

```text
Initial Microsoft Store submission for ZenFlow desktop: V2 mood flow, habits, journal, focus sessions, canonical WebGL visuals, and the desktop release shell.
```

### Product features

Paste each item as a separate Partner Center feature row. Do not add bullet
characters; Partner Center renders the bullet list.

```text
V2 mood check-ins with ZenFlow's canonical WebGL orb visuals
Habit tracking for daily rituals and streaks
Private journal for short notes and longer reflection
Focus sessions for calm work blocks
Desktop shell designed for fewer browser-profile distractions
Offline-capable workflow with sync-ready account support
Personal insights without a noisy dashboard
Light, dark, and OLED-friendly visual modes
V1 and V2 surfaces kept under one sync contract
In-app language support across English, Ukrainian, Spanish, German, French, Japanese, Arabic, and Hebrew
```

### Search terms

Use at most seven unique terms or phrases.

```text
wellness
mood tracker
habit tracker
journal
focus timer
offline wellness
desktop wellness
```

### Supplemental fields

| Partner Center field | Value |
| --- | --- |
| Short title | `ZenFlow` |
| Sort title | `ZenFlow` |
| Voice title | `ZenFlow` |
| Developed by | `YehorSha` |
| Copyright | `Copyright 2026 YehorSha. All rights reserved.` |

## Language State

Do not confuse app i18n with Store listing languages.

| Surface | Current state |
| --- | --- |
| App UI source languages | `en, uk, es, de, fr, ja, ar, he` |
| English Store listing | `Complete` in Partner Center |
| Additional Store listing languages | `READY IN REPO / LIVE UNVERIFIED` for `uk, es, de, fr, ja, ar, he`; only `English` is currently live complete |
| Languages supported in packages | Empty until the Store package is uploaded |

The English screenshots and English listing copy are for `languagecode=en`.
Additional Store listing languages must be filled from
`store-listing-localized.json`, preferably through Partner Center
Export/Import. Package languages are a separate Partner Center proof surface and
cannot be completed until the package is uploaded.

## Store Package Upload

Generate the package from the repo before opening the Partner Center `Packages`
tab:

```bash
npm run desktop:store:package
```

Upload this generated file:

```text
tmp/microsoft-store-msix/ZenFlow_1.7.3.0_x64.msixupload
```

The generator uses the public Partner Center identity values:

```text
Name: YehorSha.ZenFlow
Publisher: CN=EEB3FAA5-30F3-4886-A288-B72F7ED6729B
PublisherDisplayName: YehorSha
Version: 1.7.3.0
Architecture: x64
Languages: en-us, uk, es, de, fr, ja, ar, he
```

Do not upload the NSIS setup EXE to this `MSIX or PWA app` product path.
Microsoft Store signing happens after certification for this Store MSIX upload
path. Direct EXE/NSIS distribution remains separate and still needs
Authenticode signing.

## Localized Store Listing Packet

Before changing `Manage additional languages`, review:

- `docs/release/microsoft-store/STORE_LISTING_LOCALIZED_PACKET.md`
- `docs/release/microsoft-store/store-listing-localized.json`
- `docs/release/microsoft-store/PARTNER_CENTER_TABS_AUDIT.md`
- `docs/release/microsoft-store/partner-center-tabs-audit.json`

Prepared listing languages:

```text
English, Ukrainian, Spanish, German, French, Japanese, Arabic, Hebrew
```

Safe live-update rule: do not use coordinate-only checkbox automation. Use
Partner Center `Export listings` / `Import listings`, or add and save one
language at a time with a screenshot after each language. If Partner Center
proof is missing, the correct status is `READY IN REPO / LIVE UNVERIFIED`, not
`PASS`.

## Desktop Screenshots

Upload these files under the Desktop screenshot family in this exact order.
All three files are public-safe ZenFlow surfaces, committed release assets, PNG,
`1440x900`, and below the Microsoft Store `50 MB` image limit.

| Order | File | Caption |
| --- | --- | --- |
| 1 | `docs/release/microsoft-store/store-screenshots/desktop/01-v2-orb-desktop.png` | `Name your mood in a quiet visual flow that stays out of your way.` |
| 2 | `docs/release/microsoft-store/store-screenshots/desktop/02-v2-habits-desktop.png` | `Build steady daily rituals without turning your day into a dashboard.` |
| 3 | `docs/release/microsoft-store/store-screenshots/desktop/03-v2-diary-desktop.png` | `Keep private reflection close to your work, with space to start small.` |

Do not upload `tmp/store-candidates/04-desktop-download-page-settled.png`.
That rejected capture has a hero text/orb overlap and is not Store-ready.

## Store Logo Upload Map

Use the official logo set. The orb draft folder is visual reference only and
must not replace the official logo set unless the owner explicitly chooses a
new Store identity direction.

| Partner Center slot | Upload file |
| --- | --- |
| App tile icon / Store logo 300x300 | `docs/release/microsoft-store/assets/official-logo/zenflow-official-app-tile-icon-300.png` |
| App tile icon / Store logo 150x150 | `docs/release/microsoft-store/assets/official-logo/zenflow-official-app-tile-icon-150.png` |
| App tile icon / Store logo 71x71 | `docs/release/microsoft-store/assets/official-logo/zenflow-official-app-tile-icon-71.png` |
| 1:1 box art | `docs/release/microsoft-store/assets/official-logo/zenflow-official-box-art-2160.png` |
| 2:3 poster art | `docs/release/microsoft-store/assets/official-logo/zenflow-official-poster-art-1440x2160.png` |
| 16:9 super hero art | `docs/release/microsoft-store/assets/official-logo/zenflow-official-super-hero-art-1920x1080.png` |

## Manual Save Checklist

Mark a row `PASS` only after seeing it in Partner Center after save.

| Row | Status |
| --- | --- |
| Pricing and availability complete | `PASS - seen in tmp/partner-center-overview-after-save.png on 2026-05-21` |
| Properties complete | `PASS - seen in tmp/partner-center-overview-after-save.png on 2026-05-21` |
| Age ratings complete | `PASS - seen in tmp/partner-center-overview-after-save.png on 2026-05-21` |
| Store listings complete | `PASS - seen in tmp/partner-center-overview-after-save.png on 2026-05-21` |
| Store MSIXUPLOAD candidate generated | `PASS only after npm run desktop:store:package writes tmp/microsoft-store-msix/ZenFlow_1.7.3.0_x64.msixupload` |
| Additional Store listing languages reviewed | `READY IN REPO / LIVE UNVERIFIED - store-listing-localized.json covers all 8 app languages; tmp/partner-center-language-state-audit.png still shows only English live complete` |
| Localized Store listing packet reviewed | `PASS - npm run desktop:store:check validates localized copy, captions, search terms, and screenshot decision` |
| Package language list reviewed | `FAIL - tmp/partner-center-language-state-audit.png shows package languages are unavailable until package upload` |
| Desktop screenshots uploaded and visible | `PASS - three English Desktop screenshots uploaded and captioned in Partner Center` |
| Store logos uploaded and visible | `PASS - poster, box, app tile 300/150/71, and super hero art uploaded in Partner Center` |
| Partner Center tabs audit reviewed | `PARTIAL - PARTNER_CENTER_TABS_AUDIT.md covers every visible tab; package, package-language, account-verification, and certification rows remain blockers` |
| Packages uploaded and accepted | `FAIL until the generated .msixupload is accepted in Partner Center` |
| Signed package or Microsoft Store package acceptance proof | `UNVERIFIED until package upload/certification evidence is complete` |
| Certification submitted | `NO - do not submit from this packet` |

## Required Repo Proof Before Certification

Run from the repository root after final listing/package changes:

```bash
npm run check:all
npm run check:sync-contract
npm run check:canonical-orbs
npm run check:task-completion
npm run desktop:store:package
npm run desktop:store:check
npm run check:desktop-exe-contract
npm run i18n:check
npm run i18n:deep
```

For a local development package, `npm run desktop:release:check:dev` may pass
with an explicit unsigned warning. For this public Microsoft Store MSIX path,
that warning is not enough; Partner Center must accept the generated
MSIXUPLOAD and certification/WACK proof must be current. For direct public
EXE/NSIS distribution, `npm run desktop:release:check` must show Valid
Authenticode signatures.

## Microsoft Source Rules

- Store listing minimum: description plus at least one screenshot.
- Microsoft recommends multiple images and helpful listing information.
- Product features are separate Store bullets and must stay under 200
  characters each.
- Desktop screenshots must be PNG, at least `1366x768`, no larger than `50 MB`.
- The English listing (`languagecode=en`) must use English UI screenshots; do
  not upload localized Ukrainian, Russian, or mixed-language captures to the
  English Store listing.
- Critical screenshot visuals and text should stay in the top two-thirds
  because Store overlays may cover the bottom third.
- Do not add extra logos, icons, or marketing messages to screenshots.

Official references:

- `https://learn.microsoft.com/en-us/windows/apps/publish/publish-your-app/msix/add-and-edit-store-listing-info`
- `https://learn.microsoft.com/en-us/windows/apps/publish/publish-your-app/msix/screenshots-and-images`
- `https://learn.microsoft.com/en-us/windows/apps/publish/store-policies`

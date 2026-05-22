# ZenFlow Partner Center Field Packet

Purpose: one operator-safe packet for filling the current ZenFlow Microsoft
Store draft without mixing prepared assets with final certification.

Use this file when Partner Center is open at:

`Apps and games` -> `ZenFlow` -> `Submission 1`

Do not click `Submit for certification` from this packet. Certification is a
separate release action that requires package/signing proof and explicit owner
approval in the active thread.

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
Multi-language product foundation
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
| Desktop screenshots uploaded and visible | `PASS - three English Desktop screenshots uploaded and captioned in Partner Center` |
| Store logos uploaded and visible | `PASS - poster, box, app tile 300/150/71, and super hero art uploaded in Partner Center` |
| Packages uploaded and accepted | `FAIL - Partner Center shows Packages as Not started` |
| Signed package or Microsoft Store package acceptance proof | `UNVERIFIED until package step is complete` |
| Certification submitted | `NO - do not submit from this packet` |

## Required Repo Proof Before Certification

Run from the repository root after final listing/package changes:

```bash
npm run check:all
npm run check:sync-contract
npm run check:canonical-orbs
npm run check:task-completion
npm run desktop:store:check
npm run check:desktop-exe-contract
```

For a local development package, `npm run desktop:release:check:dev` may pass
with an explicit unsigned warning. For a public Microsoft Store submission,
that warning is not enough; a signed MSIX/package acceptance path is required.

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

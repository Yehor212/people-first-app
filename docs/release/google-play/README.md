# Google Play Release Pack

This folder is the repo source of truth for Google Play Console upload assets
and release declarations. It exists so Play Console forms are filled from
verified files, not from ad hoc exports.

## Current Release Decision

ZenFlow's current Android path is an **ads-enabled draft** built around
optional rewarded ads. Play Console must match the artifact:

- Ads declaration: `Yes`.
- Advertising ID declaration: `Yes`.
- Ad format: optional rewarded ads only.
- No banners, no pop-ups, and no interstitials during mood checks, active focus,
  or journaling.
- User-facing ad initialization stays behind ZenFlow privacy consent and the
  native Google UMP consent flow.

Evidence expected before production monetization:

- `package.json` installs `@capacitor-community/admob`.
- `android/app/src/main/AndroidManifest.xml` declares the AdMob app ID metadata.
- The built release manifest requests
  `com.google.android.gms.permission.AD_ID`.
- The built release manifest may also include Android `ACCESS_ADSERVICES_*`
  permissions contributed by Google Mobile Ads. Treat those as part of the same
  ads-enabled declaration path.
- `GOOGLE_PLAY_LOCALIZED_LISTING_PACKET.json` declares `ads=Yes` and
  `advertisingId=Yes`.
- Real AdMob app/ad unit IDs are configured outside the repo before publishing.
- `public/app-ads.txt` should be added with the real AdMob publisher line before
  production monetization. Do not add a fake publisher line.

## Generated Assets

Run:

```bash
npm run google-play:assets
npm run google-play:assets:check
```

Output:

- `assets/google-play-app-icon-512.png`
- `assets/google-play-feature-graphic-1024x500.png`
- `screenshots/desktop/01-v2-orb-desktop.png`
- `screenshots/desktop/02-v2-habits-desktop.png`
- `screenshots/desktop/03-v2-diary-desktop.png`

The feature graphic is intentionally not a plain app-icon banner. It is the
product-led key visual for the listing: canonical ZenFlow leaf mark from
`public/icon-512.png`, a short emotional hook, mood/habit/journal pillars, a
real V2 mood-flow product panel, and the mood-color path. It avoids fake device
hardware frames and keeps screenshots as separate full-interface proof.

## Localized Listing Packet

Use `GOOGLE_PLAY_LOCALIZED_LISTING_PACKET.json` as the copy/paste source for
Google Play Store listings. It intentionally does not reuse `docs/STORE_LISTING.md`
for non-English copy because that older marketing draft contains mojibake text
in several sections.

Current required listing languages:

- `en-US` English (United States)
- `uk-UA` Ukrainian
- `es-ES` Spanish (Spain)
- `de-DE` German
- `fr-FR` French
- `ja-JP` Japanese
- `ar-SA` Arabic
- `he-IL` Hebrew

The release check validates that every listing has a non-empty app name, short
description, full description, feature bullets, and what's-new text within the
Google Play field limits used by this release packet. It also verifies the
packet remains draft-only and aligned with the current ads/Advertising-ID
release decision.

## Official Google Requirements Used

- App icon: 512 x 512, 32-bit PNG with alpha, max 1024 KB.
  Source: https://support.google.com/googleplay/android-developer/answer/9866151
- Feature graphic and preview assets are managed in Play Console under the main
  store listing graphics section.
  Source: https://support.google.com/googleplay/android-developer/answer/9866151
- Screenshots: JPEG or 24-bit PNG with no alpha, min 320 px, max 3840 px, and
  the max side must not be more than twice the min side.
  Source: https://support.google.com/googleplay/android-developer/answer/9866151
- Ads declaration must reflect whether the app contains ads, including ads from
  third-party ad SDKs.
  Source: https://support.google.com/googleplay/android-developer/answer/9859455
- Android manifest merge rules must remove unwanted library manifest elements
  from the final merged manifest when a dependency contributes them.
  Source: https://developer.android.com/studio/build/manifest-merge

## Completion Gate

Do not submit or claim Play Store readiness unless this command passes after the
final asset/code change:

```bash
npm run google-play:assets:check
```

For advertising declarations, this check inspects the generated release manifest
when present. Run an Android release manifest/build step before final submission
so the gate can inspect the same merged permissions that Play Console receives.

For release work, also run the broader gates from
`docs/ai/TASK_COMPLETION_PROTOCOL.md`.

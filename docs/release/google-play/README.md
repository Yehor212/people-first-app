# Google Play Release Pack

This folder is the repo source of truth for Google Play Console upload assets
and release declarations. It exists so Play Console forms are filled from
verified files, not from ad hoc exports.

## Current Release Decision

ZenFlow's current Android path is an **ads-enabled draft** built around one
optional adaptive banner below the active Habits list. Play Console must match
the artifact:

- Ads declaration: `Yes`.
- Advertising ID declaration: `Yes`.
- Ad format: one optional adaptive banner below the active Habits list after
  consent.
- No rewarded, interstitial, rewarded-interstitial, app-open, or native ads.
- No ads during mood checks, active focus, journaling, planning, settings,
  menus, sheets, or dialogs.
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
- `public/app-ads.txt` must be generated with the real AdMob publisher line
  before production monetization. Do not add a fake or sample publisher line.
  After deployment, verify the same file at the root of the developer website
  configured in Play Console/AdMob. For a GitHub Pages project URL, this may
  require a user-site root, custom domain, or redirect because AdMob crawlers
  validate the site root, not just the app subpath.
  Use:

```bash
ZENFLOW_ADMOB_PUBLISHER_ID=pub-0000000000000000 npm run google-play:app-ads
ZENFLOW_ADMOB_PUBLISHER_ID=pub-0000000000000000 npm run google-play:app-ads:check
ZENFLOW_APP_ADS_PUBLIC_URL=https://your-developer-domain.example/app-ads.txt npm run google-play:app-ads:public-check
npm run google-play:app-ads:public-check:zenflow
npm run google-play:public-listing:check
npm run google-play:privacy:public-check
npm run google-play:admob:check
npm run google-play:admob:ump-check
```

The script refuses Google's sample publisher id and writes the official AdMob
seller line format only. The production readiness check rejects Google sample
app/ad-unit IDs and masks publisher fragments in logs. Android release Gradle
builds fail fast if `ZENFLOW_ADMOB_ANDROID_APP_ID` / `VITE_ADMOB_APP_ID_ANDROID`
is missing or still points at a Google sample app ID. The current banner gate
also requires `VITE_ADMOB_BANNER_ID_ANDROID`; rewarded and iOS IDs are not part
of this Android-only release. `ADMOB_OWNER_FINALIZATION_RUNBOOK.md` and the
external readiness ledger describe the superseded rewarded-only decision and
must not be used as current banner-release evidence until their schemas are
migrated.

Current GitHub Pages root proof for this app uses:

```bash
npm run google-play:app-ads:public-check:zenflow
```

If AdMob still reports that app-ads.txt data does not match, check the public
Google Play listing before changing the file. For `com.zenflow.app`, the
2026-06-30 follow-up probe shows the Store listing contact details -> website
value as
`https://yehor212.github.io/people-first-app/`, which fixes the previous
`appstore:developer_url=about:invalid#navigation` blocker. `npm run google-play:public-listing:check`
now verifies the public listing has the Google Play `Contains ads` signal,
privacy policy URL, Habits-list banner copy, no rewarded-ad copy, and no stale
`No ads` claim. If AdMob still shows the
app-ads.txt mismatch warning after these checks pass, retry AdMob `Verify app`
after Google's crawler has time to refresh.

Run `npm run google-play:privacy:artifact-check` after staging the Pages artifact, then rely on the GitHub Pages post-deploy public privacy smoke, and run `npm run google-play:privacy:public-check` before Play Data safety or
AdMob production-readiness claims. It verifies that the public privacy policy
URL discloses the current Google Mobile Ads / AdMob surface, UMP privacy choices,
Advertising ID, the optional Habits-list banner, and Google Mobile Ads SDK data
categories.
It does not replace the post-deploy public privacy smoke or owner-only Play Console Data safety proof.

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

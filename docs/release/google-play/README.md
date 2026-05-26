# Google Play Release Pack

This folder is the repo source of truth for Google Play Console upload assets
and release declarations. It exists so Play Console forms are filled from
verified files, not from ad hoc exports.

## Current Release Decision

ZenFlow's current Android artifact must be submitted as **no ads**.

Evidence:

- `package.json` does not install `@capacitor-community/admob`.
- `android/app/src/main/AndroidManifest.xml` must not declare the AdMob app ID.
- The built release manifest must not request
  `com.google.android.gms.permission.AD_ID` or Android `ACCESS_ADSERVICES_*`
  permissions.
- `android/app/google-services.json` must not include `admob_app_id`.
- `public/app-ads.txt` must not publish ad seller lines.
- Rewarded ad UI remains dormant unless a future release adds the SDK, env IDs,
  privacy consent, and Play Console ad/data declarations together.

If a future release ships AdMob, make that a separate release task and update:

- `package.json`
- `android/app/src/main/AndroidManifest.xml`
- Google Play App content: Ads
- Google Play App content: Data safety / Advertising ID
- `public/app-ads.txt`
- `android/app/google-services.json`
- `docs/AD_SYSTEM_JOURNEY.md`
- `docs/release/google-play/GOOGLE_PLAY_CONSOLE_FIELD_PACKET.md`

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

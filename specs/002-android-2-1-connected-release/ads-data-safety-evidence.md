# Android 2.1 Ads and Data Safety Evidence

> **HISTORICAL / SUPERSEDED:** captured before the 2026-08-11 monetization correction. Reward/rewarded statements below are not current requirements or readiness proof. Canonical status is ADR-MON-001 in `spec.md`; all legacy reward paths remain OFF and `LEGACY / UNVERIFIED`.

**Captured**: 2026-08-08

**Scope**: current local source, debug APK, public privacy URL and public `app-ads.txt` only

**Release verdict**: `STOP`

## Verified local and public facts

| Surface | Status | Current evidence |
|---|---|---|
| Android advertising permission | VERIFIED | `android/app/src/main/AndroidManifest.xml` declares `com.google.android.gms.permission.AD_ID`; `apkanalyzer manifest print android/app/build/outputs/apk/debug/app-debug.apk` confirmed it in the API-36 debug artifact. |
| AdMob application ID binding | VERIFIED locally | The manifest uses `${adMobApplicationId}`. Debug resolves to Google's documented sample application ID; `android/app/build.gradle` rejects a missing or sample ID whenever a release task is requested. No production ID is recorded in source or this ledger. |
| SDK versions | VERIFIED locally | `android/variables.gradle` pins Google Mobile Ads `25.4.0` and UMP `4.0.0`; the release-config tests reject floating or mismatched resolution. |
| Ad formats | VERIFIED locally | Runtime/configuration exposes rewarded ads only. Focused UMP, controller, privacy, durable settlement and release-config checks passed 11 files / 111 tests. Banner, interstitial, rewarded-interstitial, native and app-open identifiers/APIs are rejected by static release tests. |
| Consent and withdrawal | VERIFIED locally | Current UMP state is requested before GMA initialization; every load requires current `canRequestAds()`. Settings retains app consent and exposes Google privacy options when required. Errors and missing configuration fail closed. |
| Reward settlement | VERIFIED locally | Reward attempts use a durable owner-bound ledger with one terminal settlement; duplicate callbacks, replay, dismiss and failure are covered by focused tests. Emulator process-death and live callback behavior remain separate. |
| Context safety | VERIFIED locally | Missing/unknown zones, unknown premium status, unsupported platform, stale service permission, recent negative mood and sacred flows deny the request. The sole initial approved zone is `optional_rewards`; caller-provided reward/CTA prose is not accepted. |
| Non-Android behavior | VERIFIED locally | The controller requires a native Android/iOS platform and a configured unit; Web/Vite, installed PWA and Desktop/Tauri fail closed without loading an ad. iOS remains separately configured and was not runtime-tested here. |
| Android network policy | VERIFIED for target 36 | The merged debug manifest targets API 36 and contains no cleartext opt-in or custom network-security override. Android's platform default for target API 28+ denies cleartext traffic. Release-artifact reinspection is still required. |
| Public privacy policy | VERIFIED public reachability/content | `npm run google-play:privacy:public-check` returned HTTP 200 and found Google Mobile Ads, UMP choices, Advertising ID, rewarded ads and Google Mobile Ads data disclosure, with no stale `No ads` claim. |
| Public `app-ads.txt` | VERIFIED public reachability only | `npm run google-play:app-ads:public-check:zenflow` passed and reported the masked publisher identity. This does not prove the current AdMob crawler or app-verification state. |

## Required declarations and unresolved authority

| Item | Status | Release condition |
|---|---|---|
| Ads declaration | UNVERIFIED in Play Console | The exact uploaded ads-enabled AAB must be matched to Play Console `Contains ads = Yes`. |
| Advertising ID declaration | UNVERIFIED in Play Console | The exact AAB manifest and Play Advertising ID declaration must agree. |
| Data safety | UNVERIFIED in Play Console | Owner must review Google Mobile Ads SDK collection/sharing categories against the exact resolved SDK and public privacy policy. Wellness content must not be described as advertising data. |
| Target audience / age treatment | UNVERIFIED | `VITE_ADMOB_CHILD_DIRECTED_TREATMENT` and `VITE_ADMOB_UNDER_AGE_OF_CONSENT` are absent from the release evidence environment; ads remain disabled. Owner decision and console alignment are required. |
| Production Android app ID | UNVERIFIED | `VITE_ADMOB_APP_ID_ANDROID` is absent from the release evidence environment. Recover the existing authenticated app ID; do not invent or commit one. |
| Production rewarded unit ID | UNVERIFIED | `VITE_ADMOB_REWARDED_ID_ANDROID` is absent from the release evidence environment. Reuse the authenticated existing unit unless console evidence proves it unusable. |
| UMP message publication | UNVERIFIED in AdMob | Required geography/language/privacy-options messages must be reviewed and published in the authenticated console, then exercised with UMP debug geography on an emulator. |
| AdMob account/readiness/policy/payment | UNVERIFIED | Reactivation, Policy Center, app readiness, phone/payment/tax state and crawler verification require an owner-authenticated checkpoint. |
| Live rewarded playback | UNVERIFIED | Only Google's test unit may be exercised before the production evidence gate. Earned, dismissed, no-fill, consent-revoked and process-death flows need retained emulator/device evidence. |

## Fresh commands

- `npx --no-install vitest run ...ads/UMP/privacy/release-config files... --maxWorkers=1` — PASS, 11 files / 111 tests.
- `npm run google-play:admob:release-config-check` — exit 2: audience treatment and production Android app/rewarded identifiers are `UNVERIFIED`.
- `npm run google-play:privacy:public-check` — PASS, HTTP 200 and required disclosures present.
- `npm run google-play:app-ads:public-check:zenflow` — PASS for public reachability and masked publisher match.
- `npm run google-play:app-ads:check` — FAIL because the owner-controlled publisher environment value was not supplied; the check was not bypassed by copying a value from source.
- `npm run google-play:assets:check` — FAIL because `docs/release/google-play/screenshots/desktop/01-v2-orb-desktop.png` is missing; public policy checks do not close this release-assets gate.

## Official behavior references

- Android network security defaults: <https://developer.android.com/privacy-and-security/security-config>
- Google Mobile Ads Android setup: <https://developers.google.com/admob/android/quick-start>
- UMP privacy flow: <https://developers.google.com/admob/android/privacy>
- Google Mobile Ads Play data disclosure: <https://developers.google.com/admob/android/privacy/play-data-disclosure>

This ledger is not an AAB, Play Console, AdMob Console, crawler, human-review or production-traffic receipt. It must be regenerated against the exact release configuration and artifact.

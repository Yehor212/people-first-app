# ZenFlow AdMob Owner Finalization Runbook

## External Finalization Status

Current scope: one anchored adaptive Android banner on the Habits screen. No
rewarded, interstitial, app-open, native, or production test/sample ad unit is
part of this release.

| Evidence row | Status | Boundary |
| --- | --- | --- |
| `public_app_ads_root` | PASS | Historical public root proof; recheck after deploy. |
| `admob_app_ads_txt_status` | UNVERIFIED | Historical AdMob app verification proof is stale; recheck before release. |
| `public_google_play_listing` | UNVERIFIED | Current public Habits banner copy is not freshly verified. |
| `public_privacy_policy` | UNVERIFIED | Current public Habits banner disclosure is not freshly verified. |
| `admob_app_readiness` | UNVERIFIED | Recheck current Ready/ad-serving state before release. |
| `admob_policy_center` | PARTIAL | No-violation view was observed; granular restrictions remain unverified. |
| `privacy_messages_cmp` | PARTIAL | Published Privacy & messages / CMP proof remains incomplete. |
| `payments_tax_info` | UNVERIFIED | Owner-only status; never store private tax data. |
| `payments_identity_address` | UNVERIFIED | Owner-only status; never store identity/address details. |
| `payments_payment_method` | UNVERIFIED | Owner-only status; never store payment details. |
| `payments_holds` | UNVERIFIED | Owner-only public-safe summary required. |
| `play_console_ads_data_safety` | PARTIAL | Ads, Advertising ID, Data safety, and manifest parity need current proof. |
| `live_ad_playback_device` | UNVERIFIED | No release-device request, impression, or protected-surface proof yet. |

`google-play:admob:external-check:pass` is the current Android banner gate.

## Fail-closed production contract

- Production Android requires owner-controlled, non-sample
  `VITE_ADMOB_APP_ID_ANDROID` or `ZENFLOW_ADMOB_ANDROID_APP_ID` and
  `VITE_ADMOB_BANNER_ID_ANDROID` from the same publisher family as
  `public/app-ads.txt`.
- `google-play:admob:check` is the current Android banner environment gate.
- `google-play:admob:aab-check` proves that the release AAB contains the configured
  app ID, exactly one configured banner unit, and no sample or extra ad-unit IDs.
- Required IDs must not use Google sample IDs. Missing, malformed, sample,
  mismatched, or test identifiers keep the release non-PASS. No fallback
  identifier or synthetic ad response is allowed in a production bundle.
- Development builds keep ads disabled. A Google test-ad harness cannot serve as
  release evidence and must never enter the production runtime/bundle.

```bash
npm run google-play:app-ads:check
npm run google-play:admob:check
npm run google-play:admob:aab-check
npm run google-play:admob:ump-check
npm run google-play:admob:external-check
```

## Privacy & messages / CMP

Before any ad request:

1. Request current consent information at launch.
2. Show the required Google-certified CMP form.
3. Check `canRequestAds`; do not issue duplicate requests when more than one
   consent callback reports true.
4. Keep the privacy-options entry point reachable whenever Google requires it.
5. Verify EEA/UK/Switzerland targeting, TCF v2.3, the public privacy URL, and
   Google-supported languages. Review explicit fallbacks for Arabic (ar) and
   Hebrew (he) without claiming unavailable Google CMP translations.
6. Revocation must remove the banner and prevent new requests.

Privacy controls are consent, disclosure, withdrawal, and privacy options only.
The banner never appears inside Settings, Privacy, authentication, onboarding,
mood check-ins, journal, focus, or modal/drawer/sheet surfaces.

Sources:

- https://developers.google.com/admob/android/privacy
- https://support.google.com/admob/answer/10113207
- https://support.google.com/admob/answer/13554116

## Play Console and privacy declarations

The owner must freshly confirm:

- Ads = Yes.
- Advertising ID = Yes when the exact release manifest contains the permission.
- Data safety covers current Google Mobile Ads SDK collection/sharing, including
  IP address, user product interactions, diagnostics, and device or other
  identifiers.
- The public listing uses Contains ads, links the current privacy policy, and
  discloses the Habits banner without rewarded wording.
- The privacy policy names Google Mobile Ads, UMP/privacy choices, Advertising
  ID behavior, SDK data categories, and consent withdrawal.

Sources:

- https://support.google.com/googleplay/android-developer/answer/9859455
- https://developers.google.com/admob/android/privacy/play-data-disclosure

## Policy Center and account readiness

Record only public-safe status summaries for:

- AdMob app Ready, Google Play linked, intended banner unit active.
- Policy Center: no violations, no blocking issues, no regulatory issues, no
  advertiser-preference restrictions, and no restricted/disabled requests.
- Payments, identity, tax, and holds: PASS only when the owner sees no action
  required. Forbidden evidence: raw IDs, screenshots, names, addresses, tax,
  identity, bank, payment, or email details.

Sources:

- https://support.google.com/admob/answer/10564477
- https://support.google.com/admob/answer/10448801
- https://support.google.com/admob/answer/15697162

## Release-equivalent live Android banner smoke

Do this only after app-ads, readiness, Policy Center, CMP, and Play declarations
are PASS. Use the exact Play-installed production artifact. Do not request live
production ads from a development emulator.

Required checks:

1. Complete consent and open Habits after the three-day onboarding grace period.
2. Confirm one anchored adaptive banner renders at the bottom without covering
   content, navigation, safe areas, or touch targets.
3. Confirm AdMob records both an ad request and an impression for the release.
4. Rotate and test split-screen; the adaptive banner is removed and recreated
   for the new width without duplicates.
5. Background and foreground the app; no stale native banner survives.
6. Open drawer, sheet, modal, authentication, Settings, Privacy, mood logging,
   active focus, focus reflection, journal, and onboarding; no banner or request
   may remain on any protected surface.
7. Test bad and terrible mood states; no banner or request may appear.
8. Revoke consent; the banner is removed and no new request occurs.
9. Test no-fill/offline/error paths; app content remains usable and no fake ad
   or synthetic success state is shown.

`live_ad_playback_device: PASS` requires every structured fact below:

- `releaseEquivalentAndroid`
- `consentPathCompleted`
- `habitsBannerRendered`
- `adMobRequestObserved`
- `adMobImpressionObserved`
- `bannerDoesNotOverlapAppContent`
- `rotationRecreatesAdaptiveBanner`
- `backgroundRemovesBanner`
- `revocationStopsNewAdRequests`
- `noMoodCheckInBannerOrRequest`
- `noActiveFocusBannerOrRequest`
- `noFocusReflectionBannerOrRequest`
- `noJournalEditorBannerOrRequest`
- `noOnboardingBannerOrRequest`
- `noBadOrTerribleMoodBannerOrRequest`
- `noDrawerSheetModalBanner`

Source: https://developers.google.com/admob/android/banner

## Owner evidence workflow

`ADMOB_OWNER_EVIDENCE_TEMPLATE.json` is a tracked shape only. Copy it to the
ignored private path, record public-safe facts, validate, dry-run promotion, then
write only after review. Free-text evidence alone is never enough for PASS, and
the public ledger never receives the private `facts` object.

```bash
npm run google-play:admob:owner-runbook:check
npm run google-play:admob:owner-evidence:prepare
node scripts/check-admob-owner-evidence.cjs --file output/private/admob-owner-evidence.json
npm run google-play:admob:owner-evidence:apply -- --file output/private/admob-owner-evidence.json
npm run google-play:admob:owner-evidence:apply -- --file output/private/admob-owner-evidence.json --write
npm run google-play:admob:owner-next-steps
npm run google-play:admob:external-check:pass
```

Keep `output/private/admob-owner-evidence.json` and
`output/private/admob-owner-next-steps.md` untracked. Public files may contain
only PASS, PARTIAL, UNVERIFIED, or FAIL summaries and official source URLs.

## Platform matrix

| Platform | Ad impact |
| --- | --- |
| Web/Vite | No ad SDK/request; graceful ad-free behavior. |
| Installed PWA | No ad SDK/request; graceful ad-free behavior. |
| Android/Capacitor | Current Habits banner-only scope. |
| iOS/WKWebView | Ads disabled; future banner work requires its own gate. |
| Desktop/Tauri | No ad SDK/request; graceful ad-free behavior. |

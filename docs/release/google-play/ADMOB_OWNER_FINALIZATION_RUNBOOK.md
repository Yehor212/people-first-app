# AdMob Owner Finalization Runbook

This runbook is the public-safe handoff for the owner-only steps that cannot be
proved from repository files alone. It is intentionally separate from
`ADMOB_EXTERNAL_READINESS.json`: the JSON file records current evidence; this
file explains how to move each non-PASS item to PASS without leaking account,
payment, personal, or raw ad identifiers.

## External Finalization Status

Current state on 2026-07-04:

| Item | Current status | Why it is not fully closed |
| --- | --- | --- |
| `public_app_ads_root` | PASS | Public root `app-ads.txt` was verified, but it must be rechecked after domain or publisher changes. |
| `admob_app_ads_txt_status` | PASS | AdMob Verify app showed the ZenFlow Android app confirmed with a Done status; recheck after crawler, developer website, or publisher changes. |
| `public_google_play_listing` | PASS | Public Play listing shows ads disclosure and optional rewarded-ad copy; recheck after listing edits. |
| `public_privacy_policy` | PASS | GitHub Pages post-deploy public privacy smoke and `npm run google-play:privacy:public-check` passed for the published privacy URL; recheck after privacy policy, ads SDK, consent, developer website, or Play Data safety changes. |
| `admob_app_readiness` | PASS | AdMob app list showed Ready and ad serving enabled; recheck before each release. |
| `admob_policy_center` | PASS | Policy Center showed no violations; recheck before each release. |
| `privacy_messages_cmp` | PARTIAL | Local UMP wiring passes, but AdMob Privacy & messages still needs owner confirmation/publishing. |
| `payments_tax_info` | UNVERIFIED | Tax information status must be checked by the owner without recording tax details. |
| `payments_identity_address` | UNVERIFIED | Identity/address verification status must be checked by the owner without recording personal data. |
| `payments_payment_method` | UNVERIFIED | Payout method eligibility must be checked by the owner without recording bank/payment data. |
| `payments_holds` | UNVERIFIED | Payment, compliance, identity, tax, and self-hold status must be checked by the owner. |
| `play_console_ads_data_safety` | PARTIAL | Public listing and repo packet are aligned, but private Play Console Ads, Advertising ID, and Data safety answers need owner proof. |
| `live_ad_playback_device` | UNVERIFIED | A release-equivalent Android device has not yet proved live rewarded-ad playback. |
| `full_cross_platform_ad_units` | UNVERIFIED | iOS and banner monetization are outside the current Android rewarded-only path. |

Do not claim current Android rewarded-only ad monetization PASS until these
commands and the current-release ledger rows agree:

```bash
npm run google-play:admob:owner-runbook:check
npm run google-play:admob:owner-evidence:check
npm run google-play:admob:owner-evidence:prepare
npm run google-play:admob:owner-evidence:apply -- --file output/private/admob-owner-evidence.json
npm run google-play:privacy:artifact-check
# After GitHub Pages deploy, the post-deploy public privacy smoke must pass.
npm run google-play:privacy:public-check
npm run google-play:admob:external-check
npm run google-play:admob:external-check:pass
```

`google-play:admob:external-check:pass` is the current Android rewarded-only
gate. It must keep failing while any current-release item in
`ADMOB_EXTERNAL_READINESS.json` remains `PARTIAL` or `UNVERIFIED`.
`full_cross_platform_ad_units` is intentionally excluded from that gate because
banner/iOS expansion is not part of the approved current release path.

## Public-safe evidence rules

Allowed evidence:

- Status words from Google UI, such as Ready, No violations, published, or no
  payment hold.
- Masked publisher/app/ad-unit fragments only when a script already masks them.
- Screenshot references or local file paths that do not reveal personal,
  payment, account, tax, address, email, or raw ad identifiers.
- Date, command, page name, and non-sensitive outcome.

Forbidden evidence:

- Raw AdMob app IDs, ad-unit IDs, publisher IDs, payment profile IDs, tax IDs,
  personal addresses, emails, identity documents, bank details, or screenshots
  containing those values.
- Statements such as production ready, monetization complete, or payout ready
  unless every required ledger row is PASS with fresh evidence.
- Any user-facing ad copy that creates pressure. No scarcity or guilt copy is
  allowed for rewarded ads.

## Privacy & messages / CMP

Goal: publish a Google-certified CMP message for ZenFlow through AdMob Privacy
& messaging. Google requires a certified CMP integrated with the IAB Transparency and Consent Framework for personalized ads in the EEA, UK, and
Switzerland; AdMob's Google CMP supports TCF v2.3 through its European
regulations messages. The app-side UMP SDK is already wired locally, but UMP can
only display the privacy message that exists for the AdMob application ID.

Owner action in AdMob:

1. Open AdMob -> Privacy & messaging.
2. On the European regulations card, use Create if no message exists, or Manage
   then Create message if messages already exist.
3. Select the ZenFlow AdMob app.
4. Set targeting to Countries subject to GDPR (EEA, UK, and Switzerland). Use
   Everywhere only if there is a separate owner decision to show the European
   regulations message globally.
5. Add the languages ZenFlow supports where practical: English, Ukrainian, Spanish, German, French, Japanese, Arabic, and Hebrew. English should remain
   the safe default language when the device language cannot be matched.
6. Confirm the privacy policy URL matches the public Play listing and developer
   website.
7. Choose user choices intentionally. For ZenFlow, the conservative default is
   to turn Do not consent ON for a first-page decline path where available and
   to allow Close (do not consent) only when the owner accepts that close means
   decline. Do not hide decline behind dark-pattern wording.
8. Keep ad partners limited to what ZenFlow actually needs for the current
   optional rewarded-ad path; review partner updates when AdMob prompts that new
   certified partners are available.
9. Publish the message.
10. Reopen Privacy & messaging and record only a public-safe summary in
   `ADMOB_EXTERNAL_READINESS.json`.

Post-publish local/runtime expectations:

Privacy controls are consent, disclosure, and withdrawal only. They may expose
ZenFlow ad consent and Google privacy-options controls, but they must not become
a reward-earning surface or contain rewarded playback calls to action.

- `npm run google-play:admob:ump-check` must pass.
- UMP consent information is refreshed at app launch.
- Ads stay disabled until `canRequestAds` is true.
- Settings keeps the Google ad privacy-options entry point visible when UMP says
  a privacy-options entry point is required.
- Revoke ZenFlow ad consent and confirm no new preload or rewarded ad request is
  made after revocation before claiming live-device PASS.

Repo proof already required:

```bash
npm run google-play:admob:ump-check
```

Why this is required: Google states that UMP uses user messages created in
AdMob Privacy & messaging, consent information should be refreshed at app
launch, privacy-options entry points may be required, and ads should only be
requested after `canRequestAds` allows it.

Sources:

- https://support.google.com/admob/answer/10113207
- https://support.google.com/admob/answer/13554116
- https://support.google.com/admob/answer/16918505
- https://support.google.com/admob/answer/9999955
- https://developers.google.com/admob/android/privacy
- https://developers.google.com/admob/ios/privacy

## Payments, identity, tax, and holds

Owner action in AdMob:

1. Open AdMob -> Payments.
2. Check Payments -> Verification for identity status.
3. Check Payments settings -> United States tax info or the relevant tax info
   area for the account.
4. Check whether any payment hold banner or alert is present.
5. Update the separate `payments_tax_info`, `payments_identity_address`,
   `payments_payment_method`, and `payments_holds` rows in
   `ADMOB_EXTERNAL_READINESS.json` with only one of these public-safe summaries:
   - PASS: no action required for identity, tax, or payment holds.
   - PARTIAL: one status is in review or a non-blocking setup step remains.
   - UNVERIFIED: the owner has not checked the page or status was not readable.
   - FAIL: Google shows a blocking action required.

Do not paste tax forms, names, addresses, bank details, payment profile IDs, or
document-review screenshots into the repository.

Sources:

- https://support.google.com/admob/answer/2772513
- https://support.google.com/admob/answer/12835021
- https://support.google.com/admob/answer/13030080
- https://support.google.com/admob/answer/11601831

## Play Console Ads, Advertising ID, and Data safety

Owner action in Play Console:

1. Open App content for ZenFlow.
2. Confirm Ads is set to Yes for this release path.
3. Confirm Advertising ID is set to Yes when the release artifact includes the
   Google Mobile Ads SDK and Android advertising ID permission.
4. Confirm Data safety includes the Google Mobile Ads data categories and the
   privacy policy URL matches the public listing.
5. Record only a public-safe PASS, PARTIAL, UNVERIFIED, or FAIL summary in the
   `play_console_ads_data_safety` row.

Public listing proof is not enough for this row. It proves users can see the
Contains ads signal, but it does not prove the private Data safety form or
Advertising ID declaration is complete.

## Owner evidence intake

Use `ADMOB_OWNER_EVIDENCE_TEMPLATE.json` only as a tracked shape reference:

```bash
npm run google-play:admob:owner-evidence:check
```

After checking owner-only AdMob, Payments, and Play Console pages, prepare the
private working file, fill only public-safe status summaries, and run:

```bash
npm run google-play:admob:owner-evidence:prepare
node scripts/check-admob-owner-evidence.cjs --file output/private/admob-owner-evidence.json
npm run google-play:admob:owner-evidence:apply -- --file output/private/admob-owner-evidence.json
npm run google-play:admob:owner-evidence:apply -- --file output/private/admob-owner-evidence.json --write
```

Keep `output/private/admob-owner-evidence.json` untracked. It is an owner-only
working file and must not contain screenshots, raw IDs, payment data, tax data,
addresses, names, or email addresses. The apply command runs in dry-run mode by
default; use `--write` only after reviewing that it changes only owner-owned rows
and preserves public rows such as `public_app_ads_root` and
`public_google_play_listing`.

## Owner PASS evidence fact requirements

`PASS` evidence must be public-safe and concrete. Generic text such as
"non-blocking status" is rejected by `check-admob-owner-evidence.cjs` because it
does not prove the specific Google surface was checked.

Each owner evidence row also has a `facts` object. For `PASS`, every required
fact for that row must be `true`; free-text evidence alone is never enough.
Facts are public-safe boolean checklist values, not places for screenshots,
names, payment details, tax details, account IDs, or raw ad IDs. The apply
workflow uses them as a private validation gate. It does not copy `facts` into the public `ADMOB_EXTERNAL_READINESS.json` ledger.

Minimum public-safe facts by row:

- admob_app_ads_txt_status: Verify app, confirmed or Done, and ZenFlow.
- admob_app_readiness: Ready, ad serving enabled, Google Play linked, and active ad units.
- admob_policy_center: Policy Center and no violations or no blocking issues.
- privacy_messages_cmp: published European regulations message, Google-certified CMP, TCF v2.3, and ZenFlow app selection.
- payments_tax_info: tax and no action required.
- payments_identity_address: identity, address, and no action required or verified.
- payments_payment_method: payment method and eligible or no action required.
- payments_holds: no payment hold, no tax hold, no identity hold, no compliance hold, and no self-hold.
- play_console_ads_data_safety: Ads=Yes, Advertising ID=Yes, Data safety includes Google Mobile Ads SDK data, and privacy policy URL matches listing.
- live_ad_playback_device: release-equivalent Android, consent path, rewarded video open, reward callback, revocation stop check, and no prompts or ad requests in sacred zones.
- full_cross_platform_ad_units: Android, iOS, banner, rewarded, owner-controlled non-sample IDs, and same publisher family.

Minimum structured facts by high-risk row:

- payments_holds: `noPaymentHold`, `noTaxHold`, `noIdentityHold`, `noComplianceHold`, `noSelfHold`.
- play_console_ads_data_safety: `adsDeclaredYes`, `advertisingIdDeclaredYes`, `dataSafetyIncludesGoogleMobileAdsSdkData`, `googleMobileAdsSdkDataDisclosureReviewed`, `privacyPolicyUrlMatchesListing`.
- live_ad_playback_device: `releaseEquivalentAndroid`, `consentPathCompleted`, `rewardedVideoOpened`, `dismissWithoutRewardChecked`, `rewardCallbackGrantedAfterCompletion`, `revocationStopsNewAdRequests`, `noMoodCheckInPromptOrRequest`, `noActiveFocusPromptOrRequest`, `noFocusReflectionPromptOrRequest`, `noJournalEditorPromptOrRequest`, `noBadOrTerribleMoodPromptOrRequest`.
- full_cross_platform_ad_units: `androidOwnerControlledNonSample`, `iosOwnerControlledNonSample`, `bannerOwnerControlledNonSample`, `rewardedOwnerControlledNonSample`, `samePublisherFamily`.

Do not add names, emails, tax forms, bank details, addresses, screenshots, raw
IDs, or payment profile IDs to satisfy these facts.

## Release-equivalent live rewarded-ad smoke

Run only after all of these prerequisites are PASS in owner evidence:

- `admob_app_ads_txt_status`
- `admob_app_readiness`
- `admob_policy_center`
- `privacy_messages_cmp`
- `play_console_ads_data_safety`

The owner evidence checker refuses `live_ad_playback_device: PASS` while any of
those prerequisite rows is not PASS. This keeps live ad requests behind app-ads,
readiness, policy, consent/CMP, and Play declaration proof.

Required device conditions:

- Android release-equivalent build, not a dev-only web/PWA run.
- Owner-controlled Android rewarded ad unit configured through environment or
  release secrets.
- ZenFlow ad consent enabled inside Settings.
- Google UMP form path exercised where applicable.
- Network available; no test-only device override when claiming live ads.

Smoke steps:

1. Install the release-equivalent Android build.
2. Open Settings -> Privacy.
3. Enable ZenFlow ad consent if the local consent toggle is off.
4. Complete the Google consent form if it appears.
5. Leave Privacy and confirm it contains only consent, disclosure, withdrawal,
   and Google privacy-options controls.
6. Open a separate Optional Rewards surface that has explicit product and
   psychological-safety approval.
7. Confirm the rewarded prompt appears only on that separate surface and never in
   mood logging, active focus, focus reflection, journal editor, onboarding, or
   bad/terrible mood states.
8. Tap the optional rewarded-ad action.
9. Confirm the video opens, can be dismissed without reward, and grants reward
   only after the rewarded completion callback.
10. Revoke ZenFlow ad consent and confirm the prompt disappears and no preload or
    new ad request happens after revocation.
11. Record public-safe result only: PASS, PARTIAL, UNVERIFIED, or FAIL.

Never use live ad playback proof to weaken the sacred-zone policy. Ads remain
blocked in mood check-ins, active focus, journaling, meditation, onboarding,
and bad or terrible mood states.

## Full cross-platform ad-unit expansion

Current release scope is Android rewarded-only. Full cross-platform monetization
requires separate owner action before any PASS claim:

```bash
npm run google-play:admob:check:full
npm run google-play:admob:external-check:full-pass
```

That strict check must remain non-PASS until every required banner and iOS ad
unit is owner-controlled, non-sample, and matched to the same publisher family
as the public `app-ads.txt` line. It is a future expansion gate, not a blocker
for the current Android rewarded-only gate.

Do not enable banners, interstitials, rewarded interstitials, or app-open ads in
ZenFlow without a separate product and psychological-safety review. The current
approved format is optional rewarded ads only.

## Psychological safety approval

ZenFlow is a wellness app. Rewarded ads must preserve user autonomy.

Approved current playback surface:

- No production rewarded playback surface is approved inside Settings / Privacy.
- Privacy controls are consent, disclosure, and withdrawal only.
- Rewarded playback requires a separate Optional Rewards surface with explicit
  product approval and psychological-safety review before it can be used for
  live-device PASS evidence.

Required constraints:

- No auto-play.
- No banners, pop-ups, interstitials, or app-open ads.
- No ad prompt or ad request in mood check-ins, active focus, reflection
  decisions, journal editor, meditation, onboarding, or bad/terrible mood
  states.
- No scarcity or guilt copy.
- No copy that implies failed care, relationship loss, low resources, urgency,
  or user obligation.
- Companion/tree surfaces must use a neutral optional rewards area and require
  a new test plus subagent psychological review before shipping.

Local proof:

```bash
npx vitest run --configLoader runner src/lib/__tests__/adJourneyContract.test.ts src/components/ads/__tests__/RewardedAdPrompt.uxContract.test.tsx
```

Sources:

- https://support.google.com/admob/answer/7313578
- https://admob.google.com/home/resources/best-practices-for-in-app-rewarded-video-ads/

## Official source map

- App readiness: https://support.google.com/admob/answer/10564477
- Policy Center: https://support.google.com/admob/answer/10448801
- App-ads.txt verification: https://support.google.com/admob/answer/14538460
- European regulations message for apps: https://support.google.com/admob/answer/10113207
- Google-certified CMP requirement: https://support.google.com/admob/answer/13554116
- Google CMP behavior: https://support.google.com/admob/answer/16918505
- TCF v2.3 troubleshooting: https://support.google.com/admob/answer/9999955
- Android UMP: https://developers.google.com/admob/android/privacy
- iOS UMP: https://developers.google.com/admob/ios/privacy
- Google Mobile Ads Play data disclosure: https://developers.google.com/admob/android/privacy/play-data-disclosure
- US tax info: https://support.google.com/admob/answer/2772513
- Payment setup: https://support.google.com/admob/answer/12835021
- Identity verification: https://support.google.com/admob/answer/13030080
- Payment holds: https://support.google.com/admob/answer/11601831

## Finalization checklist

Before changing any `PARTIAL` or `UNVERIFIED` row to PASS in
`ADMOB_EXTERNAL_READINESS.json`:

- Run `npm run google-play:admob:owner-runbook:check`.
- Run `npm run google-play:admob:owner-evidence:check`, then the same checker
  with `--file output/private/admob-owner-evidence.json` after owner console
  checks are recorded.
- Dry-run `npm run google-play:admob:owner-evidence:apply -- --file output/private/admob-owner-evidence.json`, review the public-safe row changes, then rerun it with `--write` only if the output is correct.
- Recheck public `app-ads.txt` and Play listing when the developer website or
  listing changes.
- Recheck AdMob app readiness and Policy Center in the owner account.
- Confirm CMP publication, payments/tax/holds, and live rewarded-ad smoke with
  public-safe evidence only.
- Run `npm run google-play:admob:external-check:pass` and keep the result as the
  final current Android rewarded-only monetization gate.
- Run `npm run google-play:admob:external-check:full-pass` only for a separate
  future cross-platform/banner expansion after product and psychological-safety
  approval.

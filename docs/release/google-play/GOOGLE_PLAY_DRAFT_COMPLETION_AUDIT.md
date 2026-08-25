# Google Play V2 Draft Completion Audit

Date: 2026-05-27 local workspace time.
Monetization follow-up: 2026-06-30 workspace review time.

Scope: Google Play Console draft metadata for ZenFlow V2, store logo/listing
assets, and the ads/Advertising ID path. This audit is intentionally draft
only. It does not authorize final review submission.

## Official Source Baseline

- Google Play preview assets:
  https://support.google.com/googleplay/android-developer/answer/9866151
- Google Play Asset Library:
  https://support.google.com/googleplay/android-developer/answer/16386748
- Google Play Ads declaration:
  https://support.google.com/googleplay/android-developer/answer/9859455
- Google Play Advertising ID declaration:
  https://support.google.com/googleplay/android-developer/answer/6048248
- Google Mobile Ads SDK Play data disclosure:
  https://developers.google.com/admob/android/privacy/play-data-disclosure
- AdMob app-ads.txt:
  https://support.google.com/admob/answer/9363762

## Logo / Store Asset Correction

The earlier console conclusion was too broad. A fresh visual check showed that
the Play Console default store listing still had the older feature graphic
composition in the feature graphic slot. The app icon was a ZenFlow leaf, but it
was replaced as well to keep the default listing aligned to the current Google
Play release packet.

Current canonical files:

| Slot | File | Local proof |
| --- | --- | --- |
| App icon | `docs/release/google-play/assets/google-play-app-icon-512.png` | `512x512`, PNG, alpha present, fully opaque alpha, `131122` bytes, SHA-256 prefix `E2333A435B2CCCE8` |
| Feature source | `docs/release/google-play/source/community-aura-feature-source.png` | Replaceable user-approved source; scripts validate presence and minimum Play Console dimensions, not a fixed content hash. |
| Feature graphic | `docs/release/google-play/assets/google-play-feature-graphic-1024x500.png` | `1024x500`, PNG, no alpha, validated by `npm run google-play:assets:check`. |

Console action taken:

- Uploaded `google-play-app-icon-512.png` through the Play Console Asset Library.
- Removed the previous app icon asset from the active upload box, leaving one
  app icon in the slot.
- Rebuilt `google-play-feature-graphic-1024x500.png` from the user-approved
  generated image only. The exact hash pin was removed so this visual can be
  replaced deliberately without fighting the generator; the scripts still
  validate source presence, dimensions, and final Play Console image size.
  The only added overlay is the approved SMM copy: `A calmer daily rhythm`,
  `Mood • Habits • Journal`, and `Start with one check-in`. No other copy,
  claims, fake device hardware, or alternate logo treatment is added by the repo
  generator.
- Uploaded `google-play-feature-graphic-1024x500.png` through the Play Console
  Asset Library.
- Removed the previous feature graphic asset from the active upload box, leaving
  one feature graphic in the slot.
- Saved the default store listing draft.
- Dismissed the post-save review prompt with "Not now"; final review submission
  was not clicked.

Runtime proof screenshots captured locally:

- `tmp/play-console-after-delete-old-icon.png`
- `tmp/play-console-after-delete-old-feature.png`
- `tmp/play-console-after-save-assets.png`
- `tmp/play-console-final-app-icon-proof.png`
- `tmp/play-console-final-logo-feature-proof.png`
- `tmp/play-console-final-feature-keyvisual-proof.png`
- `tmp/play-console-final-canonical-feature-proof-2026-05-27.png` - 2026-05-27 fresh
  self-check of the active default store listing slot after rebuilding the
  feature graphic with the canonical leaf mark and real V2 mood-orb crop.
- `tmp/play-console-listing-copy-proof.png` - current default listing short and
  full description proof.
- `tmp/play-console-approved-feature-proof.png` - current default listing
  feature graphic proof showing the approved 1024x500 asset as `1 of 1`.

## Console State Verified

| Requirement | Status | Evidence |
| --- | --- | --- |
| Do not submit final review | PASS | After saving, Play Console showed the saved-change prompt to go to review; it was dismissed with "Not now". Final review/submit was not clicked. |
| Default store listing short description matches V2 ads draft | PASS | Re-opened `main-store-listing`; field value was `Turn feelings into rhythm with mood, habits, and a private journal.` |
| Default store listing full description historical state | SUPERSEDED / CURRENT UNVERIFIED | The 2026-05-27 text referenced rewarded ads and is not valid for the current banner-only release. Re-verify that the live listing describes only the Habits banner before claiming PASS. |
| Store listing app icon uses current ZenFlow leaf packet | PASS | Saved Play Console slot shows the single current high-quality ZenFlow leaf app icon after upload/removal flow. |
| Store listing feature graphic uses the current approved source | PASS | Saved Play Console slot shows the single current `google-play-feature-graphic-1024x500.png` visual as `1 of 1`, with no extra image count error. Fresh screenshot proof: `tmp/play-console-approved-feature-proof.png`. |
| Ads declaration is aligned with V2 AdMob draft | PASS | Play Console Ads section was previously set to Ads = Yes for the V2 draft path. |
| Advertising ID declaration is aligned with Android artifact | PASS | Play Console Advertising ID section was previously set to Yes for analytics and ads/marketing. |
| Data Safety has a draft change ready for review | PASS | Publishing overview previously listed Data Safety among unsubmitted draft changes. |

## Repo / Artifact State Verified

The rows below are historical baseline evidence from 2026-05-27 and must not be reused as fresh PASS evidence for the 2026-06-30 audio release without rerunning the named gates.

| Requirement | Status | Evidence |
| --- | --- | --- |
| Google Play asset packet validates | HISTORICAL PASS / FRESH AUDIO RELEASE UNVERIFIED | 2026-05-27 `npm run google-play:assets` regenerated the packet from the validated feature source, then `npm run google-play:assets:check` verified 5 Play Console assets and 8 localized listings. |
| Brand logo pack validates | HISTORICAL PASS / FRESH AUDIO RELEASE UNVERIFIED | 2026-05-27 `npm run assets:logos:check` verified 117 images, 6 SVG sources, native splash, ICO/ICNS, Android XML, Store upload pack, and package scripts. |
| Visual/canonical orb guards still pass | HISTORICAL PASS / FRESH AUDIO RELEASE UNVERIFIED | 2026-05-27 `npm run check:visual` verified canonical orbs, logo assets, visual guards, and V2 paper guard. |
| Task completion protocol still passes | HISTORICAL PASS / FRESH AUDIO RELEASE UNVERIFIED | 2026-05-27 `npm run check:task-completion` verified 72 invariants. |
| Security scan for changed first-party asset scripts | HISTORICAL PASS / FRESH AUDIO RELEASE UNVERIFIED | 2026-05-27 `snyk code test --file=scripts/generate-google-play-assets.cjs` reported 0 issues. |


## 2026-06-30 Audio Release Evidence

Fresh local evidence for the audio-layer release path is tracked separately from the 2026-05-27 Play Console draft baseline.

| Requirement | Status | Evidence |
| --- | --- | --- |
| App audio package guard | PASS | 2026-06-30 `npm run check:app-audio` checked current app audio assets, root MP3 inventories, Desktop/Tauri generated target files, docs/assets bundles, and output artifacts. |
| i18n coverage for new sound settings | PASS | 2026-06-30 `npm run i18n:check` validated all 8 supported languages with 3232 keys each and V2 copy guard passed. |
| No AI-template copy guard | PASS | 2026-06-30 `npm run check:no-ai-templates` passed for the current audio/copy changes. |
| Best-practices implied requirements guard | PASS | 2026-06-30 `npm run check:best-practices` passed for the current policy/check wiring. |
| Public Play Console/store state for this audio release | UNVERIFIED | No fresh Play Console browser verification or public Google Play listing verification was performed for the 2026-06-30 audio-only release loop. |

## Honest Not-Ready Items

These are not blockers for the Play Console draft logo correction, but they are
production monetization blockers.

| Item | Status | Required next action |
| --- | --- | --- |
| Real AdMob Android app ID | LOCAL READY / RELEASE ENV GUARDED | Local env contains a real Android AdMob app ID for publisher `pub-9501********2808`; keep the value owner-controlled and verify release/CI env with `npm run google-play:admob:check`. Android release Gradle builds now fail fast if the native app ID is missing or still points at a Google sample app ID. |
| Retired rewarded ad unit path | SUPERSEDED / MUST NOT CONFIGURE | Rewarded ads are outside the current product and release contract. Do not configure rewarded IDs; the release AAB gate rejects every ad-unit ID except the Habits banner. |
| `public/app-ads.txt` | PUBLIC ROOT READY / ADMOB CRAWL PENDING | `npm run google-play:app-ads:public-check:zenflow` passes for publisher `pub-9501********2808`. If the publisher changes, regenerate only with `ZENFLOW_ADMOB_PUBLISHER_ID=pub-0000000000000000 npm run google-play:app-ads`, verify with `npm run google-play:app-ads:check`, and Do not invent this value or use Google's sample publisher id. In AdMob, click `Verify app` / refresh verification after Google crawls the root of the developer website configured in Play Console/AdMob. |
| Public Play developer website | PASS / PUBLIC LISTING UPDATED | 2026-06-30 public listing probe for `com.zenflow.app` returned `https://yehor212.github.io/people-first-app/` as the developer website after Play Console Store listing contact details were updated. This fixes the previous `appstore:developer_url=about:invalid#navigation` blocker. |
| Public Play ads label and copy | UNVERIFIED / BANNER COPY REQUIRED | Re-run `npm run google-play:public-listing:check` after deployment and confirm the public listing shows Contains ads and describes only the Habits banner, with no rewarded or no-ads claim. |
| Final Google Play review submission | PUBLISHED / ADMOB VERIFY PENDING | 2026-06-30 Play Console Publishing overview shows the update was published after the 6-change package: short description, full description, app icon, feature graphic, Ads declaration, Data safety, and Advertising ID declaration. Do not claim AdMob verification PASS until AdMob removes the app-ads.txt mismatch warning after its crawler refreshes. |
| External monetization readiness ledger | UNVERIFIED / OWNER ACTION NEEDED | `npm run google-play:privacy:artifact-check`, the GitHub Pages post-deploy public privacy smoke, `npm run google-play:privacy:public-check`, and `npm run google-play:admob:external-check:pass` must pass for the current Android Habits banner contract. |

## 2026-08-25 Banner-Only Reconciliation

Any historical rewarded statements above are explicitly superseded and carry no current PASS or operator action. The current Android contract
is one optional adaptive banner below a non-empty Habits list after consent and
the first three onboarding days. It excludes mood check-ins, focus sessions,
journaling, habit creation and editing, settings, overlays, and every non-Android
platform. Rewarded, interstitial, app-open, and native-feed formats are disabled.

Fresh local evidence for this reconciliation:

- `npm run google-play:admob:check` validates a real Android app ID and banner
  ad-unit ID from the same publisher without printing their values.
- `npm run google-play:admob:aab-check` expands the release AAB and rejects any
  Google sample ID or any ad-unit ID other than the configured Habits banner.
- `npm run google-play:admob:ump-check` validates consent and privacy-options
  wiring.
- `npm run google-play:assets:check` validates five Play assets and all eight
  localized banner-only listings.
- The release AAB is built with target SDK 36, version code 39, version 2.1.2,
  `AD_ID`, one real app ID, and one real banner ID. Its application bundle has no
  Google sample publisher ID and no ZenFlow rewarded runtime call site.
- `public/app-ads.txt` remains publisher-bound. Production builds fail closed
  when the configured app publisher does not match that file.

Live ad serving is `UNVERIFIED` until a real device request and AdMob reporting
are freshly observed. Public privacy-policy deployment is also `UNVERIFIED`
until the updated GitHub Pages artifact is deployed and the post-deploy check
passes.

## Completion Decision

The repository and fresh Android artifact are locally ready for the banner-only
contract with no mock, sample, demo, rewarded, or fallback ad data in production
runtime. Google Play continues to declare `Contains ads`. External publication
and live serving remain separate gates and cannot be called PASS from static or
local build evidence.

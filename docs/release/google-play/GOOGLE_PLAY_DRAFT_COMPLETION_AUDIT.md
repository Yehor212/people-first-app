# Google Play V2 Draft Completion Audit

Date: 2026-05-27 local workspace time.

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
| Feature source | `docs/release/google-play/source/community-aura-feature-source.png` | Source image is no longer exact-SHA locked; scripts validate presence and minimum Play Console dimensions. |
| Feature graphic | `docs/release/google-play/assets/google-play-feature-graphic-1024x500.png` | `1024x500`, PNG, no alpha, validated by `npm run google-play:assets:check`. |

Console action taken:

- Uploaded `google-play-app-icon-512.png` through the Play Console Asset Library.
- Removed the previous app icon asset from the active upload box, leaving one
  app icon in the slot.
- Rebuilt `google-play-feature-graphic-1024x500.png` from the user-approved
  generated image only. The exact SHA lock was removed so this visual can be
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
| Default store listing full description has no stale no-ads claim | PASS | Re-opened `main-store-listing`; field value ends with the current optional rewarded ads disclosure and contains no stale no-ads wording. |
| Store listing app icon uses current ZenFlow leaf packet | PASS | Saved Play Console slot shows the single current high-quality ZenFlow leaf app icon after upload/removal flow. |
| Store listing feature graphic uses the approved Community Aura source | PASS | Saved Play Console slot shows the single current `google-play-feature-graphic-1024x500.png` visual as `1 of 1`, with no extra image count error. Fresh screenshot proof: `tmp/play-console-approved-feature-proof.png`. |
| Ads declaration is aligned with V2 AdMob draft | PASS | Play Console Ads section was previously set to Ads = Yes for the V2 draft path. |
| Advertising ID declaration is aligned with Android artifact | PASS | Play Console Advertising ID section was previously set to Yes for analytics and ads/marketing. |
| Data Safety has a draft change ready for review | PASS | Publishing overview previously listed Data Safety among unsubmitted draft changes. |

## Repo / Artifact State Verified

| Requirement | Status | Evidence |
| --- | --- | --- |
| Google Play asset packet validates | PASS | 2026-05-27 `npm run google-play:assets` regenerated the packet from the validated feature source, then `npm run google-play:assets:check` verified 5 Play Console assets and 8 localized listings. |
| Brand logo pack validates | PASS | 2026-05-27 `npm run assets:logos:check` verified 117 images, 6 SVG sources, native splash, ICO/ICNS, Android XML, Store upload pack, and package scripts. |
| Visual/canonical orb guards still pass | PASS | 2026-05-27 `npm run check:visual` verified canonical orbs, logo assets, visual guards, and V2 paper guard. |
| Task completion protocol still passes | PASS | 2026-05-27 `npm run check:task-completion` verified 72 invariants. |
| Security scan for changed first-party asset scripts | PASS | 2026-05-27 `snyk code test --file=scripts/generate-google-play-assets.cjs` reported 0 issues. |

## Honest Not-Ready Items

These are not blockers for the Play Console draft logo correction, but they are
production monetization blockers.

| Item | Status | Required next action |
| --- | --- | --- |
| Real AdMob Android app ID | NOT READY | Create/use the real AdMob Android app ID and set `VITE_ADMOB_APP_ID_ANDROID` / `ZENFLOW_ADMOB_ANDROID_APP_ID`. |
| Real rewarded ad unit ID | NOT READY | Create/use the real rewarded ad unit and set `VITE_ADMOB_REWARDED_ID_ANDROID`. |
| `public/app-ads.txt` | NOT READY | Add the real AdMob publisher line only after the publisher ID is known. Do not invent this value. |
| Final Google Play review submission | OUT OF SCOPE | Submit only after the V2 Android artifact and real monetization IDs are ready. |

## Completion Decision

Google Play Console is now corrected for the V2 draft store listing surfaces:
the active default listing uses the current high-quality ZenFlow app icon, the
single approved Community Aura feature graphic, and the current SMM/ASO-safe
short/full English description. Final certification/review remains
intentionally unsubmitted.

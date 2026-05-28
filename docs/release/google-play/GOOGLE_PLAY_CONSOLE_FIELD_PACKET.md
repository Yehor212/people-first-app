# Google Play Console Field Packet

Use this packet when filling ZenFlow in Google Play Console. It reflects the
current repo state and generated release assets.

## Store Listing

Primary localized packet:

```text
docs/release/google-play/GOOGLE_PLAY_LOCALIZED_LISTING_PACKET.json
```

Fill all of these Google Play listing languages from that packet:

```text
en-US, uk-UA, es-ES, de-DE, fr-FR, ja-JP, ar-SA, he-IL
```

Do not copy non-English listing text from `docs/STORE_LISTING.md`; that older
marketing draft contains mojibake in several localized sections. The JSON packet
above is the clean UTF-8 source of truth for this release.

App name:

```text
ZenFlow
```

Short description:

```text
Turn feelings into rhythm with mood, habits, and a private journal.
```

Full description:

```text
ZenFlow helps you turn a noisy day into a calmer daily rhythm.

Start with a quick mood check-in, keep meaningful habits in sight, and write private journal notes without opening a crowded dashboard. The experience is designed to feel fast, focused, and gentle: one place to notice how you feel, remember what matters, and come back tomorrow with less friction.

Why people use ZenFlow:
- Check in with your mood in seconds
- Keep daily habits visible and easy to return to
- Write private reflections without social pressure
- Continue across supported web and app surfaces
- Use a calm interface built for daily repetition

ZenFlow may offer optional rewarded ads for small in-app bonuses after consent. Ads are not shown inside mood check-ins, active focus sessions, or journaling moments.
```

Product feature bullets:

```text
Fast mood check-ins for the moment you are in
Habit tracking that keeps routines visible
Private journaling without social pressure
Optional rewarded bonuses after consent
A calm daily interface built for return use
```

What's new:

```text
Initial Android release with ZenFlow V2: mood flow, habits, private journal, refreshed brand assets, and optional rewarded ads support.
```

## Graphics Upload Map

App icon:

```text
docs/release/google-play/assets/google-play-app-icon-512.png
```

Feature graphic:

```text
docs/release/google-play/assets/google-play-feature-graphic-1024x500.png
```

Use the generated Community Aura feature graphic as the main product key visual.
The editable source is
`docs/release/google-play/source/community-aura-feature-source.png`.
Do not pin this image to a content hash: the source is allowed to be
replaced deliberately when the user approves a better version, and the release
checks validate the dimensions and exported Play Console file instead.
The current source file contains the Community Aura image with the three
placeholder fields filled:

```text
A calmer daily rhythm
Mood • Habits • Journal
Start with one check-in
```

The release asset must be only a 1024x500 crop/resize of that approved source.
Do not add other copy, claims, ratings, fake device hardware, a hand-drawn logo
variant, or an unreviewed screenshot collage. Screenshots are uploaded
separately below.

Desktop screenshots:

```text
docs/release/google-play/screenshots/desktop/01-v2-orb-desktop.png
docs/release/google-play/screenshots/desktop/02-v2-habits-desktop.png
docs/release/google-play/screenshots/desktop/03-v2-diary-desktop.png
```

## App Content Declarations

Ads:

```text
Yes
```

Reason:

```text
The current Android release path installs the official Capacitor AdMob plugin and supports optional rewarded ads after user consent. ZenFlow must not show banners, pop-ups, or interstitial ads during mood check-ins, active focus sessions, or journaling.
```

Advertising ID:

```text
Yes
```

Reason:

```text
The ads-enabled Android release declares com.google.android.gms.permission.AD_ID for Google Mobile Ads / AdMob. Play Console Advertising ID must be Yes for this artifact.
```

Android manifest proof note:

```text
The merged release manifest also contains Android Privacy Sandbox ACCESS_ADSERVICES_* permissions contributed by the Google Mobile Ads dependency. Treat this as part of the ads-enabled release path and keep Data safety / Advertising ID answers aligned with Google Mobile Ads SDK behavior.
```

Privacy policy:

```text
https://yehor212.github.io/people-first-app/privacy.html
```

App access:

```text
All core app surfaces can be reviewed without a paid account. If login is requested during review, use the public app flow and create a test account with a reviewer-controlled email.
```

Target audience:

```text
Adults and general wellness users. Not directed to children.
```

Data safety note:

```text
Declare only the data types actually collected by the current Android artifact. Mood, habit, and journal content are user-entered wellness data and must not be described as advertising data. Advertising ID and Android ad services permissions are present for the installed Google Mobile Ads / AdMob release path and should be declared only for ads/analytics purposes tied to that SDK.
```

## Pre-Submit Checklist

- `npm run google-play:assets`
- `npm run google-play:assets:check`
- Confirm all 8 localized Store Listing drafts are saved from
  `GOOGLE_PLAY_LOCALIZED_LISTING_PACKET.json`.
- Capture Play Console screenshots for Store Listing, app icon, feature graphic,
  Ads = `Yes`, Advertising ID = `Yes`, and the draft dashboard state.
- Android release manifest/build proof that the merged manifest includes
  `com.google.android.gms.permission.AD_ID` and the AdMob app ID metadata.
- `npm run assets:logos:check`
- `npm run check:visual`
- `npm run typecheck`
- `npm run lint`
- Confirm the package uploaded to Play Console is generated from the same commit
  as this packet.

## Production AdMob Rule

Before publishing production monetization:

1. Create the real Android app and rewarded ad unit in AdMob.
2. Set `VITE_ADMOB_APP_ID_ANDROID` and `VITE_ADMOB_REWARDED_ID_ANDROID`.
3. Add `public/app-ads.txt` with the real publisher line.
4. Re-run the Android release manifest/build proof.
5. Re-check Play Console Ads, Advertising ID, and Data safety sections.

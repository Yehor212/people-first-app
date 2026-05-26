# Google Play Console Field Packet

Use this packet when filling ZenFlow in Google Play Console. It reflects the
current repo state and generated release assets.

## Store Listing

App name:

```text
ZenFlow
```

Short description:

```text
Track mood, habits, and journaling in one calm daily flow.
```

Full description:

```text
ZenFlow is a calm daily companion for mood tracking, habits, and journaling.

Start with a quick mood check-in, keep daily habits visible, and write private journal entries without turning your day into a dashboard. ZenFlow is built for repeated daily use: fast opening, clear navigation, gentle visuals, and local-first storage with account sync support.

What you can do:
- Capture your mood in seconds
- Build and review daily habits
- Keep a private journal
- Continue across supported web and app surfaces
- Use a focused interface designed for clarity, not noise

ZenFlow avoids aggressive engagement patterns. It is made to feel quiet, readable, and dependable every day.
```

Product feature bullets:

```text
Mood check-ins with a visual daily flow
Habit tracking for repeatable routines
Private journaling for reflection
Local-first experience with account sync support
Calm interface for daily use
```

What's new:

```text
Initial Android release with the V2 ZenFlow experience, mood flow, habits, journal, and refreshed brand assets.
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

Desktop screenshots:

```text
docs/release/google-play/screenshots/desktop/01-v2-orb-desktop.png
docs/release/google-play/screenshots/desktop/02-v2-habits-desktop.png
docs/release/google-play/screenshots/desktop/03-v2-diary-desktop.png
```

## App Content Declarations

Ads:

```text
No
```

Reason:

```text
The current Android artifact does not install or initialize an ad SDK, does not ship AdMob seller metadata, and does not publish app-ads.txt ad seller lines. Rewarded ads are documented as a future opt-in path and are disabled in this release.
```

Advertising ID:

```text
No
```

Reason:

```text
The current Android release manifest must not request com.google.android.gms.permission.AD_ID or Android ACCESS_ADSERVICES_* permissions.
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
Declare only the data types actually collected by the current Android artifact. Mood, habit, and journal content are user-entered wellness data and must not be described as advertising data. Do not declare Advertising ID unless the Android manifest and dependency tree include an advertising SDK release.
```

## Pre-Submit Checklist

- `npm run google-play:assets`
- `npm run google-play:assets:check`
- Android release manifest/build proof that the merged manifest has no
  `AD_ID`, `ACCESS_ADSERVICES_*`, AdMob app ID, or ad seller file.
- `npm run assets:logos:check`
- `npm run check:visual`
- `npm run typecheck`
- `npm run lint`
- Confirm the package uploaded to Play Console is generated from the same commit
  as this packet.

## Future Ads Release Rule

If ZenFlow later ships rewarded ads:

1. Add the official Capacitor AdMob dependency.
2. Restore the AdMob app ID and `AD_ID` permission intentionally.
3. Restore `public/app-ads.txt` with the approved seller line.
4. Add a fresh privacy/data safety review.
5. Change Play Console Ads and Advertising ID declarations to `Yes`.
6. Update this packet in the same commit.

# ZenFlow Monetization Plan

Status: current Android banner-only contract

## Product decision

ZenFlow may show one anchored adaptive AdMob banner at the bottom of the Habits
screen for eligible free Android users. The banner is secondary to habit work,
does not unlock rewards, and never blocks progress.

No other production ad format is approved: no rewarded, interstitial, app-open,
native, collapsible, or inline ads. Legacy AdMob units may remain in the owner
console, but production source and release bundles must not reference them.

## Eligibility

The request is allowed only when all conditions are true:

- production Android native runtime;
- owner-controlled non-sample Android app and banner IDs;
- non-premium account;
- explicit ZenFlow ad consent plus Google UMP `canRequestAds`;
- onboarding grace period of three active days has ended;
- Habits screen is active and the document is visible;
- mood is neither bad nor terrible;
- no modal, drawer, sheet, authentication, Settings/Privacy, journal, focus,
  onboarding, or other protected surface is open.

If any condition becomes false, the native banner is removed or hidden before
the protected surface is considered ready. Pending native shows are invalidated
and removed when they resolve.

## Placement and accessibility

- Use an anchored adaptive banner sized for the current Android viewport.
- Reserve the native-reported height so content and bottom navigation are not
  covered; preserve safe areas and at least 44px application touch targets.
- Recreate on width/orientation/split-screen changes.
- Remove on route exit, backgrounding, consent revocation, sign-out, and SDK
  failure. No-fill and offline states remain ad-free and fully usable.
- The app never fabricates an ad, impression, request, revenue, or readiness
  state when Google is unavailable.

## Privacy and store contract

- UMP consent information is refreshed at launch and privacy options remain
  reachable when required.
- Play Console must declare Contains ads and Advertising ID consistently with
  the exact artifact; Data safety and the public privacy policy must cover the
  Google Mobile Ads SDK data categories.
- Public listing and privacy copy explicitly describe the Habits banner and do
  not describe rewarded ads.
- `app-ads.txt`, AdMob app readiness, Policy Center, CMP publication, and owner
  account/payment readiness are separate gates.

## Evidence and kill criteria

Static code/build proof is not live serving proof. Release readiness requires a
Play-installed production artifact, banner render, AdMob request and impression,
rotation/background/protected-surface checks, and consent revocation. If the
banner overlaps content, survives a protected surface, harms task completion,
or cannot satisfy privacy/store declarations, disable ads and stop the release.

Platform impact: Web/Vite, installed PWA, iOS/WKWebView, and Desktop/Tauri stay
ad-free. Android/Capacitor is the only current monetized platform.

Official references:

- https://developers.google.com/admob/android/banner
- https://developers.google.com/admob/android/privacy
- https://developers.google.com/admob/android/privacy/play-data-disclosure

# ZenFlow Android Banner Journey

Status: current Android banner-only runtime contract

## State model

```text
DISABLED
  -> CONSENT_CHECK
  -> GRACE_PERIOD | ELIGIBLE
ELIGIBLE + HABITS_VISIBLE + NO_PROTECTED_SURFACE
  -> SHOW_PENDING
SHOW_PENDING + STILL_ELIGIBLE
  -> VISIBLE
SHOW_PENDING + GATE_CHANGED
  -> REMOVE_ON_RESOLVE -> HIDDEN
VISIBLE + OVERLAY/ROUTE/BACKGROUND/REVOCATION
  -> HIDDEN_OR_REMOVED
```

The placement generation and serialized native-command queue prevent an older
`showBanner()` completion from outliving a newer hide/remove intent.

## Runtime ownership

- `src/lib/adConfig.ts` accepts only real, owner-controlled banner IDs and
  rejects Google sample identifiers for production.
- `src/lib/adController.ts` owns initialization, UMP gating, adaptive banner
  show/hide/remove, lifecycle invalidation, and native height events.
- `src/contexts/AdContext.tsx` owns current eligibility: Habits route, viewport,
  document visibility, mood, premium state, consent, and global overlays.
- Native plugin teardown destroys and detaches the `AdView` before resolving.

## Protected transitions

Every modal, drawer, sheet, auth screen, Settings/Privacy screen, journal flow,
focus flow, onboarding step, and bad/terrible mood state is ad-free. A native
view can render above the WebView, so CSS z-index is not a safety boundary.
Opening a protected surface invalidates a pending show and removes the native
view after the pending call resolves.

## Failure behavior

- Missing consent/config/platform support: no request, zero reserved height.
- No-fill/load error: remove the native view, clear height, allow later retry.
- Offline/background/route exit/sign-out: remove; never synthesize success.
- Rotation/split-screen: remove and recreate for the new width.
- Duplicate show intents are serialized; stale intent never becomes visible.

## Verification matrix

| Claim | Required evidence |
| --- | --- |
| No production mock/sample ads | Source, generated bundle, dependency, APK/AAB, and manifest scans |
| Protected surfaces stay ad-free | Deferred-show regression plus installed Android checks |
| Correct layout | Native height, safe-area, bottom navigation, rotation and split-screen checks |
| Consent | UMP form/status, `canRequestAds`, privacy-options, revocation checks |
| Live serving | Exact Play artifact plus AdMob request and impression |
| Store compliance | Contains ads, Advertising ID, Data safety, privacy policy, app-ads.txt, Policy Center |

Web/Vite, installed PWA, iOS/WKWebView, and Desktop/Tauri have no ad SDK or ad
request in the current release and must degrade to a normal ad-free experience.

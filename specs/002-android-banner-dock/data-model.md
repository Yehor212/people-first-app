# Data Model

No new business records or migration are introduced.

## Runtime-only state

### `AdEntitlementState`

- `free`: authoritative source proves the current account may receive ads.
- `premium`: authoritative source proves ad-free access.
- `unknown`: default, loading, signed-out, source error, or account transition; always denies ads.

### `BannerPlacementState`

- `routeEligible`
- `hasVisibleHabitsToday`
- `appActive`
- `documentVisible`
- `keyboardClosed`
- `overlayClosed`
- `emotionSafeToday`
- `consentAllowed`
- `adultEligible`
- `umpAllowed`
- `graceComplete`
- `entitlementFree`
- `accountGeneration`

All must be true/current before a native show/reveal.

### `BannerDockGeometry`

- `widthDp`
- `heightDp`
- `viewportGeneration`
- `status`: `none | reserved | visible`

Geometry is ephemeral and cleared on deny/failure/removal. It is not persisted.

## Existing persistence

Consent and age eligibility remain in the existing settings model. Grace progression must use the repository storage helpers and be account-scoped. No raw `localStorage` access is permitted.

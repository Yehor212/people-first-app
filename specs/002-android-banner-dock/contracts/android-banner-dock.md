# Android Banner Dock Contract

## Inputs

`platform`, `route`, `todayVisibleHabitCount`, consent, age eligibility, UMP status, distinct active-day state, local-day moods, entitlement state, account generation, app/document lifecycle, IME state, overlay state, and current viewport geometry.

## Outputs

- `bannerHeightDp`: `0` when denied/failed/removed; exact adaptive height when reserved or visible.
- Native command: at most one current banner view, never stale across account/lifecycle/viewport generations.
- Visibility: native view becomes visible only after the matching height is reserved by the web layer.

## Invariants

1. Every unknown security/privacy/account input denies.
2. Every deny transition invalidates pending show work before scheduling cleanup.
3. Test identifiers and SDK testing mode are unreachable from publishable builds.
4. Non-Android runtimes never initialize the plugin or reserve the dock.
5. No-fill/failure/timeout clears geometry and produces no automatic retry storm.
6. A banner never overlaps the IME, modal, sheet, drawer, bottom navigation, or system navigation.
7. Native height is measured, not guessed.

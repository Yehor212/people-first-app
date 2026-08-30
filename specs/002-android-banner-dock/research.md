# Research Decisions

## Anchored adaptive banner

Google's Android banner guidance uses current-orientation anchored adaptive size. The installed plugin already calls `getCurrentOrientationAnchoredAdaptiveBannerAdSize`; native `BannerAdSizeInfo` reports width and height in density-independent units. Decision: reserve the native-reported height before visibility, not a guessed 50/90px constant.

## Safe emulator evidence

Google requires test ads during development. Decision: the emulator build uses the official sample app/banner identifiers only behind an explicit QA build flag. Default development remains ad-request-disabled. Publishable builds reject sample identifiers and testing flags. Emulator evidence proves test-ad layout and lifecycle only.

## Entitlement

The repository has no authoritative billing/entitlement source. Supabase `user_metadata` is user-editable and cannot authorize ad suppression. Decision: fail closed for `unknown` and `premium`. A `free` result may be supplied only by an authoritative account-scoped source; until that source exists, production ads remain disabled. The QA harness may inject a test-only eligibility state isolated from production.

## Emotional protection

Decision: any `bad` or `terrible` mood recorded on the current local date suppresses the banner for that date. Selecting only the latest all-time mood is rejected because it can let one same-day protected entry disappear or let stale/future entries control today.

## Grace semantics

The approved contract says three active days. Elapsed wall-clock days are not equivalent. Decision: keep banner fail-closed until account-scoped distinct active local days prove day four or later. Do not silently redefine the product contract.

## Native timeout

Decision: native calls must be time-bounded and epoch-checked; timeout suppresses ads for the current attempt, clears reserved geometry, logs a privacy-safe diagnostic, and does not auto-loop. A later lifecycle or user action may retry.

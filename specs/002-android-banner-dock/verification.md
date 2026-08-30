# Verification Ledger — 2026-08-30

## Installed artifact

- QA APK: `output/banner-qa/apk/zenflow-admob-qa-debug-v10.apk`
- SHA-256: `bbfcc766f1fd6815a869ef61577cde0081a2f992927b7c8407ad505a0a0f73cf`
- Installed `base.apk`: exact SHA-256 match on `emulator-5554`, API 36,
  after a cold reboot of `codex_banner_api36_20260830` without snapshot state.
- Package: `com.zenflow.app`; version code 39; target SDK 36.
- Test-data boundary: Google's official sample app/banner identifiers were
  used only in the explicit `admob-qa` build. The retained `Drink water` habit
  was created through the app UI; no production business record was injected.
- Auth boundary: after an Android configuration restart showed the real sign-in
  screen, CDP navigated the debug WebView to the repository's existing local
  `?dev=true` gate. This proves the local QA surface only and is not evidence for
  authentication, account, production, or public behavior. No credentials or
  tokens were requested, read, stored, or printed.

## PASS

- Test-first protected-surface race: RED reproduced a second banner recovery
  during native suppression; GREEN prevents recovery until the durable overlay
  gate is active.
- Test-first short-landscape regression: the v8 capture demonstrated that the
  fixed Habits viewport could strand content behind the native banner. RED
  required a vertically scrollable reserved viewport; GREEN uses
  `overflow-y-auto`/`overscroll-y-contain`, and the exact-v9 end-of-scroll frame
  shows Statistics and Create habit fully above the banner.
- `check:all`, all eight locale checks, translation quality, canonical visuals,
  Android lint/unit tests, best-practices, no-AI-template, production-data-
  integrity source/diff/bundle, `npm audit`, and high-severity Snyk Code scan.
- The ordinary Android production build, copied native assets, and debug APK
  contain no official sample banner unit ID.
- Exact-v10 settled emulator states: clean cold start, portrait banner, portrait
  protected create sheet, post-sheet banner recovery, rotation, full-width
  landscape banner (`862 × 62 dp` native size event), landscape end-of-scroll
  reachability, and landscape protected create sheet. The exact-v9 1.3× system
  font, Arabic RTL, and background/foreground captures remain historical
  coverage, not a substitute for a fresh v10 replay of those states.
- Native load order reached `bannerAdSizeChanged -> bannerAdLoaded ->
  resumeBanner`. Protected-sheet opening emitted hide/remove without an
  intervening `resumeBanner`; the exact-v9 Android Back check returned to
  Habits and reloaded the eligible banner.
- The clean-boot v10 portrait/landscape logs contain no `aria-hidden` warning,
  fatal exception, `updateExistingAdView()` NPE, or ANR. Protected-surface
  opening removed the native banner before the create sheet became visible;
  closing the sheet eventually restored the eligible banner.
- Arabic was selected through the real Settings UI and the exact-v9 Habits
  surface rendered mirrored navigation, ordering, copy, and actions with the
  native test banner. English and system font 1.0 were restored afterward.
- Native late-callback and pending-removal races are guarded. A double native
  suppression failure now rejects the acknowledgement and keeps the protected
  surface closed; the visible recovery notice is dismissible and translated in
  all eight locales. Trigger focus is released before the sheet/drawer mounts,
  eliminating the previously observed `aria-hidden` focus warning in v10 logs.
- Fresh focused banner/blast-radius suite: 12 files, 172 tests. The full
  coverage run passed 726 files with 9,108 tests and 7 repository `todo` cases.

## FAIL

- The v8 landscape screenshot is negative evidence: the lower habit content
  was visually occluded by the native banner before the scroll regression fix.
- The exact-v10 APK produced an input-dispatch ANR on the already degraded
  emulator instance before reboot. After a cold reboot with
  `swiftshader_indirect`, `dumpsys activity lastanr` stayed clear, but the
  renderer repeatedly skipped 33–1,146 frames, the canonical orb worker timed
  out in landscape, and protected-surface acknowledgement could exceed its
  watchdog before the fallback removal completed. The same APK eventually
  converged to the correct banner/sheet states, but this is still a runtime
  performance `FAIL`, not no-regression proof; banner causation is not proven.
- The settled landscape create sheet visibly wraps several Quick Add labels at
  nearly character-level breaks (`Read 10 pages`, `Meditate`, `Sleep routine`).
  The banner correctly remained absent, but the protected surface does not meet
  the requested visual-regression bar. No acceptance threshold was weakened.
- The final `npm run ci:preflight` executed 726 test files and 9,115 tests:
  9,108 passed and 7 remained repository `todo`; the production web build and
  every stage through `check:sync-contract` passed. The command exited nonzero
  only at the inherited `ratchet:check`: inline styles were 358 against a floor
  of 313 and maximum of 323, the ledger was 48 days old against a 30-day
  maximum, and the score was 9.1 against a 9.2 floor. No ratchet, baseline,
  assertion, or acceptance criterion was changed or waived for this banner.

## UNVERIFIED

- Complete IME pixels on the affected renderer, Hebrew runtime, split-screen,
  three-button navigation, TalkBack human quality, and a physical Android device.
- Exact-v10 large-font and Arabic/RTL replays. Their exact-v9 captures are useful
  history but are not fresh proof for the v10 artifact.
- Signed release, Play/AdMob console configuration, owner IDs, live serving or
  impressions, public deployment, and store acceptance. Owner app/banner IDs
  remain absent, so the release guard correctly fails closed.
- Web/Vite, installed PWA, iOS/WKWebView, and Desktop/Tauri runtime parity beyond
  the static Android-only no-op contracts and shared build/type/test evidence.

## Visual integrity verdict

- Technical: `PASS` for banner-specific tests, native geometry, fail-closed
  suppression, QA/release isolation, builds, and static/platform guards.
- Visual Runtime: `FAIL` because the exact artifact hit one pre-reboot ANR and
  severe post-reboot renderer stalls even though settled banner states rendered.
- Artistic/Craft: `FAIL` for the settled landscape sheet label wrapping;
  portrait banner composition itself is visually coherent.
- Motion: `FAIL` because measured main-thread frame skips exceed an acceptable
  interactive transition budget on the tested emulator renderer.
- Model: `N/A`; no 3D/model asset changed in this banner task.
- Plan: `UNVERIFIED`; T016 and T017 remain open until the runtime/craft failures
  are resolved or independently proven to be outside the release target.

# Platform quality semantic convergence

Date: 2026-08-31

## Provenance

- Current baseline: `1d170436f24d366fa469da3f34962ed6daeaa5fe`
- T182 Android Back snapshot: `b15209f2cd568775e2702de7c8528c0537878b22`
- T185 adaptive-layout snapshot: `131e13884b3093f89b045c5d991cb6eff7547b28`
- T186 native-locale snapshot: `7c0a1cba81e0b7eb5c8b54f2f1fb3d47f3377646`
- T191 motion-inventory snapshot: `d6d70dfddbbe08000617470bae872a5c5b00fe50`
- Replacement branch: `codex/platform-quality-convergence-20260831`

The historical snapshots are not merged wholesale. Their platform-quality behavior is replayed
onto current `main`; the newer journal recovery, durable sync, lifecycle, privacy, compact-i18n,
dependency, and release decisions remain authoritative.

## Integrated behavior

- Android predictive Back has one native owner and a priority-aware TypeScript bridge. Modal,
  drawer, command-palette, recovery, focus, journal, mood, and navigation owners publish explicit
  state instead of competing for the same event.
- Cancelling a focus reflection omits the optional score without discarding an already-finished,
  durably persisted focus session.
- The T184 QA build has an explicit test-only Vite entry and root base. Production Capacitor
  builds retain their relative asset base and web builds retain the configured web base.
- Settings, feedback, update, sidebar, mood, and journal surfaces reflow at 200 percent zoom and
  short Android landscape sizes without introducing a parallel production UI.
- The native Android locale plugin follows the active application language. Failure diagnostics
  are finite and do not bridge raw native exceptions.
- The generated non-Orb motion inventory accounts for production motion owners and proof-binds
  Orb exclusions. It ignores generated Capacitor assets, remains deterministic, and fails closed
  on missing or malformed ownership rows.

## Preserved current-main invariants

- Journal recovery, write security, import confirmation, and password-removal lifecycle behavior
  from the current baseline remain in place.
- Durable focus completion remains persistence-first and reward-safe.
- Current background-music ownership, explicit Orb mood selection, accessibility roles, and
  diagnostic privacy are preserved.
- No historical Supabase schema/type batch, native interstitial/rewarded advertising behavior, or
  generated Android bundle is imported as source.

## Verification

- Full Vitest: 817 files passed, 1 skipped; 9,836 tests passed, 23 skipped, 7 todo; 0 failed.
- ESLint with zero warnings and TypeScript checks: PASS.
- Production data integrity: PASS with 2,286 scanned files, 872 runtime-reachable files, zero
  errors, warnings, baselines, or waivers.
- Sync contract: PASS with 409 invariants.
- Non-Orb motion inventory: PASS with 1,263 owners, 56 Orb exclusions, 788 candidate files, and
  100 percent source coverage.
- T184 QA build and T185 Playwright reflow suite: 6/6 scenarios passed.
- Android production build, Capacitor sync, and release-artifact checks: PASS.
- Android Gradle `testDebugUnitTest lintDebug`: PASS; 549 tasks executed.

## Evidence boundaries

Physical Android devices, predictive-back gesture animation on-device, TalkBack and switch-access
review, native instrumentation execution, iOS native locale behavior, and human visual/artistic
approval remain `UNVERIFIED`. Release remains `UNVERIFIED` until the exact replacement tip is
committed and pushed, required PR checks pass, the PR is merged into `origin/main`, and the
resulting production workflows pass on the exact merge SHA.

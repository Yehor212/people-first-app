# V2 Fullscreen Edge-To-Edge Audit - 2026-06-19

## Scope

User-visible issue: V2 does not fully feel fullscreen on native/emulated devices; parts of the screen can read as an inner rectangular app canvas. The audit covers V2 route shells, entry/auth surface, native Android/iOS WebView ownership, safe-area handling, V2 journal fullscreen overlays, and future-agent guardrails.

Out of scope: visual redesign, immersive hidden system bars, sync/auth/storage changes, production deploy.

## Web And Native Research

| Source | Applied rule |
| --- | --- |
| Android edge-to-edge docs: https://developer.android.com/develop/ui/views/layout/edge-to-edge | Treat Android 15/API 35+ edge-to-edge as default risk; draw behind transparent bars and handle insets for essential content. |
| Capacitor v8 SystemBars: https://capacitorjs.com/docs/apis/system-bars | SystemBars is the modern Capacitor edge-to-edge surface; keep one CSS inset owner and test if switching injection strategy. |
| MDN CSS env(): https://developer.mozilla.org/en-US/docs/Web/CSS/Reference/Values/env | Safe-area variables are dynamic and can be zero; layout must use fallbacks. |
| MDN viewport units: https://developer.mozilla.org/en-US/docs/Web/CSS/Reference/Values/length | Avoid raw `vh` for app surfaces because browser UI can obscure content; prefer shared `dvh`/safe-area aware variables. |
| W3C CSS Environment Variables: https://www.w3.org/TR/css-env-1/ | Essential content should remain inside the safe rectangle; backgrounds may bleed. |
| Apple safe-area guide: https://developer.apple.com/documentation/uikit/uiview/safearealayoutguide | iOS/WKWebView content must respect safe areas for readable/tappable UI without re-framing the whole app. |

## Local Findings

| Area | Finding | Status |
| --- | --- | --- |
| `index.html` | Viewport contains `viewport-fit=cover`. | PASS |
| `capacitor.config.ts` | `ios.contentInset` is `never`; SystemBars exists with `insetsHandling: "disable"`; SafeArea plugin owns viewport-fit/safe-area fallback. | PASS for current local contract |
| Android native shell | `MainActivity` enables AndroidX edge-to-edge, disables decor fitting, uses transparent system bars, reapplies on resume/config changes, and does not hide bars. | PASS by static contract test |
| V2 document mode | `useV2FullscreenSurface` applies `zenflow-v2-edge-to-edge` so body safe-area gutters are removed for V2 and the shared edge bleed can paint to edges. | PASS |
| V2 routes | Orb, Habits, Diary, Settings, and Journal page shells use `v2-fullscreen-page` and `var(--app-viewport-height)`. | PASS |
| Entry/auth | Entry surface keeps brand safe-area clearance while body padding is zeroed in V2 edge-to-edge mode. | PASS |
| Journal editor overlay | Found legacy mobile `h-screen`/`100svh`; changed to shared V2 viewport behavior with keyboard bottom inset preserved. | FIXED |
| Journal module dialog overlay | Found legacy `h-screen`; changed to `h-[var(--app-viewport-height)]`. | FIXED |
| RTL | Contract now requires logical safe-area handling for `ar`/`he`; existing V2 nav and drawer use logical/start patterns in audited surfaces. | PASS static scope |

## Changes Made

- Added `docs/ai/V2_FULLSCREEN_EDGE_TO_EDGE_CONTRACT.md` as the canonical V2 fullscreen/safe-area contract.
- Wired the new contract into `AGENTS.md`, `docs/ai/TELEGRAM_GRADE_RUNTIME_CONTRACT.md`, and `docs/ai/TASK_COMPLETION_PROTOCOL.md`.
- Added `src/pages/nav-v2/__tests__/v2FullscreenAgentContract.test.ts` so future agents cannot remove the contract linkage silently.
- Extended `src/pages/nav-v2/__tests__/v2FullscreenSurfaceContract.test.ts` to guard V2 fullscreen overlays against legacy `h-screen`/`100svh` viewport units.
- Replaced legacy viewport units in `src/features/journal/JournalEntryEditor.tsx` and `src/features/journal/JournalModule.tsx` with shared `--app-viewport-height` behavior.

## Verification Evidence

| Check | Result | Evidence |
| --- | --- | --- |
| Agent-contract red test | FAIL before docs | `V2_FULLSCREEN_EDGE_TO_EDGE_CONTRACT.md` missing, expected failure. |
| Overlay red test 1 | FAIL before editor fix | `JournalEntryEditor` did not contain `var(--app-viewport-height)` and used `h-screen`/`100svh`. |
| Overlay red test 2 | FAIL before module fix | `JournalModule` still contained `h-screen`. |
| Targeted fullscreen/static suite | PASS | `npm test -- src/pages/nav-v2/__tests__/v2FullscreenAgentContract.test.ts src/pages/nav-v2/__tests__/v2FullscreenSurfaceContract.test.ts src/pages/nav-v2/__tests__/androidEdgeToEdgeContract.test.ts src/components/__tests__/EntryGate.safeArea.test.ts src/features/journal/__tests__/JournalEntryEditor.iosTouchTargets.test.ts src/features/journal/__tests__/JournalModule.headerStatic.test.ts` -> 6 files, 30 tests passed. |
| Legacy viewport scan in V2 scope | PASS | `rg` found no `h-screen`, `h-[100svh]`, `min-h-[100svh]`, or `supports-[height:100svh]` in audited V2 route/editor/module scope except test guard strings. |
| Android emulator screenshot | PASS screenshot evidence | `output/emulator-screenshots-20260619/android-pixel7-entry-logo-clean.png`. |
| iOS Simulator screenshot | PASS screenshot evidence | `output/emulator-screenshots-20260619/ios-iphone17-entry-logo.png`. Native xcodebuild remains separate from screenshot proof because the local build needed a sanitized temp app workaround for a codesign xattr issue. |

## Required Future Proof For Any V2 Fullscreen Change

1. Run the targeted fullscreen/static suite listed above.
2. Run a browser or Playwright screenshot on the V2 phone route and check console output.
3. For native claims, capture Android emulator and iOS Simulator/device evidence from the final app artifact.
4. Run `npm run check:visual` or a narrower visual audit declared in preflight.
5. For public deployment claims, verify the cache-busted GitHub Pages URL after deploy.

## Acceptance Criteria

- V2 route backgrounds bleed behind transparent/native system bars where the platform allows it.
- Essential UI remains readable and tappable within `var(--safe-top)`, `var(--safe-bottom)`, `var(--safe-left)`, and `var(--safe-right)`.
- No hidden system bars are used to fake fullscreen.
- No route-local raw `100vh`, `100svh`, or `h-screen` is introduced for V2 fullscreen roots or overlays without a characterization test and explicit rationale.
- Android back behavior and modal layering remain intact.
- Canonical orb visuals are not replaced or degraded.

## Rollback

Rollback is limited to reverting the two overlay class changes, the new/extended tests, and the docs wiring. If a platform-specific regression appears, restore the previous overlay class for that surface only and keep the agent contract in place until a narrower platform fix is proven.

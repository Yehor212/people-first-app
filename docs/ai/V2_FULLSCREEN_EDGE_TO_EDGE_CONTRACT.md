# V2 Fullscreen Edge-To-Edge Contract

Purpose: keep V2 feeling like a real fullscreen app on web, PWA, Android WebView, iOS/WKWebView, and desktop shells without hiding system UI, shrinking the WebView, or creating a visible square canvas inside the screen.

Read this before any V2 fullscreen, edge-to-edge, safe-area, SystemBars, viewport, entry/auth, mobile nav, sheet, modal, PWA, Android, iOS, or desktop shell change.

## Source Evidence

- Android Developers edge-to-edge: Android 15/API 35+ treats edge-to-edge as the expected target behavior; apps draw behind system bars and must handle insets for content that must remain tappable and readable.
- Capacitor v8 SystemBars: Capacitor SystemBars is the forward-compatible owner for modern edge-to-edge system bar behavior; Android WebView versions before 140 can need Capacitor-provided `--safe-area-inset-*` CSS fallback values.
- MDN CSS `env()`: `safe-area-inset-*` values describe dynamic unsafe screen edges and can be zero on rectangular or unobstructed displays.
- MDN viewport units: raw `vh` can map to the large viewport and obscure content while browser UI is present; `dvh`, `svh`, and `lvh` have distinct behavior.
- W3C CSS Environment Variables: safe-area variables define a visible safe rectangle where essential content should remain.
- Apple UIKit safe-area docs: iOS safe areas represent the portion of a view not covered by bars, ancestor views, or device geometry.

## Definition

Edge-to-edge means the WebView fills the viewport and paints behind transparent system bars or device cutouts when the platform allows it. It does not mean every child view ignores insets.

Safe areas protect interactive and readable content. Backgrounds, atmosphere, and non-essential art may bleed to every edge; buttons, nav, form fields, readable copy, sheets, dialogs, toasts, and critical status text must account for safe edges.

Do not hide system bars to fake fullscreen. Hidden status/navigation bars break Android back/navigation expectations, accessibility, screenshots, and platform trust unless a product requirement explicitly asks for immersive media or game behavior.

## Required Runtime Ownership

1. `index.html` must keep `viewport-fit=cover` in the viewport meta tag.
2. `capacitor.config.ts` must make one owner explicit for native/system-bar inset behavior. Do not mix multiple CSS inset injectors without a test proving they do not double-pad.
3. Android native edge-to-edge must be owned by `MainActivity` through AndroidX edge-to-edge APIs and transparent system bars. Android 15 must be treated as the default risk case, not a future edge case.
4. iOS must keep the WebView able to cover the viewport; WKWebView content insets must not reintroduce a rectangular app canvas unless a route intentionally uses a framed surface.
5. CSS custom properties own layout math: `--app-viewport-height`, `--safe-top`, `--safe-bottom`, `--safe-left`, and `--safe-right` are the shared inputs for V2 route roots and overlays.
6. `Capacitor SystemBars` behavior must stay aligned with the chosen SafeArea strategy. If switching from disabled CSS injection to SystemBars CSS injection, update tests and verify Android WebView fallback behavior.

## CSS And Layout Rules

1. V2 route roots must use shared fullscreen primitives such as `.v2-edge-to-edge-surface`, `.v2-fullscreen-page`, `zenflow-v2-edge-to-edge`, and `var(--app-viewport-height)` instead of route-local raw viewport hacks.
2. Prefer `100dvh` through shared variables for app-height surfaces. Avoid new route-local `100vh`, `100svh`, `h-screen`, `min-h-screen`, `h-[100svh]`, or `min-h-[100svh]` on V2 fullscreen roots unless a characterization test proves the behavior is intentional.
3. Background layers may use `inset-0` and bleed edge-to-edge. Foreground controls must use logical padding or offsets based on `var(--safe-top)`, `var(--safe-bottom)`, `var(--safe-left)`, and `var(--safe-right)`.
4. Entry/auth surfaces must keep brand/logo clearance from the status bar, even when the body padding is zeroed for edge-to-edge mode.
5. Bottom nav, drawers, sheets, media pickers, and modals must keep 44px minimum touch targets after safe-area padding is applied.
6. RTL languages (`ar`, `he`) must use logical inline spacing or explicit `--safe-left`/`--safe-right` handling. Do not assume left means start.
7. Desktop/Tauri and wide web may have zero safe-area values, but they still must share the same variables so route parity is testable.

## Surfaces To Audit Before V2 Fullscreen Claims

- `index.html` viewport meta.
- `capacitor.config.ts` SystemBars, SafeArea, and iOS content inset settings.
- `android/app/src/main/java/com/zenflow/app/MainActivity.java` edge-to-edge setup, resume behavior, orientation changes, and system bar colors.
- Android native resources that provide the edge-bleed backdrop and system bar colors.
- iOS Capacitor config and generated native app config.
- `src/hooks/useV2FullscreenSurface.ts` and `src/pages/Index.tsx` route shell ownership.
- `src/index.css` shared viewport and safe-area variables.
- `src/components/EntryGate.css` and entry/auth tests.
- `src/components/navigation-v2/**`, `src/pages/nav-v2/**`, V2 sheets/modals, and journal full-screen editor surfaces.

## Required Proof

A V2 fullscreen change is not complete until the relevant rows below are marked `PASS` or explicitly `UNVERIFIED` with reason:

| Requirement | Minimum proof |
| --- | --- |
| Static V2 contract | `npm test -- src/pages/nav-v2/__tests__/v2FullscreenSurfaceContract.test.ts src/pages/nav-v2/__tests__/androidEdgeToEdgeContract.test.ts src/pages/nav-v2/__tests__/v2FullscreenAgentContract.test.ts src/components/__tests__/EntryGate.safeArea.test.ts` |
| Web preview | Browser or Playwright screenshot of the V2 phone route plus console check |
| Android WebView | Android emulator screenshot and/or UIAutomator proof, including status/nav bars and a V2 route |
| iOS/WKWebView | iOS Simulator screenshot or native build/simulator proof for the same V2 route |
| Visual regression | `npm run check:visual` or a narrower visual audit accepted in the preflight |
| Build/runtime | Production build or platform build relevant to the touched surface |

## Acceptance Checklist

- No visible rectangular app canvas or unpainted system-bar strip on V2 phone routes.
- Backgrounds bleed to physical/device edges where the platform supports it.
- Essential content remains inside safe areas and keeps 44px minimum touch targets.
- Android back behavior remains intact for modals and sheets.
- Status and navigation bars are transparent or visually integrated, not hidden to fake fullscreen.
- PWA/web/browser viewport changes do not create clipped CTAs or unreachable scroll content.
- RTL routes do not swap unsafe inline padding incorrectly.
- The change keeps canonical orb visuals intact.

## Rollback

Rollback is the smallest revert of the route CSS/native fullscreen change plus its tests. If a native edge-to-edge change causes platform regressions, first restore the previous `capacitor.config.ts` and native system-bar ownership, then rerun the static V2 contract and emulator proof before claiming recovery.

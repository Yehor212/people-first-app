# V2 Settings Emerald Night Implementation Plan

> **For Codex:** Execute this plan test-first. Do not claim visual success without fresh runtime artifacts.

**Goal:** Ship the user-approved Variant A as the real V2 Settings night presentation: a deep emerald, full-viewport, static starfield that continues the Mood atmosphere while keeping every setting readable and immediately usable.

**Architecture:** Add one isolated Settings-only backdrop with the exact approved deterministic 24-star layout and mount it as a sibling before the transformed `Bloom` content. Settings-scoped theme tokens make only the `ink` route layers transparent enough for the scene while keeping cards nearly opaque. `paper`, `oled`, and the canonical Mood/Orb background path remain unchanged.

**Stack:** React 18, TypeScript, Vite, Tailwind, CSS theme tokens, Vitest/Testing Library, Browser/Playwright runtime evidence.

## Requirements and boundaries

- Explicit: implement approved Variant A, including the emerald night, visible stars behind the full Settings surface, and readable cards.
- Implied: preserve theme switching, touch targets, RTL (`ar`/`he`), safe areas, keyboard focus, high contrast, reduced transparency, reduced motion, OLED truthfulness, and existing Settings behavior.
- Out of scope: Settings information architecture, copy, persistence, sync/auth/privacy, production data, the canonical Mood orb, dependencies, and deployment.
- No production mocks, placeholder visuals, random star generation, AI/sparkle iconography, physical left/right offsets, or hardcoded component colors.

## Evidence baseline

- Approved reference: `output/design-explorations/emerald-settings-approval-20260713-v10-final/01-emerald-mood-continuity-mobile.png`.
- Current root cause: `themes.css` paints old olive Settings shell/page gradients and `CosmicBgAdapter` has no static Settings variant.
- Isolation decision: do not modify `CosmicBgAdapter` because it is Orb-owned and its starry branch carries animation and Orb-specific test IDs; the Settings leaf is static and exact to the approved artifact.
- Known risks: opaque stacking layers can hide the scene; a backdrop inside transformed `Bloom` can crop/scale; demo physical offsets are not RTL-safe; OLED must remain unchanged and black.

## Platform matrix

| Surface         | Required proof                                                                                                  |
| --------------- | --------------------------------------------------------------------------------------------------------------- |
| Web/PWA phone   | Full-height ink screenshot; overview/detail; scroll continuity; paper/OLED switching                            |
| Web/PWA desktop | Sidebar-aware full-bleed scene; overview/detail; no clipping or horizontal overflow                             |
| Android / iOS   | Safe-area and WebView-compatible CSS/static behavior; native device proof stays `UNVERIFIED` unless freshly run |
| Desktop/Tauri   | Responsive desktop browser parity; Tauri package proof stays `UNVERIFIED` unless freshly run                    |
| Accessibility   | Contrast audit, keyboard focus, RTL, forced colors, reduced transparency, reduced motion                        |
| Performance     | Deterministic 24 DOM stars on Settings only, zero star animation, no canvas/WebGL, runtime performance smoke    |

## Task 1: Lock the expected behavior with RED tests

**Files:**

- Modify: `src/styles/themes.bridge.test.ts`
- Modify: `src/pages/nav-v2/__tests__/SettingsPage.test.tsx`
- Create: `src/pages/nav-v2/settings/components/SettingsEmeraldNightBackdrop.test.tsx`

1. Add an integration test requiring exactly one Settings backdrop, 24 static decorative stars, no role/focusability, and an explicit mobile-detail state.
2. Add token/CSS contract assertions for the deep-emerald ink sky, unchanged paper/OLED snapshots, a solid ink route fallback plus transparent ink page content, forced-colors hiding, and absence of physical sidebar offsets.
3. Add a focused component contract for deterministic star metadata and zero animation.
4. Run the focused tests and record the expected failures before production edits.

## Task 2: Implement one isolated static Settings backdrop

**Files:**

- Create: `src/pages/nav-v2/settings/components/SettingsEmeraldNightBackdrop.tsx`
- Modify: `src/pages/nav-v2/SettingsPage.tsx`
- Modify: `src/pages/nav-v2/settings/components/SettingsPageComponents.tsx`

1. Render the exact approved 24 edge-safe star coordinates with stable IDs, inline geometry variables only, and `aria-hidden="true"`.
2. Mount the backdrop once as a sibling immediately before `Bloom`; keep `Bloom` content on a higher layer so its transform never captures the fixed scene.
3. Pass an explicit mobile-detail flag to the Settings shell instead of relying on `:has()` as the only contract.
4. Use fixed/logical full-viewport CSS with existing `data-nav-layout` and `data-nav-rail` attributes; do not add physical `left`/`right` offsets.
5. Show the scene only under `ink`, hide it in paper/OLED/forced colors, and keep it static under every motion/performance mode.

## Task 3: Replace swamp tokens with approved emerald night tokens

**Files:**

- Modify: `src/styles/themes.css`

1. Add semantic Settings sky/star/aurora/vignette tokens to the ink theme.
2. Keep paper values and appearance unchanged.
3. Set ink to a deep green-black sky with mint-white text/borders and near-opaque emerald cards.
4. Keep OLED tokens and true-black presentation unchanged.
5. Keep an ink route-level deep-emerald fallback, make only the ink Settings page content background transparent to the fixed scene, and keep the foreground readable.
6. Preserve existing high-contrast, reduced-transparency, safe-area, focus, and touch-target rules.

## Task 4: GREEN and blast-radius verification

1. Rerun the exact focused RED command and require green.
2. Run related Settings, theme switching, fullscreen/readability, canonical orb, and visual contract tests.
3. Run typecheck and lint separately, then `check:canonical-orbs`, `check:all`, production build, and relevant integrity checks.
4. Check Snyk availability for modified TypeScript; an unavailable/auth-blocked scan is `UNVERIFIED`, not `PASS`.

## Task 5: Fresh runtime and artistic proof

1. Start the production-equivalent local app route and use the Browser skill.
2. Capture phone and desktop ink Settings overview and Appearance detail screenshots.
3. Verify paper unchanged and OLED black in the same runtime; verify live switching without reload.
4. Exercise RTL, 200% zoom/narrow width, keyboard focus, forced colors, reduced transparency, reduced motion, scroll continuity, and no horizontal overflow.
5. Check console/network errors, accessibility tree/Lighthouse, and a scoped performance trace.
6. Run an independent `visual-integrity-critic` review against the approved A reference. Technical green checks do not substitute for `ARTISTIC_PASS`.

## Acceptance criteria

- The ink Settings background is recognizably Variant A: deep emerald-black, sparse static stars across the full Settings viewport, and no olive/red/neon cast.
- Cards remain readable at normal text sizes and selected controls remain identifiable without color alone.
- Paper and OLED are unchanged; live theme switching is correct.
- One Settings-only deterministic 24-star scene is used; stars never animate; forced-colors removes the decoration.
- No Settings behavior, data, copy, or canonical Orb visual changes.
- Fresh automated and browser evidence exists; unavailable native/public proof is reported honestly as `UNVERIFIED`.

## Rollback

Revert only the Settings backdrop/test, Settings page/shell/test, theme CSS/test, and this plan. No migration or data rollback is required.

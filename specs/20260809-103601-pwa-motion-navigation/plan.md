# Implementation Plan: PWA Motion, Navigation, and Icon Quality

## Technical context

The plan modifies existing presentation owners only: `useMotionPreference`, habit-detail UI and heatmap, journal calendar/list, appropriate locale catalogs, and generator-owned PWA icon sources only if current inspection identifies a verified gap. The app remains React/TypeScript with existing i18n, Framer Motion, Radix/shadcn patterns, and generator-owned static assets. No dependency, store, persistence, sync, native, or feature-002 activation is allowed.

## Plan steps

1. Capture focused baseline/red tests for each defect against current source. Tests must fail for the expected 182 focus stops, unbounded journal cards, missing tab association/keyboard behavior, or reduced-motion optional work. If a visual/browser test cannot be made deterministic, record a static characterization and retain runtime proof as `UNVERIFIED`.
2. Inspect the actual effective motion preference composition, bind all 79 indefinite emotion-SMIL nodes and the 34 JavaScript-loop waivers to one checked surface registry, and make optional rendering/loading conditional before paint. Preserve canonical orb paths untouched.
3. Upgrade every production custom tablist owner through one shared keyboard/focus contract (or an existing complete primitive), including stable tab/panel association, roving focus, LTR/RTL behavior, 44px targets, and reduced-motion-safe panel transitions. Do not add overlay ownership.
4. Refactor `HabitHeatmapGrid` into a noninteractive summary with a non-color localized legend and a single callback to select existing history. No day cell remains focusable/actionable.
5. Normalize `AnimatedCalendar`, compact/full journal calendar accessible names, and emotion visual labeling, including visible metrics, private-mode negative controls, raw-token rejection, and eight-locale parity.
6. Introduce a derived, local 96-card render window in the text-result branch of `JournalEntryList`, with explicit continuation, stable identity/order, and tested focus/scroll recovery. Preserve existing private/AI/space branches unless verified applicable.
7. Inspect PWA icon generator/config/output only after a failing targeted check or a verified visual defect. Preserve canonical leaf paths and install identity; use the generator, structural check, and proof sheet rather than raster edits.
8. Rerun focused green tests and widening checks. Use browser evidence for installed PWA/Web rendering; obtain native owner receipts instead of modifying native projects. Final completion requires diff/status review and an honest evidence ledger.

## Files expected to change if implementation is authorized

| Area | Candidate exact paths | Boundary |
| --- | --- | --- |
| Motion | `src/hooks/useShouldAnimate.ts`, `src/lib/animationUtils.ts`, `src/lib/motionSurfaceRegistry.ts`, `src/components/animated-emotion-emoji/AnimatedEmotionEmoji.tsx`, `src/components/animated-emotion-emoji/warmEmojis.tsx`, `src/components/animated-emotion-emoji/coolEmojis.tsx`, and the existing loop contract test | Reuse effective preference; account for 79 SMIL/34 JS-loop baselines; no orb downgrade/new store. |
| Tabs/heatmap | `src/hooks/useTabsKeyboardNavigation.ts`, all current production custom-tab owners found by the inventory, `src/components/habit-hub/HabitHeatmapGrid.tsx` | One complete shared contract; existing panel owners; one history action only. |
| Calendar/emotion | `src/components/animated-stats/AnimatedCalendar.tsx`, `src/features/journal/JournalCalendar.tsx`, `src/features/journal/JournalCalendarFull.tsx`, `src/components/animated-emotion-emoji/AnimatedEmotionEmoji.tsx`, locale files selected after key audit | No raw tokens/private disclosure; no concatenated translations. |
| Journal bound | `src/features/journal/JournalEntryList.tsx` | Derive view state only; no data/sync mutation. |
| Icons | `scripts/generate-icons.cjs`, `scripts/check-brand-logo-assets.cjs`, `config/brand-logo-assets.json` only if a real gap requires it | Generator-owned; no native/generated raster hand edit. |
| Tests | Exact paths created in tasks | Test-first; fixtures isolated from production paths. |

## Platform and domain matrix

| Surface | Planned impact | Required proof before release | Current status |
| --- | --- | --- | --- |
| Web/Vite | Shared UI fallback for motion, tabs, calendar, list, static icons | Focused tests, browser/keyboard/RTL screenshot and console/network check | UNVERIFIED |
| Installed PWA | Primary target; install/icon/motion/list behavior | Installed Chrome/Edge test, cache/update observation, network capture | UNVERIFIED |
| Android/Capacitor | No native edits; shared UI may render in WebView | Owner compatibility receipt and back/safe-area check if shared code changes | UNVERIFIED |
| iOS/WKWebView | No native edits; shared UI may render in WebView | Owner compatibility receipt, safe-area/VoiceOver/reduced-motion check | UNVERIFIED |
| Desktop/Tauri | No native edits; shared UI may render in desktop webview | Owner compatibility receipt, keyboard/window check | UNVERIFIED |
| Store/Release | No store submission or public deploy | Icon/manifest proof plus owner/device receipt before store claim | UNVERIFIED |
| Accessibility | Keyboard, focus, labels, non-color, 44px, RTL | Automated tests plus browser/AT review | UNVERIFIED |
| Performance | Fewer focusable/mounted elements; no optional reduced-motion load | DOM-count/network/6s observation and performance capture | UNVERIFIED |
| Security & privacy | No new authority/data/telemetry; private labels stay suppressed | Production-data scan and negative private-mode tests | UNVERIFIED |
| Testing | New focused regression coverage | Red/green, type/lint/i18n/targeted checks | UNVERIFIED |
| Operations | Local branch only; rollback via code/test revert and generator rerun | Diff/status, receipts, rollback rehearsal where asset input changes | UNVERIFIED |

## Verification strategy

Focused Vitest red/green paths precede source edits. Broader checks are selected by actual changed paths: typecheck, lint, i18n/deep translation, production-data-integrity diff/full/bundle when applicable, `check:canonical-orbs` for any accidental orb adjacency, `assets:logos:check` and `assets:logos:proof` for icon inputs, browser/Playwright installed-PWA checks, and `ci:preflight` before any release claim. A pass in one row never promotes another platform or artistic/human row.

## Rollback and release boundary

Scoped local source/test implementation is authorized after its RED evidence. No release, commit, push, PR, deploy, issue creation, native change, or feature-002 activation is authorized. Revert a failed implementation as a cohesive scoped change, restoring existing component behavior; if icon generator inputs changed, regenerate outputs and rerun structural/proof checks. No persistent user data requires migration or rollback.

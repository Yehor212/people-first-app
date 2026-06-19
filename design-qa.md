# Design QA - V2 Habits Icon System B29

Date: 2026-06-18
Scope: v2 habits tab only, option B / real Phosphor inline-SVG icons with bespoke mini object scenes.

## Decision

- B28 and earlier variants are not treated as user-approved final work.
- Active candidate is B29: real Phosphor Icons React inline SVG source icons rendered as source-plus-prop mini object scenes.
- Option B is preserved, but glass is no longer a shared card or blob. It is scene edge refraction, prop material, rim, echo, and glint around the real source icon.
- Production UI uses @phosphor-icons/react inline SVG plus app-authored vector scene props only: no emoji, no raster icon assets, no generated PNG icons, and no Blender/raster approximation in shipped UI.
- B29 addresses the remaining B28 icon-pack feel by adding a separate per-habit scene prop and scene line layer for every habit.

## Evidence Artifacts

- Board: output/playwright/v2-habit-icons-b29-20260618/v2-habit-icons-b29-production-proof.png
- Motion filmstrip: output/playwright/v2-habit-icons-b29-20260618/v2-habit-icons-b29-motion-filmstrip.png
- Board facts: output/playwright/v2-habit-icons-b29-20260618/v2-habit-icons-b29-facts.json
- v2 habits route: output/playwright/v2-habit-icons-b29-20260618/v2-habits-route-b29-mobile.png
- v2 habits route facts: output/playwright/v2-habit-icons-b29-20260618/v2-habits-route-b29-mobile-facts.json
- v2 create sheet: output/playwright/v2-habit-icons-b29-20260618/v2-habits-create-sheet-b29-mobile.png
- v2 create sheet facts: output/playwright/v2-habit-icons-b29-20260618/v2-habits-create-sheet-b29-mobile-facts.json
- Previous B28 artifacts remain historical evidence only and are not treated as approval.

## Runtime Contract

- Full proof board renders 22 production V2HabitPictogram icons with treatment phosphor-real-icon-liquid-glass-b29-mini-scene-instruments.
- Full proof board facts: 22 real source SVG icons, 22 unique motion roles, 22 unique scene props, 22 scene prop layers, 22+ scene line layers, 0 B28/B27/B26 production layers, 0 raster icon assets, 0 emoji hits.
- v2 habits route facts: 7 B29 pictograms, 7 real source SVG icons, 7 scene props, 0 B28/B27/B26 layers, 0 raster icon assets.
- v2 create sheet facts: 13 visible B29 pictograms, 13 real source SVG icons, 13 scene props, 0 B28/B27/B26 layers, 0 raster icon assets.
- Reduced motion facts: body.reduce-motion disables outer, inner source, echo, and glint animation for all 22 proof-board icons.

## Verification

- Red test before B29 production code: current B28 implementation failed B29 contract with 4 failed files, 31 expected failures, and 8 passing baseline tests.
- Green focused tests: npm test -- src/components/habit-pictogram/__tests__/V2HabitPictogram.test.tsx src/components/habit-pictogram/__tests__/V2HabitPictogram.assets.test.ts src/components/habit-creation-form/__tests__/TemplatePicker.test.tsx src/pages/nav-v2/habits/hero/__tests__/HeroEmptyJourney.test.tsx => 4 files, 39 tests passed.
- TypeScript: npx tsc --noEmit -p tsconfig.app.json --pretty false passed.
- Scoped lint passed for the edited habit pictogram and related tests.
- npm run check:colors passed.
- npm run check:canonical-orbs passed.
- npm run check:all passed with one pre-existing unrelated warning in src/features/journal/useJournalEditorState.ts.
- Snyk fallback: snyk code test src/components/habit-pictogram reported 0 issues.
- npm audit --audit-level=high exited 0; it reported one moderate dompurify advisory outside this icon-only scope.
- git diff --check passed.

## UNVERIFIED

- User visual approval of B29 is still UNVERIFIED.
- Public GitHub Pages deployment is UNVERIFIED.
- The broader dirty worktree contains many unrelated changes and was not audited as part of this icon-only pass.

# V2 Habit Icon Animation System Implementation Plan

> **Governance update (2026-08-14):** Execute only an explicitly authorized task and do so SOLO. Use `superpowers:executing-plans` only for an approved plan; do not invoke subagents or auto-start the next task. Existing checkboxes are tracking only.

Goal: Build a production pipeline for high-quality v2 habit icons with real vector assets, complete logical motion, strict budgets, reduced-motion fallbacks, and browser proof.

Architecture: Keep V2HabitPictogram as the public boundary. Add an asset manifest and optional lazy motion player behind it, while preserving the current B62 CSS/SVG fallback. Validate assets before runtime integration so design quality, performance, and accessibility are enforced by tests rather than taste alone.

Tech Stack: React 18, TypeScript, Vite, Tailwind/theme tokens, Phosphor source icons, optional Lottie/Rive spike, Playwright, Vitest, SVGO, Snyk.

---

## Source Evidence

- Current v2 icon component: src/components/habit-pictogram/V2HabitPictogram.tsx
- Current icon tests: src/components/habit-pictogram/__tests__/V2HabitPictogram.test.tsx
- Current CSS motion system: src/index.css
- Current proof board output: output/playwright/v2-habit-icons-b62-telegram-grade-20260619/v2-habit-icons-b62-telegram-grade-facts.json
- Design spec: docs/superpowers/specs/2026-06-19-v2-habit-icon-animation-system-design.md

## Files

- Modify: src/components/habit-pictogram/V2HabitPictogram.tsx
- Create: src/components/habit-pictogram/HabitMotionPlayer.tsx
- Create: src/components/habit-pictogram/habitMotionAssets.ts
- Create: src/components/habit-pictogram/__tests__/HabitMotionPlayer.test.tsx
- Modify: src/components/habit-pictogram/__tests__/V2HabitPictogram.test.tsx
- Modify: src/lib/v2HabitPictograms.ts
- Create: src/assets/habit-icons/v2/manifest.json
- Create: src/assets/habit-icons/v2/HABIT_ID/reduced.svg
- Optional after spike: src/assets/habit-icons/v2/HABIT_ID/idle.lottie.json
- Create: scripts/validate-habit-icon-assets.cjs
- Create: scripts/__tests__/validate-habit-icon-assets.test.ts
- Create: e2e/v2-habit-icon-motion.spec.ts
- Create: docs/audits/v2-habit-icon-animation-audit-2026-06-19.md

## Canonical Habit Ids

This plan covers exactly these 22 ids:

- drink-water
- walk-distance
- exercise
- read
- meditate
- sleep
- stretch
- healthy-food
- protein
- vitamins
- brush-teeth
- sunlight
- touch-grass
- journal
- gratitude
- breathwork
- phone-break
- deep-work
- tidy-room
- quit-smoking
- quit-drinking
- focus

## Phase 1: Lock The Motion Bible

### Task 1: Create canonical icon production bible

Files:

- Create: design/habit-icons/v2/motion-bible.md
- Create: design/habit-icons/v2/source-manifest.json

Steps:

- [ ] Write motion-bible.md with all 22 habit ids, object metaphors, idle stories, press states, complete states, disabled states, and reduced still definitions from the design spec.
- [ ] Write source-manifest.json with version v2-habit-icons-1, style b62-liquid-glass-vector-motion, sourcePolicy licensed-vector-or-hand-authored-vector-only, and all 22 ids.
- [ ] Verify there are no emoji characters or unresolved placeholders in the bible or manifest.
- [ ] Commit checkpoint only if the user asks for commits.

Acceptance:

- The bible lists all 22 icons.
- Every habit has a unique motion story.
- Every habit has idle, press, complete, disabled, and reduced behavior.

Verification:

- Text scan over design/habit-icons/v2 returns no unresolved placeholder markers and no final emoji usage.

## Phase 2: Add Asset Manifest Validation

### Task 2: Write failing validator tests

Files:

- Create: scripts/__tests__/validate-habit-icon-assets.test.ts
- Create: scripts/validate-habit-icon-assets.cjs

Steps:

- [ ] Write a Vitest test that loads src/assets/habit-icons/v2/manifest.json and expects 22 valid icons.
- [ ] Write a Vitest test that rejects emoji labels, missing reduced SVGs, idle duration above 3000ms, idle assets above 80000 bytes, and missing press/complete/disabled/reduced states.
- [ ] Run npm test -- scripts/__tests__/validate-habit-icon-assets.test.ts and confirm the expected red failure before implementation.

Acceptance:

- Tests fail before validator and manifest exist.
- Failure proves the test can catch shallow or emoji-based icon work.

### Task 3: Implement validator

Files:

- Create: scripts/validate-habit-icon-assets.cjs

Steps:

- [ ] Implement validateHabitIconManifest(manifest, options).
- [ ] Enforce required states: idle, press, complete, disabled, reduced.
- [ ] Enforce no emoji in labels.
- [ ] Enforce reduced SVG path.
- [ ] Enforce idle duration <= 3000ms.
- [ ] Enforce idle animation bytes <= 80000.
- [ ] Enforce file existence when checkFiles is true.
- [ ] Export validateHabitIconManifest for tests.
- [ ] Add CLI behavior: node scripts/validate-habit-icon-assets.cjs src/assets/habit-icons/v2/manifest.json.

Acceptance:

- Invalid sample fails with specific errors.
- Valid manifest passes after Phase 3.

## Phase 3: Create Baseline Runtime Manifest

### Task 4: Add manifest and reduced stills

Files:

- Create: src/assets/habit-icons/v2/manifest.json
- Create: src/assets/habit-icons/v2/HABIT_ID/reduced.svg

Steps:

- [ ] Create one folder per habit id.
- [ ] Export reduced.svg from real vector sources only. Do not use emoji or generated bitmap art.
- [ ] Optimize each reduced.svg with npx svgo.
- [ ] Add manifest entries for all 22 ids with source, license, reduced path, idle renderer, idle name, durationMs, bytes, and state list.
- [ ] Run node scripts/validate-habit-icon-assets.cjs src/assets/habit-icons/v2/manifest.json.

Acceptance:

- Validator reports Validated 22 v2 habit icons.
- Every reduced still is a real optimized SVG.

## Phase 4: Add Runtime Boundary

### Task 5: Add asset lookup module

Files:

- Create: src/components/habit-pictogram/habitMotionAssets.ts
- Modify: src/components/habit-pictogram/__tests__/V2HabitPictogram.test.tsx

Steps:

- [ ] Import manifest.json.
- [ ] Define HabitIconMotionState as idle, press, complete, disabled, reduced.
- [ ] Define HabitIconRenderer as css, lottie, rive, still.
- [ ] Define HabitIconAssetEntry with id, label, source, license, reduced, idle, states.
- [ ] Implement getHabitIconAsset(id) and throw on missing id.
- [ ] Add tests that every pictogram id resolves production asset metadata.

Acceptance:

- Every existing pictogram id resolves a manifest entry.
- Missing id throws a useful error.

### Task 6: Add HabitMotionPlayer

Files:

- Create: src/components/habit-pictogram/HabitMotionPlayer.tsx
- Create: src/components/habit-pictogram/__tests__/HabitMotionPlayer.test.tsx

Steps:

- [ ] Write failing tests for css renderer and still fallback when motionAllowed is false.
- [ ] Implement HabitMotionPlayer with pictogramId, renderer, and motionAllowed props.
- [ ] Resolve effective renderer from manifest when renderer is auto.
- [ ] Render still when motionAllowed is false.
- [ ] Keep the component decorative by default.
- [ ] Run npm test -- src/components/habit-pictogram/__tests__/HabitMotionPlayer.test.tsx src/components/habit-pictogram/__tests__/V2HabitPictogram.test.tsx.

Acceptance:

- CSS fallback works.
- Still fallback works.
- No runtime package is required yet.

## Phase 5: Renderer Spike

### Task 7: Compare CSS/SVG, Lottie, and Rive on 3 icons

Files:

- Create: docs/audits/v2-habit-icon-renderer-spike-2026-06-19.md
- Optional after approval: package.json and package-lock.json

Steps:

- [ ] Use drink-water, read, and quit-smoking as the spike set.
- [ ] Measure current CSS/SVG quality with tests, build, and Playwright screenshot.
- [ ] If Lottie is approved, install only lottie-web and implement cleanup/destroy proof.
- [ ] If Rive is approved, install only @rive-app/react-canvas and implement offscreen/reduced-motion proof.
- [ ] Fill a decision table for visual quality, bundle cost, mobile proof, reduced motion, cleanup, and decision.

Acceptance:

- No runtime becomes production until the decision table has fresh evidence.
- Dependency install is scoped to the chosen spike.

## Phase 6: Integrate Chosen Runtime

### Task 8: Add lazy runtime only after spike decision

Files:

- Modify: src/components/habit-pictogram/HabitMotionPlayer.tsx
- Create only if Lottie wins: src/components/habit-pictogram/LottieHabitIcon.tsx
- Create only if Rive wins: src/components/habit-pictogram/RiveHabitIcon.tsx

Steps:

- [ ] Add tests proving reduced motion does not mount animated runtime.
- [ ] Add tests proving missing asset falls back to still/CSS without crash.
- [ ] Lazy-load runtime package.
- [ ] Pause offscreen icons.
- [ ] Destroy Lottie or stop Rive on unmount.
- [ ] Render still fallback on runtime error.
- [ ] Keep V2HabitPictogram API stable.

Acceptance:

- Runtime is isolated behind one component.
- Reduced motion bypasses animated runtime.
- Offscreen icons do not keep animating.

## Phase 7: Visual And Runtime QA

### Task 9: Add Playwright proof

Files:

- Create: e2e/v2-habit-icon-motion.spec.ts
- Output: output/playwright/v2-habit-icons-final-YYYYMMDD/

Steps:

- [ ] Open /people-first-app/habits?nav=v2&navLayout=phone&dev=true.
- [ ] Wait for data-habit-pictogram icons.
- [ ] Capture facts: icon count, renderer list, emoji text check, loop duration metadata, source layer count.
- [ ] Capture full board screenshot for all 22 icons.
- [ ] Capture real v2 Habits route screenshot.
- [ ] Capture reduced-motion screenshot.
- [ ] Sample several frames over time and prove animated icons are not static.

Acceptance:

- Board shows all 22 icons.
- Route shows starter icons.
- Reduced motion shows stills.
- Frame sample proves at least 4 distinct rendered states for animated icons.

## Phase 8: Final Verification Gate

### Task 10: Run release-quality checks

Files:

- Create: docs/audits/v2-habit-icon-animation-audit-2026-06-19.md

Steps:

- [ ] Run focused tests: npm test -- src/components/habit-pictogram/__tests__/V2HabitPictogram.test.tsx src/components/habit-pictogram/__tests__/HabitMotionPlayer.test.tsx scripts/__tests__/validate-habit-icon-assets.test.ts.
- [ ] Run npm run typecheck.
- [ ] Run eslint on changed icon files with max warnings 0.
- [ ] Run npm run check:colors.
- [ ] Run npm run build.
- [ ] Run node scripts/validate-habit-icon-assets.cjs src/assets/habit-icons/v2/manifest.json.
- [ ] Run scoped Snyk code scan on changed icon files and validator script.
- [ ] Run npm audit --audit-level=high and report existing unrelated advisories honestly.
- [ ] Write the audit doc with PASS, PARTIAL, FAIL, evidence, and remaining UNVERIFIED.

Acceptance:

- No final claim is made without fresh command/browser evidence.
- Existing unrelated audit issues are reported, not hidden.

## Done Criteria

- [ ] All 22 habit ids have real source vector stills.
- [ ] Every icon has idle, press, complete, disabled, and reduced states in manifest.
- [ ] Idle loop duration is <= 3000ms.
- [ ] No emoji text is rendered in v2 icon surfaces.
- [ ] No generated/raster icon is used as the final source.
- [ ] Motion pauses offscreen and respects reduced motion.
- [ ] Playwright proof covers full board and real v2 Habits route.
- [ ] Scoped tests, typecheck, lint, color check, build, Snyk, and asset validator pass.
- [ ] npm audit state is reported.
- [ ] User has approved the final visual direction after seeing screenshots or video captures.

## Rollback

- Keep current B62 CSS/SVG mode as fallback.
- If Lottie/Rive runtime causes performance or bundle regressions, remove the runtime package, keep manifest stills, and set renderer priority back to css and still.
- Do not delete current V2HabitPictogram metadata until the new runtime proves parity in tests and screenshots.

## UNVERIFIED Right Now

- Final Lottie/Rive package choice is not made.
- No new runtime dependency has been installed.
- No hand-authored .lottie.json or .riv files exist yet.
- Android/iOS runtime proof is not captured for the future asset runtime.
- Figma/Rive/After Effects desktop apps are not installed locally.

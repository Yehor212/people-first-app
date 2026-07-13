# V2 Habit Lottie From-Scratch Review Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the rejected V2 habit icon pass with original, high-quality, review-first Lottie object models: one complete animated model per habit, no faces, no emoji, no stock icon shortcut, no generic shared motion.

**Architecture:** Keep the existing React/Lottie player and V2 review page, but replace the asset generator and generated assets. The generator becomes the source of truth for original vector geometry, per-habit storyboards, Telegram-grade constraints, reduced-motion SVG fallbacks, and manifest metadata.

**Tech Stack:** React 18, TypeScript, Vite, `lottie-web` SVG renderer, generated JSON Lottie shape layers, generated SVG still fallbacks, Vitest, Playwright/browser proof.

---

### Task 1: Research-Gated Quality Contract

**Files:**
- Modify: `src/components/habit-pictogram/__tests__/V2HabitPictogram.test.tsx`
- Modify: `design/habit-icons/v2/motion-bible.md`
- Modify: `design/habit-icons/v2/source-manifest.json`

- [ ] Add failing tests requiring `zenflow-lottie-atelier-v6`, 60 FPS, <=3s, <=64KB JSON, original source policy, no banned glyph/source words, no text/images/masks/effects/star-shapes, and richer semantic geometry per icon.
- [ ] Run the focused test and confirm the current v5 set fails for the expected reason.
- [ ] Update motion bible/source manifest to describe review-first, from-scratch object-story Lottie models.

### Task 2: Replace The Generator From Scratch

**Files:**
- Replace: `scripts/generate-v2-habit-lottie-atelier.cjs`
- Modify: `package.json`
- Modify: `package-lock.json`

- [ ] Remove SVG-path conversion dependency assumptions from the generator.
- [ ] Generate original vector scenes using only Lottie shape paths, ellipses, rects, fills, strokes, and transforms.
- [ ] Use 512x512, 60 FPS, 180-frame max, seamless loop markers: anticipation, primary-action, follow-through, settle.
- [ ] Encode each habit as its own object story: water fill, footprint cadence, weighted rep, page-turn, breath halo, moon/cloud, elastic band, steam/leaf, egg crack, capsule roll, tooth sweep, sunrise, leaf/dew, notebook ink, gratitude card, breath ribbon, phone lockout, aperture scan, broom sweep, ember/smoke/ban, glass reset, coffee steam.
- [ ] Generate matching reduced SVG stills from the same original model.

### Task 3: Generate And Wire Review Assets

**Files:**
- Modify/generated: `src/assets/habit-icons/v2/**/idle.lottie.json`
- Modify/generated: `src/assets/habit-icons/v2/**/reduced.svg`
- Modify/generated: `src/assets/habit-icons/v2/manifest.json`
- Modify/generated: `src/components/habit-pictogram/habitMotionAssets.ts`
- Modify: `src/pages/__dev/HabitLottieReview.tsx`
- Modify: `src/pages/__dev/HabitLottieReview.css`

- [ ] Delete old generated Lottie assets before generation.
- [ ] Regenerate all 22 icons and still fallbacks.
- [ ] Keep the review page focused on approval: one large selected icon, direct `?icon=<id>` deep links, concise motion notes, no claim of final approval.

### Task 4: Verification And Browser Review

**Files:**
- Output: `output/playwright/v2-habit-lottie-from-scratch-*.json/png/webm`

- [ ] Run focused Vitest contract tests.
- [ ] Run asset validator, JSON parse check, forbidden feature/source scans, eslint, colors, types freshness, npm audit, and scoped Snyk.
- [ ] Run browser proof over all 22 icons: each direct URL loads the requested icon and SVG frames change over time.
- [ ] Open the local review page on the selected icon for user approval.
- [ ] Mark broad unrelated repo failures separately as `UNVERIFIED`; do not call the icon set complete until user visually approves.

## Done Criteria

- [ ] User can inspect every icon on localhost with direct deep links.
- [ ] Each habit has one Lottie JSON and one reduced SVG fallback generated from original geometry.
- [ ] Each icon has unique named object-story geometry and motion, not a shared generic template.
- [ ] Tests and browser proof demonstrate live motion for all 22 icons.
- [ ] User gives explicit visual approval before the goal is considered complete.

## UNVERIFIED Until Review

- Final visual taste and “wow” quality remain unapproved until the user inspects the localhost review.
- Native Android/iOS production rendering remains unverified unless a native smoke is requested after approval.

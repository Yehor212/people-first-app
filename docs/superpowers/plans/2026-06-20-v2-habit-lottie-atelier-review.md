# V2 Habit Lottie Atelier Review Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rebuild the rejected v2 habit Lottie animations from scratch as no-face object-grammar review-grade one-file Lottie models and show them on localhost before production approval.

**Architecture:** Keep reduced SVG fallbacks as the licensed Phosphor still source, remove person/face-like sources, convert real object SVG paths into Lottie shape geometry, and add hand-authored object-specific motion grammars inside each `idle.lottie.json`. Add a dev-only review page that renders all 22 animations, their storyboards, layer contracts, large single-icon inspection, direct `?icon=<id>` links, and approval status without changing storage or user data.

**Tech Stack:** React 18, TypeScript, Vite, lottie-web SVG renderer, hand-authored Lottie JSON, Vitest, Chrome/Playwright browser proof.

---

### Task 1: Research And Quality Contract

**Files:**
- Modify: `src/components/habit-pictogram/__tests__/V2HabitPictogram.test.tsx`
- Create: `src/pages/__dev/__tests__/HabitLottieReview.test.tsx`
- Modify: `.skill-routing-token`, `.test-first-token`, `.preflight-token`

- [x] **Step 1: Verify current Lottie/runtime guidance**
  Use official `lottie-web`, Lottie shape docs, and Google motion guidance.

- [x] **Step 2: Write failing quality tests**
  Require `meta.generator=zenflow-lottie-atelier-v4`, whole-object quality, no face/person sources, real SVG path source geometry, named `animationGrammar`, four timeline markers, 4-8 top-level layers, at least 18 animated channels, and semantic group names.

- [x] **Step 3: Run tests red**
  Run: `npm test -- src/components/habit-pictogram/__tests__/V2HabitPictogram.test.tsx src/pages/__dev/__tests__/HabitLottieReview.test.tsx`
  Expected: FAIL because the rejected pass does not declare the v4 real-path whole-object rig contract.

### Task 2: Generate Review-Grade Lottie Assets

**Files:**
- Create: `scripts/generate-v2-habit-lottie-atelier.cjs`
- Replace: `src/assets/habit-icons/v2/<id>/idle.lottie.json`
- Modify: `src/assets/habit-icons/v2/manifest.json`
- Modify: `src/components/habit-pictogram/habitMotionAssets.ts`

- [x] **Step 1: Delete old animated JSON output**
  Remove every existing `src/assets/habit-icons/v2/<id>/idle.lottie.json` before generation.

- [x] **Step 2: Generate richer timelines**
  Each JSON must be 512x512, 24fps, 72 frames, one asset per habit, real object SVG source path geometry, no face/person source, 4-8 top-level layers, semantic story markers, and logical animation beats.

- [x] **Step 3: Update manifest and runtime metadata**
  Byte counts must match generated files, labels remain emoji-free, renderer remains `lottie`.

### Task 3: Localhost Review Board

**Files:**
- Create: `src/pages/__dev/HabitLottieReview.tsx`
- Create: `src/pages/__dev/HabitLottieReview.css`
- Modify: `src/pages/Index.tsx`

- [x] **Step 1: Render all 22 assets in a dev-only page**
  Route: `/habit-lottie-review?dev=true`. Include all cards, a large single-icon inspection stage, direct `?icon=<id>` links, storyboard text, semantic motion notes, and `awaiting-user-approval` status.

- [x] **Step 2: Keep production clean**
  The page must return `null` outside dev and must not touch storage, auth, sync, or user data.

### Task 4: Verification And Review Handoff

**Files:**
- Output: `output/v2-habit-lottie-atelier-review.png`
- Output: `output/v2-habit-lottie-atelier-review.json`
- Output: `output/playwright/v2-habit-lottie-atelier/*.webm`

- [x] **Step 1: Run focused checks**
  Run tests, asset validator, typecheck, scoped lint, colors.

- [x] **Step 2: Browser review proof**
  Open the localhost route, verify 22 Lottie SVGs, verify zero rejected DOM motion layers, verify frame hashes change for walk and quit-smoking.

- [ ] **Step 3: Stop for user approval**
  Do not mark the goal complete until the user approves the review board or gives final revision notes.

## Done Criteria

- [x] Old animated JSON is replaced from scratch, not patched superficially.
- [x] 22 no-face object-grammar real-path Lottie files meet the new quality contract.
- [x] Localhost review board is available for user approval.
- [x] Browser proof shows logical animation, not static SVG only.
- [ ] Production integration remains review-gated until approval.

## UNVERIFIED

- User approval of the new visual quality is pending until the localhost board is reviewed.
- Native iOS/Android runtime proof is out of scope for the review handoff and remains pending.

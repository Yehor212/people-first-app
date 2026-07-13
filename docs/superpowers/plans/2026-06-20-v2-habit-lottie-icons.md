# V2 Habit Lottie Icons Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the rejected DOM/CSS layered habit icon animation with one high-quality Lottie JSON animation asset per v2 habit icon.

**Architecture:** Keep the existing V2HabitPictogram shell, but move the complete icon artwork and motion playback into a single Lottie asset loaded by HabitMotionPlayer. Reduced motion and missing asset paths fall back to the existing reduced SVG still.

**Tech Stack:** React 18, TypeScript, Vite JSON assets, lottie-web SVG renderer, Vitest, Playwright/Chrome proof.

---

### Task 1: Test The Lottie Contract

**Files:**
- Modify: `src/components/habit-pictogram/__tests__/HabitMotionPlayer.test.tsx`
- Modify: `src/components/habit-pictogram/__tests__/V2HabitPictogram.test.tsx`

- [x] **Step 1: Write failing tests**
  - HabitMotionPlayer must render one `data-habit-lottie-player` for renderer `auto`/`lottie`.
  - V2HabitPictogram must not render `data-telegram-motion-stage=semantic-parts`.
  - Every asset entry must point at `<id>/idle.lottie.json`, renderer `lottie`, duration <= 3000ms, and bytes > 0.

- [ ] **Step 2: Run tests red**
  Run: `npm test -- src/components/habit-pictogram/__tests__/HabitMotionPlayer.test.tsx src/components/habit-pictogram/__tests__/V2HabitPictogram.test.tsx`
  Expected: FAIL because the current implementation still uses CSS metadata / B63 layers.

### Task 2: Add Real Lottie Runtime

**Files:**
- Modify: `package.json`
- Modify: `package-lock.json`
- Modify: `src/components/habit-pictogram/HabitMotionPlayer.tsx`
- Modify: `src/components/habit-pictogram/habitMotionAssets.ts`

- [x] **Step 1: Install runtime**
  Run: `npm install lottie-web@^5.13.0`
  Expected: package and lockfile include MIT Lottie runtime.

- [x] **Step 2: Render Lottie**
  - Load `../../assets/habit-icons/v2/*/idle.lottie.json` with `import.meta.glob`.
  - Load `lottie-web/build/player/lottie_svg` only when motion is allowed and renderer resolves to lottie.
  - Use IntersectionObserver to pause offscreen loops.
  - Render the existing reduced SVG when motion is disabled.

### Task 3: Generate 22 One-Asset Animations

**Files:**
- Create: `src/assets/habit-icons/v2/<id>/idle.lottie.json` for all 22 ids
- Modify: `src/assets/habit-icons/v2/manifest.json`
- Modify: `design/habit-icons/v2/source-manifest.json`
- Modify: `design/habit-icons/v2/motion-bible.md`

- [x] **Step 1: Generate hand-authored Lottie JSON**
  Each JSON must be a single animation file with shape layers for the whole icon story, not DOM parts. Use 72 frames at 24fps, 512x512 composition, vector shapes only.

- [x] **Step 2: Special timelines**
  - `walk-distance`: left/right footfall layers alternate, trail dust and ground impact animate inside the Lottie.
  - `quit-smoking`: cigarette body, ember pulse, smoke curls, ash fall, ban slash animate inside the Lottie.

### Task 4: Remove Rejected B63 Output

**Files:**
- Modify: `src/components/habit-pictogram/V2HabitPictogram.tsx`
- Modify: `src/index.css`
- Modify: tests and design docs above

- [x] **Step 1: Remove semantic DOM layer render**
  Delete `motionParts`, `v2hp-b63__scene`, and B63 CSS as the final implementation.

- [x] **Step 2: Keep still visual quality**
  Preserve the premium glass/shadow treatment through the Lottie composition and the existing reduced SVG fallback; Lottie is the animation asset, not a pile of extra DOM nodes.

### Task 5: Verification

**Files:**
- Output: `output/v2-habit-lottie-proof.png`
- Output: `output/v2-habit-lottie-proof.json`
- Output: `output/playwright/v2-habit-lottie/*.webm`

- [ ] **Step 1: Focused checks**
  Run tests, typecheck, scoped ESLint, colors, and Snyk.

- [ ] **Step 2: Broad checks**
  Run: `npm run check:all`

- [ ] **Step 3: Browser proof**
  Open v2 habits in Chrome, verify Lottie player DOM, verify walk/quit-smoking asset names and Lottie renderer, capture screenshot/video.

## Done Criteria

- [x] 22 `idle.lottie.json` files exist and are referenced from manifest/asset metadata.
- [x] HabitMotionPlayer renders real Lottie runtime for motion-allowed icons.
- [x] No B63 semantic DOM layer stack remains in V2HabitPictogram.
- [x] Reduced motion still uses reduced SVG fallback.
- [ ] Focused tests and `check:all` pass.
- [ ] Browser proof confirms real v2 route behavior.

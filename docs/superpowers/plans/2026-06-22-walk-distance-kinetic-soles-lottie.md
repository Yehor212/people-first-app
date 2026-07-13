# Walk Distance Kinetic Soles Lottie Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a review-gated animated Walk Distance habit icon from the approved kinetic soles concept.

**Architecture:** Generate one self-contained vector Lottie asset and one reduced SVG fallback from a deterministic first-party script. Wire it as a review candidate only; keep normal runtime approval limited to Read and Drink Water.

**Tech Stack:** React 18, TypeScript, Vite, lottie-web SVG renderer, Node asset generator, Vitest contract tests, Playwright/Lottie proof scripts.

---

### Task 1: Contract Test

**Files:**
- Create: `scripts/__tests__/habit-lottie-walk-distance-production.test.ts`

- [x] **Step 1: Write failing test**
- [x] **Step 2: Run test and confirm it fails because Walk production candidate is missing**

### Task 2: Source Brief And Concept

**Files:**
- Create: `design/habit-icons/v2/walk-distance/concept/kinetic-soles-living-path-preview.png`
- Create: `design/habit-icons/v2/walk-distance/production-brief.md`

- [x] **Step 1: Save the approved concept image into the project**
- [x] **Step 2: Record the model, motion grammar, rejects, and acceptance criteria**

### Task 3: Lottie Generator

**Files:**
- Create: `scripts/build-walk-distance-kinetic-soles-lottie.cjs`
- Create: `src/assets/habit-icons/v2/walk-distance/idle.lottie.json`
- Modify: `src/assets/habit-icons/v2/walk-distance/reduced.svg`

- [ ] **Step 1: Generate 512x512 / 60fps / 179-frame vector Lottie**
- [ ] **Step 2: Generate reduced SVG from the same visual language**
- [ ] **Step 3: Record metrics for manifest/runtime metadata**

### Task 4: Runtime Review Wiring

**Files:**
- Modify: `src/assets/habit-icons/v2/manifest.json`
- Modify: `src/components/habit-pictogram/habitMotionAssets.ts`
- Modify: `src/components/habit-pictogram/HabitMotionPlayer.tsx`
- Modify tests as needed for review-candidate state.

- [ ] **Step 1: Add Walk to reviewCandidateLottieIds, not approvedLottieIds**
- [ ] **Step 2: Lazy-load Walk Lottie only when review force-motion exposes it**
- [ ] **Step 3: Keep normal user runtime on reduced fallback until explicit approval**

### Task 5: Proof And Review

**Files:**
- Create: `src/assets/habit-icons/v2/walk-distance/proof/*`
- Update dev review route only if needed for Walk direct inspection.

- [ ] **Step 1: Run focused tests**
- [ ] **Step 2: Generate motion proof frame strip and WebM**
- [ ] **Step 3: Verify local review URL visually in browser**

## UNVERIFIED
- Human visual approval of the new Walk animation remains pending until the user reviews the live route.

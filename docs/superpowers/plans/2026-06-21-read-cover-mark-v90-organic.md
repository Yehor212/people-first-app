# Read Cover Mark V90 Organic Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the Read Lottie cover mark appear from frame 90 and read as an organic painted/embossed detail on the book cover, not a floating sticker.

**Architecture:** Keep the existing reference-derived page-turn rig. Change only the generated Read mark contract: visibility window, layer ordering, visual treatment, metadata, proof text, and tests. Preserve Telegram/TGS constraints.

**Tech Stack:** Node generator, Lottie JSON shape layers, Vitest contract tests, Playwright route proof, Snyk scoped scan.

---

### Task 1: Contract Test
**Files:**
- Modify: `/Users/yehor/Documents/Codex/2026-06-10/new-chat/people-first-app/scripts/__tests__/habit-lottie-read-v9-contract.test.ts`

- [ ] Change visibility expectations from `[108, 150]` to `[90, 150]`.
- [ ] Assert the stamp layer is directly above `Cover Opened` in layer order, not unshifted above page layers.
- [ ] Run `npm test -- scripts/__tests__/habit-lottie-read-v9-contract.test.ts` and expect FAIL before implementation.

### Task 2: Generator
**Files:**
- Modify: `/Users/yehor/Documents/Codex/2026-06-10/new-chat/people-first-app/scripts/build-read-reference-derived-lottie.cjs`

- [ ] Set `COVER_MARK_VISIBILITY_WINDOW` to `[90, 150]`.
- [ ] Insert `ZenFlow static cover stamp` immediately before `Cover Opened` so page layers render above it.
- [ ] Replace pale wash/blob styling with dark-green/antique-gold painted emboss: lower opacity fill, thinner strokes, no app-icon plate, no glow.
- [ ] Update marker duration to 60 frames and metadata visibility window to `[90, 150]`.

### Task 3: Proof Refresh
**Files:**
- Regenerate: `src/assets/habit-icons/v2/read/idle.lottie.json`
- Regenerate: `src/assets/habit-icons/v2/read/proof/*`
- Modify generated manifest: `src/assets/habit-icons/v2/manifest.json`

- [ ] Run generator/export/proof/quality/approval scripts.
- [ ] Visually inspect frame strip: frame 090 starts the mark; 108/126/144 read as cover detail; 162 has no mark.

### Task 4: Review UI And Tests
**Files:**
- Modify: `src/pages/__dev/HabitLottieReview.tsx`
- Modify: `scripts/check-habit-lottie-review-route.cjs`
- Modify focused tests under `scripts/__tests__/habit-lottie-*`

- [ ] Update review-facing text to `frames 90-150` and fresh generated metrics.
- [ ] Run focused Vitest suite.

### Task 5: Verification
- [ ] Run browser route proof for `rev=painted-canonical-cover-mark`.
- [ ] Run Snyk code scan for the generator.
- [ ] Run a static self-check for canonical hash, window, layer order, absence of old app-icon plate, no external assets.

## Done Criteria
- [ ] Mark is visible from frame 90 through 150 only.
- [ ] Mark sits above cover layer but below page layers.
- [ ] No old app-icon plate/rim/highlight exists.
- [ ] TGS remains under 64KB and self-contained.
- [ ] Browser proof passes on desktop and mobile.

## UNVERIFIED
- Legal production rights for `/Applications/telegram-animoji.tgs` remain unverified.

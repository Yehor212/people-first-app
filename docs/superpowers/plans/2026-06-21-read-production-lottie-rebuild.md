# Read Production Lottie Rebuild Implementation Plan

> **Governance update (2026-08-14):** Execute only an explicitly authorized task and do so SOLO. Use `superpowers:executing-plans` only for an approved plan; do not invoke subagents or auto-start the next task. Existing checkboxes are tracking only.

**Goal:** Rebuild the V2 Read habit icon as a cohesive, premium, no-face/no-emoji book page-turn animation using only free tooling and evidence-backed review artifacts.

**Architecture:** Keep the production asset as first-party vector Lottie generated inside the repo, with Telegram `.tgs` as a compressed export and an app-premium Lottie as the main V2 asset. Use the provided `/Applications/telegram-animoji.tgs` only as a quality benchmark for timing, silhouette travel, and motion energy; do not copy or trace its geometry.

**Tech Stack:** Node.js, Lottie JSON shape layers, `lottie-web` SVG rendering, Playwright screenshots/video proof, gzip-based `.tgs` export, Vitest contract tests.

---

### Task 1: Lock The Quality Contract

**Files:**
- Modify: `scripts/__tests__/habit-lottie-read-v9-contract.test.ts`
- Modify: `design/habit-icons/v2/telegram-grade-lottie-production-brief.md`
- Modify: `design/habit-icons/v2/source-manifest.json`

- [ ] **Step 1: Require semantic quality, not only layer count**

The Read contract must assert a cohesive physical book object, no faces/emoji/bitmap/reference geometry, 512x512 60fps self-contained vector format, explicit storyboard markers, and review-only status until human approval.

- [ ] **Step 2: Keep the current quality gate as red evidence**

Run:

```bash
node scripts/check-habit-lottie-quality.cjs --candidate src/assets/habit-icons/v2/read/idle.lottie.json --reference /Applications/telegram-animoji.tgs --out-dir output/habit-lottie-quality/read-current --report output/habit-lottie-quality/read-current/report.json
```

Expected: FAIL because the current candidate has lower motion delta/energy than the reference.

### Task 2: Rebuild The Page-Turn Rig

**Files:**
- Modify: `scripts/generate-v2-habit-read-lottie.cjs`
- Generate: `src/assets/habit-icons/v2/read/idle.lottie.json`
- Generate: `src/assets/habit-icons/v2/read/reduced.svg`
- Modify: `src/assets/habit-icons/v2/manifest.json`

- [ ] **Step 1: Replace the weak blanket page with a staged hinged sheet**

The animation must read as one book at frames 000, 018, 036, 060, 090, 118, 144, and 178. The sheet lifts, curls, crosses the spine, lands, compresses, and loops without becoming a blob.

- [ ] **Step 2: Keep detail subordinate to silhouette**

Use paper stack edges, abstract ink lines, fiber strokes, hinge stitches, fold shade, contact shadow, and glints only where they reinforce the book. No loose decorative shapes, faces, emoji glyphs, or sparkle-only motion.

### Task 3: Generate Review Artifacts

**Files:**
- Generate: `src/assets/habit-icons/v2/read/proof/read-review.tgs`
- Generate: `src/assets/habit-icons/v2/read/proof/read-motion-proof.webm`
- Generate: `src/assets/habit-icons/v2/read/proof/read-frame-strip.png`
- Generate: `src/assets/habit-icons/v2/read/proof/quality-report.json`
- Generate: `src/assets/habit-icons/v2/read/proof/tgs-export-report.json`

- [ ] **Step 1: Generate Lottie and compressed TGS**

Run:

```bash
node scripts/generate-v2-habit-read-lottie.cjs
node scripts/export-habit-lottie-tgs.cjs
```

Expected: `.tgs` round-trips, uses no external assets, and stays under 64KB.

- [ ] **Step 2: Generate proof media**

Run:

```bash
node scripts/capture-habit-lottie-motion-proof.cjs --candidate src/assets/habit-icons/v2/read/idle.lottie.json --out-dir src/assets/habit-icons/v2/read/proof --report src/assets/habit-icons/v2/read/proof/motion-proof.json
node scripts/check-habit-lottie-quality.cjs --candidate src/assets/habit-icons/v2/read/idle.lottie.json --reference /Applications/telegram-animoji.tgs --out-dir src/assets/habit-icons/v2/read/proof --report src/assets/habit-icons/v2/read/proof/quality-report.json
```

Expected: proof video and frame strip render nonblank; quality report records pass/fail honestly.

### Task 4: Update The V2 Review Surface

**Files:**
- Modify: `src/pages/__dev/HabitLottieReview.tsx`
- Modify: `src/pages/__dev/HabitLottieReview.css` only if the proof layout needs responsive repair

- [ ] **Step 1: Remove stale “approved” language**

The screen must show the latest generated metrics from proof artifacts and state that human visual approval is pending.

- [ ] **Step 2: Browser-check the review route**

Inspect `/people-first-app/habit-lottie-review?dev=true&rev=read-rebuild&icon=read`.

Expected: live Lottie renders, proof strip/video links load, and stale metrics do not contradict generated reports.

### Task 5: Verification

**Files:**
- Test: `scripts/__tests__/habit-lottie-read-v9-contract.test.ts`
- Test: `scripts/__tests__/habit-lottie-tgs-export.test.ts`
- Test: `scripts/__tests__/habit-lottie-quality-gate.test.ts`
- Test: `scripts/__tests__/habit-lottie-review-route-proof.test.ts`

- [ ] **Step 1: Run focused tests**

Run:

```bash
npm test -- scripts/__tests__/habit-lottie-read-v9-contract.test.ts scripts/__tests__/habit-lottie-tgs-export.test.ts scripts/__tests__/habit-lottie-quality-gate.test.ts scripts/__tests__/habit-lottie-review-route-proof.test.ts
```

Expected: tests pass or any failure is reported as a real remaining gap.

- [ ] **Step 2: Visual audit**

Inspect `src/assets/habit-icons/v2/read/proof/read-frame-strip.png`, `src/assets/habit-icons/v2/read/proof/read-motion-proof.webm`, and the V2 review route screenshot.

Expected: the asset reads as one book in all sampled frames, not a page blanket, blob set, emoji, or face.

## Done Criteria

- [ ] Free-only toolchain is documented and used.
- [ ] Read app Lottie exists and is self-contained.
- [ ] Telegram `.tgs` export exists and passes the hard Telegram contract.
- [ ] Proof video, frame strip, quality report, and TGS report are generated from the current asset.
- [ ] Review route is honest: review-only until human visual approval.
- [ ] Remaining uncertainty is explicitly marked `UNVERIFIED`, not called `PASS`.

# Read Original Lottie Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the Read review candidate with one original, from-scratch, cohesive book Lottie that shows a real page-turn loop on localhost before user approval.

**Architecture:** Generate a self-contained 512x512 vector Lottie from first-party code, not by copying or tracing the supplied `.tgs`. Keep production gated: the new Read asset remains a review candidate, all other habit icons stay locked, and proof artifacts are regenerated for visual inspection.

**Tech Stack:** React 18 dev review page, lottie-web SVG renderer, Node asset generator, Vitest, Playwright proof capture, Snyk static scan.

---

### Task 1: Lock The From-Scratch Contract

**Files:**
- Modify: `src/components/habit-pictogram/__tests__/V2HabitPictogram.test.tsx`
- Modify: `src/pages/__dev/__tests__/HabitLottieReview.test.tsx`

- [ ] **Step 1: Add failing tests**

Assert that the Read asset source is original, has no `referenceVariant`, the Lottie metadata uses `zenflow-read-original-book-atelier-v1`, and the review page shows one original Read candidate rather than A/B rig choices.

- [ ] **Step 2: Run the tests red**

Run:

```bash
npx vitest run --configLoader bundle src/components/habit-pictogram/__tests__/V2HabitPictogram.test.tsx src/pages/__dev/__tests__/HabitLottieReview.test.tsx --testNamePattern "original|from-scratch|A/B" --reporter=verbose --pool=vmThreads --maxWorkers=1
```

Expected: FAIL because the current implementation still exposes `reference-rig` / A/B language.

### Task 2: Generate The Original Read Book

**Files:**
- Replace: `scripts/generate-v2-habit-read-lottie.cjs`
- Modify: `src/assets/habit-icons/v2/manifest.json`
- Replace: `src/assets/habit-icons/v2/read/idle.lottie.json`
- Replace: `src/assets/habit-icons/v2/read/reduced.svg`
- Remove: `src/assets/habit-icons/v2/read/reference-rig.lottie.json`

- [ ] **Step 1: Build a first-party Lottie model**

The generator must create layered book covers, page stacks, spine, bookmark bead, multiple animated turning page sheets, moving page text strokes, trim-path glints, paper shadows, and loop-settle markers.

- [ ] **Step 2: Update manifest**

Read stays a review candidate and rejected/unapproved for production, but source/license become original first-party review candidate, not supplied-rig adaptation.

- [ ] **Step 3: Run generator**

Run:

```bash
node scripts/generate-v2-habit-read-lottie.cjs
```

Expected: creates `idle.lottie.json`, `reduced.svg`, updates manifest, and does not recreate `reference-rig.lottie.json`.

### Task 3: Refresh Localhost Review

**Files:**
- Modify: `src/pages/__dev/HabitLottieReview.tsx`
- Modify: `src/pages/__dev/HabitLottieReview.css`

- [ ] **Step 1: Replace A/B page copy**

Show one original Read candidate, original-source status, frame/storyboard proof, and explicit approval lock.

- [ ] **Step 2: Keep the queue locked**

All other icons remain blocked until the Read model receives user approval.

### Task 4: Regenerate Proof And Verify

**Files:**
- Replace: `src/assets/habit-icons/v2/read/proof/*`
- Create/update: `output/habit-lottie-review/*`

- [ ] **Step 1: Capture motion proof**

Run:

```bash
node scripts/capture-habit-lottie-motion-proof.cjs --candidate src/assets/habit-icons/v2/read/idle.lottie.json --out-dir src/assets/habit-icons/v2/read/proof --report src/assets/habit-icons/v2/read/proof/motion-proof.json
```

- [ ] **Step 2: Run quality gate**

Run:

```bash
node scripts/check-habit-lottie-quality.cjs --candidate src/assets/habit-icons/v2/read/idle.lottie.json --reference /Applications/telegram-animoji.tgs --report src/assets/habit-icons/v2/read/proof/quality-report.json
```

- [ ] **Step 3: Browser proof**

Open `/people-first-app/habit-lottie-review?dev=true&rev=original-read&icon=read`, confirm one original live Lottie, no reference-rig text, locked queue, and save screenshot/JSON evidence.

### Done Criteria

- [ ] The visible Read candidate is original from-scratch, not copied/traced from the `.tgs`.
- [ ] The animation reads as one book with real page-turn phases, not blobs, emoji, faces, float/pulse, or slab sheets.
- [ ] The localhost review page shows the model before approval.
- [ ] Tests, lint/type, Snyk, quality gate, proof capture, and browser proof are fresh.
- [ ] Goal remains active until user approves Read and the rest of the habit set is produced one icon at a time.

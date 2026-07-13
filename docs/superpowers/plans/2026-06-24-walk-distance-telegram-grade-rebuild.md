# Walk Distance Telegram-Grade Rebuild Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a Walk Distance animated sticker/habit asset that can credibly stand next to the user-approved Telegram book reference, and fail closed until visual, technical, and runtime evidence all pass.

**Architecture:** Do not start with Blender, PNG, APNG, or procedural 3D renders. Use a vector-first production pipeline: benchmark the Telegram book `.tgs`, design one clean 512x512 still-frame in the same sticker grammar, build a layered vector rig, export `.lottie.json` and `.tgs`, render proof frames, and only integrate after gates pass.

**Tech Stack:** Telegram `.tgs`/Lottie JSON, Glaxnimate 0.6.0 CLI, Inkscape 1.4.3, optional Adobe After Effects + Bodymovin-TG official production export, Node audit/render scripts, lottie-web SVG renderer, Playwright browser proof, sharp image metrics.

---

## Hard Constraints

- Reference source: `/Users/yehor/Downloads/telegram-animoji.tgs`.
- Target: `walk-distance`, sneaker/step/road theme.
- Canvas: exactly 512x512.
- FPS: 60.
- Duration: 179 frames / under 3 seconds.
- Output `.tgs`: under 64 KB.
- No raster images, masks, text layers, layer effects, solids, 3D layers, expressions, merge paths, star shapes, gradient strokes, repeaters, time remap/stretch, or auto-oriented layers.
- No runtime integration while `productionApproved` is false.
- No claim of quality parity without side-by-side proof against the book reference.

## Current Failure Evidence

- Previous Blender review package is rejected: it is a 3D render proof, not Telegram-style vector sticker work.
- Existing v12 candidate has useful infrastructure but fails the current quality gate:
  - lower path/stroke density than the book;
  - weaker frame motion delta;
  - much higher semi-transparent pixel mass;
  - bbox width exceeds the book envelope;
  - edge density is too high/noisy;
  - visual read is busy, sketchy, and not clean like the book.

## File Structure

- Create: `scripts/audit-telegram-grade-lottie.cjs`
  - Single strict auditor for `.lottie.json` or `.tgs`.
  - Emits spec metrics, visual metrics, reference comparison, pass/fail reasons.
- Create: `output/walk-distance-telegram-grade-v13/`
  - Workbench output only; not app runtime.
- Create: `output/walk-distance-telegram-grade-v13/still-frame/`
  - Still-frame candidates and rejected/accepted audit notes.
- Create: `output/walk-distance-telegram-grade-v13/rig/`
  - Source `.lottie.json`, `.tgs`, Glaxnimate exports if used.
- Create: `output/walk-distance-telegram-grade-v13/proof/`
  - Rendered frames, motion strip, side-by-side book comparison, browser screenshot, audit reports.
- Modify only after approval: `src/assets/habit-icons/v2/walk-distance/idle.lottie.json`, `src/assets/habit-icons/v2/manifest.json`, and habit motion wiring.

## Task 1: Build The Brutal Quality Gate

**Files:**
- Create: `scripts/audit-telegram-grade-lottie.cjs`
- Create output reports under `output/walk-distance-telegram-grade-v13/audit/`

- [ ] **Step 1: Implement input loader**

Accept:

```bash
node scripts/audit-telegram-grade-lottie.cjs \
  --candidate output/walk-distance-v12-hero-runner-final-candidate/walk-distance-v12-hero-runner-final-candidate.tgs \
  --reference /Users/yehor/Downloads/telegram-animoji.tgs \
  --out output/walk-distance-telegram-grade-v13/audit/v12-audit.json
```

Required behavior:
- detect `.tgs` and gunzip it;
- detect `.json` and parse directly;
- calculate bytes, gzip bytes, canvas, fps, duration, layer count, shape records, paths, strokes, trim paths, gradient fills, animated channel count;
- detect forbidden features and fail on any presence.

- [ ] **Step 2: Add visual-frame metrics**

Render frames `0,20,45,72,105,135,165` for candidate and reference, then calculate:
- silhouette percentage;
- semi-transparent percentage;
- edge density;
- bounding box;
- per-frame diff percentage;
- average luma standard deviation.

- [ ] **Step 3: Add strict pass/fail thresholds**

Gate must fail a candidate if:
- technical Telegram spec fails;
- forbidden feature exists;
- gzip is over 64 KB;
- candidate paths are below 0.85x reference paths;
- candidate strokes are below 0.75x reference strokes unless visual reviewer overrides in writing;
- candidate average semi-transparent percentage is over 3x reference;
- bbox touches canvas edge on any proof frame;
- average edge density is over 1.6x reference;
- motion diff is under 0.80x reference unless the storyboard explicitly proves a different but complex motion.

- [ ] **Step 4: Run the gate against v12**

Expected: FAIL, with explicit reasons matching the visible defects.

## Task 2: Lock The Visual Grammar Before Animation

**Files:**
- Create: `output/walk-distance-telegram-grade-v13/still-frame/brief.md`
- Create: `output/walk-distance-telegram-grade-v13/still-frame/still-frame-gate.json`
- Create: `output/walk-distance-telegram-grade-v13/still-frame/book-vs-still.png`

- [ ] **Step 1: Define the one-frame target**

Target still-frame must look like a clean Telegram sticker object:
- one readable sneaker or compact pair, not a busy pile;
- thick, confident silhouette comparable to the book cover/pages;
- limited palette: book-like blue/white/gray plus one sneaker accent;
- no sketchy thin clutter;
- no transparent shadow soup;
- no floating decorative marks unless they explain motion;
- clear toe, heel, sole, lace area, tread, and contact shadow.

- [ ] **Step 2: Produce 4 still-frame candidates**

Use available tools in this order:
1. hand/vector generation in Lottie/SVG paths;
2. Inkscape for source inspection/export if needed;
3. image generation only as reference art, not final runtime asset.

- [ ] **Step 3: Reject all but one**

Compare each still against the book reference at 512px and reject candidates that fail silhouette clarity, cleanliness, and Telegram sticker grammar.

## Task 3: Build The Vector Rig

**Files:**
- Create: `output/walk-distance-telegram-grade-v13/rig/walk-distance-v13.lottie.json`
- Create: `output/walk-distance-telegram-grade-v13/rig/walk-distance-v13.tgs`
- Create: `output/walk-distance-telegram-grade-v13/rig/rig-notes.md`

- [ ] **Step 1: Build layer model**

Minimum rig parts:
- road/contact base;
- outsole;
- midsole;
- upper;
- heel tab;
- toe cap;
- lace/tongue group;
- tread/contact squash group;
- optional second shoe only if it improves readability.

- [ ] **Step 2: Animate complex motion**

Minimum motion phases:
- contact squash;
- heel lift;
- toe roll;
- step transfer;
- road slide;
- lace/tongue secondary follow-through;
- shadow compression;
- perfect loop settle back to frame 0.

- [ ] **Step 3: Export `.tgs`**

Use Glaxnimate CLI first:

```bash
/Applications/glaxnimate.app/Contents/MacOS/glaxnimate \
  output/walk-distance-telegram-grade-v13/rig/walk-distance-v13.lottie.json \
  --export output/walk-distance-telegram-grade-v13/rig/walk-distance-v13.tgs \
  --export-format tgs
```

If After Effects becomes available, use Bodymovin-TG as the official final exporter and keep Glaxnimate output as cross-check.

## Task 4: Proof Package

**Files:**
- Create: `output/walk-distance-telegram-grade-v13/proof/frames/*`
- Create: `output/walk-distance-telegram-grade-v13/proof/book-vs-walk-v13.png`
- Create: `output/walk-distance-telegram-grade-v13/proof/motion-proof.webm` if video tooling is available
- Create: `output/walk-distance-telegram-grade-v13/proof/review.html`
- Create: `output/walk-distance-telegram-grade-v13/proof/final-audit.json`

- [ ] **Step 1: Render proof frames**

Render at least frames:
`0,12,20,36,45,60,72,90,105,120,135,150,165,178`.

- [ ] **Step 2: Build comparison board**

Board must show:
- Telegram book frames;
- v13 frames;
- metrics summary;
- explicit pass/fail.

- [ ] **Step 3: Browser proof**

Open local review page and capture screenshot/JSON evidence:
- no console errors;
- SVG renderer active;
- animation loops;
- no blank frames.

## Task 5: Integration Gate

**Files:**
- Modify only after human approval:
  - `src/assets/habit-icons/v2/walk-distance/idle.lottie.json`
  - `src/assets/habit-icons/v2/walk-distance/reduced.svg`
  - `src/assets/habit-icons/v2/manifest.json`
  - `src/components/habit-pictogram/habitMotionAssets.ts`

- [ ] **Step 1: Keep candidate outside runtime**

Do not copy v13 into `src` unless the user approves the proof board.

- [ ] **Step 2: If approved, integrate with tests**

Run focused tests for:
- manifest approval state;
- walk asset loading;
- no raster fallback;
- app build/typecheck.

## Done Criteria

- [ ] Still-frame approval gate passed against the book reference.
- [ ] `.lottie.json` and `.tgs` exist.
- [ ] `.tgs` is under 64 KB.
- [ ] No forbidden Telegram features are detected.
- [ ] Proof frames render at 512x512.
- [ ] Side-by-side board does not show obvious lower craft than the book.
- [ ] Browser preview renders without console errors.
- [ ] User visually approves before runtime integration.

## UNVERIFIED

- Adobe After Effects + Bodymovin-TG production export is unavailable until After Effects is installed and signed in.
- Human visual approval is not satisfied by metrics alone.
- A candidate can pass structural gates and still fail taste; final decision must include side-by-side visual inspection.

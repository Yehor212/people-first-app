# Walk Distance Model Integrity Gate Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the walk-distance sneaker sticker pass a stricter Telegram-grade model test where the shoes read as one intentional object, with no detached or popping heel/sole parts.

**Architecture:** Keep production app code untouched for this pass. Build and evaluate isolated Lottie/TGS artifacts under `output/walk-distance-telegram-grade-v109-model-integrity-pass/`, using the existing v108 release as input and the Telegram book sticker as the motion/complexity reference.

**Tech Stack:** Lottie JSON, `.tgs` gzip, `lottie-web` SVG rendering, Playwright screenshots, Sharp pixel analysis, static ffmpeg preview export, existing Telegram/TGS validation commands.

---

### Task 1: Define The New Failure Gate

**Files:**
- Read: `output/walk-distance-telegram-grade-v108-stabilized-road-rig/release/walk-distance-v108-telegram-sticker-final.lottie.json`
- Create: `output/walk-distance-telegram-grade-v109-model-integrity-pass/audit/model-integrity-v108-baseline.json`
- Create: `output/walk-distance-telegram-grade-v109-model-integrity-pass/audit/model-integrity-v108-baseline-board.png`

- [ ] **Step 1: Render shoe-only frames**

Run a local render that filters to layers whose names contain `shoe`, excluding `road`, `shadow`, `impact`, and `footprint`. Render frames `0,20,45,72,105,135,165` plus the full 30fps preview sequence.

- [ ] **Step 2: Measure model integrity**

For each shoe-only frame, record visible bounding box, visible area, large detached pixel islands, right/left/top/bottom edge jumps, and frame-to-frame silhouette delta.

- [ ] **Step 3: Fail the known v108 defects**

Expected result: v108 must be marked `FAIL` if frames around `45`, `105`, or `135` show a tail/heel/sole extension that moves farther than the median silhouette boundary by the configured threshold.

### Task 2: Build The Next Model Pass

**Files:**
- Read: `output/walk-distance-telegram-grade-v108-stabilized-road-rig/release/walk-distance-v108-telegram-sticker-final.lottie.json`
- Create: `output/walk-distance-telegram-grade-v109-model-integrity-pass/rig/walk-distance-v109-model-integrity-pass.lottie.json`
- Create: `output/walk-distance-telegram-grade-v109-model-integrity-pass/rig/walk-distance-v109-model-integrity-pass.tgs`
- Create: `output/walk-distance-telegram-grade-v109-model-integrity-pass/rig/walk-distance-v109-generation-report.json`

- [ ] **Step 1: Preserve the approved direction**

Keep the blue/cyan/yellow sneaker language, paired walking composition, pale road contact, shadows, and Telegram-sized 512x512 framing.

- [ ] **Step 2: Rework the weak model zones**

Clamp or remodel the unstable heel/back/sole contour on the rear shoe and front shoe so the silhouette stays smooth across frames. Reduce sharp tail spikes, make heel counters rounded and attached, keep the sole as a controlled curved band, and avoid thin isolated fragments.

- [ ] **Step 3: Keep motion secondary to model integrity**

Do not add more moving decoration until the base sneaker shape passes the model gate. The walk can still lift, squash, and shift, but the object must remain visually coherent at every sampled frame.

### Task 3: Verify Release Quality

**Files:**
- Create: `output/walk-distance-telegram-grade-v109-model-integrity-pass/release/walk-distance-v109-telegram-sticker-final.lottie.json`
- Create: `output/walk-distance-telegram-grade-v109-model-integrity-pass/release/walk-distance-v109-telegram-sticker-final.tgs`
- Create: `output/walk-distance-telegram-grade-v109-model-integrity-pass/release/v109-final-contact-sheet.png`
- Create: `output/walk-distance-telegram-grade-v109-model-integrity-pass/release/walk-distance-v109-animation-preview.mp4`
- Create: `output/walk-distance-telegram-grade-v109-model-integrity-pass/release/walk-distance-v109-animation-preview.gif`

- [ ] **Step 1: Format check**

Verify `512x512`, `60fps`, `<=180` frames, no raster assets, no expressions, no masks, no text layers, no external assets, and `.tgs <= 64KB`.

- [ ] **Step 2: Visual integrity check**

Run the new shoe-only gate against v109. Expected result: no large detached islands, no boundary spike at frames `45`, `105`, `135`, no canvas edge touch, and no abrupt silhouette jitter.

- [ ] **Step 3: Reference comparison**

Run the existing book comparison audit so v109 still has enough motion/detail and does not regress into a static PNG-like sticker.

- [ ] **Step 4: Human-facing proof**

Export a contact sheet and MP4/GIF preview from the actual v109 Lottie/TGS cycle. Mark Telegram iPhone import as `UNVERIFIED` until tested on device.

## Done Criteria

- [ ] v108 baseline report explains why the current model fails.
- [ ] v109 `.tgs` exists and is under Telegram size limits.
- [ ] v109 passes the model-integrity gate.
- [ ] v109 has contact sheet plus video/GIF preview generated from the final animation.
- [ ] Remaining unverified items are listed explicitly.

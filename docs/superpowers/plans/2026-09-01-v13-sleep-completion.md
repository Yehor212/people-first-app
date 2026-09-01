# V13 Sleep Completion Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship a smooth Android `sleep` habit completion TGS derived from the approved V12 bedtime bear, with an integrated night cap and canonical ZenFlow leaf badge, at no more than 64,000 bytes.

**Architecture:** Preserve the exact V12 TGS as a hash-bound immutable input. A deterministic Node generator injects a semantic cap layer that reuses the bear layer transform, writes the compact V13 TGS, and records the final hash and size. The existing Android-only habit-celebration runtime registers `sleep`; every non-Android, reduced-motion, low-power, cancellation, and failure path keeps the current static sleep pictogram.

**Tech Stack:** Node.js, gzip Lottie/TGS JSON, TypeScript, Vitest, Glaxnimate, rlottie, lottie-web, React 18, Vite, Capacitor 8.

**Spec:** `docs/superpowers/specs/2026-09-01-global-recovery-convergence-v12-design.md`

## Global Constraints

- Final compressed TGS size is at most 64,000 bytes.
- Canvas is 512 by 512, 60 FPS, `ip=0`, `op=180`, vector-only, and exact-loop.
- V12 base SHA-256 is `a98ebb8bf4ec8b0d39590b421f8cd9311e03af8a4c88a3a90ade4e1dceeb9309` and size is 63,207 bytes.
- `LEAF_BODY` and `LEAF_STEM` remain byte-equivalent to `scripts/generate-icons.cjs`.
- The logo is one green circular medallion with a light canonical leaf; no alternate silhouette, raster image, SVG filter, glow, mask, text, expression, or external asset.
- Do not enable the disabled idle-Lottie runtime.
- Do not alter existing celebration assets or their hashes.
- V13 artistic/model/motion approval remains `UNVERIFIED` until the user reviews the exact V13 MP4.

---

### Task 1: Lock the V13 generator contract RED

**Files:**
- Create: `scripts/__tests__/generate-sleep-v13-celebration.test.ts`
- Read: `scripts/generate-icons.cjs`
- Read: `src/components/habit-pictogram/habitTgsRuntime.ts`

**Interfaces:**
- Consumes: canonical `LEAF_BODY`, `LEAF_STEM`, and exact approved V12 bytes.
- Produces: the failing contract for `buildSleepV13({ baseTgs, outputTgs })`.

- [ ] **Step 1: Add the generator contract test**

```ts
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { gunzipSync } from "node:zlib";
import { describe, expect, it } from "vitest";

import {
  CANONICAL_LEAF_BODY,
  CANONICAL_LEAF_STEM,
  buildSleepV13,
} from "../generate-sleep-v13-celebration.cjs";

const BASE = "design/habit-icons/sleep/v12-approved-base.tgs";

describe("sleep V13 completion generator", () => {
  it("preserves V12 and builds one compact semantic night-cap layer", () => {
    const before = readFileSync(BASE);
    const result = buildSleepV13({ baseTgs: BASE });
    const animation = JSON.parse(gunzipSync(result.bytes).toString("utf8"));

    expect(createHash("sha256").update(before).digest("hex")).toBe(
      "a98ebb8bf4ec8b0d39590b421f8cd9311e03af8a4c88a3a90ade4e1dceeb9309",
    );
    expect(result.bytes.byteLength).toBeLessThanOrEqual(64_000);
    expect(animation).toMatchObject({ w: 512, h: 512, fr: 60, ip: 0, op: 180 });
    expect(result.facts).toMatchObject({
      hardPoseCuts: 0,
      crossfades: 0,
      canonicalLeafBody: CANONICAL_LEAF_BODY,
      canonicalLeafStem: CANONICAL_LEAF_STEM,
    });
    expect(readFileSync(BASE)).toEqual(before);
  });
});
```

- [ ] **Step 2: Run the focused test and record RED**

Run: `npx vitest run scripts/__tests__/generate-sleep-v13-celebration.test.ts --maxWorkers=1`

Expected: FAIL because `scripts/generate-sleep-v13-celebration.cjs` and the immutable V12 input do not exist in the repository.

- [ ] **Step 3: Record the RED evidence in `.preflight-token`**

The fresh token names the expected V13 behavior, the risk of logo drift or a size overflow, the exact RED command, and the focused plus blast-radius verification plan.

### Task 2: Build the deterministic V13 asset generator

**Files:**
- Create: `design/habit-icons/sleep/v12-approved-base.tgs`
- Create: `scripts/generate-sleep-v13-celebration.cjs`
- Modify: `scripts/__tests__/generate-sleep-v13-celebration.test.ts`

**Interfaces:**
- Consumes: `buildSleepV13({ baseTgs: string }): { bytes: Buffer; animation: object; facts: SleepV13Facts }`.
- Produces: deterministic compressed V13 bytes and machine-readable facts.

- [ ] **Step 1: Preserve the exact V12 input**

Copy only the hash-verified file
`/Users/yehor/.codex/visualizations/2026/08/30/people-first-bedtime-organic-v3/out/contact-v12-high-detail-smooth/bedtime-bear-contact-v12-high-detail-smooth.tgs`
to `design/habit-icons/sleep/v12-approved-base.tgs`, then verify its SHA-256 and exact 63,207-byte size.

- [ ] **Step 2: Implement the generator exports**

```js
const CANONICAL_LEAF_BODY =
  "M11 20A7 7 0 0 1 9.8 6.1C15.5 5 17 4.48 19 2c1 2 2 4.18 2 8 0 5.5-4.78 10-10 10Z";
const CANONICAL_LEAF_STEM =
  "M2 21c0-3 1.85-5.36 5.08-6C9.5 14.52 12 13 13 12";

function buildSleepV13({ baseTgs }) {
  const baseBytes = readFileSync(baseTgs);
  assertExactV12(baseBytes);
  const animation = JSON.parse(gunzipSync(baseBytes).toString("utf8"));
  const bearLayer = animation.layers.find((layer) => layer.refId === "v8q24_sleep_bear");
  if (!bearLayer) throw new Error("sleep-v13-missing-bear-layer");
  animation.assets.push(makeNightCapAsset());
  animation.layers.splice(
    animation.layers.indexOf(bearLayer),
    0,
    makeNightCapLayer(structuredClone(bearLayer.ks)),
  );
  const bytes = gzipSync(Buffer.from(JSON.stringify(animation)), { level: 9, mtime: 0 });
  assertV13Contract(animation, bytes);
  return { bytes, animation, facts: collectV13Facts(animation, bytes) };
}
```

`makeNightCapAsset()` creates only vector shape layers: deep night-blue cap body, light trim, light pom, one green badge circle, canonical light leaf body, and canonical light leaf stem. `makeNightCapLayer()` uses the bear transform and an exact 180-frame lifetime.

- [ ] **Step 3: Bind the canonical logo source**

Extend the test to read `scripts/generate-icons.cjs` and assert that its literal `LEAF_BODY` and `LEAF_STEM` values equal the generator exports. Do not modify the canonical logo generator.

- [ ] **Step 4: Add negative contracts**

Test that the generator rejects a changed V12 hash, output larger than 64,000 bytes, raster/text/expression/mask/effect content, wrong dimensions/FPS/frame range, missing bear transform, multiple logo badges, or a noncanonical leaf path.

- [ ] **Step 5: Run GREEN**

Run: `npx vitest run scripts/__tests__/generate-sleep-v13-celebration.test.ts --maxWorkers=1`

Expected: all generator, immutability, logo, Telegram, and negative-path tests PASS.

- [ ] **Step 6: Commit the generator unit**

```bash
git add design/habit-icons/sleep/v12-approved-base.tgs scripts/generate-sleep-v13-celebration.cjs scripts/__tests__/generate-sleep-v13-celebration.test.ts
git commit -m 'feat: build compact V13 sleep celebration'
```

### Task 3: Generate and validate the production asset

**Files:**
- Create: `src/assets/habit-icons/v2/sleep/completion.tgs`
- Create: `src/assets/habit-icons/v2/sleep/completion-first-frame.svg`
- Create: `docs/ai/visual-quality/proofs/sleep-v13-night-cap.json`
- Create: `docs/ai/visual-quality/evidence/sleep-v13-night-cap-preview.mp4`
- Create: `docs/ai/visual-quality/evidence/sleep-v13-night-cap-contact-sheet.png`

**Interfaces:**
- Consumes: the deterministic generator and exact V12 input.
- Produces: hash-bound runtime TGS, inert SVG poster, MP4, frame board, and proof packet.

- [ ] **Step 1: Generate V13**

Run:

```bash
node scripts/generate-sleep-v13-celebration.cjs \
  --base design/habit-icons/sleep/v12-approved-base.tgs \
  --output src/assets/habit-icons/v2/sleep/completion.tgs \
  --manifest docs/ai/visual-quality/proofs/sleep-v13-night-cap.json
```

Expected: deterministic output at most 64,000 bytes with final SHA-256 and V12 provenance recorded.

- [ ] **Step 2: Render frame zero and all motion evidence**

Use `/Users/yehor/bin/glaxnimate` for the first-frame SVG and frame sequence, the pinned local rlottie renderer for cross-engine frames, and the existing lottie-web proof route for browser rendering. Encode the exact frame sequence to the committed MP4 and generate a representative contact sheet.

- [ ] **Step 3: Verify cap and logo structure**

Assert one night-cap asset, one green circular badge, one canonical leaf body, one canonical leaf stem, and a cap layer whose transform equals the bear transform. Reject duplicated logos, detached motion, and any forbidden feature.

- [ ] **Step 4: Verify smoothness and exact loop**

Render all 180 frames. Require 179 changed adjacent pairs, maximum consecutive RGBA MAE no worse than the V12 technical ceiling `0.65`, and pixel-identical frames 0 and 179.

- [ ] **Step 5: Run the Visual Integrity Critic**

Compare V13 against the approved V8 preview and V12 base for silhouette, face readability, cap attachment, fabric integration, badge readability, motion continuity, contact, palette, and cheap-overlay artifacts. Persist the report in the proof packet and keep human/artistic status `UNVERIFIED` until the user reviews the exact MP4.

- [ ] **Step 6: Commit the generated proof unit**

```bash
git add src/assets/habit-icons/v2/sleep/completion.tgs src/assets/habit-icons/v2/sleep/completion-first-frame.svg docs/ai/visual-quality/proofs/sleep-v13-night-cap.json docs/ai/visual-quality/evidence/sleep-v13-night-cap-preview.mp4 docs/ai/visual-quality/evidence/sleep-v13-night-cap-contact-sheet.png
git commit -m 'feat: add V13 sleep celebration proof batch'
```

### Task 4: Register sleep completion without enabling idle Lottie

**Files:**
- Modify: `src/components/habit-pictogram/habitCelebrationAssets.ts`
- Modify: `src/components/habit-pictogram/__tests__/habitCelebrationAssets.test.ts`
- Modify: `src/components/habit-pictogram/__tests__/HabitMotionPlayer.test.tsx`
- Modify: `src/pages/nav-v2/habits/hero/__tests__/HeroWeeklyHabitCard.test.tsx`

**Interfaces:**
- Consumes: `sleep/completion.tgs` and `sleep/completion-first-frame.svg`.
- Produces: `getHabitCelebrationAsset("sleep")` and Android completion playback through the existing runtime.

- [ ] **Step 1: Add the RED runtime registration expectations**

```ts
expect([...APPROVED_HABIT_CELEBRATION_IDS].sort()).toContain("sleep");
expect(getHabitCelebrationAsset("sleep")?.day).toContain("sleep/completion.tgs");
expect(getHabitCelebrationAsset("sleep")?.poster.day).toContain(
  "sleep/completion-first-frame.svg",
);
expect(HABIT_LOTTIE_RUNTIME_ENABLED).toBe(false);
```

Also assert that completing `sleep` on Android shows the poster immediately,
starts one bounded TGS playback, and reduced motion leaves the poster/static
outcome without constructing Lottie.

- [ ] **Step 2: Run RED**

Run: `npx vitest run src/components/habit-pictogram/__tests__/habitCelebrationAssets.test.ts src/components/habit-pictogram/__tests__/HabitMotionPlayer.test.tsx src/pages/nav-v2/habits/hero/__tests__/HeroWeeklyHabitCard.test.tsx --maxWorkers=1`

Expected: FAIL because `sleep` is not registered.

- [ ] **Step 3: Register the exact asset**

Import the sleep TGS and poster URLs, add a `singleVariant(...)` record with the generated hashes, and leave `HABIT_LOTTIE_RUNTIME_ENABLED = false` unchanged.

- [ ] **Step 4: Run GREEN and blast-radius checks**

Run the same focused command, followed by:

```bash
npx vitest run src/components/habit-pictogram --maxWorkers=1
npm run typecheck
npm run build
```

- [ ] **Step 5: Commit runtime registration**

```bash
git add src/components/habit-pictogram/habitCelebrationAssets.ts src/components/habit-pictogram/__tests__/habitCelebrationAssets.test.ts src/components/habit-pictogram/__tests__/HabitMotionPlayer.test.tsx src/pages/nav-v2/habits/hero/__tests__/HeroWeeklyHabitCard.test.tsx
git commit -m 'feat: play V13 for Android sleep completion'
```

### Task 5: Verify native, visual, security, and handoff boundaries

**Files:**
- Modify: `.verification-done` only as ignored local evidence.
- Review: all branch changes.

**Interfaces:**
- Consumes: completed V13 implementation and proof packet.
- Produces: exact test counts, platform statuses, security evidence, and a clean pushed branch receipt.

- [ ] **Step 1: Run focused asset and logo checks**

```bash
npx vitest run scripts/__tests__/generate-sleep-v13-celebration.test.ts src/components/habit-pictogram/__tests__/habitCelebrationAssets.test.ts src/components/habit-pictogram/__tests__/HabitMotionPlayer.test.tsx src/pages/nav-v2/habits/hero/__tests__/HeroWeeklyHabitCard.test.tsx --maxWorkers=1
npm run assets:logos:check
npm run assets:logos:proof
npm run check:visual
```

- [ ] **Step 2: Run repository gates**

```bash
npm run typecheck
npm test -- --maxWorkers=4
npm run check:production-data-integrity:diff
npm run check:no-ai-templates
npm run check:best-practices
npm run check:agent-context
npm run build
npm run check:production-data-integrity:bundle
```

- [ ] **Step 3: Run Android evidence**

Build and install the debug APK on the API 36 arm64 emulator, complete the
built-in `sleep` habit, capture UI-tree/screenshot/logcat evidence, and collect
frame timing. Confirm hardware back, resume, reduced motion, failure fallback,
and no duplicate playback.

- [ ] **Step 4: Run security scans**

Run the available Snyk Code path or mark it `UNVERIFIED`, then run
`/Users/yehor/.codex/bin/codex-security-suite.sh` with the narrowest repository
profile covering changed JavaScript/TypeScript, TGS/SVG assets, and scripts.

- [ ] **Step 5: Review final diff and record evidence**

Confirm no secrets, environment files, generated caches, external images,
noncanonical leaf geometry, mock production data, or unrelated changes entered
the branch. Write `.verification-done` with exact counts, `confidence`,
`git_history_checked`, and skipped-tool reasons.

- [ ] **Step 6: Push and hand off**

Push the same-named `codex/` branch without force, run
`npm run agent:workspace -- handoff --json`, create a protected pull request,
and merge only after required checks and exact V13 human review are satisfied.


# Android Persistent Orb Renderer Implementation Plan

Execution status: `STOP_PORTAL_REPARENT`. candidates29–31 are `REJECTED`.
Low-level same-context resize and particle reprojection remain source/test
verified behind the unchanged default `recreate` policy, but the portal owner
was removed from production integration. A unified same-parent layout needs a
new reviewed design before execution continues.

> **For agentic workers:** REQUIRED SUB-SKILL: Use `superpowers:executing-plans` to implement this plan task-by-task. Execution is SOLO because the user explicitly prohibited subagents. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Keep one canonical Android V2 Orb canvas, Worker, and WebGL context alive across `orb-select` ↔ `refine-for-diary`, eliminating the late compact-Orb pop-in without changing accepted final pixels or motion tokens.

**Architecture:** `OrbPage` mounts one Android-only `AndroidPersistentOrbJourney` outside the conditional step branch. That owner renders one `ValenceOrb` into one stable portal host, moves the host between existing select/refine anchors, and opts into a context-preserving size policy. `ValenceOrb` separates renderer lifetime from presentation geometry; `orbWorker` resizes the same OffscreenCanvas bitmap before viewport/draw/ack; `MiniValenceOrb` supplies the unchanged refine chrome around an external renderer slot.

**Tech Stack:** React 18, TypeScript, React DOM portals, Vitest, Testing Library, OffscreenCanvas, Web Worker, WebGL, Capacitor Android WebView, ADB, CDP, Perfetto FrameTimeline.

**Spec:** `docs/superpowers/specs/2026-08-26-android-persistent-orb-renderer-design.md`

## Global Constraints

- Work only in `/Users/yehor/Projects/ZenFlow/worktrees/codex-android-v2-motion-smoothness-20260822` on `codex/android-v2-motion-smoothness` at base `13ca51a80d23220574deba762851fe5a32372e46`.
- Preserve staged binary-diff fingerprint `2f67c0160bd520cbbe9558979e3e64a5c56ec6d02d19170d16ffd3eb818e7a91`.
- Do not reset, clean, stash, revert, stage, or overwrite unrelated changes.
- Do not commit, push, merge, upload, publish, or release.
- Do not change shader art, colors, blur, filters, particles count, DPR policy, FPS, animation speed, `Bloom` 320 ms duration, `bloomOut` easing, or 140/220/360 ms choreography stages.
- Do not add or use Canvas2D/CSS/SVG/Lottie/static substitutes, a second hidden canvas/Worker/context, `desynchronized:true` changes, negative z-stack, or a delayed-input gate.
- Keep non-Android behavior on the existing direct `ValenceOrb`/self-owned `MiniValenceOrb` path.
- Test-first is mandatory: each production behavior begins with a focused test that fails for the missing behavior.
- A technical timing improvement with any unintended visual delta is `REJECTED`.
- Screenshots are phase checkpoints; promoted Motion evidence requires video, while CDP and Perfetto run separately without video.

---

### Task 1: Lock the protected edit boundary and add particle reprojection RED

**Files:**

- Create: `src/components/state-of-mind/orbGeometry.ts`
- Create: `src/components/state-of-mind/__tests__/orbGeometry.test.ts`
- Create/update local ignored guard: `.preflight-token`

**Interfaces:**

- Produces:

```ts
import type { Particle } from "./particleSystem";

export function reprojectOrbParticles(
  particles: Particle[],
  previousSize: number,
  nextSize: number
): boolean;
```

- Contract: invalid or non-positive sizes return `false` without mutation; equal sizes return `true` without mutation; valid changes mutate `x`, `y`, `vx`, `vy`, and `radius` by `nextSize / previousSize` while preserving all other fields.

- [ ] **Step 1: Record current protected state**

Run:

```bash
npm run agent:workspace -- doctor --mode edit --agent codex --json
git status --short --branch
git diff --cached --binary | shasum -a 256
```

Expected: doctor reports the correct locked lane and the inherited dirty-worktree STOP; branch/HEAD match the global constraints; staged fingerprint matches exactly.

- [ ] **Step 2: Write the failing particle tests**

Create literal fixtures that prove:

```ts
expect(reprojectOrbParticles([particle], 240, 120)).toBe(true);
expect(particle).toMatchObject({
  x: 60,
  y: 30,
  vx: 1,
  vy: -0.5,
  radius: 2,
  alpha: 0.75,
  life: 20,
  maxLife: 80,
  hueOffset: 12,
});
```

Add a 240 → 120 → 240 round-trip tolerance check and a non-finite/zero/negative input non-mutation table.

- [ ] **Step 3: Run RED**

Run:

```bash
npx vitest run src/components/state-of-mind/__tests__/orbGeometry.test.ts
```

Expected: FAIL because `orbGeometry.ts` or `reprojectOrbParticles` does not exist.

- [ ] **Step 4: Implement the minimal pure helper**

Use one validation branch and one in-place loop. Do not allocate a replacement particle pool.

- [ ] **Step 5: Run GREEN**

Run the same Vitest command.

Expected: all `orbGeometry` tests PASS.

### Task 2: Resize the same Worker drawing buffer before acknowledgement

**Files:**

- Modify: `src/components/state-of-mind/orbWorker.ts`
- Modify: `src/components/state-of-mind/__tests__/orbWorker.lifecycle.test.ts`

**Interfaces:**

- Extend the existing internal renderer construction to retain the same `OffscreenCanvas` object:

```ts
function createRendererFromLinkedProgram(
  gl: GLContext,
  canvas: OffscreenCanvas,
  program: WebGLProgram,
  vs: WebGLShader,
  fs: WebGLShader
): OrbWorkerRenderer | null;
```

- Produce the private drawing-buffer helper:

```ts
function resizeDrawingBuffer(
  canvas: OffscreenCanvas,
  size: number,
  dpr: number
): { width: number; height: number };
```

- [ ] **Step 1: Extend the Worker lifecycle test with a real message sequence**

Use one fake OffscreenCanvas object and a complete WebGL stub. Send `init`, then a render payload at 240×2, then a render payload at 120×2. Assert the same canvas object becomes 240×240, the last viewport call is `(0, 0, 240, 240)`, `drawArrays` precedes the second `rendered` post, and neither `disposed` nor `close` occurs.

- [ ] **Step 2: Run RED**

Run:

```bash
npx vitest run src/components/state-of-mind/__tests__/orbWorker.lifecycle.test.ts
```

Expected: the new resize assertion fails because the Worker changes only `gl.viewport()` and not the OffscreenCanvas bitmap.

- [ ] **Step 3: Implement same-context bitmap resize**

Before clear/draw, compute:

```ts
const width = Math.max(1, Math.round(size * dpr));
const height = width;
if (canvas.width !== width) canvas.width = width;
if (canvas.height !== height) canvas.height = height;
gl.viewport(0, 0, width, height);
```

Keep the existing shader, blend state, uniforms, presentation readback, context-loss handling, and `rendered`/`unpresented` semantics unchanged.

- [ ] **Step 4: Run GREEN**

Run the same Worker lifecycle test command.

Expected: disposal and resize tests PASS.

### Task 3: Add opt-in context-preserving `ValenceOrb` size updates

**Files:**

- Modify: `src/components/state-of-mind/ValenceOrb.tsx`
- Modify: `src/components/state-of-mind/__tests__/ValenceOrb.motion.test.ts`

**Interfaces:**

```ts
export type OrbResizePolicy = "recreate" | "preserve-worker-context";

interface ValenceOrbProps {
  // existing props unchanged
  resizePolicy?: OrbResizePolicy;
}
```

Default: `resizePolicy = "recreate"`.

Internal geometry:

```ts
type OrbGeometry = {
  size: number;
  cx: number;
  cy: number;
  innerR: number;
  outerR: number;
};

function createOrbGeometry(size: number): OrbGeometry;
```

- [ ] **Step 1: Add a failing persistent-size Worker test**

Render forced Worker WebGL at 240 with `resizePolicy="preserve-worker-context"`, acknowledge its first frame, retain the canvas object, rerender at 120, then assert:

```ts
expect(WorkerSpy).toHaveBeenCalledTimes(1);
expect(canvasAfter).toBe(canvasBefore);
expect(worker.postMessage).not.toHaveBeenCalledWith({ type: "dispose" });
expect(lastRender.payload.size).toBe(120);
expect(wrapper).toHaveStyle({ width: "120px", height: "120px" });
expect(canvasAfter).toHaveStyle({ width: "120px", height: "120px" });
```

Add a second test without the opt-in policy proving the current recreate behavior remains the default.

- [ ] **Step 2: Run RED**

Run only the two named tests with Vitest `-t` filters.

Expected: the opt-in prop is absent or the Worker/canvas is recreated after rerender.

- [ ] **Step 3: Separate renderer lifetime from geometry**

Add `requestedSizeRef`, `geometryRef`, and `resizeRendererRef`. Use a lifecycle dependency that changes with size only for the default policy:

```ts
const rendererLifecycleSize = resizePolicy === "preserve-worker-context" ? null : size;
```

Replace setup-effect captured geometry reads with `geometryRef.current`. On opt-in resize:

1. validate next size;
2. reproject the existing particle pool;
3. scale active touch coordinates;
4. update geometry and canvas CSS dimensions;
5. render the current state through the existing Worker controller;
6. preserve first-paint/visual-ready state and all phase clocks.

Do not reset genesis, create a particle pool, increment the Worker generation, clear the visible-ready attribute, or run cleanup.

- [ ] **Step 4: Run GREEN for the two lifetime tests**

Expected: persistent test passes with one Worker/canvas; default test passes with existing recreate behavior.

- [ ] **Step 5: Run the full ValenceOrb focused file**

Run:

```bash
npx vitest run src/components/state-of-mind/__tests__/ValenceOrb.motion.test.ts
```

Expected: all tests PASS with no warnings or unhandled timers.

### Task 4: Add the exact external refine slot and persistent host

**Files:**

- Modify: `src/components/state-of-mind/MiniValenceOrb.tsx`
- Modify: `src/components/state-of-mind/__tests__/MiniValenceOrb.test.tsx`
- Create: `src/pages/nav-v2/AndroidPersistentOrbJourney.tsx`
- Create: `src/pages/nav-v2/__tests__/AndroidPersistentOrbJourney.test.tsx`

**Interfaces:**

```ts
export interface ExternalMiniOrbRenderer {
  targetRef: React.Ref<HTMLDivElement>;
  visualReady: boolean;
}

interface MiniValenceOrbProps {
  // existing props unchanged
  externalRenderer?: ExternalMiniOrbRenderer;
}
```

```ts
export interface AndroidPersistentOrbJourneyHandle {
  captureTransitionStart(): void;
}

interface AndroidPersistentOrbJourneyProps {
  step: OrbFlowStep;
  valence: number;
  heroSize: number;
  animationSpeed: number;
  shouldAnimate: boolean;
  attempt: number;
  selectTargetRef: React.RefObject<HTMLDivElement | null>;
  refineTargetRef: React.RefObject<HTMLDivElement | null>;
  onVisualReady(): void;
  onVisualError(): void;
}
```

- [ ] **Step 1: Add failing Mini external-slot tests**

Render refine/lg with `externalRenderer`. Assert the exact current shell/ring/inset/scale/brightness classes remain, the provided target ref receives one element, and no nested `[data-orb-renderer-policy]` exists. Assert `visualReady=false` keeps `opacity-0` and `true` uses `opacity-100`.

- [ ] **Step 2: Run Mini RED**

Expected: FAIL because `externalRenderer` is not implemented and the component creates its own `ValenceOrb`.

- [ ] **Step 3: Implement the narrow Mini slot**

Keep existing default rendering unchanged. In external mode, render the same 120 px absolute inner frame and attach `targetRef` where the internal `ValenceOrb` would be. Do not copy or fork the preset maps.

- [ ] **Step 4: Run Mini GREEN**

Expected: all Mini tests PASS.

- [ ] **Step 5: Add failing persistent-host tests**

Render the journey with stable select/refine target refs and a mocked real React child identity marker. Rerender select → refine → select. Assert the portal host object and rendered Orb child object remain strictly identical and the host parent changes to the correct target.

Stub `HTMLElement.prototype.animate` and assert normal motion uses:

```ts
{ duration: 320, easing: "cubic-bezier(0.2, 0.9, 0.2, 1)", fill: "both" }
```

Assert reduced motion does not call `animate`.

- [ ] **Step 6: Run journey RED**

Expected: FAIL because `AndroidPersistentOrbJourney` does not exist.

- [ ] **Step 7: Implement stable portal host and FLIP**

Create one host with `useMemo`, render one keyed `ValenceOrb` into it using `createPortal`, append the same host to the active ref in `useLayoutEffect`, and remove it only on owner unmount. `captureTransitionStart()` stores one pre-action rect. After placement, compute the inverse top-left transform and animate to identity with the exact existing duration/easing. Cancel an existing presentation animation before starting another.

- [ ] **Step 8: Run journey GREEN**

Expected: identity, parent, normal-motion, reduced-motion, and cleanup tests PASS.

### Task 5: Integrate the persistent Android owner into the real Orb flow

**Files:**

- Modify: `src/pages/nav-v2/OrbPage.tsx`
- Modify: `src/pages/nav-v2/OrbPageSteps.tsx`
- Modify: `src/pages/nav-v2/__tests__/OrbPage.test.tsx`
- Modify if required for exact anchor geometry only: `src/pages/nav-v2/OrbPageSteps.css`

**Interfaces:**

- Add optional target refs without changing non-Android behavior:

```ts
interface OrbSelectStepProps {
  // existing props unchanged
  persistentOrbTargetRef?: React.Ref<HTMLDivElement>;
}

interface OrbRefineStepProps {
  // existing props unchanged
  persistentOrbTargetRef?: React.Ref<HTMLDivElement>;
  persistentOrbVisualReady?: boolean;
}
```

- [ ] **Step 1: Add the real-flow Android identity RED**

Set `platformControl.isAndroid = true`, render `OrbPage`, retain the mocked `valence-orb` element, select a mood, click Next, and assert the same element appears inside refine. Click Back and assert the same element again. Assert the renderer callback count stays one and the current element size changes hero → 120 → hero.

Add a non-Android control test proving select/refine retain separate owners.

- [ ] **Step 2: Update the existing Android responsive-size test expectation**

For Android persistent mode, a settled viewport resize must change the same element size without creating a new ready callback or returning the page to pending. Keep the existing fresh-frame/remount behavior for non-Android.

- [ ] **Step 3: Run OrbPage RED**

Run:

```bash
npx vitest run src/pages/nav-v2/__tests__/OrbPage.test.tsx -t "keeps one Android Orb renderer across Next and Back|resizes the persistent Android Orb without a new visual attempt|keeps non-Android step owners unchanged"
```

Expected: Android identity assertions fail on the current conditional owners.

- [ ] **Step 4: Wire the owner and anchors**

In `OrbPage`:

- create select/refine target refs and an imperative journey ref;
- mount `AndroidPersistentOrbJourney` only when `isAndroid`;
- wrap Next and Back so they capture the current rect before changing step;
- do not call `beginNewVisualAttempt()` for normal Android Back or Android persistent viewport resize;
- retain retry-driven attempt remounts and all current non-Android behavior.

In `OrbPageSteps`:

- render a fixed-size anchor in the existing hero button when the select target ref is present;
- otherwise render the current direct `ValenceOrb` unchanged;
- pass the refine target through `MiniValenceOrb.externalRenderer` while retaining every current refine class.

- [ ] **Step 5: Run OrbPage GREEN**

Run the complete `OrbPage.test.tsx` file.

Expected: all flow, Back, IME/layout, visual readiness, and identity tests PASS.

### Task 6: Focused source verification and visual-regression guards

**Files:**

- Modify only if assertions must cover the new valid persistent composition without weakening canon: `src/components/state-of-mind/__tests__/canonicalOrbInvariant.test.ts`
- Update task evidence/status only after fresh commands: `docs/superpowers/plans/2026-08-26-android-v2-motion-visual-qa-handoff.md`

- [ ] **Step 1: Run focused tests together**

```bash
npx vitest run \
  src/components/state-of-mind/__tests__/orbGeometry.test.ts \
  src/components/state-of-mind/__tests__/orbWorker.lifecycle.test.ts \
  src/components/state-of-mind/__tests__/MiniValenceOrb.test.tsx \
  src/components/state-of-mind/__tests__/ValenceOrb.motion.test.ts \
  src/pages/nav-v2/__tests__/AndroidPersistentOrbJourney.test.tsx \
  src/pages/nav-v2/__tests__/OrbPage.test.tsx
```

Expected: all focused tests PASS.

- [ ] **Step 2: Run static and visual contracts**

```bash
npm run typecheck
npm run check:canonical-orbs
npm run check:visual
npm run check:no-ai-templates
npm run check:best-practices
git diff --check
```

Expected: all PASS. Do not edit guard thresholds or exclusions to get green.

- [ ] **Step 3: Review exact diff and protected fingerprints**

```bash
git diff -- src/components/state-of-mind src/pages/nav-v2 docs/superpowers
git status --short --untracked-files=all
git diff --cached --binary | shasum -a 256
```

Expected: only declared task paths plus inherited changes; staged fingerprint unchanged; no shader/constants/filter/timing/DPR drift.

### Task 7: Build and reject/promote a new benchmark candidate

**Files:**

- Create: next free `output/android-motion-debug/2026-08-26-android-persistent-orb-candidate-<N>/`
- Do not overwrite candidate20–candidate28 or any existing directory.

- [ ] **Step 1: Prove candidate number is free**

List existing candidate directories and select the first absent number greater than 28. Record the absence before building.

- [ ] **Step 2: Build in the required order**

```bash
npm run cap:sync:android:benchmark
cd android && ./gradlew assembleBenchmark
```

Copy the resulting APK into the unique candidate directory, calculate SHA-256, and create source/environment/ledger records through the existing Android motion scripts.

- [ ] **Step 3: Install and bind artifact identity before interaction**

Run `adb devices -l`, install the candidate, read `pm path`, hash device-side `base.apk`, and verify package `com.zenflow.app`, versionName `2.1.1`, versionCode `38`. Stop before clicks on any mismatch.

- [ ] **Step 4: Run focused semantic visual/CDP evidence**

Use UIAutomator/accessibility nodes for slider and Next/Back. Assert:

- same canvas identity/lifecycle probe across Next/Back;
- compact Orb is continuously visible as the scene changes;
- no disappearance, blank/stale frame, flash, clip, z-order error, or invisible interception;
- no tile-memory/context-loss/ANR/Davey warning in the accepted action window;
- no interval over 100 ms;
- APK hash matches again after the run.

Reject immediately if any dual gate fails.

- [ ] **Step 5: Run final candidate media and performance separately**

For a candidate that passes the focused gate:

1. record uninterrupted paper select → refine → select video;
2. record the identical ink sequence;
3. review 1×, 0.25×, and frame-by-frame;
4. run a separate CDP/JavaScript timing pass without video;
5. disable CDP and run a separate Perfetto/FrameTimeline pass without video;
6. repeat installed APK hash and clean up app/CDP resources.

- [ ] **Step 6: Update the handoff ledger truthfully**

Mark only freshly proved rows. Emulator success cannot mark physical 60 Hz, physical 90/120 Hz, Artistic/Craft, user video review, store, or release rows PASS.

### Task 8: Continue the global motion plan after focused acceptance

**Files:**

- Follow: `docs/superpowers/plans/2026-08-26-android-v2-motion-visual-qa-handoff.md`
- Create separate evidence directories and root-cause patches for each newly reproduced defect.

- [ ] **Step 1: Drawer/theme root-cause slice**

Reproduce paper/ink and cross-tab drawer glitches with the accepted APK, preserve video/logcat/layers/FrameTimeline alignment, add the closest RED proof, and patch only the attributed owner.

- [ ] **Step 2: Habits, Diary, Planning, Settings controls**

Exercise every semantic control, sheet, modal, IME, Back path, and transition; preserve failures as separate evidence rather than applying a broad speculative motion rewrite.

- [ ] **Step 3: Lifecycle, layout, motion, and locale matrix**

Run background/foreground ×5, rotation, landscape, split-screen, safe areas, normal/reduced motion, and en/ar/he complete journeys; retain all-eight-locale static guards.

- [ ] **Step 4: Physical and human gates**

Keep the task incomplete until physical Android 12+ 60 Hz, physical Android 14+ 90/120 Hz, `visual-integrity-critic`, and the user's final video review are complete.

## Risks And Mitigations

- **Risk:** Reparenting the stable host causes Android WebView to blank the OffscreenCanvas placeholder. **Mitigation:** focused identity plus video/context probe; immediate STOP without fallback.
- **Risk:** A captured size remains in the renderer loop. **Mitigation:** payload-size assertions after rerender and Worker bitmap/viewport test.
- **Risk:** Particle phase visibly jumps. **Mitigation:** normalized round-trip reprojection test and frame-by-frame review.
- **Risk:** Mini presentation drifts. **Mitigation:** use the existing preset maps and exact shell; computed-style/pixel envelope gate.
- **Risk:** FLIP introduces new easing or queued motion. **Mitigation:** exact existing 320 ms/bloomOut assertion, cancellation test, reduced-motion no-animation assertion.
- **Risk:** Dirty worktree edits overlap unrelated work. **Mitigation:** narrow path review, staged fingerprint check, no Git cleanup/staging/publication.

## Done Criteria

- [ ] One canvas, Worker, init, and context survive Android Next/Back and ten-cycle soak.
- [ ] Final select/refine pixels and geometry remain within baseline noise envelope in paper/ink and normal/reduced motion.
- [ ] Promoted video has no disappearance, blank/stale frame, flash, clip, phase jump, uneven speed, z-order error, or invisible interception.
- [ ] Separate CDP and CDP-off Perfetto passes meet the focused and final gates.
- [ ] No tile-memory warning, ANR, context loss, or frame interval over 100 ms occurs in accepted evidence.
- [ ] Full global pages/controls matrix, required physical devices, critic, and user review are complete before overall completion.
- [ ] No commit/push/upload/release occurred.

## UNVERIFIED At Plan Start

- Android WebView behavior when the same OffscreenCanvas placeholder host is reparented.
- Final pixel/noise-envelope equivalence.
- Candidate performance metrics after implementation.
- Physical 60 Hz and 90/120 Hz devices.
- Human Artistic/Craft and final motion acceptance.
- Drawer/theme and the remaining all-pages/all-controls defects, which follow only after focused Orb acceptance.

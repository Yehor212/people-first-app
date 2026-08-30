# Android Persistent Orb Renderer Design

Date: 2026-08-26

Status: Portal-host variant `REJECTED`; unified same-parent layout revision requires user review

Scope: Android V2 Orb `orb-select` ↔ `refine-for-diary` renderer continuity, exact visual parity, motion continuity, and the focused evidence gate before the wider Android V2 motion matrix

Worktree: `/Users/yehor/Projects/ZenFlow/worktrees/codex-android-v2-motion-smoothness-20260822`

Branch: `codex/android-v2-motion-smoothness`

Base/HEAD at design time: `13ca51a80d23220574deba762851fe5a32372e46`

## 1. Decision

Execution update: candidates29–31 proved that moving the same portal host across
the select/refine parent boundary does preserve canvas and Worker identity, but
does not preserve continuous Android WebView motion. candidate29 mounted the
renderer while detached and never reached first paint. candidate30 resized the
same canvas but stopped after one refine frame. candidate31 added an explicit
post-reparent resume and stopped after two refine frames because a later
IntersectionObserver callback paused the loop again. The portal-host variant
has reached its three-attempt STOP condition and is no longer an approved
implementation direction.

The next design revision must keep the canonical Orb in one stable DOM parent
and change the select/refine layout around it. That revision is not authorized
by this document and requires explicit user review before product edits resume.

The Android V2 Orb journey will keep one canonical `ValenceOrb` React instance,
one DOM canvas placeholder, one Worker, and one WebGL context alive while the
user moves from `orb-select` to the source-defined `refine-for-diary` step and back.

The renderer will not be pooled, duplicated, hidden-prewarmed, replaced with a
fallback, or restarted merely because its presentation changes from the large
hero to the current compact refine chrome. The same drawing buffer will be
resized in place and redrawn completely before the Worker acknowledges the
new-size frame.

The design has two simultaneous acceptance gates:

1. The late refine-Orb pop-in and cold renderer replacement must be removed.
2. Final select and refine pixels, geometry, effects, density, easing,
   duration, and semantic behavior must remain equivalent to the accepted
   baseline. A faster result with a visible downgrade is `REJECTED`.

This decision is Android-only. Existing Web/PWA, iOS/WKWebView, and
Desktop/Tauri component ownership and renderer policy remain unchanged.

## 2. User Failure Mode

After the user selects a mood and taps Next, the refine header, emotion grid,
note, and actions appear before the compact Orb. The scene therefore assembles
in visible pieces rather than behaving like one continuous transition. The
same family of interruption is reported around Back, drawer navigation, and
paper/ink switching, but drawer/theme ownership is a separate root-cause slice
and is not folded into this renderer patch.

The user-visible failure is not merely a slow selector. It is a broken visual
handoff:

- the large Orb disappears;
- the next scene begins;
- a new compact Orb arrives hundreds of milliseconds later;
- the user's attention is pulled to a late pop-in inside an otherwise settled
  scene.

The intended result is a single continuous object that changes placement and
presentation while the next controls bloom in around it.

## 3. Fresh Evidence Snapshot

### 3.1 Artifact identities

The following SHA-256 values were recomputed from the APK files during this
design pass:

| Artifact              | Role                                     | SHA-256                                                            | Status                   |
| --------------------- | ---------------------------------------- | ------------------------------------------------------------------ | ------------------------ |
| candidate20           | Exact historical FAIL reference          | `90a519b32358eb41de4635d7b2f7ba0c81b0d2d2e87fe7e1072e31a1b4562a7a` | Reference only           |
| prechange baseline 01 | Focused select → refine characterization | `8d7924d36337e08b124ffb3772505b182d561c3ea58a485ebc847e574fd60693` | Current focused baseline |
| candidate26           | Immediate Worker scheduling experiment   | `fe8037c08f5931620940d7f2e8602198026662fc498aa451a5b2d36287ed9484` | `REJECTED`               |
| candidate27           | Main-renderer experiment                 | `a634e7a425161e9c89a0533d898e2bec23ca01dc39d3c2bb7d2b2cb72c1fe51d` | `REJECTED`               |
| candidate28           | 200 ms staged Worker experiment          | `9627344400d475a308f0f7465aeab499d8c5f94c4aaa61d2e4b764fd5af184fc` | `REJECTED`               |

candidate20 remains the exact reproduction reference required by the handoff
plan. It is not the source-equivalent APK for the current tree and is not a
candidate to modify or relabel.

### 3.2 Focused transition measurements

The prechange baseline evidence is stored at:

`output/android-motion-debug/2026-08-26-all-controls-prechange-baseline-01/cdp-orb-next-refine-v5/transition-evidence.json`

The installed APK SHA matched the source APK before and after that run. The
semantic Next action produced these first-visible times relative to the WebView
click:

| Refine element   | First visible |
| ---------------- | ------------: |
| Header           |      289.8 ms |
| Emotion spectrum |      289.8 ms |
| Note             |      405.7 ms |
| Actions          |      405.7 ms |
| Compact Orb      |     1118.3 ms |

The visible scene spread was 828.5 ms. No tile-memory, Davey/skipped-frame,
UIAutomation, ANR, or context-loss warning appeared inside that focused action
window. Those clean diagnostics do not make the transition acceptable: the
late compact Orb is itself a visual-runtime failure.

The rejected experiments prove that queue tuning is not the architecture:

| Candidate | Change                                   | Result                                          | Rejection reason                                   |
| --------- | ---------------------------------------- | ----------------------------------------------- | -------------------------------------------------- |
| 26        | Removed the mini Worker scheduling queue | Compact Orb 679.9 ms; scene spread 665.8 ms     | Faster but still a conspicuous second-stage pop-in |
| 27        | Used the main renderer path              | Compact Orb absent for the full 5 s observation | Functional visual failure                          |
| 28        | Used a 200 ms Worker start delay         | Compact Orb 982.2 ms; scene spread 780.0 ms     | No meaningful closure                              |

### 3.3 Current source ownership

`src/pages/nav-v2/OrbPage.tsx` conditionally renders either
`OrbSelectStep` or `OrbRefineStep`.

`src/pages/nav-v2/OrbPageSteps.tsx` currently gives those steps separate
renderer owners:

- select renders `ValenceOrb` at a responsive 220–280 px size with
  `transitionProfile="input-soft"` and `renderer="webgpu"`;
- refine renders a new `MiniValenceOrb` using `size="lg"`, `chrome="refine"`;
- that mini wrapper owns a separate 120 px `ValenceOrb`, hidden with
  `opacity-0` until canonical first paint.

`src/components/state-of-mind/ValenceOrb.tsx` runs the main renderer setup in a
layout effect whose dependency list includes `size`. A size change therefore
executes cleanup, disposes or terminates the active renderer, removes canvas
nodes, creates a new canvas, transfers a new `OffscreenCanvas`, and starts a new
Worker/context path.

`src/components/state-of-mind/orbWorker.ts` currently supports `init`, `render`,
and `dispose`, but no context-preserving resize operation. It updates
`gl.viewport()` from the render payload without first changing the underlying
drawing-buffer dimensions.

The particle pool stores positions, velocity, and radius in absolute pixels.
Changing the payload size without reprojecting that pool would alter the
normalized particle field and cause a visual discontinuity.

## 4. Source-Backed Constraints

This design is based on primary sources and the active ZenFlow contracts:

- React preserves component state only while a component remains in the same
  render-tree position. Removing the select owner and mounting the refine owner
  necessarily destroys the first renderer instance:
  <https://react.dev/learn/preserving-and-resetting-state>.
- A portal remains the same React subtree only while its target DOM node remains
  the same. The design therefore keeps one stable portal host and moves that
  host; it does not switch the portal to a different target:
  <https://react.dev/reference/react-dom/createPortal>.
- `transferControlToOffscreen()` creates a placeholder relationship with the
  original canvas element. A context-owned `OffscreenCanvas` is not a reusable
  renderer that can be transferred into a different canvas placeholder:
  <https://html.spec.whatwg.org/multipage/canvas.html>.
- WebGL drawing-buffer size follows the canvas bitmap size. Resizing requires a
  new viewport and complete redraw but does not require replacing the WebGL
  context: <https://registry.khronos.org/webgl/specs/1.0/>.
- OffscreenCanvas permits rendering work to stay in a Worker while the visible
  placeholder remains in the document:
  <https://web.dev/articles/offscreen-canvas>.
- Android jank diagnosis must bind user-visible interactions to frame evidence
  rather than infer smoothness from build/tests alone:
  <https://developer.android.com/topic/performance/vitals/render> and
  <https://perfetto.dev/docs/data-sources/frametimeline>.

Local contracts add stricter ZenFlow requirements:

- `docs/ai/CANONICAL_ORB_INVARIANT.md`: no substitute Orb implementation;
- `docs/ai/TELEGRAM_GRADE_RUNTIME_CONTRACT.md`: no visual downgrade, no late
  renderer swap, and separate visual/CDP/Perfetto proof;
- `docs/ai/V2_FULLSCREEN_EDGE_TO_EDGE_CONTRACT.md`: safe-area and V2 route-root
  behavior remain intact;
- `docs/ai/TEST_FIRST_AGENT_POLICY.md`: characterize first, then add the
  closest red test before product code;
- `docs/ai/VISUAL_INTEGRITY_CRITIC_PROTOCOL.md`: technical green does not imply
  Artistic/Craft or Motion green.

## 5. Non-Goals And Hard Prohibitions

This slice does not:

- fix drawer/sidebar or paper/ink transition ownership;
- change Orb shader source, palettes, particles count, blend mode, shape
  parameters, filters, brightness, saturation, opacity, blur, visual density,
  animation speed, DPR cap, or canvas renderer policy;
- change `Bloom` duration 320 ms, `bloomOut`
  `cubic-bezier(0.2, 0.9, 0.2, 1)`, or stage delays 140/220/360 ms;
- add `desynchronized: true`, change it, or count any existing context attribute
  as the fix;
- add a Canvas2D, CSS, SVG, Lottie, static-gradient, or second-Orb fallback;
- keep a second hidden Worker/canvas/context warm;
- gate Next on a cold compact renderer or delay pressed-state feedback;
- move the Orb into the contained daylight background tree;
- use negative z-index, a hidden overlay, or a click-intercepting transparent
  layer;
- reduce FPS, DPR, quality, effects, particles, opacity, or motion;
- change storage, sync, schema, API, user records, locales, product copy, or
  other platforms;
- commit, push, merge, upload, publish, or release.

No mock, demo, sample, synthetic, or real user record is required for this
renderer lifecycle change.

## 6. Options Considered

### 6.1 Option A — one persistent renderer and movable stable host

Status: selected.

One Android-only owner remains mounted outside the conditional step branch. It
creates one stable portal host and renders one `ValenceOrb` into that host. The
portal target object never changes. On a step change, the same host is moved
between the current hero anchor and the current `MiniValenceOrb` refine anchor
during a layout phase before paint.

The renderer receives an explicit Android journey resize policy. Under that
policy, a size prop change updates geometry, wrapper/canvas CSS dimensions, the
OffscreenCanvas bitmap, viewport, and particle coordinates without running
renderer cleanup or creating a new context.

Why selected:

- it removes the proven cold-start boundary rather than tuning its delay;
- it preserves the existing select and refine layout owners and their exact
  current presentation classes;
- it keeps the actual canvas placeholder object and Worker context stable;
- it can be fully disabled outside Android;
- it has a precise rollback boundary.

Rejection condition: if Android WebView detaches, loses, blanks, or visibly
recreates the OffscreenCanvas placeholder when the stable host is reparented,
the candidate stops. The implementation must not silently fall back to a
second canvas. A unified same-parent layout would require a separately reviewed
design revision.

### 6.2 Option B — renderer pool or context reattachment

Status: rejected.

A context-owned `OffscreenCanvas` cannot be rebound to a different visible
canvas placeholder. A pool would therefore either keep the wrong placeholder
or retain a second context. Both violate the one-context requirement and
increase compositor/tile pressure.

### 6.3 Option C — hidden compact prewarm

Status: rejected.

A hidden `MiniValenceOrb` would allocate the second Worker/context before the
user needs it. It treats the symptom by spending more GPU/tile memory, exactly
where the broader Android failure already reports tile-memory exhaustion and
missing raster content.

### 6.4 Option D — block the transition until compact first paint

Status: rejected.

This would trade a late pop-in for slow input response, a stuck pressed state,
or a blank/stale transition. It also retains the cold renderer replacement and
does not solve Back.

### 6.5 Option E — main-thread renderer or cheaper fallback

Status: rejected.

candidate27 failed to show the compact Orb. A cheaper renderer would violate
the canonical Orb and zero-visual-regression contracts even if it improved a
timing metric.

## 7. Component Architecture

### 7.1 Android-only persistent owner

Add the Android-only journey owner
`AndroidPersistentOrbJourney` under `src/pages/nav-v2/`.

`OrbPage` mounts it once inside `orb-page-runtime-content`, outside the
`step === "orb-select"` conditional. The owner receives only the current
presentation state and canonical renderer props:

- current step;
- valence;
- select hero size;
- animation speed;
- transition profile;
- visual-ready/error callbacks;
- the active hero/refine anchor registration.

It owns:

- one stable host element;
- one `ValenceOrb` component instance;
- one current presentation-size ref;
- one previous-screen rect for the FLIP handoff;
- no business or persistence state.

`OrbPage` continues to own mood draft state, handlers, route semantics, visual
attempt status, and error/retry state.

### 7.2 Stable host placement

`OrbSelectStep` keeps the existing rim, aura, focus-ring, button, and responsive
layout. On Android persistent mode, the button exposes a renderer anchor instead
of mounting its own `ValenceOrb`.

`OrbRefineStep` keeps the existing `MiniValenceOrb` call and exact
`size="lg"`, `chrome="refine"`, and `containerClassName="mt-1 shrink-0"`
presentation. `MiniValenceOrb` gains an optional internal-only external-renderer
slot. When that slot is present it renders the same shell, ring, inset, scale,
brightness, opacity, and accessibility behavior but does not create a second
`ValenceOrb`.

All existing `MiniValenceOrb` callers continue through its current default
internal renderer path. The external slot is used only by the Android V2 Orb
journey and must not become a general-purpose second visual API.

The portal always targets the same stable host node. The node is appended to
the active anchor; the React portal target is never swapped. The canvas and
its `OffscreenCanvas` placeholder identity therefore remain stable.

### 7.3 Non-Android ownership

When `isAndroid` is false:

- `OrbSelectStep` renders the current direct `ValenceOrb` path;
- `OrbRefineStep` renders the current self-owned `MiniValenceOrb` path;
- `ValenceOrb` retains its current recreate-on-size default;
- no persistent host, external mini slot, or Android resize policy runs.

This explicit split prevents an Android performance fix from silently changing
Web/PWA, iOS, or Desktop behavior.

### 7.4 Retry and renderer errors

A full visual retry may deliberately increment the visual attempt and remount
the persistent renderer. Normal Next, Back, slider changes, note edits, theme
reads, and layout density changes must not.

If the canonical renderer reports an actual context loss or unrecoverable
Worker failure, existing canonical recovery/error behavior remains
authoritative. The persistent journey must not suppress the error, show a stale
canvas indefinitely, or substitute a fallback.

## 8. Context-Preserving Resize Protocol

### 8.1 New policy boundary

`ValenceOrb` receives an opt-in resize policy whose default preserves current
behavior. The Android journey opts into `preserve-worker-context`; every other
caller stays on the current recreate-on-size path.

The opt-in path separates two concerns that are currently combined in the
`[renderer, size]` setup effect:

1. renderer lifetime, which depends on renderer policy and component lifetime;
2. presentation geometry, which may change while the renderer stays alive.

The implementation must not remove `size` from a dependency array without
adding explicit, tested size propagation. A stale closure that continues to
draw at the hero geometry would be a correctness failure.

### 8.2 Main-thread geometry state

The persistent path keeps current geometry in refs read by the render loop:

- CSS size;
- bitmap size;
- DPR;
- center;
- inner/outer particle radii;
- current particle-space scale;
- pointer/touch coordinates.

On a size change from `oldSize` to `newSize`, apply
`ratio = newSize / oldSize` exactly once:

- `x`, `y`, `vx`, `vy`, and `radius` are multiplied by `ratio`;
- `life`, `maxLife`, `alpha`, and `hueOffset` are preserved;
- active touch coordinates are multiplied by `ratio`;
- phase clocks, smoothed valence, target valence, shimmer, genesis state, and
  animation time are preserved;
- wrapper and canvas CSS dimensions become the new canonical dimensions.

This keeps normalized particle position, normalized radius, velocity, and Orb
phase continuous. Recreating the particle pool would cause a visible phase
jump and is forbidden.

### 8.3 Worker-side atomic resize

The existing render payload already contains `size` and `dpr`. The Worker will
use those values as the authoritative target bitmap dimensions.

Before drawing a frame:

1. compute the integer bitmap width and height from current canonical size and
   DPR;
2. if the OffscreenCanvas bitmap differs, update its width and height on that
   same OffscreenCanvas object;
3. update `gl.viewport(0, 0, width, height)`;
4. clear the resized buffer;
5. upload the unchanged canonical shader uniforms and reprojected particle
   payload;
6. draw one complete frame;
7. acknowledge `rendered` only after the complete visible frame passes the
   existing presentation/context checks.

No transparent resized buffer may be acknowledged. The main thread keeps the
last complete frame as the visual source until the resized frame is ready; it
does not reveal a blank intermediate bitmap.

The Worker remains the same Worker. `init` count stays one, `dispose` stays zero
during Next/Back, and the WebGL context stays the same object.

### 8.4 Exact final sizes

The select final renderer size remains the current responsive
`heroOrbSize` calculation: base 280 px with the existing 220/240/260 density
floors and viewport scaling.

The refine final renderer bitmap remains exactly 120 px at the current DPR,
inside the current `h-20 w-20` refine shell, `inset-[6px]` clip, and
`scale-[0.68] brightness-[0.96]` presentation.

Keeping the hero bitmap permanently and CSS-downscaling it is not the final
design. It would change raster density and memory usage and would make exact
mini parity harder to prove.

## 9. Motion Handoff

### 9.1 One continuous object

The stable host uses a one-shot FLIP transform on Next and Back:

1. record the stable host's pre-transition rect at the semantic action;
2. let React render the new step and place the same host in the new anchor;
3. read the final rect once during layout;
4. apply the inverse translation/scale to keep the first composited frame in
   its old visual position;
5. animate the transform to identity using the existing 320 ms `Bloom`
   duration and `bloomOut` easing;
6. clear temporary transform/will-change state after completion.

This is a single interaction-time layout calculation, not a per-frame layout
read. The canvas remains pointer-transparent except where the existing select
button owns input.

### 9.2 Existing choreography remains authoritative

The content reveal stays:

- primary at 140 ms;
- secondary at 220 ms;
- CTA at 360 ms;
- each Bloom uses 320 ms and `bloomOut`.

The persistent Orb does not receive a new spring, bounce, overshoot, opacity
flash, or secondary fade. It moves and scales as the same object while the
existing scene choreography runs.

### 9.3 Reduced motion

When effective reduced motion is active:

- no FLIP interpolation runs;
- the same host is placed in the final anchor immediately;
- the renderer remains canonical and produces the current deterministic still;
- no fade, shrink, or spatial movement is added;
- focus, controls, and semantic outcome are identical.

Reduced motion is not a cheaper renderer path.

### 9.4 Rapid and interrupted actions

Next, Back, Android Back, and a rapid Next → Back sequence must cancel the
current presentation transform and start from the host's actual current visual
rect. They must not queue multiple FLIP animations, duplicate anchors, or leave
an invisible overlay intercepting input.

Background/foreground, rotation, and density changes cancel temporary
presentation transforms, recompute the final anchor, resize the same renderer,
and resume only after the visible route is active. They do not allocate a
second canvas.

## 10. Zero-Visual-Regression Contract

The implementation is acceptable only when all applicable rows below pass.

### 10.1 Source invariants

- Orb shader sources and uniforms are byte-identical unless an implementation
  change is mechanically required only to resize the same drawing buffer.
- Particle count and all valence/shape/color constants are unchanged.
- `CANONICAL_ORB_ANIMATION_SPEED`, transition profiles, DPR policy, filters,
  shell classes, and choreography tokens are unchanged.
- No CSS/SVG/Lottie/Canvas2D product fallback is added.
- `npm run check:canonical-orbs` passes without weakening its assertions.
- Existing non-Android callers retain their default component tree.

### 10.2 Renderer identity invariants

Across semantic Next and Back:

- the `HTMLCanvasElement` object is strictly identical;
- the `ValenceOrb` wrapper object is strictly identical;
- Worker construction count remains one;
- Worker `init` count remains one;
- Worker `dispose` count remains zero;
- context-loss count remains zero;
- no second Orb canvas exists in the journey subtree;
- renderer tier remains canonical `webgl-worker` on the accepted Android path.

### 10.3 Final-state pixel and geometry parity

At stable select and stable refine checkpoints, compare the candidate against
the exact prechange baseline for the same APK-bound route, theme, locale,
motion preference, viewport, valence, and animation phase.

Required comparisons:

- canvas and shell bounding rects;
- computed transform, opacity, filter, border, background, radius, and clip;
- surrounding header/text/action rects and wrapping;
- paper and ink final frames;
- normal-motion phase checkpoints;
- deterministic reduced-motion stills;
- focus ring, pressed state, disabled state, and hit target geometry.

Animated pixels must use a repeated-capture noise envelope rather than one
arbitrary screenshot. Capture at least five baseline samples and five candidate
samples at controlled phase checkpoints. The candidate passes only when its
distance from the baseline centroid is no greater than the baseline's own
run-to-run envelope. Any consistent new edge, halo, blur, brightness, scale,
alignment, clipping, or density difference is a visual regression.

Screenshots are phase checkpoints, not Motion PASS.

### 10.4 Motion integrity

The promoted candidate requires one uninterrupted external-window recording of
select → refine → select for paper and the same sequence for ink:

- capture begins at least one second before the action;
- capture ends at least one second after motion settles;
- review at 1×, 0.25×, and frame-by-frame;
- inspect disappearance, blank/stale frames, flashes, clipping, phase jumps,
  non-uniform speed, late pressed state, wrong z-order, and invisible overlay
  interception.

Video is not required for every inner edit/test loop. Inner loops use identity
tests, DOM/computed-style assertions, CDP timing, and controlled frame
checkpoints. Video is mandatory when a candidate is promoted beyond focused
development and for final Motion/Visual Runtime assessment. Tapping and swiping
without observing rendered frames cannot establish Motion PASS.

### 10.5 Compositor and performance integrity

The focused accepted candidate must show:

- zero `tile memory limits exceeded` warnings;
- zero ANR/crash/context-loss events;
- zero required-control disappearance samples;
- zero frame intervals above 100 ms in the accepted measured journey;
- no increase in peak Orb canvas count;
- no accumulation of Workers, WebGL contexts, or drawing layers after ten
  select/refine cycles;
- separate CDP/JavaScript and CDP-off Perfetto/FrameTimeline passes, both
  without screen recording;
- visual video kept separate from performance metric claims.

The final app-level release gate remains stricter: no tile warnings or gaps over
100 ms, at most 1% deadline-missed frames, physical Android 12+ 60 Hz proof,
and physical Android 14+ 90/120 Hz proof.

## 11. Test-First Implementation Contract

Production edits start only after the following closest tests are added or
selected and observed red for the expected reason.

### 11.1 Component identity red test

Add a focused `OrbPage`/journey component test that:

1. renders Android select;
2. records the canonical canvas and wrapper objects;
3. performs the user-visible slider/Next path;
4. asserts the refine scene appears;
5. asserts canvas and wrapper strict identity;
6. performs Back;
7. asserts the same identities again.

Current code must fail because select and refine create different renderer
owners.

### 11.2 Worker resize protocol red test

Extend `orbWorker.lifecycle.test.ts` to prove:

- one `init` creates the renderer;
- a later render payload with a new size changes the same OffscreenCanvas
  bitmap;
- viewport and resolution use the new dimensions;
- the resized frame is drawn before `rendered` acknowledgement;
- no dispose/context recreation occurs;
- particle payload normalization remains equivalent.

Current code must fail because the Worker does not resize the bitmap.

### 11.3 `ValenceOrb` lifetime red test

Extend `ValenceOrb.motion.test.ts` for the opt-in policy:

- render at hero size;
- rerender the same component at 120 px;
- Worker constructor remains one;
- canvas object remains identical;
- no dispose is posted;
- visual-ready state does not return to hidden/pending;
- final canvas and wrapper dimensions are correct.

Also prove the default policy still follows current behavior for other callers.

### 11.4 Particle reprojection unit test

Extract the pure, in-place size reprojection operation and test:

- normalized x/y/radius are unchanged;
- normalized velocity is unchanged;
- life/alpha/hue fields are unchanged;
- round-trip hero → mini → hero stays within floating-point tolerance;
- invalid, zero, negative, or non-finite sizes are rejected without mutation.

### 11.5 Visual contract tests

Protect exact existing values:

- hero size formula and density floors;
- refine `h-20 w-20`, inset 6, 120 px renderer, scale 0.68, brightness 0.96;
- `input-soft` select profile and canonical WebGPU-first policy;
- Bloom 320 ms/bloomOut and stage delays 140/220/360 ms;
- normal and reduced-motion behavior;
- no second canvas/Worker in Android journey mode;
- non-Android current direct ownership remains unchanged.

Tests must not be weakened to accept visual drift.

## 12. Implementation Sequence

This is the design-level sequence. A separate executable implementation plan
will name exact edits and commands after this written specification is reviewed.

1. Capture final source/status/staged-fingerprint evidence and create the
   structured test-first preflight token for the protected files.
2. Add and run the component identity, Worker resize, lifetime, and particle
   reprojection red tests.
3. Add the pure particle reprojection helper and keep its scope independent of
   React/Worker code.
4. Add the Worker same-context bitmap resize before viewport/draw/ack.
5. Split `ValenceOrb` lifetime from opt-in presentation resize while preserving
   the existing default path.
6. Add the Android persistent owner and stable host registration.
7. Extend `MiniValenceOrb` with the narrow external-renderer slot while keeping
   all existing callers on the current default.
8. Add the one-shot FLIP handoff using the existing Bloom timing/easing and the
   shared effective-motion gate.
9. Run focused green tests, typecheck, lint/diff checks, canonical Orb guard,
   visual guards, and Android generated-asset sync/build in the required order.
10. Build a new uniquely numbered benchmark candidate without overwriting any
    earlier candidate; record source/APK/installed hashes and environment.
11. Run focused semantic Next/Back identity + CDP timing; reject immediately on
    a second context, blank frame, late pop-in, visual delta, warning, or gap.
12. Run controlled final-state visual parity for paper/ink and normal/reduced
    motion.
13. Only after focused gates pass, record the promoted candidate videos and run
    the separate CDP-off Perfetto pass.
14. Only after the Orb slice is accepted, continue to the drawer/theme root
    cause and then the complete all-pages/all-controls matrix from the handoff
    plan. Do not retest the already accepted Orb page in circles unless a later
    shared change touches it.

## 13. Candidate And Evidence Rules

- Build web assets only through `npm run cap:sync:android:benchmark` and then
  `cd android && ./gradlew assembleBenchmark`.
- Do not name a new artifact candidate20–candidate28.
- Select the next free candidate number only after proving the directory is
  absent.
- Preserve each candidate in its own directory with APK SHA-256, installed
  SHA-256 before and after, environment JSON, source manifest, and
  `FIXED`/`FAIL`/`REJECTED`/`UNVERIFIED` status.
- Check the installed package path, SHA-256, package name, versionName 2.1.1,
  and versionCode 38 before any semantic click and after every accepted run.
- Stop if another process replaces the APK, changes the PID unexpectedly, or
  changes the source/staged fingerprint.
- Do not use video-derived timings as performance metrics.
- Force-stop the app and remove temporary CDP forwards after each run.

## 14. Wider Android V2 Matrix After Focused Acceptance

This renderer design is one blocking slice of the existing global plan, not a
replacement for it. After the focused candidate passes, run the complete
user-flow matrix without mock data or real user records:

- Orb: slider -1 → 0 → +1 and back, Next, refine, Back, Android Back,
  Save mood, open Diary, IME, keyboard dismissal, rapid re-entry;
- drawer/sidebar: open/close ten times and every destination from every page;
- Habits: all visible cards, add/edit/detail/sheet/modal/actions and Back paths;
- Diary: list, editor, toolbars, sheets/modals, IME, overlays, privacy-safe
  lifecycle paths;
- Planning: review/schedule/focus modes and every visible action;
- Settings: every destination, toggle, selection, modal/sheet, paper/ink and
  accessibility path;
- paper → ink → paper and ink → paper → ink;
- background/foreground five times, rotation, landscape, split-screen, safe
  areas;
- normal/reduced motion;
- en/ar/he through the full motion scenario, with all eight locales retained by
  static/i18n guards.

Each newly discovered glitch starts a new preserved evidence packet and a
root-cause slice. Do not apply one broad speculative animation refactor across
all pages.

## 15. Platform And Domain Matrix

| Surface          | Design impact               | Required evidence before final completion                                                                                                           |
| ---------------- | --------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------- |
| Android WebView  | Applies                     | Unit/component guards, exact APK/install identity, semantic emulator flow, final video, CDP, Perfetto, physical 60 Hz and 90/120 Hz devices         |
| Web/PWA          | No intended behavior change | Source/default-path proof plus focused browser/component regression; public deploy not in scope                                                     |
| iOS/WKWebView    | No intended behavior change | Source/default-path proof and build/test evidence when final blast radius is assessed; native runtime remains `UNVERIFIED` without simulator/device |
| Desktop/Tauri    | No intended behavior change | Source/default-path and desktop/sidebar regression guard; packaged runtime not in this slice                                                        |
| Store/Release    | No action authorized        | `UNVERIFIED`; no upload, release, or public claim                                                                                                   |
| Accessibility    | Applies to motion/focus     | Reduced motion, focus order/visibility, no invisible click interception, current 44 px targets, ar/he logical layout                                |
| Performance      | Applies                     | Focused CDP and separate CDP-off FrameTimeline/Perfetto, no video metrics, no quality downgrade                                                     |
| Security/Privacy | No data/auth change         | No PII/user-content diagnostics, no new dependency or permission, changed-code scan later if implementation occurs                                  |
| Storage/Sync     | N/A                         | Renderer lifecycle only; no storage/schema/API edits                                                                                                |
| Testing          | Applies                     | Red characterization, focused green, canonical/visual guards, final Android runtime proof                                                           |
| Operations       | Applies to evidence only    | Unique candidate directories, hash-bound ledgers, cleanup, rollback, no publication                                                                 |

## 16. Failure Modes And Stop Rules

| Failure                                            | Prevention                                         | Proof/response                                         |
| -------------------------------------------------- | -------------------------------------------------- | ------------------------------------------------------ |
| Canvas remount still occurs                        | Strict object-identity test                        | `FAIL`; do not tune timing                             |
| OffscreenCanvas reparent blanks or loses context   | Same host/placeholder, runtime context probes      | `STOP`; preserve evidence and return for design review |
| Resize briefly presents transparency               | Resize + draw + ack atomically                     | `FAIL` on frame/video or readback signal               |
| Particle field jumps                               | Ratio reprojection with round-trip unit test       | `REJECTED` on phase/trajectory difference              |
| Mini looks softer/sharper/different                | Final 120 px bitmap and exact current shell/filter | `REJECTED` on computed-style or pixel-envelope delta   |
| FLIP feels springy or delayed                      | Existing 320 ms bloomOut only                      | `REJECTED` on timing/easing drift                      |
| Reduced motion still animates                      | Shared effective-motion gate                       | `FAIL`                                                 |
| Hidden host intercepts taps                        | Pointer/semantic ownership tests and UIAutomator   | `FAIL`                                                 |
| A second Worker/context appears                    | Lifecycle counters and ten-cycle soak              | `REJECTED`                                             |
| Tile-memory warning or required controls disappear | Separate logcat/layer/video evidence               | `FAIL`                                                 |
| Performance improves but visual parity fails       | Dual acceptance gate                               | `REJECTED`                                             |
| Emulator passes but physical devices are absent    | Honest evidence vocabulary                         | Physical rows remain `UNVERIFIED`; no completion claim |
| User has not reviewed final video                  | Human acceptance boundary                          | Artistic/Craft and final Motion remain `UNVERIFIED`    |

## 17. Rollback

Rollback is intentionally narrow:

1. remove the Android persistent journey owner and anchor registration;
2. remove the opt-in resize policy and Worker resize branch;
3. remove the `MiniValenceOrb` external-renderer slot;
4. restore the existing direct `ValenceOrb` select and self-owned
   `MiniValenceOrb` refine paths;
5. keep diagnostic scripts/evidence only if their hashes and status remain
   truthful and separately reviewable;
6. reinstall the exact prechange baseline APK and verify its installed hash.

No Git reset, clean, stash, broad checkout, or unrelated-file rewrite is part
of rollback.

## 18. Acceptance And Completion Vocabulary

The focused implementation may be promoted only when:

- all test-first identity/resize/reprojection tests pass;
- exact final visual parity passes for paper/ink and normal/reduced motion;
- Next and Back show one continuous Orb without blank, stale, clipped, or late
  frames;
- one Worker/context survives ten cycles without accumulation;
- focused CDP and CDP-off Perfetto gates pass independently;
- installed APK identity is stable before and after accepted runs;
- no tile-memory warning, ANR, context loss, >100 ms interval, or invisible
  overlay interception occurs.

Even then, the complete Android V2 motion task remains `UNVERIFIED` until the
global all-pages/all-controls matrix, both required physical device classes,
the visual-integrity critic, and the user's review of final video are complete.

Required report rows remain separate:

| Row            | Design-time status                                                                          |
| -------------- | ------------------------------------------------------------------------------------------- |
| Technical      | `UNVERIFIED` until implementation and fresh tests/build/runtime proof                       |
| Visual Runtime | `FAIL` on the characterized baseline; candidate not built yet                               |
| Artistic/Craft | `UNVERIFIED` until final rendered evidence and user review                                  |
| Motion         | `FAIL` on the characterized baseline; candidate not built yet                               |
| Model          | `N/A` for 3D/model assets; canonical Orb model integrity is covered by visual/motion parity |
| Plan           | `READY FOR USER REVIEW` after document checks pass                                          |

## 19. Best Practices Packet

Explicit requirements:

- remove Android V2 Orb transition glitches;
- preserve exact visual design and motion quality;
- use web/primary-source research and repository evidence;
- continue into every page/control only after the focused root cause is closed;
- work SOLO and do not publish Git/release state.

Safe implied requirements included:

- preserve canonical component/renderer ownership;
- add component/Worker identity tests and particle normalization proof;
- separate visual, CDP, and Perfetto evidence;
- keep normal/reduced motion, theme, RTL, lifecycle, safe-area, and
  cross-platform blast-radius rows explicit;
- require rollback and candidate hash isolation.

Product-defining decisions not inferred:

- no new Orb look, easing, duration, color, or interaction;
- no redesign of drawer/theme, Habits, Diary, Planning, or Settings;
- no release or store action.

UNVERIFIED ledger at design time:

- persistent host reparent behavior in the target Android WebView;
- in-place OffscreenCanvas resize visual continuity on the target emulator and
  physical devices;
- final pixel/noise-envelope parity;
- final CDP/Perfetto budgets;
- physical 60 Hz and 90/120 Hz behavior;
- final human comfort and artistic acceptance.

Kill criteria:

- any unintended visual delta;
- second canvas/Worker/context;
- blank/stale/transparent frame;
- tile-memory/context-loss/ANR signal;
- no reduction of the visible 828.5 ms scene assembly failure;
- any required evidence unavailable while a PASS is being requested.

## 20. Review Gate

This document records the direction approved in chat. Product implementation
does not begin until the user reviews this written specification. After that
review, the next step is a separate executable implementation plan with exact
file edits, red/green commands, candidate numbering, evidence paths, and
checkpoints. No commit is created because the user explicitly prohibited it.

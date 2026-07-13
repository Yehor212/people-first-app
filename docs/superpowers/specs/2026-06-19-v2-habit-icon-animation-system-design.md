# V2 Habit Icon Animation System Design

## Goal

Create a production-grade habit icon system for v2 where each habit has a real vector source icon, a distinct material identity, and a complete logical micro-animation that feels closer to Telegram animated emoji than to generic app-icon bounce.

## Brief Playback

- Product: ZenFlow v2 Habits tab and habit creation surfaces.
- Visual source: current Option B / B62 liquid-glass habit pictograms in src/components/habit-pictogram/V2HabitPictogram.tsx, plus the user's selected B direction.
- Interactivity target: full production interactivity, not a static mock. Icons need idle loops, pressed/complete states, reduced-motion stills, and runtime proof.
- Hard preference: no standard emoji, no AI-template-looking icons, no generic same-motion clones.

## Current State

- Current implementation uses Phosphor React source SVG icons with B62 liquid-glass CSS treatment.
- Current proof shows 22 pictograms, 2 SVG source layers per pictogram, no mini companion glyphs, 2.8s loop metadata, and per-habit CSS storyboard motion.
- The system is high-quality for a CSS/SVG prototype, but it is not yet true Telegram-style rigged animated emoji. The missing layer is a real asset production pipeline: storyboard sheets, vector rigs, export manifests, runtime player choice, and asset QA gates.

## External Benchmark

- Telegram-style benchmark: vector animation, looped playback, short duration, high frame-rate target, strict weight budget, and complete per-object motion story.
- Lottie benchmark: JSON vector animations rendered via SVG/canvas/html. It gives strong designer-to-runtime export, but needs cleanup, quality settings, renderer choice, and memory management.
- Rive benchmark: interactive vector animations with state machines. Better for hover/tap/complete states, but adds a WASM/canvas runtime and requires a .riv asset workflow.
- Apple/web motion benchmark: motion must clarify cause/effect, avoid visual nausea, honor reduced motion, and prefer efficient transform/opacity style changes when using DOM/CSS.

## Recommended Approach

Use a hybrid phased pipeline:

1. Keep the current B62 CSS/SVG implementation as the baseline visual system and fallback.
2. Produce a 3-icon renderer spike: Drink Water, Read, Quit Smoking.
3. Compare CSS/SVG vs Lottie vs Rive on visible quality, bundle/runtime cost, cleanup, reduced motion, and platform behavior.
4. Promote one runtime path for production assets:
   - Lottie if the core need is Telegram-like looped vector emoji.
   - Rive if the core need is interactive state-machine icons with hover/tap/complete states.
   - CSS/SVG if the visual quality can be made good enough without adding runtime weight.

My recommendation is Lottie-first for the animated emoji goal, with CSS/SVG fallback always present. Rive becomes the upgrade path for completion/tap state machines if the spike proves the weight is worth it.

## Alternative Approaches

### A. CSS/SVG Only

Best for: zero new dependency, easy theming, strongest control in current codebase.

Trade-off: harder to reach Telegram-level organic rigging. Complex morphs become brittle CSS.

### B. Lottie Asset Pipeline

Best for: Telegram-style looped animated vector icons, designer-friendly export, crisp vector playback.

Trade-off: requires asset discipline, renderer cleanup, JSON weight budgets, and a production validation script.

### C. Rive State-Machine Pipeline

Best for: icons that react to hover, press, completion, streak, disabled, and celebration states.

Trade-off: Rive desktop/editor is not currently installed locally; runtime adds WASM/canvas concerns and needs platform proof.

## Icon Quality Contract

Every final icon must satisfy all of these:

- Real source vector: licensed icon base, hand-authored vector, or approved Rive/Lottie source. No emoji glyphs as final icons.
- Unique silhouette: each habit must be recognizable from shape alone at 24px, 44px, 64px, and 96px.
- Unique material cue: glass/liquid/ceramic/paper/metal/smoke/light treatment must support meaning, not just color.
- Unique motion story: each habit gets a semantic animation, not a shared bounce/float template.
- Loop complete: idle loop starts and ends seamlessly within 1.8s-3.0s.
- Logical state set: idle, press, complete, disabled, reduced-motion still.
- Performance-safe: no always-running heavy animation offscreen; pause when hidden or out of viewport.
- Accessible: decorative by default, labelled when interactive; reduced motion uses meaningful still frame.
- Theme-safe: no hardcoded colors in production CSS; use existing tokens and role variables.
- Platform-safe: Web/Vite, PWA, Android/Capacitor, iOS/WKWebView, Desktop/Tauri.

## Motion Grammar

| Habit | Core Object | Motion Story |
| --- | --- | --- |
| Drink Water | droplet vessel | fill rises, meniscus bends, ripple resolves |
| Walk Distance | paired footsteps | left/right cadence, trail glint advances |
| Exercise | barbell | compress, rebound, plate glint snaps back |
| Read | open book | page bends, line shimmer, bookmark settles |
| Meditate | neural calm orb | inhale pulse, neural line connects, glow exhales |
| Sleep | moon charm | crescent sway, star dims, night cloud drifts |
| Stretch | body figure | reach expands, spine arc softens, balance returns |
| Healthy Food | bowl | warmth orbit, steam/fresh mark lifts |
| Protein | shell/egg | shell settles, soft highlight cracks gently |
| Vitamins | capsule | capsule rolls, daily check glints |
| Brush Teeth | tooth/prism | sweep passes, sparkle clears |
| Sunlight | sunrise lens | horizon lifts, warm ray opens, glow settles |
| Touch Grass | leaf | leaf breathes, ground line anchors |
| Journal | notebook | pen trace writes, page line dries |
| Gratitude | hand/heart | heart offered upward, glow held, returns |
| Breathwork | air ribbon | inhale ribbon expands, exhale narrows |
| Phone Break | slashed phone | signal fades, slash locks, calm space appears |
| Deep Work | reticle | rings align, aperture locks, focus pulse |
| Tidy Room | broom | sweep arc clears dust, check glint lands |
| Quit Smoking | cigarette slash | smoke dissolves, ban mark stabilizes |
| Quit Drinking | clear glass | liquid steadies, clear drop falls |
| Focus | cup/steam | steam rises, focus dot pulses, cup grounds |

## Asset Contract

Preferred source layout:

- design/habit-icons/v2/motion-bible.md
- design/habit-icons/v2/source-manifest.json
- design/habit-icons/v2/HABIT_ID/artboard.svg
- design/habit-icons/v2/HABIT_ID/storyboard.png
- design/habit-icons/v2/HABIT_ID/idle.lottie.json
- design/habit-icons/v2/HABIT_ID/reduced.svg
- design/habit-icons/v2/HABIT_ID/preview.gif

Runtime layout:

- src/assets/habit-icons/v2/manifest.json
- src/assets/habit-icons/v2/HABIT_ID/idle.lottie.json
- src/assets/habit-icons/v2/HABIT_ID/reduced.svg

Initial budgets:

- Artboard: 512x512 source, exports cleanly down to 24px.
- Idle loop: 1.8s-3.0s.
- Frame-rate target: 60fps when supported; 30fps fallback acceptable only after measured proof.
- JSON budget: target <= 45KB per icon, hard stop <= 80KB before gzip unless the icon is hero-only.
- Reduced still: <= 8KB optimized SVG target.
- Runtime: only visible icons animate; offscreen icons pause.

## Runtime Contract

Create a single renderer boundary instead of scattering animation runtimes through UI code. V2HabitPictogram receives pictogramId, motionMode, state, and interactive props. The component decides css, lottie, rive, or still based on asset availability, motion permission, and performance mode.

## Tooling Decision

Available now:

- Blender is installed and can support material studies, lighting references, and optional rendered previews.
- SVGO is available through npx svgo.
- Playwright is available through @playwright/test.
- Existing app stack has React, TypeScript, Vite, Tailwind, Framer Motion, Phosphor.

Missing locally:

- Figma desktop app.
- Rive desktop app.
- After Effects / Bodymovin.
- ffmpeg, ImageMagick, Inkscape.
- Lottie/Rive runtime packages in package.json.

Plan implication:

- Do not block on desktop Rive/After Effects for the first production slice.
- Do a code/runtime spike with checked-in sample assets or small hand-authored Lottie JSON only after approval.
- Install new runtime packages only after the spike plan is accepted.

## Verification Contract

Completion requires all of:

- Unit tests prove every habit maps to source asset, storyboard, reduced still, and state support.
- Asset validator proves no emoji, no missing files, loop <= 3000ms, weight budgets, and source licenses.
- Playwright captures board screenshots at mobile and desktop sizes.
- Playwright samples frame changes over time and proves motion is not static.
- Reduced motion screenshot proves still fallback.
- Typecheck, lint, color token check, scoped tests, and build pass.
- Snyk/code scan on changed source reports no new issues.
- npm audit state is reported honestly; existing unrelated advisories do not get hidden.

## Non-Goals

- Do not redesign the entire Habits page.
- Do not replace the canonical orb family.
- Do not ship heavy video/raster loops as the main icon runtime.
- Do not make AI-generated final icons.
- Do not install broad design software through GUI without explicit confirmation.

## Open Decisions

- Whether final runtime should be Lottie, Rive, or CSS/SVG after the 3-icon spike.
- Whether to create assets in a paid design tool or keep everything in repo-authored vector source.
- Whether completion animation should be part of the same icon asset or a separate celebration layer.

## Approval Gate

Implementation should start only after this design is accepted or edited by the user.

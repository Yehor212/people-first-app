# V2 Habit Icon Motion Bible

## Contract

- Final icons are original vector Lottie models, not emoji, not generated bitmap art, not stock/library icon conversions.
- No face, person, smiley, emoji, head, mood, or emotion glyph sources in habit icons. Avoid even metadata part names that contain those words.
- One habit equals one bundled `idle.lottie.json` plus one generated `reduced.svg` fallback from the same model.
- The app must not rebuild icons from DOM motion layers; semantic action lives inside the Lottie timeline.
- Authoring frame rate: 60fps. Composition: 512x512. Idle loop: <=3.0s / <=180 frames.
- No artificial quality cap: layer count, path count, and animation channels must be driven by the object story and reference-quality bar. Delivery limits are checked per target; Telegram/TGS export must fit the official 64KB compressed sticker budget, while in-app review may carry richer source JSON as long as runtime proof stays smooth.
- Allowed Lottie features: vector shape paths, rects, ellipses, fills, gradient fills, strokes, trim paths, transforms, opacity, and precomposed vector assets only when the target renderer supports them and quality gates inspect them.
- Forbidden features: images, text layers, fonts, masks, effects, expressions, star-shape primitive, stock/icon-font source geometry.
- Motion must read as the object performing the habit action, not as a generic float/pulse. Every icon must define `animationGrammar`, `primaryMotion`, and `storyboard` metadata.
- Every timeline uses four markers: `anticipation`, `primary-action`, `follow-through`, `settle`.
- The read icon is the current complexity bar: 286 layers, 1717 shape records, 2252 animated channels, original first-party geometry, and a bounded hinged page turn that morphs across the spine while page thickness, hinge tension, tonal paper sweep, bookmark, and trim-path text respond. The failed oversized slab attempt, escaped thin line/fold-line artifacts, loose blob shapes, and reference-rig A/B path are explicitly rejected as future templates and must remain covered by machine gates.
- All assets remain review-first candidates until the user approves them on the localhost review route. Passing machine metrics is not approval if the frame strip visually reads as low quality.

## Object Stories

| id            | object story                                                                                 |
| ------------- | -------------------------------------------------------------------------------------------- |
| drink-water   | water rises inside a glass vessel, meniscus flexes, bubbles lift, ripple settles             |
| walk-distance | left sole plants, toes roll, right sole follows, path dashes and dust react                  |
| exercise      | barbell dips under load, plates compress, grip rebounds, power glint snaps across            |
| read          | page lifts from spine, curls, crosses, casts shadow, and settles into opposite page          |
| meditate      | pebble base settles, breath halos expand, neural dots connect, calm wave resolves            |
| sleep         | crescent sways behind drifting clouds while stars dim and haze settles                       |
| stretch       | elastic anchors pull outward, center tension stretches, snap rebounds, recovery wave relaxes |
| healthy-food  | warm bowl breathes, steam threads rise, leaf lifts, grains bounce, warmth halo closes        |
| protein       | egg shell wobbles, crack opens, yolk rebounds, glint passes, settle ring lands               |
| vitamins      | capsule halves roll together, seam aligns, daily check draws, highlight seals the dose       |
| brush-teeth   | brush pad sweeps across tooth, foam clears, clean line draws, enamel glint resolves          |
| sunlight      | sun core rises over horizon, rays unfold, warm band spreads, morning spark appears           |
| touch-grass   | leaf blade inhales, stem grounds, dew lifts and glints, breeze arc releases                  |
| journal       | notebook page shifts, pen writes strokes, ink dot lands, cover settles                       |
| gratitude     | paper note lifts, ribbon knot tightens, folds breathe, offering glow returns                 |
| breathwork    | inhale ribbon expands, exhale ribbon narrows, air pockets trade rhythm, pulse settles        |
| phone-break   | screen dims, signal bars collapse, lock slab lands, slash sweeps, calm gap opens             |
| deep-work     | aperture rings align, crosshair locks, scan line passes, focus dot snaps still               |
| tidy-room     | broom handle arcs, bristles sweep, dust trail breaks apart, clean flash lands                |
| quit-smoking  | ember contracts, smoke curls up, ash falls, ban ring draws, diagonal sweep cuts through      |
| quit-drinking | glass steadies, liquid line lowers, clear drop falls, reset ring closes                      |
| focus         | cup grounds, coffee plane warms, steam threads rise, focus dot locks, attention ring settles |

## Review Gate

- Use `/people-first-app/habit-lottie-review?dev=true&icon=<id>` for direct inspection.
- The first review should inspect the large focused icon, not only the grid thumbnail.
- Approval is visual and explicit. Passing tests proves the contract, not final taste.

## Accepted Direction Notes

### Drink Water v9 Clean Premium Direction

- User accepted the overall neatness baseline on 2026-06-21; v9 makes the stream read as water first: visible aqua jet body, irregular torn sides, falling beads, splash crown, and impact droplets. This is still not production approval.
- Required water grammar: one clean crystal tumbler, visible turbulent aqua water jet, translucent body, bright core, torn water edges, falling beads, micro-glints, entry splash crown, impact droplets, meniscus response, horizontal impact ripples, internal wavelets, subtle liquid flow lines, caustics/refraction, and proof frames that show the physical action clearly.
- Reject for future water iterations: thin white-thread streams, invisible/too-subtle streams, solid blue drop/spike streams, blue ribbon/strip reads, white-dot bubble fields, carafe/back-wave/liquid-plinth mass, generic float/pulse, loose blobs, noisy metric-padding layers, emoji/face/person treatment, stock/traced geometry, or any composition that becomes less precise just to add complexity.
- The target feeling is premium, accurate, and tool-assisted: each icon should read as one coherent animated object, with complexity hidden inside motion/material quality rather than exposed as clutter.

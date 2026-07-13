# V2 Habit Icons: Option B No-Mini Motion Plan

## Goal

Remove the visible mini companion glyph from every Option B v2 habit pictogram while preserving the liked main liquid-glass icons. Replace generic companion/bounce treatment with per-habit semantic storyboard motion that can be verified in DOM, CSS, tests, and screenshots.

## Design Contract

- Main icon stays: two licensed Phosphor SVG render layers only, `source-fill-relief` and `source-hero-glyph`.
- Mini icon is gone: no `source-accent-glyph`, no `accent-object-stage`, no third SVG.
- Motion is semantic: every habit owns a distinct storyboard name and keyframes tied to its meaning.
- Motion stays performant: CSS animates `transform` and `opacity`, uses existing theme tokens, and respects reduced-motion rules.
- V2 only: no broad shell/router/storage changes.

## Per-Habit Motion Storyboards

- Drink water: droplet fill and ripple.
- Walk: alternating footstep cadence.
- Exercise: weighted rep compress and release.
- Read: page turn flip.
- Meditate: calm neural breath pulse.
- Sleep: moon sway with star dim.
- Stretch: reach and return.
- Healthy food: warm bowl orbit.
- Protein: shell settle.
- Vitamins: capsule roll and check.
- Brush teeth: sweep sparkle.
- Sunlight: sunrise lift.
- Touch grass: leaf breathe into ground.
- Journal: pen line write.
- Gratitude: heart offering glow.
- Breathwork: inhale/exhale ribbon.
- Phone break: signal cut and fade.
- Deep work: reticle lock focus.
- Tidy room: broom sweep finish.
- Quit smoking: smoke dissolve.
- Quit drinking: glass steady clear drop.
- Focus: coffee steam loop.

## Execution

1. Update focused tests first so current code fails on mini-icon and missing storyboard layers.
2. Update `V2HabitPictogram` metadata and DOM: remove `AccentIcon`, add storyboard attrs and three CSS-only frame layers.
3. Update active B62 CSS: remove companion glyph rules, add semantic frame layers, per-habit storyboard variables, and 22 keyframe blocks.
4. Update dependent tests in template picker and hero empty journey to expect two SVGs.
5. Verify with focused tests, broader checks where practical, and Playwright/browser evidence for v2.

## Evidence Target

- Unit tests prove all supported pictograms render two SVGs and zero mini-glyph layers.
- CSS tests prove every habit has a distinct storyboard and multi-checkpoint keyframes.
- Runtime screenshot/DOM evidence proves the v2 habit surfaces show no mini icons.

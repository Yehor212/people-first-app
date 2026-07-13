# Walk Distance Telegram-Grade Production Contract

## Goal
Create a walk-distance sneaker animated sticker that can sit next to the provided Telegram book TGS without looking cheaper, sketchier, or procedurally drawn.

## Explicit Requirements From User
- Study the provided reference: `/Users/yehor/Downloads/telegram-animoji.tgs`.
- Sneakers must be visually similar in craft level to the Telegram book.
- Animation must be as thoughtful and complex, not a simple wiggle.
- Be maximally strict against the result.
- Use necessary tools and install/apply missing ones when justified.
- Do not use code-drawn art as the final source.
- Add missing requirements that are necessary for a finished result.

## Inferred Necessary Requirements
- Final source must be an editable motion-design source, not only a JS generator: preferred `.aep + Bodymovin-TG`; fallback `.glaxnimate` authored/edited in Glaxnimate.
- Final runtime must contain no raster images, no APNG/PNG fallback, no masks/effects/text layers/3D layers/expressions/unsupported Telegram features.
- Proof must include side-by-side frames against the book and an independent renderer check, not only local confidence.
- Human visual approval is required before replacing app assets. Metrics can reject; metrics cannot approve taste alone.

## Reference Findings
- Telegram book file: 512x512, 60fps, 179 frames, 55,475 bytes.
- Reference layer count: 48.
- Reference shape types: {"gr":319,"sh":287,"st":283,"tr":319,"tm":29,"fl":11,"gf":22}.
- Reference has 93 distinct keyframe times, with large synchronized bursts at frames 2(92), 127(74), 160(54), 172(54), 104(49), 65(48), 38(46), 43(43).
- The book is not just one object moving; it is a staged stack of pages/text/cover parts with overlapping phase changes.

## Current v14 Prototype Status
- File: `output/walk-distance-telegram-grade-v14/rig/walk-distance-v14.tgs`.
- Editable prototype export: `output/walk-distance-telegram-grade-v14/proof/glaxnimate/walk-distance-v14.glaxnimate`.
- Extended audit report: `output/walk-distance-telegram-grade-v14/audit/v14-extended-audit.json`.
- Extended side-by-side board: `output/walk-distance-telegram-grade-v14/audit/v14-extended-audit-board.png`.
- Glaxnimate render proof: `output/walk-distance-telegram-grade-v14/proof/glaxnimate/frame-090.png`.

### What It Proves
- It can be a valid TGS under 64KB.
- It can pass a 14-frame strict structural/visual metric gate against the book.
- It opens/renders through Glaxnimate.

### Why It Is Not Final
- The source art was still produced by a JS generator, which violates the latest user requirement.
- It has 22 layers versus the book's 48; motion is more complex than previous attempts but still less authored.
- The silhouette is smaller/lighter than the book, so visual parity is not proven by metrics alone.
- It needs real authoring polish in Glaxnimate/After Effects: hand-adjusted curves, timing, and secondary motion.

## Final Production Plan

### Phase 1: Locked Reference And Quality Contract
- Keep `book-motion-study.json`, audit reports, and side-by-side boards as the benchmark.
- Acceptance: all reference metrics are reproducible from the local TGS.
- Verification: run the reference study script and strict audit without errors.

### Phase 2: Authoring Source, Not Code Source
- Open/import the prototype or rebuild from the still concept in Glaxnimate.
- Save an editable `.glaxnimate` source where layers are named by shoe part: outsole, midsole, upper, heel, toe, tongue, laces, eyelets, road, shadows.
- Remove dependence on `scripts/generate-walk-distance-telegram-v14.cjs` as the production source. It may remain as historical prototype evidence only.
- Acceptance: the production source exists and can export TGS without invoking the generator.
- Verification: `glaxnimate source.glaxnimate --export final.tgs --export-format tgs`.

### Phase 3: Motion Polish
- Add phase-based walk motion: contact squash, heel lift, toe roll, weight transfer, rear shoe follow-through, lace/tongue lag, road slide, shadow compression, loop return.
- Match the book's authored timing pattern: several active bursts, not one uniform sinusoidal move.
- Acceptance: no long dead section; extended frame diff does not reveal static spans.
- Verification: strict audit with frames `0,12,20,36,45,60,72,90,105,120,135,150,165,178`.

### Phase 4: Visual Polish
- Make the sneaker read as a premium sticker object: thick silhouette, clean material masses, low noise, confident curves, no sketchy thin clutter.
- Keep the palette in the book family: blue/white/gray/cream with one warm lace accent.
- Acceptance: side-by-side board does not look cheaper than the book at 512px.
- Verification: compare `final-audit-board.png` against the Telegram book board and inspect at 1x scale.

### Phase 5: Final Gate Before App Integration
- Final TGS <= 64KB.
- Canvas 512x512, 60fps, <= 180 frames.
- No forbidden Telegram features.
- No raster assets.
- No bbox touches canvas edge on proof frames.
- Semi-transparent share <= 3x reference.
- Edge density <= 1.6x reference.
- Motion diff >= 0.8x reference unless storyboard documents a better reason.
- Browser preview renders without blank frames or console errors.
- User visually approves.

## Risks
- Without After Effects/Bodymovin-TG, Glaxnimate is the best available local fallback, not the official Telegram production path.
- Auto-generated vectors can pass metrics while still feeling less premium; manual source editing remains necessary.
- A shoe has naturally more contour noise than a book, so visual polish must reduce detail rather than add clutter.

## Current Decision
Do not integrate v14 into `src/assets`. Use it as a prototype and authoring baseline only. The next valid finish line is an editable Glaxnimate/AE-authored source plus exported TGS and proof package.

## UNVERIFIED
- True hand-authored production source: not complete yet.
- Human visual approval: not complete yet.
- App integration: intentionally not done.

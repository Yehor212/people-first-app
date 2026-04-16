# Standards Research: Living Entries & Arousal Foundation

**Epic:** 7 — Living Entries & Arousal Foundation
**Date:** 2026-04-14
**Domains:** Emotion modeling, GLSL shaders, deterministic visual hashing, CSS animation

---

## 1. Russell's Circumplex Model of Affect (1980)

| Aspect | Detail |
|--------|--------|
| **Source** | Russell, J.A. (1980). "A Circumplex Model of Affect" |
| **Two axes** | Valence (pleasant–unpleasant, X-axis), Arousal (high–low energy, Y-axis) |
| **Circle mapping** | Pleasure 0°, Excitement 45°, Arousal 90°, Distress 135°, Displeasure 180°, Depression 225°, Sleepiness 270°, Relaxation 315° |
| **Implementation** | Emotions as (valence, arousal) coordinates in [-1,1] × [0,1] space |
| **Key insight** | Joy/excitement = high arousal + positive valence; contentment = low arousal + positive valence; anxiety = high arousal + negative valence; sadness = low arousal + negative valence |

**Application to Epic 7:** Arousal lookup table maps ~40 emotion tags to arousal values (0–1). Combined with existing valence, provides full circumplex coordinates for visual differentiation.

---

## 2. Superformula SDF (Signed Distance Field) for Shape Morphing

| Aspect | Detail |
|--------|--------|
| **Source** | Johan Gielis (2003), Superformula generalization of superellipse |
| **GLSL pattern** | `superformula(theta, m, n1, n2, n3)` — 4 parameters control shape |
| **Morphing** | Interpolate SDF distances: `mix(sdf1, sdf2, morphFactor)` |
| **Seed-based variation** | Offset (m, n1, n2, n3) by deterministic seed → unique shapes per entry |
| **Performance** | Single-pass fragment shader, no geometry — GPU-efficient |

**Application to Epic 7:** `uSeed` uniform offsets superformula params to create unique glyph shapes. Morphing between shapes during crystallization animation.

---

## 3. Deterministic Visual Hashing (Identicons / LifeHash)

| Aspect | Detail |
|--------|--------|
| **Pattern** | Hash(metadata) → fixed visual. Same input = same output, always |
| **LifeHash** | SHA-256 → 16×16 seed → Conway's Game of Life → unique icon |
| **Identicons** | Hash → geometric grid pattern (GitHub-style) |
| **UMMON Glyph** | Grid pattern from metadata (domain, status, urgency) |
| **Key property** | Collision resistance: different inputs → visually distinct outputs |

**Application to Epic 7:** `entryToVisualParams()` hashes (id + date + valence + content.length + arousal + timeOfDay) → `EntryVisualParams` that deterministically drives glyph generation.

---

## 4. CSS Aging / Patina Effects

| Aspect | Detail |
|--------|--------|
| **Pattern** | Progressive CSS filters based on temporal distance |
| **Technique** | `sepia()`, `brightness()`, `contrast()` filters — GPU-composited, zero layout cost |
| **Overlay effects** | `::before`/`::after` pseudo-elements for texture (coffee rings, fold lines) |
| **Performance** | CSS-only, no JavaScript, CLS = 0 when using `filter` (not changing dimensions) |

---

## 5. Breath-Synchronized Animation

| Aspect | Detail |
|--------|--------|
| **Pattern** | CSS `@keyframes` with `transform: scale()` at sub-pixel amplitude |
| **Accessibility** | Must respect `prefers-reduced-motion` media query |
| **Arousal mapping** | Period inversely proportional to arousal: calm (16s) → energized (8s) |
| **Performance** | `transform` and `opacity` are compositor-only — 60 FPS guaranteed |

---

## Sources

- [Russell's Circumplex Models — PSU Textbook](https://psu.pb.unizin.org/psych425/chapter/circumplex-models/)
- [Circumplex Model — Psychology Fanatic](https://psychologyfanatic.com/circumplex-model-of-arousal-and-valence/)
- [Morphing Shapes with SDF in GLSL — Medium](https://medium.com/@den4icccccc/morphing-geometric-shapes-with-sdf-in-glsl-fragment-shaders-and-visualization-in-jetpack-compose-48fd8d403e24)
- [GPU-SuperFormula3D — GitHub](https://github.com/matsune/GPU-SuperFormula3D)
- [UMMON Glyph UI — GitHub](https://github.com/HighLibrarian/UMMON-Glyph-UI)
- [LifeHash Visual Hash — GitHub](https://github.com/BlockchainCommons/lifehash.info)
- [Identicons and Visual Hashing — Terry Kwon](https://terrykwon.com/blog/visual-hashing/)

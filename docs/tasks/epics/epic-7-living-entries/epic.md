# Epic 7: Living Entries & Arousal Foundation

**Status:** Backlog
**Created:** 2026-04-14
**Source:** [Diary Revolution Research](../../reference/research/2026-04-14-diary-revolution.md)
**Priority:** High

---

## Goal

Transform each diary entry from a static text record into a unique living visual artifact by introducing the arousal dimension (Russell's Circumplex Model) and generating deterministic emotional glyphs, aging effects, and breath-synchronized paper. This Epic is the foundation for all other revolution Epics — arousal computation and visual params pipeline are prerequisites for the Emotional Canvas (Epic 8) and Multi-Sensory Input (Epic 9).

---

## Scope

### In Scope

- **Arousal Axis** (Critical): Compute arousal (0-1) from existing StateOfMind emotion tags via lookup table. Add `uniform float uArousal` to shader. No new UI needed — existing tag selection already captures the data
- **entryToVisualParams() Pipeline** (Critical): Deterministic hash of entry metadata (id + date + valence + content.length + arousal + timeOfDay) → `EntryVisualParams` interface that drives all visual generation
- **Emotional Glyph Generation** (Critical): Add `uniform float uSeed` to `orbShader.frag`. Hash entry metadata into seed that offsets superformula params (m, n1, n2, n3). Render 128x128 offscreen canvas → store as base64 WebP in IndexedDB
- **Glyph Crystallization Animation** (High): After save, orb performs 2s animation — breathing slows, shape locks, glow intensifies, shrinks to glyph that flies to entry card
- **Entry Aging / Patina** (High): CSS filters per entry age. Recent = crisp. Week = sepia(0.03). Month = sepia(0.08) brightness(0.98). Quarter = sepia(0.15). Year = sepia(0.25) + overlay pseudo-elements (coffee rings, fold lines, foxing)
- **Breath-Synced Paper** (High): CSS `paper-breathe` keyframe on diary paper card. Scale 1.0 → 1.005 → 1.003 → 0.998. Period driven by arousal (16s calm → 8s energized)
- **Glyph in Journal List**: Replace mood dots with glyph thumbnails in entry cards
- **Fullscreen Glyph View**: Tap glyph → fullscreen with slow rotation
- **Deterministic Uniqueness**: Same entry → same visual. Always. No two entries share visuals

### Out of Scope

- Living Ink Diffusion (Epic 8 — Emotional Canvas)
- Emotional Weather System (Epic 8)
- Multi-sensory input modes (Epic 9)
- New entry types or quick check-in (Epic 1)
- Constellation/timeline visualizations (Epic 3)

---

## Success Criteria

- Glyph generation < 200ms per entry (128x128 offscreen canvas)
- Same entry always produces identical glyph (deterministic hash verification across 1000 entries)
- No two entries with different metadata produce visually identical glyphs
- Aging CSS filters cause zero layout shift (CLS = 0)
- Breath-sync animation runs at 60 FPS with zero jank on mid-range Android
- `uArousal` properly differentiates: anxious (-0.7v, 0.8a) vs sad (-0.6v, 0.2a) produce visibly different orb behaviors
- Base64 glyph storage < 5KB per entry (WebP at 128x128)
- Crystallization animation completes in 2s ± 200ms

---

## Dependencies

### Technical Dependencies

- **orbShader.frag**: Existing GLSL shader — add `uSeed` + `uArousal` uniforms
- **orbShader.ts**: Bridge file — pass new uniforms to shader
- **ValenceOrb.tsx**: Existing orb component — extend for crystallization animation + mini mode
- **StateOfMind**: Existing emotion tag selection — provides tags for arousal lookup
- **IndexedDB**: `journalEntries` table — store base64 glyph thumbnail field

### Epic Dependencies

- **Blocks**: Epic 8 (Canvas uses arousal for weather/ink intensity), Epic 9 (input modes generate visual params)
- **Blocked by**: None (foundational Epic)

---

## Risks and Mitigations

| Risk                                                          | Impact | Probability | Mitigation Strategy                                                              |
| ------------------------------------------------------------- | ------ | ----------- | -------------------------------------------------------------------------------- |
| GPU performance on low-end Android for offscreen glyph render | Medium | Low         | 128x128 canvas, single-frame render (not real-time), WebGL context reuse         |
| Shader uniform count increase breaks older GPUs               | Low    | Low         | Only 2 new uniforms (uSeed, uArousal), well within GL limits                     |
| Base64 storage bloat in IndexedDB                             | Medium | Low         | 128x128 WebP ≈ 2-5KB per entry, lazy generation on first view                    |
| Aging filter overlay pseudo-elements performance              | Low    | Low         | CSS only, GPU-composited, virtually zero cost                                    |
| Breath-sync paper causes motion sickness                      | Medium | Medium      | Respect `prefers-reduced-motion`, scale amplitude 0.005 is imperceptible to most |

---

## Metrics

- **Glyph Generation Time**: Target: < 200ms, Measurement: performance.mark/measure in useGlyphGenerator
- **Storage Per Entry**: Target: < 5KB, Measurement: IndexedDB storage audit
- **Animation FPS**: Target: 60 FPS, Measurement: Chrome DevTools Performance panel
- **Arousal Differentiation**: Target: visually distinct for all 4 quadrants, Measurement: manual QA across 8 representative emotions

---

## Architecture Impact

### Components Affected

- `orbShader.frag` — add `uSeed`, `uArousal` uniforms, seed-offset noise functions
- `orbShader.ts` — bridge new uniforms from React to GLSL
- `ValenceOrb.tsx` — crystallization animation, mini-orb mode (24px)
- `JournalEntryCard.tsx` — glyph thumbnail replaces mood dot
- `types.ts` — `EntryVisualParams` interface, `arousal` field on JournalEntry

### New Components

- `src/utils/entryToVisualParams.ts` — deterministic hash → visual parameters pipeline
- `src/utils/arousalLookup.ts` — emotion tag → arousal (0-1) mapping table
- `src/components/diary/EmotionalGlyph.tsx` — glyph display component + fullscreen view
- `src/hooks/useGlyphGenerator.ts` — offscreen canvas rendering + base64 storage
- `src/styles/entry-aging.css` — aging filter classes (week/month/quarter/year) + overlay pseudo-elements
- `src/styles/paper-breathe.css` — breath-sync keyframe animation

### Technical Decisions

- Deterministic hashing ensures reproducibility without storing visual state
- Offscreen canvas (not WebGL) for glyph thumbnail — simpler, more compatible
- CSS-only aging — zero JavaScript, zero performance cost
- Arousal lookup table (not ML) — instant, deterministic, no dependencies

---

## User Stories

User Stories created separately via story-creator skill.

---

## Phases

1. Arousal lookup table (emotion tag → arousal mapping, ~40 emotions)
2. `entryToVisualParams()` pipeline (deterministic hash + `EntryVisualParams` interface)
3. Shader uniforms (`uSeed` + `uArousal` in orbShader.frag + bridge)
4. Glyph generator hook (offscreen canvas → base64 WebP → IndexedDB)
5. EmotionalGlyph component (display in card + fullscreen view)
6. Crystallization animation (orb → glyph transition, 2s)
7. Entry aging / patina (CSS filter classes + overlay pseudo-elements)
8. Breath-synced paper (CSS keyframe, period from arousal)
9. Integration: glyph thumbnails in JournalEntryList (replace mood dots)

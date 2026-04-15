# EP8_US001: Living Ink Diffusion

**Epic:** [Epic 8: Emotional Canvas](../../epic.md)
**Status:** Backlog
**Priority:** P0
**Complexity:** High
**Created:** 2026-04-14

---

## Goal

Make each typed word trigger a colored ink drop that diffuses across the diary canvas, turning the writing space into a unique emotional painting. Positive words produce warm colors, negative words produce cool colors, and overlapping drops blend together — so by the time you finish writing, the paper itself is a visual record of your emotional journey.

## Acceptance Criteria

### AC1: Ink Drop Spawning

- [ ] Each word boundary (space/enter after characters) triggers a single ink drop at the cursor's approximate position on the canvas overlay
- [ ] Ink drop appears within 1 frame of word completion (no perceptible delay)
- [ ] Drop starts as a small circle (8px radius) and diffuses outward to 40-80px over 2 seconds

### AC2: Emotional Color Mapping

- [ ] Positive-valence words (e.g., "happy", "love", "grateful") produce warm colors (orange/yellow from orb spectrum)
- [ ] Negative-valence words (e.g., "sad", "angry", "worried") produce cool colors (purple/blue from orb spectrum)
- [ ] Neutral words produce subtle gray-tinted drops (visible but muted)
- [ ] Emotional valence lexicon contains at minimum 1500 English words with valence scores

### AC3: Ink Blending & Composition

- [ ] Overlapping ink drops blend together using `mix-blend-mode: multiply` (or Canvas 2D equivalent)
- [ ] Blended areas create new intermediate colors (warm + cool = rich mid-tones)
- [ ] Canvas overlay composites cleanly over all 6 existing paper textures without obscuring text

### AC4: Performance

- [ ] Ink diffusion renders at 60 FPS during active typing on capable devices
- [ ] Canvas memory usage stays under 5MB for a single entry session (up to 500 words)
- [ ] Canvas overlay does not interfere with text selection, cursor movement, or editor interactions

## Test Strategy

(Planned separately by test planner)

## Technical Notes

### Affected Components

- `src/components/diary/LivingInkCanvas.tsx` — NEW: Canvas 2D overlay for ink diffusion
- `src/hooks/useLivingInk.ts` — NEW: word-boundary detection + ink drop spawning logic
- `src/utils/emotionalLexicon.ts` — NEW: valence lexicon (~1500 words, ~2KB, extensible per language)
- `JournalEntryEditor.tsx` — MODIFIED: add canvas overlay layer

### Architecture Decisions

- Canvas 2D (not WebGL) — simpler, better battery, sufficient for 2D radial gradient diffusion
- On-device valence lexicon (not API) — instant, offline-first, privacy-preserving
- Radial gradient for diffusion — mathematically simple, GPU-friendly, visually organic
- `mix-blend-mode: multiply` compositing — preserves paper texture underneath

### orchestratorBrief

```
tech: "React, Canvas 2D API, TypeScript"
keyFiles: "src/components/diary/LivingInkCanvas.tsx, src/hooks/useLivingInk.ts, src/utils/emotionalLexicon.ts, JournalEntryEditor.tsx"
approach: "Canvas 2D overlay on editor with radial gradient ink drops spawned per word boundary, colored by valence lexicon lookup"
complexity: "High (Canvas 2D animation loop + lexicon + editor integration)"
```

### Dependencies

- None (foundation story for Epic 8)

### Risks

- Canvas overlay z-index must not block editor interactions (pointer-events: none on canvas)
- RTL languages (ar, he) — word-boundary detection must work bidirectionally
- Large entries (500+ words) — ink drops must be pruned or composited to flat texture to stay under 5MB

## Context

This is the **foundation story** for Epic 8 (Emotional Canvas). The emotional valence lexicon created here is reused by US003 (Weather System) and US006 (Weather Badge). The Canvas 2D overlay pattern established here is extended by US005 (Ink Preservation). Getting ink diffusion right at 60 FPS sets the performance standard for the entire Epic.

**Dependency chain:** US001 (this) → US003 (weather needs lexicon), US005 (preservation needs ink data).

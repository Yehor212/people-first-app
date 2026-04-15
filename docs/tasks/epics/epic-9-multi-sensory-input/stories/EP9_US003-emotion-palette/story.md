# EP9_US003: Emotion Palette Painting

**Epic:** Epic 9 — Multi-Sensory Input
**Priority:** P0 (High-impact mode)
**Complexity:** High
**Status:** Backlog
**Created:** 2026-04-14

---

## User Story

As a journal user, I want to finger-paint with emotion-mapped colors on a full-screen canvas so that I can express feelings that words alone cannot capture and create a unique visual artifact for my entry.

---

## Acceptance Criteria

1. **Given** I select the Paint mode, **When** the canvas opens, **Then** I see a full-screen painting surface with an emotion color palette (red/orange = anger/energy, blue/purple = sadness/calm, yellow/green = joy/growth)
2. **Given** I am painting, **When** I draw strokes on the canvas, **Then** the strokes respond to my finger pressure and velocity, producing thicker/thinner lines accordingly
3. **Given** I have finished painting, **When** I view the entry later, **Then** my painting replays as a stroke-by-stroke animation
4. **Given** I have entries with paintings, **When** I browse the journal list, **Then** I see a thumbnail preview of each painting on the entry card

---

## Test Strategy

(Planned separately by test planner)

---

## Technical Notes

- Component: `src/components/diary/EmotionPalette.tsx`
- Hook: `src/hooks/useEmotionPalette.ts` — stroke capture, pressure handling, color mapping
- Canvas 2D full-screen, capped at 512x512 internal resolution (memory management)
- Stroke data: `{ x, y, pressure, velocity, color, timestamp }[]` — compressed, not bitmap
- `PointerEvent` API for cross-device compatibility (touch + mouse + stylus)
- Pressure: `pointerEvent.pressure` (0.0-1.0), fallback to 0.5 fixed
- Replay: iterate stored strokes with original timing for animation
- Thumbnail: render strokes to small canvas (64x64) for journal list
- Color histogram: count pixels per color bucket for mood score derivation
- Storage: < 5KB typical per entry (stroke array)
- i18n: color names, painting instructions in all 8 languages
- Standards research: `docs/research/rsh-003-multi-sensory-input-standards.md` §2

---

## Dependencies

- **Blocked by:** EP9_US001 (mode selector must exist)

---

## orchestratorBrief

```
tech: "React 18, TypeScript, Canvas 2D, PointerEvent API, Dexie"
keyFiles: "src/components/diary/EmotionPalette.tsx, src/hooks/useEmotionPalette.ts, types.ts, db.ts"
approach: "Full-screen canvas, PointerEvent stroke capture, compressed stroke storage, replay renderer"
complexity: "High (pressure-responsive drawing + replay animation + thumbnail generation + storage)"
```

# EP9_US002: Body Map Touch

**Epic:** Epic 9 — Multi-Sensory Input
**Priority:** P0 (High-impact mode)
**Complexity:** High
**Status:** Backlog
**Created:** 2026-04-14

---

## User Story

As a journal user, I want to tap on a body silhouette to mark where I feel emotions physically so that I can connect my emotional state to bodily sensations and track somatic patterns over time.

---

## Acceptance Criteria

1. **Given** I select the Body mode, **When** the body map opens, **Then** I see a gender-neutral full-body SVG silhouette centered on screen
2. **Given** the body map is displayed, **When** I tap or press on a body region (head, throat, chest, stomach, shoulders, hands, legs), **Then** a heat map overlay appears at that region with color intensity proportional to my tap pressure or duration
3. **Given** I have marked body regions, **When** I save the entry, **Then** the body map data is stored with the entry and I can see my body map when reviewing the entry
4. **Given** I have multiple entries with body map data, **When** I open "Your Body Over Time" view, **Then** I see a cumulative heat map showing my chronic tension patterns across all entries

---

## Test Strategy

(Planned separately by test planner)

---

## Technical Notes

- Based on Nummenmaa et al., "Bodily maps of emotions," PNAS 2014 (emBODY method)
- Component: `src/components/diary/BodyMapTouch.tsx`
- Hook: `src/hooks/useBodyMap.ts` — touch region detection, heat accumulation
- SVG silhouette: abstract, gender-neutral, no detailed facial/body features (cultural sensitivity)
- Canvas 2D overlay with Gaussian blur for heat map rendering
- Touch response < 16ms target (60 FPS canvas)
- Touch Events API: `touch.force` for pressure, fallback to tap duration for intensity
- 7 regions: head, throat, chest, stomach, shoulders, hands, legs
- Storage: `{ region: string, intensity: number }[]` — < 2KB per entry
- Cumulative view: aggregate `bodyMap` arrays across entries, normalize intensities
- i18n: body region labels in all 8 languages
- Standards research: `docs/research/rsh-003-multi-sensory-input-standards.md` §1

---

## Dependencies

- **Blocked by:** EP9_US001 (mode selector must exist)

---

## orchestratorBrief

```
tech: "React 18, TypeScript, Canvas 2D, SVG, Touch Events API, Dexie"
keyFiles: "src/components/diary/BodyMapTouch.tsx, src/hooks/useBodyMap.ts, types.ts, db.ts"
approach: "SVG silhouette + canvas overlay, touch region hit-testing, Gaussian blur heat, IndexedDB storage"
complexity: "High (canvas rendering + touch precision + cumulative view + schema migration)"
```

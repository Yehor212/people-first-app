# EP9_US004: Scribble Express

**Epic:** Epic 9 — Multi-Sensory Input
**Priority:** P1 (Medium)
**Complexity:** Medium
**Status:** Backlog
**Created:** 2026-04-14

---

## User Story

As a journal user, I want to draw a quick single-line abstract scribble so that I can release emotions through spontaneous gesture and see what my drawing reveals about my emotional state.

---

## Acceptance Criteria

1. **Given** I select the Scribble mode, **When** the canvas opens, **Then** I can draw one continuous line with my finger for 5-15 seconds
2. **Given** I finish my scribble (lift finger or time expires), **When** analysis completes, **Then** I see an emotion interpretation based on my gesture patterns (e.g., tight loops = anxiety, wide curves = expansiveness, zigzags = frustration) within 500ms
3. **Given** I have completed a scribble, **When** I save the entry, **Then** the scribble drawing and its analysis result are stored as an entry artifact and visible on review

---

## Test Strategy

(Planned separately by test planner)

---

## Technical Notes

- Component: `src/components/diary/ScribbleExpress.tsx`
- Hook: `src/hooks/useScribbleAnalysis.ts` — direction changes, loops, speed analysis
- Util: `src/utils/scribbleFeatureExtraction.ts` — geometric analysis of stroke path
- Research: PeerJ 2024, Nature Scientific Reports 2024 (gesture-emotion correlations)
- Single continuous stroke: `pointerdown` → `pointermove` → `pointerup`
- Feature extraction: curvature, angular velocity, path length ratio, self-intersection (loops)
- Pattern classification: heuristic-based (no ML), transparent and debuggable
- Analysis latency target: < 500ms after drawing end
- Timer: 5-15 second window, visual countdown indicator
- Storage: stroke points + feature vector + classification result, < 3KB
- i18n: emotion labels, instructions in all 8 languages
- Standards research: `docs/research/rsh-003-multi-sensory-input-standards.md` §3

---

## Dependencies

- **Blocked by:** EP9_US001 (mode selector must exist)

---

## orchestratorBrief

```
tech: "React 18, TypeScript, Canvas 2D, PointerEvent API"
keyFiles: "src/components/diary/ScribbleExpress.tsx, src/hooks/useScribbleAnalysis.ts, src/utils/scribbleFeatureExtraction.ts"
approach: "Single-stroke canvas capture, geometric feature extraction, heuristic emotion classification"
complexity: "Medium (feature extraction algorithm + real-time analysis + timer UX)"
```

# EP9_US005: Rhythm Tapping

**Epic:** Epic 9 — Multi-Sensory Input
**Priority:** P1 (Medium)
**Complexity:** Medium
**Status:** Backlog
**Created:** 2026-04-14

---

## User Story

As a journal user, I want to tap the screen rhythmically and see water ripples respond to my touch so that I can express my emotional tempo and create a visual pattern that captures my state of mind.

---

## Acceptance Criteria

1. **Given** I select the Tap mode, **When** I tap the screen, **Then** each tap creates a water ripple animation emanating from the tap point at 60 FPS
2. **Given** I am in a tapping session (10-30 taps), **When** I finish tapping, **Then** I see a composite ripple pattern combining all my taps into a single visual artifact
3. **Given** I complete a tapping session, **When** analysis runs, **Then** I see an emotional tempo reading based on my tap pattern (anxious/contemplative/grounded)
4. **Given** I save the entry, **When** I review it later, **Then** I see the composite ripple pattern and tempo reading as part of the entry

---

## Test Strategy

(Planned separately by test planner)

---

## Technical Notes

- Component: `src/components/diary/RhythmTapping.tsx`
- Hook: `src/hooks/useRhythmTapping.ts` — tap timing, ripple spawning, rhythm analysis
- Canvas 2D for ripple animation, must handle 30 simultaneous ripples at 60 FPS
- Tap data: `{ timestamp, x, y, pressure }[]`
- Analysis: inter-tap intervals, regularity (coefficient of variation), acceleration/deceleration
- Classification: fast frantic = anxious, slow deliberate = contemplative, steady rhythmic = grounded
- Composite visual: overlay all ripple rings at final state → entry artifact
- Auto-stop after 30 taps or manual stop button
- Storage: tap array + rhythm features + classification, < 2KB
- i18n: tempo labels, instructions in all 8 languages
- Standards research: `docs/research/rsh-003-multi-sensory-input-standards.md` §4

---

## Dependencies

- **Blocked by:** EP9_US001 (mode selector must exist)

---

## orchestratorBrief

```
tech: "React 18, TypeScript, Canvas 2D, requestAnimationFrame"
keyFiles: "src/components/diary/RhythmTapping.tsx, src/hooks/useRhythmTapping.ts"
approach: "Tap event capture, ripple animation pool, inter-tap interval analysis, composite render"
complexity: "Medium (60 FPS multi-ripple animation + rhythm analysis + composite snapshot)"
```

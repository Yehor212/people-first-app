# EP7_US005: Glyph Crystallization Animation

**Epic:** 7 — Living Entries & Arousal Foundation
**Priority:** P1 (High)
**Complexity:** High
**Status:** Backlog
**Created:** 2026-04-14

---

## 1. User Story Statement

**As a** journaler who just saved a diary entry,
**I want** to see the orb transform into my entry's unique glyph,
**So that** the save moment feels special and meaningful.

---

## 2. Acceptance Criteria

- **AC1:** Given I save an entry, when the save completes, then the orb performs a ~2s crystallization animation (breathing slows, shape locks, glow intensifies)
- **AC2:** Given the crystallization completes, when the glyph forms, then it shrinks and flies to the entry card position in the journal list
- **AC3:** Given I have `prefers-reduced-motion` enabled, when I save an entry, then the glyph appears instantly without animation

---

## 3. Technical Notes

### Architecture

- Extend `ValenceOrb.tsx` with crystallization mode: `isCrystallizing` prop triggers animation sequence
- Animation sequence: breathing slows → shape locks (freeze superformula params) → glow intensifies → shrink to 24px → fly to target position via CSS transform
- Use `requestAnimationFrame` for smooth 60 FPS animation
- Target position: read entry card DOM rect via ref callback
- Mini-orb mode (24px) for the glyph thumbnail in entry card

### Standards Research

- SDF morphing: interpolate between orb SDF and glyph SDF using `mix(sdf1, sdf2, morphFactor)`
- Animation timing: 2s ± 200ms per Epic Success Criteria
- Full research: `docs/research/rsh-004-living-entries-standards.md` §2

### Key Files

- `src/components/orb/ValenceOrb.tsx` (modify — crystallization mode)
- `src/components/diary/JournalEntryCard.tsx` (modify — glyph target position ref)
- `src/hooks/useCrystallization.ts` (new — animation orchestration hook)

---

## 4. Dependencies

- **Blocked by:** EP7_US003 (arousal-aware orb), EP7_US004 (glyph generation)
- **Blocks:** None

---

## 5. Test Strategy

(Planned separately by test planner)

---

## 6. Out of Scope

- Glyph generation logic (US004)
- Glyph storage (US004)
- Journal list integration (US008)

---

## 7. Design Notes

The crystallization should feel like a "moment of capture" — the living orb energy condensing into a permanent artifact. Think: water freezing into crystal. The fly-to animation connects the emotional moment to its permanent record.

---

## 8. Orchestrator Brief

```
orchestratorBrief: {
  tech: "TypeScript, React, CSS transforms, requestAnimationFrame",
  keyFiles: ["src/components/orb/ValenceOrb.tsx", "src/hooks/useCrystallization.ts", "src/components/diary/JournalEntryCard.tsx"],
  approach: "Orchestrate 2s animation: orb freeze → glow → shrink → fly-to-card using rAF + CSS transforms",
  complexity: "High (multi-phase animation, position calculation, reduced-motion support)"
}
```

---

## 9. Story Points

**Estimate:** 8 SP

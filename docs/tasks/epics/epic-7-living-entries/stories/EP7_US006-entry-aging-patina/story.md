# EP7_US006: Entry Aging Patina

**Epic:** 7 — Living Entries & Arousal Foundation
**Priority:** P1 (High)
**Complexity:** Low
**Status:** Backlog
**Created:** 2026-04-14

---

## 1. User Story Statement

**As a** journaler browsing my past entries,
**I want** older entries to develop a visual patina like aging paper,
**So that** I can feel the passage of time and my diary feels like a living artifact.

---

## 2. Acceptance Criteria

- **AC1:** Given an entry saved today, when I view it, then it appears crisp with no aging effects
- **AC2:** Given an entry saved 1+ weeks ago, when I view it, then it shows subtle warm toning
- **AC3:** Given an entry saved 3+ months ago, when I view it, then it shows visible paper aging (sepia, texture overlays)
- **AC4:** Given aging effects are applied, when the entry renders, then there is zero cumulative layout shift (CLS = 0)

---

## 3. Technical Notes

### Architecture

- Create `src/styles/entry-aging.css` — CSS-only aging filter classes
- Aging tiers based on entry age:
  - Fresh (< 1 week): no filter
  - Week: `sepia(0.03)`
  - Month: `sepia(0.08) brightness(0.98)`
  - Quarter: `sepia(0.15)`
  - Year+: `sepia(0.25)` + overlay pseudo-elements (coffee rings, fold lines, foxing)
- All via CSS `filter` property — GPU-composited, zero layout cost
- Overlay pseudo-elements (`::before`, `::after`) for Year+ tier — absolute positioned, no layout impact
- Utility function: `getAgingClass(entryDate: Date): string`

### Standards Research

- CSS filters are GPU-composited — zero layout shift when only using filter/opacity/transform
- Pseudo-element overlays must be `position: absolute` to avoid CLS
- Full research: `docs/research/rsh-004-living-entries-standards.md` §4

### Key Files

- `src/styles/entry-aging.css` (new)
- `src/utils/getAgingClass.ts` (new)
- `src/components/diary/JournalEntryCard.tsx` (modify — apply aging class)

---

## 4. Dependencies

- **Blocked by:** None (independent of arousal pipeline)
- **Blocks:** None

---

## 5. Test Strategy

(Planned separately by test planner)

---

## 6. Out of Scope

- Aging effects on glyph thumbnails (only entry cards)
- User-configurable aging speed
- Reversing aging effects

---

## 7. Design Notes

Aging should be subtle and beautiful — never "damaged." Think: beloved old book, not neglected paper. The Year+ overlay textures (coffee rings, fold lines) should be randomized per entry using the entry's deterministic seed for variety.

---

## 8. Orchestrator Brief

```
orchestratorBrief: {
  tech: "CSS, TypeScript",
  keyFiles: ["src/styles/entry-aging.css", "src/utils/getAgingClass.ts", "src/components/diary/JournalEntryCard.tsx"],
  approach: "CSS-only filter classes per age tier + pseudo-element overlays for Year+ entries",
  complexity: "Low (CSS-only, no JS animation, zero CLS)"
}
```

---

## 9. Story Points

**Estimate:** 2 SP

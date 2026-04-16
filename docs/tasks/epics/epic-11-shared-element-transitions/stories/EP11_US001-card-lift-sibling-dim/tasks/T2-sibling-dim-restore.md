# T2: Sibling Dim to 60% + Restore Stagger

**Story:** [EP11_US001](../story.md) | **Type:** Implementation | **Status:** Todo | **Priority:** P0 | **Estimate:** 3h | **Parallel Group:** 1

## Goal
Dim non-selected cards to 60% opacity when an entry is selected, and restore with stagger when editor closes.

## Acceptance Criteria
- [ ] Non-selected cards dim to 60% opacity (150ms ease) — `verify: inspect (opacity animation)`
- [ ] Restore to 100% on back/close with 40ms stagger per card — `verify: inspect (stagger restore)`
- [ ] Dim applies to both normal list and AI search results — `verify: inspect (both motion.div containers)`
- [ ] CSS opacity only (GPU-composited) — `verify: inspect (no layout-triggering properties)`
- [ ] `prefers-reduced-motion`: instant dim/restore — `verify: inspect (useReducedMotion conditional)`

### Affected Components
- `src/features/journal/JournalEntryList.tsx` — manage activeEntryId context for dim
- `src/features/journal/JournalModule.tsx` — pass activeEntryId

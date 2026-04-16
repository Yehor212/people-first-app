# EP11_US001: Card Lift & Sibling Dim on Selection

**Epic:** [Epic 11: Shared-Element Transitions](../../epic.md)
**Status:** To Review
**Priority:** P0
**Complexity:** Medium
**Created:** 2026-04-15

---

## Goal

When a user selects an entry card in the sidebar, the card visually lifts (increased shadow + z-index) while sibling cards dim to 60% opacity, creating a clear focus effect that prepares for the card→editor morph transition.

## Acceptance Criteria

### AC1: Card Lift Effect

- [ ] Selected card elevates with increased box-shadow (mood-colored glow intensifies)
- [ ] Card z-index increases above siblings during selection
- [ ] Lift animation uses spring physics (100ms, springPresets.snappy)
- [ ] Lift happens on click/tap, before editor opens

### AC2: Sibling Dim

- [ ] All non-selected cards in the list dim to 60% opacity
- [ ] Dim animation uses 150ms ease transition
- [ ] When editor closes (back), siblings restore to 100% opacity with 200ms stagger
- [ ] Dim applies to both expanded sidebar and AI search results list

### AC3: Active Card Indicator (Persistent)

- [ ] While an entry is open in the editor, its card in the sidebar maintains a subtle mood-colored ring (1px)
- [ ] Background uses mood gradient at 12% opacity (vs 8% default)
- [ ] Accent bar pulses gently (opacity 0.6↔1.0, 2s cycle)
- [ ] Active indicator works in both expanded and compact sidebar modes

### AC4: Reduced Motion & Performance

- [ ] `prefers-reduced-motion`: no lift animation, instant dim/restore, static active indicator (no pulse)
- [ ] Dim uses CSS opacity only (GPU-composited, no layout reflow)
- [ ] 60fps maintained during lift + dim with 20+ visible cards

## Technical Notes

### Affected Components

- `src/features/journal/JournalEntryCard.tsx` — add lift state, active indicator
- `src/features/journal/JournalEntryList.tsx` — manage `activeEntryId` context for sibling dim
- `src/features/journal/JournalModule.tsx` — pass `activeEntryId` to list component

### Dependencies

- None (foundation for Epic 11, uses existing card components)

### Blocks

- EP11_US002 (card→editor morph starts from lifted card)

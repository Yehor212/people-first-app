# T1: Card Lift on Selection

**Story:** [EP11_US001](../story.md) | **Type:** Implementation | **Status:** Todo | **Priority:** P0 | **Estimate:** 3h | **Parallel Group:** 1

## Goal
Add visual lift effect (shadow + z-index increase) to the selected entry card when user clicks to open it.

## Acceptance Criteria
- [ ] Selected card shadow intensifies (mood glow increases) on click — `verify: inspect (boxShadow change)`
- [ ] Card z-index raises above siblings — `verify: inspect (z-index or zIndex style)`
- [ ] Lift uses springPresets.snappy (400/30), ~100ms — `verify: command (grep 'snappy' src/features/journal/JournalEntryCard.tsx)`
- [ ] Lift triggers on click, before editor opens — `verify: inspect (onClick sequence)`

### Affected Components
- `src/features/journal/JournalEntryCard.tsx` — add lift state on selection

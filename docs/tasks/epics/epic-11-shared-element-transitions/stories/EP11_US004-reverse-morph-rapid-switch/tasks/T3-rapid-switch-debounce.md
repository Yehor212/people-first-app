# T3: Rapid Switch Debounce + Morph Interruption

**Story:** [EP11_US004](../story.md) | **Type:** Implementation | **Status:** Todo | **Priority:** P1 | **Estimate:** 3h | **Parallel Group:** 2

## Goal
Handle rapid entry switching (clicking multiple entries quickly) without flicker, duplicate layoutId errors, or stale content.

## Acceptance Criteria
- [ ] Clicking entry B while A morphs: morph redirects to B — `verify: inspect (state machine interrupt in useEntryTransition)`
- [ ] No duplicate layoutId warnings in console — `verify: inspect (console clean)`
- [ ] Editor content swaps without flash of stale content — `verify: inspect (key-based content swap)`
- [ ] Click same entry while open: no effect — `verify: inspect (early return)`
- [ ] Undo-delete toast survives morph transitions — `verify: inspect (toast independence)`

### Affected Components
- `src/hooks/useEntryTransition.ts` — rapid switch handling
- `src/features/journal/JournalModule.tsx` — debounced entry selection

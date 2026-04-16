# T4: Sidebar State Awareness for Morph Origin

**Story:** [EP11_US002](../story.md) | **Type:** Implementation | **Status:** Todo | **Priority:** P1 | **Estimate:** 3h | **Parallel Group:** 2

## Goal
Make morph origin adapt to sidebar state: morph from full card when expanded, from mood dot when compact, no morph when hidden.

## Acceptance Criteria
- [ ] Expanded sidebar: morph starts from full card position — `verify: inspect (layoutId on card wrapper active)`
- [ ] Compact sidebar: morph starts from mood dot position — `verify: inspect (layoutId on dot active)`
- [ ] Hidden sidebar: no morph, editor fades in directly — `verify: inspect (no layoutId when hidden)`
- [ ] Morph crosses ResizeHandle boundary correctly — `verify: inspect (portal if needed)`

### Affected Components
- `src/features/journal/JournalModule.tsx` — conditional layoutId based on sidebarState

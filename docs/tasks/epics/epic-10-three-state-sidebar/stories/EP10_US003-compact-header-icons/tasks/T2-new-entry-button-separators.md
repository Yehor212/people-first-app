# T2: New Entry Button + Separators + RTL

**Story:** [EP10_US003](../story.md) | **Type:** Implementation | **Status:** Todo | **Priority:** P0 | **Estimate:** 3h | **Parallel Group:** 1

## Goal
Add "+" new entry button at bottom of compact sidebar, visual separators between sections, and ensure RTL correctness.

## Acceptance Criteria
- [ ] "+" icon at bottom, fixed position, always visible — `verify: inspect (mt-auto or sticky bottom)`
- [ ] Click creates new entry and opens editor — `verify: inspect (onClick calls handleNewEntry)`
- [ ] Tooltip: localized "New entry" — `verify: inspect (tooltip text uses t())`
- [ ] Divider between header icons and mood dots, and between dots and "+" — `verify: inspect (border-border/20 elements)`
- [ ] RTL: layout mirrors correctly — `verify: inspect (isRTL conditional or logical properties)`

### Affected Components
- `src/features/journal/SidebarCompact.tsx` — add footer + separators

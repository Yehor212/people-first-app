# T1: Header Icons with Tooltips + Action Wiring

**Story:** [EP10_US003](../story.md) | **Type:** Implementation | **Status:** Todo | **Priority:** P0 | **Estimate:** 3h | **Parallel Group:** 1

## Goal
Add Diary (PenLine), Stats (BarChart3), Settings (Settings) icons stacked vertically at top of compact sidebar with tooltips and click handlers.

## Acceptance Criteria
- [ ] 3 icons stacked vertically with gap-1 — `verify: inspect (3 button elements)`
- [ ] Each has tooltip on hover (localized) — `verify: inspect (tooltip with t() text)`
- [ ] Diary: expands sidebar; Stats: opens stats; Settings: opens settings — `verify: inspect (onClick handlers)`
- [ ] Touch targets >= 44px — `verify: inspect (min-w-[44px] min-h-[44px])`
- [ ] `aria-label` on each — `verify: command (grep 'aria-label' src/features/journal/SidebarCompact.tsx | wc -l)`

### Affected Components
- `src/features/journal/SidebarCompact.tsx` — add header section

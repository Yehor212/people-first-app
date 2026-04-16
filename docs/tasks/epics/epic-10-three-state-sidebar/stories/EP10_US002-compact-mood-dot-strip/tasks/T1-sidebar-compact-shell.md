# T1: Create SidebarCompact Shell

**Story:** [EP10_US002 — Compact Sidebar: Mood Dot Strip](../story.md)
**Type:** Implementation
**Status:** Todo
**Priority:** P0
**Estimate:** 3h
**Parallel Group:** 1

---

## Goal

Create the SidebarCompact component — a fixed 48px-wide sidebar shell that renders independently of PanelLayout when sidebar state is "compact".

## Acceptance Criteria

- [ ] `SidebarCompact.tsx` renders as a fixed 48px-wide div on the start edge — `verify: command (grep 'w-12\|48px' src/features/journal/SidebarCompact.tsx)`
- [ ] Renders only when `sidebarState === "compact"` — `verify: inspect (conditional render in JournalModule)`
- [ ] Has `bg-card border-e border-border/30` matching expanded sidebar style — `verify: inspect (className matches)`
- [ ] Correct z-index layering (below modals, above content) — `verify: inspect (z-index value)`
- [ ] RTL: renders on right edge with `border-s` instead of `border-e` — `verify: inspect (isRTL conditional)`

### Affected Components

- `src/features/journal/SidebarCompact.tsx` — NEW
- `src/features/journal/JournalModule.tsx` — conditionally render SidebarCompact

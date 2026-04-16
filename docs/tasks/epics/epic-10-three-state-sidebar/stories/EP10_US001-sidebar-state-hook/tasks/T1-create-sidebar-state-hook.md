# T1: Create useSidebarState Hook

**Story:** [EP10_US001 — Sidebar State Hook & Keyboard Shortcuts](../story.md)
**Type:** Implementation
**Status:** Todo
**Priority:** P0
**Estimate:** 3h
**Parallel Group:** 1

---

## Goal

Create the `useSidebarState` hook that manages a three-state sidebar model (expanded/compact/hidden) with localStorage persistence, replacing the current binary `sidebarCollapsed` boolean.

## Acceptance Criteria

- [ ] Hook exports `sidebarState: "expanded" | "compact" | "hidden"` and `setSidebarState` — `verify: command (grep 'sidebarState' src/hooks/useSidebarState.ts)`
- [ ] State persists via `storageSetRaw(SK.JOURNAL_SIDEBAR_STATE)` and restores on mount — `verify: inspect (localStorage key set on state change)`
- [ ] Default state on first visit: `expanded` — `verify: inspect (fallback value in hook)`
- [ ] Convenience booleans exported: `isExpanded`, `isCompact`, `isHidden` — `verify: command (grep -c 'isExpanded\|isCompact\|isHidden' src/hooks/useSidebarState.ts)`
- [ ] `toggleSidebar()` cycles: expanded → compact → hidden → expanded — `verify: inspect (toggle logic in hook)`

## Technical Approach

1. Create `src/hooks/useSidebarState.ts`
2. Define `SidebarState = "expanded" | "compact" | "hidden"` type
3. Use `useState` with initializer reading from `storageGetRaw(SK.JOURNAL_SIDEBAR_STATE, "expanded")`
4. `setSidebarState` wrapper that also calls `storageSetRaw`
5. `toggleSidebar()` implements cycle logic
6. Export convenience booleans derived from state
7. Add `JOURNAL_SIDEBAR_STATE` to `src/lib/storageKeys.ts`

**Pattern Hint:** 4 existing `useHydrate*` hooks in `src/hooks/` use similar localStorage bridging pattern. Review for reuse.

### Affected Components

- `src/hooks/useSidebarState.ts` — NEW
- `src/lib/storageKeys.ts` — add key

### Related

- Depends on: nothing (foundation)
- Blocks: T2 (keyboard shortcuts use this hook), T3 (integration)

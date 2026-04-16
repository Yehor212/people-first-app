# EP10_US001: Sidebar State Hook & Keyboard Shortcuts

**Epic:** [Epic 10: Three-State Sidebar](../../epic.md)
**Status:** Backlog
**Priority:** P0
**Complexity:** Medium
**Created:** 2026-04-15

---

## Goal

Create the `useSidebarState` hook that manages the three-state sidebar model (expanded/compact/hidden) with keyboard shortcuts and localStorage persistence, providing the foundation for all other Epic 10 stories.

## Acceptance Criteria

### AC1: Three-State Model

- [ ] Hook exports `sidebarState: "expanded" | "compact" | "hidden"` and `setSidebarState` setter
- [ ] State transitions follow cycle: expanded → compact → hidden → expanded
- [ ] State persists across sessions via `storageSetRaw(SK.JOURNAL_SIDEBAR_STATE)`
- [ ] Default state on first visit: `expanded`

### AC2: Keyboard Shortcuts

- [ ] `Ctrl+\` (or `⌘\` on Mac) toggles expanded ↔ compact
- [ ] `Ctrl+Shift+\` toggles compact ↔ hidden
- [ ] Shortcuts only fire when diary module is open (not globally)
- [ ] Shortcuts work in both LTR and RTL layouts

### AC3: Integration with PanelLayout

- [ ] When state is `expanded`: PanelLayout panel is expanded (current behavior)
- [ ] When state is `compact`: PanelLayout panel is collapsed (0px), SidebarCompact renders as fixed 48px div
- [ ] When state is `hidden`: PanelLayout panel is collapsed (0px), no SidebarCompact
- [ ] Toggle button in editor header cycles through all three states

### AC4: Accessibility

- [ ] `aria-expanded` reflects current state on toggle buttons
- [ ] Focus moves to sidebar content on expand, to editor on collapse
- [ ] `prefers-reduced-motion` has no effect on state logic (only on animations in US004/US005)

## Technical Notes

### Affected Components

- `src/hooks/useSidebarState.ts` — NEW hook
- `src/features/journal/JournalModule.tsx` — replace `sidebarCollapsed` boolean with `useSidebarState`
- `src/features/journal/JournalEntryEditor.tsx` — update `sidebarCollapsed` prop to `sidebarState`
- `src/lib/storageKeys.ts` — add `JOURNAL_SIDEBAR_STATE` key

### Architecture

The hook replaces the current binary `sidebarCollapsed: boolean` with a three-state enum. The compact state renders OUTSIDE `react-resizable-panels` — PanelLayout only knows expanded vs hidden. The hook coordinates both systems.

```
useSidebarState() → { sidebarState, setSidebarState, toggleSidebar, isCompact, isExpanded, isHidden }
```

### Dependencies

- None (foundation story)

### Blocks

- EP10_US002 (Compact Mood Dot Strip needs state hook)
- EP10_US003 (Compact Header Icons needs state hook)
- EP10_US004 (Animation needs state transitions)

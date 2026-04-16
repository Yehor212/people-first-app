# T3: Integrate Hook into JournalModule + Editor

**Story:** [EP10_US001 — Sidebar State Hook & Keyboard Shortcuts](../story.md)
**Type:** Implementation
**Status:** Todo
**Priority:** P0
**Estimate:** 4h
**Parallel Group:** 2

---

## Goal

Replace the binary `sidebarCollapsed: boolean` state in JournalModule and JournalEntryEditor with the new `useSidebarState` hook, updating all references to use the three-state model.

## Acceptance Criteria

- [ ] `JournalModule.tsx` uses `useSidebarState()` instead of `useState<boolean>(sidebarCollapsed)` — `verify: command (grep -c 'useSidebarState' src/features/journal/JournalModule.tsx)`
- [ ] PanelLayout collapse/expand calls mapped to three-state: `isExpanded` → panel expanded, `isCompact || isHidden` → panel collapsed — `verify: inspect (panel collapse logic)`
- [ ] Toggle button cycles through all three states (not just two) — `verify: inspect (onClick handler uses toggleSidebar)`
- [ ] `JournalEntryEditor.tsx` prop changed from `sidebarCollapsed?: boolean` to `sidebarState: SidebarState` — `verify: command (grep 'sidebarState' src/features/journal/JournalEntryEditor.tsx)`
- [ ] Editor sidebar toggle button works with three states — `verify: inspect (PanelLeftOpen/Close icon logic)`
- [ ] `aria-expanded` reflects correct state on all toggle buttons — `verify: inspect (aria-expanded value)`
- [ ] Focus management: focus moves to sidebar on expand, to editor on collapse — `verify: inspect (requestAnimationFrame focus call)`

## Technical Approach

1. Import `useSidebarState` in JournalModule
2. Replace `const [sidebarCollapsed, setSidebarCollapsed] = useState(...)` with `const { sidebarState, isExpanded, isCompact, isHidden, toggleSidebar } = useSidebarState()`
3. Update PanelLayout `onCollapse`/`onExpand` callbacks to set correct state
4. Update toggle button onClick: call `toggleSidebar()` 
5. Update Editor prop: `sidebarState={sidebarState}` instead of `sidebarCollapsed={sidebarCollapsed}`
6. Update Editor's internal toggle button to use three-state logic
7. Remove old `SK.JOURNAL_SIDEBAR_COLLAPSED` key usage (replaced by `SK.JOURNAL_SIDEBAR_STATE`)

### Affected Components

- `src/features/journal/JournalModule.tsx` — replace boolean state
- `src/features/journal/JournalEntryEditor.tsx` — update prop type + toggle logic

### Related

- Depends on: T1 (hook must exist), T2 (keyboard shortcuts wired through hook)
- Blocks: EP10_US002, US003, US004, US005 (all need three-state in place)

# T2: LayoutGroup + AnimatePresence Wrapper

**Story:** [EP10_US005](../story.md) | **Type:** Implementation | **Status:** Todo | **Priority:** P0 | **Estimate:** 3h | **Parallel Group:** 1

## Goal
Wrap sidebar states in framer-motion LayoutGroup and AnimatePresence to enable cross-component layoutId morphing.

## Acceptance Criteria
- [ ] `LayoutGroup` wraps both expanded sidebar and SidebarCompact — `verify: command (grep 'LayoutGroup' src/features/journal/JournalModule.tsx)`
- [ ] `AnimatePresence mode="wait"` ensures old state unmounts before new mounts — `verify: inspect (mode prop)`
- [ ] No duplicate layoutId warnings in console during state transitions — `verify: inspect (console check)`
- [ ] LayoutGroup does not interfere with existing PanelLayout — `verify: inspect (render order)`

### Affected Components
- `src/features/journal/JournalModule.tsx` — wrap with LayoutGroup + AnimatePresence

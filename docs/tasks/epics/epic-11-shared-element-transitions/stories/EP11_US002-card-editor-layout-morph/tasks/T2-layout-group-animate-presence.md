# T2: LayoutGroup + AnimatePresence in JournalModule

**Story:** [EP11_US002](../story.md) | **Type:** Implementation | **Status:** Todo | **Priority:** P0 | **Estimate:** 3h | **Parallel Group:** 1

## Goal
Setup LayoutGroup and AnimatePresence in JournalModule to enable cross-panel layoutId morphing between sidebar cards and editor.

## Acceptance Criteria
- [ ] `LayoutGroup` wraps sidebar + editor panels — `verify: command (grep 'LayoutGroup' src/features/journal/JournalModule.tsx)`
- [ ] `AnimatePresence mode="popLayout"` for cross-fade between entries — `verify: inspect (mode prop value)`
- [ ] Entry switching morphs directly (A→B without reverting) — `verify: inspect (key-based switching)`
- [ ] No interference with existing PanelLayout resize — `verify: inspect (render hierarchy)`

### Affected Components
- `src/features/journal/JournalModule.tsx` — wrap with LayoutGroup + AnimatePresence

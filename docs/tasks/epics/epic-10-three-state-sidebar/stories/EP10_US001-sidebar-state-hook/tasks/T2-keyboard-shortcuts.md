# T2: Add Keyboard Shortcuts

**Story:** [EP10_US001 — Sidebar State Hook & Keyboard Shortcuts](../story.md)
**Type:** Implementation
**Status:** Todo
**Priority:** P0
**Estimate:** 3h
**Parallel Group:** 1

---

## Goal

Add keyboard shortcuts for sidebar state toggling: `Ctrl+\` (or `⌘\` on Mac) for expanded↔compact, `Ctrl+Shift+\` for compact↔hidden. Shortcuts only active when diary module is open.

## Acceptance Criteria

- [ ] `Ctrl+\` / `⌘\` toggles expanded ↔ compact — `verify: inspect (keydown handler checks key and modifier)`
- [ ] `Ctrl+Shift+\` toggles compact ↔ hidden — `verify: inspect (shift modifier branching)`
- [ ] Shortcuts only fire when diary module is open (scoped to JournalModule mount) — `verify: inspect (useEffect cleanup removes listener)`
- [ ] Mac detection: uses `⌘` instead of `Ctrl` via `e.metaKey` — `verify: inspect (metaKey || ctrlKey check)`
- [ ] Works in both LTR and RTL layouts — `verify: inspect (no direction-dependent key logic)`

## Technical Approach

1. Add `useEffect` in `useSidebarState` (or separate `useSidebarKeyboard` called from JournalModule)
2. Listen for `keydown` on `document`
3. Check `e.key === "\\"` (backslash) with `e.ctrlKey || e.metaKey`
4. With Shift: toggle compact↔hidden; without Shift: toggle expanded↔compact
5. `e.preventDefault()` to prevent browser default
6. Cleanup on unmount

**Pattern Hint:** Existing keyboard handler pattern in `JournalModule.tsx` lines 114-137 (Escape key). Follow same structure.

### Affected Components

- `src/hooks/useSidebarState.ts` — add keyboard effect (or new `useSidebarKeyboard.ts`)

### Related

- Depends on: T1 (hook provides state + toggle)
- Blocks: nothing

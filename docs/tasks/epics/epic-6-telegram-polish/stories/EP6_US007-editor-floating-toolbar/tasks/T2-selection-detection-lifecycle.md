# T2: Selection Detection & Toolbar Lifecycle

**Epic:** [Epic 6 — Telegram-Level Polish](../../../../epics/epic-6-telegram-polish/epic.md)
**User Story:** [EP6_US007 Editor Floating Toolbar](../story.md)
**Related:** T1 (toolbar component), T3 (format actions)
**Parallel Group:** 2

---

## Context

### Current State

- `DiaryFormatToolbar.tsx` has basic `window.getSelection()` usage but lacks:
  - 100ms debounce on selection changes
  - Scroll-dismiss behavior (immediate unmount)
  - Tap-outside dismiss (100ms fade)
  - Reposition on selection change with spring delay

### Desired State

- Robust selection lifecycle: debounced show, repositioned on change, dismissed on scroll/tap-outside.
- Matches Telegram toolbar behavior (RSH-001 section 8).

### Inherited Assumptions

- **A1 (UX):** 100ms debounce prevents toolbar flicker during rapid selection changes (RSH-001).

---

## Implementation Plan

### Phase 1: Debounced Selection Detection

- [ ] Listen to `selectionchange` event on document
- [ ] Debounce 100ms before showing toolbar (prevents flicker during selection drag)
- [ ] Validate: selection must be non-empty AND within editor element

### Phase 2: Dismiss Behaviors

- [ ] `scroll` event on editor container → immediate unmount (no animation)
- [ ] Click-outside detection → 100ms exit animation via `AnimatePresence`
- [ ] Selection collapsed (cursor, no range) → dismiss

### Phase 3: Reposition on Change

- [ ] On `selectionchange` (while toolbar visible): update position with 60ms spring delay
- [ ] Use `requestAnimationFrame` to batch position updates
- [ ] Ensure position updates use same viewport clamping logic from T1

---

## Technical Approach

### Recommended Solution

**Library:** Framer Motion v11 + standard DOM events
**Existing:** `DiaryFormatToolbar.tsx` selection logic

### Key APIs

- `document.addEventListener("selectionchange", handler)` — selection tracking
- Debounce utility (existing or simple timeout-based)
- `editor.addEventListener("scroll", handler)` — scroll dismiss

### Implementation Pattern

```pseudocode
useEffect:
  ON selectionchange (debounced 100ms):
    sel = window.getSelection()
    IF sel.rangeCount > 0 AND !sel.isCollapsed AND isWithinEditor(sel):
      rect = sel.getRangeAt(0).getBoundingClientRect()
      setToolbarPos(computePosition(rect))
      setVisible(true)
    ELSE: setVisible(false)

  ON scroll (editor): setVisible(false) // immediate
  ON click-outside: setVisible(false) // via AnimatePresence exit

  CLEANUP: remove all listeners
```

### Why This Approach

- Debounce prevents toolbar flash during text selection drag
- Scroll dismiss matches Telegram/iOS behavior

### Patterns Used

- Event listener cleanup in useEffect return (project convention)
- Debounced event handler (prevents UI flicker)
- Ref-stable callback pattern (avoids stale closure)

---

## Acceptance Criteria

- [ ] **Given** I select text in the editor, **When** selection stabilizes (~100ms), **Then** toolbar appears above selection.
- [ ] **Given** toolbar is visible, **When** I scroll the editor, **Then** toolbar dismisses immediately (no animation).
- [ ] **Given** toolbar is visible, **When** I tap outside the toolbar and editor, **Then** toolbar fades out (100ms).
- [ ] **Given** I expand my selection, **When** the range changes, **Then** toolbar repositions smoothly (60ms delay).
- [ ] **Given** I collapse selection (just cursor), **Then** toolbar dismisses.

---

## Affected Components

### Implementation

- `src/features/journal/DiaryFormatToolbar.tsx` — upgrade selection lifecycle, add debounce/dismiss
- `src/features/journal/JournalEntryEditor.tsx` — provide editor ref for scroll listener

---

## Existing Code Impact

### Refactoring Required

- `DiaryFormatToolbar.tsx` — refactor selection detection to use debounced listener pattern

### Tests to Update

- None expected

---

## Definition of Done

- [ ] All acceptance criteria met
- [ ] All event listeners cleaned up on unmount
- [ ] No memory leaks (AbortController or explicit removal)
- [ ] NO new tests created

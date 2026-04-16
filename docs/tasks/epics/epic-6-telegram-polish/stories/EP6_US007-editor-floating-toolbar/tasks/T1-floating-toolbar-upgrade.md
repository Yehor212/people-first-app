# T1: FloatingToolbar Upgrade & Portal

**Epic:** [Epic 6 — Telegram-Level Polish](../../../../epics/epic-6-telegram-polish/epic.md)
**User Story:** [EP6_US007 Editor Floating Toolbar](../story.md)
**Related:** T2 (selection lifecycle), T3 (format actions)
**Parallel Group:** 1

---

## Context

### Current State

- `DiaryFormatToolbar.tsx` **already exists** as a "Telegram-style floating WYSIWYG toolbar" with:
  - `window.getSelection()` for selection detection
  - Formatting actions (bold, italic, etc.)
  - Basic positioning logic
- However, it lacks: portal rendering, proper entrance/exit animation, viewport clamping, z-[80] layering.

### Desired State

- Upgrade existing `DiaryFormatToolbar` with:
  - `createPortal(toolbar, document.body)` to escape transform ancestors
  - Entrance: 150ms fade + translateY(8→0) via Framer Motion
  - Dismissal: immediate on scroll, 100ms fade on tap-outside
  - Viewport clamping (never renders off-screen)
  - z-[80] per RSH-001 section 8

### Inherited Assumptions

- **A1 (ARCHITECTURE):** `DiaryFormatToolbar.tsx` is the single toolbar component — enhance, don't replace.

---

> [!WARNING]
> **DRY Check:** Floating toolbar component already exists in codebase
>
> - Existing: `src/features/journal/DiaryFormatToolbar.tsx` (Telegram-style floating WYSIWYG toolbar)
> - Similarity: 90% (exact component name, domain, and `getSelection()` usage)
> - **Recommendation:** EXTEND existing component (Option 2). Add portal, animation, viewport clamping to existing code.

---

## Implementation Plan

### Phase 1: Portal Rendering

- [ ] Wrap toolbar render in `createPortal(jsx, document.body)` to escape any transform/filter ancestors
- [ ] Ensure toolbar positions correctly relative to viewport (not relative parent)

### Phase 2: Entrance/Exit Animation

- [ ] Add Framer Motion: `initial={{ opacity: 0, y: 8 }}`, `animate={{ opacity: 1, y: 0 }}`, `transition={{ duration: 0.15 }}`
- [ ] Exit: `AnimatePresence` with `exit={{ opacity: 0 }}`, `transition={{ duration: 0.1 }}`

### Phase 3: Viewport Clamping & Z-Index

- [ ] After computing position from `getBoundingClientRect()`, clamp:
  - `left = Math.max(8, Math.min(left, window.innerWidth - toolbarWidth - 8))`
  - `top = Math.max(8, top)` — if selection is near top, position toolbar below
- [ ] Set `z-[80]` (above modals z-[60] per project rules)

---

## Technical Approach

### Recommended Solution

**Library:** React `createPortal` + Framer Motion v11
**Existing:** `DiaryFormatToolbar.tsx`

### Key APIs

- `createPortal(element, document.body)` — escape transform ancestors
- `getBoundingClientRect()` — selection position for toolbar placement
- Framer Motion `motion.div` — entrance/exit animation

### Implementation Pattern

```pseudocode
IN DiaryFormatToolbar:
  rect = selection.getRangeAt(0).getBoundingClientRect()
  top = rect.top - toolbarHeight - 8  // above selection
  left = clamp(rect.left, 8, viewportWidth - toolbarWidth - 8)
  IF top < 8: top = rect.bottom + 8  // flip below if near top

  return createPortal(
    <AnimatePresence>
      {visible && <motion.div style={{ top, left }} className="z-[80]" ...animProps />}
    </AnimatePresence>,
    document.body
  )
```

### Why This Approach

- Portal escapes CSS containment issues (transform ancestors break fixed positioning)
- 150ms entrance matches Telegram floating toolbar timing (RSH-001 section 8)

### Patterns Used

- Portal rendering (project convention for modals per CLAUDE.md)
- Viewport clamping (standard floating UI pattern)

---

## Acceptance Criteria

- [ ] **Given** toolbar is triggered, **When** it appears, **Then** it fades in (150ms) with translateY(8→0) at z-[80].
- [ ] **Given** selection is near viewport edge, **When** toolbar positions, **Then** it clamps within viewport bounds (8px padding).
- [ ] **Given** selection is near top of screen, **When** toolbar would overflow top, **Then** it flips to below the selection.
- [ ] **Given** toolbar is inside a component with CSS `transform`, **When** it renders via portal, **Then** it positions correctly relative to viewport.

---

## Affected Components

### Implementation

- `src/features/journal/DiaryFormatToolbar.tsx` — add portal, animation, viewport clamping, z-[80]

---

## Existing Code Impact

### Refactoring Required

- `DiaryFormatToolbar.tsx` — wrap in portal, add motion.div wrapper, update positioning logic

### Tests to Update

- None expected (visual/positioning changes)

---

## Definition of Done

- [ ] All acceptance criteria met
- [ ] Toolbar renders via `createPortal` to document.body
- [ ] z-[80] applied (above modals)
- [ ] NO new tests created

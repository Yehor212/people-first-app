# T1: Shared Element Card→Detail Expand

**Epic:** [Epic 6 — Telegram-Level Polish](../../../../epics/epic-6-telegram-polish/epic.md)
**User Story:** [EP6_US009 Page Transitions](../story.md)
**Related:** T2 (FAB transition), T3 (crossfade + VT API)
**Parallel Group:** 1

---

## Context

### Current State

- Tapping a journal entry card opens the detail view with instant swap (no transition).
- `JournalEntryCard.tsx` and `JournalEntryViewer.tsx` / `JournalEntryEditor.tsx` are separate components.
- Framer Motion `layoutId` is NOT currently used anywhere in the codebase (new pattern).
- `AnimatePresence` is widely used (10+ components).

### Desired State

- Card morphs into full detail view using Framer Motion `layoutId` shared element animation.
- Smooth expand from card position/size to full-screen detail.
- `layoutId` uses stable entry ID for correct element matching.

### Inherited Assumptions

- **A1 (FEASIBILITY):** Framer Motion `layoutId` supports cross-component shared element animation when both source and target share the same `layoutId` value.

---

## Implementation Plan

### Phase 1: Add layoutId to Source

- [ ] Add `layoutId={`entry-${entry.id}`}` to `JournalEntryCard`'s root `motion.div`
- [ ] Ensure card has explicit dimensions (no layout shift during animation)

### Phase 2: Add layoutId to Target

- [ ] Add matching `layoutId={`entry-${entry.id}`}` to `JournalEntryViewer` / `JournalEntryEditor` root
- [ ] Wrap both source and target in same `LayoutGroup` (if needed for cross-component matching)

### Phase 3: Animation Config

- [ ] Use `layout` transition: spring stiffness 300, damping 25 (Conversational preset from RSH-001)
- [ ] Pair with opacity crossfade for content that doesn't morph (text swap during expand)
- [ ] Gate via `shouldAnimate()` — if false, instant swap without layout animation

---

## Technical Approach

### Recommended Solution

**Library:** Framer Motion v11 (`layoutId`, `LayoutGroup`)

### Key APIs

- `layoutId` — shared element identity between components
- `LayoutGroup` — scope for cross-tree layout animations
- `layout` prop — enable automatic layout animation
- Spring transition: `{ type: "spring", stiffness: 300, damping: 25 }` (Conversational preset)

### Implementation Pattern

```pseudocode
// JournalEntryCard.tsx
<motion.div layoutId={`entry-${entry.id}`} onClick={openDetail}>
  <CardContent />
</motion.div>

// JournalEntryViewer.tsx
<motion.div layoutId={`entry-${entry.id}`}
  transition={{ type: "spring", stiffness: 300, damping: 25 }}>
  <DetailContent />
</motion.div>
```

### Why This Approach

- `layoutId` is Framer Motion's dedicated shared element API — GPU-composited, no layout thrashing
- Spring config matches Conversational preset (RSH-001 section 1)

### Known Limitations

- `layoutId` requires both elements to be in the DOM simultaneously during transition
- Complex content inside cards may flash during morph (use `layoutScroll` if needed)

### Patterns Used

- Shared element transition (native app pattern: iOS hero, Android shared element)
- Spring physics (Telegram Conversational preset)

---

## Acceptance Criteria

- [ ] **Given** I tap a journal entry card, **When** the detail view opens, **Then** the card morphs smoothly into the full-screen detail (shared element expand).
- [ ] **Given** I close the detail view, **When** navigating back, **Then** the detail morphs back into the card position.
- [ ] **Given** multiple cards are visible, **When** I tap one, **Then** only the tapped card morphs (others stay in place).
- [ ] **Given** `shouldAnimate()` returns false, **Then** instant swap without animation.

---

## Affected Components

### Implementation

- `src/features/journal/JournalEntryCard.tsx` — add `layoutId`
- `src/features/journal/JournalEntryViewer.tsx` — add matching `layoutId`
- `src/features/journal/JournalEntryEditor.tsx` — add matching `layoutId`
- `src/features/journal/JournalModule.tsx` — wrap in `LayoutGroup` if needed

---

## Existing Code Impact

### Refactoring Required

- Card and detail components need `motion.div` root wrappers (if not already motion components)

### Tests to Update

- None expected (visual transition only)

---

## Definition of Done

- [ ] All acceptance criteria met
- [ ] Shared element morph is smooth at 60 FPS
- [ ] Entry ID used as stable `layoutId` (no index-based IDs)
- [ ] NO new tests created

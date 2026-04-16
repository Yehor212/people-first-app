# T3: Visual Polish & Scroll Conflict Resolution

**Epic:** [Epic 6 — Telegram-Level Polish](../../../../epics/epic-6-telegram-polish/epic.md)
**User Story:** [EP6_US004 Swipe-to-Delete](../story.md)
**Related:** T1 (drag handler), T2 (delete action)
**Parallel Group:** 2

---

## Context

### Current State

- T1 adds horizontal drag gesture, T2 wires delete flow.
- No visual indicator (red zone / trash icon) behind the card during swipe.
- Potential scroll conflict: vertical list scroll vs horizontal swipe gesture.

### Desired State

- Red delete zone with trash icon reveals behind card as user swipes left.
- Scroll conflict resolved: horizontal intent detected before committing to swipe.
- Clean visual that matches Telegram's swipe-to-delete aesthetic.

### Inherited Assumptions

- **A1 (UX):** RSH-001 section 7 specifies scroll conflict resolution via `abs(deltaX) > abs(deltaY) * 2`.

---

## Implementation Plan

### Phase 1: Red Background Layer

- [ ] Add absolutely-positioned background div behind each card with `bg-destructive` theme token + trash icon
- [ ] Opacity scales from 0 to 1 as swipe progresses (0px → 80px)
- [ ] Icon scales from 0.8 to 1.0 at threshold

### Phase 2: Scroll Conflict Detection

- [ ] In `onDragStart`, capture initial pointer position
- [ ] In first `onDrag` event, compare `abs(deltaX)` vs `abs(deltaY) * 2`
- [ ] If vertical wins → cancel drag (set `dragConstraints` to lock, or use `dragListener: false`)
- [ ] If horizontal wins → commit to swipe mode

### Phase 3: Visual Refinements

- [ ] Red zone corners match card border-radius
- [ ] Theme-aware: dark mode uses `destructive` token variants
- [ ] `prefers-reduced-motion`: skip opacity animation, show static background

---

## Technical Approach

### Recommended Solution

**Library:** Framer Motion v11 + Tailwind CSS theme tokens

### Key APIs

- `useMotionValue` + `useTransform` — map drag offset to background opacity/icon scale
- `onDragStart` — capture initial position for conflict detection

### Implementation Pattern

```pseudocode
x = useMotionValue(0)
bgOpacity = useTransform(x, [-80, 0], [1, 0])
iconScale = useTransform(x, [-80, -20], [1, 0.8])

onDragStart: store initial touch position
onDrag: if first move AND abs(dY)*2 > abs(dX) → cancel drag
```

### Why This Approach

- `useTransform` is declarative and GPU-composited
- Scroll conflict detection is standard in swipe-heavy UIs (Telegram, iOS Mail)

### Patterns Used

- Motion value derivation (transform chain)
- Touch intent classification (horizontal vs vertical)
- Theme token usage (zero hardcoded colors)

---

## Acceptance Criteria

- [ ] **Given** I swipe left, **When** the card moves, **Then** a red background with trash icon reveals underneath with progressive opacity.
- [ ] **Given** I start a vertical scroll on a card, **When** vertical intent is detected, **Then** horizontal swipe is cancelled and list scrolls normally.
- [ ] **Given** I swipe horizontally, **When** `abs(deltaX) > abs(deltaY) * 2`, **Then** swipe gesture activates and scroll is locked.
- [ ] **Given** dark mode is active, **Then** delete zone uses `destructive` theme token (no hardcoded red).

---

## Affected Components

### Implementation

- `src/features/journal/JournalEntryCard.tsx` — add background layer, motion transforms, scroll conflict
- Theme tokens: reuse existing `destructive` color from Tailwind config

---

## Existing Code Impact

### Refactoring Required

- `JournalEntryCard.tsx` — add wrapper div for background layer behind existing card content

### Tests to Update

- None expected

---

## Definition of Done

- [ ] All acceptance criteria met
- [ ] Vertical scrolling works without accidental swipe triggers
- [ ] All colors via theme tokens (zero hardcoded)
- [ ] 60 FPS during swipe (GPU-only properties)
- [ ] NO new tests created

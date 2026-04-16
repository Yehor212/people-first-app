# T1: Swipe Gesture & Rubber-Band Physics

**Epic:** [Epic 6 — Telegram-Level Polish](../../../../epics/epic-6-telegram-polish/epic.md)
**User Story:** [EP6_US004 Swipe-to-Delete](../story.md)
**Related:** T2 (uses gesture output), T3 (uses gesture config)
**Parallel Group:** 1

---

## Context

### Current State

- Journal entry cards (`JournalEntryCard.tsx`) are static — no horizontal swipe interaction.
- Framer Motion `drag` used in `MindMapCanvas.tsx` for canvas panning (different domain).
- Delete is triggered via button tap inside entry editor, not from the list.

### Desired State

- Horizontal swipe-left on diary cards with rubber-band resistance past threshold.
- 80px threshold triggers visual + haptic feedback; release past threshold = delete intent.
- Snap-back on cancel (stiffness 500, damping 35).

### Inherited Assumptions

- **A1 (FEASIBILITY):** Framer Motion `drag="x"` supports constraint-based rubber-band per RSH-001 section 7.

---

## Implementation Plan

### Phase 1: Drag Handler Setup

- [ ] Add `motion.div` wrapper to `JournalEntryCard` with `drag="x"`, `dragConstraints={{ right: 0 }}`, `dragElastic: 0.3`
- [ ] Track drag offset via `onDrag` event, detect when `x < -80px`

### Phase 2: Threshold & Haptic

- [ ] Use ref-tracked boolean to fire `hapticWarning()` exactly once at -80px threshold
- [ ] Reset ref on drag end / snap-back

### Phase 3: Snap-Back Animation

- [ ] On release before threshold: spring snap-back (stiffness 500, damping 35)
- [ ] On release past threshold: emit `onSwipeDelete(entryId)` callback to parent
- [ ] Gate all animations via `shouldAnimate()` from `animationUtils.ts`

---

## Technical Approach

### Recommended Solution

**Library:** Framer Motion v11 (stable)
**Documentation:** framer.com/motion

### Key APIs

- `drag="x"` + `dragConstraints={{ right: 0 }}` — horizontal-only drag with right edge locked
- `dragElastic: 0.3` — rubber-band resistance factor
- `onDrag(event, info)` — access `info.offset.x` for threshold detection
- `onDragEnd(event, info)` — determine delete vs snap-back

### Implementation Pattern

```pseudocode
ON drag: if offset.x < -80 AND !hapticFired → hapticWarning(), set hapticFired
ON dragEnd: if offset.x < -80 → call onSwipeDelete(id)
           else → animate back to x:0 with spring(500, 35)
```

### Why This Approach

- Framer Motion drag is GPU-composited, 60 FPS on mobile
- Matches Telegram swipe-to-reply physics (RSH-001 section 7)

### Patterns Used

- Ref-tracked haptic (fire once per gesture)
- Callback delegation (card emits intent, parent handles delete)

### Known Limitations

- `dragElastic` applies uniformly; custom progressive resistance would need `dragTransition`

### Error Handling Strategy

- Haptic failures silently caught (try/catch wrapper in `haptics.ts`)

---

## Acceptance Criteria

- [ ] **Given** I swipe left on a diary card past 80px, **When** the threshold is crossed, **Then** rubber-band resistance increases and warning haptic fires once.
- [ ] **Given** I release before 80px, **When** the card snaps back, **Then** it animates with spring stiffness 500, damping 35.
- [ ] **Given** I release past 80px, **When** drag ends, **Then** `onSwipeDelete` callback fires with entry ID.
- [ ] **Given** `prefers-reduced-motion` is enabled, **Then** swipe still functions but card snaps instantly without animation.

---

## Affected Components

### Implementation

- `src/features/journal/JournalEntryCard.tsx` — add drag wrapper + threshold logic
- `src/lib/haptics.ts` — reuse existing `hapticWarning()`
- `src/lib/animationUtils.ts` — reuse `shouldAnimate()`

### Documentation

- None required (internal interaction pattern)

---

## Existing Code Impact

### Refactoring Required

- `JournalEntryCard.tsx` — wrap card content in `motion.div` with drag props

### Tests to Update

- None expected (gesture is visual, no existing tests break)

---

## Definition of Done

- [ ] All acceptance criteria met
- [ ] Swipe gesture works on iOS, Android, and desktop (mouse drag)
- [ ] No existing tests broken
- [ ] NO new tests created
- [ ] 60 FPS during drag (profile with DevTools)

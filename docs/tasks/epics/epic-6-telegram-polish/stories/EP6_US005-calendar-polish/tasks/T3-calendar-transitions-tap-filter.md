# T3: Calendar Transitions & Tap-to-Filter

**Epic:** [Epic 6 — Telegram-Level Polish](../../../../epics/epic-6-telegram-polish/epic.md)
**User Story:** [EP6_US005 Calendar Polish](../story.md)
**Related:** T1 (mood coloring), T2 (streak on same grid)
**Parallel Group:** 2

---

## Context

### Current State

- Month navigation exists but transitions are instant (no animation).
- Tapping a day shows entries but without transition animation or haptic feedback.
- `AnimatePresence` pattern is widely used in codebase (10+ components).

### Desired State

- Month swipe transitions with slide + fade animation (300ms, `zenMotion.gentle`).
- Day tap filters entry list with crossfade transition and light haptic.
- All animations gated by `shouldAnimate()`.

### Inherited Assumptions

- **A1 (FEASIBILITY):** `AnimatePresence` with `mode="wait"` supports crossfade, proven in 10+ components.

---

## Implementation Plan

### Phase 1: Month Transition Animation

- [ ] Wrap calendar grid in `AnimatePresence` with `mode="wait"`
- [ ] `initial={{ opacity: 0, x: direction * 50 }}`, `animate={{ opacity: 1, x: 0 }}`, `exit={{ opacity: 0, x: direction * -50 }}`
- [ ] Track swipe/button direction (+1 forward, -1 backward) for correct slide direction

### Phase 2: Day Tap Filter

- [ ] On day cell tap: filter entry list to selected date
- [ ] Wrap entry list in `AnimatePresence` for crossfade on filter change
- [ ] Fire `hapticTap()` on day cell press (light haptic)

### Phase 3: Animation Gating

- [ ] Gate all transitions via `shouldAnimate()` — instant swaps when disabled
- [ ] `prefers-reduced-motion`: no slide/fade, instant content swap

---

## Technical Approach

### Recommended Solution

**Library:** Framer Motion v11 (AnimatePresence)
**Existing:** `zenMotion.gentle` from `animationUtils.ts`, `hapticTap()` from `haptics.ts`

### Key APIs

- `AnimatePresence mode="wait"` — crossfade between calendar months
- `zenMotion.gentle` — 300ms transition preset
- `hapticTap()` — light haptic on day selection

### Implementation Pattern

```pseudocode
<AnimatePresence mode="wait" custom={direction}>
  <motion.div key={currentMonth}
    initial={{ opacity: 0, x: direction * 50 }}
    animate={{ opacity: 1, x: 0 }}
    exit={{ opacity: 0, x: -direction * 50 }}
    transition={zenMotion.gentle}>
    <CalendarGrid />
  </motion.div>
</AnimatePresence>
```

### Why This Approach

- `AnimatePresence mode="wait"` prevents layout jumps during transition
- Direction-aware slide matches iOS/Telegram calendar navigation pattern

### Patterns Used

- AnimatePresence crossfade (established in codebase)
- Haptic feedback on selection (existing pattern in mood selection)

---

## Acceptance Criteria

- [ ] **Given** I swipe or tap to next month, **When** the transition plays, **Then** calendar grid slides in from right with fade (300ms).
- [ ] **Given** I navigate to previous month, **When** the transition plays, **Then** calendar grid slides in from left (reversed direction).
- [ ] **Given** I tap a day cell, **When** the entry list updates, **Then** list crossfades to filtered entries and light haptic fires.
- [ ] **Given** `shouldAnimate()` returns false, **Then** all transitions are instant swaps.

---

## Affected Components

### Implementation

- `src/features/journal/JournalCalendar.tsx` — AnimatePresence wrapper, direction tracking
- `src/features/journal/JournalCalendarFull.tsx` — same transition logic
- `src/features/journal/JournalEntryList.tsx` — crossfade on date filter change

---

## Existing Code Impact

### Tests to Update

- None expected (visual transitions only)

---

## Definition of Done

- [ ] All acceptance criteria met
- [ ] Month transitions are smooth at 60 FPS
- [ ] Haptic fires on day tap (respects Dopamine settings)
- [ ] NO new tests created

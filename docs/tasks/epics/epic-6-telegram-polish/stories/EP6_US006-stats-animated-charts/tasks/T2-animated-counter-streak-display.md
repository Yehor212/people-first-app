# T2: Animated Counter & Streak Display

**Epic:** [Epic 6 — Telegram-Level Polish](../../../../epics/epic-6-telegram-polish/epic.md)
**User Story:** [EP6_US006 Stats Animated Charts](../story.md)
**Related:** T1 (chart animation, same stats view)
**Parallel Group:** 1

---

## Context

### Current State

- Stats counters (total entries, streak, word count) render instantly with final values.
- No `AnimatedCounter` component exists in the codebase.
- Streak data available from gamification store. Fire icon animation exists in `AnimatedFire.tsx` for habits.

### Desired State

- Counters animate counting up from 0 to target with spring overshoot settle (800ms).
- Streak section displays current + longest streak with fire icon pulse animation on mount.
- Triggers on scroll-into-view (same IntersectionObserver pattern as T1).

### Inherited Assumptions

- **A1 (FEASIBILITY):** Spring-based counting animation achievable via `useSpring` from Framer Motion.

---

## Implementation Plan

### Phase 1: AnimatedCounter Component

- [ ] Create `AnimatedCounter.tsx` — reusable component accepting `target: number`, `duration?: number`
- [ ] Use Framer Motion `useSpring` with config: stiffness 100, damping 15 for overshoot effect
- [ ] Round displayed value to integer during animation
- [ ] Gate via `shouldAnimate()` — show final value instantly when disabled

### Phase 2: Streak Display Enhancement

- [ ] Display current streak + longest streak in stats section
- [ ] Fire icon: scale pulse (1 → 1.2 → 1.0) on mount using spring animation
- [ ] Reuse fire icon pattern from `AnimatedFire.tsx` (habit tracker)

### Phase 3: Integration

- [ ] Replace static counter renders in `JournalStats.tsx` with `<AnimatedCounter>`
- [ ] Wire IntersectionObserver trigger (shared with T1 if both in same viewport section)
- [ ] Memoize counter targets to prevent re-animation on unrelated re-renders

---

## Technical Approach

### Recommended Solution

**Library:** Framer Motion v11 (`useSpring`, `motion`)
**Existing:** `AnimatedFire.tsx` pattern for fire icon

### Key APIs

- `useSpring(0, { stiffness: 100, damping: 15 })` — spring-based number animation
- `useMotionValueEvent(spring, "change", v => setDisplay(Math.round(v)))` — round during animation
- `spring.set(target)` — trigger animation to target value

### Implementation Pattern

```pseudocode
AnimatedCounter({ target, shouldAnimate }):
  spring = useSpring(0, { stiffness: 100, damping: 15 })
  display = useMotionValueEvent(spring, "change", round)
  ON intersect: spring.set(target)
  IF !shouldAnimate: return <span>{target}</span>
  return <span>{display}</span>
```

### Why This Approach

- `useSpring` provides natural overshoot without manual keyframes
- Reusable component pattern (can be used in other stats views later)

### Patterns Used

- Spring-based number animation (Telegram counter style)
- Intersection-triggered animation (performance)
- **Pattern Hint:** 1 existing `AnimatedFire.tsx` pattern for fire icon animation. Review for reuse.

---

## Acceptance Criteria

- [ ] **Given** stats counters scroll into view, **When** animation triggers, **Then** numbers count up from 0 with spring overshoot over ~800ms.
- [ ] **Given** the target is 42, **When** animation plays, **Then** counter briefly overshoots (e.g., 44) then settles to 42.
- [ ] **Given** streak section renders, **When** mounted, **Then** fire icon pulses (scale 1→1.2→1) once.
- [ ] **Given** `prefers-reduced-motion`, **Then** counters show final values instantly, no animation.

---

## Affected Components

### Implementation

- NEW: `src/components/ui/AnimatedCounter.tsx` — reusable animated counter
- `src/features/journal/JournalStats.tsx` — replace static counters, add streak display
- Side-effects: none (read-only from stores)

---

## Existing Code Impact

### Tests to Update

- None expected (new component + visual changes)

---

## Definition of Done

- [ ] All acceptance criteria met
- [ ] `AnimatedCounter` is reusable (accepts target + config props)
- [ ] Fire icon reuses existing `AnimatedFire.tsx` pattern
- [ ] NO new tests created

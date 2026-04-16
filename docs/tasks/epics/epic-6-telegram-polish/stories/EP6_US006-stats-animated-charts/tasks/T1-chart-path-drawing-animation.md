# T1: Chart Path Drawing Animation

**Epic:** [Epic 6 — Telegram-Level Polish](../../../../epics/epic-6-telegram-polish/epic.md)
**User Story:** [EP6_US006 Stats Animated Charts](../story.md)
**Related:** T2 (counter animations, same stats view)
**Parallel Group:** 1

---

## Context

### Current State

- `JournalStats.tsx` renders mood charts statically (instant render, no animation).
- `strokeDasharray` is used in 10+ components (ProgressRing, TimerRing, GoalNode) for circular progress — but NOT for chart path drawing.
- Recharts is used in `HabitFrequencyChart.tsx` and `HabitScoreChart.tsx` for bar/line charts.

### Desired State

- Mood chart path draws progressively using stroke-dasharray animation over 1.2 seconds.
- Animation triggers on scroll-into-view (IntersectionObserver), not on mount.
- `prefers-reduced-motion`: chart renders fully drawn instantly.

### Inherited Assumptions

- **A1 (FEASIBILITY):** SVG stroke-dasharray animation is widely supported and GPU-composited.

---

## Implementation Plan

### Phase 1: Path Length Measurement

- [ ] After chart SVG renders, measure total path length via `ref.getTotalLength()`
- [ ] Set initial `strokeDasharray` = pathLength, `strokeDashoffset` = pathLength (hidden)

### Phase 2: Draw Animation

- [ ] Animate `strokeDashoffset` from pathLength to 0 over 1.2s with `ease-out` timing
- [ ] Use CSS animation or Framer Motion `animate` on the SVG path element
- [ ] If using Recharts: access path via `customized` prop or CSS selector on rendered `<path>`

### Phase 3: Scroll Trigger

- [ ] Use IntersectionObserver to detect when stats section enters viewport
- [ ] Trigger animation only once (ref-tracked `hasAnimated` flag)
- [ ] Gate via `shouldAnimate()` — if false, render fully drawn immediately

---

## Technical Approach

### Recommended Solution

**Library:** CSS @keyframes animation + IntersectionObserver API
**Existing:** Recharts in `JournalStats.tsx`

### Key APIs

- `SVGPathElement.getTotalLength()` — measure path for dasharray
- `strokeDasharray` / `strokeDashoffset` — progressive reveal
- `IntersectionObserver({ threshold: 0.3 })` — viewport trigger

### Implementation Pattern

```pseudocode
pathRef = useRef<SVGPathElement>()
ON mount: length = pathRef.getTotalLength()
          set strokeDasharray=length, strokeDashoffset=length
ON intersect: animate strokeDashoffset → 0 over 1.2s ease-out
IF !shouldAnimate(): skip, render with strokeDashoffset=0
```

### Why This Approach

- CSS stroke animation is GPU-composited (no JS per frame)
- IntersectionObserver prevents off-screen animation waste

### Patterns Used

- Stroke-dasharray reveal (standard SVG animation technique)
- Intersection-triggered animation (performance best practice from RSH-001 section 11)

---

## Acceptance Criteria

- [ ] **Given** I open the stats tab, **When** the mood chart scrolls into view, **Then** the chart path draws progressively over 1.2 seconds.
- [ ] **Given** the chart has already animated, **When** I scroll away and back, **Then** it does NOT re-animate (stays drawn).
- [ ] **Given** `prefers-reduced-motion` is enabled, **Then** the chart renders fully drawn with no animation.
- [ ] **Given** multiple chart paths exist, **Then** each path animates with a slight stagger (100ms between paths).

---

## Affected Components

### Implementation

- `src/features/journal/JournalStats.tsx` — add path animation + IntersectionObserver
- CSS: @keyframes for strokeDashoffset animation

---

## Existing Code Impact

### Tests to Update

- None expected (visual animation only)

---

## Definition of Done

- [ ] All acceptance criteria met
- [ ] Animation is 60 FPS (CSS-only, no JS frame loop)
- [ ] Works with existing Recharts chart structure
- [ ] NO new tests created

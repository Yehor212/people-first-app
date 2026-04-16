# T2: Streak Visualization

**Epic:** [Epic 6 — Telegram-Level Polish](../../../../epics/epic-6-telegram-polish/epic.md)
**User Story:** [EP6_US005 Calendar Polish](../story.md)
**Related:** T1 (mood coloring on same cells)
**Parallel Group:** 1

---

## Context

### Current State

- Streak logic exists for habits (`AllCompleteCelebration.tsx`, `CompactHabitCard.tsx`) but NOT for diary entries.
- Calendar shows individual day cells without visual connection between consecutive diary days.
- No streak detection for journal entries.

### Desired State

- Consecutive diary days show a connected highlight bar across those day cells.
- Streak wraps at week boundaries (row-aware rendering).
- Visual is subtle (background bar, not overwhelming the mood coloring from T1).

### Inherited Assumptions

- **A1 (UX):** Streak visualization is a background element that complements, not competes with, mood coloring.

---

## Implementation Plan

### Phase 1: Streak Detection

- [ ] Compute consecutive diary day sequences from journal entry dates
- [ ] Return array of streak ranges: `[{ start: Date, end: Date, length: number }]`

### Phase 2: Visual Rendering

- [ ] Render connected highlight bar using CSS pseudo-elements or inline SVG within calendar grid
- [ ] Handle week boundary wrapping: streak continues on next row with visual connection
- [ ] Use theme token for streak color (subtle, semi-transparent)

### Phase 3: Integration

- [ ] Wire streak data into `JournalCalendar.tsx` and `JournalCalendarFull.tsx`
- [ ] Memoize streak computation (recompute only when entries change)

---

## Technical Approach

### Recommended Solution

**Library:** CSS pseudo-elements within calendar grid

### Key APIs

- CSS `::before` / `::after` for horizontal bar segments
- Grid-aware positioning using `grid-column` span

### Implementation Pattern

```pseudocode
streaks = computeStreaks(entryDates)
FOR each cell in calendarGrid:
  IF cell.date IN streak → add streak-segment class
  IF cell.date = streak.start → add streak-start class (rounded left)
  IF cell.date = streak.end → add streak-end class (rounded right)
```

### Why This Approach

- CSS pseudo-elements are GPU-composited, zero JS per frame
- Calendar grid already has row/column structure to exploit

### Patterns Used

- Streak detection algorithm (consecutive date grouping)
- CSS-only visual decoration (no additional DOM elements)

---

## Acceptance Criteria

- [ ] **Given** I have consecutive diary days (e.g., Mon-Wed), **When** the calendar renders, **Then** a connected highlight bar spans those day cells.
- [ ] **Given** a streak crosses a week boundary, **When** the row wraps, **Then** the streak continues visually on the next row.
- [ ] **Given** a single isolated diary day, **When** the calendar renders, **Then** no streak bar appears (only mood coloring from T1).
- [ ] **Given** theme changes, **Then** streak bar uses theme-aware color token.

---

## Affected Components

### Implementation

- `src/features/journal/JournalCalendar.tsx` — add streak classes to day cells
- `src/features/journal/JournalCalendarFull.tsx` — same streak logic
- CSS/Tailwind: streak bar styles with pseudo-elements

---

## Existing Code Impact

### Tests to Update

- None expected

---

## Definition of Done

- [ ] All acceptance criteria met
- [ ] Streak bar is subtle and doesn't obscure mood coloring
- [ ] Week boundary wrapping works correctly
- [ ] All colors via theme tokens
- [ ] NO new tests created

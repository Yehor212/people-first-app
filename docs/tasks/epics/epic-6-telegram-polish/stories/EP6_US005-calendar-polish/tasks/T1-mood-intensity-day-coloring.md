# T1: Mood-Intensity Day Cell Coloring

**Epic:** [Epic 6 — Telegram-Level Polish](../../../../epics/epic-6-telegram-polish/epic.md)
**User Story:** [EP6_US005 Calendar Polish](../story.md)
**Related:** T2 (streak uses same day cells), T3 (tap on colored cells)
**Parallel Group:** 1

---

## Context

### Current State

- `JournalCalendar.tsx` and `JournalCalendarFull.tsx` render day cells without mood-based coloring.
- Mood data (valence 1-5) is available per entry from the journal store.
- No visual distinction between days with different mood intensities.

### Desired State

- Each day cell with mood entries shows mood-intensity coloring: saturation proportional to valence score.
- Theme-aware: dark mode uses lower saturation, light mode uses higher saturation.
- Uses theme mood palette tokens (zero hardcoded colors).

### Inherited Assumptions

- **A1 (DATA):** Valence score (1-5) is available per journal entry from the store.

---

## Implementation Plan

### Phase 1: Mood Data Aggregation

- [ ] Create helper to compute daily mood summary: average valence for days with multiple entries
- [ ] Map valence 1-5 to opacity/saturation levels (e.g., 20%/40%/60%/80%/100%)

### Phase 2: Day Cell Styling

- [ ] Apply `background-color` with CSS variable from mood palette + opacity modulation
- [ ] Dark mode: reduce saturation by ~30% using theme-aware CSS custom properties
- [ ] Ensure text contrast meets WCAG AA on all coloring levels

### Phase 3: Integration

- [ ] Wire mood data into `JournalCalendar.tsx` and `JournalCalendarFull.tsx` day cell renderers
- [ ] Memoize daily mood computations to avoid re-renders on calendar navigation

---

## Technical Approach

### Recommended Solution

**Library:** Tailwind CSS theme tokens + CSS custom properties

### Key APIs

- CSS `background-color` with `hsl()` and variable saturation/opacity
- Zustand journal store — access entries by date

### Implementation Pattern

```pseudocode
dailyMood = entries.filter(date).map(e => e.valence).average()
opacity = clamp(dailyMood / 5, 0.2, 1.0)
style = { backgroundColor: `hsl(var(--mood-hue) var(--mood-sat) var(--mood-light) / ${opacity})` }
```

### Why This Approach

- CSS custom properties enable theme switching without JS recalculation
- Opacity modulation is GPU-composited (no reflow)

### Patterns Used

- Theme token usage (project convention: zero hardcoded colors)
- Memoized computation (avoid per-render aggregation)

---

## Acceptance Criteria

- [ ] **Given** a day has mood entries, **When** the calendar renders, **Then** the day cell shows mood-intensity coloring with saturation proportional to average valence (1-5).
- [ ] **Given** dark mode is active, **When** mood coloring renders, **Then** saturation is reduced (lower intensity than light mode).
- [ ] **Given** a day has no entries, **When** the calendar renders, **Then** the day cell has no mood coloring (default background).
- [ ] **Given** high valence (4-5), **When** compared to low valence (1-2), **Then** the color difference is visually distinguishable.

---

## Affected Components

### Implementation

- `src/features/journal/JournalCalendar.tsx` — add mood coloring to day cells
- `src/features/journal/JournalCalendarFull.tsx` — same coloring logic
- Side-effects: none (read-only from store)

---

## Existing Code Impact

### Tests to Update

- None expected (visual change only)

---

## Definition of Done

- [ ] All acceptance criteria met
- [ ] All colors via theme tokens (zero hardcoded)
- [ ] WCAG AA text contrast maintained on colored cells
- [ ] NO new tests created

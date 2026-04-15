# EP6_US005: Journal Calendar Polish

**Status:** Done
**Epic:** 6 — Telegram-Level Polish
**Priority:** P2
**INVEST Score:** 6/6

---

## User Story

As a **diary user**, I want the calendar to feel alive with mood colors, streak visualization, and smooth transitions, so that browsing my journaling history is visually engaging.

## Description

The JournalCalendar and JournalCalendarFull currently show entries on dates but lack visual richness. This story adds:

1. **Mood intensity coloring** — day cells color-coded by mood valence.
2. **Tap-to-filter** — tapping a day filters the entry list with crossfade transition + haptic.
3. **Streak visualization** — consecutive journaling days get a connected highlight.
4. **Smooth month transition** — swiping between months animates (slide + fade).

**Zero visual regression constraint:** Calendar grid layout, date positioning, and functionality unchanged. Colors and animations are additive.

## Acceptance Criteria

1. **Given** I view the diary calendar, **When** days have mood entries, **Then** each day cell shows mood-intensity coloring (saturation proportional to valence score) using theme-aware mood palette.
2. **Given** I tap a day on the calendar, **When** the tap registers, **Then** the entry list filters to that day with a crossfade transition and a light haptic.
3. **Given** I have consecutive diary days, **When** the calendar renders, **Then** a streak visualization (connected highlight bar) appears across those days.
4. **Given** I swipe between months, **When** the transition plays, **Then** the calendar grid transitions with slide + fade animation (300ms, `zenMotion.gentle`).

## Technical Notes

**Standards Research:** [RSH-001](../../../research/rsh-001-telegram-polish-standards.md) — sections 1, 3

- Mood coloring: map valence score (1-5) to opacity/saturation of the mood color token. Use CSS `background-color` with `opacity` modulation. Theme-aware: dark mode uses lower saturation.
- Tap-to-filter: `AnimatePresence` on list with `mode="wait"` for crossfade. `hapticTap()` on day cell press.
- Streak line: CSS pseudo-element or SVG connecting consecutive day cells within the same row. Wrap at week boundaries.
- Month transition: Framer Motion `AnimatePresence` with `initial={{ opacity: 0, x: direction * 50 }}`, `animate={{ opacity: 1, x: 0 }}`, `exit={{ opacity: 0, x: direction * -50 }}`. `direction` = +1 for forward, -1 for backward.
- All animations gated by `shouldAnimate()`.

**Files:** `JournalCalendar.tsx`, `JournalCalendarFull.tsx`, `JournalEntryList.tsx` (filter animation)

## Dependencies

- None (independent)

## Test Strategy

_(Planned by test planner)_

## Orchestrator Brief

```
tech: "React, Framer Motion, CSS, Capacitor Haptics"
keyFiles: ["JournalCalendar.tsx", "JournalCalendarFull.tsx", "JournalEntryList.tsx"]
approach: "Add mood-intensity day coloring, streak highlight, month slide transition, tap-filter haptic"
complexity: "Medium (multiple small enhancements across 2 calendar components)"
```

## Definition of Done

- [ ] Day cells show mood-intensity coloring (theme-aware)
- [ ] Tap day filters list with crossfade + haptic
- [ ] Streak visualization on consecutive days
- [ ] Month swipe transition smooth (300ms)
- [ ] Gated by `shouldAnimate()`, no TS errors, tests pass

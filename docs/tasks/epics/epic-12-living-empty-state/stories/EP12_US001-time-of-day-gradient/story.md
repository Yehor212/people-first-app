# EP12_US001: Time-of-Day Ambient Gradient

**Epic:** [Epic 12: Living Empty State & Ambient Canvas](../../epic.md)
**Status:** Backlog
**Priority:** P0
**Complexity:** Medium
**Created:** 2026-04-15

---

## Goal

Create an ambient background gradient that reflects the time of day, making the empty editor space feel alive and contextual — warm gold in the morning, clear blue in the afternoon, amber at evening, deep indigo at night.

## Acceptance Criteria

### AC1: Four Time Periods

- [ ] Morning (6:00-11:59): warm golden gradient (`from-amber-500/8 via-yellow-500/5 to-transparent`)
- [ ] Afternoon (12:00-16:59): clear blue tones (`from-sky-500/8 via-blue-500/5 to-transparent`)
- [ ] Evening (17:00-20:59): warm amber/purple (`from-orange-500/8 via-purple-500/5 to-transparent`)
- [ ] Night (21:00-5:59): deep indigo (`from-indigo-500/8 via-violet-500/5 to-transparent`)

### AC2: Smooth Transitions

- [ ] 30-minute blend zones between periods (e.g., 11:30-12:30 blends morning→afternoon)
- [ ] Gradient transitions use CSS opacity crossfade (no hard cuts)
- [ ] Gradient updates every 15 minutes (not every render)

### AC3: Theme Awareness

- [ ] Gradient works with both light and dark themes (opacity-based, not hardcoded colors)
- [ ] All colors via theme tokens where possible; gradient overlays are subtle (5-8% opacity max)
- [ ] Night mode gradient doesn't fight with dark theme background

### AC4: Performance & Reduced Motion

- [ ] CPU impact: near zero (CSS-only gradient, no JavaScript animation loop)
- [ ] `prefers-reduced-motion`: static gradient for current period (no transition animation)
- [ ] Component unmounts cleanly when editor opens (no stale interval)

## Technical Notes

### Affected Components

- `src/features/journal/TimeOfDayGradient.tsx` — NEW component
- `src/features/journal/JournalModule.tsx` — render in empty state area

### Architecture

Simple component using `new Date().getHours()` with `useEffect` interval (15 min). Two gradient divs with crossfade opacity for smooth period transitions. Uses CSS `transition: opacity 30s ease` for ultra-smooth blending.

### Dependencies

- None (foundation story for Epic 12)

### Blocks

- EP12_US003 (orb + particles layer on top of gradient)

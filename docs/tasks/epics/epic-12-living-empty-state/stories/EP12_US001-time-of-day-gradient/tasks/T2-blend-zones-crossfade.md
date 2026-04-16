# T2: 30-Minute Blend Zones with CSS Crossfade

**Story:** [EP12_US001](../story.md) | **Type:** Implementation | **Status:** Todo | **Priority:** P1 | **Estimate:** 3h | **Parallel Group:** 1

## Goal
Add smooth 30-minute blend transitions between time periods (no hard cuts) using two gradient divs with CSS opacity crossfade.

## Acceptance Criteria
- [ ] Blend zones: 5:30-6:30 (night→morning), 11:30-12:30 (morning→afternoon), etc. — `verify: inspect (blend zone logic)`
- [ ] Two gradient divs with crossfade opacity — `verify: inspect (two divs with transition: opacity)`
- [ ] CSS `transition: opacity 30s ease` for ultra-smooth blending — `verify: inspect (transition property)`
- [ ] `prefers-reduced-motion`: static gradient, no transition — `verify: inspect (reducedMotion check)`
- [ ] CPU near zero (CSS-only, no JS animation loop) — `verify: inspect (no requestAnimationFrame)`

### Affected Components
- `src/features/journal/TimeOfDayGradient.tsx` — add blend logic

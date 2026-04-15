# EP6_US006: Stats Animated Charts & Counters

**Status:** Backlog
**Epic:** 6 — Telegram-Level Polish
**Priority:** P2
**INVEST Score:** 6/6

---

## User Story

As a **diary user**, I want to see my stats come alive with animated chart drawing and counting up, so that viewing my progress feels rewarding and engaging.

## Description

JournalStats currently renders Recharts data statically. This story adds:

1. **Animated path drawing** — mood chart line draws progressively (stroke-dasharray).
2. **Animated counters** — streak/entry/word numbers count up from 0 with spring overshoot.
3. **Streak stats section** — visual display of current and longest streaks.

**Zero visual regression constraint:** Chart data, axes, and legend unchanged. Animation is additive.

## Acceptance Criteria

1. **Given** I open the stats tab, **When** mood chart renders, **Then** the chart path draws progressively using stroke-dasharray animation over 1.2 seconds.
2. **Given** stats load, **When** counters appear, **Then** numbers animate counting up from 0 over 800ms with a spring overshoot settle (count 0->target with slight overshoot->settle).
3. **Given** I have `prefers-reduced-motion` enabled, **Then** charts render fully drawn (no animation) and counters show final values instantly.

## Technical Notes

**Standards Research:** [RSH-001](../../../research/rsh-001-telegram-polish-standards.md) — sections 1, 11

- Stroke-dasharray animation: set `strokeDasharray` = total path length, `strokeDashoffset` animates from length to 0 over 1.2s. Use Recharts `customized` prop or CSS animation on the `<path>` element.
- Counter animation: custom `AnimatedCounter` component using `useSpring` from Framer Motion or `requestAnimationFrame` loop. Spring config: `stiffness: 100, damping: 15` for slight overshoot.
- Streak section: existing streak data from gamification store. Display current streak + longest streak with fire icon animation (scale pulse on mount).
- Trigger animations on scroll-into-view using IntersectionObserver (don't animate off-screen content).
- Gate all: `shouldAnimate()`.

**Files:** `JournalStats.tsx`, possibly NEW: `AnimatedCounter.tsx` (reusable)

## Dependencies

- None (independent)

## Test Strategy

_(Planned by test planner)_

## Orchestrator Brief

```
tech: "React, Recharts, Framer Motion, CSS (stroke-dasharray)"
keyFiles: ["JournalStats.tsx", "new: AnimatedCounter.tsx"]
approach: "Stroke-dasharray chart drawing + spring counter component + IntersectionObserver trigger"
complexity: "Medium (Recharts customization + counter animation)"
```

## Definition of Done

- [ ] Chart path draws progressively over 1.2s
- [ ] Counters animate 0->target with spring overshoot
- [ ] Animations trigger on scroll-into-view
- [ ] Reduced motion: instant rendering, no animation
- [ ] 60 FPS, no TS errors, tests pass

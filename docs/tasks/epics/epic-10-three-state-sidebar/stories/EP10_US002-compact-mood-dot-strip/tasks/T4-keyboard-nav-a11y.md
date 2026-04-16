# T4: Keyboard Navigation + A11y

**Story:** [EP10_US002 — Compact Sidebar: Mood Dot Strip](../story.md)
**Type:** Implementation
**Status:** Todo
**Priority:** P1
**Estimate:** 3h
**Parallel Group:** 2

---

## Goal

Add keyboard navigation (↑↓ + Enter) and accessibility labels to the mood dot strip.

## Acceptance Criteria

- [ ] `↑`/`↓` moves focus between dots — `verify: inspect (onKeyDown handler with ArrowUp/ArrowDown)`
- [ ] `Enter` opens the focused entry — `verify: inspect (Enter key triggers onOpenEntry)`
- [ ] Each dot has `aria-label="{mood}: {title}"` — `verify: command (grep 'aria-label' src/features/journal/MoodDotStrip.tsx)`
- [ ] `role="listbox"` on container, `role="option"` on dots — `verify: inspect (ARIA roles)`
- [ ] Reduced motion: dots render without animation — `verify: inspect (useReducedMotion check)`

### Affected Components

- `src/features/journal/MoodDotStrip.tsx` — add keyboard handler + ARIA

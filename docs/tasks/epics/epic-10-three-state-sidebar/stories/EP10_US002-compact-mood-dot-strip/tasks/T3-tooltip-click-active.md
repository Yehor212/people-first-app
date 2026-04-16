# T3: Tooltip Hover + Click-to-Open + Active Ring

**Story:** [EP10_US002 — Compact Sidebar: Mood Dot Strip](../story.md)
**Type:** Implementation
**Status:** Todo
**Priority:** P0
**Estimate:** 4h
**Parallel Group:** 2

---

## Goal

Add hover tooltips showing entry title + time, click-to-open functionality, and an active entry highlight ring on mood dots.

## Acceptance Criteria

- [ ] Hovering dot shows tooltip: "{title} · {relativeTime}" after 300ms delay — `verify: inspect (tooltip element with delay)`
- [ ] Tooltip positioned right of dot (LTR) or left (RTL) — `verify: inspect (placement logic)`
- [ ] Clicking dot opens entry in editor panel — `verify: inspect (onClick calls onOpenEntry)`
- [ ] Active entry has mood-colored ring (ring-2 with MOOD_RING colors) — `verify: inspect (active ring className)`
- [ ] Clicking already-active dot has no effect — `verify: inspect (early return if activeId === entry.id)`

### Affected Components

- `src/features/journal/MoodDotStrip.tsx` — add tooltip, click, active state

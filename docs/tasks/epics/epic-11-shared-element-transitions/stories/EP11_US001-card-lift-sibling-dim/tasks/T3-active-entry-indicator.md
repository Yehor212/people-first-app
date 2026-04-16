# T3: Persistent Active Entry Indicator

**Story:** [EP11_US001](../story.md) | **Type:** Implementation | **Status:** Todo | **Priority:** P1 | **Estimate:** 3h | **Parallel Group:** 2

## Goal
Show persistent visual indicator on the sidebar card whose entry is currently open in the editor: mood-colored ring, enhanced gradient, pulsing accent bar.

## Acceptance Criteria
- [ ] Active card has 1px mood-colored ring (ring-1) — `verify: inspect (ring className on active)`
- [ ] Background mood gradient at 12% opacity (vs 8% default) — `verify: inspect (opacity difference)`
- [ ] Accent bar pulses gently (opacity 0.6↔1.0, 2s cycle) — `verify: inspect (CSS animation or framer-motion)`
- [ ] Works in both expanded and compact sidebar modes — `verify: inspect (indicator in both views)`
- [ ] `prefers-reduced-motion`: static ring, no pulse — `verify: inspect (no animation when reduced motion)`

### Affected Components
- `src/features/journal/JournalEntryCard.tsx` — add `isActive` prop + indicator styles
- `src/features/journal/MoodDotStrip.tsx` — add active ring in compact mode

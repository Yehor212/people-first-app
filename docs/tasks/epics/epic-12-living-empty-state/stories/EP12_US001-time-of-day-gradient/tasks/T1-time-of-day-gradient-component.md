# T1: TimeOfDayGradient Component with 4 Periods

**Story:** [EP12_US001](../story.md) | **Type:** Implementation | **Status:** Todo | **Priority:** P0 | **Estimate:** 3h | **Parallel Group:** 1

## Goal
Create the TimeOfDayGradient component that renders an ambient CSS gradient background based on current hour (morning/afternoon/evening/night), theme-aware.

## Acceptance Criteria
- [ ] Morning (6-12): warm golden gradient — `verify: inspect (gradient classes for hour range)`
- [ ] Afternoon (12-17): clear blue tones — `verify: inspect (gradient classes)`
- [ ] Evening (17-21): warm amber/purple — `verify: inspect (gradient classes)`
- [ ] Night (21-6): deep indigo — `verify: inspect (gradient classes)`
- [ ] All gradients use theme-safe opacity (5-8%) — `verify: inspect (opacity values)`
- [ ] Updates every 15 minutes via useEffect interval — `verify: inspect (setInterval 900000)`
- [ ] Works with both light and dark themes — `verify: inspect (opacity-based, no hardcoded colors)`

### Affected Components
- `src/features/journal/TimeOfDayGradient.tsx` — NEW

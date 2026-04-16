# T1: Create useEntryTransition State Machine

**Story:** [EP11_US004](../story.md) | **Type:** Implementation | **Status:** Todo | **Priority:** P0 | **Estimate:** 4h | **Parallel Group:** 1

## Goal
Create the `useEntryTransition` hook with a state machine (idle→morphing-forward→settled→morphing-reverse→idle) that prevents layoutId conflicts during rapid switching.

## Acceptance Criteria
- [ ] State machine: idle → morphing-forward → settled → morphing-reverse → idle — `verify: inspect (state transitions)`
- [ ] 100ms debounce on entry selection — `verify: inspect (debounce logic)`
- [ ] Rapid switch: settled → morphing-forward (skips reverse, redirects) — `verify: inspect (interrupt logic)`
- [ ] Exports: `transitionState`, `startTransition`, `completeTransition`, `reverseTransition` — `verify: command (grep 'export' src/hooks/useEntryTransition.ts)`

### Affected Components
- `src/hooks/useEntryTransition.ts` — NEW hook
- `src/features/journal/JournalModule.tsx` — use hook for entry switching

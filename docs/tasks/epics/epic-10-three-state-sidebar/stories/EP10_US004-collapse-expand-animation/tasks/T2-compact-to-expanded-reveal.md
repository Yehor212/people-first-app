# T2: Compact→Expanded Content Reveal with Stagger

**Story:** [EP10_US004](../story.md) | **Type:** Implementation | **Status:** Todo | **Priority:** P0 | **Estimate:** 4h | **Parallel Group:** 1

## Goal
Implement animated content reveal when sidebar expands from compact: width grows, header fades in, cards stagger in, calendar appears.

## Acceptance Criteria
- [ ] Panel width animates 48px → expanded with spring(300,25) — `verify: inspect (spring values)`
- [ ] Header text fades in + slides 8px from start (150-250ms) — `verify: inspect (x + opacity animation)`
- [ ] Entry cards fade in with 40ms stagger (200-300ms) — `verify: inspect (stagger config)`
- [ ] Calendar fades in with scale 1.0 from 0.95 (250-350ms) — `verify: inspect (scale + opacity)`
- [ ] Total < 350ms — `verify: inspect (timing values)`

### Affected Components
- `src/features/journal/JournalModule.tsx` — entry animations
- `src/config/animations.ts` — use existing springPresets + stagger

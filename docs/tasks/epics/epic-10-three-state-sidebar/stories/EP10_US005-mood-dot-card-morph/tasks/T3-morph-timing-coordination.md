# T3: Morph Timing Coordination with Collapse

**Story:** [EP10_US005](../story.md) | **Type:** Implementation | **Status:** Todo | **Priority:** P1 | **Estimate:** 4h | **Parallel Group:** 2

## Goal
Coordinate mood dot↔card morph timing with the collapse/expand animation choreography from US004.

## Acceptance Criteria
- [ ] On collapse: card text fades out (0-100ms), THEN mood circle morphs to dot (100-250ms) — `verify: inspect (timing sequence)`
- [ ] On expand: dots morph to cards (100-250ms), THEN text fades in with stagger (200-350ms) — `verify: inspect (timing sequence)`
- [ ] Spring preset: `springPresets.quick` (300/25) — `verify: command (grep 'springPresets.quick' src/features/journal/MoodDotStrip.tsx)`
- [ ] Only viewport-visible entries morph (off-screen skip) — `verify: inspect (visibility check)`

### Affected Components
- `src/features/journal/MoodDotStrip.tsx` — morph transition config
- `src/features/journal/JournalEntryCard.tsx` — morph transition config

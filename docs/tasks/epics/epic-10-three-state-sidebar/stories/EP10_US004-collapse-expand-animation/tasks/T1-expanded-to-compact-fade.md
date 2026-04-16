# T1: Expanded→Compact Content Fade Choreography

**Story:** [EP10_US004](../story.md) | **Type:** Implementation | **Status:** Todo | **Priority:** P0 | **Estimate:** 4h | **Parallel Group:** 1

## Goal
Implement staggered content fade-out when sidebar transitions from expanded to compact: calendar fades first, then card text, then header text.

## Acceptance Criteria
- [ ] Calendar strip fades out with scale 0.95 (0-100ms, easeIn) — `verify: inspect (motion.div exit animation)`
- [ ] Entry card text fades out (0-100ms, easeIn) — `verify: inspect (opacity transition)`
- [ ] Header text fades out, icon remains (100-200ms) — `verify: inspect (AnimatePresence on text)`
- [ ] Panel width animates using spring — `verify: inspect (spring transition on width)`
- [ ] Total < 300ms — `verify: inspect (animation duration values)`

### Affected Components
- `src/features/journal/JournalModule.tsx` — AnimatePresence wrapping sidebar content
- `src/features/journal/JournalEntryList.tsx` — exit animation on cards

# T1: Add layoutId to Mood Circles

**Story:** [EP10_US005](../story.md) | **Type:** Implementation | **Status:** Todo | **Priority:** P0 | **Estimate:** 3h | **Parallel Group:** 1

## Goal
Add framer-motion `layoutId` to mood circles in JournalEntryCard and MoodDotStrip so they can morph between sidebar states.

## Acceptance Criteria
- [ ] Mood circle in JournalEntryCard gets `layoutId={`mood-${entry.id}`}` — `verify: command (grep 'layoutId.*mood' src/features/journal/JournalEntryCard.tsx)`
- [ ] Mood dot in MoodDotStrip gets matching `layoutId={`mood-${entry.id}`}` — `verify: command (grep 'layoutId.*mood' src/features/journal/MoodDotStrip.tsx)`
- [ ] Only one instance per layoutId exists at a time — `verify: inspect (AnimatePresence mode)`
- [ ] No-mood entries (Bookmark icon) also get layoutId — `verify: inspect (layoutId on fallback icon)`

### Affected Components
- `src/features/journal/JournalEntryCard.tsx` — add layoutId to mood div
- `src/features/journal/MoodDotStrip.tsx` — add layoutId to dot div

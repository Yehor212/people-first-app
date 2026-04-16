# T4: Edge Cases — Rapid Toggle, No-Mood, 50+ Entries

**Story:** [EP10_US005](../story.md) | **Type:** Implementation | **Status:** Todo | **Priority:** P1 | **Estimate:** 3h | **Parallel Group:** 2

## Goal
Handle edge cases: rapid toggle without layoutId errors, entries without mood data, and performance with large entry counts.

## Acceptance Criteria
- [ ] Rapid toggle (< 500ms between toggles): no duplicate layoutId errors — `verify: inspect (debounce or AnimatePresence mode)`
- [ ] Entries without mood: bookmark icon morphs correctly — `verify: inspect (Bookmark in motion.div with layoutId)`
- [ ] 50+ entries: only 7 visible dots + 5 buffer morph (rest skip) — `verify: inspect (viewport check logic)`
- [ ] `prefers-reduced-motion`: no morph, instant switch — `verify: inspect (useReducedMotion conditional)`

### Affected Components
- `src/features/journal/MoodDotStrip.tsx` — edge case handling
- `src/features/journal/JournalModule.tsx` — debounce on toggle

# T3: Defer Editor Content Until Morph Settles

**Story:** [EP11_US002](../story.md) | **Type:** Implementation | **Status:** Todo | **Priority:** P1 | **Estimate:** 4h | **Parallel Group:** 2

## Goal
Defer editor content rendering until the card→editor morph animation completes, preventing jank from heavy content render during morph.

## Acceptance Criteria
- [ ] Editor content starts at opacity 0 during morph — `verify: inspect (initial opacity)`
- [ ] Content fades in via `onLayoutAnimationComplete` callback — `verify: command (grep 'onLayoutAnimationComplete' src/features/journal/JournalEntryEditor.tsx)`
- [ ] Fade-in uses 200ms ease — `verify: inspect (transition duration)`
- [ ] `prefers-reduced-motion`: content visible immediately (no defer) — `verify: inspect (reducedMotion conditional)`

### Affected Components
- `src/features/journal/JournalEntryEditor.tsx` — defer content, callback

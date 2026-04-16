# T2: Mood-Ambient Gradient + Edge Cases

**Story:** [EP11_US003](../story.md) | **Type:** Implementation | **Status:** Todo | **Priority:** P1 | **Estimate:** 4h | **Parallel Group:** 1

## Goal
Shift editor background to mood-ambient gradient on entry open, and handle edge cases (no-mood, rapid switch, compact→editor).

## Acceptance Criteria
- [ ] Editor background shifts to mood gradient at 5% opacity on entry open — `verify: inspect (background gradient class)`
- [ ] Gradient transition uses 300ms ease — `verify: inspect (transition duration)`
- [ ] No-mood entries: neutral gradient (primary/3) — `verify: inspect (fallback gradient)`
- [ ] Rapid switch: gradient updates to new mood instantly — `verify: inspect (key-based re-render)`
- [ ] Compact→editor: mood dot (8px) scales up to header circle (10px) during morph — `verify: inspect (size transition)`
- [ ] `prefers-reduced-motion`: instant gradient, no morph — `verify: inspect (reducedMotion check)`

### Affected Components
- `src/features/journal/JournalEntryEditor.tsx` — mood gradient + edge cases

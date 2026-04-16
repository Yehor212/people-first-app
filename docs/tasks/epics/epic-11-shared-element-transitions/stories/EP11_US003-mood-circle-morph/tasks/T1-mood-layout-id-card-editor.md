# T1: Mood Circle layoutId in Card + Editor Header

**Story:** [EP11_US003](../story.md) | **Type:** Implementation | **Status:** Todo | **Priority:** P0 | **Estimate:** 3h | **Parallel Group:** 1

## Goal
Add layoutId to mood circles in both card and editor header so mood emoji morphs between them during transitions.

## Acceptance Criteria
- [ ] Mood circle in card: `layoutId={`mood-${entry.id}`}` — already from EP10_US005, verify reuse — `verify: command (grep 'mood-' src/features/journal/JournalEntryCard.tsx)`
- [ ] Mood circle in editor header: `layoutId={`mood-${activeEntryId}`}` — `verify: command (grep 'mood-' src/features/journal/JournalEntryEditor.tsx)`
- [ ] Emoji visible throughout morph (no flash) — `verify: inspect (content inside motion.div)`
- [ ] Spring: springPresets.quick (300/25) — `verify: inspect (transition config)`

### Affected Components
- `src/features/journal/JournalEntryEditor.tsx` — add mood circle with layoutId in header

# T1: Add layoutId to Card + Editor Wrappers

**Story:** [EP11_US002](../story.md) | **Type:** Implementation | **Status:** Todo | **Priority:** P0 | **Estimate:** 3h | **Parallel Group:** 1

## Goal
Add framer-motion `layoutId` to JournalEntryCard wrapper and JournalEntryEditor wrapper to enable shared-element morph.

## Acceptance Criteria
- [ ] Card wrapper gets `layoutId={`entry-${entry.id}`}` — `verify: command (grep 'layoutId.*entry-' src/features/journal/JournalEntryCard.tsx)`
- [ ] Editor wrapper gets `layoutId={`entry-${activeEntryId}`}` — `verify: command (grep 'layoutId.*entry-' src/features/journal/JournalEntryEditor.tsx)`
- [ ] Both use `motion.div` — `verify: inspect (motion.div wrapping)`
- [ ] layout="position" on inner elements for independent sizing — `verify: inspect (layout prop)`

### Affected Components
- `src/features/journal/JournalEntryCard.tsx` — layoutId on outer wrapper
- `src/features/journal/JournalEntryEditor.tsx` — layoutId on outer wrapper

# T2: Reverse Morph on Back Navigation

**Story:** [EP11_US004](../story.md) | **Type:** Implementation | **Status:** Todo | **Priority:** P0 | **Estimate:** 4h | **Parallel Group:** 2

## Goal
Implement reverse animation (editor shrinks back to card) on Back button, Escape key, and sidebar collapse while entry open.

## Acceptance Criteria
- [ ] Back button: editor content fades out (100ms), wrapper morphs to card (200ms spring) — `verify: inspect (exit animation sequence)`
- [ ] Siblings restore to 100% opacity with 40ms stagger — `verify: inspect (stagger restore)`
- [ ] Escape key (when not in text input): triggers reverse morph — `verify: inspect (keydown handler with input check)`
- [ ] Card settles with springPresets.quick bounce — `verify: inspect (spring transition)`
- [ ] `prefers-reduced-motion`: instant cut back — `verify: inspect (reducedMotion conditional)`

### Affected Components
- `src/features/journal/JournalModule.tsx` — back handler with morph
- `src/features/journal/JournalEntryEditor.tsx` — exit animation

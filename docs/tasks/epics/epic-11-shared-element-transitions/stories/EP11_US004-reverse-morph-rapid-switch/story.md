# EP11_US004: Reverse Morph & Rapid Switch

**Epic:** [Epic 11: Shared-Element Transitions](../../epic.md)
**Status:** Backlog
**Priority:** P1
**Complexity:** High
**Created:** 2026-04-15

---

## Goal

Implement the reverse animation (editor→card) when pressing back, and handle rapid entry switching without flicker or layoutId conflicts, ensuring the morph system is robust under real-world usage.

## Acceptance Criteria

### AC1: Reverse Morph (Editor → Card)

- [ ] When user presses Back or clicks another entry, editor content fades out (100ms)
- [ ] Editor wrapper morphs back to card position in sidebar (200ms spring)
- [ ] Mood circle returns to its card position
- [ ] Sibling cards restore to full opacity with 40ms stagger
- [ ] Card settles with subtle bounce (springPresets.quick)

### AC2: Rapid Entry Switching

- [ ] Clicking entry B while entry A is still morphing: morph interrupts and redirects to B
- [ ] No duplicate layoutId errors during rapid switching
- [ ] Debounce entry selection at 100ms to prevent sub-frame conflicts
- [ ] Editor content swaps cleanly without flash of stale content

### AC3: Back Navigation Variants

- [ ] Editor Back button: reverse morph to card
- [ ] Keyboard Escape: reverse morph to card (when not in text input)
- [ ] Click on same entry in sidebar: no effect (entry already open)
- [ ] Sidebar collapse while entry open: morph adapts to compact dot position

### AC4: State Consistency

- [ ] After reverse morph completes, `journal.view` returns to "list" state
- [ ] Active entry indicator clears from sidebar card
- [ ] Undo-delete toast (5s timer) survives morph transitions without interruption
- [ ] `prefers-reduced-motion`: instant cut back, no reverse morph

## Technical Notes

### Affected Components

- `src/features/journal/JournalModule.tsx` — handle back navigation with morph-aware transitions
- `src/features/journal/JournalEntryEditor.tsx` — exit animation on back
- `src/hooks/useEntryTransition.ts` — NEW: debounce logic, morph state machine, rapid switch handling

### Architecture

The morph system needs a state machine:
- `idle` → `morphing-forward` → `settled` → `morphing-reverse` → `idle`
- Rapid switch: `settled` → `morphing-forward` (interrupts, skips reverse)
- State machine prevents duplicate layoutId by ensuring only one morph direction at a time.

### Dependencies

- EP11_US002 (forward morph to reverse)
- EP11_US003 (mood circle reverse)

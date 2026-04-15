# T2: Word Count Milestones & Confetti

**Story:** [EP6_US003 — Journal Save Flow & Word Count Milestones](../story.md)
**Type:** Implementation
**Status:** Todo
**Priority:** P1
**Estimate:** 4h
**Parallel Group:** 1

---

## Goal

Add word count milestone detection at 100/250/500/1000 words with counter pulse animation and haptic feedback, plus confetti celebration at 1000 words, motivating users to write longer entries.

## Acceptance Criteria

- [ ] Counter pulses (scale 1 to 1.15 to 1) when word count crosses 100, 250, 500, or 1000 — `verify: command (grep 'milestone\|MILESTONES\|threshold' src/features/journal/useJournalEditorState.ts)`
- [ ] hapticTap() fires at each milestone crossing — `verify: command (grep 'hapticTap' src/features/journal/useJournalEditorState.ts)`
- [ ] ConfettiBurst renders at 1000 words, gated by shouldShowConfetti() — `verify: command (grep 'ConfettiBurst\|confetti' src/features/journal/JournalEntryEditor.tsx)`
- [ ] Milestones only fire on upward crossing (not when deleting text back below threshold) — `verify: inspect (prevWordCount ref compared: prev < threshold AND current >= threshold)`
- [ ] Pulse animation gated behind shouldAnimate() — `verify: inspect (shouldAnimate check before scale animation)`
- [ ] No milestone fires on initial load (only during active editing) — `verify: inspect (prevWordCount initialized to current wordCount, not 0)`

## Technical Approach

### Implementation Plan

1. In useJournalEditorState.ts:
   - Add `prevWordCountRef = useRef(wordCount)` initialized to current wordCount (prevents false milestone on load)
   - Define MILESTONES array: [100, 250, 500, 1000]
   - In useEffect watching wordCount: compare prev vs current, detect upward threshold crossing
   - On milestone: set `milestoneTriggered` state (number or null), fire hapticTap()
   - On 1000: additionally set `showConfetti` state
   - Update prevWordCountRef.current = wordCount
   - Export: milestoneTriggered, showConfetti, onConfettiComplete
2. In JournalEntryEditor.tsx:
   - Import milestoneTriggered from editor state
   - Wrap word count display in motion.span with conditional scale animation when milestoneTriggered is set
   - Render ConfettiBurst when showConfetti is true (lazy import)
   - Auto-clear milestoneTriggered after animation (300ms timeout or onAnimationComplete)

**Pattern Hint:** ConfettiBurst already used in 4 places (Celebrations.tsx, XpPopup.tsx, AllHabitsDoneAnimation.tsx). shouldShowConfetti() from animationUtils.ts used in 3 files.

### Affected Components

- `src/features/journal/useJournalEditorState.ts` — add milestone detection logic
- `src/features/journal/JournalEntryEditor.tsx` — add pulse animation + ConfettiBurst render

### Related

- Depends on: nothing (parallel with T1)
- Blocks: nothing

## Context

The editor already tracks `wordCount` via `countWordsHtml(content)` (useJournalEditorState.ts:346) and displays it in the editor footer (JournalEntryEditor.tsx:1222). The milestone feature adds animation and celebration on top of this existing counter without changing the counting logic.

Key: `prevWordCountRef` must be initialized to the CURRENT wordCount (not 0), otherwise opening a 500-word entry for editing would immediately fire milestones for 100/250/500. Milestones should only fire during active writing in the current session.

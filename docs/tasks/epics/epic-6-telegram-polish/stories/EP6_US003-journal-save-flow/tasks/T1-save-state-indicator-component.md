# T1: Save State Indicator Component

**Story:** [EP6_US003 — Journal Save Flow & Word Count Milestones](../story.md)
**Type:** Implementation
**Status:** Todo
**Priority:** P1
**Estimate:** 4h
**Parallel Group:** 1

---

## Goal

Create a new SaveIndicator.tsx component with a state machine (idle, saving, saved, error, synced) and smooth animated transitions between states, providing clear visual feedback during the journal save lifecycle.

## Acceptance Criteria

- [ ] SaveIndicator component exists at src/features/journal/SaveIndicator.tsx — `verify: command (test -f src/features/journal/SaveIndicator.tsx && echo EXISTS)`
- [ ] Accepts state prop: idle, saving, saved, error, synced — `verify: command (grep "idle.*saving.*saved.*error.*synced" src/features/journal/SaveIndicator.tsx)`
- [ ] Saving state shows pulse animation — `verify: inspect (animate-pulse or framer-motion pulse on saving state)`
- [ ] Saved state shows checkmark with 200ms fade-in — `verify: inspect (checkmark icon with opacity transition 200ms)`
- [ ] Error state shows error indicator with onRetry callback prop — `verify: command (grep 'onRetry' src/features/journal/SaveIndicator.tsx)`
- [ ] All animations gated behind shouldAnimate() — `verify: command (grep 'shouldAnimate' src/features/journal/SaveIndicator.tsx)`
- [ ] ARIA: live region for screen reader announcements of save state — `verify: command (grep 'aria-live' src/features/journal/SaveIndicator.tsx)`

## Technical Approach

### Implementation Plan

1. Create src/features/journal/SaveIndicator.tsx
2. Define SaveState type: `'idle' | 'saving' | 'saved' | 'error' | 'synced'`
3. Props: `{ state: SaveState; onRetry?: () => void }`
4. Render based on state:
   - idle: nothing or subtle dot
   - saving: Loader2 icon with animate-spin + pulse text "Saving..."
   - saved: Check icon with 200ms opacity fade-in + text "Saved"
   - error: AlertCircle icon in destructive color + "Save failed" + retry button
   - synced: Cloud icon + "Synced" (brief display then fade)
5. Use framer-motion AnimatePresence for smooth transitions between states
6. Gate animations: if shouldAnimate() is false, show static icons without transitions
7. Add aria-live="polite" region for state change announcements
8. Use theme tokens for all colors (no hardcoded)

**Pattern Hint:** SyncStatusIndicator.tsx and SyncStatusBadge.tsx exist in src/components/. Review for reuse of sync state patterns.

### Affected Components

- `src/features/journal/SaveIndicator.tsx` — NEW

### Related

- Depends on: nothing
- Blocks: T3 (Integration into Editor imports this component)

## Context

The journal editor currently has a boolean `saving` state in useJournalEditorState.ts but no visual indicator — save happens silently. SyncStatusIndicator.tsx exists for cloud sync status but is a different concern (full sync vs individual entry save). The new SaveIndicator is entry-level: it shows the save lifecycle of the current entry being edited.

The component must be lightweight (renders inside the editor toolbar area) and non-intrusive — it should inform without distracting from writing flow.

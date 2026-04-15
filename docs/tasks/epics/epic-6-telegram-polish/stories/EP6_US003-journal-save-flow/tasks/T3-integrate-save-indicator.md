# T3: Integrate Save Indicator into Editor

**Story:** [EP6_US003 — Journal Save Flow & Word Count Milestones](../story.md)
**Type:** Implementation
**Status:** Todo
**Priority:** P1
**Estimate:** 4h
**Parallel Group:** 2

---

## Goal

Wire the SaveIndicator component into JournalEntryEditor, extending the existing boolean `saving` state into a full state machine (idle/saving/saved/error/synced) with optimistic updates and error handling with retry.

## Acceptance Criteria

- [ ] SaveIndicator rendered in the editor toolbar/header area — `verify: command (grep 'SaveIndicator' src/features/journal/JournalEntryEditor.tsx)`
- [ ] Save state transitions: idle -> saving (on edit debounce) -> saved (on success) -> synced (on cloud sync) — `verify: command (grep "saveState\|SaveState" src/features/journal/useJournalEditorState.ts)`
- [ ] Minimum 400ms display for saving state (no flicker on fast saves) — `verify: command (grep '400\|MIN_SAVE_DISPLAY' src/features/journal/useJournalEditorState.ts)`
- [ ] Optimistic: indicator shows saving immediately when content changes, before debounce fires — `verify: inspect (saving state set on content change, not on save call)`
- [ ] Error state shows with retry, content preserved in IndexedDB — `verify: inspect (error state sets saveState to error, retry calls handleSave)`
- [ ] Saved state auto-transitions to idle after 2s — `verify: inspect (setTimeout to reset saveState after saved)`

## Technical Approach

### Implementation Plan

1. In useJournalEditorState.ts:
   - Replace boolean `saving` with `saveState: SaveState` (idle/saving/saved/error/synced)
   - Add MIN_SAVE_DISPLAY_MS = 400 constant
   - On content change (isDirty): set saveState to 'saving' immediately (optimistic)
   - In handleSave: record start time, await save, enforce min display with setTimeout
   - On success: set 'saved', auto-transition to 'idle' after 2s
   - On error: set 'error', expose retryHandler
   - On cloud sync complete (if applicable): briefly set 'synced' then back to 'idle'
   - Export saveState, handleRetry (replaces boolean saving)
2. In JournalEntryEditor.tsx:
   - Import SaveIndicator from ./SaveIndicator
   - Replace usages of `saving` boolean with `saveState` equivalents
   - Render SaveIndicator in editor header near word count area
   - Pass onRetry={handleRetry} for error state
3. Backward compat: update any `saving` boolean consumers (e.g., save button disabled state) to use `saveState === 'saving'`

**Pattern Hint:** 3 existing sync state patterns in src/components/ (SyncStatusIndicator.tsx, SyncStatusBadge.tsx). Review for transition timing patterns.

### Affected Components

- `src/features/journal/useJournalEditorState.ts` — replace saving boolean with saveState machine
- `src/features/journal/JournalEntryEditor.tsx` — render SaveIndicator, update saving references

### Related

- Depends on: T1 (Save State Indicator Component — imports SaveIndicator.tsx)
- Blocks: nothing

## Context

The current save flow in useJournalEditorState.ts (line 571) uses a boolean `saving` state that is only true during the actual save operation. Users see no visual feedback — the save is silent. The existing `saving` boolean is used in JournalEntryEditor.tsx for disabling the save button (line 545) and the unsaved dialog (line 1490).

Replacing the boolean with a state machine requires updating these consumers but the change is straightforward: `saving` becomes `saveState === 'saving'`. The 400ms minimum display prevents the indicator from flickering when IndexedDB saves complete in < 50ms (which is typical).

The optimistic pattern (showing "Saving" on content change, not on actual save call) gives the user instant feedback. The debounced save fires later, and the indicator transitions to "Saved" on completion.

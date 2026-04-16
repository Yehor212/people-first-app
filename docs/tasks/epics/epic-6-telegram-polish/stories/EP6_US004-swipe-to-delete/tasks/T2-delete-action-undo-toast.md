# T2: Delete Action, Undo Toast & Haptic

**Epic:** [Epic 6 — Telegram-Level Polish](../../../../epics/epic-6-telegram-polish/epic.md)
**User Story:** [EP6_US004 Swipe-to-Delete](../story.md)
**Related:** T1 (provides onSwipeDelete callback)
**Parallel Group:** 1

---

## Context

### Current State

- Soft-delete + undo toast + 5s timer **already implemented** in `JournalModule.tsx:154` and `useJournal.ts:112`.
- `softDeleteEntry(id)` removes from UI state, returns entry for undo.
- `commitDelete()` permanently removes after timeout; `restoreEntry()` on undo.
- Undo toast with "Undo" button already renders in `JournalModule.tsx:1685`.

### Desired State

- Wire existing soft-delete/undo flow to swipe gesture from T1.
- Add slide-out animation on confirmed swipe (card exits left with spring).
- Ensure deletion tracker IDs remain permanent (project rule).

### Inherited Assumptions

- **A1 (ARCHITECTURE):** Existing soft-delete pattern in useJournal.ts is the single source of truth for entry deletion.

---

> [!WARNING]
> **DRY Check:** Soft-delete + undo functionality already exists in codebase
>
> - Existing: `src/features/journal/JournalModule.tsx:154` (undo state), `src/features/journal/useJournal.ts:112` (softDeleteEntry/restoreEntry)
> - Similarity: 85% (exact domain match — journal entry deletion with undo)
> - **Recommendation:** REUSE existing soft-delete flow (Option 1). Wire T1's `onSwipeDelete` to call existing `softDeleteEntry()`. Add slide-out animation only.

---

## Implementation Plan

### Phase 1: Wire Swipe to Existing Delete Flow

- [ ] In `JournalModule.tsx`, handle `onSwipeDelete(id)` from T1 by calling existing `softDeleteEntry(id)`
- [ ] Existing undo toast + 5s timer + restore already work — no changes needed

### Phase 2: Slide-Out Animation

- [ ] Add `AnimatePresence` exit animation on card: `exit={{ x: -300, opacity: 0 }}` with spring transition
- [ ] Use `layout` prop on sibling cards for smooth gap-close after removal

### Phase 3: Haptic Confirmation

- [ ] Fire `hapticSuccess()` when slide-out animation completes (delete committed to UI)
- [ ] Gate haptic via `shouldTriggerHaptics()` from Dopamine settings

---

## Technical Approach

### Recommended Solution

**Library:** Framer Motion v11 (AnimatePresence exit)
**Existing code:** `useJournal.ts` soft-delete API

### Key APIs

- `softDeleteEntry(id): JournalEntry | null` — existing, removes from state
- `restoreEntry(entry)` — existing, adds back on undo
- `AnimatePresence` + `exit` prop — slide-out animation on removal

### Implementation Pattern

```pseudocode
handleSwipeDelete(id):
  entry = softDeleteEntry(id)  // existing API
  // AnimatePresence handles exit animation automatically
  hapticSuccess()
  // existing 5s timer + undo toast already active
```

### Why This Approach

- Zero duplication — reuses 100% of existing delete infrastructure
- Only adds visual animation layer on top

### Patterns Used

- Delegation to existing hook (useJournal)
- AnimatePresence exit animations (established pattern in codebase)

---

## Acceptance Criteria

- [ ] **Given** T1 fires `onSwipeDelete`, **When** the delete triggers, **Then** card slides out left (spring) and existing undo toast appears for 5 seconds.
- [ ] **Given** I tap "Undo" within 5s, **When** the entry restores, **Then** card springs back into list position.
- [ ] **Given** 5s passes without undo, **When** timeout fires, **Then** entry is permanently deleted via existing `commitDelete()`.
- [ ] **Given** haptics are disabled, **Then** no haptic fires but animation plays normally.

---

## Affected Components

### Implementation

- `src/features/journal/JournalModule.tsx` — wire onSwipeDelete to softDeleteEntry
- `src/features/journal/JournalEntryList.tsx` — add AnimatePresence wrapper for exit animations
- Side-effects: existing IndexedDB deletion flow (no changes)

---

## Existing Code Impact

### Refactoring Required

- `JournalEntryList.tsx` — wrap entry list items in `AnimatePresence` for exit support

### Tests to Update

- None — existing useJournal tests cover soft-delete/restore flow

---

## Definition of Done

- [ ] All acceptance criteria met
- [ ] Existing undo flow works unchanged
- [ ] Deletion tracker IDs remain permanent
- [ ] NO new tests created

# EP6_US003: Journal Save Flow & Word Count Milestones

**Status:** Backlog
**Epic:** 6 — Telegram-Level Polish
**Priority:** P1
**INVEST Score:** 6/6

---

## User Story

As a **diary user**, I want to see a smooth save indicator and milestone celebrations while writing, so that I know my entries are being saved and feel motivated to write more.

## Description

The journal editor currently saves silently. This story adds:

1. **Save state indicator**: Idle -> Saving (pulse) -> Saved (checkmark fade-in) -> Synced.
2. **Optimistic save** — indicator shows "Saving" immediately on edit.
3. **Word count milestones** — counter pulses at 100/250/500/1000 words. Confetti at 1000.

**Zero visual regression constraint:** Save indicator is additive. Word count styling unchanged.

## Acceptance Criteria

1. **Given** I edit a journal entry, **When** auto-save triggers, **Then** I see Saving (pulse) -> Saved (checkmark, 200ms) -> Synced, with minimum 400ms display.
2. **Given** my word count crosses 100/250/500/1000, **Then** the counter pulses (scale 1->1.15->1) with a light haptic.
3. **Given** I reach 1000 words, **Then** confetti appears (respecting `shouldShowConfetti()`).
4. **Given** a save error, **Then** error indicator shows with retry, content preserved in IndexedDB.

## Technical Notes

**Standards Research:** [RSH-001](../../../research/rsh-001-telegram-polish-standards.md) — section 6

- Save indicator state machine: `idle | saving | saved | error | synced`. Min 400ms display.
- Word milestones: `prevWordCount` ref, threshold crossing detection. `hapticTap()` for milestones, `hapticSuccess()` + `ConfettiBurst` for 1000.
- Error: inline indicator, Dexie is source of truth.

**Files:** `JournalEntryEditor.tsx`, `useJournalEditorState.ts`, NEW: `SaveIndicator.tsx`

## Dependencies

- None

## Test Strategy

_(Planned by test planner)_

## Orchestrator Brief

```
tech: "React, Framer Motion, Capacitor Haptics"
keyFiles: ["JournalEntryEditor.tsx", "useJournalEditorState.ts", "new: SaveIndicator.tsx"]
approach: "SaveIndicator state machine + word count milestone detection"
complexity: "Medium"
```

## Definition of Done

- [ ] Save indicator transitions smoothly through all states
- [ ] Min 400ms display for "Saving"
- [ ] Milestones trigger pulse + haptic at 100/250/500/1000
- [ ] Confetti at 1000 when enabled
- [ ] Error preserves content, shows retry
- [ ] Gated by `shouldAnimate()`, no TS errors, tests pass

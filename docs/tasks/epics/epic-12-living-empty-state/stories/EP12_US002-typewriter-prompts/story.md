# EP12_US002: Typewriter Rotating Prompts

**Epic:** [Epic 12: Living Empty State & Ambient Canvas](../../epic.md)
**Status:** Backlog
**Priority:** P0
**Complexity:** Medium
**Created:** 2026-04-15

---

## Goal

Display writing prompts that type themselves out character by character, hold, erase, and cycle to the next prompt — creating an inviting, dynamic empty state that inspires users to start writing.

## Acceptance Criteria

### AC1: Typewriter Effect

- [ ] Prompt types out character by character at 40ms per character
- [ ] Typed text holds visible for 5 seconds after completing
- [ ] Text erases backwards at 20ms per character
- [ ] 1 second pause between erase and next prompt
- [ ] Blinking cursor (|) visible at typing position during type/hold/erase phases

### AC2: Prompt Rotation

- [ ] Cycles through prompts from existing `DAILY_QUOTES` array + new writing prompts
- [ ] Order is deterministic per day (seeded by day-of-year, same as existing quote logic)
- [ ] Minimum 10 prompts in rotation
- [ ] All prompts available in all 8 languages via i18n keys

### AC3: Localization

- [ ] Typewriter effect works correctly with all 8 languages including RTL (Arabic, Hebrew)
- [ ] RTL languages: cursor appears on left, text types from right to left
- [ ] Japanese: types correctly (no character splitting issues with multi-byte)
- [ ] Prompt text uses `t()` translation function

### AC4: Lifecycle

- [ ] Typewriter pauses when document is hidden (Page Visibility API)
- [ ] Resumes from current position when document becomes visible
- [ ] Unmounts cleanly with no stale intervals/timeouts
- [ ] No memory leaks on repeated mount/unmount cycles

### AC5: Reduced Motion

- [ ] `prefers-reduced-motion`: shows static prompt text (no typing animation)
- [ ] Static prompt changes every 8 seconds with simple fade (300ms)

## Technical Notes

### Affected Components

- `src/features/journal/TypewriterText.tsx` — NEW component
- `src/i18n/translations.ts` — add writing prompt keys for all 8 languages

### Architecture

useEffect-based state machine: `typing | holding | erasing | pausing`. Tracks `promptIndex`, `charIndex`, `phase`. Uses `requestAnimationFrame` or `setTimeout` chain (not `setInterval`) for precise timing. Page Visibility API pauses/resumes via `document.addEventListener("visibilitychange")`.

### Dependencies

- None (independent component)
- i18n: needs 10+ new prompt keys in all 8 languages

# T2: Haptic Pulse on Pointer Down

**Story:** [EP6_US002 — Mood Selection Micro-Interaction](../story.md)
**Type:** Implementation
**Status:** Done
**Priority:** P1
**Estimate:** 3h
**Parallel Group:** 1

---

## Goal

Fire a light haptic pulse on `onPointerDown` (not onClick) when tapping a mood emoji, eliminating the 80-120ms delay of click events and providing instant tactile feedback. Exactly 1 haptic per gesture.

## Acceptance Criteria

- [ ] Haptic fires on onPointerDown, not onClick — `verify: command (grep 'onPointerDown' src/components/mood-tracker/MoodInputView.tsx)`
- [ ] Uses hapticTap() (Light impact) from src/lib/haptics.ts — `verify: command (grep 'hapticTap' src/components/mood-tracker/MoodInputView.tsx)`
- [ ] Exactly 1 haptic per tap gesture (no double-fire from pointer + click) — `verify: inspect (haptic only in onPointerDown handler, not in onClick)`
- [ ] Haptic gated behind shouldTriggerHaptics() via canTriggerHaptics() inside hapticTap() — `verify: inspect (hapticTap already has gate internally, no additional check needed)`
- [ ] Selection logic remains on onClick (not moved to onPointerDown) — `verify: command (grep 'onClick.*onSelectMood' src/components/mood-tracker/MoodInputView.tsx)`
- [ ] Keyboard activation (Enter/Space) still works and does NOT fire haptic — `verify: inspect (onPointerDown does not fire on keyboard, only touch/mouse)`

## Technical Approach

### Implementation Plan

1. Import `hapticTap` from `@/lib/haptics` in MoodInputView.tsx
2. Add `onPointerDown` handler to each mood button (lines 103-130):
   - `onPointerDown={() => void hapticTap()}`
3. Keep existing `onClick={() => onSelectMood(mood.type)}` unchanged for selection logic
4. No debounce needed: onPointerDown fires once per gesture naturally, and hapticTap() is fire-and-forget (async but no await needed)
5. Verify: keyboard Enter/Space fires onClick but NOT onPointerDown (browser behavior) — haptic correctly skipped on keyboard

**Pattern Hint:** 8 existing hapticTap/hapticMedium usages in src/. JournalEntryCard.tsx line 170 uses `void hapticMedium()` in touch handler — same pattern.

### Affected Components

- `src/components/mood-tracker/MoodInputView.tsx` — add onPointerDown with hapticTap to mood buttons

### Related

- Depends on: nothing
- Blocks: nothing (T1 is independent, parallel Group 1)

## Context

Current MoodInputView.tsx (line 106) uses `onClick={() => onSelectMood(mood.type)}` with no haptic feedback at all. The click event has an inherent 80-120ms delay on mobile (waiting to distinguish tap from double-tap/scroll). By firing haptic on `onPointerDown`, the user feels instant tactile response.

The `hapticTap()` function in haptics.ts already includes the `canTriggerHaptics()` gate (checks native platform + shouldTriggerHaptics() from Dopamine Settings). No additional gating needed in MoodInputView.

Note: Selection logic MUST stay on onClick (not onPointerDown) because onPointerDown fires even during scroll/drag gestures. onClick correctly filters to intentional taps only.

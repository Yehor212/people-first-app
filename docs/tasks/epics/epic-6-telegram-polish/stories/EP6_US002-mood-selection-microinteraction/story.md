# EP6_US002: Mood Selection Micro-Interaction

**Status:** Done
**Epic:** 6 — Telegram-Level Polish
**Priority:** P1
**INVEST Score:** 6/6

---

## User Story

As a **diary user**, I want to feel satisfying spring-bounce feedback when I select a mood emoji, so that the emotional check-in moment feels intentional and rewarding.

## Description

The mood selection (StateOfMind flow) currently uses basic onClick without spring physics or visual emphasis on the selected state. This story adds Telegram-quality micro-interactions:

1. **Spring bounce** on the selected emoji (1->1.3->1.1 with underdamped spring).
2. **Deselection fade** — unselected emojis dim to 60% opacity.
3. **Haptic pulse** — single light impact on each mood tap, respecting Dopamine Settings.

**Zero visual regression constraint:** Emoji grid layout, sizes, and colors must not change. Only animation behavior is added on top.

## Acceptance Criteria

1. **Given** I tap a mood emoji, **When** it becomes selected, **Then** it scales 1->1.3->1.1 with spring bounce (stiffness 400, damping 12) and a light haptic fires on touch-down.
2. **Given** I select a mood, **When** the selection animates, **Then** unselected emojis fade to 60% opacity over 200ms with `easeOut`.
3. **Given** I change my mood selection, **When** I tap a different emoji, **Then** the previous selection smoothly de-scales (200ms) while the new one bounces, with exactly one haptic per tap.

## Technical Notes

**Standards Research:** [RSH-001](../../../research/rsh-001-telegram-polish-standards.md) — sections 1, 2, 3

- Scale: Framer Motion `animate={{ scale }}` with `{ type: "spring", stiffness: 400, damping: 12, mass: 0.8 }`.
- Deselection: `animate={{ opacity: isSelected ? 1 : 0.6 }}`, `transition={{ duration: 0.2 }}`.
- Haptic: `haptics.moodSelected` on `onPointerDown` (NOT onClick — eliminates 80-120ms delay).
- Gate: `shouldAnimate()` for spring, `shouldTriggerHaptics()` for haptic.

**Files:** `StateOfMindModal.tsx`, `AnimatedMoodEmoji.tsx`

## Dependencies

- None

## Test Strategy

_(Planned by test planner)_

## Orchestrator Brief

```
tech: "React, Framer Motion, Capacitor Haptics"
keyFiles: ["StateOfMindModal.tsx", "AnimatedMoodEmoji.tsx"]
approach: "Add spring scale on selection, haptic on pointerDown, dim unselected"
complexity: "Low"
```

## Definition of Done

- [ ] Selected emoji bounces with spring physics
- [ ] Unselected emojis fade to 60% opacity
- [ ] Haptic fires on touch-down (not click), max 1 per gesture
- [ ] `shouldAnimate()` / `shouldTriggerHaptics()` respected
- [ ] 60 FPS, no TS errors, existing tests pass

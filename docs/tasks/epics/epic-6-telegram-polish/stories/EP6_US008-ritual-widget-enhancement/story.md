# EP6_US008: Ritual Widget Enhancement (BurnThought & GratitudeBloom)

**Status:** Backlog
**Epic:** 6 — Telegram-Level Polish
**Priority:** P2
**INVEST Score:** 6/6

---

## User Story

As a **diary user**, I want enhanced haptic and visual feedback during BurnThought and GratitudeBloom rituals, so that these mindfulness moments feel more immersive and rewarding.

## Description

BurnThought already has heavy animation (869 lines) with some haptics. GratitudeBloom has a 3-phase bloom animation (343 lines) with timed haptics. This story enhances both:

1. **BurnThought** — add missing phase-transition haptics and optional subtle fire sound toggle.
2. **GratitudeBloom** — add 5 distinct petal shapes (vs current 1) color-coded by gratitude category.
3. **Haptic consistency** — ensure both widgets follow the same haptic pattern: medium at start, success at completion.

**Zero visual regression constraint:** Existing animations preserved. Petal variety is additive (new SVG paths alongside existing). Sound is optional toggle.

## Acceptance Criteria

1. **Given** I use BurnThought, **When** each phase transitions (write -> burn -> release), **Then** appropriate haptic fires (medium on burn start, success on release complete).
2. **Given** I use GratitudeBloom, **When** the bloom animation plays, **Then** 5 distinct petal shapes appear (varied SVG paths), color-coded by gratitude category, with haptic on bloom completion.
3. **Given** I have haptics disabled in Dopamine Settings, **Then** rituals play all visual animations normally without any haptic feedback.

## Technical Notes

**Standards Research:** [RSH-001](../../../research/rsh-001-telegram-polish-standards.md) — section 3 (Haptic Pattern)

- BurnThought phases: existing code has phase state machine. Add `hapticMedium()` at burn-start transition, `hapticSuccess()` at release-complete. Check existing haptic calls (component already has `hapticWarning` and `hapticMedium`) — fill gaps only.
- GratitudeBloom petals: create 5 SVG petal path variants (rounded, pointed, heart, teardrop, star). Map categories (family, health, work, nature, personal) to petal shapes + color tokens.
- Color coding: use existing theme tokens for category colors. Each petal inherits the category color with 80% opacity.
- Sound: optional fire crackle for BurnThought, gated by `shouldPlaySounds()`. Use HTML5 Audio with preload.
- Gate: `shouldTriggerHaptics()` for haptics, `shouldAnimate()` for petal animation.

**Files:** `BurnThoughtWidget.tsx`, `GratitudeBloomWidget.tsx`

## Dependencies

- None (independent)

## Test Strategy

_(Planned by test planner)_

## Orchestrator Brief

```
tech: "React, Framer Motion, SVG, Capacitor Haptics"
keyFiles: ["BurnThoughtWidget.tsx", "GratitudeBloomWidget.tsx"]
approach: "Add phase-transition haptics to BurnThought, 5 SVG petal variants to GratitudeBloom"
complexity: "Low (targeted enhancements on existing widgets)"
```

## Definition of Done

- [ ] BurnThought haptics fire at each phase transition
- [ ] GratitudeBloom shows 5 petal shapes, color-coded by category
- [ ] Haptics respect Dopamine Settings toggle
- [ ] Existing animations unchanged
- [ ] 60 FPS, no TS errors, tests pass

# T1: Spring Bounce & Deselection Fade

**Story:** [EP6_US002 — Mood Selection Micro-Interaction](../story.md)
**Type:** Implementation
**Status:** Done
**Priority:** P1
**Estimate:** 3h
**Parallel Group:** 1

---

## Goal

Add framer-motion spring bounce animation (1 to 1.3 to 1.1) when a mood emoji is selected, and dim unselected emojis to 60% opacity, making the emotional check-in moment feel intentional and rewarding.

## Acceptance Criteria

- [ ] Selected emoji scales 1 to 1.3 to 1.1 with spring bounce (stiffness 400, damping 12, mass 0.8) — `verify: command (grep 'stiffness.*400' src/components/mood-emoji/AnimatedMoodEmoji.tsx)`
- [ ] Unselected emojis fade to 60% opacity over 200ms with easeOut — `verify: command (grep 'opacity.*0.6' src/components/mood-emoji/AnimatedMoodEmoji.tsx)`
- [ ] Changing mood selection: previous de-scales smoothly (200ms) while new one bounces — `verify: inspect (motion.div with animate prop driven by isSelected)`
- [ ] Animation gated behind shouldAnimate() — when disabled, no spring, instant state change — `verify: command (grep 'shouldAnimate' src/components/mood-emoji/AnimatedMoodEmoji.tsx)`
- [ ] 60 FPS maintained: only transform (scale) and opacity animated — `verify: inspect (no layout-triggering properties in animate)`
- [ ] Zero visual regression: emoji grid layout, sizes, colors unchanged — `verify: inspect (no changes to sizeClasses or grid wrapper)`

## Technical Approach

### Implementation Plan

1. Add framer-motion `motion.div` import to AnimatedMoodEmoji.tsx
2. Replace the outer `<div>` wrapper with `<motion.div>`
3. Add `animate` prop driven by `isSelected`:
   - Selected: `{ scale: 1.1, opacity: 1 }` with spring transition `{ type: "spring", stiffness: 400, damping: 12, mass: 0.8 }`
   - Not selected (when another is selected): `{ scale: 1, opacity: 0.6 }` with `{ duration: 0.2, ease: "easeOut" }`
   - Default (none selected): `{ scale: 1, opacity: 1 }` — no dimming when no selection made
4. Remove existing CSS `scale-110 drop-shadow-xl` classes (replaced by framer-motion)
5. Gate: wrap motion props in `shouldAnimate()` check — if false, render static `<div>` with no animation
6. The spring overshoot (1 to 1.3 to 1.1) happens naturally from the underdamped spring config (damping 12 is underdamped)

**Pattern Hint:** `shouldAnimate()` already imported and used in AnimatedMoodEmoji.tsx line 35. 20 files use framer-motion motion.div pattern in src/.

### Affected Components

- `src/components/mood-emoji/AnimatedMoodEmoji.tsx` — add framer-motion spring + opacity animation

### Related

- Depends on: nothing
- Blocks: nothing (T2 is independent, parallel Group 1)

## Context

Current AnimatedMoodEmoji.tsx (63 lines) uses CSS `transition-all duration-300` + `scale-110` for selection. This gives a linear scale with no bounce. The spec requires an underdamped spring (stiffness 400, damping 12) that naturally overshoots to ~1.3 before settling at 1.1, creating the satisfying "bounce" feel.

The component already imports and uses `shouldAnimate()` from animationUtils.ts (line 35) for SVG SMIL animations. Extending this gate to also control framer-motion spring is consistent.

Note: `isSelected` prop already exists on AnimatedMoodEmoji but a new prop or convention needed to distinguish "selected" (scale + full opacity) from "another is selected" (scale 1 + dimmed). Consider adding `hasSelection` boolean prop, or inferring from parent context.

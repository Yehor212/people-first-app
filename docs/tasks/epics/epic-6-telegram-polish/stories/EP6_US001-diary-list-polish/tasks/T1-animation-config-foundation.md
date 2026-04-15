# T1: Animation Config Foundation

**Story:** [EP6_US001 — Diary List: Stagger & Skeleton](../story.md)
**Type:** Implementation
**Status:** Done
**Priority:** P0
**Estimate:** 3h
**Parallel Group:** 1

---

## Goal

Create `src/config/animations.ts` — the centralized animation configuration file that all Epic 6 stories will use. Provides typed spring presets, duration presets, easing presets, and stagger configuration following the epic specification.

## Acceptance Criteria

- [ ] File `src/config/animations.ts` exists and exports all presets — `verify: inspect (file exists at src/config/animations.ts with named exports)`
- [ ] 5 spring presets exported: snappy (400/30), quick (300/25), smooth (260/25), playful (200/15), explosive (600/15) — `verify: command (grep -c 'spring' src/config/animations.ts >= 5)`
- [ ] 5 duration presets exported: micro (100ms), fast (200ms), normal (300ms), slow (500ms), celebration (800ms) — `verify: inspect (all 5 durations present)`
- [ ] 4 easing presets exported: enter, exit, overshoot, smooth — `verify: inspect (all 4 easings present)`
- [ ] Stagger config exported with perItem: 40, maxItems: 5, total helper — `verify: command (grep 'maxItems.*5' src/config/animations.ts)`
- [ ] All exports are TypeScript-typed with as const for type narrowing — `verify: command (npx tsc --noEmit src/config/animations.ts)`

## Technical Approach

### Implementation Plan

1. Create `src/config/animations.ts`
2. Define spring presets as framer-motion Transition objects with type: spring, stiffness, damping values
3. Define duration presets as numeric constants (milliseconds)
4. Define easing presets as cubic-bezier arrays compatible with framer-motion
5. Define stagger config object with perItem, maxItems, and total() helper
6. Export everything with as const and explicit TypeScript types
7. Add JSDoc comments mapping each preset to its intended use case

**Pattern Hint:** 5 existing spring presets in `src/lib/animationUtils.ts` (zenMotion). Review for reuse/alignment before creating new presets. The new config should complement, not conflict with, existing zenMotion tokens.

### Affected Components

- `src/config/animations.ts` — NEW
- `src/lib/animationUtils.ts` — reference only (no changes)

### Related

- Depends on: nothing
- Blocks: T3 (Stagger Animation Upgrade imports presets from this file)

## Context

This is the foundation file for all Epic 6 (Telegram-Level Polish) stories. Every animation enhancement in EP6_US002-US010 will import from this config. Getting the presets right here avoids ad-hoc magic numbers across the codebase.

The existing zenMotion in animationUtils.ts provides 5 spring tokens used by 90+ files. The new animations.ts adds duration/easing/stagger config that zenMotion does not cover, and aligns spring names to the epic specification.

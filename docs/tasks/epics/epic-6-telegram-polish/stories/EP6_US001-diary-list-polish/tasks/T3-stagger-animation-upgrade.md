# T3: Stagger Animation Upgrade + Reduced Motion

**Story:** [EP6_US001 — Diary List: Stagger & Skeleton](../story.md)
**Type:** Implementation
**Status:** Todo
**Priority:** P0
**Estimate:** 4h
**Parallel Group:** 2

---

## Goal

Upgrade the existing stagger animation in JournalEntryList.tsx to use centralized presets from animations.ts, cap stagger at 5 items for performance, and add full prefers-reduced-motion support so all diary list animations can be disabled.

## Acceptance Criteria

- [ ] Entry cards animate with translateY(20px to 0) + opacity(0 to 1) using spring physics from animations.ts — `verify: command (grep 'y: 20' src/features/journal/JournalEntryList.tsx)`
- [ ] Stagger delay is 40ms per card, capped at 5 items (items 6+ appear instantly with no delay) — `verify: command (grep 'maxItems\|Math.min' src/features/journal/JournalEntryList.tsx)`
- [ ] Spring preset imported from src/config/animations.ts (not hardcoded) — `verify: command (grep "from.*config/animations" src/features/journal/JournalEntryList.tsx)`
- [ ] useReducedMotion() from framer-motion controls all animations — `verify: command (grep 'useReducedMotion' src/features/journal/JournalEntryList.tsx)`
- [ ] When reduced motion enabled: no stagger, no spring, cards appear instantly — `verify: inspect (conditional variants when reducedMotion is true)`
- [ ] Total stagger completes within 400ms (5 x 40ms delay + ~200ms spring settle) — `verify: inspect (stagger config values: 5 x 40 = 200ms delay + spring settle)`
- [ ] 60 FPS maintained: only transform and opacity animated (no layout-triggering properties) — `verify: inspect (itemVariants only use y, opacity — no width/height/margin)`

## Technical Approach

### Implementation Plan

1. Import spring and stagger config from src/config/animations.ts
2. Import useReducedMotion from framer-motion
3. Update containerVariants:
   - Replace staggerChildren: 0.04 with staggerChildren: animations.stagger.perItem / 1000
   - Keep opacity container animation
4. Update itemVariants:
   - Change y: 12 to y: 20 per epic spec
   - Remove scale: 0.97 (not in spec, unnecessary GPU work)
   - Use spring preset from animations.ts instead of hardcoded values
5. Implement stagger cap at 5:
   - Use custom variants: pass custom={index} to motion.div
   - Function variant: show: (i) => ({ opacity: 1, y: 0, transition: { delay: Math.min(i, 4) * 0.04, ...spring } })
6. Add useReducedMotion() hook in JournalEntryList:
   - When true: skip animation, render with initial={false}
   - Pass animate={reducedMotion ? false : "show"} pattern
7. Verify GPU-only properties: confirm only transform (y) and opacity are animated

### Affected Components

- `src/features/journal/JournalEntryList.tsx` — update containerVariants, itemVariants, add useReducedMotion
- `src/config/animations.ts` — import only (no changes, created by T1)

### Related

- Depends on: T1 (Animation Config Foundation — provides spring/stagger presets)
- Blocks: nothing

## Context

Current stagger in JournalEntryList.tsx (lines 117-130):
- containerVariants: staggerChildren: 0.04 (40ms) — correct timing but no cap
- itemVariants: y: 12, scale: 0.97 — y should be 20 per epic, scale not needed
- Spring: stiffness: 300, damping: 25 — hardcoded, should use config

With 50+ diary entries, the current uncapped stagger means the last card waits 2+ seconds to appear. Capping at 5 ensures the visible viewport animates in ~400ms and remaining cards appear instantly.

The useReducedMotion hook from framer-motion reads prefers-reduced-motion media query. Already used in 7 other files in the project (App.tsx, DopamineSettings, RingDetailSheet, animationUtils.ts) — established pattern.

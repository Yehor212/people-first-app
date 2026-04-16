# T3: Hidden↔States Transitions + Reduced Motion + Perf

**Story:** [EP10_US004](../story.md) | **Type:** Implementation | **Status:** Todo | **Priority:** P1 | **Estimate:** 3h | **Parallel Group:** 2

## Goal
Implement hidden↔compact/expanded transitions, add reduced-motion fallback, and ensure 60fps performance.

## Acceptance Criteria
- [ ] Hidden→compact: 48px div slides in from start edge (200ms spring) — `verify: inspect (slide animation)`
- [ ] Compact/expanded→hidden: content fades + width collapses to 0 — `verify: inspect (exit animation)`
- [ ] `prefers-reduced-motion`: instant state change, zero animation — `verify: inspect (useReducedMotion conditional)`
- [ ] All animations GPU-only (transform + opacity, no width/height) — `verify: inspect (animated properties)`
- [ ] `will-change: transform, opacity` on animated elements — `verify: command (grep 'will-change' src/features/journal/JournalModule.tsx)`

### Affected Components
- `src/features/journal/JournalModule.tsx` — hidden state animations
- `src/features/journal/SidebarCompact.tsx` — entry/exit animations

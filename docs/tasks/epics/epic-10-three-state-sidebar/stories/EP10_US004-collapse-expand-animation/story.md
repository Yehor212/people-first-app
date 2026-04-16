# EP10_US004: Collapse/Expand Animation Choreography

**Epic:** [Epic 10: Three-State Sidebar](../../epic.md)
**Status:** To Review
**Priority:** P1
**Complexity:** High
**Created:** 2026-04-15

---

## Goal

Implement smooth, choreographed animations for sidebar state transitions (expanded↔compact↔hidden) so the UI feels polished and intentional, with staggered content fading and spring-based width transitions.

## Acceptance Criteria

### AC1: Expanded → Compact Animation (< 300ms)

- [ ] Calendar strip fades out with scale 0.95 (0-100ms, easeIn)
- [ ] Entry card text fades out (0-100ms, easeIn)
- [ ] Header text fades out, leaving icon visible (100-200ms)
- [ ] Panel width animates from expanded to 48px using spring physics
- [ ] Icon tooltips become active after animation completes

### AC2: Compact → Expanded Animation (< 350ms)

- [ ] Panel width animates from 48px to expanded using spring(300,25)
- [ ] Header text fades in with 8px slide from start edge (150-250ms)
- [ ] Entry card text fades in with 40ms stagger per card (200-300ms)
- [ ] Calendar strip fades in with scale 1.0 from 0.95 (250-350ms)

### AC3: Hidden ↔ Compact/Expanded

- [ ] Hidden → compact: 48px div slides in from start edge (200ms spring)
- [ ] Hidden → expanded: PanelLayout expand() triggers (existing behavior, now with spring)
- [ ] Compact/expanded → hidden: content fades + width collapses to 0

### AC4: Performance

- [ ] All animations at 60fps constant (GPU-only: transform + opacity)
- [ ] No layout reflow during transitions (use `will-change: transform, opacity`)
- [ ] Total animation duration < 350ms for any transition

### AC5: Reduced Motion

- [ ] When `prefers-reduced-motion` enabled: instant state change, zero animation
- [ ] All transitions skip to final state immediately
- [ ] No spring physics, no stagger, no fade

## Technical Notes

### Affected Components

- `src/features/journal/SidebarCompact.tsx` — AnimatePresence for enter/exit
- `src/features/journal/JournalModule.tsx` — AnimatePresence wrapping sidebar states
- `src/features/journal/JournalEntryList.tsx` — exit animation on content when collapsing
- `src/config/animations.ts` — use existing springPresets + stagger config

### Architecture

Use framer-motion `AnimatePresence` to orchestrate enter/exit of sidebar states. Each content element (calendar, cards, header) has its own `motion.div` with choreographed delays. Spring presets from `src/config/animations.ts`.

### Dependencies

- EP10_US001 (state transitions trigger animations)
- EP10_US002 + US003 (compact sidebar components to animate)
- `src/config/animations.ts` (spring presets from Epic 6 US001)

# EP12_US003: Orb & Ambient Particles Integration

**Epic:** [Epic 12: Living Empty State & Ambient Canvas](../../epic.md)
**Status:** Backlog
**Priority:** P1
**Complexity:** Medium
**Created:** 2026-04-15

---

## Goal

Integrate the ValenceOrb at 30% scale with a breathing animation and ambient particles into the empty state, creating a cinematic living canvas that transforms dead space into an atmospheric invitation to write.

## Acceptance Criteria

### AC1: ValenceOrb Integration

- [ ] ValenceOrb renders at 30% of normal scale, centered above the typewriter text
- [ ] Orb is in neutral/calm state (no mood data, breathing animation only)
- [ ] Breathing: gentle scale oscillation (0.97↔1.03) with 4-second cycle
- [ ] Orb uses existing shader pipeline (no new WebGL context)
- [ ] Orb unmounts cleanly when editor opens (AnimatePresence exit)

### AC2: Ambient Particles

- [ ] ParticleBackground renders behind orb and text
- [ ] Particle behavior adapts to time of day (from EP12_US001):
  - Morning: rising energy, warm-toned particles
  - Afternoon: steady floating, blue-toned
  - Evening: settling downward, amber-toned
  - Night: slow drifting, star-like white dots
- [ ] Particle count: 15-20 (performance-conscious, not dense)
- [ ] Particles avoid center area (don't overlap orb or text)

### AC3: Composition

- [ ] Layer order (back to front): TimeOfDayGradient → ParticleBackground → ValenceOrb → TypewriterText → CTAs
- [ ] All layers centered in available editor panel space
- [ ] Responsive: scales proportionally when sidebar state changes panel width

### AC4: Performance & Reduced Motion

- [ ] CPU idle < 5% when empty state visible (orb + particles combined)
- [ ] GPU memory: reuse existing shader, no additional GPU resources
- [ ] `prefers-reduced-motion`: static orb (no breathing), no particles, static gradient
- [ ] On low-end devices (< 4GB RAM or no WebGL): skip orb, reduce particles to 5

## Technical Notes

### Affected Components

- `src/features/journal/DiaryEmptyCanvas.tsx` — NEW: orchestrator component for all empty state layers
- `src/features/journal/JournalModule.tsx` — replace static empty state with `<DiaryEmptyCanvas />`

### Architecture

DiaryEmptyCanvas composes all layers. Uses `useReducedMotion()` from framer-motion for a11y. Device capability detection via `navigator.deviceMemory` and `WebGLRenderingContext` check.

### Dependencies

- EP12_US001 (TimeOfDayGradient provides background layer + time-of-day config for particles)
- EP12_US002 (TypewriterText rendered above orb)
- `ValenceOrb` component (existing)
- `ParticleBackground` component (existing)

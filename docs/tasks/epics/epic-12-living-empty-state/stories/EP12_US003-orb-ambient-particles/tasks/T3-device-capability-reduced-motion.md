# T3: Device Capability Detection + Reduced Motion

**Story:** [EP12_US003](../story.md) | **Type:** Implementation | **Status:** Todo | **Priority:** P1 | **Estimate:** 3h | **Parallel Group:** 2

## Goal
Add device capability detection to skip orb on weak devices, reduce particles, and implement full reduced-motion fallback.

## Acceptance Criteria
- [ ] `prefers-reduced-motion`: no orb, no particles, static gradient — `verify: inspect (useReducedMotion checks)`
- [ ] Low-end device (< 4GB RAM or no WebGL): skip orb, reduce particles to 5 — `verify: inspect (navigator.deviceMemory check)`
- [ ] CPU idle < 5% when empty state visible — `verify: inspect (efficient requestAnimationFrame usage)`
- [ ] GPU memory: reuses existing shader (no new WebGL context) — `verify: inspect (ValenceOrb props)`

### Affected Components
- `src/features/journal/DiaryEmptyCanvas.tsx` — capability detection

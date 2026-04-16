# T2: ValenceOrb at 30% + ParticleBackground Integration

**Story:** [EP12_US003](../story.md) | **Type:** Implementation | **Status:** Todo | **Priority:** P0 | **Estimate:** 4h | **Parallel Group:** 1

## Goal
Integrate the existing ValenceOrb at 30% scale with breathing animation and ParticleBackground with time-of-day particle behavior.

## Acceptance Criteria
- [ ] ValenceOrb renders at `scale={0.3}` centered above typewriter — `verify: inspect (scale prop)`
- [ ] Orb in neutral/calm state (breathing: scale 0.97↔1.03, 4s cycle) — `verify: inspect (breathing animation)`
- [ ] ParticleBackground with 15-20 particles — `verify: inspect (particle count)`
- [ ] Particles avoid center area (orb + text zone) — `verify: inspect (exclusion zone)`
- [ ] Orb unmounts on editor open (AnimatePresence exit) — `verify: inspect (AnimatePresence wrapping)`

### Affected Components
- `src/features/journal/DiaryEmptyCanvas.tsx` — add orb + particles

# T1: DiaryEmptyCanvas Orchestrator Component

**Story:** [EP12_US003](../story.md) | **Type:** Implementation | **Status:** Todo | **Priority:** P0 | **Estimate:** 3h | **Parallel Group:** 1

## Goal
Create the DiaryEmptyCanvas component that composes all empty state layers (gradient, particles, orb, typewriter, CTAs) and replaces the static empty state in JournalModule.

## Acceptance Criteria
- [ ] Component renders when `journal.view !== "editing"` and no active entry — `verify: inspect (render condition in JournalModule)`
- [ ] Layer order: TimeOfDayGradient → ParticleBackground → ValenceOrb → TypewriterText → CTAs — `verify: inspect (DOM order)`
- [ ] All layers centered in available panel space — `verify: inspect (flex items-center justify-center)`
- [ ] Replaces static PenLine + text empty state — `verify: command (grep -c 'DiaryEmptyCanvas' src/features/journal/JournalModule.tsx)`
- [ ] Responsive: adapts to panel width changes — `verify: inspect (relative sizing)`

### Affected Components
- `src/features/journal/DiaryEmptyCanvas.tsx` — NEW
- `src/features/journal/JournalModule.tsx` — replace static empty state

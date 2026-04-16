# T2: GratitudeBloom Petal Variety & Haptics

**Epic:** [Epic 6 — Telegram-Level Polish](../../../../epics/epic-6-telegram-polish/epic.md)
**User Story:** [EP6_US008 Ritual Widget Enhancement](../story.md)
**Related:** T1 (BurnThought haptics, same ritual domain)
**Parallel Group:** 1

---

## Context

### Current State

- GratitudeBloom widget exists with bloom animation.
- Petal shapes may be uniform (single SVG path repeated).
- No haptic feedback on bloom completion.
- No color-coding by gratitude category.

### Desired State

- 5 distinct petal SVG shapes for visual variety.
- Petals color-coded by gratitude category using theme tokens.
- Haptic fires on bloom completion (success pattern).
- Haptics respect Dopamine settings.

### Inherited Assumptions

- **A1 (UX):** 5 petal shapes provide enough visual variety without overwhelming the animation.

---

## Implementation Plan

### Phase 1: Petal Shape Variety

- [ ] Create 5 distinct SVG petal path definitions (varied shapes: round, pointed, curved, wide, narrow)
- [ ] Randomly assign petal shapes during bloom animation
- [ ] Store shapes as constants (reusable SVG path data)

### Phase 2: Category Color Coding

- [ ] Map gratitude categories to theme color tokens (e.g., health→green, relationships→pink, work→blue)
- [ ] Apply category color to petal fill using theme-aware CSS variables
- [ ] Ensure colors work in both light and dark mode

### Phase 3: Bloom Haptic

- [ ] Fire `hapticSuccess()` when bloom animation completes
- [ ] Ensure single pulse only (no haptic during petal animation, only at completion)
- [ ] Gate via Dopamine settings (shouldTriggerHaptics)

---

## Technical Approach

### Recommended Solution

**Library:** SVG paths + Framer Motion for animation + existing haptics.ts

### Key APIs

- SVG `<path d="...">` — 5 petal shape definitions
- Theme tokens — category-to-color mapping via CSS variables
- `hapticSuccess()` — bloom completion haptic

### Implementation Pattern

```pseudocode
PETAL_SHAPES = [roundPath, pointedPath, curvedPath, widePath, narrowPath]
CATEGORY_COLORS = { health: "var(--bloom-health)", relationships: "var(--bloom-love)", ... }

FOR each petal in bloom:
  shape = PETAL_SHAPES[random or index % 5]
  color = CATEGORY_COLORS[petal.category]
  render <path d={shape} fill={color} />

ON bloom complete:
  hapticSuccess()
```

### Why This Approach

- SVG paths are resolution-independent and GPU-composited
- Theme tokens ensure dark/light mode compatibility

### Patterns Used

- SVG path variety (visual richness without complexity)
- Theme token color mapping (project convention)
- Haptic at completion (matches BurnThought pattern from T1)

---

## Acceptance Criteria

- [ ] **Given** GratitudeBloom plays, **When** petals appear, **Then** 5 distinct petal shapes are visible (not all identical).
- [ ] **Given** gratitude entries have categories, **When** bloom renders, **Then** petals are color-coded by category using theme tokens.
- [ ] **Given** bloom animation completes, **When** all petals have appeared, **Then** a success haptic fires once.
- [ ] **Given** haptics are disabled in Dopamine Settings, **Then** bloom plays normally without haptic.

---

## Affected Components

### Implementation

- `src/features/journal/GratitudeBloomWidget.tsx` (or equivalent) — add petal shapes, category colors, haptic
- CSS/Tailwind: add bloom color token variables if not existing

---

## Existing Code Impact

### Tests to Update

- None expected

---

## Definition of Done

- [ ] All acceptance criteria met
- [ ] 5 distinct SVG petal shapes defined
- [ ] All petal colors via theme tokens (zero hardcoded)
- [ ] NO new tests created

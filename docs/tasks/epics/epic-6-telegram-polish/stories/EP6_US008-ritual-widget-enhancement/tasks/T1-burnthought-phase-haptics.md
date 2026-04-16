# T1: BurnThought Phase Haptics

**Epic:** [Epic 6 — Telegram-Level Polish](../../../../epics/epic-6-telegram-polish/epic.md)
**User Story:** [EP6_US008 Ritual Widget Enhancement](../story.md)
**Related:** T2 (GratitudeBloom, same ritual domain)
**Parallel Group:** 1

---

## Context

### Current State

- `BurnThoughtWidget.tsx` implements the full BurnThought ritual with 3 phases: write → burn → release.
- Phase transitions exist with visual animations (fire particles, ember effects).
- No haptic feedback on phase transitions currently.
- `haptics.ts` has `hapticMedium()`, `hapticSuccess()`, and Dopamine settings integration.

### Desired State

- Medium haptic fires on burn start (entering burn phase).
- Success haptic fires on release complete (ritual finished).
- Haptics respect Dopamine settings (disabled when user toggles off).

### Inherited Assumptions

- **A1 (ARCHITECTURE):** `haptics.ts` semantic aliases (`hapticMedium`, `hapticSuccess`) are the standard API for all haptic feedback.

---

## Implementation Plan

### Phase 1: Identify Phase Transition Points

- [ ] Locate the state machine / phase transition logic in `BurnThoughtWidget.tsx`
- [ ] Identify exact callback/effect where burn phase starts and release phase completes

### Phase 2: Add Haptic Calls

- [ ] At burn phase start: call `hapticMedium()` (or semantic alias if exists, e.g., `hapticBurn`)
- [ ] At release complete: call `hapticSuccess()` (existing semantic alias `journalSaved` may fit)
- [ ] Wrap in try/catch (existing pattern in haptics.ts handles platform fallback)

### Phase 3: Dopamine Settings Gate

- [ ] Verify haptic calls respect `shouldTriggerHaptics()` from Dopamine settings
- [ ] If `haptics.ts` functions already check this internally, no additional gating needed
- [ ] Test: disable haptics in settings → verify no haptic fires during ritual

---

## Technical Approach

### Recommended Solution

**Library:** Capacitor Haptics (via existing `haptics.ts` wrapper)
**Existing:** `src/lib/haptics.ts` with 9 functions + semantic aliases

### Key APIs

- `hapticMedium()` — medium impact for significant action (burn start)
- `hapticSuccess()` — success notification (release complete)
- Both already wrapped in try/catch with platform detection

### Implementation Pattern

```pseudocode
ON phase change to "burn":
  hapticMedium()  // single pulse, medium impact

ON phase change to "released" / ritual complete:
  hapticSuccess()  // success notification pattern
```

### Why This Approach

- Reuses existing haptic infrastructure (zero new code in haptics.ts)
- Semantic haptic types match the ritual phases (medium = significant action, success = completion)

### Patterns Used

- Semantic haptic aliases (project convention from haptics.ts)
- Dopamine settings gating (existing pattern across 15+ components)

---

## Acceptance Criteria

- [ ] **Given** I use BurnThought, **When** the burn phase starts, **Then** a medium haptic fires once.
- [ ] **Given** I complete the release phase, **When** the ritual finishes, **Then** a success haptic fires once.
- [ ] **Given** haptics are disabled in Dopamine Settings, **Then** no haptics fire during any ritual phase.
- [ ] **Given** I'm on a platform without haptic support (desktop), **Then** no errors thrown, ritual works normally.

---

## Affected Components

### Implementation

- `src/features/journal/BurnThoughtWidget.tsx` — add haptic calls at phase transitions
- `src/lib/haptics.ts` — reuse existing functions (no changes needed)

---

## Existing Code Impact

### Tests to Update

- None expected (adding haptic calls to existing transitions)

---

## Definition of Done

- [ ] All acceptance criteria met
- [ ] Maximum 1 haptic per phase transition (no double-fires)
- [ ] NO new tests created

# T2: FAB Scale Transition

**Epic:** [Epic 6 — Telegram-Level Polish](../../../../epics/epic-6-telegram-polish/epic.md)
**User Story:** [EP6_US009 Page Transitions](../story.md)
**Related:** T1 (shared element), T3 (crossfade)
**Parallel Group:** 1

---

## Context

### Current State

- FAB (Floating Action Button) for creating new entries exists in the diary view.
- Tapping FAB opens the editor with instant swap (no transition).
- No origin-point animation from the FAB position.

### Desired State

- Editor scales from the FAB position (bottom-right origin) with spring physics.
- Spring config: stiffness 300, damping 25 (Conversational preset from RSH-001).
- Smooth transition from small FAB to full-screen editor.

### Inherited Assumptions

- **A1 (UX):** Scale-from-origin transitions create a clear spatial connection between trigger and destination.

---

## Implementation Plan

### Phase 1: Capture FAB Position

- [ ] Add ref to FAB button to capture its `getBoundingClientRect()`
- [ ] Pass FAB coordinates to editor as initial transform origin

### Phase 2: Scale Animation

- [ ] Editor enters with: `initial={{ scale: 0, opacity: 0, transformOrigin: "bottom right" }}`
- [ ] `animate={{ scale: 1, opacity: 1 }}` with spring stiffness 300, damping 25
- [ ] Exit reversal: `exit={{ scale: 0, opacity: 0 }}` back toward FAB origin

### Phase 3: Integration

- [ ] Wrap editor in `AnimatePresence` in `JournalModule.tsx`
- [ ] Gate via `shouldAnimate()` — instant open when disabled
- [ ] Coordinate with T1: if entering via card tap, use layoutId; if via FAB, use scale

---

## Technical Approach

### Recommended Solution

**Library:** Framer Motion v11 (motion.div + AnimatePresence)

### Key APIs

- `transformOrigin` — "bottom right" or computed from FAB position
- Spring: `{ type: "spring", stiffness: 300, damping: 25 }`
- `AnimatePresence` — mount/unmount animation

### Implementation Pattern

```pseudocode
// Determine entry mode
IF entryMode === "fab":
  <AnimatePresence>
    <motion.div
      initial={{ scale: 0, opacity: 0, transformOrigin: "bottom right" }}
      animate={{ scale: 1, opacity: 1 }}
      exit={{ scale: 0, opacity: 0 }}
      transition={{ type: "spring", stiffness: 300, damping: 25 }}>
      <JournalEntryEditor />
    </motion.div>
  </AnimatePresence>
```

### Why This Approach

- Scale-from-origin is a standard native app pattern (Material Design, iOS)
- Spring physics match Telegram Conversational preset

### Patterns Used

- Origin-point transition (Material Design expanding FAB pattern)
- AnimatePresence mount/unmount (established in 10+ components)

---

## Acceptance Criteria

- [ ] **Given** I tap the FAB, **When** the editor opens, **Then** it scales up from the FAB position with spring animation.
- [ ] **Given** I close the editor (opened via FAB), **When** exiting, **Then** editor scales back down toward FAB position.
- [ ] **Given** `shouldAnimate()` returns false, **Then** editor opens instantly without scale transition.
- [ ] **Given** FAB is at different positions (mobile vs desktop), **Then** transform origin adapts correctly.

---

## Affected Components

### Implementation

- `src/features/journal/JournalModule.tsx` — add AnimatePresence + scale animation for FAB→editor transition
- `src/features/journal/JournalEntryEditor.tsx` — accept entry mode prop (fab vs card)

---

## Existing Code Impact

### Tests to Update

- None expected

---

## Definition of Done

- [ ] All acceptance criteria met
- [ ] Scale transition is smooth at 60 FPS
- [ ] Correctly distinguishes FAB entry vs card entry (T1)
- [ ] NO new tests created

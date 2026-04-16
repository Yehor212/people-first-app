# T3: Sub-Section Crossfade & View Transitions API

**Epic:** [Epic 6 — Telegram-Level Polish](../../../../epics/epic-6-telegram-polish/epic.md)
**User Story:** [EP6_US009 Page Transitions](../story.md)
**Related:** T1 (shared element), T2 (FAB scale)
**Parallel Group:** 2

---

## Context

### Current State

- Diary sub-sections (list/calendar/stats) switch instantly with no transition.
- `JournalModule.tsx` orchestrates sub-tab switching.
- View Transitions API not used anywhere in codebase.
- `AnimatePresence` used in 10+ components (proven pattern for crossfade).

### Desired State

- Sub-section switching uses 200ms crossfade transition via `AnimatePresence`.
- Progressive enhancement: use View Transitions API where supported (Chrome 111+, ~92% global).
- Fallback to Framer Motion `AnimatePresence` when VT API unavailable.

### Inherited Assumptions

- **A1 (FEASIBILITY):** View Transitions API is progressive enhancement — Framer Motion fallback ensures universal support.

---

## Implementation Plan

### Phase 1: AnimatePresence Crossfade (Baseline)

- [ ] Wrap active sub-tab content in `AnimatePresence mode="wait"` in `JournalModule.tsx`
- [ ] `initial={{ opacity: 0 }}`, `animate={{ opacity: 1 }}`, `exit={{ opacity: 0 }}`, `transition={{ duration: 0.2 }}`
- [ ] Use active tab as `key` to trigger AnimatePresence swap

### Phase 2: View Transitions API (Progressive Enhancement)

- [ ] Feature-detect: `if ("startViewTransition" in document)`
- [ ] Wrap tab state update in `document.startViewTransition(() => { setActiveTab(newTab) })`
- [ ] Add CSS `::view-transition-old(root)` and `::view-transition-new(root)` styles for crossfade
- [ ] When VT API is used, skip AnimatePresence (avoid double animation)

### Phase 3: Animation Gating

- [ ] Gate all transitions via `shouldAnimate()` — instant swap when disabled
- [ ] `prefers-reduced-motion`: no crossfade, instant content swap
- [ ] Ensure VT API also respects reduced motion (browser handles this natively)

---

## Technical Approach

### Recommended Solution

**Library:** View Transitions API (progressive) + Framer Motion v11 (fallback)

### Key APIs

- `document.startViewTransition(callback)` — native browser transition
- CSS `::view-transition-old(root)`, `::view-transition-new(root)` — transition styling
- `AnimatePresence mode="wait"` — Framer Motion fallback crossfade

### Implementation Pattern

```pseudocode
switchTab(newTab):
  IF shouldAnimate() AND "startViewTransition" in document:
    document.startViewTransition(() => setActiveTab(newTab))
  ELSE IF shouldAnimate():
    setActiveTab(newTab)  // AnimatePresence handles crossfade via key change
  ELSE:
    setActiveTab(newTab)  // instant swap

// In JSX:
<AnimatePresence mode="wait">
  <motion.div key={activeTab}
    initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
    transition={{ duration: 0.2 }}>
    {renderActiveTab()}
  </motion.div>
</AnimatePresence>
```

### Why This Approach

- View Transitions API provides native-quality transitions with minimal JS
- Framer Motion fallback ensures ~100% browser support
- Progressive enhancement is the recommended pattern (RSH-001 section 9)

### Known Limitations

- View Transitions API is document-level (whole page transition); for scoped transitions, Framer Motion is more precise
- VT API and AnimatePresence must not run simultaneously on same content

### Patterns Used

- Progressive enhancement (native API with JS fallback)
- AnimatePresence crossfade (established codebase pattern)

---

## Acceptance Criteria

- [ ] **Given** I switch between list/calendar/stats, **When** the view transitions, **Then** a 200ms crossfade plays.
- [ ] **Given** the browser supports View Transitions API, **When** I switch tabs, **Then** the native VT API handles the transition.
- [ ] **Given** the browser doesn't support VT API, **When** I switch tabs, **Then** Framer Motion `AnimatePresence` crossfade plays as fallback.
- [ ] **Given** `shouldAnimate()` returns false, **Then** instant tab swap with no transition.

---

## Affected Components

### Implementation

- `src/features/journal/JournalModule.tsx` — add AnimatePresence wrapper + VT API integration for sub-tab switching
- CSS: add `::view-transition-*` styles (global stylesheet or module CSS)

---

## Existing Code Impact

### Refactoring Required

- `JournalModule.tsx` — wrap sub-tab content rendering in AnimatePresence

### Tests to Update

- None expected (visual transition only)

---

## Definition of Done

- [ ] All acceptance criteria met
- [ ] VT API used when available, FM fallback otherwise
- [ ] No double-animation (VT + FM simultaneously)
- [ ] 60 FPS during crossfade
- [ ] NO new tests created

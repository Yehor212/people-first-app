# T2: useTypingDynamics Hook — Keystroke Analysis Engine

**Epic:** [Epic 8: Emotional Canvas](../../../../epic.md)
**User Story:** [EP8_US002: Typing Dynamics Mirror](../story.md)
**Related:** —
**Parallel Group:** 1
**Status:** Done

---

## Context

### Current State
- No keystroke analysis exists in the codebase (grep confirmed 0 matches for useTyping/typing dynamics)
- `DiaryCanvas.tsx` has basic keystroke references but no WPM/rhythm/backspace analysis
- US003 (Emotional Weather System) will later consume this hook for typing velocity input

### Desired State
- A reusable `useTypingDynamics` hook at `src/hooks/useTypingDynamics.ts`
- Analyzes keystroke patterns in a 30-second rolling window
- Exposes: WPM, rhythm regularity (0-1), backspace rate (0-1), pause state, isTyping boolean
- Clean API consumable by both TypingDynamicsMirror (T3) and future US003

### Inherited Assumptions
- **A1 (FEASIBILITY):** Passive keystroke listeners do not interfere with editor input handling
- **A2 (DEPENDENCY):** Mobile keyboards report sufficient keystroke timing for meaningful analysis

---

## Implementation Plan

### Phase 1: Core Data Model
- [ ] Define `TypingDynamics` interface: `{ wpm: number, rhythmRegularity: number, backspaceRate: number, isPaused: boolean, isTyping: boolean }`
- [ ] Define `KeystrokeEvent` internal type: `{ timestamp: number, isBackspace: boolean }`
- [ ] Implement 30-second rolling window buffer (circular array, ~900 events max at fast typing)

### Phase 2: Keystroke Analysis
- [ ] WPM calculation: count word-boundary keystrokes in rolling window, normalize to per-minute
- [ ] Rhythm regularity: standard deviation of inter-keystroke intervals, normalize to 0-1 (0=erratic, 1=steady)
- [ ] Backspace rate: `backspaceCount / totalKeystrokes` in rolling window, clamped 0-1
- [ ] Pause detection: no keystroke for >3 seconds → `isPaused: true`
- [ ] isTyping: true when keystrokes received within last 5 seconds

### Phase 3: React Integration
- [ ] Hook accepts `ref` to editor element (or document-level passive listener)
- [ ] Use `useRef` for mutable buffer (no re-renders on each keystroke)
- [ ] Throttled state update at 30 FPS (~33ms) via `requestAnimationFrame`
- [ ] Cleanup: remove listeners on unmount via useEffect return

---

## Technical Approach

### Recommended Solution
**Library/Framework:** React 18 hooks + vanilla DOM events (no external deps)
**Documentation:** MDN KeyboardEvent, React useRef/useEffect

### Key APIs
- `element.addEventListener('keydown', handler, { passive: true })` — non-blocking keystroke capture
- `requestAnimationFrame` — throttled 30 FPS state emission
- `useRef<KeystrokeEvent[]>` — mutable circular buffer

### Implementation Pattern
```pseudocode
useTypingDynamics(editorRef):
  buffer = useRef(CircularArray(capacity=900))
  dynamics = useRef(defaultDynamics)
  
  onKeyDown(e):
    buffer.push({ timestamp: now, isBackspace: e.key === 'Backspace' })
    evictOlderThan(30_seconds)
  
  animationLoop():
    dynamics.current = computeMetrics(buffer.current)
    requestAnimationFrame(animationLoop)
  
  useEffect → attach passive listener, start loop, cleanup both
  return dynamics (stable ref, consumers read .current)
```

### Why This Approach
- Passive listeners guarantee zero interference with editor input
- Circular buffer avoids memory growth; 900 events = ~3KB max
- useRef avoids re-render storms (30 FPS updates stay off React render cycle)

### Patterns Used
- Ref pattern for stable listeners (per `useAuthSession` reference in hooks-patterns rule)
- Circular buffer for bounded memory
- requestAnimationFrame for frame-synced updates

### Known Limitations
- Mobile virtual keyboards may have less precise timing than physical keyboards
- Some IME (Japanese, Chinese) may batch keystrokes differently — rhythm detection may be less accurate
- 30-second window means first 30 seconds show ramp-up behavior (not a bug, by design)

### Error Handling Strategy

**Expected errors (this task):**
| Error Type | When Occurs | Handling |
|------------|-------------|----------|
| Missing editorRef | Editor not mounted yet | Return default (idle) dynamics, no crash |
| Rapid unmount | Navigation away | Cleanup via useEffect return, cancel rAF |

### Alternatives Considered
- **InputEvent API:** Rejected — doesn't capture backspace key reliably across browsers
- **Global document listener:** Rejected — would capture keystrokes outside editor context

---

## Acceptance Criteria

- [ ] **Given** a user types at >60 WPM **When** useTypingDynamics is active **Then** `wpm` reports >60 and updates at 30 FPS `verify: test (useTypingDynamics.test.ts — simulate rapid keystrokes, assert wpm > 60)`
- [ ] **Given** a user types with steady rhythm **When** inter-keystroke intervals are regular **Then** `rhythmRegularity` is >0.7 `verify: test (useTypingDynamics.test.ts — simulate even intervals, assert rhythmRegularity > 0.7)`
- [ ] **Given** a user presses backspace for >20% of keystrokes **When** in rolling window **Then** `backspaceRate` is >0.2 `verify: test (useTypingDynamics.test.ts — simulate backspace ratio, assert backspaceRate > 0.2)`
- [ ] **Given** a user stops typing for >3 seconds **When** no keystrokes received **Then** `isPaused` is true and `isTyping` becomes false after 5s `verify: test (useTypingDynamics.test.ts — simulate pause, assert isPaused + isTyping flags)`
- [ ] **Given** the hook is unmounted **When** component navigates away **Then** all listeners and rAF are cleaned up (no memory leaks) `verify: test (useTypingDynamics.test.ts — mount/unmount, verify no dangling listeners)`

---

## Affected Components

### Implementation
- `src/hooks/useTypingDynamics.ts` — NEW: keystroke analysis hook
- Side-effects: passive DOM event listeners on editor element
- Side-effect depth: 1 (flat)

### Documentation (REQUIRED in this task)
- Inline JSDoc on exported `TypingDynamics` interface and `useTypingDynamics` hook

---

## Existing Code Impact

### Refactoring Required
- None (new file, no existing code changes)

### Tests to Update
- None (new hook, no existing tests affected)

---

## Definition of Done

- [ ] All acceptance criteria met
- [ ] `useTypingDynamics` hook created at `src/hooks/useTypingDynamics.ts`
- [ ] `TypingDynamics` interface exported for consumer use
- [ ] Passive listeners verified (no editor input interference)
- [ ] Cleanup on unmount verified (no memory leaks)
- [ ] NO new tests created (tests planned separately)
- [ ] Code reviewed

---

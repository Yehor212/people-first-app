# T4: Editor Integration & Accessibility

**Epic:** [Epic 8: Emotional Canvas](../../../../epic.md)
**User Story:** [EP8_US002: Typing Dynamics Mirror](../story.md)
**Related:** T2 (useTypingDynamics), T3 (TypingDynamicsMirror)
**Parallel Group:** 3

---

## Context

### Current State
- `JournalEntryEditor.tsx` (`src/features/journal/JournalEntryEditor.tsx`) is the diary editor — currently has no typing energy visualization
- T2 provides the `useTypingDynamics` hook, T3 provides the `TypingDynamicsMirror` component
- `prefers-reduced-motion` is used in 51 files — well-established pattern in codebase

### Desired State
- Mini-orb placed in the bottom-right corner of JournalEntryEditor
- Fade-in on first keystroke, fade-out after 5s of inactivity
- `prefers-reduced-motion` reduces orb to static colored dot
- `aria-hidden="true"` marks orb as decorative
- Android back handler compatibility (orb is non-interactive, no handler needed)

### Inherited Assumptions
- **A1 (FEASIBILITY):** JournalEntryEditor layout can accommodate a 24px absolute-positioned element without disrupting text flow

---

## Implementation Plan

### Phase 1: Hook Integration
- [ ] Import `useTypingDynamics` in JournalEntryEditor
- [ ] Pass editor element ref to the hook
- [ ] Consume `TypingDynamics` data (wpm, rhythmRegularity, backspaceRate, isPaused, isTyping)

### Phase 2: Component Placement
- [ ] Import `TypingDynamicsMirror` component
- [ ] Position absolute bottom-right of editor container (8px margin)
- [ ] Z-index: z-40 (above text, below nav z-50, below modals z-60)
- [ ] Verify orb does not overlap text content or editor controls (toolbar, save indicator)
- [ ] Check if JournalEntryEditor uses PullToRefresh/transform ancestor — if yes, use `createPortal`

### Phase 3: Fade Logic & Accessibility
- [ ] Fade-in: `opacity 0→1` over 0.3s ease-out on `isTyping` transition to true
- [ ] Fade-out: `opacity 1→0` over 0.5s ease-out when `isTyping` is false for 5s
- [ ] Use CSS transition for opacity (not JS animation — lighter on main thread)
- [ ] Add `aria-hidden="true"` to orb wrapper
- [ ] Implement `prefers-reduced-motion` check:
  - If reduced motion: render static colored dot (24px div with theme background color, no animation)
  - Use existing `prefers-reduced-motion` pattern from codebase (check `src/index.css` or `animationUtils.ts`)
- [ ] Touch target: orb is non-interactive, no click handler, `pointer-events: none`

---

## Technical Approach

### Recommended Solution
**Library/Framework:** React 18, Tailwind CSS, existing animation patterns
**Documentation:** MDN `prefers-reduced-motion`, project `animationUtils.ts`

### Key APIs
- `useTypingDynamics(editorRef)` — from T2
- `<TypingDynamicsMirror dynamics={...} />` — from T3
- `window.matchMedia('(prefers-reduced-motion: reduce)')` — or existing hook if available
- CSS: `transition: opacity 0.3s ease-out` / `transition: opacity 0.5s ease-out`

### Implementation Pattern
```pseudocode
JournalEntryEditor:
  editorRef = useRef()
  dynamics = useTypingDynamics(editorRef)
  reducedMotion = useMediaQuery('(prefers-reduced-motion: reduce)')
  visible = dynamics.isTyping || fadeOutTimer < 5s
  
  return (
    <div className="relative">
      {/* existing editor content */}
      <div
        className="absolute bottom-2 right-2 z-40 pointer-events-none transition-opacity"
        style={{ opacity: visible ? 1 : 0 }}
        aria-hidden="true"
      >
        {reducedMotion
          ? <StaticDot color={themeOrbColor} />
          : <TypingDynamicsMirror dynamics={dynamics} />}
      </div>
    </div>
  )
```

### Why This Approach
- CSS transitions for opacity are GPU-accelerated and main-thread-free
- `pointer-events: none` ensures orb never intercepts editor interactions
- `aria-hidden` correctly marks decorative element for screen readers

### Patterns Used
- Reduced motion pattern (51 existing usages in codebase)
- Portal pattern (if transform ancestor detected)
- Theme token consumption for static dot color

### Known Limitations
- If editor layout changes significantly, absolute positioning may need adjustment
- PullToRefresh transform ancestor could break fixed/absolute positioning — portal mitigates this

### Error Handling Strategy

**Expected errors (this task):**
| Error Type | When Occurs | Handling |
|------------|-------------|----------|
| Editor ref null | Editor not yet mounted | Don't render orb until ref available |
| Dynamics undefined | Hook initialization | Use default (idle) dynamics, orb stays hidden |

### Alternatives Considered
- **Fixed position instead of absolute:** Rejected — would position relative to viewport, not editor
- **JS-driven opacity animation:** Rejected — CSS transitions are more performant for simple opacity

---

## Acceptance Criteria

- [ ] **Given** a user starts typing in the diary editor **When** first keystroke occurs **Then** mini-orb fades in (0→1 opacity over 0.3s) in bottom-right corner `verify: command (Playwright: type in editor, screenshot at 0.5s, verify orb visible at bottom-right)`
- [ ] **Given** a user stops typing **When** 5 seconds pass with no keystrokes **Then** mini-orb fades out (1→0 opacity over 0.5s) `verify: command (Playwright: type, wait 6s, screenshot, verify orb not visible)`
- [ ] **Given** the mini-orb is visible **When** inspecting DOM **Then** it has `aria-hidden="true"` and `pointer-events: none` `verify: command (Playwright: evaluate document.querySelector('[aria-hidden="true"]') on orb element)`
- [ ] **Given** `prefers-reduced-motion: reduce` is enabled **When** user types **Then** a static colored dot appears instead of animated orb `verify: command (Playwright: emulateMedia reducedMotion, type, screenshot, verify static dot)`
- [ ] **Given** the mini-orb is placed in the editor **When** user types normally **Then** orb does not overlap text or editor controls `verify: inspect (visual check — orb in corner, no text/control overlap)`

---

## Affected Components

### Implementation
- `src/features/journal/JournalEntryEditor.tsx` — MODIFIED: add mini-orb placement, useTypingDynamics integration
- Side-effects: none (orb is purely visual, non-interactive)
- Side-effect depth: 0

### Documentation (REQUIRED in this task)
- Inline comments on fade logic and reduced-motion branch

---

## Existing Code Impact

### Refactoring Required
- `JournalEntryEditor.tsx` — Add relative positioning wrapper if not already present, add orb element

### Tests to Update
- Existing JournalEntryEditor tests may need mock for useTypingDynamics if they render the full component

---

## Definition of Done

- [ ] All acceptance criteria met
- [ ] Mini-orb renders in bottom-right corner of JournalEntryEditor
- [ ] Fade-in/out works with correct timing (0.3s in, 0.5s out after 5s idle)
- [ ] `aria-hidden="true"` and `pointer-events: none` applied
- [ ] `prefers-reduced-motion` renders static dot (verified)
- [ ] No text/control overlap (verified on mobile + desktop widths)
- [ ] Theme tokens used for all colors
- [ ] NO new tests created (tests planned separately)
- [ ] Code reviewed

---

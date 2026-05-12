# T1: Design Definition — Typing Dynamics Mini-Orb

**Epic:** [Epic 8: Emotional Canvas](../../../../epic.md)
**User Story:** [EP8_US002: Typing Dynamics Mirror](../story.md)
**Status:** Done
**Related:** —
**Parallel Group:** 1

---

## Context

### Current State
- The diary editor (`JournalEntryEditor.tsx`) has no visual feedback reflecting the user's typing energy
- ValenceOrb exists at full size in StateOfMind but has never been adapted to a 24px micro format
- No design specification exists for how a mini-orb should behave in the editor corner

### Desired State
- A complete design definition for the 24px mini-orb: visual thesis, content plan, interaction plan
- Clear specification of how brightness, shape smoothness, spikiness, and breathing map to typing metrics
- Design constraints documented to guide T3 (component implementation)

### Inherited Assumptions
- **A1 (FEASIBILITY):** ValenceOrb's superformula SDF can render meaningfully at 24px with simplified shader (no caustics)

---

## Implementation Plan

### Phase 1: Visual Thesis

**Visual thesis:** *A tiny luminous glass seed that pulses with the writer's creative rhythm — warm, translucent, alive.*

**4 visual dimensions:**

| Typing Metric | Visual Property | Range | Mapping |
|---------------|----------------|-------|---------|
| **WPM** (words per minute) | Brightness / luminance | 0.3 (idle) → 1.0 (60+ WPM) | Linear clamp: `brightness = clamp(wpm / 60, 0.3, 1.0)`. Below 10 WPM = dim ember; 30+ WPM = warm glow; 60+ WPM = full radiance. |
| **Rhythm regularity** | Shape smoothness (n1 param) | n1: 1.4 (erratic) → 2.5 (steady) | Coefficient of variation of inter-keystroke intervals over trailing 10-key window. CV < 0.2 = smooth circle; CV > 0.6 = angular facets. |
| **Backspace ratio** | Pressure intensity (canonical valence input) | calm -> low-valence pressure lens | `backspaceRatio = backspaces / totalKeys` over trailing 20-key window. Ratio > 0.3 lowers the canonical valence fed into `MiniValenceOrb`; ratio < 0.05 keeps the orb near neutral. Do not drive `m` directly; `ValenceOrb` owns the canonical `m=3` low-valence lens family. |
| **Pause duration** | Breathing rate | 2s period (active) → 6s period (paused) | Time since last keystroke. 0-1s = fast breath (2s cycle); 3s+ pause = slow contemplative breath (6s cycle); 5s+ = fade-out begins. |

**Color strategy:** Inherit from current theme's orb palette via `ValenceOrb`/`MiniValenceOrb`. The mini-orb uses the same canonical HSL and shape pipeline as the full-size orb. No separate color, SVG, or shader mapping for typing metrics; typing pressure only adjusts the valence sent into `MiniValenceOrb`. This keeps every mini-orb visually identical to the canonical full-size orb.

**Simplification for 24px:** At 24px, the superformula SDF remains legible but the following effects from the full orb are removed:
- No caustics (invisible at this scale)
- No volumetric light rays / god rays
- No particle system (22 particles would be sub-pixel)
- No concentric rings (outer rings would extend beyond 24px bounds)
- No iridescence layer (thin-film effect imperceptible)
- No hope sparkle (single pixel, invisible)
- Retain: glass transparency, Fresnel rim, single GGX specular highlight, breathing scale, superformula shape

### Phase 2: Content Plan

**Placement:** Bottom-right corner of the diary editor (`JournalEntryEditor.tsx`), positioned with `absolute bottom-2 right-2` (8px margin from edges). Floats over text content without obscuring the writing area — the 24px footprint occupies roughly 1 line height in the corner.

**Size:** 24px CSS diameter. Canvas renders at `24 * dpr` physical pixels (max dpr 2.0 = 48x48 physical pixels). No label, no tooltip — purely ambient decoration. `aria-hidden="true"` since it conveys no semantic information.

**Z-index:** `z-40` — above text content and scroll area, below navigation (z-50) and modals (z-[60]+). This prevents the orb from interfering with any overlay UI.

**Responsive behavior:**
- Mobile (< 768px): 24px, bottom-right, 8px margin
- Tablet/Desktop (>= 768px): 24px, bottom-right, 8px margin (identical — the editor area is larger so the orb feels even more subtle)
- No size scaling by viewport — 24px is the fixed specification

**Safe area:** On iOS, the editor already respects `env(safe-area-inset-bottom)` via its container. The mini-orb sits inside the editor bounds, so no additional safe-area handling is needed.

### Phase 3: Interaction Plan

**Fade-in:** `opacity 0 → 1` over `0.3s ease-out`, triggered on the first keystroke in the editor session. The orb does not render in DOM until the user begins typing (conditional mount). This prevents visual clutter on an empty/read-only editor.

**Fade-out:** `opacity 1 → 0` over `0.5s ease-out`, triggered after `5s` of no typing activity. After fade-out completes, the component unmounts to free GPU/canvas resources. Re-typing triggers a fresh fade-in.

**State transitions:** All metric-to-visual mappings (brightness, smoothness, spikiness, breathing rate) interpolate over `0.5s` using exponential ease (same `lerpRate` pattern as ValenceOrb: `1 - Math.pow(1 - 0.06, dt * 30)`). This prevents jarring visual jumps when the user's typing cadence changes.

**Reduced-motion fallback:** When `prefers-reduced-motion: reduce` is active:
- No breathing animation, no shape morphing, no fade transitions
- Render as a static 24px circle (`border-radius: 50%`) with CSS `background: radial-gradient(...)` using `hsl(var(--primary) / 0.4)` — no canvas/WebGL overhead
- Brightness still reflects WPM (mapped to opacity: 0.3–0.8) so the orb remains a subtle typing indicator
- Appear/disappear uses `display` toggle (no opacity transition)

**Touch interaction:** None. The mini-orb is non-interactive (`pointer-events: none`). Unlike the full ValenceOrb which responds to touch with ripple + haptics, the 24px mini-orb is purely ambient. Tapping in the corner should focus the text editor, not the orb.

**Performance budget:** Single canvas (24x24 CSS / 48x48 physical), simplified shader with no particles/rings/rays. Target: < 0.3ms per frame. Falls back to CSS radial gradient (no canvas) if WebGL unavailable — at 24px the visual difference is negligible.

---

## Technical Approach

### Recommended Solution
**Library/Framework:** React 18 + GLSL (existing orbShader pipeline)
**Documentation:** Existing `docs/orb-design-philosophy.md`

### Key APIs
- ValenceOrb props: `size`, `brightness`, `smoothness`, `spikiness`, `breathingRate`
- Theme tokens for orb colors (no hardcoded values)

### Implementation Pattern
```pseudocode
1. Load orb-design-philosophy.md
2. Document visual mapping table (metric → visual property → range)
3. Define reduced-motion fallback (static dot)
4. Cross-reference with project design_guidelines if exists
```

### Why This Approach
- Design-first prevents rework in T3/T4
- ValenceOrb reuse at 24px needs explicit visual validation before coding

### Patterns Used
- Design Definition pattern (frontend_design_guide.md)

### Known Limitations
- 24px may be too small for superformula details — design must account for simplification
- Mobile vs desktop may need different margin values

---

## Acceptance Criteria

- [x] **Given** the design definition is complete **When** reviewed **Then** visual thesis states mood, material, energy in 1 sentence `verify: inspect (design definition doc contains visual thesis sentence)`
- [x] **Given** the design definition is complete **When** reviewed **Then** content plan defines orb placement, size (24px), z-index, margins `verify: inspect (content plan section has all 4 values)`
- [x] **Given** the design definition is complete **When** reviewed **Then** interaction plan defines fade-in/out timing, state transition duration, and reduced-motion fallback `verify: inspect (interaction plan has 3 motions + reduced-motion)`
- [x] **Given** the project has design_guidelines.md **When** loading design definition **Then** cross-reference is documented `verify: command (grep -l "design_guidelines\|orb-design-philosophy" T1-design-definition.md)`

---

## Affected Components

### Implementation
- `docs/tasks/epics/epic-8-emotional-canvas/stories/EP8_US002-typing-dynamics-mirror/tasks/T1-design-definition.md` — This document (design spec)
- Side-effects: none (documentation only)

### Documentation (REQUIRED in this task)
- `docs/orb-design-philosophy.md` — Reference, no changes

---

## Existing Code Impact

### Refactoring Required
- None (design doc only)

### Tests to Update
- None

---

## Definition of Done

- [x] All acceptance criteria met
- [x] Visual thesis, content plan, interaction plan documented
- [x] Reduced-motion fallback specified
- [x] Design cross-referenced with orb-design-philosophy.md
- [x] NO new tests created

---

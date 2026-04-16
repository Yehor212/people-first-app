# T3: TypingDynamicsMirror Component — 24px Mini-Orb

**Epic:** [Epic 8: Emotional Canvas](../../../../epic.md)
**User Story:** [EP8_US002: Typing Dynamics Mirror](../story.md)
**Status:** Done
**Related:** T1 (design spec), T2 (useTypingDynamics data)
**Parallel Group:** 2

---

## Context

### Current State
- ValenceOrb exists at full size (`src/components/state-of-mind/ValenceOrb.tsx`) with full shader pipeline (superformula SDF, caustics, particle system)
- No mini/micro variant exists — ValenceOrb has not been tested at 24px
- T1 provides design definition (visual thesis, interaction plan), T2 provides typing dynamics data

### Desired State
- A `TypingDynamicsMirror` component at `src/components/diary/TypingDynamicsMirror.tsx`
- Renders a 24px orb using a simplified ValenceOrb shader (shape + color + breathing only, no caustics/particles)
- Consumes `TypingDynamics` data from T2's hook to drive visual properties
- Smooth 0.5s interpolation between states, 30 FPS rendering

### Inherited Assumptions
- **A1 (FEASIBILITY):** ValenceOrb superformula SDF renders meaningfully at 24px with simplified shader

---

> [!WARNING]
> **DRY Check:** Similar functionality detected in codebase
> - Existing: `src/components/state-of-mind/ValenceOrb.tsx` (19 references)
> - Supporting: `src/components/state-of-mind/orbShader.ts`, `orbShader.frag`, `orbRenderer.ts`
> - Similarity: 80% (same rendering pipeline, different scale and input)
> - **Recommendation:** REUSE existing ValenceOrb component or its shader pipeline (Option 1/2)
>   - Option 1: Import ValenceOrb with `size={24}` prop + simplified shader variant
>   - Option 2: Extract shared shader core, create mini variant extending it
>   - Option 3: Justify reimplementation if 24px requires fundamentally different approach

---

## Implementation Plan

### Phase 1: Shader Simplification
- [ ] Review ValenceOrb shader (`orbShader.frag`) — identify which uniforms/features to keep vs drop
- [ ] Create simplified shader variant: keep superformula SDF shape + color + breathing animation
- [ ] Remove: caustics, particle system, complex rim lighting (overkill at 24px)
- [ ] Add uniforms for typing dynamics: `u_brightness`, `u_smoothness`, `u_spikiness`, `u_breathingRate`

### Phase 2: Component Implementation
- [ ] Create `TypingDynamicsMirror.tsx` — accepts `dynamics: TypingDynamics` prop
- [ ] Map typing metrics to shader uniforms:
  - WPM → `u_brightness` (dim at <20, bright at >60, lerp between)
  - rhythmRegularity → `u_smoothness` (0=spiky superformula, 1=circle)
  - backspaceRate → `u_spikiness` (>0.2 threshold for spiky shape)
  - isPaused → `u_breathingRate` (slow down during pauses)
- [ ] Render at 24px using canvas/WebGL (or SVG fallback if WebGL unavailable)
- [ ] Use theme tokens for orb colors (no hardcoded values)

### Phase 3: Smooth Transitions
- [ ] Implement 0.5s linear interpolation (lerp) between current and target uniform values
- [ ] Use `requestAnimationFrame` at 30 FPS for uniform updates
- [ ] Verify no visual jumps or flicker during normal typing patterns

---

## Technical Approach

### Recommended Solution
**Library/Framework:** React 18 + GLSL (reuse from `src/components/state-of-mind/orbShader.ts`)
**Documentation:** `docs/orb-design-philosophy.md`, `src/components/state-of-mind/orbShader.frag`

### Key APIs
- `orbRenderer.ts` pattern: WebGL context setup, shader compilation, uniform updates
- `ValenceOrb.tsx` pattern: React component wrapping canvas with useEffect for render loop
- Lerp utility: `current + (target - current) * smoothing` per frame

### Implementation Pattern
```pseudocode
TypingDynamicsMirror({ dynamics }):
  canvasRef = useRef<HTMLCanvasElement>()
  targetUniforms = mapDynamicsToUniforms(dynamics)
  currentUniforms = useRef(defaultUniforms)
  
  renderLoop():
    currentUniforms = lerp(currentUniforms, targetUniforms, 0.1)
    drawOrb(gl, shader, currentUniforms, size=24)
    requestAnimationFrame(renderLoop)  // 30 FPS throttled
  
  return <canvas ref={canvasRef} width={24} height={24} />
```

### Why This Approach
- Reusing orbShader pipeline avoids duplicating GLSL code
- Simplified shader (no caustics/particles) stays within GPU budget at 24px
- Lerp smoothing prevents jarring visual transitions

### Patterns Used
- ValenceOrb component pattern (canvas + WebGL + useEffect loop)
- Uniform interpolation for smooth state transitions
- Theme token consumption for colors

### Known Limitations
- WebGL context count is limited per page — sharing context with main ValenceOrb may be needed
- Very old devices may not support WebGL — SVG static fallback needed
- 24px canvas may appear blurry on high-DPI without `devicePixelRatio` scaling

### Error Handling Strategy

**Expected errors (this task):**
| Error Type | When Occurs | Handling |
|------------|-------------|----------|
| WebGL unavailable | Old browser/device | Render static colored div as fallback |
| Shader compile error | GLSL syntax issue | Log error, render fallback, don't crash editor |
| Canvas context lost | GPU pressure | Re-initialize on `webglcontextrestored` event |

### Alternatives Considered
- **SVG-only approach:** Rejected — cannot reproduce superformula SDF morphing with SVG paths smoothly
- **CSS-only animated div:** Rejected — no shape morphing capability, only color/opacity

---

## Acceptance Criteria

- [ ] **Given** typing dynamics with WPM >60 **When** TypingDynamicsMirror renders **Then** orb brightness is visually high (uniform >0.8) `verify: test (TypingDynamicsMirror.test.tsx — pass high WPM dynamics, assert u_brightness > 0.8)`
- [ ] **Given** typing dynamics with regular rhythm (>0.7) **When** rendered **Then** orb shape is smooth (near-circle) `verify: inspect (visual inspection — smooth shape at high rhythmRegularity)`
- [ ] **Given** typing dynamics with high backspace rate (>0.2) **When** rendered **Then** orb shape is spiky `verify: inspect (visual inspection — spiky shape at high backspaceRate)`
- [ ] **Given** a state change from dim to bright **When** WPM increases rapidly **Then** transition interpolates over 0.5s with no flicker `verify: command (record 2s video, verify no frame drops or jumps)`
- [ ] **Given** WebGL is unavailable **When** component mounts **Then** a static colored div fallback renders without crash `verify: test (TypingDynamicsMirror.test.tsx — mock no WebGL, assert fallback renders)`

---

## Affected Components

### Implementation
- `src/components/diary/TypingDynamicsMirror.tsx` — NEW: 24px mini-orb component
- `src/components/state-of-mind/orbShader.ts` — READ for reuse (no modifications)
- `src/components/state-of-mind/orbRenderer.ts` — READ for reuse (no modifications)
- Side-effects: WebGL canvas rendering
- Side-effect depth: 1 (flat)

### Documentation (REQUIRED in this task)
- Inline JSDoc on `TypingDynamicsMirror` component props

---

## Existing Code Impact

### Refactoring Required
- None (new component, reuses existing shader infrastructure without modifying it)

### Tests to Update
- None (new component)

---

## Definition of Done

- [ ] All acceptance criteria met
- [ ] `TypingDynamicsMirror.tsx` created at `src/components/diary/`
- [ ] Simplified shader renders correctly at 24px (shape + color + breathing)
- [ ] 0.5s smooth transitions between all visual states
- [ ] WebGL fallback renders static colored div
- [ ] Theme tokens used for all colors (zero hardcoded)
- [ ] NO new tests created (tests planned separately)
- [ ] Code reviewed

---

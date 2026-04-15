# EP7_US003: Shader Arousal Integration

**Epic:** 7 — Living Entries & Arousal Foundation
**Priority:** P0 (Critical — arousal visible in orb)
**Complexity:** Medium
**Status:** Backlog
**Created:** 2026-04-14

---

## 1. User Story Statement

**As a** journaler viewing my entry's orb,
**I want** the orb to visually respond to my arousal level,
**So that** I can see the difference between calm and energized emotional states.

---

## 2. Acceptance Criteria

- **AC1:** Given I select a high-arousal emotion (e.g., "excited"), when the orb renders, then it moves faster and shows higher intensity
- **AC2:** Given I select a low-arousal emotion (e.g., "peaceful"), when the orb renders, then it moves slowly and shows subdued intensity
- **AC3:** Given I change my emotion selection, when the orb updates, then the arousal transition is smooth (no visual jumps)

---

## 3. Technical Notes

### Architecture

- Add `uniform float uArousal` to `orbShader.frag`
- Add `uniform float uSeed` to `orbShader.frag` (needed for US004, but wiring now avoids double-touching shader)
- Update `orbShader.ts` bridge to pass both new uniforms from React
- Update `ValenceOrb.tsx` to accept and forward arousal + seed props
- Arousal modulates: animation speed, glow intensity, noise frequency in shader

### Standards Research

- Superformula SDF: parameters (m, n1, n2, n3) control shape — arousal can modulate noise amplitude
- GLSL uniform count: 2 new uniforms well within GL limits (typical max: 256)
- Full research: `docs/research/rsh-004-living-entries-standards.md` §2

### Key Files

- `src/shaders/orbShader.frag` (modify — add uArousal, uSeed uniforms)
- `src/shaders/orbShader.ts` (modify — bridge new uniforms)
- `src/components/orb/ValenceOrb.tsx` (modify — pass arousal + seed)

---

## 4. Dependencies

- **Blocked by:** EP7_US001 (arousal value source)
- **Blocks:** EP7_US005 (crystallization needs arousal-aware orb)

---

## 5. Test Strategy

(Planned separately by test planner)

---

## 6. Out of Scope

- Glyph generation from seed (US004)
- Crystallization animation (US005)
- New UI controls for arousal

---

## 7. Design Notes

Arousal should feel organic — not a switch but a spectrum. Consider easing the arousal value through a low-pass filter for smooth real-time transitions.

---

## 8. Orchestrator Brief

```
orchestratorBrief: {
  tech: "GLSL, TypeScript, React",
  keyFiles: ["src/shaders/orbShader.frag", "src/shaders/orbShader.ts", "src/components/orb/ValenceOrb.tsx"],
  approach: "Add uArousal + uSeed uniforms to GLSL shader, bridge through orbShader.ts, modulate orb animation",
  complexity: "Medium (GLSL shader modification, must maintain 60 FPS)"
}
```

---

## 9. Story Points

**Estimate:** 5 SP

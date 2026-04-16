# EP8_US002: Typing Dynamics Mirror

**Epic:** [Epic 8: Emotional Canvas](../../epic.md)
**Status:** In Progress
**Priority:** P1
**Complexity:** Medium
**Created:** 2026-04-14

---

## Goal

Place a 24px mini-orb in the editor corner that mirrors the user's typing energy in real time — brightness reflects speed, shape smoothness reflects rhythm regularity, and spikiness reflects backspace frequency — giving the writer a living visual companion that breathes with their creative flow.

## Acceptance Criteria

### AC1: Mini-Orb Visibility

- [ ] A 24px orb appears in the bottom-right corner of the diary editor when the user starts typing
- [ ] The orb is visible but non-intrusive — does not overlap text or block any editor controls
- [ ] The orb fades in on first keystroke and fades out 5 seconds after typing stops

### AC2: Typing Energy Mapping

- [ ] Orb brightness increases with WPM (dim at < 20 WPM, bright at > 60 WPM)
- [ ] Orb shape becomes smoother when typing rhythm is regular (steady intervals between keystrokes)
- [ ] Orb shape becomes spikier when backspace rate is high (> 20% of keystrokes in the rolling window)
- [ ] Orb breathing rate slows during long pauses (> 3 seconds without typing)

### AC3: Smooth Updates

- [ ] Mini-orb updates at 30 FPS using a 30-second rolling window of keystroke data
- [ ] Transitions between states (bright↔dim, smooth↔spiky) interpolate smoothly over 0.5 seconds
- [ ] No visual jumps or flicker during normal typing patterns

### AC4: Reduced Motion & Accessibility

- [ ] `prefers-reduced-motion` reduces the orb to a static colored dot (no animation, color still reflects mood)
- [ ] Orb has `aria-hidden="true"` (decorative element, not interactive)

## Test Strategy

(Planned separately by test planner)

## Technical Notes

### Affected Components

- `src/components/diary/TypingDynamicsMirror.tsx` — NEW: 24px mini-orb component
- `src/hooks/useTypingDynamics.ts` — NEW: keystroke analysis (WPM, rhythm, pauses, backspaces)
- `JournalEntryEditor.tsx` — MODIFIED: add mini-orb placement in editor corner

### Architecture Decisions

- Reuse ValenceOrb at 24px with simplified shader (shape + color + breathing only, no caustics)
- 30-second rolling window — balances responsiveness with stability
- 30 FPS update rate (not 60) — sufficient for smooth animation at 24px, saves GPU budget for ink canvas

### orchestratorBrief

```
tech: "React, GLSL (simplified ValenceOrb shader), TypeScript"
keyFiles: "src/components/diary/TypingDynamicsMirror.tsx, src/hooks/useTypingDynamics.ts, JournalEntryEditor.tsx"
approach: "Reuse ValenceOrb component at 24px with simplified shader, fed by useTypingDynamics hook analyzing keystroke patterns in 30s rolling window"
complexity: "Medium (shader simplification + keystroke analysis + editor integration)"
```

### Dependencies

- None (independent of ink diffusion — can be developed in parallel with US001)

### Risks

- ValenceOrb simplified shader may not look good at 24px — test minimal shader early
- Keystroke event handling must not interfere with editor input (passive listeners only)
- Mobile keyboards may report different keystroke timing than physical keyboards

## Context

This story is **independent** from the ink/weather features — it can be developed in parallel with US001. The `useTypingDynamics` hook created here is also consumed by US003 (Weather System) for typing velocity input to the weather state machine.

**Dependency chain:** US002 (this, independent) → US003 (weather uses typing dynamics data).

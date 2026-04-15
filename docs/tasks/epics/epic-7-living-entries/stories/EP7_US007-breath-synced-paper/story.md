# EP7_US007: Breath-Synced Paper

**Epic:** 7 — Living Entries & Arousal Foundation
**Priority:** P1 (High)
**Complexity:** Low
**Status:** Backlog
**Created:** 2026-04-14

---

## 1. User Story Statement

**As a** journaler viewing my diary,
**I want** the paper card to gently breathe in sync with my emotional arousal level,
**So that** the app feels alive and responsive to my emotional state.

---

## 2. Acceptance Criteria

- **AC1:** Given I view an entry with low arousal (e.g., "peaceful"), when the paper card renders, then it breathes with a slow ~16s period
- **AC2:** Given I view an entry with high arousal (e.g., "excited"), when the paper card renders, then it breathes with a faster ~8s period
- **AC3:** Given I have `prefers-reduced-motion` enabled, when I view any entry, then the breathing animation is paused

---

## 3. Technical Notes

### Architecture

- Create `src/styles/paper-breathe.css` — CSS `@keyframes paper-breathe` animation
- Scale sequence: `1.0 → 1.005 → 1.003 → 0.998 → 1.0` (subtle, imperceptible to most)
- Animation duration driven by arousal: `animation-duration: calc(16s - 8s * var(--arousal))`
- CSS custom property `--arousal` set via inline style from React
- `transform: scale()` is compositor-only — guaranteed 60 FPS
- `@media (prefers-reduced-motion: reduce)` → `animation: none`

### Standards Research

- CSS transform animations are compositor-only — no main thread, 60 FPS guaranteed
- Sub-pixel scale (0.005 amplitude) is barely perceptible but creates "living" feel
- Full research: `docs/research/rsh-004-living-entries-standards.md` §5

### Key Files

- `src/styles/paper-breathe.css` (new)
- `src/components/diary/JournalEntryCard.tsx` (modify — apply breathe class + --arousal var)

---

## 4. Dependencies

- **Blocked by:** EP7_US001 (arousal value drives breath period)
- **Blocks:** None

---

## 5. Test Strategy

(Planned separately by test planner)

---

## 6. Out of Scope

- Breathing on non-diary screens
- User-configurable breath amplitude
- Haptic feedback synchronized with breath

---

## 7. Design Notes

The breath should be felt, not seen — like a sleeping animal's chest rising. If a user notices the animation consciously, the amplitude is too high. The arousal-driven period creates a subliminal emotional mirror.

---

## 8. Orchestrator Brief

```
orchestratorBrief: {
  tech: "CSS, TypeScript",
  keyFiles: ["src/styles/paper-breathe.css", "src/components/diary/JournalEntryCard.tsx"],
  approach: "CSS keyframe animation with arousal-driven duration via CSS custom property, compositor-only transform",
  complexity: "Low (CSS-only animation, simple arousal integration)"
}
```

---

## 9. Story Points

**Estimate:** 2 SP

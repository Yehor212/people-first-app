# EP8_US004: Weather Particles

**Epic:** [Epic 8: Emotional Canvas](../../epic.md)
**Status:** Backlog
**Priority:** P1
**Complexity:** Medium
**Created:** 2026-04-14

---

## Goal

Bring the weather system to life with visible particles — rain droplets falling during sadness, lightning flashes with haptic feedback during storms, wind streaks during excitement, and fog overlay during confusion — so the writing atmosphere becomes truly immersive without exceeding the particle budget.

## Acceptance Criteria

### AC1: Rain Particles

- [ ] Rain droplets fall from top of editor area during rain/storm weather states
- [ ] Droplets have slight randomization in size, speed, and angle for organic feel
- [ ] Rain intensity scales with sentiment negativity (light drizzle → heavy rain)

### AC2: Storm Effects

- [ ] Lightning flash appears as a brief full-screen white overlay (100ms) during storm state
- [ ] Lightning triggers haptic feedback (single tap pattern) on supported devices
- [ ] Lightning occurs at random intervals (5-15 seconds) during active storm state

### AC3: Wind & Fog

- [ ] Wind particles streak horizontally with increasing speed during wind/excitement state
- [ ] Fog renders as a semi-transparent overlay that gently drifts across the editor during confusion state
- [ ] Both effects are subtle enough to maintain text readability

### AC4: Particle Budget & Performance

- [ ] Maximum 200 active particles at any time across all weather effects combined
- [ ] Particles integrate into existing DiaryCanvas rAF loop (no separate animation frame)
- [ ] All particle effects respect `prefers-reduced-motion` (disabled when set)

## Test Strategy

(Planned separately by test planner)

## Technical Notes

### Affected Components

- `DiaryCanvas` — MODIFIED: extend existing particle system with weather particle types
- `src/components/diary/EmotionalWeather.tsx` — MODIFIED: particle spawning driven by weather state

### Architecture Decisions

- Extend existing DiaryCanvas particle system (not new) — reuse pool, rAF loop, rendering pipeline
- Particle pool pattern — pre-allocate 200 particles, recycle on death (zero allocation during animation)
- Haptic feedback wrapped in try/catch for graceful cross-platform fallback

### orchestratorBrief

```
tech: "React, Canvas 2D, Capacitor Haptics API, TypeScript"
keyFiles: "DiaryCanvas, src/components/diary/EmotionalWeather.tsx"
approach: "Extend existing DiaryCanvas particle system with 4 new particle types (rain/lightning/wind/fog), driven by weather state from US003, capped at 200 active particles"
complexity: "Medium (particle system extension + haptics + performance tuning)"
```

### Dependencies

- **EP8_US003** — weather state machine determines which particles to spawn

### Risks

- Particles + ink + paper = combined GPU pressure — must profile on low-end Android
- Lightning haptic may feel jarring — needs user testing, consider intensity setting
- Wind particles on RTL layouts should blow in culturally appropriate direction

## Context

Weather Particles are the **immersion layer** on top of the weather system (US003). Without particles, weather is just a background color change — particles make it feel physical. The particle budget cap (200) is critical for maintaining 60 FPS alongside ink diffusion.

**Dependency chain:** US003 → US004 (this). Independent of US005, US006.

# EP8_US007: Emotion Ink Settings & Graceful Fallback

**Epic:** [Epic 8: Emotional Canvas](../../epic.md)
**Status:** Backlog
**Priority:** P2
**Complexity:** Medium
**Created:** 2026-04-14

---

## Goal

Give users control over the Emotion Ink feature with a settings toggle, and ensure the feature degrades gracefully on lower-end devices — throttling to 30 FPS or falling back to static paper — so the feature never compromises the core writing experience.

## Acceptance Criteria

### AC1: Settings Toggle

- [ ] "Emotion Ink" toggle appears in app Settings under a "Writing Experience" section
- [ ] Toggle controls all Emotional Canvas features: ink diffusion, weather, mini-orb, particles
- [ ] Toggle state persists across app restarts (stored in user preferences)
- [ ] Disabling Emotion Ink immediately hides all canvas overlays with no residual visual artifacts

### AC2: Performance Detection & Throttling

- [ ] App detects device capability on first launch (RAM, GPU tier estimation)
- [ ] Capable devices (≥ 4GB RAM): full 60 FPS ink diffusion + weather + particles
- [ ] Mid-range devices (2-4GB RAM): throttle canvas to 30 FPS, reduce particle budget to 100
- [ ] Low-end devices (< 2GB RAM): static paper only, Emotion Ink auto-disabled with user notification

### AC3: Graceful Degradation

- [ ] If canvas FPS drops below 24 FPS for 3+ seconds during typing, automatically reduce particle count by 50%
- [ ] If FPS remains below 24 FPS after reduction, fall back to static paper for the current session
- [ ] Fallback transitions are smooth (fade out over 0.3 seconds), not abrupt

### AC4: Cross-Platform Consistency

- [ ] Settings toggle works identically on iOS, Android, and desktop
- [ ] Performance detection accounts for platform differences (iOS Metal vs Android OpenGL)
- [ ] Feature state syncs across devices when cloud sync is enabled

## Test Strategy

(Planned separately by test planner)

## Technical Notes

### Affected Components

- Settings screen — MODIFIED: add "Writing Experience" section with Emotion Ink toggle
- `src/components/diary/LivingInkCanvas.tsx` — MODIFIED: respect settings + performance tier
- `src/components/diary/EmotionalWeather.tsx` — MODIFIED: respect settings + throttle
- `src/components/diary/TypingDynamicsMirror.tsx` — MODIFIED: respect settings

### Architecture Decisions

- Device capability detection at first launch, cached in preferences (not re-checked every session)
- Runtime FPS monitoring via rAF timing — adaptive throttling without user intervention
- Single "Emotion Ink" toggle controls everything (not per-feature toggles — reduces settings complexity)

### orchestratorBrief

```
tech: "React, Capacitor Device API, TypeScript"
keyFiles: "Settings screen, LivingInkCanvas.tsx, EmotionalWeather.tsx, TypingDynamicsMirror.tsx"
approach: "Single settings toggle + device capability detection + runtime FPS monitoring for adaptive degradation across performance tiers"
complexity: "Medium (capability detection + adaptive throttling + settings integration + cross-platform)"
```

### Dependencies

- **EP8_US001** — ink canvas (controlled by toggle)
- **EP8_US002** — mini-orb (controlled by toggle)
- **EP8_US003** — weather system (controlled by toggle)
- **EP8_US004** — particles (controlled by toggle + throttle)

### Risks

- Device capability detection heuristics may miscategorize some devices — need escape hatch (manual toggle)
- RAM detection on iOS is limited (no direct API) — use device model mapping
- Adaptive throttling must not cause visual stutter (smooth transitions between tiers)

## Context

This is the **cross-cutting safety net** for the entire Emotional Canvas epic. Without graceful fallback, the feature could make the app unusable on lower-end devices. Without the settings toggle, users who prefer a clean writing space have no opt-out. This story should be implemented last, after all features it controls exist.

**Dependency chain:** US001 + US002 + US003 + US004 → US007 (this, last).

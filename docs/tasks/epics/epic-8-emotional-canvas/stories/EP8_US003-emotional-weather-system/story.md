# EP8_US003: Emotional Weather System

**Epic:** [Epic 8: Emotional Canvas](../../epic.md)
**Status:** Backlog
**Priority:** P0
**Complexity:** High
**Created:** 2026-04-14

---

## Goal

Make the diary background sky respond to writing content and typing behavior simultaneously, transitioning between 8 weather states — from sunshine during positive, steady writing to storms during angry, rapid typing — so the writing environment mirrors the writer's emotional state in real time.

## Acceptance Criteria

### AC1: Weather State Transitions

- [ ] Background transitions between 8 weather states based on combined sentiment + typing velocity
- [ ] Transitions use a 0.5-second crossfade (no abrupt switches between states)
- [ ] Weather state is visible as a background layer behind the editor content

### AC2: Sentiment-Driven States

- [ ] Sunshine appears during positive words + steady typing rhythm
- [ ] Clouds appear when negative sentiment increases
- [ ] Rain appears during sadness + long pauses between words
- [ ] Storm appears during anger + rapid typing + high backspace rate

### AC3: Behavior-Driven States

- [ ] Fog appears during confusion (mid-sentence pauses > 5 seconds)
- [ ] Aurora appears during creative flow state (high WPM + positive sentiment + low backspace rate)
- [ ] Wind appears during excitement (accelerating typing speed)
- [ ] Clearing appears during negative-to-positive sentiment transition

### AC4: Rolling Window Analysis

- [ ] Sentiment calculated from rolling window of last 5 words using emotional valence lexicon (from US001)
- [ ] Typing velocity sourced from `useTypingDynamics` hook (from US002)
- [ ] Combined state machine produces a single weather state from both inputs

## Test Strategy

(Planned separately by test planner)

## Technical Notes

### Affected Components

- `src/components/diary/EmotionalWeather.tsx` — NEW: weather state machine + background rendering
- `src/hooks/useWeatherState.ts` — NEW: rolling sentiment + velocity → weather state machine
- `JournalEntryEditor.tsx` — MODIFIED: add weather background layer

### Architecture Decisions

- State machine (not ML) — deterministic, predictable, debuggable, no model loading
- Rolling 5-word sentiment window — responsive without being jittery
- CSS gradient backgrounds per weather state — lightweight, theme-compatible
- Weather state persisted with entry for US006 (Weather Badge) to consume

### orchestratorBrief

```
tech: "React, TypeScript, CSS gradients/animations"
keyFiles: "src/components/diary/EmotionalWeather.tsx, src/hooks/useWeatherState.ts, JournalEntryEditor.tsx"
approach: "Finite state machine combining rolling 5-word sentiment (from lexicon) and typing velocity (from useTypingDynamics) to drive 8 weather background states with 0.5s crossfade transitions"
complexity: "High (state machine design + dual input sources + smooth transitions)"
```

### Dependencies

- **EP8_US001** — emotional valence lexicon for sentiment scoring
- **EP8_US002** — `useTypingDynamics` hook for typing velocity/rhythm data

### Risks

- State machine jitter — rapid sentiment swings could cause weather flickering (debounce/hysteresis needed)
- 8 weather states × 2 themes (day/night) = 16 visual variants to design
- Weather background must not reduce text readability (contrast ratios maintained)

## Context

This is the **core experience story** — the weather system is what makes the diary canvas feel alive and responsive. The weather state machine output is consumed by US004 (Weather Particles) for particle rendering and US006 (Weather Badge) for post-save summary text.

**Dependency chain:** US001 + US002 → US003 (this) → US004 (particles), US006 (badge).

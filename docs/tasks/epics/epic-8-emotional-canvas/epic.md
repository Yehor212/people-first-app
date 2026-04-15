# Epic 8: Emotional Canvas

**Status:** Backlog
**Created:** 2026-04-14
**Source:** [Diary Revolution Research](../../reference/research/2026-04-14-diary-revolution.md)
**Priority:** High

---

## Goal

Transform the diary writing space from a static editor into a living, responsive canvas that reacts to the user's words and typing behavior in real time. Through ink diffusion, emotional weather, and typing dynamics visualization, the paper itself becomes a unique painting by the time you finish writing — no diary app has ever made the act of writing visually alive.

---

## Scope

### In Scope

- **Living Ink Diffusion** (Critical): Canvas overlay on paper card. Each word triggers a tiny ink drop that diffuses outward. Positive words → warm colors (orange/yellow from orb spectrum). Negative words → cool colors (purple/blue). Drops interact — overlapping diffusions blend. Composited via `mix-blend-mode: multiply` over existing paper texture. Emotional valence lexicon (~1500 words, ~2KB). Toggle in settings: "Emotion Ink"
- **Emotional Weather System** (High): Background sky responds to writing content AND typing behavior simultaneously. 8 weather states: sunshine (positive + steady rhythm), clouds (negativity), rain (sadness + long pauses), storm (anger + rapid typing + backspaces), fog (confusion + mid-sentence pauses), aurora (creativity + flow state), wind (excitement + accelerating speed), clearing (negative-to-positive transition). Rolling sentiment (last 5 words) + typing velocity state machine
- **Typing Dynamics Mirror** (Medium): 24px mini-orb in editor corner. WPM → brightness, rhythm regularity → shape smoothness, pause frequency → breathing rate, backspace rate → spikiness. 30-second rolling window. Reuse ValenceOrb at 24px with simplified shader
- **Weather Report Badge** (Medium): After saving, entry card shows "Partly cloudy with moments of sunshine" badge. Deterministic from entry sentiment data
- **Ink Pattern Preservation**: Stored with entry, replayed (1.5s) when opening old entries
- **Weather Particles**: Rain droplets falling, lightning flash + haptic, wind acceleration — extend existing DiaryCanvas particle system

### Out of Scope

- Emotional Glyph generation (Epic 7 — Living Entries)
- Body Map, Scribble, or other input modes (Epic 9)
- Ritual ceremony structure (Epic 5)
- Sound effects for weather (deferred — future enhancement)
- Real-time sentiment analysis API calls (all on-device)

---

## Success Criteria

- Ink diffusion renders at 60 FPS during active typing (Canvas 2D)
- Weather state transitions smooth (0.5s crossfade between states)
- Mini-orb updates at 30 FPS with 30-second rolling window
- Canvas overlay composites cleanly over all 6 existing paper textures
- Ink diffusion graceful fallback to static paper on low-end devices (< 4GB RAM)
- Weather badge text deterministically generated from entry sentiment
- Emotional valence lexicon covers 1500+ words (English base, extend per language)
- Canvas memory usage < 5MB for a single entry session
- All weather particles stay within particle budget (max 200 active)
- Zero visual regression on existing paper textures, themes, and backgrounds

---

## Dependencies

### Technical Dependencies

- **DiaryCanvas**: Existing particle system — extend for weather particles
- **Paper textures**: 6 existing types — ink composites on top (not replacing)
- **requestAnimationFrame**: Share with existing animation loop
- **Canvas 2D API**: Ink diffusion rendering

### Epic Dependencies

- **Blocked by**: Epic 7 (arousal computation — weather intensity depends on arousal)
- **Blocks**: None (enhancement layer)

---

## Risks and Mitigations

| Risk                                                 | Impact | Probability | Mitigation Strategy                                                |
| ---------------------------------------------------- | ------ | ----------- | ------------------------------------------------------------------ |
| Canvas overlay performance on low-end Android        | High   | Medium      | rAF throttle to 30 FPS on slow devices, fallback to static paper   |
| Ink diffusion on RTL languages (Arabic, Hebrew)      | Medium | Low         | Word-boundary detection works bidirectionally, test with ar/he     |
| Weather particles + ink + paper = GPU pressure       | Medium | Medium      | Particle budget cap (200), compositing optimization, layer caching |
| Mini-orb simplified shader doesn't look good at 24px | Low    | Medium      | Test minimal shader (shape + color + breathing only, no caustics)  |
| Valence lexicon incomplete for non-English           | Medium | High        | English base with extension points, community-sourced per language |

---

## Metrics

- **Ink Render FPS**: Target: 60 FPS, Measurement: rAF timing in LivingInkCanvas
- **Weather Transition Time**: Target: 0.5s, Measurement: state machine transition logs
- **Memory Usage**: Target: < 5MB per session, Measurement: Performance.memory API
- **Particle Count**: Target: < 200 active, Measurement: particle pool counter

---

## Architecture Impact

### New Components

- `src/components/diary/LivingInkCanvas.tsx` — ink diffusion overlay (Canvas 2D)
- `src/components/diary/EmotionalWeather.tsx` — weather state machine + particle rendering
- `src/components/diary/TypingDynamicsMirror.tsx` — 24px mini-orb reflecting typing energy
- `src/components/diary/WeatherBadge.tsx` — post-save weather report badge

### New Hooks & Utils

- `src/hooks/useTypingDynamics.ts` — keystroke analysis (WPM, rhythm, pauses, backspaces)
- `src/hooks/useWeatherState.ts` — rolling sentiment + velocity → weather state machine
- `src/hooks/useLivingInk.ts` — word-boundary detection + ink drop spawning
- `src/utils/emotionalLexicon.ts` — valence lexicon (~1500 words, extensible per language)
- `src/utils/weatherTextGenerator.ts` — deterministic weather report from sentiment data

### Components Modified

- `JournalEntryEditor.tsx` — canvas overlay layer + mini-orb placement
- `JournalEntryCard.tsx` — weather badge display
- `DiaryCanvas` — weather particle integration into existing rAF loop

### Technical Decisions

- Canvas 2D (not WebGL) for ink — simpler, better battery, sufficient for 2D diffusion
- On-device valence lexicon (not API) — instant, offline, privacy-preserving
- Weather state machine (not ML) — deterministic, predictable, debuggable
- Existing particle system extension (not new) — reuse DiaryCanvas infrastructure

---

## User Stories

User Stories created separately via story-creator skill.

---

## Phases

1. Emotional valence lexicon (English base, ~1500 words with valence scores)
2. Living Ink Diffusion canvas overlay (word-boundary → radial gradient → blend)
3. Typing dynamics hook (WPM, rhythm, pause, backspace analysis)
4. Typing Dynamics Mirror (24px mini-orb with simplified shader)
5. Weather state machine (sentiment + velocity → 8 weather states)
6. Weather particles (rain, lightning, wind, fog — extend DiaryCanvas)
7. Ink pattern storage + replay on old entries (1.5s animation)
8. Weather report badge on entry cards
9. Settings toggle: "Emotion Ink" on/off
10. Performance optimization pass (throttling, fallback, particle budget)

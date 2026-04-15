# EP3_US007: Emotion Sediment — Emotional Core Painting

**Status:** Backlog
**Epic:** Epic 3 — Memories, Nostalgia & Living Timeline
**Labels:** user-story
**Priority:** P2
**Complexity:** Medium
**Created:** 2026-04-14

---

## 1. Story

**As a** journal user,
**I want to** view my emotional history as a geological strata painting where each day adds a color band,
**So that** I can see the layers of my emotional journey like looking at a rock formation.

## 2. Context

**Current Situation:** Emotional history is shown as charts and numbers in the stats view. There is no artistic or visceral representation of emotional patterns over time. Geological strata as a metaphor for emotional layering is unique to journaling and creates deep emotional connection.

**Desired Outcome:** Emotion Sediment export generates print-ready PNG in < 3 seconds. Users engage with "Emotional Core" as a reflective and shareable artifact.

## 3. Acceptance Criteria

- **AC1:** Given user opens Emotional Core in stats, Then a vertical painting appears with horizontal color bands where each band represents one day — color=mood, thickness=word count
- **AC2:** Given user long-presses a color band, Then a tooltip shows the date and mood for that day
- **AC3:** Given the painting spans many months, When user scrolls, Then the strata painting scrolls smoothly revealing older emotional layers
- **AC4:** Given user taps export, Then a print-ready PNG is generated and saved within 3 seconds

## 4. Implementation Tasks

Tasks created via ln-300-task-coordinator after ln-310-multi-agent-validator.

## 5. Test Strategy

Test counts to be determined by ln-520-test-planner. Risk-Based Testing approach — prioritize scroll performance, export quality, and tooltip accuracy.

## 6. Technical Notes

<!-- ORCHESTRATOR_BRIEF_START -->

- **Tech:** React 18, TypeScript, Canvas 2D, Perlin noise
- **Key Files:** `src/components/EmotionSediment.tsx`, `src/hooks/useEmotionSediment.ts`, `src/utils/perlinNoise.ts`
- **Approach:** Build Canvas 2D strata renderer with Perlin noise texture, implement long-press tooltip interaction, add PNG export
- **Complexity:** Medium (Canvas rendering + Perlin noise + export)
<!-- ORCHESTRATOR_BRIEF_END -->

### Architecture

- Canvas 2D for strata rendering — each day = horizontal color band
- Color mapping: mood → theme-aware color from 9-stop spectrum
- Thickness: word count (more words = thicker band)
- Perlin noise for emotional volatility texture (smooth=consistent, cracked=volatile)
- Scrollable container with Canvas viewport for long time ranges
- Long-press interaction → tooltip with date + mood
- Export via `canvas.toBlob('image/png')` for print-ready output
- `EmotionSediment.tsx` — main visualization component
- `useEmotionSediment.ts` — data aggregation and canvas rendering hook
- `perlinNoise.ts` — Perlin noise implementation for texture

### Library Research (Standards)

- **Canvas strata:** Horizontal band rendering with varying height and color (see RSH-003 Section 6)
- **Perlin noise:** Classic 2D Perlin noise for texture variation — lightweight JS implementation
- **PNG export:** `canvas.toBlob('image/png')` with high-res dimensions for print quality

### Performance

- 60 FPS for scroll interactions
- Canvas renders only visible viewport + buffer (virtual scrolling)
- `prefers-reduced-motion`: no texture animation, static rendering
- Export target: < 3 seconds for full-resolution PNG

### i18n

- Tooltip labels (date format, mood name) via `t()` across 8 languages
- Export button label via `t()`

## 7. Definition of Done

- [ ] All AC verified on iOS, Android, and Desktop
- [ ] Strata painting renders correctly for 30+ days of data
- [ ] Long-press tooltip shows accurate date and mood
- [ ] Scroll is smooth (60 FPS) for multi-month data
- [ ] PNG export completes in < 3 seconds
- [ ] Theme tokens only, safe area insets respected
- [ ] `prefers-reduced-motion` respected
- [ ] i18n keys for all 8 languages
- [ ] Android back handler exits Emotional Core view

## 8. Dependencies

- None (uses existing mood data from entries)

## 9. Assumptions

- **DATA (HIGH):** Daily mood data is available from existing entries — no new data collection needed
- **FEASIBILITY (HIGH):** Canvas 2D handles strata rendering efficiently for 365+ day ranges
- **SCOPE (MEDIUM):** Perlin noise texture is pre-generated per band, not animated in real-time

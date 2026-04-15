# EP3_US009: Emotional River — Flowing Timeline

**Status:** Backlog
**Epic:** Epic 3 — Memories, Nostalgia & Living Timeline
**Labels:** user-story
**Priority:** P3
**Complexity:** High
**Created:** 2026-04-14

---

## 1. Story

**As a** journal user,
**I want to** view my timeline as a flowing river where width reflects emotional intensity and color reflects mood,
**So that** I can experience my emotional journey as a living, moving landscape.

## 2. Context

**Current Situation:** The timeline view is a static list. There is no visual metaphor that captures the flow, intensity, and branching of emotional experience over time. A river metaphor naturally conveys intensity (width), mood (color), and turbulence (volatility).

**Desired Outcome:** Emotional River zoom transitions are smooth at 60 FPS with pinch-to-zoom. Users discover entry clusters and topic branches through visual exploration rather than search.

## 3. Acceptance Criteria

- **AC1:** Given user opens Emotional River view, Then a flowing river visualization appears with width=emotional intensity, color=mood, and turbulence=volatility
- **AC2:** Given user pinches to zoom, Then the river transitions smoothly from year overview to day-level detail at 60 FPS
- **AC3:** Given user taps a section of the river, Then entries for that time period appear in a preview panel
- **AC4:** Given user has topic threads in entries, Then the river shows branches splitting and merging for different topics

## 4. Implementation Tasks

Tasks created via ln-300-task-coordinator after ln-310-multi-agent-validator.

## 5. Test Strategy

Test counts to be determined by ln-520-test-planner. Risk-Based Testing approach — prioritize zoom performance (60 FPS), LOD transitions, and gesture accuracy.

## 6. Technical Notes

<!-- ORCHESTRATOR_BRIEF_START -->

- **Tech:** React 18, TypeScript, Canvas 2D, Touch gestures
- **Key Files:** `src/components/EmotionalRiver.tsx`, `src/hooks/useEmotionalRiver.ts`, `src/utils/riverGeometry.ts`
- **Approach:** Build Canvas 2D river renderer with LOD zoom system, implement pinch-to-zoom gesture, add topic branch detection
- **Complexity:** High (Canvas rendering + gesture handling + LOD + 60 FPS)
<!-- ORCHESTRATOR_BRIEF_END -->

### Architecture

- Canvas 2D for river rendering — Bezier curves for flowing path
- River properties: width=emotional intensity, color=mood, turbulence=volatility (noise displacement)
- Level-of-detail (LOD) rendering: year→month→week→day based on zoom level
- Pinch-to-zoom via touch events (Capacitor gesture or raw touch)
- Topic thread detection via keyword frequency → river branches splitting/merging
- Tap detection via hit-testing on river path segments
- `EmotionalRiver.tsx` — main visualization component
- `useEmotionalRiver.ts` — data transformation, LOD management, gesture handling
- `riverGeometry.ts` — Bezier curve generation, branch point calculation

### Library Research (Standards)

- **Canvas river rendering:** Bezier curves with varying stroke-width for river width (see RSH-003 Section 6)
- **LOD rendering:** Pre-compute aggregates at multiple zoom levels (year/month/week/day)
- **Pinch-to-zoom:** Multi-touch gesture handling with smooth interpolation between LOD levels
- **Topic detection:** Keyword frequency analysis for identifying topic threads

### Performance

- 60 FPS mandatory at all zoom levels (Law 8)
- LOD: only render detail appropriate to current zoom — don't render 365 day-segments at year view
- Use `requestAnimationFrame` for render loop
- Pre-compute LOD aggregates, cache in hook state
- `prefers-reduced-motion`: static river image without flow animation

### i18n

- Time labels (year, month, week names) via locale-aware formatting across 8 languages
- Preview panel labels via `t()`
- RTL layout consideration for river flow direction (ar, he)

## 7. Definition of Done

- [ ] All AC verified on iOS, Android, and Desktop
- [ ] Pinch-to-zoom transitions smoothly between LOD levels at 60 FPS
- [ ] River width, color, and turbulence accurately reflect entry data
- [ ] Topic branches visible when entries contain recurring themes
- [ ] Tap → preview panel shows correct entries for that time period
- [ ] Touch targets >= 44px for tap interaction zones
- [ ] Theme tokens only, safe area insets respected
- [ ] `prefers-reduced-motion` respected (static image)
- [ ] i18n keys for all 8 languages
- [ ] Android back handler exits Emotional River view

## 8. Dependencies

- None (uses existing entry data — mood, text content, dates)

## 9. Assumptions

- **FEASIBILITY (MEDIUM):** Pinch-to-zoom with LOD transitions achievable at 60 FPS on mid-range mobile devices
- **DATA (MEDIUM):** Keyword frequency produces meaningful topic threads — may need tuning of minimum frequency threshold
- **SCOPE (HIGH):** Topic branches are visual only — no separate topic management UI

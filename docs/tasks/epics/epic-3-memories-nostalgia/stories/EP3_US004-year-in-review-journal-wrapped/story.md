# EP3_US004: Year in Review — Journal Wrapped

**Status:** Backlog
**Epic:** Epic 3 — Memories, Nostalgia & Living Timeline
**Labels:** user-story
**Priority:** P1
**Complexity:** High
**Created:** 2026-04-14

---

## 1. Story

**As a** journal user who has journaled throughout the year,
**I want to** view my annual summary in a Spotify-Wrapped swipeable story format,
**So that** I can celebrate my journaling journey and see patterns in my emotional history.

## 2. Context

**Current Situation:** Users have no annual retrospective. A year of journaling produces no summary, no celebration, no shareable milestone. Spotify Wrapped demonstrates that annual retrospectives drive massive engagement and social sharing.

**Desired Outcome:** 60%+ of December users view the full Year in Review report. Shareable image cards drive organic acquisition through social sharing.

## 3. Acceptance Criteria

- **AC1:** Given it is December 15 or later and user has entries from the current year, When user opens Year in Review, Then swipeable story cards appear showing mood graph, entry count, streak stats, top themes, and word cloud
- **AC2:** Given user is viewing Year in Review, When they swipe between cards, Then each card animates in with smooth transition and progress bar shows position
- **AC3:** Given user wants to share their Year in Review, When they tap share on any card, Then a shareable image is generated from that card
- **AC4:** Given it is before December 15 or user has no entries, Then Year in Review section is not visible

## 4. Implementation Tasks

Tasks created via ln-300-task-coordinator after ln-310-multi-agent-validator.

## 5. Test Strategy

Test counts to be determined by ln-520-test-planner. Risk-Based Testing approach — prioritize data aggregation correctness, date gating (Dec 15 boundary), and image export quality.

## 6. Technical Notes

<!-- ORCHESTRATOR_BRIEF_START -->

- **Tech:** React 18, TypeScript, Tailwind, Canvas API, Dexie.js
- **Key Files:** `src/components/YearInReview.tsx`, `src/hooks/useYearInReview.ts`, `src/utils/statsAggregation.ts`
- **Approach:** Build stats aggregation utilities, create swipeable story card UI with progress indicators, add canvas export for sharing
- **Complexity:** High (data aggregation + story UI + canvas export)
<!-- ORCHESTRATOR_BRIEF_END -->

### Architecture

- Stats-only MVP — no AI dependency (Epic 4 provides AI capability later)
- Pre-compute annual aggregation and cache results
- Swipeable story format: vertical card stack with auto-advance + tap to pause
- Canvas rendering for shareable image export
- `YearInReview.tsx` — story-format swipeable component
- `useYearInReview.ts` — data aggregation hook
- `statsAggregation.ts` — mood distribution, streak stats, word frequency, entry counts

### Library Research (Standards)

- **Spotify Wrapped pattern:** Swipeable vertical cards, auto-advance with progress bar, tap to pause (see RSH-003 Section 4)
- **Canvas export:** `canvas.toBlob('image/png')` for shareable image cards
- **Data aggregation:** Pre-compute and cache — don't recompute on every view

### Performance

- Annual aggregation can be expensive (365+ entries) — compute once, cache in Zustand
- `prefers-reduced-motion`: disable auto-advance, show static cards
- Canvas export target: < 2 seconds for image generation

### i18n

- All stat labels, theme names, and card titles via `t()` across 8 languages
- Word cloud uses entry language (not translated)
- Number formatting respects locale

## 7. Definition of Done

- [ ] All AC verified on iOS, Android, and Desktop
- [ ] Year in Review hidden before December 15
- [ ] All stats correctly aggregated (mood graph, entry count, streaks, themes, word cloud)
- [ ] Shareable image generates correctly with theme-appropriate styling
- [ ] Touch targets >= 44px, theme tokens only
- [ ] `prefers-reduced-motion` disables auto-advance
- [ ] i18n keys for all 8 languages
- [ ] Android back handler exits Year in Review
- [ ] Safe area insets respected

## 8. Dependencies

- None (stats-only MVP is independent)
- **Optional enhancement:** Epic 4 (AI) for summary text generation — not required for MVP

## 9. Assumptions

- **DATA (HIGH):** Dexie queries can aggregate a full year of entries without performance issues
- **SCOPE (HIGH):** MVP uses statistical analysis only (mood distribution, word frequency) — no AI-generated text
- **FEASIBILITY (MEDIUM):** Canvas-based image export produces consistent results across iOS/Android/Desktop

# EP3_US001: On This Day — Daily Memory Card

**Status:** Backlog
**Epic:** Epic 3 — Memories, Nostalgia & Living Timeline
**Labels:** user-story
**Priority:** P0
**Complexity:** Medium
**Created:** 2026-04-14

---

## 1. Story

**As a** journal user with past entries,
**I want to** see a swipeable carousel of my entries from the same date in previous years on the diary home screen,
**So that** I feel emotionally connected to my journaling history.

## 2. Context

**Current Situation:** Users have no way to rediscover past entries organically. Entries written months or years ago are buried in chronological lists with no resurfacing mechanism. Day One research shows "On This Day" is the #1 reason users keep journaling long-term.

**Desired Outcome:** 40%+ of users with eligible entries tap to view On This Day memories. The feature creates a daily emotional hook that drives retention through nostalgia.

## 3. Acceptance Criteria

- **AC1:** Given user has entries from same date in previous years, When they open diary home, Then On This Day card appears with preview text (140 chars) + mood + photo thumbnail
- **AC2:** Given multiple years have entries for today, When user views On This Day card, Then they can swipe horizontally between years in a carousel
- **AC3:** Given user taps an On This Day entry preview, Then full entry opens for reading with temporal ghost layers showing other years semi-transparently
- **AC4:** Given user has no entries from same date in any previous year, Then On This Day card is hidden and motivational CTA shown instead

## 4. Implementation Tasks

Tasks created via ln-300-task-coordinator after ln-310-multi-agent-validator.

## 5. Test Strategy

Test counts to be determined by ln-520-test-planner. Risk-Based Testing approach — prioritize critical paths (date query correctness, empty state handling).

## 6. Technical Notes

<!-- ORCHESTRATOR_BRIEF_START -->

- **Tech:** React 18, TypeScript, Dexie.js, Tailwind, Capacitor
- **Key Files:** `src/hooks/useOnThisDay.ts`, `src/components/OnThisDayCard.tsx`, `src/components/TemporalGhostLayer.tsx`, `src/storage/journalRepository.ts`
- **Approach:** Add [month+day] compound index to Dexie schema, create useOnThisDay hook, build carousel card component with ghost layer overlay
- **Complexity:** Medium (new Dexie index + carousel + ghost layers)
<!-- ORCHESTRATOR_BRIEF_END -->

### Architecture

- Dexie compound index `[month+day]` for O(1) date lookups across all years
- Cache daily results to avoid repeated IndexedDB queries
- `useOnThisDay` hook encapsulates query logic and caching
- `OnThisDayCard.tsx` — swipeable horizontal carousel component
- `TemporalGhostLayer.tsx` — semi-transparent overlay of other years' entries on full view

### Library Research (Standards)

- **Dexie compound index:** `db.entries.where('[month+day]').equals([m, d])` for same-date queries (see RSH-003 Section 1)
- **Carousel pattern:** Horizontal swipe with snap points, one card per year
- **Ghost layers:** CSS opacity + z-index for temporal overlay (see RSH-003 Section 6)

### Performance

- 60 FPS mandatory for ghost layer transitions (Law 8)
- `prefers-reduced-motion`: static fallback without animation
- Indexed Dexie query — no full table scan

### i18n

- All card labels, CTA text, and date formatting via `t()` across 8 languages
- RTL support for carousel swipe direction (ar, he)

## 7. Definition of Done

- [ ] All AC verified on iOS, Android, and Desktop
- [ ] Touch targets >= 44px
- [ ] Theme tokens only (zero hardcoded colors)
- [ ] i18n keys added for all 8 languages
- [ ] `prefers-reduced-motion` respected
- [ ] Android back handler closes expanded entry view
- [ ] Safe area insets respected
- [ ] No lint warnings, no TS errors

## 8. Dependencies

- None (first Story in Epic 3, independent)
- **Note:** Temporal ghost layers are enhancement — card works without them

## 9. Assumptions

- **DATA (MEDIUM):** Existing Dexie schema can be extended with compound index without data loss via migration chain
- **SCOPE (HIGH):** Ghost layers are visual-only (CSS opacity), not interactive beyond tap-to-read
- **FEASIBILITY (HIGH):** Swipeable carousel achievable with existing touch gesture patterns in the app

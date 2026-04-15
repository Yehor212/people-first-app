# EP3_US006: Constellation Journal — My Sky

**Status:** Backlog
**Epic:** Epic 3 — Memories, Nostalgia & Living Timeline
**Labels:** user-story
**Priority:** P1
**Complexity:** High
**Created:** 2026-04-14

---

## 1. Story

**As a** journal user,
**I want to** view all my entries as stars in a constellation field where position reflects my emotions,
**So that** I can see the beautiful patterns of my emotional journey over time.

## 2. Context

**Current Situation:** Entry history is presented as a flat chronological list. There is no spatial or visual representation of emotional patterns across entries. Users cannot see clusters, trends, or relationships between entries.

**Desired Outcome:** Constellation Journal renders 500+ entries at 60 FPS. Auto-naming produces meaningful cluster labels from 30+ entries. Users engage with "My Sky" as a discovery and reflection tool.

## 3. Acceptance Criteria

- **AC1:** Given user opens My Sky tab, Then entries appear as stars with X=valence, Y=arousal, brightness=word count, and color=dominant emotion from the 9-stop spectrum
- **AC2:** Given user has 30+ entries, When constellation renders, Then K-means clustering auto-names star clusters by recurring theme (most frequent nouns)
- **AC3:** Given user taps a star, Then entry preview card appears with date, mood, and first line of text
- **AC4:** Given user creates a new entry, When they return to My Sky, Then a shooting star animation plays landing at the new entry position
- **AC5:** Given user has 500+ entries, Then visualization renders at 60 FPS without performance degradation

## 4. Implementation Tasks

Tasks created via ln-300-task-coordinator after ln-310-multi-agent-validator.

## 5. Test Strategy

Test counts to be determined by ln-520-test-planner. Risk-Based Testing approach — prioritize rendering performance (60 FPS at 500+ entries), clustering accuracy, and touch interaction precision.

## 6. Technical Notes

<!-- ORCHESTRATOR_BRIEF_START -->

- **Tech:** React 18, TypeScript, WebGL/Canvas 2D, K-means
- **Key Files:** `src/components/ConstellationJournal.tsx`, `src/hooks/useConstellationData.ts`, `src/utils/clustering.ts`
- **Approach:** Build WebGL star field renderer, implement K-means clustering for theme detection, add tap interaction and shooting star animation
- **Complexity:** High (WebGL rendering + clustering algorithm + 60 FPS requirement)
<!-- ORCHESTRATOR_BRIEF_END -->

### Architecture

- WebGL or Canvas 2D for star field (WebGL preferred for 500+ entries)
- Star properties: X=valence, Y=arousal, brightness=word count, color=dominant emotion (9-stop spectrum)
- K-means clustering (lightweight JS implementation) for auto-naming clusters
- Cluster names derived from most frequent nouns in cluster entries
- Parallax field with slow rotation for depth effect
- Tap detection via spatial indexing (quadtree or grid)
- `ConstellationJournal.tsx` — main visualization component with "My Sky" tab
- `useConstellationData.ts` — data transformation and clustering hook
- `clustering.ts` — K-means implementation

### Library Research (Standards)

- **WebGL star field:** Point sprites for efficient star rendering at scale (see RSH-003 Section 6)
- **K-means:** Lightweight JS implementation — no heavy ML dependency needed for noun frequency clustering
- **Spatial indexing:** Quadtree for efficient tap-to-star hit detection

### Performance

- 60 FPS mandatory at 500+ entries (Law 8)
- Use `requestAnimationFrame` for render loop
- Spatial indexing for tap detection (avoid linear scan)
- `prefers-reduced-motion`: static star map without parallax/rotation/shooting star
- LOD: reduce star detail at high density

### i18n

- Cluster names use entry language nouns (not translated)
- Tab label, preview card labels via `t()` across 8 languages

## 7. Definition of Done

- [ ] All AC verified on iOS, Android, and Desktop
- [ ] 500+ entries render at 60 FPS (measured)
- [ ] K-means clustering produces meaningful cluster names from 30+ entries
- [ ] Shooting star animation plays for new entries
- [ ] Touch targets >= 44px for star tap detection
- [ ] Theme tokens only, safe area insets respected
- [ ] `prefers-reduced-motion` respected (static fallback)
- [ ] i18n keys for all 8 languages
- [ ] Android back handler exits My Sky tab

## 8. Dependencies

- **Optional:** Epic 7 (arousal data for Y-axis positioning) — fallback to random Y if unavailable

## 9. Assumptions

- **DEPENDENCY (MEDIUM):** Without Epic 7 arousal data, Y-axis uses a derived value (e.g., text sentiment intensity) or random — feature works but with less meaningful positioning
- **FEASIBILITY (HIGH):** WebGL/Canvas 2D can handle 500+ point sprites at 60 FPS on mobile devices
- **DATA (MEDIUM):** K-means on word frequency produces meaningful cluster labels — may need manual tuning of K value

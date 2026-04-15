# Epic 3: Memories, Nostalgia & Living Timeline

**Status:** Backlog
**Created:** 2026-04-14
**Source:** [Diary Deep Redesign Research](../../reference/research/2026-04-14-diary-deep-redesign.md)

---

## Goal

Create emotional connection to past entries through daily memory resurfacing, future-self letters, and annual retrospectives. Day One users report "On This Day" as the #1 reason they keep journaling long-term. Nostalgia is the strongest retention mechanism in journaling apps.

## Scope In

- **"On This Day" Memories** (Tier 1 — Critical): Daily resurfacing of entries from same date in previous years. Home screen card with preview text (140 chars) + mood + photo thumbnail. Swipeable carousel for multiple years. Push notification at user's journal time: "1 year ago today, you wrote..."
- **Time Capsule Entries** (Tier 2): Write letter to future self, entry locked until specified date. Lock icon + countdown timer visible. Notification on unlock day. Uses `isTimeCapsule` + `unlockDate` fields
- **Year in Review / "Journal Wrapped"** (Tier 2): Annual summary in Spotify-Wrapped-style swipeable story format. Content: mood graph, word cloud, entry count, streak stats, top themes, AI summary. Available from December 15, shareable image cards
- **Entry Sharing as Cards** (Tier 3): Select text → generate shareable image card with custom backgrounds/fonts matching diary themes. Direct share to Instagram Stories, WhatsApp

## Scope Out

- AI-generated summary text for Year in Review (Epic 4 provides AI capability)
- Map view of entries (deferred — Tier 3, low impact)
- Shared/social journal features (deferred — Tier 3, very high effort)
- Therapist export PDF (deferred — Tier 3)

## Success Criteria

- "On This Day" card engagement: 40%+ of users with eligible entries tap to view
- Push notification open rate > 15% for "On This Day" notifications
- Time capsule creation rate: 10%+ of active users create at least 1 capsule in first 90 days
- Year in Review completion rate: 60%+ of December users view full report
- Share card generation: 5%+ of entries shared as image cards
- Zero content leak: time capsule entries invisible until unlock date

## Dependencies

- IndexedDB query for same month-day across years (Dexie date index)
- Capacitor Push Notifications (for On This Day + time capsule unlock)
- Canvas API or html2canvas for shareable image card generation
- Epic 4 (AI) for Year in Review summary generation (can launch without, using stats-only)

## Risks & Mitigations

| Risk                                                 | Impact | Mitigation                                                               |
| ---------------------------------------------------- | ------ | ------------------------------------------------------------------------ |
| Users with < 1 year of entries see empty On This Day | High   | Don't show card when no entries. Show "Start today's memory" CTA instead |
| Time capsule unlock notification missed              | Medium | In-app banner on next open + notification retry                          |
| Year in Review feels generic without AI              | Medium | Stats-only version is still valuable. AI summary as enhancement          |
| Share card could leak private content                | Medium | Explicit user action to share, watermark option, no auto-sharing         |
| Performance: querying all historical entries         | Low    | Indexed Dexie query on date field, cache On This Day results daily       |

## Architecture Impact

- **New Components**: `OnThisDayCard.tsx`, `TimeCapsuleEditor.tsx`, `TimeCapsuleLock.tsx`, `YearInReview.tsx` (story-format), `ShareCardGenerator.tsx`
- **New Hooks**: `useOnThisDay.ts`, `useTimeCapsule.ts`
- **Modified**: `JournalModule.tsx` (On This Day card placement), `JournalEntryEditor.tsx` (time capsule option), `types.ts` (`isTimeCapsule`, `unlockDate` fields)
- **Push Notifications**: On This Day daily, time capsule unlock trigger

## Phases

1. On This Day query logic + `useOnThisDay` hook
2. OnThisDayCard component on diary home (carousel for multi-year)
3. Push notification for On This Day (Capacitor)
4. Time capsule fields on entry + lock/unlock logic
5. TimeCapsuleLock UI (countdown, notification on unlock)
6. Year in Review data aggregation (stats-only MVP)
7. Year in Review story-format swipeable UI
8. Share card generator (canvas rendering + native share)
9. i18n for all 8 languages

---

## Revolution Enhancement — Living Timeline (Source: diary-revolution.md)

### Additional Scope In

- **Constellation Journal** (Revolution — Tier 1): Each entry = a star. Position: X = valence, Y = arousal. Brightness = word count. Color = dominant emotion (orb's 9-stop spectrum). Over time, entries cluster into constellations. System auto-names clusters by recurring theme (K-means + most frequent nouns). "My Sky" tab with parallax field, slow rotation. Tap star = entry preview. New entry = shooting star
- **Emotion Sediment** (Revolution — Tier 2): Each day's entry adds a thin horizontal color band to a growing vertical painting — geological strata of emotional history. Color = mood. Thickness = word count. Texture = emotional volatility (Perlin noise). Scrollable "Emotional Core" in stats. Long-press band → date + mood. Export as print-ready PNG
- **Growth Rings** (Revolution — Tier 2): Each month = ring in tree cross-section. Thickness = entry count. Color = avg mood. Texture = volatility (smooth = consistent, cracked = volatile). Dendrochronology of emotional year
- **Emotional River** (Revolution — Tier 3): Timeline as flowing river. Width = intensity. Color = mood. Turbulence = volatility. Branches = topic threads. Zoom year → day by pinching
- **"On This Day" Temporal Layers** (Revolution — Tier 2): Old entries show ghost-layers from same date in other years. Semi-transparent overlapping strata. Like geological time visible through the present. Tap ghost to read that year's entry

### Additional Success Criteria

- Constellation Journal renders 500+ entries at 60 FPS (Canvas/WebGL)
- Emotion Sediment export generates print-ready PNG < 3 seconds
- Growth Rings visualization covers full year without performance degradation
- Constellation auto-naming produces meaningful cluster labels from 30+ entries
- Emotional River zoom transitions smooth at 60 FPS (pinch-to-zoom)

### Additional Architecture Impact

- **New Components**: `ConstellationJournal.tsx`, `EmotionSediment.tsx`, `GrowthRings.tsx`, `EmotionalRiver.tsx`, `TemporalGhostLayer.tsx`
- **Extend**: EmotionGalaxy star field for constellation view, K-means clustering
- **Dependencies**: Epic 7 (arousal data for Y-axis positioning, glyph data for star rendering)

### Additional Phases

10. Constellation Journal (extend EmotionGalaxy + K-means clustering + "My Sky" tab)
11. Emotion Sediment (canvas painting + Perlin noise texture + export PNG)
12. Growth Rings (SVG tree cross-section + monthly aggregation)
13. Emotional River (flowing timeline canvas + pinch-to-zoom)
14. "On This Day" temporal ghost-layers (semi-transparent overlay on existing OnThisDayCard)

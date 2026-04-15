# EP8_US006: Weather Report Badge

**Epic:** [Epic 8: Emotional Canvas](../../epic.md)
**Status:** Backlog
**Priority:** P2
**Complexity:** Low
**Created:** 2026-04-14

---

## Goal

After saving a diary entry, show a weather summary badge on the entry card (e.g., "Partly cloudy with moments of sunshine") so the user can see at a glance how a past writing session felt — adding an emotional dimension to the diary list without opening the entry.

## Acceptance Criteria

### AC1: Badge Display

- [ ] A weather badge appears on the entry card in the diary list after saving an entry with weather data
- [ ] Badge shows a short weather description (e.g., "Stormy with clearing", "Sunny and breezy")
- [ ] Badge includes a small weather icon matching the dominant weather state

### AC2: Deterministic Generation

- [ ] Badge text is deterministically generated from entry sentiment data (same data always produces same text)
- [ ] Weather description uses the dominant weather state + most significant transition
- [ ] Badge text is generated via `weatherTextGenerator` utility (not AI/random)

### AC3: Edge Cases

- [ ] Entries without weather data (pre-feature, toggle off) show no badge (no error, no empty space)
- [ ] Very short entries (< 10 words) show "Brief and calm" or similar neutral badge
- [ ] Badge text works in all 8 supported languages (i18n keys via t())

## Test Strategy

(Planned separately by test planner)

## Technical Notes

### Affected Components

- `src/components/diary/WeatherBadge.tsx` — NEW: badge component for entry cards
- `src/utils/weatherTextGenerator.ts` — NEW: deterministic weather report from sentiment data
- `JournalEntryCard.tsx` — MODIFIED: render WeatherBadge when weather data exists

### Architecture Decisions

- Deterministic text generation (not AI) — same sentiment data always produces identical badge text
- Weather state stored with entry during save (from US003) — badge reads stored data, no recalculation
- i18n: weather descriptions use translation keys, not hardcoded English strings

### orchestratorBrief

```
tech: "React, TypeScript, i18n"
keyFiles: "src/components/diary/WeatherBadge.tsx, src/utils/weatherTextGenerator.ts, JournalEntryCard.tsx"
approach: "Deterministic text generator maps stored weather state data to human-readable weather descriptions with i18n support"
complexity: "Low (text mapping + component + i18n keys)"
```

### Dependencies

- **EP8_US003** — weather state data stored with entry (consumed as input for badge generation)

### Risks

- i18n: weather metaphors may not translate well across 8 languages — need native speaker review
- Badge must not increase entry card height significantly (inline or compact layout)

## Context

The Weather Report Badge is the **visible artifact** of the Emotional Canvas on the diary list screen. Without it, the emotional canvas features are only visible during active writing. The badge gives entries an emotional summary that's browsable at a glance.

**Dependency chain:** US003 → US006 (this). Independent of US004, US005.

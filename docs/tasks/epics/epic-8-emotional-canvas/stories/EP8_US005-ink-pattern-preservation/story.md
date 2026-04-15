# EP8_US005: Ink Pattern Preservation & Replay

**Epic:** [Epic 8: Emotional Canvas](../../epic.md)
**Status:** Backlog
**Priority:** P1
**Complexity:** Medium
**Created:** 2026-04-14

---

## Goal

Preserve the ink painting created during writing so that when the user reopens a past diary entry, the ink pattern replays as a 1.5-second animation — letting them relive the emotional arc of their past writing session visually.

## Acceptance Criteria

### AC1: Ink Data Persistence

- [ ] Ink drop data (position, color, size, timestamp) is saved alongside the diary entry in IndexedDB
- [ ] Ink data format is versioned (`{ version: 1, drops: [...] }`) for future extensibility
- [ ] Saving ink data does not noticeably delay the entry save operation (< 50ms overhead)

### AC2: Ink Replay Animation

- [ ] Opening a past entry with ink data triggers a 1.5-second replay animation
- [ ] Replay shows ink drops appearing in chronological order (compressed from original timing)
- [ ] After replay completes, the final ink pattern remains visible as a static overlay

### AC3: Cross-Texture Compatibility

- [ ] Ink replay renders correctly over all 6 existing paper textures
- [ ] Ink pattern opacity is consistent across light and dark themes
- [ ] Entries without ink data (pre-feature or toggle off) show normal paper with no error

### AC4: Storage Efficiency

- [ ] Ink data for a typical 200-word entry is under 10KB in IndexedDB
- [ ] Entries with 500+ words use drop merging to keep data under 25KB
- [ ] Ink data is included in data export/import round-trips

## Test Strategy

(Planned separately by test planner)

## Technical Notes

### Affected Components

- `src/components/diary/LivingInkCanvas.tsx` — MODIFIED: add replay mode (read from stored data)
- `src/hooks/useLivingInk.ts` — MODIFIED: add serialization/deserialization of ink drop data
- `JournalEntryCard.tsx` — NOT modified (replay only in full editor view)
- Dexie schema — MODIFIED: add `inkData` field to journal entries table (versioned migration)

### Architecture Decisions

- Store ink drops as compact JSON array (position, color index, size — not full RGBA bitmaps)
- Replay via requestAnimationFrame with compressed timing (original 5-min session → 1.5s)
- Drop merging for large entries: nearby same-color drops → single larger drop (lossy but visually equivalent)

### orchestratorBrief

```
tech: "React, Canvas 2D, Dexie/IndexedDB, TypeScript"
keyFiles: "src/components/diary/LivingInkCanvas.tsx, src/hooks/useLivingInk.ts, Dexie schema"
approach: "Serialize ink drop array to IndexedDB with entry, deserialize and replay via compressed rAF timeline on entry open"
complexity: "Medium (serialization format + Dexie migration + replay animation timing)"
```

### Dependencies

- **EP8_US001** — ink drop data structure and Canvas rendering

### Risks

- Dexie schema migration must preserve all existing entries (test upgrade path)
- Large entries could produce oversized ink data — drop merging algorithm needed
- Ink replay must share rAF with any active canvas animations without conflict

## Context

Ink preservation turns a transient writing experience into a permanent artifact. Without this story, ink is ephemeral — beautiful while typing but lost on save. The replay animation is the "wow moment" when revisiting old entries.

**Dependency chain:** US001 → US005 (this). Independent of weather features (US003/US004/US006).

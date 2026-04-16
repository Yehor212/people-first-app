# T2: Create MoodDotStrip with Virtualized Rendering

**Story:** [EP10_US002 — Compact Sidebar: Mood Dot Strip](../story.md)
**Type:** Implementation
**Status:** Todo
**Priority:** P0
**Estimate:** 4h
**Parallel Group:** 1

---

## Goal

Create the MoodDotStrip component — a vertical list of mood emoji dots (one per entry) with lightweight virtualization for performance with 50+ entries.

## Acceptance Criteria

- [ ] Each entry renders as w-8 h-8 rounded-full mood emoji dot — `verify: inspect (dot element dimensions)`
- [ ] Entries without mood show Bookmark icon (same pattern as JournalEntryCard) — `verify: inspect (fallback icon)`
- [ ] Dots ordered chronologically (newest first) — `verify: inspect (sort order matches JournalEntryList)`
- [ ] Max 7 dots visible without scrolling, rest via vertical scroll — `verify: inspect (overflow-y-auto on container)`
- [ ] Virtualization: only viewport dots + 5 buffer rendered — `verify: inspect (IntersectionObserver or slice logic)`

### Affected Components

- `src/features/journal/MoodDotStrip.tsx` — NEW
- `src/features/journal/SidebarCompact.tsx` — render MoodDotStrip in body

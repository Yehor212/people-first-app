# EP10_US002: Compact Sidebar — Mood Dot Strip

**Epic:** [Epic 10: Three-State Sidebar](../../epic.md)
**Status:** To Review
**Priority:** P0
**Complexity:** High
**Created:** 2026-04-15

---

## Goal

Build the compact sidebar (48px wide) with a vertical strip of mood emoji dots — one per diary entry — enabling quick visual scanning and entry navigation without the full expanded list.

## Acceptance Criteria

### AC1: Mood Dot Rendering

- [ ] Each diary entry renders as a mood emoji dot (w-8 h-8 rounded-full) in a vertical strip
- [ ] Entries without mood show a bookmark icon (consistent with JournalEntryCard pattern)
- [ ] Dots are ordered chronologically (newest first, matching expanded list order)
- [ ] Maximum 7 dots visible without scrolling; remaining dots accessible via vertical scroll

### AC2: Tooltip on Hover

- [ ] Hovering a mood dot shows tooltip with entry title + relative time (e.g., "Morning thoughts · 2h ago")
- [ ] Tooltip appears after 300ms delay (no flicker on mouse movement)
- [ ] Tooltip positioned to the right of dot (LTR) or left (RTL)

### AC3: Click-to-Open

- [ ] Clicking a mood dot opens that entry in the editor panel (right side)
- [ ] Active/selected entry has a highlighted ring in the entry's mood color
- [ ] Clicking already-active dot has no effect (no re-render)

### AC4: Scroll & Virtualization

- [ ] Mood dot list scrolls vertically when entries exceed visible area
- [ ] Only viewport-visible dots + 5 buffer are rendered (virtualized for 50+ entries)
- [ ] Scroll position resets to top when new entry is created

### AC5: Reduced Motion & A11y

- [ ] All dots render without animation when `prefers-reduced-motion` is enabled
- [ ] Each dot has `aria-label` with entry title and mood
- [ ] Keyboard navigation: `↑`/`↓` moves between dots, `Enter` opens entry

## Technical Notes

### Affected Components

- `src/features/journal/SidebarCompact.tsx` — NEW component
- `src/features/journal/MoodDotStrip.tsx` — NEW component (virtualized dot list)
- `src/features/journal/JournalModule.tsx` — render SidebarCompact when `sidebarState === "compact"`

### Architecture

SidebarCompact is a fixed 48px div rendered independently of PanelLayout. MoodDotStrip uses a lightweight virtualization approach (IntersectionObserver or manual viewport calculation — avoid adding react-virtuoso dependency).

### Dependencies

- EP10_US001 (sidebar state hook provides `isCompact` flag)

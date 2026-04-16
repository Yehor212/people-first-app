# EP10_US005: Mood Dot ↔ Card Morph (layoutId)

**Epic:** [Epic 10: Three-State Sidebar](../../epic.md)
**Status:** To Review
**Priority:** P2
**Complexity:** High
**Created:** 2026-04-15

---

## Goal

Use framer-motion `layoutId` to morph mood emoji dots into full entry cards (and vice versa) during sidebar expand/collapse, creating a connected visual transition that makes the UI feel like a single living surface.

## Acceptance Criteria

### AC1: Mood Dot → Card Morph on Expand

- [ ] When sidebar expands from compact to expanded, each visible mood dot morphs into its corresponding entry card
- [ ] Morph uses spring physics from `springPresets.quick` (stiffness: 300, damping: 25)
- [ ] Mood circle maintains its emoji content throughout the morph
- [ ] Cards that were not visible as dots (scrolled off) appear with standard stagger (no morph)

### AC2: Card → Mood Dot Morph on Collapse

- [ ] When sidebar collapses from expanded to compact, each visible entry card morphs into its mood dot
- [ ] Card text fades out before morph begins (choreographed with US004)
- [ ] Morph settles mood dots into their correct vertical positions in the compact strip

### AC3: layoutId Coordination

- [ ] Each mood circle in JournalEntryCard gets `layoutId={`mood-${entry.id}`}`
- [ ] Each mood dot in MoodDotStrip gets matching `layoutId={`mood-${entry.id}`}`
- [ ] Only one instance of each layoutId exists at a time (AnimatePresence manages unmount/mount)
- [ ] LayoutGroup wraps both sidebar states for coordination

### AC4: Edge Cases & Performance

- [ ] Rapid toggle (expand→collapse→expand in < 500ms): no duplicate layoutId errors
- [ ] Entries with no mood (bookmark icon): morph works with bookmark icon too
- [ ] 50+ entries: only viewport-visible entries morph (off-screen entries skip morph)
- [ ] `prefers-reduced-motion`: no morph, instant switch between states

## Technical Notes

### Affected Components

- `src/features/journal/JournalEntryCard.tsx` — add `layoutId` to mood circle
- `src/features/journal/MoodDotStrip.tsx` — add matching `layoutId` to each dot
- `src/features/journal/JournalModule.tsx` — wrap with `LayoutGroup`

### Architecture

framer-motion `layoutId` creates automatic FLIP animations between components sharing the same ID. When the sidebar state changes, AnimatePresence unmounts one sidebar variant and mounts the other — layoutId elements morph between their positions automatically.

Key constraint: only ONE element with a given layoutId can exist at a time. Use `AnimatePresence mode="wait"` to ensure old state unmounts before new state mounts.

### Dependencies

- EP10_US002 (MoodDotStrip component)
- EP10_US004 (animation choreography coordinates with morph timing)

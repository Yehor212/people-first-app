# EP11_US003: Mood Circle Morph to Editor Header

**Epic:** [Epic 11: Shared-Element Transitions](../../epic.md)
**Status:** Backlog
**Priority:** P1
**Complexity:** High
**Created:** 2026-04-15

---

## Goal

Make the mood emoji circle smoothly travel from its position in the entry card (sidebar) to the editor header during the card→editor morph, preserving mood context visually throughout the transition.

## Acceptance Criteria

### AC1: Mood Circle layoutId

- [ ] Mood circle in JournalEntryCard has `layoutId={`mood-${entry.id}`}`
- [ ] Mood circle in JournalEntryEditor header has matching `layoutId={`mood-${activeEntryId}`}`
- [ ] Circle morphs from card position (left side, w-10 h-10) to editor header position
- [ ] Emoji content remains visible throughout the morph (no flash/flicker)

### AC2: Morph Timing

- [ ] Mood morph runs concurrently with card→editor morph (US002)
- [ ] Mood circle arrives at editor position ~50ms after card wrapper settles
- [ ] Spring: `springPresets.quick` (stiffness: 300, damping: 25)

### AC3: Editor Mood Integration

- [ ] After morph settles, mood circle in editor becomes interactive (tap to change mood)
- [ ] Editor background shifts to mood-ambient gradient (mood color at 5% opacity)
- [ ] Gradient transition uses 300ms ease

### AC4: Edge Cases

- [ ] Entries without mood: bookmark icon morphs instead of emoji
- [ ] Rapid entry switching: mood circle snaps to new position without completing previous morph
- [ ] Compact sidebar → editor: mood dot (8px) morphs and scales up to editor header circle (10px)
- [ ] `prefers-reduced-motion`: no morph, mood appears instantly in editor header

## Technical Notes

### Affected Components

- `src/features/journal/JournalEntryCard.tsx` — `layoutId` on mood circle div
- `src/features/journal/JournalEntryEditor.tsx` — add mood circle with matching `layoutId` in header
- `src/features/journal/MoodDotStrip.tsx` — `layoutId` on compact mode dots (for compact→editor morph)

### Dependencies

- EP11_US002 (card→editor morph provides the LayoutGroup context)
- EP10_US005 (mood dot layoutId in compact mode — shares the same ID namespace)

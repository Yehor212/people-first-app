# EP11_US002: Card→Editor Layout Morph

**Epic:** [Epic 11: Shared-Element Transitions](../../epic.md)
**Status:** Backlog
**Priority:** P0
**Complexity:** High
**Created:** 2026-04-15

---

## Goal

Implement the core shared-element transition where the entry card in the sidebar morphs into the editor panel using framer-motion `layoutId`, creating visual continuity that no journal app in the industry currently offers.

## Acceptance Criteria

### AC1: Forward Morph (Card → Editor)

- [ ] Entry card wrapper has `layoutId={`entry-${entry.id}`}`
- [ ] Editor wrapper has matching `layoutId={`entry-${activeEntryId}`}`
- [ ] On entry selection, card morphs from sidebar position to editor panel position (400ms spring)
- [ ] Morph uses `springPresets.smooth` (stiffness: 260, damping: 25)
- [ ] Editor content (text, toolbar) fades in AFTER morph completes (via `onLayoutAnimationComplete`)

### AC2: AnimatePresence Setup

- [ ] `LayoutGroup` wraps both sidebar and editor panels in JournalModule
- [ ] `AnimatePresence mode="popLayout"` handles entry switching without unmount gap
- [ ] Switching between entries morphs directly (card A → card B) without reverting to list first

### AC3: Sidebar State Awareness

- [ ] Morph origin adapts: full card when sidebar expanded, mood dot when sidebar compact
- [ ] When sidebar hidden: no morph, editor content fades in directly
- [ ] Morph works correctly across the ResizeHandle boundary

### AC4: Performance

- [ ] Morph at 60fps constant (FLIP technique via CSS transforms)
- [ ] No layout reflow during morph (use `layout="position"` on inner elements)
- [ ] Editor content deferred until morph settles (prevents jank from heavy content render)
- [ ] Bundle impact < 1KB gzip (reuse existing framer-motion)

### AC5: Reduced Motion

- [ ] `prefers-reduced-motion`: instant cut, no morph animation
- [ ] Editor appears immediately with content visible

## Technical Notes

### Affected Components

- `src/features/journal/JournalEntryCard.tsx` — add `layoutId` to card wrapper
- `src/features/journal/JournalEntryEditor.tsx` — add matching `layoutId` on outer wrapper
- `src/features/journal/JournalModule.tsx` — wrap with `LayoutGroup`, configure `AnimatePresence`
- `src/features/journal/SharedMorphLayer.tsx` — NEW: portal layer if needed to escape panel DOM

### Architecture

The morph uses framer-motion's FLIP technique: when layoutId changes DOM position, framer-motion measures start/end geometry and animates using CSS transforms. The key challenge is crossing the ResizeHandle boundary — may require a portal layer that renders the morphing element at the document body level during transition.

### Dependencies

- EP11_US001 (card lift effect triggers before morph)
- Epic 10 US001 (sidebar state determines morph origin)

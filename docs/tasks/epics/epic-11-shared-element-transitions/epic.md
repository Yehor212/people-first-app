# Epic 11: Shared-Element Transitions

**Status:** Backlog
**Priority:** P1
**Created:** 2026-04-15
**Source:** [Diary Section Revolution](../../reference/research/2026-04-15-diary-section-revolution.md)

---

## Goal

Implement shared-element card→editor morph transitions using framer-motion `layoutId`, creating visual continuity when navigating between entry list and editor on desktop — a transition pattern no journal app in the industry currently offers.

## Scope

### In Scope

- Card lift effect on selection: z-index + shadow increase, sibling cards dim to 60% opacity (100ms)
- Card→editor morph via `layoutId` on wrapper div (400ms spring)
- Mood circle morph from card sidebar position to editor header position
- Reverse animation on back/close: editor shrinks to card, siblings restore
- Mood-ambient gradient shift in editor background on entry open
- Content fade-in with typewriter stagger on entry load
- `AnimatePresence mode="popLayout"` for seamless cross-fade between entries
- Fallback: `prefers-reduced-motion` = instant cut, no morph
- Works with all three sidebar states (expanded, compact, hidden)

### Out of Scope

- Mobile transitions (full-screen modal, different pattern)
- Sidebar collapse/expand animations (Epic 10)
- Writing momentum / flow state animations (Epic 8)
- Photo hero banner morph (complex, defer to future)

## Success Criteria

- Card→editor morph at 60fps constant, < 400ms total duration
- Reverse morph (editor→card) at 60fps, < 300ms
- No flicker on rapid entry switching (debounce 100ms on entry selection)
- Reduced-motion: instant cut with no visible morph
- Works correctly when switching between entries without going back to list
- Morph origin adapts to sidebar state: full card in expanded, mood dot in compact

## Dependencies

- **Epic 10** — sidebar states affect morph origin (card vs mood dot)
- `src/config/animations.ts` — spring presets (from Epic 6 US001)
- framer-motion `layoutId`, `AnimatePresence`, `layout` prop

## Risks & Mitigations

| Risk | Impact | Mitigation |
|------|--------|------------|
| layoutId flicker on fast navigation | High | Debounce entry selection (100ms), preload target layout dimensions |
| react-resizable-panels conflicts with layout animations | Medium | Use portal layer for morph animation, render outside panel DOM |
| Large entry content causes morph stutter | Medium | Defer content render until morph settles (onAnimationComplete callback) |
| Editor re-mount on entry switch kills morph | Medium | Keep editor mounted, swap content via key prop, not unmount/remount |

## Architecture Impact

### New Components

- `SharedMorphLayer.tsx` — portal-based overlay layer for card→editor morph
- `useEntryTransition.ts` — hook managing morph state, debounce, animation callbacks

### Modified Components

- `JournalModule.tsx` — wrap editor/list in LayoutGroup, add SharedMorphLayer
- `JournalEntryCard.tsx` — add `layoutId={`entry-${entry.id}`}` to card wrapper, add `layoutId={`mood-${entry.id}`}` to mood circle
- `JournalEntryEditor.tsx` — add matching `layoutId` on wrapper and mood circle, add `onAnimationComplete` for content reveal
- `JournalEntryList.tsx` — manage sibling dim state via context

### Technical Approach

```
// LayoutGroup wraps both sidebar and editor panels
// Card wrapper: <motion.div layoutId={`entry-${entry.id}`}>
// Editor wrapper: <motion.div layoutId={`entry-${activeId}`}>
// AnimatePresence mode="popLayout" handles exit/enter overlap

// Sibling dim: when an entry is selected, other cards get
// animate={{ opacity: 0.6 }} with spring transition

// Content reveal: editor content starts at opacity 0,
// fades in via onLayoutAnimationComplete callback
```

## Phases

1. **Foundation:** LayoutGroup setup, layoutId on cards + editor, AnimatePresence
2. **Card morph:** Lift effect, sibling dim, card→editor transition
3. **Mood morph:** Mood circle follows from card to editor header
4. **Reverse + polish:** Back animation, rapid switching, reduced-motion, edge cases

# Epic 10: Three-State Sidebar

**Status:** Backlog
**Priority:** P0
**Created:** 2026-04-15
**Source:** [Diary Section Revolution](../../reference/research/2026-04-15-diary-section-revolution.md)

---

## Goal

Transform the diary sidebar from binary (expanded/hidden) into a three-state model (Expanded 340px → Compact 48px icon-only → Hidden 0px) with mood-dot morphing, animated choreography, and keyboard shortcuts — delivering Bear/Notion-level sidebar UX with mood-aware journal identity.

## Scope

### In Scope

- Three-state sidebar model (`expanded | compact | hidden`)
- Compact mode: 48px icon strip with mood emoji dots per entry, tooltips on hover, click-to-open
- Animated collapse/expand choreography:
  - Content fade + scale on collapse (calendar, card text)
  - Mood dot ↔ card morph via framer-motion `layoutId`
  - Spring physics for panel width transitions
  - Staggered icon settle in compact mode
- Keyboard shortcuts: `Ctrl+\` / `⌘\` toggle expanded↔compact, `Ctrl+Shift+\` compact↔hidden, `↑↓` navigate entries, `Enter` open
- Persist sidebar state per mode (localStorage via `storageSetRaw`)
- A11y: `aria-expanded`, focus management on expand, `prefers-reduced-motion` disables all animation
- Header icons in compact mode: Diary (📓), Stats (📊), Settings (⚙️) stacked vertically
- Active entry highlight: ring around mood dot matching accent color
- New entry "+" icon at bottom of compact strip

### Out of Scope

- Card→editor shared-element morph (Epic 11)
- Entry card hover/press micro-interactions beyond current (Epic 6)
- Editor writing momentum / flow state (Epic 8)
- Mobile layout changes (mobile uses full-screen flow, unaffected)

## Success Criteria

- Sidebar collapse/expand completes in < 350ms at 60fps constant
- Compact mode is fully functional: all entries navigable via mood dots + tooltips
- Keyboard shortcut `Ctrl+\` toggles state in < 100ms response time
- Zero layout shift during transitions (GPU-only: transform + opacity)
- State persists across sessions and app restarts
- Works correctly in both LTR and RTL layouts (Arabic, Hebrew)
- `prefers-reduced-motion`: instant state change, no animation

## Dependencies

- `src/config/animations.ts` — spring presets, stagger config (from Epic 6 US001, already created)
- `react-resizable-panels` — existing PanelLayout infrastructure
- framer-motion `layoutId` — for mood dot morphing

## Risks & Mitigations

| Risk | Impact | Mitigation |
|------|--------|------------|
| Three-state adds complexity to PanelLayout | Medium | Compact state lives OUTSIDE react-resizable-panels as separate fixed 48px div; PanelLayout only handles expanded↔hidden |
| Mood dot list jank with 50+ entries | Medium | Virtualize mood dot list (only render viewport-visible dots + 5 buffer) |
| layoutId morph flicker during rapid toggle | Low | Debounce toggle (100ms), use `AnimatePresence mode="wait"` |
| Compact mode unusable without mood data | Low | Entries without mood show bookmark icon (existing pattern from JournalEntryCard) |

## Architecture Impact

### New Components

- `SidebarCompact.tsx` — 48px icon-only sidebar with mood dot strip
- `MoodDotStrip.tsx` — virtualized vertical list of mood dots with tooltips
- `useSidebarState.ts` — three-state hook (`expanded | compact | hidden`) with keyboard shortcuts

### Modified Components

- `JournalModule.tsx` — orchestrate three states, render SidebarCompact when compact
- `JournalEntryCard.tsx` — add `layoutId={`mood-${entry.id}`}` to mood circle
- `JournalEntryList.tsx` — pass layoutId-compatible mood circles

### Technical Approach

```
// Three-state model
type SidebarState = "expanded" | "compact" | "hidden";

// Compact mode renders OUTSIDE PanelLayout:
// - PanelLayout handles expanded (30%) ↔ hidden (0%)
// - SidebarCompact is a fixed 48px div, shown when state === "compact"
// - Transition: expanded → compact uses framer-motion layout animation
//   on mood circles (layoutId per entry)

// Keyboard: useEffect with keydown listener
// Ctrl+\ → cycle expanded→compact→hidden→expanded
```

## Phases

1. **Foundation:** `useSidebarState` hook + three-state logic + keyboard shortcuts
2. **Compact UI:** `SidebarCompact` + `MoodDotStrip` components
3. **Animation:** Collapse choreography, mood dot morphing, spring physics
4. **Polish:** RTL, a11y, reduced-motion, edge cases (0 entries, no mood)

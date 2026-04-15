# EP6_US009: Page Transitions & Shared Element Animation

**Status:** Backlog
**Epic:** 6 — Telegram-Level Polish
**Priority:** P3
**INVEST Score:** 5/6 (Negotiable: View Transitions API scope is flexible)

---

## User Story

As a **diary user**, I want smooth page transitions when navigating between diary sections, so that the app feels like a native experience rather than instant page swaps.

## Description

Navigation between diary sub-sections (list, calendar, stats, editor) currently uses instant swaps. This story adds polished transitions:

1. **Shared element expand** — tapping an entry card morphs into the detail/editor view.
2. **Scale-from-FAB** — new entry creation scales out from the floating action button.
3. **Crossfade** — switching between list/calendar/stats sub-tabs uses crossfade.
4. **Progressive enhancement** — use View Transitions API where supported (~92% browsers in 2026), fallback to Framer Motion AnimatePresence.

**Zero visual regression constraint:** All transitions use progressive enhancement. If View Transitions API unavailable, Framer Motion crossfade. If `shouldAnimate()` is false, instant swap (current behavior).

## Acceptance Criteria

1. **Given** I tap a journal entry card, **When** the detail view opens, **Then** a shared element expand animation plays (card morphs into full view) using Framer Motion `layoutId`.
2. **Given** I tap the FAB to create a new entry, **When** the editor opens, **Then** a scale-from-FAB transition plays (spring stiffness 300, damping 25).
3. **Given** I switch between diary sub-sections (list/calendar/stats), **When** the view switches, **Then** a crossfade transition plays (200ms).
4. **Given** the browser doesn't support View Transitions API, **Then** fallback to Framer Motion `AnimatePresence` crossfade without errors.

## Technical Notes

**Standards Research:** [RSH-001](../../../research/rsh-001-telegram-polish-standards.md) — section 9 (View Transitions API)

- Shared element: Framer Motion `layoutId` on JournalEntryCard container and JournalEntryViewer/Editor container. The `layoutId` must match exactly for the morph to work. Use a stable identifier (entry ID).
- Scale-from-FAB: capture FAB position via ref, animate editor from that origin point. `initial={{ scale: 0, opacity: 0, transformOrigin: "bottom right" }}`, `animate={{ scale: 1, opacity: 1 }}`.
- Crossfade: `AnimatePresence mode="wait"` wrapping the active sub-tab. `initial={{ opacity: 0 }}`, `animate={{ opacity: 1 }}`, `exit={{ opacity: 0 }}`, `transition={{ duration: 0.2 }}`.
- View Transitions API: wrap route changes in `document.startViewTransition(() => { /* state update */ })` with feature detection. CSS `::view-transition-old/new` for customizing the animation.
- Performance: `layoutId` transitions are GPU-composited by Framer Motion. No layout thrashing.
- Gate: `shouldAnimate()` — if false, all transitions are instant swaps.

**Files:** `JournalModule.tsx` (orchestrator — sub-tab switching), `JournalEntryCard.tsx` (layoutId source), `JournalEntryViewer.tsx` (layoutId target), `JournalEntryEditor.tsx` (FAB origin)

## Dependencies

- No hard dependencies. Recommended after US001-US008 are stable.

## Test Strategy

_(Planned by test planner)_

## Orchestrator Brief

```
tech: "React, Framer Motion (layoutId), View Transitions API"
keyFiles: ["JournalModule.tsx", "JournalEntryCard.tsx", "JournalEntryViewer.tsx"]
approach: "layoutId shared element + AnimatePresence crossfade + View Transitions API progressive enhancement"
complexity: "High (shared element across components + progressive API enhancement)"
```

## Definition of Done

- [ ] Card -> detail shared element transition works
- [ ] FAB -> editor scale transition works
- [ ] Sub-tab crossfade plays on switch
- [ ] View Transitions API used where supported, Framer Motion fallback elsewhere
- [ ] `shouldAnimate()` false = instant swap
- [ ] 60 FPS, no TS errors, tests pass

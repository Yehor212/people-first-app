# EP6_US007: Editor Floating Formatting Toolbar

**Status:** Done
**Epic:** 6 — Telegram-Level Polish
**Priority:** P2
**INVEST Score:** 6/6

---

## User Story

As a **diary user**, I want a floating toolbar to appear when I select text, so that I can format my journal entries quickly without leaving my writing flow.

## Description

The JournalEntryEditor has a DiaryFormatToolbar at the bottom, but lacks the Telegram-style floating toolbar that appears directly above text selection. This story adds:

1. **Floating toolbar** that positions above the current text selection with fade+slide entrance.
2. **Formatting actions** — bold, italic, link insertion.
3. **Markdown shortcuts** — auto-convert `**text**` to bold, etc.
4. **Dismiss behavior** — immediate on scroll, fade on tap-outside.

**Zero visual regression constraint:** Existing DiaryFormatToolbar at bottom remains. Floating toolbar is an additional UX layer. If floating toolbar fails to position, the bottom toolbar is always available as fallback.

## Acceptance Criteria

1. **Given** I select text in the journal editor, **When** the selection stabilizes (~100ms debounce), **Then** a floating toolbar appears above the selection (150ms fade + translateY 8->0) with format options.
2. **Given** the toolbar is visible, **When** I scroll or tap outside, **Then** it dismisses (immediate on scroll, 100ms fade on tap-outside).
3. **Given** I tap a formatting option, **When** the format applies, **Then** the selected text updates and a light haptic confirms.
4. **Given** I type a markdown shortcut (e.g. `**text**`), **When** the pattern is recognized, **Then** it auto-converts to formatted text with subtle visual feedback.

## Technical Notes

**Standards Research:** [RSH-001](../../../research/rsh-001-telegram-polish-standards.md) — section 8 (Floating Toolbar)

- Positioning: use `window.getSelection().getRangeAt(0).getBoundingClientRect()` to get selection coordinates. Position toolbar above selection with 8px gap. Clamp to viewport bounds.
- Entrance: Framer Motion `initial={{ opacity: 0, y: 8 }}`, `animate={{ opacity: 1, y: 0 }}`, `transition={{ duration: 0.15 }}`.
- Dismiss: `scroll` event listener = immediate unmount (no animation). Click-outside = 100ms exit animation.
- Reposition: on selection change, spring to new position (60ms delay per research).
- Markdown shortcuts: detect patterns on input event. `**...**` -> bold, `*...*` -> italic, `[text](url)` -> link. Apply formatting, remove markdown syntax.
- Haptic: `hapticTap()` on format action.
- Z-index: use z-[80] (above modals per project rules for floating UI).
- Portal: render via `createPortal(toolbar, document.body)` to escape any transform ancestors.

**Files:** `JournalEntryEditor.tsx`, `DiaryFormatToolbar.tsx`, NEW: `FloatingToolbar.tsx`

## Dependencies

- None (independent)

## Test Strategy

_(Planned by test planner)_

## Orchestrator Brief

```
tech: "React, Framer Motion, DOM Selection API, createPortal"
keyFiles: ["JournalEntryEditor.tsx", "DiaryFormatToolbar.tsx", "new: FloatingToolbar.tsx"]
approach: "Create FloatingToolbar positioned via Selection API, fade+slide entrance, portal rendering"
complexity: "High (Selection API positioning + dismiss behavior + markdown detection)"
```

## Definition of Done

- [ ] Floating toolbar appears above text selection (150ms fade+slide)
- [ ] Dismisses on scroll (immediate) and tap-outside (100ms fade)
- [ ] Format actions apply and haptic confirms
- [ ] Markdown shortcuts auto-convert
- [ ] Clamped to viewport, portal-rendered
- [ ] Existing bottom toolbar unaffected (fallback)
- [ ] Gated by `shouldAnimate()`, no TS errors, tests pass

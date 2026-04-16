# T3: Format Actions & Markdown Shortcuts

**Epic:** [Epic 6 — Telegram-Level Polish](../../../../epics/epic-6-telegram-polish/epic.md)
**User Story:** [EP6_US007 Editor Floating Toolbar](../story.md)
**Related:** T1 (toolbar component), T2 (selection lifecycle)
**Parallel Group:** 2

---

## Context

### Current State

- `DiaryFormatToolbar.tsx` has formatting actions but may lack:
  - Markdown shortcut auto-conversion (`**text**` → bold)
  - Haptic feedback on format action
  - Visual feedback when format is applied

### Desired State

- Toolbar format buttons (bold, italic, link) apply formatting with haptic confirmation.
- Markdown shortcuts auto-convert on input: `**text**` → bold, `*text*` → italic, `[text](url)` → link.
- Subtle visual feedback on format application.

### Inherited Assumptions

- **A1 (UX):** Markdown shortcuts follow standard conventions (`**` bold, `*` italic).

---

## Implementation Plan

### Phase 1: Format Actions Polish

- [ ] Ensure bold/italic/link buttons in toolbar apply formatting correctly
- [ ] Add `hapticTap()` on each format action
- [ ] Brief scale pulse (1→1.05→1, 100ms) on the pressed button as feedback

### Phase 2: Markdown Shortcut Detection

- [ ] On `input` event in editor, detect markdown patterns:
  - `**text**` → apply bold, remove markdown syntax
  - `*text*` → apply italic, remove markdown syntax
  - `[text](url)` → apply link, remove markdown syntax
- [ ] Pattern matching: regex on current line/selection after keystroke
- [ ] Apply formatting via existing editor API (contenteditable execCommand or custom)

### Phase 3: Visual Feedback

- [ ] Brief highlight flash on the formatted text range (200ms background pulse)
- [ ] Gate all animations via `shouldAnimate()`

---

## Technical Approach

### Recommended Solution

**Library:** DOM `input` event + regex pattern matching
**Existing:** `DiaryFormatToolbar.tsx` format action handlers, `hapticTap()` from `haptics.ts`

### Key APIs

- `document.execCommand("bold")` or custom formatting API
- Regex: `/\*\*(.+?)\*\*/`, `/\*(.+?)\*/`, `/\[(.+?)\]\((.+?)\)/`
- `hapticTap()` — light haptic on format confirm

### Implementation Pattern

```pseudocode
ON input event:
  text = getCurrentLineText()
  IF match = text.match(/\*\*(.+?)\*\*/)
    replaceText(match[0], match[1])
    applyBold(match[1])
    hapticTap()

ON toolbar button press:
  applyFormat(type)  // existing handler
  hapticTap()
  animateButtonPulse()
```

### Why This Approach

- Markdown shortcuts are intuitive for power users
- Input-event detection is standard (no custom parser needed)

### Patterns Used

- Regex pattern matching on input (standard markdown detection)
- Haptic confirmation on action (project convention)

### Known Limitations

- `document.execCommand` is deprecated but widely supported; custom implementation may be needed depending on editor setup
- Nested markdown (`***bold italic***`) not supported in v1

---

## Acceptance Criteria

- [ ] **Given** I tap bold button on toolbar, **When** format applies, **Then** selected text becomes bold and light haptic fires.
- [ ] **Given** I type `**hello**` in the editor, **When** the closing `**` is typed, **Then** "hello" auto-converts to bold formatting and markdown syntax is removed.
- [ ] **Given** I type `*italic*`, **When** the closing `*` is typed, **Then** "italic" auto-converts to italic.
- [ ] **Given** haptics are disabled in Dopamine settings, **Then** format actions work without haptic.

---

## Affected Components

### Implementation

- `src/features/journal/DiaryFormatToolbar.tsx` — add haptic to format actions, button pulse animation
- `src/features/journal/JournalEntryEditor.tsx` — add markdown shortcut detection on input event

---

## Existing Code Impact

### Refactoring Required

- `DiaryFormatToolbar.tsx` — add haptic calls to existing format action handlers

### Tests to Update

- None expected

---

## Definition of Done

- [ ] All acceptance criteria met
- [ ] Markdown shortcuts work for bold, italic, and link
- [ ] Haptic fires on every format action (when enabled)
- [ ] NO new tests created

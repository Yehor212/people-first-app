# EP12_US004: CTA Pills & Context Line

**Epic:** [Epic 12: Living Empty State & Ambient Canvas](../../epic.md)
**Status:** To Review
**Priority:** P1
**Complexity:** Low
**Created:** 2026-04-15

---

## Goal

Add two action button pills ("Write" and "Prompt") and a contextual info line (streak + entry count) below the typewriter text, giving users clear next steps and motivating context in the empty state.

## Acceptance Criteria

### AC1: CTA Pills

- [ ] Two pill-shaped buttons centered below typewriter text: "✏️ Write" and "🎯 Prompt"
- [ ] "Write" creates a new blank entry and opens editor (same as FAB/new entry button)
- [ ] "Prompt" creates a new entry pre-filled with the currently displayed typewriter prompt
- [ ] Both pills use theme tokens for colors (bg-primary/10, text-primary)
- [ ] Touch targets >= 44px height

### AC2: Hover & Press Animation

- [ ] Hover: pill lifts 2px (translateY) + subtle glow (box-shadow with primary color at 15%)
- [ ] Press: pill scales to 0.97 with spring
- [ ] Transition: `springPresets.snappy` (stiffness: 400, damping: 30)

### AC3: Context Line

- [ ] Below CTAs: "{N} entries this week · {streak} 🔥 streak" (localized)
- [ ] If streak is 0: show only entry count, no fire emoji
- [ ] If no entries this week: show "Start your first entry this week"
- [ ] Text uses `text-muted-foreground/50` (subtle, not competing with CTAs)

### AC4: Responsiveness & A11y

- [ ] CTAs and context line adapt to panel width (wrap on narrow panels)
- [ ] All text uses i18n translation keys
- [ ] RTL: layout mirrors correctly
- [ ] `aria-label` on both CTA buttons
- [ ] `prefers-reduced-motion`: no hover lift animation, static pills

## Technical Notes

### Affected Components

- `src/features/journal/DiaryEmptyCanvas.tsx` — add CTA section below typewriter
- `src/i18n/translations.ts` — add keys for "Write", "Prompt", context line patterns

### Architecture

Simple stateless section within DiaryEmptyCanvas. Entry count computed from `journal.entries` (already available in JournalModule scope). Streak from `useGamificationStore`.

### Dependencies

- EP12_US002 (typewriter text provides the current prompt for "Prompt" CTA)
- EP12_US003 (DiaryEmptyCanvas component exists as orchestrator)

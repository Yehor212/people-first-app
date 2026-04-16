# T2: Context Line (Entries + Streak) with i18n

**Story:** [EP12_US004](../story.md) | **Type:** Implementation | **Status:** Todo | **Priority:** P1 | **Estimate:** 2h | **Parallel Group:** 1

## Goal
Add contextual info line below CTAs showing entry count this week and current streak, localized.

## Acceptance Criteria
- [ ] Shows "{N} entries this week · {streak} 🔥 streak" — `verify: inspect (text content)`
- [ ] Streak 0: shows only entry count, no fire emoji — `verify: inspect (conditional rendering)`
- [ ] No entries this week: "Start your first entry this week" — `verify: inspect (empty state text)`
- [ ] Uses `text-muted-foreground/50` (subtle) — `verify: inspect (className)`
- [ ] All text via i18n t() — `verify: command (grep 't(' src/features/journal/DiaryEmptyCanvas.tsx | grep -c 'context\|entries\|streak')`
- [ ] RTL: layout correct — `verify: inspect (text-center or logical properties)`

### Affected Components
- `src/features/journal/DiaryEmptyCanvas.tsx` — add context line
- `src/i18n/translations.ts` — add context line keys

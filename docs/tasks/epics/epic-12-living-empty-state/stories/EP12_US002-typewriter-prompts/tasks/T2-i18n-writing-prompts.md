# T2: i18n Writing Prompt Keys for 8 Languages

**Story:** [EP12_US002](../story.md) | **Type:** Implementation | **Status:** Todo | **Priority:** P0 | **Estimate:** 3h | **Parallel Group:** 1

## Goal
Add 10+ writing prompt i18n keys to translations.ts for all 8 languages, used by the typewriter rotation.

## Acceptance Criteria
- [ ] 10+ prompt keys added: `diary.prompt.1` through `diary.prompt.10` — `verify: command (grep -c 'diary.prompt' src/i18n/translations.ts)`
- [ ] All 8 languages have translations — `verify: command (npm run i18n:check)`
- [ ] Prompts are thoughtful writing starters, not generic ("What made you smile today?" not "Write something") — `verify: inspect (prompt quality)`
- [ ] Deterministic rotation: seeded by day-of-year (same prompt all day) — `verify: inspect (seed logic in TypewriterText)`

### Affected Components
- `src/i18n/translations.ts` — add prompt keys
- `src/features/journal/TypewriterText.tsx` — consume prompts via t()

# T1: CTA Pills (Write + Prompt) with Hover Animation

**Story:** [EP12_US004](../story.md) | **Type:** Implementation | **Status:** Todo | **Priority:** P0 | **Estimate:** 3h | **Parallel Group:** 1

## Goal
Add two pill-shaped CTA buttons ("Write" and "Prompt") with hover lift + glow animations.

## Acceptance Criteria
- [ ] Two pills centered below typewriter: "✏️ Write" and "🎯 Prompt" — `verify: inspect (two button elements)`
- [ ] "Write" creates blank entry + opens editor — `verify: inspect (onClick creates entry)`
- [ ] "Prompt" creates entry pre-filled with current typewriter prompt — `verify: inspect (onClick passes prompt text)`
- [ ] Hover: translateY(-2px) + box-shadow glow (primary at 15%) — `verify: inspect (whileHover props)`
- [ ] Press: scale 0.97 with springPresets.snappy — `verify: inspect (whileTap props)`
- [ ] Touch targets >= 44px — `verify: inspect (min-h-[44px])`
- [ ] Theme tokens for colors (bg-primary/10, text-primary) — `verify: inspect (no hardcoded colors)`

### Affected Components
- `src/features/journal/DiaryEmptyCanvas.tsx` — add CTA section

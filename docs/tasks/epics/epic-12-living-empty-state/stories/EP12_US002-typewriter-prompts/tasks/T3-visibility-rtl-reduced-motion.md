# T3: Page Visibility + RTL + Reduced Motion

**Story:** [EP12_US002](../story.md) | **Type:** Implementation | **Status:** Todo | **Priority:** P1 | **Estimate:** 3h | **Parallel Group:** 2

## Goal
Add Page Visibility pause/resume, RTL language support, and reduced-motion fallback to typewriter.

## Acceptance Criteria
- [ ] Typewriter pauses when tab hidden (Page Visibility API) — `verify: inspect (visibilitychange listener)`
- [ ] Resumes from current position on tab visible — `verify: inspect (resume logic)`
- [ ] RTL (Arabic, Hebrew): cursor on left, text types right-to-left — `verify: inspect (direction: rtl)`
- [ ] Japanese/multi-byte: types correctly (no char splitting) — `verify: inspect (no substring issues)`
- [ ] `prefers-reduced-motion`: static text, fade-swap every 8s — `verify: inspect (reducedMotion branch)`
- [ ] Clean unmount: no stale timeouts — `verify: inspect (cleanup in useEffect return)`

### Affected Components
- `src/features/journal/TypewriterText.tsx` — add visibility, RTL, reduced-motion

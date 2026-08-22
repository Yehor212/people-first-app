# Settings and app text reflow implementation plan

**Goal:** Preserve complete, readable user-facing text in Settings and confirmed shared critical surfaces without shrinking copy or indiscriminately removing intentional preview truncation.

**Local evidence:** At a 320 px viewport, the Settings Google and Telegram provider labels receive 97 px while their content needs 177 px and 195 px. Current source also truncates an import filename and a possible data-loss warning, uses fixed-size heading text outside the app font-scale tokens, and leaves five reachable runtime messages without complete eight-locale coverage.

**Authoritative constraints:** WCAG 2.2 Reflow, Resize Text, Text Spacing, Label in Name and status-message requirements; CSS Text `overflow-wrap`; CSS Grid min-content behavior; Apple guidance to use multiline or stacked layouts at larger text sizes; Android guidance to reflow scalable content instead of forcing two-dimensional panning; W3C bidi isolation guidance.

## Scope

- Shared OAuth provider button reflow used by Settings and entry/auth.
- Settings choice buttons, theme/accent grids, headings, field labels, action labels, module-card accessibility names and confirmation details.
- Global offline/data-loss warning localization and wrapping.
- Complete runtime state copy for all eight supported locales.
- Focused unit contracts plus fresh browser checks across narrow widths, text scaling, text spacing and RTL.

## Explicit non-goals

- No blanket removal of every `truncate` or `line-clamp` in the repository.
- No font shrinking, copy deletion, `break-all`, fake product data, storage migration, route redesign or visual-theme replacement.
- Intentional Diary/Habit/navigation previews are changed only if fresh runtime evidence shows lost essential meaning or no reachable full-text path.

## Test-first sequence

1. Add failing component/i18n tests for provider-label wrapping, critical banner text, dialog detail, shared Settings controls, token-scaled heading text, accessible naming and locale completeness.
2. Run the focused suite and preserve the expected RED failures.
3. Write a fresh structured `.preflight-token` containing the RED evidence and routing decision.
4. Implement the smallest shared reflow/localization changes.
5. Rerun the same focused suite GREEN.
6. Run typecheck, lint, i18n quality/deep checks, no-AI-template and relevant visual/governance checks.
7. Run fresh browser evidence at 320/390/768 px, app text scale 100%/150%, WCAG text-spacing override and `ar`/`he`; inspect screenshots and measured overflow.
8. Review the hash-bound final packet SOLO and run the visual-integrity critic; independently verify every cited artifact.

## Acceptance and rejection

- Accept only when confirmed critical labels, actions, filenames and warnings retain their full meaning without horizontal document overflow at the tested Web matrix.
- Reject if a fix merely hides overflow, shrinks text, changes the accessible name away from the visible label, breaks 44 px targets, produces bidi reordering, or causes an unreachable modal action.
- Web evidence must not be generalized to Android, iOS, Desktop/Tauri, native assistive technology or representative-user preference. Those remain `UNVERIFIED` without fresh corresponding evidence.

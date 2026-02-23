## Summary

<!-- 1-3 bullet points describing WHAT changed and WHY -->

-
-

## Type of Change

<!-- Check ONE that applies -->

- [ ] `feat` — New feature
- [ ] `fix` — Bug fix
- [ ] `perf` — Performance improvement
- [ ] `refactor` — Code restructuring (no behavior change)
- [ ] `docs` — Documentation only
- [ ] `chore` — Build, deps, CI, tooling
- [ ] `test` — Tests only

## Linked Issues

<!-- Reference GitHub Issues. If none exist, write "No issue tracker yet" -->

Closes #

## Evidence of Work

<!-- MANDATORY: Provide proof that your changes work. PRs without evidence will be rejected. -->

### Screenshots / Screen recordings

<!-- For UI changes: before & after screenshots. For non-UI: "N/A — no visual changes" -->

| Before | After |
|--------|-------|
|        |       |

### Test Results

<!-- Paste output of: npm run check:all && npm test -->
<!-- Minimum required evidence: -->

```
TypeScript:  npx tsc --noEmit          → __ errors
ESLint:      npx eslint . --max-warnings=0  → __ errors, __ warnings
Unit tests:  npx vitest run            → __ passed, __ failed
i18n:        npm run i18n:check        → __ languages OK
Build:       npm run build             → pass / fail
```

### E2E Results (if applicable)

<!-- Paste output of: npx playwright test --project=chromium -->

```
E2E: __ passed, __ failed
```

## Definition of Done Checklist

<!-- ALL boxes must be checked before merge. No exceptions. -->

### Quality Gates (automated)

- [ ] `npx tsc --noEmit` — 0 errors
- [ ] `npx eslint . --max-warnings=0` — 0 errors, 0 warnings
- [ ] `npx vitest run` — 0 failures
- [ ] `npm run i18n:check` — all 8 languages complete
- [ ] `npm run build` — succeeds
- [ ] CI pipeline is green (all jobs pass)

### Code Quality (manual)

- [ ] No new untyped `any` escape hatches introduced
- [ ] No hardcoded user-visible strings (all in `translations.ts`)
- [ ] No security vulnerabilities introduced (XSS, injection, leaked secrets)
- [ ] No `!important` in CSS without documented reason
- [ ] Pre-commit hook (`tsc --noEmit` + `lint-staged`) passes locally

### Architecture Alignment

- [ ] I have read `ARCHITECTURE.md` before making changes
- [ ] `ARCHITECTURE.md` updated (if architectural change) — or N/A
- [ ] Follows existing patterns (Zustand stores, bridge pattern, hook conventions)
- [ ] No new state management solutions without ADR

### Documentation

- [ ] `CHANGELOG.md` updated under `[Unreleased]` (if user-facing change) — or N/A
- [ ] New hooks/components are self-documenting (clear naming, JSDoc if complex)

### Supabase / Database (if applicable)

<!-- Check these only if SQL or database changes are included -->

- [ ] All column names verified against actual table schema
- [ ] RLS policies use `(select auth.uid())` pattern (not bare `auth.uid()`)
- [ ] No `BEGIN`/`COMMIT` in migration files
- [ ] `handle_new_user()` trigger NOT modified — or verified against `profiles` schema
- [ ] N/A — no database changes

## Rollback Plan

<!-- How to undo this change if something goes wrong in production? -->
<!-- Examples: "git revert <commit>", "Run reverse SQL migration", "Revert Play Store staged rollout" -->

-

## Reviewer Notes

<!-- Anything the reviewer should pay special attention to? -->
<!-- Example: "The sync logic changed — please verify offline behavior" -->

-

# Contributing to ZenFlow

> **This document is the single source of truth for all contribution standards.**
> Nothing gets merged without meeting every requirement below.

## Table of Contents

1. [Definition of Done (DoD)](#definition-of-done)
2. [Commit Conventions](#commit-conventions)
3. [Branch Strategy](#branch-strategy)
4. [Pull Request Process](#pull-request-process)
5. [Code Review Standards](#code-review-standards)
6. [Quality Gates (CI)](#quality-gates)
7. [Pre-Commit Hooks](#pre-commit-hooks)
8. [Architecture Rules](#architecture-rules)
9. [Supabase / Database Safety](#supabase--database-safety)
10. [i18n Requirements](#i18n-requirements)
11. [Security Requirements](#security-requirements)
12. [Release Process](#release-process)

---

## Definition of Done

A task is **DONE** only when ALL of these conditions are met:

| # | Gate | Command / Evidence | Threshold |
|---|------|--------------------|-----------|
| 1 | TypeScript compiles | `npx tsc --noEmit` | 0 errors |
| 2 | ESLint passes | `npx eslint . --max-warnings=0` | 0 errors, 0 warnings |
| 3 | Unit tests pass | `npx vitest run` | 0 failures |
| 4 | i18n completeness | `npm run i18n:check` | All 8 languages complete |
| 5 | Build succeeds | `npm run build` | Exit code 0 |
| 6 | E2E smoke passes | `npx playwright test --project=chromium` | 0 failures |
| 7 | No new `any` types | Manual review | No untyped escape hatches added |
| 8 | ARCHITECTURE.md updated | If architectural change was made | Diff shows update |
| 9 | CHANGELOG.md updated | For user-facing changes | Entry under `[Unreleased]` |
| 10 | PR checklist complete | `.github/PULL_REQUEST_TEMPLATE.md` | All boxes checked |

**Rule: If ANY gate fails, the task is NOT done. No exceptions.**

---

## Commit Conventions

We use [Conventional Commits](https://www.conventionalcommits.org/) strictly.

### Format

```
type(scope): short description (imperative mood, lowercase)
```

### Types (exhaustive list)

| Type | When to use |
|------|-------------|
| `feat` | New feature (wholly new functionality) |
| `fix` | Bug fix |
| `perf` | Performance improvement (no behavior change) |
| `refactor` | Code restructuring (no behavior change, no bug fix) |
| `docs` | Documentation only |
| `chore` | Build process, deps, CI config, tooling |
| `test` | Adding or fixing tests only |
| `revert` | Reverting a previous commit |
| `ci` | CI/CD pipeline changes |

### Scopes (common, not exhaustive)

`ui`, `auth`, `sync`, `rls`, `canvas`, `i18n`, `e2e`, `ci`, `deps`, `android`, `store`

### Rules

- **Imperative mood**: "add feature" not "added feature" or "adds feature"
- **Lowercase** first letter after colon
- **No period** at end
- **Max 72 characters** for subject line
- Reference issues when they exist: `fix(auth): resolve token refresh loop (Closes #42)`

### Examples

```
feat(ui): add dark mode toggle to settings
fix(sync): prevent duplicate entries on reconnect
perf(rls): optimize journal RLS to single FOR ALL policy
chore(deps): update capacitor to 8.0.1
docs(constitution): add auth polling fix addendum
test(e2e): add smoke test for export/import flow
revert: revert "feat(canvas): add auto-pan" (reverts abc1234)
```

---

## Branch Strategy

- **Trunk-based development** on `main`
- Feature branches: `feat/short-description` or `fix/short-description`
- Always branch from latest `main`
- Keep branches short-lived (< 3 days)
- Rebase onto `main` before opening PR (no merge commits)

---

## Pull Request Process

1. **Create branch** from latest `main`
2. **Make changes** following all conventions in this document
3. **Run local checks**: `npm run check:all && npm test`
4. **Open PR** using the template (`.github/PULL_REQUEST_TEMPLATE.md`)
5. **Fill every section** of the PR template — incomplete PRs will be rejected
6. **Pass CI** — all 6 pipeline gates must be green
7. **Address review feedback** before merge
8. **Squash merge** into `main` with conventional commit message

---

## Code Review Standards

### What reviewers check

1. **Correctness** — Does the code do what it claims?
2. **Security** — No XSS, SQL injection, or leaked secrets (see [Security Requirements](#security-requirements))
3. **Architecture alignment** — Follows patterns in `ARCHITECTURE.md`
4. **Test coverage** — New logic has corresponding tests
5. **i18n** — All user-visible strings go through `translations.ts`
6. **No over-engineering** — Minimum complexity for the task at hand
7. **Evidence in PR** — Screenshots, test output, or linked issues

### Review rules

- Every PR requires at least **1 approval** before merge
- Author cannot approve their own PR
- Reviewer must pull and run `npm run check:all && npm test` locally if unsure
- Nit-picks are labeled `nit:` and do not block merge
- Security concerns **always** block merge

---

## Quality Gates

These gates run automatically in CI (`deploy.yml`) on every push to `main` and every PR:

| Order | Gate | Command | Blocking? |
|-------|------|---------|-----------|
| 1 | Security audit | `npm audit --audit-level=high` | Non-blocking (reviewed) |
| 2 | ESLint | `npx eslint . --max-warnings=0` | **Blocking** |
| 3 | TypeScript | `npx tsc --noEmit` | **Blocking** |
| 4 | i18n check | `npm run i18n:check` | **Blocking** |
| 5 | Unit tests | `npm test` (vitest, 2650+ tests) | **Blocking** |
| 6 | Build | `npm run build` | **Blocking** |
| 7 | E2E tests | `npx playwright test --project=chromium` | **Blocking** |

Additionally, the **Android gate** (`assembleDebug` + `lintDebug` + `testDebugUnitTest`) runs in parallel as an informational check.

---

## Pre-Commit Hooks

Husky runs automatically on every commit:

```bash
npx tsc --noEmit && npx lint-staged
```

- `tsc --noEmit` — full TypeScript check
- `lint-staged` — ESLint on staged `*.{ts,tsx}` files

**Do NOT bypass hooks with `--no-verify`.** If a hook fails, fix the issue and commit again.

---

## Architecture Rules

> `ARCHITECTURE.md` is the project's constitution. Read it before writing code.

### Non-negotiable rules

1. **Read `ARCHITECTURE.md` before ANY code change** — understand existing patterns first
2. **Update `ARCHITECTURE.md` after architectural changes** — new patterns, modified flows, changed constants
3. **State management**: Zustand stores (4) with bridge pattern (IndexedDB <-> Zustand). No new state solutions without ADR
4. **Components**: Tab components in `src/components/tabs/`, modals via `ModalLayer.tsx` + `OverlayLayer.tsx`
5. **Hooks**: Place in `src/hooks/`. Currently 48 files — reuse before creating new ones
6. **Feature flags**: Use `FeatureFlagsContext.tsx` for new features behind gates
7. **No direct DOM manipulation** — use React patterns
8. **No `!important`** in CSS unless documented with reason

### File organization

```
src/
  components/
    tabs/          # 6 tab components
    canvas/        # MindMap canvas components
    ui/            # Shared UI primitives (Radix-based)
  hooks/           # 48 custom hooks
  contexts/        # React contexts (FeatureFlags, etc.)
  stores/          # 4 Zustand stores
  lib/             # Utilities (sentry, crashReporting, supabase)
  i18n/            # translations.ts (8 languages)
```

---

## Supabase / Database Safety

> These rules exist because mistakes here break production for ALL users immediately.

1. **NEVER reference columns that don't exist** — always verify table schema before writing SQL
2. **NEVER modify `handle_new_user()` trigger** without verifying against `profiles` table schema:
   - Columns: `id`, `display_name`, `avatar_url`, `preferred_language`, `timezone`, `created_at`, `updated_at`
   - There is NO `email` column
3. **`CREATE OR REPLACE FUNCTION` silently overwrites** — always diff old vs new
4. **SQL migrations** in `supabase/migrations/` are local files only; production requires manual execution in Supabase Dashboard SQL Editor
5. **After writing ANY trigger/function SQL**: cross-check every column name against the actual `CREATE TABLE` definition
6. **RLS policy pattern**: Use `(select auth.uid())` subquery (not bare `auth.uid()`) for query planner caching
7. **No `BEGIN`/`COMMIT`** in Supabase SQL Editor — it auto-wraps transactions

---

## i18n Requirements

- All 8 languages must be complete: `en`, `uk`, `es`, `de`, `fr`, `ja`, `ar`, `he`
- All user-visible strings go in `src/i18n/translations.ts`
- Run `npm run i18n:check` before committing
- Never hardcode user-visible strings in components

---

## Security Requirements

- **Input validation**: Zod schemas for all external input
- **HTML sanitization**: DOMPurify for any user-generated content
- **CSP**: Maintained in `index.html` — no `unsafe-eval`, no `unsafe-inline` for scripts
- **Secrets**: Never commit `.env`, `*.keystore`, or `google-services.json`; keep them ignored and run the repository security gates before handoff
- **RLS**: All Supabase tables must have Row Level Security enabled (currently 25 tables)
- **Auth**: PKCE OAuth + Google Native via Supabase
- **Error monitoring**: Sentry with PII filtering (`src/lib/sentry.ts`)

---

## Release Process

Follow these documents in order:

1. **`docs/RELEASE_CHECKLIST.md`** — versioning, build, QA, store listing
2. **`docs/SMOKE_CHECKLIST.md`** — core flow verification

### Version locations (update both)

| File | Field |
|------|-------|
| `package.json` | `version` |
| `android/app/build.gradle` | `versionCode` + `versionName` |

### Release commands

```bash
npm run check:all          # All quality gates
npm test                   # 2650+ unit tests
npx playwright test        # E2E smoke
npm run build              # Production build
npx cap sync android       # Sync to Android
```

Tag every release: `git tag v<version> && git push --tags`

---

## Getting Started (New Developer)

1. Clone the repo
2. `npm install`
3. Copy `.env.example` to `.env` and fill in Supabase credentials
4. Read `ARCHITECTURE.md` (the entire file — it's the constitution)
5. Run `npm run check:all && npm test` to verify setup
6. Read this `CONTRIBUTING.md` fully before your first PR

---

*Last updated: 2026-02-22 | Version: 1.7.2*

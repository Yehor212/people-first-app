# Definition of Done (DoD)

> **Solo Developer Disclaimer**: This is a quality guideline for major releases — not a strict blocker for every commit. A critical production hotfix can skip non-essential manual checks, but you should track what was skipped and circle back. Automated gates (CI) always run regardless.

---

## Automated Gates (CI enforces these)

These run on every push to `main` and every PR via `.github/workflows/deploy.yml`:

| # | Gate | Command | Blocking? |
|---|------|---------|-----------|
| 1 | TypeScript | `npx tsc --noEmit` | Yes |
| 2 | ESLint | `npx eslint . --max-warnings=0` | Yes |
| 3 | Unit tests | `npx vitest run` (2650+ tests) | Yes |
| 4 | i18n completeness | `npm run i18n:check` (8 languages) | Yes |
| 5 | Production build | `npm run build` | Yes |
| 6 | E2E smoke | `npx playwright test --project=chromium` | Yes |
| 7 | Coverage report | `npx vitest run --coverage` | **No** (informational) |
| 8 | Security audit | `npm audit --audit-level=high` | **No** (informational) |

## Manual Checks (before major releases)

| # | Check | How to verify |
|---|-------|---------------|
| 1 | No new untyped `any` | Review diff for `any` escape hatches |
| 2 | Strings in i18n | No hardcoded user-visible strings in components |
| 3 | ARCHITECTURE.md read | Confirmed patterns before writing code |
| 4 | CHANGELOG.md updated | Entry under `[Unreleased]` for user-facing changes |

## Release-Only (before store/web publish)

| # | Check | Reference |
|---|-------|-----------|
| 1 | Version bumped | `package.json` + `android/app/build.gradle` (versionCode + versionName) |
| 2 | Smoke checklist | `docs/SMOKE_CHECKLIST.md` — core flows verified |
| 3 | Git tag created | `git tag v<version> && git push --tags` |
| 4 | Release checklist | `docs/RELEASE_CHECKLIST.md` — full QA pass |

## Hotfix Exception

For urgent production fixes:
1. Automated gates (CI) still run — no bypassing
2. Manual checks can be deferred — create a follow-up task
3. Document what was skipped in the commit message: `fix(scope): description [hotfix, skipped: changelog]`

## Snapshot Tracking

Current quality state is captured in `tests.json` at project root. Update it after major releases.

---

*Consolidates: `tests.json`, `docs/RELEASE_CHECKLIST.md`, `docs/SMOKE_CHECKLIST.md`, `.github/workflows/deploy.yml`*

# PR #67 Durable Habit Completion Salvage Plan

**Goal:** Salvage the durable-first habit completion behavior from PR #67 into current `main` without importing its obsolete Android Ads-OFF packaging, version, dependency, or generated release-candidate state.

**Source:** PR #67 tip `6b9cd810731207bf3968980ece9affdcb99a44b9`; product snapshot commit `de45414b3e849d60e21e050790f6005da42306de`.

**Base:** Stacked on the exact PR #85 tip `19b50cb5d86947cbe2f3916bbf1f64b71ae3958a`; its released-main ancestor is PR #84 merge `72ef00e132b37a24eaad4a1c15b5cdb6f11b4ef8`.

## Boundaries

- Take only the durable completion storage primitive, current-hook integration, and their tests.
- Do not copy Android Gradle/manifest, Capacitor plugin selection, ad controller, ad policy, version, lockfile, package manifest, or release-candidate composition from PR #67.
- Preserve the current Android banner-only source contract and fail-closed `ADS_RUNTIME_MODE = OFF` policy.
- Keep account-boundary generation fencing before, during, and after the Dexie transaction.
- Publish UI state, rewards, haptics, analytics, quest progress, and cloud sync only after the durable write resolves.
- A failed or stale-generation write must not publish completion state or side effects.
- Rapid taps must not produce duplicate durable commits or rewards.

## Tasks

### 1. Reproduce and protect the storage contract

- [x] Add focused tests for durable boolean and numerical entry commits.
- [x] Add failure-path coverage for missing habits and account-generation changes.
- [x] Confirm the new tests fail before the module exists.
- [x] Implement the smallest storage primitive under the existing account-boundary lock.

### 2. Integrate the current hook

- [x] Add hook tests proving no publication before the commit resolves.
- [x] Add rejection tests proving no UI/reward/sync publication after a failed commit.
- [x] Add rapid-retry coverage for boolean and numerical handlers.
- [x] Route boolean, exact numerical, and delta numerical mutations through the durable primitive.
- [x] Keep deletion, archive, edit, and unrelated habit flows unchanged.

### 3. Verify and deliver

- [x] Run focused storage/account-boundary and hook suites.
- [x] Run full Vitest, lint, typecheck, production-data-integrity, build, and release-artifact checks.
- [x] Run the narrow security/secrets profile and inspect the final diff.
- [ ] Commit and push only the scoped paths, open a replacement PR, and wait for required CI.
- [ ] Merge and verify main release before adjudicating/closing PR #67.

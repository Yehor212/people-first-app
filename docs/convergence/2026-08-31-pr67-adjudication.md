# PR #67 Semantic Adjudication — 2026-08-31

## Scope

- Source PR: `#67` — `codex/android-2-1-play-release-candidate-20260820`
- Source tip: `6b9cd810731207bf3968980ece9affdcb99a44b9`
- Product snapshot: `de45414b3e849d60e21e050790f6005da42306de`
- Replacement branch: `codex/pr67-durable-completion-20260831`
- Replacement stack base: PR #85 tip `19b50cb5d86947cbe2f3916bbf1f64b71ae3958a`

PR #67 is not merged wholesale. It combines one still-missing data-integrity behavior with obsolete Android release-candidate, Ads-OFF packaging, dependency-lock, and generated documentation state.

## Commit Ledger

| Source commit | Intent | Disposition | Replacement or proof |
| --- | --- | --- | --- |
| `de45414b3e849d60e21e050790f6005da42306de` | preserve Android 2.1 release-candidate snapshot | `PARTIAL_TAKE` | take only durable habit completion storage/hook behavior; adapt it to current `runWithDataWriteBarrier`, account-generation, provenance, and post-commit contracts |
| `84f3574b23fa1179eaf17e2109fc17cfeb733fb2` | regenerate documentation counts | `IN_MAIN` | current `npm run doc-counts` passes with 78 hooks, 9 stores, and `Index.tsx` at 293 lines; replaying an old count would regress the ledger |
| `6b9cd810731207bf3968980ece9affdcb99a44b9` | patch transitive dependency lock versions | `IN_MAIN_OR_NEWER` | current lock resolves `js-yaml 4.3.1`, `nanoid 3.3.18/5.1.16`, `undici 6.28.0`, and `fast-uri 3.1.6`; the source lock had `fast-uri 3.1.5` |

## Snapshot Exclusions

The following source areas are intentionally not copied:

- Android Gradle, manifest, ProGuard, Capacitor generated settings, and release version state;
- `package.json` and `package-lock.json` from the old release candidate;
- AdMob dependency removal, Ads-OFF controller replacement, and native plugin exclusion;
- old ratchet/doc-count output and release-candidate composition tests;
- unrelated habit-page layout rewrites.

Current `main` is version 2.1.2 / Android version code 39 and contains a newer Android banner-only source contract with `ADS_RUNTIME_MODE = OFF` fail-closed until owner activation. Importing the old version 2.1.0 / version code 35 packaging would regress current release and compliance work.

## Durable Completion Adaptation

- Boolean, exact numerical, and delta numerical entry changes commit to Dexie before UI publication, rewards, haptics, analytics, quest progress, or cloud sync.
- The current `runWithDataWriteBarrier` drains already accepted hook writes and holds the origin-wide data lock through mounted refresh.
- Account generation is asserted before the barrier mutation, inside the Dexie transaction, and after the write; the post-write assertion failure rolls the transaction back.
- A genuine post-commit finalization error recovers only the exact barrier-issued committed value after revalidating its captured account generation.
- Past-date edits retain `calendar` provenance; same-day quick taps retain `quickTap`.
- Failed commits publish no completion state or side effects, release their in-flight guard, and can be retried.
- Rapid duplicate boolean and numerical delta requests produce one durable commit.

## Local Verification

- Initial RED: the new storage test could not resolve the missing durable module; eight hook assertions failed before integration.
- Focused durable storage/hook tests: 22 passed before the final numerical duplicate test was added.
- Broader storage/account-boundary/habit tests: 9 files, 179 tests passed.
- TypeScript and scoped ESLint: passed with zero warnings after cleanup.
- Final full Vitest: 754 files passed, 1 skipped; 9,191 tests passed, 23 skipped, 7 todo.
- Production build, bundle production-data-integrity (`scanned=2435`, `reachable=822`), and duplicate release-artifact verification passed.
- Security quick profile `20260831T160114Z-30125`: Gitleaks, TruffleHog, Trivy, Checkov, and KICS returned zero; Snyk reported 60 repository-wide existing results and zero in the durable completion paths; Terrascan parsed unrelated JSON as IaC and returned status 4 with 785 policies checked and zero violations.
- Final strict secrets profile `20260831T160437Z-31676`: Gitleaks and TruffleHog returned zero.
- PR CI exposed a pre-existing Orb timing observation race unrelated to durable completion. The test-only MutationObserver correction is documented in `docs/convergence/2026-08-31-orb-performance-observer-fix.md`; the 2,500 ms budget is unchanged.

## Release Boundary

The replacement remains `UNVERIFIED` for release until the final full suite includes every added test, the security suite is reviewed, the exact branch tip is merged into `origin/main`, and the resulting main build, visual, Android, iOS, Pages, privacy, and auth workflows pass. PR #67 and its branch remain recovery locators until then.

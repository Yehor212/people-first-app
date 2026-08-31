# PR #73 Semantic Adjudication — 2026-08-31

## Scope

- Source PR: `#73` — `codex/converge-non-active-20260827`
- Source tip: `f86328cde7ae85a7582c252af813eca7ad092ef0`
- Replacement base: `c8bbc3c70e8cb9cb4671c4a8c527a7bade86c54a`
- Replacement branch: `codex/pr73-semantic-integration-20260831`
- Source PR mergeability at capture: `CONFLICTING`

The source branch is not merged wholesale. Each of its 15 commits is mapped below to either an exact replacement commit or current-main source/test evidence.

## Commit Ledger

| Source commit | Intent | Disposition | Replacement or proof |
| --- | --- | --- | --- |
| `86c73690c4348b3d5c1b5f9328da0ffa23d03759` | align privacy reset and ad copy contracts | `IN_MAIN` | `src/storage/__tests__/db.test.ts` expects `adAgeEligibility: "unknown"`; `docs/AD_SYSTEM_JOURNEY.md` forbids scarcity/guilt copy; DB test passes |
| `aa46a44b1af51a2fab18e6f9b2e8ae91736606f7` | keyboard/text accessible entry choices | `TAKE` | `e3edcd67e999223962df3e7869c7be500a07e532` |
| `6ae8a4f75021d10c3fac51b828b5632244893639` | name habit duration controls | `TAKE` | `80ac818ae1ac1b1a4324fb53c4a1878536f2f739` |
| `b30b1aa2e65941f0c826fc3a51c3981f6aefd7a6` | name numerical habit controls | `TAKE` | `cb394ab28dc777c760ae507276eda322ac4a249c` |
| `698d0aaac14a97a9d8e3896589a6ebdfaac0bd23` | label feedback message input | `TAKE` | `6ac3385d72aae529c130f88e6176cc30c482207e` |
| `c24590ec69dd95620d9a2b59d5fd66ab65e4c522` | associate habit purpose labels | `TAKE` | `a8944650e9f266e0fb5e6faf942e31b94977e55f` |
| `73e58418630f2744c9f119164388a6fc0ea2c9ef` | preserve state order during report export | `TAKE` | `9d3523e74c2542e189a965943d15692793d45228` |
| `206313199db7223cd02bee5e781191a80fb5afe0` | route sync failures through retry policy | `TAKE` | `eac972571adc6a924115f741bde4679ef1ffbefe` |
| `498c70973a5d9395a6a680db736cccbc75cb7893` | preserve local backup recovery boundaries | `TAKE` | `a5bcd9d4101d8bb2616158cfc9e2e40f24f246a7` |
| `18eb5d101d6e0f0ffa72dcaac1cbca84348530d1` | keep aborted focus sessions completion-free | `TAKE` | `8f3c8e3561a46b9eaf28acc4c30bb7ab3777964c` |
| `df0350054756c57e40c0414604775bc977e8392e` | exclude archived habits from schedules | `TAKE` | `4953e2fddb4bfd49460c878256a85e7876cc15d9` |
| `c44d5d9194f50cba40ab1401139ae134970c522d` | canonicalize PKCE callback trailing slash | `IN_MAIN` | current `canonicalAuthPathname()` plus GitHub Pages trailing-slash acceptance and exact wrong-path rejection tests; 83 focused PKCE/DB tests pass |
| `143d04c279b8bbefad41c2d9ac2e8f35db662277` | retain PKCE fetch-spy typing | `IN_MAIN` | current PKCE test compiles and passes under the repository TypeScript/Vitest contract; no runtime delta remains |
| `dc1653e8ce25662f4bc56563e9c34afa732c8445` | reflow language choices for large text | `TAKE` | prerequisite-aware patch check passed; `d941f3c853b4c965e5c2fdc97e0f5ee3d1f4a52c`; 7 LanguageSelector tests pass |
| `f86328cde7ae85a7582c252af813eca7ad092ef0` | keep PKCE stubs lint-clean | `IN_MAIN` | current PKCE test passes; final lint/typecheck gate required before release |

## Focused Verification

- Baseline before replay: 9 files, 199 tests passed.
- Accessibility group after replay: 5 files, 11 tests passed.
- State-integrity group after replay: 6 files, 337 tests passed.
- Large-text language patch: 1 file, 7 tests passed.
- Current-main privacy and PKCE proof: 2 files, 83 tests passed.
- Full Vitest: 751 files passed, 1 skipped; 9,178 tests passed, 23 skipped, 7 todo.
- Repository gates: lint, typecheck, best-practices (66 invariants), no-AI-template, task-completion (131 invariants), agent-context, automatic context, and production-data-integrity diff passed.
- Production packaging: Vite build, bundle production-data-integrity (`scanned=2431`, `reachable=822`), and duplicate release-artifact verification passed.
- Narrow security profile: Gitleaks and TruffleHog passed with zero scanner failures; report `20260831T151127Z-39535`.

## Remaining Gates

The locally verified replacement is not release-complete until the replacement PR's required CI passes, the exact replacement tip is an ancestor of `origin/main`, and the resulting main visual/Android/iOS deployment and public smokes pass. PR #73 and its branch remain open recovery locators until those gates complete.

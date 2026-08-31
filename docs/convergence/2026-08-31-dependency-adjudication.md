# Dependency PR Adjudication — 2026-08-31

## Registry Snapshot

The current npm registry reported:

| Package | Baseline installed | Latest evaluated | Final candidate |
| --- | ---: | ---: | ---: |
| `vaul` | 0.9.9 | 1.1.2 | 1.1.2 |
| `@radix-ui/react-tooltip` | 1.2.8 | 1.2.16 | 1.2.16 |
| `@capacitor/cli` | 8.3.3 | 8.5.0 | 8.3.3 |
| `@capacitor/core` | 8.3.3 | 8.5.0 | 8.3.3 |
| `@capacitor/android` | 8.3.3 | 8.5.0 | 8.3.3 |
| `@capacitor/ios` | 8.3.4 | 8.5.0 | 8.3.4 |

## Open/Closed PR Disposition

| PR | Intent | Disposition | Proof |
| --- | --- | --- | --- |
| `#9` | Vaul 0.9.9 to 1.1.2 | `TAKE_IN_REPLACEMENT` | latest stable; React 18 peer-compatible; real Drawer component tests must pass |
| `#13` | isolated Capacitor CLI 8.0.2 to 8.1.0 | `SUPERSEDED_AND_REJECT_LATEST` | baseline lock already had CLI/Core/Android 8.3.3 and iOS 8.3.4; latest 8.5.0 introduced three moderate audit entries |
| `#14` | Tooltip 1.2.7 to 1.2.8 | `IN_MAIN_THEN_UPDATE` | current lock already contained 1.2.8; replacement evaluates current stable 1.2.16 with a focused accessibility test |

## Capacitor 8.5 Rejection

The aligned 8.5.0 candidate installed cleanly but changed `npm audit` from zero to three moderate findings:

- direct `@capacitor/cli` finding through `xcode`;
- `xcode@3.0.1` depends on deprecated `uuid@7.0.3`;
- the active UUID advisory affects versions below 11.1.1.

The registry's suggested remediation was a downgrade to CLI 8.4.2. Shipping a newer version while knowingly introducing the advisory, force-fixing, overriding transitive versions without upstream support, or mixing an unverified CLI/core platform set would violate the zero-regression dependency gate. The candidate was therefore removed. Final `npm ci` and `npm audit --audit-level=moderate` returned zero with the original Capacitor set.

## Focused Verification

- Baseline: 7 files, 23 tests passed; typecheck passed.
- Baseline `npx cap doctor` confirmed 8.5.0 as latest but failed because the pre-build checkout had no generated `android/app/src/main/assets` directory.
- Final focused candidate: 8 files, 24 tests passed, including live Vaul Drawer interactions and Tooltip trigger/portal accessibility; typecheck and scoped lint passed.
- Final full Vitest: 755 files passed, 1 skipped; 9,192 tests passed, 23 skipped, 7 todo.
- Full lint, typecheck, production build, PDI diff and bundle (`scanned=2436`, `reachable=822`), duplicate release-artifact verification, best-practices, no-AI-template, and task-completion gates passed.
- `npm audit --audit-level=moderate` returned zero; the production license gate found no disallowed licenses.
- Size limits passed: 1.50 MB gzip / 5.17 MB raw JavaScript and 75.77 kB Brotli CSS.
- Android and iOS `cap sync` succeeded; post-build `npx cap doctor` reported both platforms looking great with the retained Capacitor 8.3.3/8.3.4 set.
- Security quick profile `20260831T164600Z-40360`: Gitleaks, TruffleHog, Trivy, Checkov, and KICS returned zero; Snyk reported zero results in changed paths; Terrascan checked 785 policies with zero violations and returned its repository-wide JSON parser status 4.
- The quality ratchet remained `FAIL` with exactly the same pre-existing baseline on both the clean parent and dependency candidate: 4 god components vs floor 3, 1 hardcoded color vs floor 0, and score 9.0 vs floor 9.2. No threshold, ledger, scanner, or source suppression was changed.

## Release Boundary

The dependency replacement remains `UNVERIFIED` for release until full repository/build/security/native gates pass, the exact replacement tip is merged into `origin/main`, and resulting main release/public smokes pass. PR #9 remains open until then.

# Android Release Contract

## Owner-Approved Production Amendment — 2026-09-10

At `2026-09-10T01:50:52Z` the owner explicitly requested release “для всех пользователей”. The verified target is now `com.zenflow.app`, Google Play **Production, 100%**, not Internal testing. This supersedes the historical internal-only track and additional action-time confirmation clauses below. It does not waive the preconditions, exact-artifact checks, source/CI gates, signing identity or truthful reporting of Play review and availability. No other application or account is in scope. The three exact fireplace masters are selected in `docs/audio/fireplace-pagdev-provenance.json`; formal listening details are not fabricated.

## Preconditions

- The owner has approved all ten exact audio hashes.
- Feature and full release gates pass with no task-attributable failure.
- The PR is merged and local `main` exactly equals `origin/main`.
- The maximum existing Play version code is inspected immediately before choosing the new code.
- The existing authorized upload key is available without exposing its secret material.

## Artifact Binding

Record package name, version name/code, source commit, AAB path/hash, signing-certificate digest, and the generated delivery APK/base hash used for runtime verification.

## Console Boundary

- Upload only the exact bound AAB.
- Select Production with the owner-requested 100% audience; do not create unrelated tracks or change availability countries, pricing or store/account policy declarations.
- Release notes describe the existing Focus-only page, manual music navigation and three fireplace variants without therapeutic, cultural-authenticity or unsupported performance claims.
- The 2026-09-10 owner message authorizes this release action; ask again only for a materially different permission or target.
- After submission, verify version code, status, track, artifact identity and availability; record processing, review or rejection truthfully. Submission does not mean users can already download it.

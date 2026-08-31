# Epic 002 Evidence Contract

Evidence in this directory is scoped to the exact branch, command, commit, platform, and artifact named by each row. A status is one of:

- `VERIFIED`: the stated check ran successfully in the stated scope.
- `FAIL`: the stated check ran and failed.
- `UNVERIFIED`: material evidence was unavailable or not run.
- `SKIP`: intentionally not run with a specific reason; never equivalent to pass.

## Required red/green receipt fields

- UTC timestamp
- exact Git commit or explicit dirty-worktree state
- command
- test file count and test count when applicable
- expected contract failure for RED, or exact exit/result for baseline and GREEN
- affected requirements, surface, and platform scope
- artifact path or bounded output summary
- remaining risk and next closure step

## Forbidden evidence content

No journal text, ciphertext, key, credential, token, raw record identifier, stable user identifier, filename derived from user content, production-derived record, full environment dump, secret-bearing configuration, or fabricated runtime/human result.

Isolated test fixtures may use obvious canary values solely to prove that private values do not reach UI, logs, analytics, intents, receipts, or production bundles. Fixture values and factories stay under test-only paths.

## Claim boundaries

- Source inspection is not runtime proof.
- A passing focused test proves only its named contract.
- A build is not visual, native-device, accessibility-device, artistic, user-acceptance, deploy, or production-data proof.
- A subagent report is a review input, not main-agent proof.
- Evidence from a different commit or target is rejected.
- Missing proof remains `UNVERIFIED`; it is never filled with plausible text.

## Artifact discipline

Artifact-sensitive build and bundle checks run sequentially. Receipts record hashes/paths without committing generated bundles unless an existing repository contract requires a reviewed artifact. The real-account password removal is performed only by the user after just-in-time confirmation.

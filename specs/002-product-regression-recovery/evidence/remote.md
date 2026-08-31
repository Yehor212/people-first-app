# Remote Delivery Evidence: Epic 002

**Captured**: 2026-08-03
**Current status**: `UNVERIFIED` — no Epic 002 commit, push, pull request, merge, deployment, or public-runtime observation exists at this capture

## Required binding

Remote evidence is accepted only when all of these identities match:

- branch `codex/002-product-regression-recovery`;
- the full pushed commit SHA;
- GitHub pull-request head SHA;
- each required workflow head SHA;
- the capability receipt `sourceCommit` and explicit target;
- the deployed Pages build/version identity for any public claim.

A workflow from `main`, a prior feature commit, a rerun against a superseded SHA, or a local build cannot fill this packet.

## Delivery state

| Evidence | Status | Closure path |
| --- | --- | --- |
| Reviewable Epic commits | `UNVERIFIED` | Read commit-pipeline guidance, create a fresh bounded `.verification-done`, stage only reviewed Epic files, and commit without history rewrite |
| Branch push | `UNVERIFIED` | Fetch, verify divergence/remote target, then push without force |
| Pull request | `UNVERIFIED` | Create a reviewable PR that explains the Wave 1/2/3 boundaries and keeps the ceremony off |
| Exact-head CI | `UNVERIFIED` | Wait for every required workflow on the final PR head SHA; record failures without weakening tests or scanners |
| Merge authorization | `UNVERIFIED` | A PR does not authorize merge or deployment |
| Public GitHub Pages runtime | `UNVERIFIED` | After an authorized merge/deploy, verify a cache-busted URL and bind the loaded build identity to the deployed SHA |
| Real-account password removal | `UNVERIFIED` | The user reviews the just-in-time warning and initiates the action on the accepted build; no agent handles credentials or triggers it automatically |

## Non-recursive evidence rule

If this tracked file is updated with remote CI results, that update creates a new commit and therefore requires CI on the new exact head. The final delivery report may instead retain immutable GitHub URLs and exact SHA/status evidence outside the commit when adding it here would create an endless evidence-only commit loop.

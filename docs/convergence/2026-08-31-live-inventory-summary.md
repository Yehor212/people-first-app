# ZenFlow Live Convergence Inventory — 2026-08-31

## Status

This document is a sanitized index of the private live snapshot. It is not a merge, cleanup, or deletion authorization. No source is classified `TAKE`, `SUPERSEDED`, `QUARANTINE`, or deletion-ready here.

- Released canonical `main`: `b2341c0ca405e2f32892e4e96be86474290abe63`
- Snapshot time: `2026-08-31T14:35:20.675Z`
- Private schema: `zenflow-convergence-inventory/v1`
- Private inventory alias: `private-live-inventory/inventory.json`
- Inventory SHA-256: `dea957cdc97c174a2863ba7c968827f4d40bf678a191b27393b62da3bd4d75ce`
- Private summary alias: `private-live-inventory/summary.json`
- Summary SHA-256: `27014126d6b15c143270dd1c562577f6546e81c29eb0b29a0c00cc578598aedf`
- Private directory mode: `0700`; private file modes: `0600`
- Raw home paths, credential-bearing remotes, file contents, and `.env*` locators: absent from the private JSON validation scan

The private files stay outside every repository. Their exact local locator is intentionally omitted from Git.

## Topology

| Registry alias | HEAD | Registered worktrees | Current state |
| --- | --- | ---: | --- |
| `legacy` | `13ca51a80d23220574deba762851fe5a32372e46` | 76 | `ACTIVE_SKIP`; local `main` is 137 commits behind released main |
| `canonical` | `b2341c0ca405e2f32892e4e96be86474290abe63` | 4 | clean control `main` plus isolated convergence lanes |
| `zenflow/people-first-app-main` | `ae3411acbad605dad9f2966b3500546866b44b43` | 1 | stable tracked state; 11 ignored build/dependency paths |

Total registered worktrees across the three Git common directories: **81**.

## Writer And Local-State Gate

| Disposition | Count | Evidence |
| --- | ---: | --- |
| `ACTIVE_SKIP` | 2 | process CWD and open-handle evidence |
| `FROZEN` | 78 | two equal `HEAD`/status observations plus no observed open handle at capture time |
| `UNVERIFIED` | 1 | registered locked path is absent, so filesystem status cannot be proved |
| Non-ignored dirty | 50 | tracked/untracked `git status` entries |
| Ignored local state | 77 | separate bounded `--ignored --untracked-files=normal` probe |
| Any local state | 77 | union of non-ignored and ignored state |

The active sources are:

- `legacy/.`: branch `main`, HEAD `13ca51a80d23220574deba762851fe5a32372e46`, 6 non-ignored changes, 316 ignored entries, 78 observed process identities with CWD and/or handle evidence. This includes the VS Code window and Codex/MCP processes. It remains `ACTIVE_SKIP`.
- `zenflow/worktrees/codex-convergence-ledger-20260831`: current inventory implementation lane, 7 non-ignored changes and 2 ignored entries at capture time. It remains `ACTIVE_SKIP` until committed and released.

The unverified registry entry is `zenflow/worktrees/codex-t222-r-ads-off-20260819`, branch `codex/t222-r-ads-off`, HEAD `ad8a04c3541ee919ed83fbcfbff90f1307611b8e`. Its worktree path is absent while the registry entry remains locked. The branch object remains the recovery locator; registry repair or removal is forbidden until semantic and recovery review finishes.

## Ref Inventory

The three registries contain **259 logical ref names** and **262 distinct name-plus-SHA variants**. Variant counts are retained because stale registries can point the same ref name at different objects.

| Classification | Ref variants | Meaning |
| --- | ---: | --- |
| `IN_MAIN` | 102 | ref has zero commits ahead of pinned released main |
| `PATCH_EQUIVALENT` | 18 | every ahead patch has an equivalent patch in main and no unaccounted merge commit |
| `UNIQUE_COMMITS` | 142 | at least one unique patch or non-patch merge commit requires semantic review |
| `UNRELATED` | 0 | no merge-base/relation failure in the captured ref set |

`git cherry` does not count merge commits. The inventory therefore stores `nonPatchCommitCount` separately and never calls a ref patch-equivalent when an ahead merge commit is unaccounted for.

## Open Human Pull Requests

All seven human-authored PRs are currently conflicting with `main`; none may be merged wholesale.

| PR | Head | Exact SHA | History class | Next gate |
| ---: | --- | --- | --- | --- |
| 73 | `codex/converge-non-active-20260827` | `f86328cde7ae85a7582c252af813eca7ad092ef0` | `UNIQUE_COMMITS` (15) | semantic per-fix comparison |
| 70 | `codex/first-party-audio-reconstruction-v5` | `434886adf22c3dcbca6f83cb675a1e1fb0e15af3` | `UNIQUE_COMMITS` (24) | compare against released Python clean-room pipeline and provenance rules |
| 68 | `codex/cc0-kimi-audio-reconstruction` | `9f7e037a24a26793932a4d0dbb63341b03823a74` | `PATCH_EQUIVALENT` (19) | verify exact public artifact equivalence, then supersession review |
| 67 | `codex/android-2-1-play-release-candidate-20260820` | `6b9cd810731207bf3968980ece9affdcb99a44b9` | `UNIQUE_COMMITS` (3) | compare Ads-OFF/security dependency intent with current release contracts |
| 53 | `kimi/main-green-ratchet-god-components` | `3e1197bd6f4159e99ce15bb72775ebf55a963719` | `UNIQUE_COMMITS` (3) | Codex-only semantic salvage; retired Kimi namespace is not authorization |
| 31 | `codex/batch-diary-native-test-gaps` | `fcfb557d544d9eb423f2968382fde161e788820d` | `UNIQUE_COMMITS` (2) | compare native/diary tests against current platform implementation |
| 28 | `codex/webgpu-orb-evidence-batch` | `118cf7cf60c72a8a4a2500eb33ccbe38865ae39e` | `UNIQUE_COMMITS` (6) | isolate WebGPU evidence from later-retired agent-orchestra files and frozen orb constraints |

## Open Bot Pull Requests

There are **15** open bot PRs. They are stale against the current lockfile and main history. They must be evaluated from current package/action versions and regenerated lockfile behavior; merging their months-old lockfiles or workflow files wholesale is forbidden.

## Next Decisions

1. Produce content-addressed preservation packets for each non-ignored dirty `FROZEN` source. `ACTIVE_SKIP` sources wait for writer release; the missing locked worktree uses its branch object as the initial recovery anchor.
2. Deduplicate the 142 unique ref variants by commit tip, changed-path manifest, and semantic overlap.
3. Adjudicate the seven human PRs first, one product domain at a time, using `TAKE`, `IN_MAIN`, `PATCH_EQUIVALENT`, `SUPERSEDED`, or `QUARANTINE` only after exact evidence.
4. Re-evaluate dependencies from current manifests and official release data instead of merging stale Dependabot patches.
5. Integrate selected work through new clean Codex lanes and protected PRs; rerun Web/PWA, Android, iOS, Desktop, privacy, audio, and visual gates for every affected domain.
6. Delete refs, PRs, worktrees, clones, ignored output, and private packets only after every source has recovery proof, no active handle, and an explicit final cleanup ledger row.

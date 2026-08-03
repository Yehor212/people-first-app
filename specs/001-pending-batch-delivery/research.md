# Research: Safe Delivery of the Preserved Pending Batch

## Evidence sources

- Local Git object database and worktree state for commit/tree/blob identity.
- `AGENTS.md`, `ARCHITECTURE.md`, and task-relevant files under `docs/ai/` for binding project constraints.
- `.specify/zenflow-install-manifest.json` for official Spec Kit provenance and pinned generator state.
- Official release record `https://github.com/github/spec-kit/releases/tag/v0.15.1`, recorded as stable (`draft=false`, `prerelease=false`) in the installation manifest.
- `.github/workflows/`, `package.json`, and repository scripts for the actual CI and local verification contract.
- Fresh CLI, GitHub CLI, test, scanner, build, browser, and CI results retained in the feature evidence packet.

## Decision 1 - Preserve through an immutable commit in an isolated worktree

**Decision**: Capture the legitimate pending tree as a Git commit and perform integration in a dedicated worktree.

**Rationale**: A commit provides content-addressed recovery and path-level comparison while the isolated worktree prevents testing, generated artifacts, merges, and hooks from mutating the user's original checkout.

**Rejected alternatives**:

- Commit directly on the dirty owner checkout: would alter the user's active branch and ignored guard state.
- Stash the batch: less reviewable, easier to drop, and unsuitable for retaining exact lineage through the final merge.
- Copy the repository or clone Spec Kit into it: duplicates untrusted state, loses Git object identity, and violates the requested installation boundary.

## Decision 2 - Preserve snapshot lineage with merge commits

**Decision**: Merge current `origin/main` into the snapshot lineage, then merge the pull request without squashing.

**Rationale**: The snapshot stays an ancestor of the final `main` commit, conflicts are explicit, and rollback can target the merge without rewriting history.

**Rejected alternatives**:

- Rebase the 893-path snapshot: rewrites the safety lineage and increases the risk of repeatedly resolving a broad conflict set.
- Squash merge: produces a final tree but discards the requested recoverable snapshot history.
- Force-push to `main`: bypasses review/protection and is outside authorization.

## Decision 3 - Reconcile by tree identity, not filename presence

**Decision**: Compare each snapshot path's mode/type/object identity among the snapshot, integrated checkpoint, and `origin/main`.

**Rationale**: A path can already exist upstream with identical content, be intentionally superseded, remain a net user change, or require an integrated resolution. Filename-only accounting cannot distinguish these states.

**Result at checkpoint `d0fa0cc3acf267c4374d392c98642daa25ddc1ec`**: 703 already in main, 115 preserved net changes, 53 superseded by main, and 22 integrated resolutions; total 893.

## Decision 4 - Resolve binaries by evidence and provenance

**Decision**: For ten conflicting feedback audio binaries, keep the deterministic, provenance-backed current-main artifacts. Preserve independent non-conflicting sound assets from the pending batch.

**Rationale**: The larger recovered binaries lacked generation/release receipts. File size or subjective expectation is not sufficient evidence to replace a reviewed artifact.

**Unresolved evidence**: Listening quality, human artistic acceptance, and device playback remain `UNVERIFIED` until separately observed.

## Decision 5 - Keep stale live-readiness claims unverified

**Decision**: Replace stale journal magic-link pass claims with an `UNVERIFIED` status bound to the integrated source hash.

**Rationale**: Neither historical proof hash matched the integrated implementation. Preserving the historical receipt is useful; converting it into current proof would fabricate readiness.

**Rejected alternative**: Run a live authenticated proof automatically. It would require credentials and external service effects beyond this Git delivery's authority.

## Decision 6 - Use official core Spec Kit only

**Decision**: Retain Specify CLI 0.15.1, Codex as installed/default integration, `sh` scripts for macOS, and the ten official core `speckit-*` skills. Do not install optional extensions.

**Rationale**: This matches the verified stable official release and the existing installation manifest. Optional extensions add code and side-effect surfaces without helping this delivery.

**Rejected alternatives**:

- Install every available skill/plugin or invoke ten project agents: unnecessary scope and no substitute for repository evidence.
- Treat file presence as Codex availability: runtime discovery must be probed separately.

## Decision 7 - CI is a required state machine, not a single command

**Decision**: Run the repository's broad preflight locally, push normally, inspect every pull-request check, fix deterministic failures, merge only when required checks are green, and then observe `main` workflows.

**Rationale**: Local tests cannot prove GitHub permissions, runner environment, branch protection, release jobs, or post-merge behavior.

**Failure handling**: Inspect logs before rerun. Reproduce suspected inherited failures on clean `origin/main`. Never weaken a policy, assertion, scanner, exclusion, or threshold for green output.

## Decision 8 - Run build and bundle-integrity scans sequentially

**Decision**: Ensure only one process mutates `dist/` while production-data and artifact inventories are checked.

**Rationale**: Concurrent build/check processes can produce a false or real duplicate/inventory-change failure, including duplicate `dist/.nojekyll` reports. Sequential execution provides a stable artifact boundary.

## Security and privacy conclusion

The task requires repository publication but no production user data. Test fixture strings may be synthetic only inside isolated tests and must not resemble active credentials to secret scanners. Scanner output is evidence, not permission to expose matching content. No raw local credentials, journal content, production dumps, or authenticated request payloads are inspected or committed.

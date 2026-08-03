# Feature Specification: Safe Delivery of the Preserved Pending Batch

**Spec Kit Feature ID**: `001-pending-batch-delivery`
**Git Delivery Branch**: `codex/pending-898-speckit-batch`
**Created**: 2026-08-02
**Status**: In progress
**Input**: Preserve, reconcile, verify, commit, push, and safely merge the complete pending ZenFlow working-tree batch through the official Spec Kit workflow without losing existing work or causing GitHub CI to fail.

## Scope and Evidence Boundary

The source checkout contained 898 Git status records at commit `00fdb2ea0e5205f4bee76bbec3109bf98865627f`. Five records were generated `.dccache` artifacts and are intentionally excluded. The remaining 893 paths are preserved by snapshot commit `c902b612050dd891e5aa86958ebf8bb7f2e9f5ba`; their sorted, NUL-delimited path-set SHA-256 is `7ce230f3b7ced01573bd20be1e1e2f88a618e5658fc2020f19b50ec4ee7a6efe`.

This delivery may change repository files, Git history, the feature branch, the pull request, and `main` after required checks pass. It does not authorize production database writes, live user-data mutation, destructive migrations, deployment bypasses, fabricated runtime records, force-pushes, or branch-protection bypasses.

## User Scenarios and Testing

### User Story 1 - Preserve every legitimate pending change (Priority: P1)

As the sole repository owner, the user needs every legitimate pending path preserved in recoverable Git history before integration work begins, while generated cache artifacts are excluded.

**Why this priority**: Losing any uncommitted user work is irreversible and more severe than a delayed delivery.

**Independent Test**: Recompute the path set from the original parent to the snapshot commit and confirm the exact count and SHA-256; confirm that the original checkout still has the recorded HEAD and status digest.

**Acceptance Scenarios**:

1. **Given** 898 original status records, **when** the safety snapshot is inspected, **then** exactly 893 legitimate paths are present and exactly five `.dccache` artifacts are excluded.
2. **Given** the isolated delivery worktree, **when** integration, testing, commits, and pushes occur, **then** the owner checkout remains on its original HEAD with an unchanged status digest.
3. **Given** a failed integration or CI run, **when** rollback is required, **then** the snapshot commit remains reachable without resetting or rewriting the owner checkout.

---

### User Story 2 - Reconcile the batch with current `main` without regression (Priority: P1)

As a ZenFlow user, I need the accumulated product, accessibility, recovery, audio, journal, agent-governance, and cross-platform changes integrated with the current repository rather than blindly overwriting newer upstream work.

**Why this priority**: The batch crosses protected surfaces and user-visible flows; a syntactically successful merge can still regress storage, accessibility, localization, security, or recovery.

**Independent Test**: Classify all 893 snapshot paths against the integration checkpoint and current `origin/main`, inspect every conflict resolution, and run focused plus broad checks for each affected domain.

**Acceptance Scenarios**:

1. **Given** the 893-path snapshot and current `origin/main`, **when** reconciliation is computed, **then** every path is assigned exactly once to `already_in_main`, `preserved_net_change`, `superseded_by_main`, or `integrated_resolution`, and category counts sum to 893.
2. **Given** conflicting product or governance files, **when** they are resolved, **then** current authoritative rules and safer upstream behavior are retained while non-conflicting user work remains present.
3. **Given** unavailable live journal evidence, **when** readiness status is recorded, **then** it remains `UNVERIFIED` rather than being converted into a fabricated pass.
4. **Given** production runtime paths, **when** the final bundle and source are scanned, **then** no mock, demo, synthetic, placeholder, or fallback business records become production-reachable.

---

### User Story 3 - Publish only a reviewable, CI-green change (Priority: P1)

As the repository owner, the user needs a branch and pull request that retain the safety snapshot in history, pass required local and GitHub checks, and merge without bypassing protections.

**Why this priority**: A push alone does not establish release safety; the repository's CI and protected merge rules are part of the requested outcome.

**Independent Test**: Push the isolated branch, create a pull request, wait for every required GitHub check, remediate failures with fresh evidence, merge using a merge commit, and observe the post-merge `main` checks.

**Acceptance Scenarios**:

1. **Given** a clean isolated worktree and final evidence packet, **when** the branch is pushed, **then** no force push or hook bypass is used.
2. **Given** an open pull request, **when** any required check fails, **then** the failure is investigated and fixed before merge; a failure inherited from `main` is reproduced on a clean base before attribution.
3. **Given** all required checks are green, **when** the pull request is merged, **then** a merge commit retains snapshot lineage and the resulting `main` SHA is verified.
4. **Given** the merged SHA, **when** post-merge workflows finish, **then** required workflows are green or the delivery remains explicitly blocked rather than being reported successful.

---

### User Story 4 - Make the workflow reusable from Codex (Priority: P2)

As a vibe coder, the user needs Codex to discover the repository-local Spec Kit skills and turn a short request into grounded specification, clarification, planning, tasking, analysis, implementation, and convergence work.

**Why this priority**: Repository files alone do not prove the Codex runtime can discover or invoke the installed skills.

**Independent Test**: Confirm `specify integration list`, validate manifests, and run an isolated Codex discovery probe that enumerates the repository-local `speckit-*` skills without mutating product code.

**Acceptance Scenarios**:

1. **Given** the repository root, **when** Specify CLI integration is queried, **then** Codex is installed and selected as the default integration.
2. **Given** a fresh Codex runtime probe rooted at this repository, **when** available skills are inspected, **then** the expected `speckit-*` skills are discoverable.
3. **Given** a small local fix, **when** routing is applied, **then** the shortened Spec Kit path is used; non-trivial or high-risk work receives the full or strengthened path defined by `AGENTS.md`.

### Edge Cases

- The owner checkout changes while the isolated branch is being prepared: stop before merge/push reconciliation, recalculate the status digest, and preserve the new state separately.
- A snapshot path was independently added to current `main`: classify it by tree identity instead of treating it as missing work.
- A binary conflict has no trustworthy provenance or release receipt: retain the verified upstream artifact and record the unresolved artistic/source claim as `UNVERIFIED`.
- A generated artifact appears twice in the production bundle, including `dist/.nojekyll`: treat checker exit 2 or duplicate inventory as blocking; rebuild and run bundle integrity checks sequentially.
- A secret scanner flags a test-only token: replace the scanner-shaped literal without weakening the test, then rerun both secret scanners.
- A live-service check needs credentials or would write production data: do not synthesize proof; leave the claim `UNVERIFIED` unless separately authorized and safely isolated.
- Native or store behavior cannot be exercised on a real device/store: preserve platform-specific automated evidence but keep device/store claims `UNVERIFIED`.
- Branch protection or GitHub infrastructure is unavailable: do not bypass protections; retain the branch and report the exact external blocker.
- A required GitHub check is flaky: rerun only after inspecting the log and confirming no deterministic repository failure is being hidden.
- A law-document path is present: exclude it from commit and push in accordance with repository policy.

## Requirements

### Explicit Requirements

- **ER-001**: The complete original pending batch MUST be preserved before integration.
- **ER-002**: Official Spec Kit MUST govern the delivery and remain integrated with Codex.
- **ER-003**: Existing project instructions, skills, hooks, and product architecture MUST be preserved and reconciled rather than overwritten blindly.
- **ER-004**: The repository branch MUST be committed and pushed, and GitHub CI MUST be verified before success is declared.
- **ER-005**: Production data MUST NOT be replaced, fabricated, or mutated as part of this delivery.

### Implied Requirements

- **IR-001**: Work MUST occur in an isolated worktree and branch so the original 898-record checkout is not mutated.
- **IR-002**: The safety snapshot MUST be immutable, content-addressed, and retained in merged history.
- **IR-003**: Every snapshot path MUST have a deterministic reconciliation disposition; omissions are not allowed.
- **IR-004**: Conflict resolutions MUST be based on architecture, policy, tests, and artifact provenance rather than newest-timestamp or blanket side selection.
- **IR-005**: Generated caches, secrets, private user data, prohibited law documents, conflict markers, and duplicate bundle artifacts MUST NOT enter the published change.
- **IR-006**: The final tree MUST pass relevant type, test, lint, localization, accessibility, production-data, security, build, bundle, governance, Spec Kit, and release checks.
- **IR-007**: UI and motion work MUST keep technical, rendered-runtime, accessibility/reduced-motion, and artistic/craft evidence separate.
- **IR-008**: Web/PWA, Android, iOS, Desktop/Tauri, store/release, accessibility, performance, security/privacy, testing, and operations impacts MUST each be assessed; unavailable evidence MUST remain `UNVERIFIED`.
- **IR-009**: GitHub publication MUST use normal hooks and protections, with no `--no-verify`, force push, admin bypass, or history rewrite.
- **IR-010**: The final merge MUST preserve the multi-commit snapshot lineage; squash merge is not acceptable for this batch.
- **IR-011**: The owner checkout's original HEAD, status digest, ignored tokens, and file modes MUST be restored and reverified after publication.
- **IR-012**: Spec Kit availability MUST be proven by both CLI configuration and an actual Codex discovery probe.

### Key Entities

- **Owner Checkout Baseline**: Original HEAD, branch, 898-record status set, stable digest, and ignored guard-token fingerprints that must remain unchanged.
- **Safety Snapshot**: Commit containing the 893 legitimate pending paths and its path-set digest.
- **Excluded Artifact**: One of five generated `.dccache` paths intentionally omitted from the safety snapshot and final tree.
- **Reconciliation Disposition**: Exactly one classification for each snapshot path: already present upstream, preserved as a net change, superseded by authoritative upstream content, or integrated by an explicit resolution.
- **Verification Receipt**: Fresh command, scope, exit status, counts, and limitations; it never upgrades unavailable runtime or human evidence.
- **Delivery Branch and Pull Request**: Reviewable Git lineage that retains the snapshot, integration, and verification commits.
- **CI Check**: A GitHub workflow/job result bound to the pull-request or merged SHA.

## Platform and Quality Matrix

| Surface | Required evidence for this delivery | Current state |
|---|---|---|
| Web/Vite | Typecheck, lint, unit/integration tests, production build, bundle integrity, targeted browser/runtime checks | In progress |
| PWA | Manifest/service-worker/build checks and affected offline/recovery tests | In progress |
| Android/Capacitor | Source/config checks, affected native tests/build when available, back/safe-area impact review | In progress |
| iOS/WKWebView | Source/config checks and affected behavior review; real-device evidence required for device claims | In progress; device evidence `UNVERIFIED` |
| Desktop/Tauri | Source/config checks and affected desktop behavior review | In progress |
| Store/Release | Release artifact gates and GitHub workflow results; no store submission is authorized | In progress; store acceptance `UNVERIFIED` |
| Accessibility | Automated tests, reflow/keyboard/RTL/reduced-motion review, targeted rendered evidence | In progress |
| Performance | Existing performance budgets and relevant smoke checks; no unsupported device-performance claim | In progress |
| Security and Privacy | Secret scans, dependency audit, static security scan, production-data integrity, no PII inspection | In progress |
| Testing | Focused regression tests plus broad repository checks with exact counts | In progress |
| Operations | Rollback, branch protection, CI monitoring, post-merge verification, owner-checkout restoration | In progress |

## Success Criteria

- **SC-001**: Recomputed snapshot inventory equals 893 paths with path-set SHA-256 `7ce230f3b7ced01573bd20be1e1e2f88a618e5658fc2020f19b50ec4ee7a6efe`.
- **SC-002**: Reconciliation categories contain 703 already-in-main paths, 115 preserved net changes, 53 upstream-superseded paths, and 22 integrated resolutions, summing to 893 at checkpoint `d0fa0cc3acf267c4374d392c98642daa25ddc1ec`.
- **SC-003**: The original owner checkout returns to HEAD `00fdb2ea0e5205f4bee76bbec3109bf98865627f` with status digest `c27da64f8305c01fe29c2081dbc33c8486f784abfdb269db54f8f76cb46cb56a` after the task.
- **SC-004**: The final published diff contains no `.dccache`, prohibited law documents, unresolved conflict markers, verified secrets, or production-reachable fabricated business data.
- **SC-005**: All repository-required local checks applicable to the 143-path integration checkpoint and subsequent Spec Kit evidence changes pass, with exact failures or unavailable checks recorded.
- **SC-006**: Specify CLI reports Codex installed/default and a fresh Codex runtime probe discovers the repository-local Spec Kit skills.
- **SC-007**: Every required pull-request check is green before merge, and every required post-merge check for the resulting `main` SHA is green before completion.
- **SC-008**: Git history on `main` retains snapshot commit `c902b612050dd891e5aa86958ebf8bb7f2e9f5ba` as an ancestor through a non-squashed merge.
- **SC-009**: No test, scanner, policy, threshold, or branch protection is weakened to obtain a green result.

## Clarifications and Decisions

### Session 2026-08-02

- **Decision**: Use a dedicated worktree and `codex/pending-898-speckit-batch`; do not commit directly from the dirty owner checkout.
- **Decision**: Treat the user's repeated authorization as permission to create commits, push the branch, open a pull request, and merge only after normal required checks pass. It does not authorize production-data writes or protection bypasses.
- **Decision**: Preserve the full snapshot commit and use a merge commit. A squash merge would discard the requested recoverable snapshot lineage.
- **Decision**: Prefer current authoritative `origin/main` content for conflicts only when it is safer or better evidenced; preserve independent pending work and document integrated resolutions.
- **Decision**: Keep journal magic-link live readiness `UNVERIFIED` because existing proof hashes do not match the integrated source; do not fabricate or retroactively bless live evidence.
- **Decision**: Generated `.dccache` files are not user work and are excluded. Their ignore rule remains in the final tree.
- **Decision**: No production deployment, store submission, database migration, live sync smoke, or authenticated user-flow write is part of this Git delivery.

## Assumptions

- GitHub remains reachable and the authenticated `Yehor212` account retains repository and workflow permissions during publication.
- `origin/main` at `4aff30811d370981e1c8192cea753159e883c4d2` is the integration base; any later movement will be fetched and reconciled before merge without rewriting the owner checkout.
- Existing repository test fixtures remain isolated from production runtime; scanner-shaped test literals may be rewritten without changing test intent.
- Human artistic approval, physical-device behavior, store acceptance, and live-service readiness cannot be inferred from local automated tests and remain `UNVERIFIED` unless fresh evidence becomes available.

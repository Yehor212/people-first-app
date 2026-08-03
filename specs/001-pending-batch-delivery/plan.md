# Implementation Plan: Safe Delivery of the Preserved Pending Batch

**Spec Kit Feature ID**: `001-pending-batch-delivery`
**Git Branch**: `codex/pending-898-speckit-batch`
**Date**: 2026-08-02
**Spec**: [spec.md](./spec.md)

## Summary

Preserve the user's original 898-record working tree without modifying it, retain the 893 legitimate paths in an immutable snapshot commit, reconcile them with current `origin/main`, verify the integrated ZenFlow tree across affected domains, and publish through a normal pull request and merge-commit workflow. The implementation uses an isolated Git worktree, deterministic tree/blob comparisons, repository-native checks, two independent secret scanners, official Specify CLI/Codex integration checks, and GitHub check monitoring. No production service or user data is read or written.

## Technical Context

**Language/Version**: Node.js 22.22.0; TypeScript 5.8.3; shell scripts generated for Darwin `sh`
**Primary Dependencies**: React 18.3.1, Vite 8.0.16, Capacitor 8.0.0, Tauri CLI 2.11.3, Dexie 4.4.2, Zustand 5.0.12, official Specify CLI 0.15.1
**Storage**: ZenFlow runtime uses IndexedDB/Dexie as local truth with Supabase-backed remote flows; this delivery performs no production storage writes
**Testing**: Vitest, TypeScript project checks, ESLint/Oxlint, repository policy validators, production-data integrity scans, build/bundle gates, secret scanners, GitHub Actions
**Target Platform**: Web/Vite, installed PWA, Android/Capacitor, iOS/WKWebView, Desktop/Tauri, GitHub pull-request and `main` workflows
**Project Type**: Cross-platform React application with native wrappers, serverless functions, generated governance assets, and repository-local agent tooling
**Performance Goals**: Preserve existing bundle-size, startup/runtime, canonical-orb, audio, and CI ratchet thresholds; do not trade visual quality or accessibility for a green metric
**Constraints**: Preserve owner checkout; account for all 893 snapshot paths; exclude five `.dccache` artifacts; no fabricated production records, secrets, force push, squash merge, policy weakening, or protected-branch bypass
**Scale/Scope**: 898 original status records; 893 legitimate snapshot paths; 143 net paths at integration checkpoint before this feature packet; protected UI, storage, auth, recovery, audio, governance, scripts, tests, and documentation surfaces

## Constitution Check

The status gate reports version `1.0.1`, `PROPOSAL_CRITERIA_ONLY`, `ratified=false`, `binding=false`, and `blocking_authority=false`. Therefore the constitution is reviewed as advisory criteria only. The binding gates below come independently from `AGENTS.md`, `ARCHITECTURE.md`, and the referenced project policies.

### Pre-design gate

| Gate | Authority | Result and handling |
|---|---|---|
| Preserve local truth and production-data integrity | `AGENTS.md`; `docs/ai/PRODUCTION_DATA_INTEGRITY_POLICY.md` | PASS by design: no production writes; source, staged, build, and bundle scans required |
| Isolate broad/protected work | `AGENTS.md`; `docs/ai/AGENT_CHANGE_GOVERNANCE.md` | PASS: dedicated worktree, L4 notice, snapshot commit, rollback refs |
| Test-first evidence | `AGENTS.md`; `docs/ai/TEST_FIRST_AGENT_POLICY.md` | PASS by characterization baseline: the work begins from preserved source/tree evidence; behavior changes receive focused regression tests |
| Full best-practices matrix | `docs/ai/BEST_PRACTICES_IMPLIED_REQUIREMENTS_GATE.md` | PASS in specification; platform gaps remain `UNVERIFIED`, not inferred |
| No generic or fabricated output | `docs/ai/NO_AI_TEMPLATES_AGENT_POLICY.md` | PASS in artifact design: all requirements bind to current commits, files, counts, and project checks |
| Spec Kit availability | User requirement and active `AGENTS.md` routing | CLI/manifests verified; fresh Codex runtime discovery remains a required execution task |
| External publication authority | Direct user authorization | PASS for commit, push, PR, and protected merge after green checks; production/deployment writes remain out of scope |

### Post-design re-check

The design keeps one repository, one isolated branch, one recoverable snapshot lineage, and existing project architecture. It introduces no competing runtime store, API, service, dependency, or UI abstraction. The only new durable artifacts are the Spec Kit feature packet and scanner-safe test fixture adjustments required by verification. No advisory constitution consideration conflicts with the active policies.

## Project Structure

### Documentation and evidence for this feature

```text
specs/001-pending-batch-delivery/
├── spec.md
├── plan.md
├── research.md
├── data-model.md
├── quickstart.md
├── tasks.md
├── analysis.md
├── convergence.md
├── contracts/
│   └── delivery-evidence.schema.json
├── tools/
│   └── codex-skill-discovery-probe.cjs
├── checklists/
│   └── requirements.md
└── evidence/
    ├── reconciliation.json
    └── verification.json
```

### Existing repository surfaces in the batch

```text
.agents/skills/             # Codex-discoverable Spec Kit skills
.specify/                   # Official Spec Kit core, manifests, scripts, templates, constitution proposal
.codex/                     # Agent definitions, hooks, runtime policy
.github/workflows/          # Pull-request and main CI/release enforcement
src/                        # React application, stores, storage, auth, journal, settings, audio, UI
android/                    # Capacitor Android wrapper and native tests
ios/                        # Capacitor iOS/WKWebView wrapper
src-tauri/                  # Desktop/Tauri wrapper
supabase/functions/         # Serverless functions and isolated tests
scripts/                    # Deterministic validation and release tooling
docs/ai/                    # Binding agent, integrity, UX, runtime, and release policies
```

**Structure Decision**: Keep all product and platform code in its current architecture. Add only the feature-scoped Spec Kit documents under `specs/001-pending-batch-delivery/`; use existing scripts and tests instead of introducing a delivery framework.

## Implementation Phases

### Phase 0 - Provenance and safety baseline

1. Record owner HEAD, branch, porcelain-v2 status count/digest, ignored guard-token hashes, remote, and authenticated GitHub identity.
2. Create the isolated worktree and snapshot 893 legitimate paths, excluding five generated caches.
3. Verify snapshot path count/digest and preserve commit/tree identifiers.

### Phase 1 - Reconciliation design and execution

1. Fetch current `origin/main` without changing the owner checkout.
2. Merge current main into the snapshot lineage.
3. Resolve conflicts file-by-file from architecture, policy, tests, and artifact provenance.
4. Compute the four-way reconciliation classification for every snapshot path.
5. Keep stale live-readiness evidence `UNVERIFIED`; remove generated cache artifacts and prevent recurrence.

### Phase 2 - Spec Kit lifecycle artifacts

1. Complete specification and explicit clarification decisions.
2. Record technical research, data model, evidence contract, and operator quickstart.
3. Generate the requirement-quality checklist and dependency-ordered task list.
4. Run cross-artifact analysis before completing remaining implementation work.

### Phase 3 - Focused remediation

1. Replace scanner-shaped literals in isolated tests without weakening assertions.
2. Recompute generated architecture/proof data only through repository-owned generators where required.
3. Keep changes minimal and restricted to failures directly evidenced by the integrated batch.

### Phase 4 - Local verification

Run checks in dependency order: static integrity and secret scans; TypeScript and lint; focused tests; full Vitest; localization/accessibility/governance checks; dependency/security scans; production build; then artifact-sensitive bundle scans sequentially. Inspect supplied screenshots separately from automated checks. Record exact exit status/counts and keep native-device, public deployment, store, live-service, and human artistic claims `UNVERIFIED` when not observed.

### Phase 5 - Publication and convergence

1. Inspect final diff/status and create a single verification commit whose message contains `batch`.
2. Run pre-push guards without bypass, push the feature branch, and open a ready pull request.
3. Monitor every required check; investigate and remediate any failure with fresh local evidence.
4. Merge with a merge commit only after required checks are green.
5. Monitor post-merge `main` workflows, verify snapshot ancestry, and restore the owner checkout's ignored guard files byte-for-byte.

## Rollback and Recovery

- Before push: discard only the isolated worktree after confirming snapshot commit reachability; never reset the owner checkout.
- After push but before merge: close the pull request and retain or delete the remote feature branch only after the snapshot commit is tagged/reachable elsewhere.
- After merge: use a normal revert pull request against the merge commit. Do not rewrite `main` history.
- Product/runtime rollback uses existing feature flags and documented migrations; this delivery does not execute production migrations or deployment changes.
- If CI evidence is incomplete, leave the pull request open and report `STOP`; do not reinterpret missing checks as pass.

## Complexity Tracking

No new architectural complexity is introduced. The large path count is inherited from the user's accumulated batch; the dedicated snapshot and reconciliation manifest reduce, rather than expand, the recovery surface.

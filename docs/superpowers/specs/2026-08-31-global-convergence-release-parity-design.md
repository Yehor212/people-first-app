# Global Convergence and Release Parity Design

**Date:** 2026-08-31
**Status:** Owner approved full Kimi workspace-gate retirement and final single-clone cleanup; implementation remains gated by review of this revised written spec
**Base commit:** `ae3411acbad605dad9f2966b3500546866b44b43`
**Canonical remote:** `https://github.com/Yehor212/people-first-app.git`
**Implementation lane:** `codex/global-convergence-20260831`

## Goal

Establish one reviewable production source of truth, preserve every local variant before adjudication, integrate only completed user-intended work, and deliver the resulting exact commit across every shipped ZenFlow platform without treating branch labels, local build success, or partial deployment as release proof.

## User Failure Mode

The owner sees separate `main` and `origin/main` histories in VS Code and cannot tell whether the latest local work is visible to users. The visible workspace is the legacy checkout, not the clean production control clone, so its Git graph mixes an old local `main`, a stale remote-tracking ref, local PDI edits, and a nested dirty worktree. This makes delivered and undelivered work look indistinguishable.

## Explicit Requirements

- Inspect the live Qwen CLI's latest requests and independently verify its claims.
- Combine all completed, production-intended work into one latest version.
- Preserve local changes, branches, commits, and recovery evidence.
- Avoid `reset --hard`, force-push, wholesale branch merging, and unrelated cleanup.
- Use best-practice Git, CI, deployment, and rollback controls.
- Deliver the final release across Web/PWA, Android, iOS, and Desktop.
- Make VS Code show one canonical, understandable production checkout.
- Retire the complete Kimi workspace-gate stack while preserving Codex-only isolation and protected delivery.
- Commit and push every valuable production-intended state before integration, then remove superseded branches, worktrees, and clones after recoverability proof.
- Finish with one local canonical clone on `main`, one remote default branch `main`, and immutable release tags.

## Non-Goals

- Do not merge every historical branch, snapshot, experiment, or Dependabot PR.
- Do not copy the legacy checkout over `main`.
- Do not modify, stop, or delete an active writer's lane without a fresh ownership check.
- Do not publish private receipts, production-derived data, secrets, caches, build output, or quarantine media.
- Do not claim Android, iOS, Desktop, store, or mirror delivery from Web/PWA evidence.
- Do not treat every Kimi-named historical audio/provenance artifact as part of the workspace gate; those records are adjudicated by provenance and release intent.
- Do not remove a branch, worktree, clone, or artifact before its exact value, reachability, active use, recovery path, and final disposition are proved.

## Verified Evidence Snapshot

Evidence is time-sensitive and must be refreshed before every mutation, push, merge, and release gate.

| Item | Status | Evidence |
| --- | --- | --- |
| Live remote `main` | `VERIFIED` | `git ls-remote` returned `ae3411acbad605dad9f2966b3500546866b44b43` |
| Clean production checkout | `VERIFIED` | `/Users/yehor/Projects/ZenFlow/people-first-app-main`: local `main`, `origin/main`, and `HEAD` equal `ae3411ac`; divergence `0 0` |
| VS Code checkout | `VERIFIED` | `/Users/yehor/Documents/Codex/2026-06-10/new-chat/people-first-app`: `main=13ca51a8`, 124 commits behind its stale `origin/main`, five modified paths, one nested dirty PDI worktree |
| Current Web/PWA deployment | `VERIFIED` | GitHub Pages run `33355227906` succeeded on `ae3411ac`; build, Android gate, iOS gate, deploy, public privacy smoke, and public auth smoke succeeded |
| Required `main` ruleset | `VERIFIED` | Active ruleset requires PR, blocks deletion/non-fast-forward, requires current `build`, `android-gate`, `ios-gate`, and `production-data-integrity` |
| Old checkout PDI files | `PARTIAL` | Three of five modified files are byte-identical to current `main`; old `.codex/hooks.json` and `scripts/check-enforcement-health.ts` are superseded by newer enforcement wiring |
| Nested PDI worktree | `UNVERIFIED` | Two dirty files differ from current `main`; semantic value and test validity have not been adjudicated |
| Registered recovery surface | `VERIFIED` | 76 worktrees in the legacy registry; 70 remote branch tips are not ancestors of current `origin/main` |
| Open pull requests | `VERIFIED` | Seven non-Dependabot PRs and fifteen Dependabot PRs remain open |
| Active writers | `VERIFIED` | Qwen CLI PID `81526`; Codex `phone:sol-xhigh.0` remains attached to the legacy checkout; another active process family owns `/Users/yehor/.codex/worktrees/9fad/people-first-app` |
| Clean-lane baseline | `FAIL` | lint and typecheck exit 0; Vitest: 747 files passed, one skipped, one failed; 9185 tests passed and two failed because `output/private` did not exist |
| Security baseline | `PARTIAL` | quick suite: Gitleaks, TruffleHog, Trivy, Checkov, and KICS exit 0; Snyk Code reported 60 inherited current-main results for later validation; Terrascan returned parser/classification errors on Playwright YAML and `node_modules/.bin/yaml` |

## Release Parity Snapshot

| Surface | Source version | Current delivery evidence | Status |
| --- | --- | --- | --- |
| Web/PWA | package `2.1.2` | GitHub Pages success on `ae3411ac` plus public smokes | `VERIFIED` for current main |
| Android | `versionName 2.1.2`, `versionCode 39` | CI Android gate and local debug evidence exist; signed AAB, installed release artifact, and Play track state were not inspected in this task | `UNVERIFIED` |
| iOS | `MARKETING_VERSION 2.0.0`, build `35` | CI iOS gate exists; TestFlight/App Store state was not inspected | `UNVERIFIED` |
| Desktop | `2.0.0` | Latest GitHub release `desktop-v2.0.0` is draft; latest successful desktop workflow predates current main | `FAIL` for current-main delivery |
| Netlify/Vercel mirrors | repository configs and Netlify PR checks exist | Production mirror commit identity was not inspected | `UNVERIFIED` |

The release cannot be called globally complete while version and delivery parity differ across these rows.

## Considered Approaches

### A. Canonical-source convergence with preservation and semantic adjudication

Use a clean control clone and one locked `codex/` lane based on exact `origin/main`. Preserve dirty states first, classify every candidate, and port only `TAKE` or `MERGE` items in small test-first commits. Deliver through the protected PR and per-platform release path.

**Chosen.** It follows the repository workspace protocol, keeps `main` review-only, retains recovery evidence, and makes rollback auditable.

### B. Fast-forward the legacy checkout and continue there

This would make the VS Code graph look newer but would mix incoming history with five modified paths, a nested dirty worktree, active process handles, stale hooks, and File Provider-era recovery state.

**Rejected.** It fixes appearance without proving that local variants are preserved, valid, or production-intended.

### C. Merge every branch and open PR

This would combine experiments, preservation snapshots, obsolete dependencies, failed runtime evidence, duplicate audio variants, and branches hundreds of commits behind current `main`.

**Rejected.** Branch existence is not release intent, and aggregate merging would make regressions and rollback unreviewable.

## Canonical Topology

1. `origin/main` is the only production source reference.
2. A clean control clone owns the only `main` worktree in its Git common directory.
3. `codex/global-convergence-20260831` is the only current convergence edit lane; later subprojects use one locked `codex/` lane at a time.
4. Legacy roots and their 76 worktrees are recovery inputs, never integration destinations.
5. Codex is the only repository-writing agent in this program and may write only in its own locked `codex/` branch/worktree. Qwen remains read-only unless a separate future design adds a dedicated actor namespace; Kimi-specific branch and hook support is retired.
6. Transfer occurs only through exact commits, pushed same-name branches, handoff receipts, and pull requests.
7. VS Code editing windows are single-root. The owner review window points to the clean canonical checkout, not a legacy root.

## Program Decomposition

This umbrella design is intentionally larger than one implementation plan or pull request. Execution is split into independently reviewable subprojects, each with its own plan, test cycle, exact-tip handoff, PR, rollback, and completion packet:

1. **Baseline determinism:** make a pristine locked lane pass the full canonical test suite without relying on ignored directories or prior build output.
2. **Kimi workspace-gate retirement:** remove Kimi-specific protocol, installer, package wiring, branch authorization, enforcement checks, and tests while keeping Codex-only protections green.
3. **Writer freeze and preservation:** capture stable, private, hash-bound packets without modifying source lanes.
4. **Inventory and adjudication:** produce the complete convergence ledger; this subproject changes evidence/docs only and selects no product change by itself.
5. **Domain convergence batches:** one plan and PR per coherent product/governance domain selected as `TAKE` or `MERGE`; unrelated domains never share a commit merely to reduce PR count.
6. **Web/PWA delivery:** establish the final source SHA and public deployment evidence after the last convergence batch.
7. **Android release parity:** signed artifact, release-equivalent runtime proof, Play internal track, and staged rollout.
8. **iOS release parity:** version/signing alignment, TestFlight proof, and App Store delivery.
9. **Desktop release parity:** version/signing alignment, current-main workflow, artifact proof, and published release.
10. **Mirror and local workspace convergence:** verify or retire mirrors, then move VS Code to one clean canonical root.
11. **Final branch/worktree/clone cleanup:** delete only proven superseded/recovered state and leave one canonical clone plus remote `main` and release tags.

The implementation plan written after this spec review covers subproject 1 first. Later plans may use evidence produced by earlier subprojects, but none inherits release authorization or a PASS verdict automatically.

## Kimi Workspace-Gate Retirement Contract

The user explicitly retired the Kimi workspace gate. This change removes active Kimi integration without weakening the remaining Codex, Git, or GitHub boundaries.

Required removals and rewrites:

- delete `docs/ai/CODEX_KIMI_WORKSPACE_PROTOCOL.md` and replace its still-valid shared safety content with a Codex-only workspace protocol;
- delete `scripts/install-kimi-workspace-hook.mjs`, `scripts/install-kimi-workspace-hook.d.mts`, and `scripts/__tests__/install-kimi-workspace-hook.test.ts`;
- remove `agent:kimi-hook` and the deleted installer test from `package.json` scripts/test lists;
- rename the `AGENTS.md` workspace section and remove Kimi setup, hook, branch, rollback, and Working Directory instructions;
- make `scripts/agent-workspace.mjs`, `scripts/agent-workspace-runtime.cjs`, `.codex/hooks/agent-workspace-guard.cjs`, Husky hooks, and their tests accept only the `codex/` actor/branch namespace where they currently encode Kimi authorization;
- update `scripts/check-agent-workspace-protocol.cjs`, agent-context references, declarations, and protected-surface tests so no live check requires the deleted Kimi protocol or installer;
- preserve generic isolation, clean review-only `main`, locked worktrees, exact-tip handoff, no-reset/no-force rules, remote identity checks, protected PR delivery, and Codex actor binding;
- leave Qwen CLI configuration and runtime untouched because Qwen is not the retired Kimi gate;
- do not authorize Qwen repository writes through the deleted Kimi path; Qwen remains an observable read-only source during this convergence unless the owner later approves a separate Qwen workspace contract;
- retain historical Kimi-named audio/provenance records until the convergence ledger decides `IN_MAIN`, `SUPERSEDED`, `TAKE`, `QUARANTINE`, or deletion after recovery proof.

Acceptance requires repository-wide search to show no active Kimi gate/installer/actor authorization outside explicitly historical provenance records, and all focused workspace/governance/agent-context checks must pass.

## Writer Freeze Contract

Before creating preservation packets or reading mutable evidence as final:

1. Re-enumerate processes, working directories, open handles, tmux panes, Qwen session state, background shells, emulators, and registered worktrees.
2. Mark each source `ACTIVE_SKIP` or `FROZEN` with timestamp, PID/session identity, branch, `HEAD`, status count, and owner.
3. Do not terminate a process merely because it is idle. Freeze means no new prompts or writes while its evidence is captured.
4. If any path changes during hashing, invalidate that packet and restart only that source after the writer is quiet.
5. No source enters adjudication until its packet is stable.

## Preservation Packet Contract

Each dirty or untracked source receives a private, hash-bound packet outside every repository. The packet contains no secrets or raw private/user/production-derived payloads.

Required fields:

- canonical absolute source path and resolved Git common directory;
- branch, `HEAD`, merge base with pinned `origin/main`, upstream, ahead/behind counts;
- staged, unstaged, untracked, ignored, submodule, and nested-repository path inventories;
- SHA-256 for every included file and the inventory itself;
- binary-safe tracked diff and separately packaged untracked files;
- active-process/open-handle evidence;
- source classification and explicit exclusions;
- exact restore rehearsal instructions that never overwrite the source;
- packet timestamp and pinned `origin/main` SHA.

Packets must exclude credentials, `.env*`, signing materials, private receipts, user journals, production exports, dependency trees, caches, build output, emulator images, and generated runtime evidence unless a reviewed contract requires a specific public-safe file. Excluded paths remain listed by path/status without content.

## Convergence Ledger

Every local branch, remote branch, open PR, registered worktree, dirty path set, and relevant deployment receives one ledger record.

Required columns:

- stable record ID;
- source type and exact locator;
- branch and commit SHA;
- merge base and current-main relationship;
- changed-path manifest and domain/platform ownership;
- production intent evidence;
- tests/runtime/CI evidence with timestamps;
- privacy/security/provenance concerns;
- overlap with other records;
- decision: `IN_MAIN`, `SUPERSEDED`, `TAKE`, `MERGE`, `REGENERATE`, `QUARANTINE`, or `ACTIVE_SKIP`;
- decision rationale, reviewer, verification command, rollback, and follow-up.

No record may be selected because it is newest, largest, already open as a PR, or authored by a preferred agent.

## Candidate Adjudication Rules

### `IN_MAIN`

Content or an equivalent reviewed patch is reachable from current `main`, and its required tests and release intent are satisfied.

### `SUPERSEDED`

A current-main implementation covers the same behavior with equal or stronger contracts. Evidence must name the replacement paths/tests; a branch name or later timestamp is insufficient.

### `TAKE`

The change is absent from `main`, completed, user-intended, compatible with current architecture, and has a valid proof path. It can be replayed as one small domain commit.

### `MERGE`

Multiple variants contain non-overlapping value. A manual semantic implementation is required; wholesale file selection is forbidden.

### `REGENERATE`

The file is generated or lockfile-owned. Update its canonical inputs and run the official generator. `package.json` is reconciled semantically before one `package-lock.json` is regenerated and validated with `npm ci`.

### `QUARANTINE`

The item is experimental, failed, private, generated output, a preservation snapshot, dependency/cache state, provenance-blocked media, or otherwise not production-ready.

### `ACTIVE_SKIP`

The source is still owned by a live writer or depends on unstable external/runtime state. It is revisited after the owner closes or hands it off.

## Phase 0: Baseline Repair Gate

The clean checkout exposed two failing Cloudlight tests because they call `mkdtempSync` below `output/private` without creating the ignored parent. The integration lane must not rely on a previously polluted checkout.

Before any product or convergence implementation:

1. Preserve the failing command and exact error as RED evidence.
2. Add the smallest test-harness fix that creates its own temporary parent without changing production behavior or committing generated output.
3. Rerun the two focused tests GREEN.
4. Rerun full Vitest and require zero failed test files/tests.
5. Keep any expected jsdom error output separate from actual test verdicts.

## Integration Strategy

1. Pin the current live `origin/main` SHA and confirm the locked lane relationship before every batch.
2. Select one domain-scoped ledger record or tightly coupled group.
3. Capture a RED regression test or characterization baseline before first-party changes.
4. Use `git merge-tree` for conflict forecasting; use `range-diff` after replay; use `rerere` only after a verified manual resolution.
5. Port behavior, not entire stale files. Preserve current hooks, architecture, privacy, accessibility, PDI, i18n, and platform contracts.
6. Commit one reviewable behavior with its tests and evidence.
7. Run focused GREEN checks and the domain blast-radius suite.
8. Refresh the ledger and packet references before selecting the next record.
9. Stop when an active source, missing product decision, failed runtime proof, or security/privacy conflict blocks safe selection.

## Protected Delivery

1. Run the lane doctor, status/diff review, secret/provenance screening, full required local checks, production bundle PDI, and scoped security suite.
2. Push only a same-named `codex/` subproject branch without force.
3. Generate an exact-tip handoff receipt for that subproject.
4. Open one pull request per coherent ledger subset to `main`, with its platform matrix, test evidence, rollback, and remaining `UNVERIFIED` rows. Split any batch that would exceed the 500-path handoff limit or weaken independent review.
5. Require current `build`, `android-gate`, `ios-gate`, and `production-data-integrity`, plus applicable drift/visual/security checks.
6. Resolve every review thread and merge only through the active ruleset.
7. Fetch again and prove local canonical `main`, `origin/main`, and the live remote branch equal the merge SHA with divergence `0 0`.

## Cross-Platform Release Plan

### Web/PWA

- Let the `push` to `main` trigger `deploy.yml`.
- Bind the run to the final merge SHA.
- Require build, deploy, public privacy smoke, and public auth smoke success.
- Verify the cache-busted public URL, installed-PWA update path, service worker freshness, and rollback by revert PR.

### Android

- Align release-cycle versioning and increment `versionCode`.
- Build a signed AAB with external signing material kept outside Git.
- Install a release-equivalent artifact on a real device and exercise startup, auth, diary lock, navigation/back, persistence, ads/privacy, offline/update, and crash logging.
- Upload to Play internal testing, verify package/artifact SHA and declarations, then use staged rollout `10% -> 50% -> 100%` with monitoring and halt criteria.

### iOS

- Align `MARKETING_VERSION` and increment `CURRENT_PROJECT_VERSION`.
- Run Capacitor sync, archive in Xcode, and verify signing/entitlements.
- Exercise the same critical auth/diary/persistence flows in TestFlight on a real device.
- Submit through App Store Connect only after review metadata and privacy declarations match the artifact.

### Desktop

- Align Tauri/package versioning.
- Run the current desktop release workflow on the final `main` SHA.
- Require platform build/signing status, artifact hashes, launch/update smoke, and published GitHub Release rather than draft-only state.

### Mirrors

- Identify whether Netlify and Vercel production projects are connected to `main`.
- Verify each live deployment's source SHA and route behavior or mark the mirror intentionally retired.

## Security, Privacy, and Provenance

- Run `/Users/yehor/.codex/bin/codex-security-suite.sh` with the narrowest suitable profile on each changed batch and the final lane; no DAST without a separately explicit target/config.
- Run Snyk for changed supported first-party code when available; unavailable auth/network remains `UNVERIFIED`.
- Run PDI source/diff/staged/bundle modes appropriate to the batch.
- Inspect dependency, workflow, hook, auth, storage, sync, analytics, AdMob, and signing changes with their domain-specific invariants.
- Never stage tokens, credentials, customer data, private receipts, production-derived datasets, signing keys, quarantine audio, or unreviewed generated artifacts.

## Verification Matrix

Each integrated batch declares Web/Vite, installed PWA, Android/Capacitor, iOS/WKWebView, Desktop/Tauri, Store/Release, Accessibility/RTL, Performance, Security/Privacy, Testing, and Operations impact as `PASS`, `FAIL`, `UNVERIFIED`, or justified `N/A`.

Minimum final local checks:

- `npm ci`
- `npm run lint`
- `npm run typecheck`
- full `npx vitest run --configLoader runner`
- `npm run build`
- `npm run check:production-data-integrity:bundle`
- `npm run check:no-ai-templates`
- `npm run check:best-practices`
- `npm run check:task-completion`
- `npm run check:agent-context`
- platform-specific build/runtime checks required by selected ledger records
- `git diff --check`, final `git diff`, `git status`, changed-path/secret/generated-output review

## Local VS Code Convergence

After remote integration and release verification:

1. Open only the generated single-root convergence/review workspace or the clean canonical control checkout in a new VS Code window.
2. Confirm Source Control exposes exactly one repository and its `main` equals live `origin/main` with zero changes.
3. Close the legacy workspace window before filesystem cleanup.
4. Prove each legacy checkout and historical worktree is unused, has no open handles, has a stable preservation packet, and has no unmerged production-intended value.
5. Remove registered worktrees with Git-native removal, remove independent clones only by exact resolved path, and verify the remaining canonical clone immediately after every batch.

## Final Branch, Worktree, and Clone Cleanup

Cleanup is part of the owner-approved final state but happens only after integration and release parity are proved.

1. Refresh the convergence ledger against the final live `origin/main` SHA.
2. For every local and remote branch, prove one of:
   - its production-intended commits are reachable from final `main`;
   - equivalent behavior is in `main` with named replacement tests;
   - it is a failed/experimental/private/preservation-only state captured in a verified bundle and excluded from production.
3. Commit and push every valuable production-intended state to a reviewable branch before integration. Never push caches, build output, credentials, private receipts, production-derived data, or failed experimental payloads merely to make the branch count zero.
4. Merge approved branches through protected PRs, close superseded PRs with evidence, and delete their remote branches only after the merge/recovery proof is stable.
5. Resolve or close Dependabot PRs through compatibility/security review; do not merge outdated dependency updates blindly. Current Dependabot branches may be deleted at completion, while future automation may create new ephemeral branches.
6. Create immutable release tags for shipped platform artifacts and record artifact hashes/source SHA.
7. Remove local feature branches only after remote/main reachability or bundle recovery is verified.
8. Remove linked worktrees only when no process/open handle uses them and `git worktree` identity matches the reviewed target.
9. Remove independent clones only after their Git objects, dirty/untracked state, ignored/private exclusions, sync state, and recoverability are proved and VS Code/terminal processes no longer reference them.
10. Verify the final snapshot:
    - exactly one local canonical clone;
    - its only checked-out branch is `main` tracking `origin/main`;
    - local `main`, local `origin/main`, and live remote `main` are the same SHA with divergence `0 0`;
    - no extra registered worktrees;
    - no current remote feature branches or open PRs;
    - release tags and platform delivery evidence remain accessible.

## Rollout and Rollback

- Record the pre-merge production SHA and final merge SHA.
- Roll back source only through a new reviewed revert PR; never reset or rewrite `main`.
- Web/PWA rollback redeploys the revert SHA and repeats public smokes.
- Android rollback halts staged rollout or promotes a reviewed corrective artifact with a higher `versionCode`; already-installed binaries are not rewritten.
- iOS rollback pauses phased release or submits a higher-build corrective version.
- Desktop rollback retains immutable artifacts and publishes a corrective release; do not replace signed assets silently.
- Preservation packets remain until final cleanup verification succeeds; the owner has approved retirement of superseded packets/clones after their recovery and release obligations are proved.

## Done Criteria

- Every in-scope local worktree, local branch, remote branch, open PR, dirty path set, and current deployment has a refreshed ledger decision.
- Every `TAKE`/`MERGE` record selected by the owner is present in one protected-main merge or has an explicit blocking record.
- Clean canonical `main`, `origin/main`, and live remote `main` equal the final SHA with divergence `0 0`.
- Required local checks and current GitHub checks pass on the exact final SHA.
- Web/PWA, Android, iOS, Desktop, and configured mirrors have artifact/source-SHA delivery proof, or the global release remains incomplete.
- VS Code shows one clean canonical repository, and final cleanup leaves exactly one local clone whose only local branch is `main`, with no additional registered worktrees.
- The remote repository has only the protected default branch `main` plus immutable release tags at the completion snapshot; no open PR remains unclassified.
- No secret, private/production-derived data, generated output, cache, or test-only dependency enters runtime or Git.
- Rollback evidence and remaining `UNVERIFIED` rows are explicit.

## Current UNVERIFIED Ledger

- Semantic value of the two dirty nested PDI-worktree files.
- Stable hash-bound preservation packets for every dirty/active legacy source.
- Final classification of 76 worktrees, 70 non-ancestor remote branches, seven non-Dependabot PRs, and fifteen Dependabot PRs.
- Whether every branch counted as non-ancestor contains unique production value rather than preservation or superseded patches.
- Google Play Console artifact/track/rollout state and release signing readiness.
- App Store Connect/TestFlight state and current signing readiness.
- Current-main Desktop signing/build status and publication readiness.
- Netlify and Vercel production source-SHA state.
- Real-device Android/iOS release-equivalent critical-flow proof for the final convergence commit.
- Installed-PWA update behavior for the future final convergence commit.
- Static validation and disposition of the 60 inherited Snyk Code results; none may be attributed to this Markdown-only spec without source-to-sink review.
- Terrascan coverage for actual IaC after excluding non-IaC Playwright YAML and dependency shims through a reviewed scanner configuration rather than deleting evidence.
- Exact final deletion inventory for local branches, remote branches, worktrees, independent clones, preservation packets, and historical Kimi provenance artifacts.

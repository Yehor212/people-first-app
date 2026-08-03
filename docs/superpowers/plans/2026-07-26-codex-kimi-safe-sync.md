# Codex + Kimi Safe Workspace And Sync Implementation Plan

> **Execution order:** complete-plan-expander → superpowers:writing-plans → superpowers:test-driven-development → security review → superpowers:verification-before-completion.

**Goal:** Make concurrent Codex and Kimi K3 work on ZenFlow predictable and recoverable: each agent edits an isolated Git worktree and feature branch, `main` remains a clean human-facing checkout, synchronization never discards local work, and every handoff is committed, pushed, reviewable, and evidence-backed.

**Architecture:** Git and GitHub remain the only shared source of truth. A stable integration clone lives outside every existing repository and ignored/output tree. A tracked, dependency-free workspace CLI creates locked sibling worktrees from a freshly fetched `origin/main`, diagnoses repository state, fetches by default without changing history, applies only an explicitly requested and provably safe fast-forward, and validates handoff readiness. A shared pre-tool guard blocks agent writes on `main` and destructive Git shortcuts. Codex registers the guard in the repository; a redaction-safe installer appends the same hook to Kimi's user configuration without exposing existing credentials. VS Code is configured to show only an explicit single-root workspace for the selected checkout.

**Tech Stack:** Node.js, Git worktrees, GitHub rulesets and pull requests, Vitest, VS Code repository settings, Codex `PreToolUse`, Kimi Code `PreToolUse`.

## Evidence Boundary

- Canonical remote: `https://github.com/Yehor212/people-first-app.git`.
- Human-facing checkout: a stable clean `main` clone outside every existing repository and `output/private`, opened in VS Code.
- Agent edits: one branch and one locked worktree per task; never a shared writable directory.
- Dirty Codex and Kimi roots are recovery evidence. They must not be reset, cleaned, overwritten, staged, or silently imported.
- Ignored files, editor session state, Kimi sessions, credentials, and logs are never synchronization artifacts.
- Hooks are guardrails. Kimi documents fail-open behavior for hook errors and timeouts, so GitHub review/rules, separate worktrees, confirmations, and manual review remain independent layers.
- This task changes operator/developer workflow only; it does not change ZenFlow runtime state, IndexedDB, Supabase, auth, user journals, analytics, ads, or release payloads.

## Explicit Requirements

1. Codex and Kimi must not confuse or overwrite each other's files.
2. The user must see one clean repository in VS Code rather than changes from several local copies.
3. New Kimi-created assets must remain discoverable in a human-only review workspace and must move to `main` only through a committed, pushed, reviewed change.
4. Synchronization must not lose uncommitted files, ignored files, or local-only commits.
5. The completed workflow must be committed, pushed, reviewed through required GitHub checks, and merged to `main`.

## Implied Requirements

1. Block direct agent edits, commits, merges, rebases, pulls, and pushes on `main`.
2. Block `reset --hard`, destructive `clean`, force pushes, branch deletion, and similar recovery-destroying shortcuts in agent sessions.
3. Create worktrees from a fetched remote reference without stashing or mutating the invoking checkout.
4. Refuse synchronization when the checkout is dirty, detached, ahead, diverged, on the wrong remote, or otherwise ambiguous.
5. Require handoff to prove clean status, a feature branch, a same-name remote upstream, and identical local/remote HEAD.
6. Preserve exact recovery instructions and emit machine-readable evidence without presenting hooks as a security boundary.
7. Keep Kimi configuration and logs private; never print provider values, API keys, credentials, or session contents.
8. Test malformed hook input, wrappers, quoted commands, alternate working directories, symlink/path boundaries, and internal errors.
9. Detect documentation/config drift in existing agent-context checks.
10. Leave GitHub administrator bypass unchanged unless the user separately authorizes a remote ruleset mutation.
11. Preserve ignored recovery bytes during failed worktree creation and reject ignored/incoming collisions before integration sync.
12. Retain remote-tracking recovery refs during routine fetches; never prune as a side effect of diagnosis, create, sync, or handoff.
13. Accept only strict canonical HTTPS/SSH remote forms and same-named `codex/` or `kimi/` push destinations; reject tags, cross-role refs, credentials, ports, queries, and fragments.

## Platform Matrix

| Surface              | Applicability              | Required proof                                                                                                                    |
| -------------------- | -------------------------- | --------------------------------------------------------------------------------------------------------------------------------- |
| Web / PWA            | Runtime N/A                | Confirm no runtime source or bundle behavior changed.                                                                             |
| Android              | Runtime N/A                | Confirm no native files or packaged assets changed.                                                                               |
| iOS                  | Runtime N/A                | Confirm no native files or packaged assets changed.                                                                               |
| Desktop / Tauri      | Operator workflow affected | macOS filesystem, VS Code, Git, Kimi config permissions, and hook behavior verified locally. Tauri runtime is N/A.                |
| Store / Release      | Runtime N/A                | GitHub PR/rules/checks/merge verified; no store artifact claim.                                                                   |
| Accessibility        | CLI text only              | Actionable plain-language failures; no color-only status or interactive UI introduced.                                            |
| Performance          | CLI only                   | No daemon, polling loop, whole-repo watcher, or background synchronization.                                                       |
| Security and privacy | Directly affected          | No secrets printed; configuration permissions tightened; destructive operations and `main` writes guarded; scanner gaps explicit. |
| Testing              | Directly affected          | Disposable Git repositories plus positive, negative, malformed-input, and internal-error tests.                                   |
| Operations           | Directly affected          | Creation, diagnosis, sync, handoff, rollback, and local Kimi installation documented and runnable.                                |

## Task 1: Freeze Current State And RED Contracts

**Create:**

- `scripts/__tests__/agent-workspace.test.ts`
- `scripts/__tests__/agent-workspace-command-guard.test.ts`

**Modify:**

- `scripts/__tests__/codex-change-governance-gate.test.mjs`

- [ ] Record branch, upstream, worktree lock, remote URL, and dirty-state baselines without changing either recovery checkout.
- [ ] Add disposable-repository tests for worktree creation, safe fast-forward, dirty refusal, ahead/diverged refusal, detached HEAD, wrong remote, and handoff equality.
- [ ] Add hook tests for direct `main` writes, destructive Git variants, wrappers, feature-branch allowance, malformed input, and paths outside the repository.
- [ ] Add a regression proving that the existing change-governance evaluator accepts repository root `"."` as an in-repository target.
- [ ] Run focused Vitest and require the expected RED failures before implementation.

## Task 2: Implement The Safe Workspace CLI

**Create:**

- `scripts/agent-workspace-core.cjs`
- `scripts/agent-workspace-runtime.cjs`
- `scripts/agent-workspace-runtime.d.cts`
- `scripts/agent-workspace.mjs`

**Modify:**

- `package.json`

**Commands:**

- `doctor`: inspect repository identity, worktree, branch, upstream, ahead/behind, lock, and dirty state.
- `create --agent <codex|kimi> --task <slug> --path <absolute-path>`: fetch `origin`, create a unique locked feature worktree from `origin/main`, and never mutate the caller's index or working tree.
- `sync`: fetch only by default. `sync --apply` can fast-forward only a clean, behind-only integration `main`; otherwise refuse without stash/reset/rebase. Incoming protected agent/governance files require `--reviewed-sha <exact-origin-main-sha>`.
- `handoff`: require a clean feature branch, `origin/<same-branch>` upstream, and equal local/remote HEAD; print a bounded JSON/text receipt.

- [ ] Use `execFileSync`/`spawnSync` argument arrays rather than shell interpolation.
- [ ] Validate agents, task slugs, absolute destination paths, branch collisions, destination existence, remote identity, embedded credentials/query data, and Git command results.
- [ ] Never run `stash`, `reset`, `clean`, automatic rebase, force push, or automatic conflict resolution.
- [ ] Fetch without pruning remote-tracking recovery refs.
- [ ] Before fast-forward, reject every incoming tracked-path collision with ignored local bytes and use Git's no-overwrite-ignore protection.
- [ ] Require worktree destinations outside the integration clone, every other Git repository, and all ignored/output trees, then lock each created worktree with a human-readable reason.
- [ ] Generate a single-root `.code-workspace` descriptor with an explicit `ZenFlow — CODEX|KIMI — <task>` title and repository auto-discovery disabled.
- [ ] Keep all output free of environment values, credential helpers, URLs containing credentials, and file contents; bound handoff changed-path manifests to 500 entries without silent truncation.

## Task 3: Share A Main/Destructive-Operation Guard

**Create:**

- `.codex/hooks/agent-workspace-guard.cjs`
- `scripts/agent-workspace-command-guard.cjs`

**Modify:**

- `.codex/hooks.json`
- `scripts/codex-governance/change-gate-core.cjs`

- [ ] Register the guard for `PreToolUse`.
- [ ] Resolve the event working directory to its actual Git root before applying branch policy.
- [ ] Block agent write-like tool calls on `main`.
- [ ] Block destructive Git commands and force pushes on every branch.
- [ ] Resolve package-manager flags, shell directory changes, Git environment selectors, PowerShell writers, nested interpreters, and push/fetch ref destinations before allowing a command.
- [ ] Permit read-only commands and ordinary writes on a feature branch.
- [ ] Exit with the documented intentional-block code and an actionable reason; malformed input fails closed for the matching hook.
- [ ] Fail closed for unknown executables, nested or decoder-fed shells, executable substitutions inside otherwise allowed commands, PowerShell/cmd reconstruction, dynamic package-script selection, and package scripts outside the explicit reviewed-name set.
- [ ] Fix the root-target regression without weakening guarded paths.
- [ ] State in code/docs that the reviewed-name set does not attest script content, and that same-user repository writes, shell parsing, and Kimi fail-open behavior prevent this hook from authenticating an operator or becoming a sole security boundary.

## Task 4: Install Kimi Protection Without Exposing Secrets

**Create:**

- `scripts/install-kimi-workspace-hook.mjs`
- `scripts/install-kimi-workspace-hook.d.mts`
- `scripts/__tests__/install-kimi-workspace-hook.test.ts`

- [ ] Support `--check` and `--apply`; default to check-only.
- [ ] Read the configuration as opaque text and never echo it.
- [ ] Append one idempotent `[[hooks]]` block containing only the four officially supported fields.
- [ ] Use an absolute, TOML-escaped command path and a bounded timeout.
- [ ] Create a timestamped private backup plus a transaction-bound private restore receipt before replacement, write atomically, and enforce mode `0600` for configuration/backups/receipt.
- [ ] Tighten `~/.kimi-code` and its log directory to `0700` without reading session or credential contents.
- [ ] Validate the installed marker and run the guard directly with representative Kimi payloads.
- [ ] If `kimi doctor` is unavailable, report extension reload/runtime activation as `UNVERIFIED`, not `PASS`.

## Task 5: Make Repository Visibility And Handoff Durable

**Create:**

- `docs/ai/CODEX_KIMI_WORKSPACE_PROTOCOL.md`

**Modify:**

- `AGENTS.md`
- `.vscode/settings.json`
- `scripts/check-agent-context.mjs`
- relevant agent-context contract tests

- [ ] Set VS Code to avoid automatic parent/sibling/worktree discovery and show only the explicitly opened checkout.
- [ ] Create one human-only workspace containing the clean Git `main` root plus one external, non-Git, read-only Kimi audio-review root; require exactly one Source Control provider while keeping every agent workspace single-root.
- [ ] Document the stable clean human `main` checkout outside existing repositories, per-agent branch/worktree naming, start/sync/handoff/PR/merge sequence, recovery rules, and prohibited operations.
- [ ] Explain that Kimi “undo/rollback” returns to its session baseline and therefore must never be used as Git synchronization.
- [ ] Require a new Kimi session after switching its working directory.
- [ ] Add drift checks for the protocol, CLI, hook registration, VS Code settings, and package scripts.
- [ ] Keep `AGENTS.md` concise and link to the detailed protocol.

## Task 6: Verify Security, Quality, And Recovery

- [ ] Rerun the exact focused RED commands GREEN with exact file/test counts.
- [ ] Run TypeScript and Vitest separately as required by the commit pipeline.
- [ ] Run `git diff --check`, agent-context, no-AI-template, best-practices, agent-orchestra, and production-data-integrity diff checks.
- [ ] Run the scoped security suite and Snyk fallback when available; unavailable scanners remain `UNVERIFIED`.
- [ ] Exercise `doctor`, guard payloads, and `handoff` against this real feature worktree.
- [ ] Exercise create/sync/divergence/refusal only in disposable repositories.
- [ ] Confirm both dirty recovery roots retain their original counts and HEADs.
- [ ] Confirm the temporary clean VS Code clone remains clean, then create and validate the stable external integration clone.

## Task 7: Independent Closure, Commit, PR, CI, And Merge

- [ ] Route Role 8 QA over the exact requirement/evidence matrix.
- [ ] Hash the frozen diff and evidence packet; route Role 10 Pass B over that exact hash.
- [ ] Reproduce every reviewer claim locally before using it.
- [ ] Read `memory/feedback_commit_pipeline_knowledge.md`, create fresh `.verification-done` evidence with test counts, and satisfy commit metadata rules.
- [ ] Commit with a single-quoted message containing `batch` because the change spans more than seven files.
- [ ] Push only `codex/codex-kimi-safe-sync`, create a pull request, and wait for all required GitHub checks.
- [ ] Merge only through the protected pull-request path after required approval/check conditions permit it.
- [ ] Create or fast-forward the stable external human-facing `main` checkout using the exact merged SHA; never update the dirty recovery roots.
- [ ] Open the human review workspace in VS Code and confirm Explorer shows the clean checkout plus Kimi audio, while Source Control shows exactly one repository and zero changes.

## Rollback

1. Revert the merged commit through a pull request if the tracked workflow must be removed.
2. Restore Kimi only with the exact private timestamped backup and its transaction receipt: `npm run agent:kimi-hook -- --restore --backup <path> --receipt <path>`. Keep both mode `0600` until the owner verifies restoration and explicitly removes that exact pair.
3. Remove only the explicitly named task worktree after verifying it is clean, pushed, merged, and recoverable; never run broad `git clean`.
4. Restore the prior VS Code repository settings through the same revert.
5. GitHub ruleset changes are outside this implementation, so no remote policy rollback is expected.

## Done Criteria

- [ ] Codex and Kimi cannot normally edit the same checkout or write directly to `main`.
- [ ] No synchronization path discards uncommitted, ignored, or committed local work.
- [ ] New Kimi artifacts have a documented, testable path from isolated worktree to reviewed `main`.
- [ ] VS Code Explorer displays the clean checkout and visible Kimi review audio, while Source Control displays only the clean checkout.
- [ ] Kimi configuration is private and contains one validated workspace guard entry.
- [ ] Focused tests, TypeScript, Vitest, governance, context, security, and GitHub required checks have fresh results.
- [ ] The change is committed, pushed, reviewed, merged, and the clean `main` checkout equals `origin/main`.

## UNVERIFIED Until Freshly Proven

- Kimi VS Code runtime has reloaded and actively invoked the newly installed hook; direct script validation is not extension-runtime proof.
- Windows-specific Kimi/VS Code path quoting and filesystem permission behavior.
- GitHub administrator bypass removal or enforcement, because no ruleset mutation is authorized.
- Human acceptance of the workflow after using both agents on a future real task.

# Codex and Kimi workspace protocol

## Purpose

This is the operating contract for Codex and Kimi K3 on ZenFlow. It reduces accidental cross-session replacement through isolated worktrees, fail-closed checks, visible owner review, and remote branch protection. It cannot prevent a malicious same-user process from rewriting files or bypassing local hooks.

The contract governs Git and local operator tools. It does not change IndexedDB, Supabase, application sync, Web/PWA, Android, iOS, or Tauri behavior.

## Current local finding

The 2026-07-26 audit found multiple independent writable clones, legacy work on `main`, and recovered untracked audio whose paths overlap files already present on `origin/main`. The legacy Codex and Kimi roots are evidence/recovery sources, not normal work lanes. Do not pull, reset, clean, stash-pop, or delete either root until their remaining work has a separately reviewed hash inventory.

The recovered Kimi `git-safe-sync.mjs` and reset-token guard are rejected. That sync path stashes only part of local state and can reset a divergent branch to the remote tip, discarding committed work. Its token is not bound to the exact repository, branch, object IDs, or preserved files.

## Required topology

1. Use one stable control clone outside every legacy checkout, build folder, ignored `output/` directory, or cloud-synced folder.
2. The control clone owns the only integration worktree on `main`. `main` is clean and review-only.
3. Every editing session gets one linked, locked worktree and one unique branch:
   - Codex: `codex/<task-slug>`
   - Kimi: `kimi/<task-slug>`
4. One agent owns one worktree for the lifetime of that task. Do not open the same lane in both agents.
5. Transfer work through exact commits on pushed branches and pull requests. Never transfer through a shared stash, filesystem copy, session rollback, or VS Code “Sync Changes”.

Git normally refuses to check out one branch in more than one linked worktree. Do not use `git worktree add --force`, unlock an active lane, or treat an ignored clone as the control repository.

## Bootstrap a stable control clone

Choose stable absolute paths under an operator-owned, non-synced directory. The recommended layout is:

- control `main`: `<zenflow-root>/people-first-app-main`
- task lanes: `<zenflow-root>/worktrees/<agent>-<task>`

They are outside every existing checkout and are not cloud-synced or ignored repository output. The paths are local operator state and must not be committed. The existing Codex and Kimi roots remain frozen recovery evidence.

```sh
git clone https://github.com/Yehor212/people-first-app.git <absolute-control-path>
cd <absolute-control-path>
npm ci
npm run agent:workspace -- doctor --mode review
```

The last command must return `GO`, show `branch=main`, zero changes, the canonical remote identity, and exactly one `main` worktree. A failed or skipped check is `UNVERIFIED`.

## Create an editing lane

Run creation only from the clean control `main` worktree:

```sh
npm run agent:workspace -- create \
  --agent codex \
  --task <task-slug> \
  --path <absolute-codex-worktree-path>
```

For Kimi, replace `codex` with `kimi` and use a different absolute target path. The command fetches `origin` without pruning recovery refs, resolves existing path ancestors before checking overlap, refuses a control lane with tracked, untracked, or ignored local state, an outdated control lane, existing local or retained remote-tracking branch, any `output` or nested-repository destination, or existing target, starts at exact `origin/main`, and creates a locked worktree with a reason. It also writes one private sibling `<worktree>.code-workspace` containing exactly that lane. It invokes Git with argument arrays and never through a shell. If checkout fails after Git creates a lane, rollback is limited to the exact clean just-created worktree, its unchanged start-point branch, and the byte-identical generated workspace file. Any tracked, untracked, or ignored addition, path-identity change, branch movement, or workspace-file mismatch preserves the lane for owner review.

Do not start editing if creation or the resulting doctor check returns `STOP`.

## Start and inspect a session

At the beginning of a Codex lane:

```sh
npm run agent:workspace -- doctor --agent codex --mode edit
```

At the beginning of a Kimi lane:

```sh
npm run agent:workspace -- doctor --agent kimi --mode edit
```

The edit check requires:

- the canonical `Yehor212/people-first-app` remote;
- one documented canonical remote form: HTTPS without userinfo or SSH as user `git`, with no custom port, query, or fragment; use the system credential helper or SSH agent instead;
- a named branch with the current agent prefix;
- a clean locked worktree registered in the shared Git common directory;
- exactly one registered `main` lane;
- a locally available `origin/main`.

During active edits, `doctor` reports a dirty lane as `STOP`. That does not forbid normal editing; it does forbid synchronization and handoff until every file is committed or explicitly classified.

## Safe synchronization

```sh
npm run agent:workspace -- sync
```

By default, `sync` performs only `git fetch origin` and reports the relationship; it does not move `HEAD`, the index, or files. It deliberately does not prune remote-tracking refs: stale refs may accumulate, but an external branch deletion cannot silently remove the last named local recovery locator during diagnosis.

Only the clean integration `main` lane may apply a behind-only update:

```sh
npm run agent:workspace -- sync --apply
```

`create`, `bootstrap-human-review`, `sync --apply`, and Kimi hook install/restore are owner-authorized mutations. The default is a directly visible, reviewed local terminal. An agent may assist only after the owner explicitly authorizes that exact mutation and the command remains visible for review; an agent-tool hook result never authenticates human origin. A `--reviewed-sha` value pins the exact fetched object against a time-of-check/time-of-use race; it is not authentication, approval, or authorization.

If incoming commits touch `AGENTS.md`, `ARCHITECTURE.md`, `CLAUDE.md`, `.codex/`, `.github/`, `.husky/`, `.vscode/`, `config/`, `docs/ai/`, `scripts/`, `package.json`, or `package-lock.json`, apply also requires the exact reviewed `origin/main` tip:

```sh
npm run agent:workspace -- sync --apply --reviewed-sha <exact-origin-main-sha>
```

Feature lanes are fetch-only. When `origin/main` advances after editing starts, preserve the pushed feature tip and make the merge/rebase decision in the pull request or a new isolated follow-up lane. Do not hide this decision behind a bare `git pull`.

Before `sync --apply`, the CLI inventories ignored local paths and rejects the apply when any exist, because checkout hooks can mutate ignored bytes even when incoming tracked paths do not collide. Its narrower exact and ancestor/descendant collision analysis remains defense in depth, and Git also receives its no-overwrite-ignore option. A refusal leaves `HEAD`, index, and ignored bytes unchanged for owner review.

The implementation has no sync path for `git reset --hard`, `git clean`, `git stash`, stash-pop, implicit pull, automatic rebase, force-push, pruning, or file deletion.

## Commit and push boundaries

The shared Husky hooks apply to terminal Git, VS Code, Codex, and Kimi when hooks are installed:

- pre-commit rejects `main` and detached HEAD;
- pre-push rejects every destination `refs/heads/main`;
- pre-push accepts only a same-named `codex/` or `kimi/` source/destination branch pair;
- pre-push rejects tags, unsupported branch namespaces, ref deletion, and non-fast-forward updates;
- runtime checks validate both the fetch URL and every configured push URL for `origin`;
- pre-push validates the exact remote name and a strict canonical HTTPS/SSH URL supplied by Git before accepting a feature update; normalization never discards credentials, ports, query data, fragments, or unsupported schemes.

Git permits a human operator to bypass local hooks with `--no-verify`, custom `core.hooksPath`, environment overrides, or command aliases. The Codex/Kimi command guard rejects those patterns, but it is a secondary control rather than an authorization boundary. The active GitHub ruleset and required pull-request checks remain the authoritative remote boundary; a local hook result alone is never proof that `main` is protected.

The Codex registration binds the guard to actor `codex`; the installed Kimi registration binds it to actor `kimi`. Any mutation in the canonical repository must use the matching `codex/` or `kimi/` current-branch prefix. This blocks either client when it is accidentally pointed at the other client’s lane; `doctor` remains a second explicit identity check.

On `main`, shell execution is deny-by-default except for a bounded read-only command set. On feature lanes, the guard also fails closed for unknown or opaque dispatch (`eval`, `source`, decoder-to-shell pipelines, direct interpreter scripts, nested child processes, dynamic executables), executable substitution anywhere in the command (`$()`, backticks, POSIX process substitution, or PowerShell subexpressions), shell environment prefixes, privileged `sudo`/`doas` wrappers, package install/update lifecycle execution, unapproved Git plumbing, dynamic workspace/Kimi-hook arguments, package scripts outside its explicit reviewed-name set, cross-worktree paths hidden in bounded nested edit payloads, all filesystem source/destination operands, adjacent quoted redirection segments, and both unified-diff path headers. Run reviewed first-party checks through their declared npm scripts. Free-form operator commands belong in a directly reviewed terminal.

The reviewed package-script names are a usability allowlist, not content attestation: a process with same-user repository write and execution capability could alter an allowlisted script or one of its descendants. Kimi may also fail open when a hook errors or times out. Therefore these hooks reduce accidental and common confused-deputy paths but cannot prove operator presence, resist a malicious same-user agent, or replace capability isolation, visible owner approval, recovery copies, GitHub rules, and required CI.

Do not force-push, delete refs, or rewrite a handed-off branch. Create a new follow-up commit so the exact receipt remains auditable.

## Exact-tip handoff

After committing and pushing the same-named feature branch:

```sh
npm run agent:workspace -- handoff --json
```

`handoff` fetches and returns `GO` only when:

- the worktree is clean;
- the lane is locked and the branch uses `codex/` or `kimi/`;
- the branch contains at least one committed changed path relative to its `origin/main` merge base;
- `refs/remotes/origin/<same-branch>` exists and equals local `HEAD`;
- the branch, observed `origin/main`, behind count, merge-base SHA, tip SHA, commit tree, role, root, shared Git directory, exact changed-path list, and hash/presence of `.verification-done` are present in the bounded receipt.

The exact changed-path manifest is limited to 500 paths. A larger branch must be split into reviewable task branches or use a separately owner-approved evidence process; the CLI will not silently truncate its receipt. Any later commit changes the receipt. The receiving agent must rerun the check against the named exact tip rather than trusting chat text or a VS Code badge. An independently advanced `origin/main` does not invalidate the pushed feature tip; the receipt exposes that distance so the pull request and strict remote checks can reconcile it without a hidden local merge or rebase.

## VS Code repository visibility

Open the generated `<worktree>.code-workspace` in a new VS Code window. Do not create a multi-root workspace containing both writable lanes.

Tracked and generated workspace settings disable automatic nested, parent, linked-worktree, and repository-list scanning, bound scan depth, and show the current root in the window title. Source Control should show the repository at the open root only. If another repository appears, close the window and reopen the intended absolute worktree path before editing.

Generated `.code-workspace` files may contain local absolute paths and therefore remain untracked local artifacts. They must contain exactly one folder.

The one exception is the owner-review workspace:

- workspace file: `<absolute-review-workspace-file>`;
- Git folder: `<absolute-control-path>`;
- non-Git review folder: `<absolute-audio-review-path>`.

This workspace exists only so the owner can see a clean `main` checkout and listen to quarantined Kimi audio in one window. The review folder must contain no `.git` directory; its folders use mode `0500`, its evidence files use mode `0400`, and VS Code honors those permissions through `files.readonlyFromPermissions`. Those modes prevent edits, not reads: any same-user process or enabled extension can still enumerate the files. Automatic repository discovery remains disabled. Explorer must show both named roots, while Source Control must show exactly one provider for `people-first-app-main` with zero changes. Codex and Kimi must never use this two-folder review workspace as a working directory; agent editing workspaces remain single-root.

The reviewed one-time bootstrap command is:

```sh
npm run agent:workspace -- bootstrap-human-review \
  --control-path <absolute-control-path> \
  --audio-source-path <absolute-recovered-audio-source-path> \
  --audio-review-path <absolute-audio-review-path> \
  --workspace-file <absolute-review-workspace-file>
```

Bootstrap refuses existing destinations, verifies the fixed 17-file SHA-256 inventory before copying, clones exact clean `origin/main`, applies OS read-only modes to the listening evidence, and creates the two named roots. After bootstrap, use the non-mutating proof command instead of rerunning creation:

```sh
npm run agent:workspace -- check-human-review \
  --control-path <absolute-control-path> \
  --audio-review-path <absolute-audio-review-path> \
  --workspace-file <absolute-review-workspace-file>
```

It must return `ready=true`, `audioCount=17`, `repositoryCount=1`, `branch=main`, `clean=true`, zero ignored paths, and the same `head` as `origin/main`. Here `repositoryCount=1` proves that the generated manifest declares one Git root and that root passes the CLI Git checks; it is not live VS Code provider telemetry. `npm run check:agent-workspace` is a source/registration CI check; it intentionally does not prove that these machine-local artifacts exist.

Open the review workspace in a new window with installed extensions disabled:

```sh
code --new-window --disable-extensions <absolute-review-workspace-file>
```

Keep that window in Restricted Mode; listening and Source Control inspection do not justify enabling workspace code or AI extensions. The owner must still confirm the exact two resolved paths. The command reduces extension exposure in that window but is not OS-level capability isolation from other same-user processes. Until the live window is inspected with extensions disabled, both extension isolation and the Source Control provider count remain `UNVERIFIED`.

## Kimi Working Directory

In the Kimi VS Code extension, set **Working Directory** to the exact `kimi/<task>` linked worktree before starting the session. Switching the working directory starts a new session; rerun `doctor` in that directory.

Kimi file-change rollback restores the baseline captured for that Kimi session. Use rollback only when Kimi is the sole actor in that worktree and no terminal, VS Code, Codex, formatter, generator, or hook changed its files after the baseline. Otherwise preserve the lane and recover with Git object IDs and hashes.

Keep tool approvals enabled. Do not use Kimi YOLO mode for ZenFlow. Project `AGENTS.md` is reference context; it does not make a Kimi hook fail-closed.

Kimi CLI runtime interception in the current VS Code extension is `UNVERIFIED` until a real PreToolUse compatibility probe and `kimi doctor` succeed. Kimi hooks officially fail open on ordinary errors and timeouts, so they cannot replace worktree, Git-hook, and GitHub protections.

After the stable clone is merged and installed, the local Kimi hook can be installed without printing the existing configuration:

```sh
npm run agent:kimi-hook -- --apply
```

The installer creates both a mode-`0600` sibling backup and a mode-`0600` transaction receipt with exclusive creation, refuses hard-linked config/recovery files or overwriting either recovery file, verifies the config has not changed concurrently, installs one idempotent actor-bound `PreToolUse` rule with `--expected-agent kimi` through an identity-checked transaction, and makes the Kimi config private. The receipt binds the exact config path, backup path, backup hash, link count, and file identity, plus the pre-install and post-install config identities. It reports `kimi_doctor=UNVERIFIED` when the CLI is absent. Restart Kimi/VS Code before a runtime probe.

Node does not expose portable `openat`/`renameat` primitives for this workflow. Descriptor and ancestry checks reduce replacement races but do not eliminate a syscall-sized time-of-check/time-of-use window; the transactional replacement can also make the config pathname briefly absent. Those residuals remain `UNVERIFIED`, so a failed or concurrent install preserves recovery evidence and requires owner inspection rather than an automatic retry.

Restore only with the exact backup and receipt paths printed by that installation:

```sh
npm run agent:kimi-hook -- --restore --backup <private-backup-path> --receipt <private-receipt-path>
```

The installer never removes the backup or receipt automatically, including after a successful restore. Keep both private until the owner verifies the restored Kimi configuration and explicitly removes that exact pair.

## Local Kimi data boundary

Kimi credentials, providers, sessions, logs, wire captures, and `~/.kimi-code/config.toml` stay outside Git. Never print or copy their raw values into a task, handoff receipt, issue, PR, artifact, or test fixture.

Session exports can include global logs. Export only for a specific incident, use the documented option that excludes global logs when possible, inspect the archive locally, and do not commit it.

## Recovered nature and feedback audio

The visible, non-Git local review folder for recovered Kimi nature audio is the operator-selected:

`<absolute-audio-review-path>/`

It is outside every repository and hidden `output/` tree, and is not a Git handoff. Its manifest exposes 17 recovered source-derived Hyperfocus variants for owner listening and records only their exact filenames, hashes, and quarantine status; it does not disclose the private source path. They remain `QUARANTINED`: the recovered encodes are 44.1 kHz, and their generated hashes, progression ledgers, redistribution evidence, and listening review are incomplete. Recovered files without hash-bound provenance or release rights are listed as `BLOCKED` and are not copied into the listening folder. A file may move from review into the product only after provenance, redistribution rights, format/sample-rate constraints, content identity, application audio checks, and fresh human listening review pass. “Visible in VS Code” does not mean “licensed for release”.

If a reviewed audio path already exists on `origin/main` with a different hash, preserve both under local review identities and stop. Do not stash-pop, overwrite, or infer which version is authoritative.

Before promotion, prove the review folder is not a repository, copy the selected file only into a new isolated feature lane, then run `git status --short --untracked-files=all` and the existing audio/provenance checks there. Product audio belongs in the tracked product path selected by the existing audio contracts. The external review folder remains local evidence and will not be staged or pushed.

## Incident procedure

Stop immediately when any of these is true:

- branch is `main`, detached, wrong-prefix, dirty before sync, or uses an unrelated history with no merge base;
- the same branch or worktree appears owned by another active session;
- untracked or ignored paths overlap incoming tracked paths;
- the Git common directory or canonical remote differs from the receipt;
- a Kimi rollback, VS Code sync, reset, clean, force-push, or stash-pop was attempted;
- GitHub required checks are failing or branch rules are `UNVERIFIED`.

Preserve the worktree. Record `git status --porcelain=v1`, branch, `HEAD`, `origin/main`, shared Git directory, worktree registry, and hashes of colliding paths without exposing file contents. Do not delete, prune, unlock, or reconcile until the owner reviews that evidence.

## Rollback of this protocol

Revert the protocol/guard commit through a pull request. Removing the tracked command or hooks does not authorize cleanup of any worktree. Remove a linked worktree only after its exact branch tip is pushed, the handoff check is green, no process has an open handle in the lane, and the owner confirms recovery is no longer needed.

## Source-backed applicability

- Git worktree branch occupancy, locking, reasons, and stable porcelain output: [git-worktree](https://git-scm.com/docs/git-worktree.html).
- Fast-forward-only integration behavior: [git-merge](https://git-scm.com/docs/git-merge).
- Stash treatment of untracked versus ignored paths: [git-stash](https://git-scm.com/docs/git-stash).
- GitHub rulesets and required pull requests/checks: [About rulesets](https://docs.github.com/en/repositories/configuring-branches-and-merges-in-your-repository/managing-rulesets/about-rulesets) and [Available rules](https://docs.github.com/en/repositories/configuring-branches-and-merges-in-your-repository/managing-rulesets/available-rules-for-rulesets).
- Codex worktrees and ignored-file behavior: [Codex worktrees](https://developers.openai.com/codex/app/worktrees).
- Codex hook scope and security boundary: [Codex hooks](https://developers.openai.com/codex/hooks) and [Agent approvals and security](https://developers.openai.com/codex/agent-approvals-security).
- Kimi tool approvals, hooks, Working Directory, session rollback, and local data: [Tools](https://www.kimi.com/code/docs/en/kimi-code-cli/reference/tools.html), [Hooks](https://www.kimi.com/code/docs/en/kimi-code-cli/customization/hooks.html), [VS Code core operations](https://www.kimi.com/code/docs/en/kimi-code-for-vscode/core-operations.html), and [Data locations](https://www.kimi.com/code/docs/en/kimi-code-cli/configuration/data-locations.html).
- VS Code parent-repository safety, explicit multi-root folders, and read-only path rules: [Source Control FAQ](https://code.visualstudio.com/docs/sourcecontrol/faq), [Multi-root workspaces](https://code.visualstudio.com/docs/editing/workspaces/multi-root-workspaces), and [Read-only mode](https://code.visualstudio.com/updates/v1_79#_readonly-mode).

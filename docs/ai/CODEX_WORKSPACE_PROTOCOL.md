# Codex workspace protocol

## Purpose

This is the operating contract for Codex work on ZenFlow. It reduces accidental cross-session replacement through isolated worktrees, fail-closed local checks, visible owner review, and remote branch protection. It cannot prevent a malicious same-user process from rewriting files or bypassing local hooks.

The contract governs Git and local operator tools. It does not change IndexedDB, Supabase, application sync, Web/PWA, Android, iOS, or Tauri behavior. Qwen has no repository-writer authorization under this contract and remains read-only unless the owner approves a separate isolated workspace contract.

## Current local finding

The 2026-07-26 audit found multiple independent writable clones, legacy work on `main`, and recovered untracked audio whose paths overlap files already present on `origin/main`. Legacy roots are evidence and recovery sources, not normal work lanes. Do not pull, reset, clean, stash-pop, or delete them until their remaining work has a separately reviewed hash inventory.

The previously recovered sync/reset helper is rejected. It stashes only part of local state and can move a divergent branch to a remote tip without binding the action to the exact repository, branch, object IDs, or preserved files.

## Required topology

1. Use one stable control clone outside every legacy checkout, build folder, ignored `output/` directory, or cloud-synced folder.
2. The control clone owns the only integration worktree on `main`. `main` is clean and review-only.
3. Every editing session gets one linked, locked worktree and one unique `codex/<task-slug>` branch.
4. Codex owns that worktree for the lifetime of the task; other assistants remain read-only unless a separately approved protocol gives them an isolated namespace.
5. Transfer work through exact commits on pushed branches and pull requests. Never transfer through a shared stash, filesystem copy, session rollback, or VS Code “Sync Changes”.

Git normally refuses to check out one branch in more than one linked worktree. Do not use `git worktree add --force`, unlock an active lane, or treat an ignored clone as the control repository.

## Bootstrap a stable control clone

Choose stable absolute paths under an operator-owned, non-synced directory:

- control `main`: `<zenflow-root>/people-first-app-main`
- task lanes: `<zenflow-root>/worktrees/codex-<task>`

These paths are local operator state and must not be committed. Existing legacy roots remain frozen recovery evidence.

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

The command fetches `origin` without pruning recovery refs, resolves existing path ancestors before checking overlap, refuses tracked, untracked, or ignored control-clone state, and requires the control lane to match exact `origin/main`. It rejects existing branches or targets, nested repositories, and destinations under `output/`. It starts at exact `origin/main`, creates a locked worktree, and writes one private sibling `<worktree>.code-workspace` containing exactly that lane.

Git is invoked with argument arrays, never through a shell. If checkout fails after creation, rollback is limited to the exact clean just-created worktree, its unchanged start-point branch, and the byte-identical generated workspace file. Any path-identity change, branch movement, or new tracked, untracked, or ignored state preserves the lane for owner review.

Do not start editing if creation or the resulting doctor check returns `STOP`.

## Start and inspect a session

At the beginning of a Codex lane:

```sh
npm run agent:workspace -- doctor --agent codex --mode edit
```

The edit check requires the canonical repository remote, a named `codex/` branch, a clean locked registered worktree, exactly one registered `main` lane, and a locally available `origin/main`. Canonical HTTPS must contain no userinfo; canonical SSH uses user `git`; neither form may add a custom port, query, or fragment.

During active edits, `doctor` reports a dirty lane as `STOP`. That does not forbid normal editing; it forbids synchronization and handoff until every file is committed or explicitly classified.

## Safe synchronization

```sh
npm run agent:workspace -- sync
```

By default, `sync` performs only `git fetch origin` and reports the relationship. It does not move `HEAD`, the index, or files, and it deliberately does not prune remote-tracking refs.

Only the clean integration `main` lane may apply a behind-only update:

```sh
npm run agent:workspace -- sync --apply
```

`create`, `bootstrap-human-review`, and `sync --apply` are owner-authorized mutations. An agent may assist only after the owner explicitly authorizes that exact mutation and the command remains visible for review; an agent-tool hook result never authenticates human origin. A `--reviewed-sha` value pins the exact fetched object against a time-of-check/time-of-use race; it is not authentication, approval, or authorization.

If incoming commits touch protected governance or runtime paths, apply also requires the exact reviewed `origin/main` tip:

```sh
npm run agent:workspace -- sync --apply --reviewed-sha <exact-origin-main-sha>
```

Feature lanes are fetch-only. If `origin/main` advances, preserve the pushed feature tip and reconcile through the pull request or a new isolated follow-up lane. Do not hide the decision behind a bare `git pull`.

Before apply, the CLI inventories ignored paths and rejects any local ignored state. Its exact and ancestor/descendant collision analysis is defense in depth, and Git receives its no-overwrite-ignore option. Refusal leaves `HEAD`, index, and ignored bytes unchanged.

There is no automated path for `git reset --hard`, `git clean`, `git stash`, stash-pop, implicit pull, automatic rebase, force-push, pruning, or file deletion.

## Commit and push boundaries

The shared Husky hooks apply to terminal Git, VS Code, and Codex when installed:

- pre-commit rejects `main` and detached HEAD;
- pre-push rejects every destination `refs/heads/main`;
- pre-push accepts only a same-named `codex/` source/destination pair;
- pre-push rejects tags, unsupported branch namespaces, ref deletion, and non-fast-forward updates;
- runtime checks validate the fetch URL and every configured push URL for `origin`;
- pre-push validates the exact remote name and a strict canonical HTTPS/SSH URL supplied by Git.

Git permits a human operator to bypass local hooks. The Codex command guard rejects common bypass patterns, but it is a secondary control rather than an authorization boundary. GitHub rules and required pull-request checks remain authoritative.

The tracked Codex hook registration binds the guard to actor `codex`. Mutation in the canonical repository requires a `codex/` current branch. On `main`, shell execution is deny-by-default except for a bounded read-only command set. On feature lanes, the guard fails closed for unknown or opaque dispatch, executable shell expansion, shell environment prefixes, privileged wrappers, package install/update lifecycle execution, unapproved Git plumbing, dynamic workspace arguments, unreviewed package scripts, cross-worktree paths, destructive filesystem operands, and hidden paths in edit payloads.

The reviewed package-script names are a usability allowlist, not content attestation. Same-user repository write access could change an allowlisted script or its descendants, so hooks cannot replace capability isolation, visible owner approval, recovery copies, GitHub rules, and required CI.

Do not force-push, delete refs, or rewrite a handed-off branch. Add a new follow-up commit so the exact receipt remains auditable.

## Exact-tip handoff

After committing and pushing the same-named feature branch:

```sh
npm run agent:workspace -- handoff --json
```

`handoff` returns `GO` only when the worktree is clean and locked, the branch uses `codex/`, the branch contains at least one changed path relative to its `origin/main` merge base, and the same-named remote-tracking ref equals local `HEAD`. Its bounded receipt records branch, base, tip, tree, repository identities, ahead/behind state, exact changed paths, and the presence/hash of `.verification-done`.

The changed-path manifest is limited to 500 paths. Larger work must be split or use a separately owner-approved evidence process. An independently advanced `origin/main` does not erase the feature tip; the receipt exposes the distance for protected review.

## VS Code repository visibility

Open the generated `<worktree>.code-workspace` in a new VS Code window. Writable editing workspaces contain exactly one root. Tracked settings disable automatic nested, parent, linked-worktree, and repository-list scanning and show the current root in the window title.

The one exception is the owner-review workspace for historical recovery evidence:

- workspace file: `<absolute-review-workspace-file>`;
- Git folder: `<absolute-control-path>`;
- non-Git review folder: `<absolute-audio-review-path>`.

This workspace exists so the owner can see a clean `main` checkout and listen to quarantined historical audio in one window. The review folder contains no `.git`; folders use mode `0500`, files use mode `0400`, and VS Code honors them through `files.readonlyFromPermissions`. Those modes prevent edits, not reads. Explorer must show both named roots while Source Control shows exactly one provider for the control clone with zero changes. Codex must never use this review workspace as an editing directory.

Create and verify the review workspace only with the bounded commands:

```sh
npm run agent:workspace -- bootstrap-human-review \
  --control-path <absolute-control-path> \
  --audio-source-path <absolute-recovered-audio-source-path> \
  --audio-review-path <absolute-audio-review-path> \
  --workspace-file <absolute-review-workspace-file>

npm run agent:workspace -- check-human-review \
  --control-path <absolute-control-path> \
  --audio-review-path <absolute-audio-review-path> \
  --workspace-file <absolute-review-workspace-file>
```

The check must return `ready=true`, `audioCount=17`, `repositoryCount=1`, `branch=main`, `clean=true`, zero ignored paths, and the same head as `origin/main`. The repository count verifies the generated manifest and CLI Git checks; it is not live VS Code telemetry. `npm run check:agent-workspace` is a source/registration CI check and does not prove that machine-local artifacts exist.

Open that workspace with installed extensions disabled:

```sh
code --new-window --disable-extensions <absolute-review-workspace-file>
```

Keep it in Restricted Mode. Until the live window is inspected, extension isolation and the Source Control provider count remain `UNVERIFIED`.

## Historical Kimi audio and provenance

Kimi-named recovery ledgers, clean-room reconstruction records, and the fixed human listening inventory are historical provenance artifacts, not active workspace authorization. Keep them until the convergence ledger classifies them. No recovered binary may enter runtime merely because it is visible locally or named in a ledger.

The external review folder remains local evidence. Before any promotion, prove it is not a repository, copy only a separately approved file into a new Codex lane, and rerun the existing audio/provenance checks. If a product path already exists on `origin/main` with a different hash, preserve both identities and stop.

## Incident procedure

Stop when the branch is `main`, detached, wrong-prefix, dirty before sync, lacks a merge base, has another active owner, overlaps incoming paths, has a different common directory/remote, or when reset, clean, force-push, stash-pop, rollback, or VS Code sync was attempted.

Preserve the worktree. Record branch, `HEAD`, `origin/main`, status, common directory, registry, and collision hashes without exposing contents. Do not delete, prune, unlock, or reconcile until the owner reviews the evidence.

## Rollback of this protocol

Revert protocol or guard changes through a protected pull request. Removing tracked commands or hooks never authorizes worktree cleanup. Remove a linked worktree only after its exact branch tip is pushed, handoff is green, no process holds the lane, and recovery is proven unnecessary.

## Source-backed applicability

- Git worktree semantics: [git-worktree](https://git-scm.com/docs/git-worktree.html).
- Fast-forward integration: [git-merge](https://git-scm.com/docs/git-merge).
- Stash treatment of untracked and ignored paths: [git-stash](https://git-scm.com/docs/git-stash).
- GitHub rulesets and required checks: [About rulesets](https://docs.github.com/en/repositories/configuring-branches-and-merges-in-your-repository/managing-rulesets/about-rulesets).
- Codex worktrees and ignored-file behavior: [Codex worktrees](https://developers.openai.com/codex/app/worktrees).
- Codex hooks and security boundary: [Codex hooks](https://developers.openai.com/codex/hooks) and [Agent approvals and security](https://developers.openai.com/codex/agent-approvals-security).
- VS Code repository and read-only behavior: [Source Control FAQ](https://code.visualstudio.com/docs/sourcecontrol/faq), [Multi-root workspaces](https://code.visualstudio.com/docs/editing/workspaces/multi-root-workspaces), and [Read-only mode](https://code.visualstudio.com/updates/v1_79#_readonly-mode).

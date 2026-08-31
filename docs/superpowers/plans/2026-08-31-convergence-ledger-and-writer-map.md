# Convergence Ledger And Writer Map Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Produce a repeatable, private, hash-bound inventory of every ZenFlow worktree, local/remote ref, open PR, independent clone, and active writer so later integration and cleanup decisions are evidence-backed.

**Architecture:** Add a read-only Node.js inventory utility whose pure core parses Git worktree/ref/status data and classifies history without reading file contents. The CLI invokes Git, `gh`, `ps`, and `lsof` with argument arrays and `shell: false`, writes a mode-`0600` private JSON snapshot outside every repository, and emits only bounded aggregate counts to stdout.

**Tech Stack:** Node.js 22, CommonJS pure core, ESM CLI, Vitest, Git plumbing, GitHub CLI, macOS `ps`/`lsof` read-only probes.

**Spec:** `docs/superpowers/specs/2026-08-31-global-convergence-release-parity-design.md`

## Global Constraints

- Start from exact released `origin/main` SHA `b2341c0ca405e2f32892e4e96be86474290abe63` in locked branch `codex/convergence-ledger-20260831`.
- Never reset, clean, stash, pull, rebase, prune, delete, close a PR, move a worktree, or modify any inventoried source.
- Treat active Codex/Qwen/tmux/emulator-owned sources as `ACTIVE_SKIP`; do not claim them frozen.
- Do not read or copy file contents, credentials, `.env*`, signing material, user journals, production exports, Kimi/Qwen private configuration, or private receipts.
- Private output is `/Users/yehor/Projects/ZenFlow/quarantine/global-convergence-20260831/live-inventory` and must remain outside Git with directory mode `0700` and files mode `0600`.
- Committed documentation may contain stable aliases, branch names, public commit SHAs, and aggregate counts, but not operator-private absolute paths or sensitive filenames.
- Qwen remains read-only; this inventory does not authorize a Qwen branch namespace or any writer mutation.

---

### Task 1: Pure inventory parsing and classification

**Files:**
- Create: `scripts/convergence-inventory-core.cjs`
- Create: `scripts/__tests__/convergence-inventory-core.test.ts`

**Interfaces:**
- Produces: `parseWorktreePorcelain(text)`, `classifyRefRelation(input)`, `aliasLocator(path, aliases)`, and `summarizeInventory(snapshot)`.
- Consumes: plain strings and objects only; no filesystem, process, Git, or network access.

- [ ] **Step 1: Write failing worktree parser tests**

Use a literal fixture covering a branch worktree, a detached worktree, `locked`, and `prunable`. Assert records retain exact `HEAD`, branch, and flags without inferring safety from the path.

```ts
expect(parseWorktreePorcelain(fixture)).toEqual([
  {
    path: "/repo/control",
    head: "a".repeat(40),
    branch: "refs/heads/main",
    detached: false,
    locked: false,
    prunable: false,
  },
  {
    path: "/repo/worktrees/task",
    head: "b".repeat(40),
    branch: null,
    detached: true,
    locked: true,
    prunable: false,
  },
]);
```

- [ ] **Step 2: Write failing relation-classification tests**

Use hand-derived table rows:

```ts
it.each([
  [{ ahead: 0, behind: 137, unique: 0, equivalent: 0 }, "IN_MAIN"],
  [{ ahead: 2, behind: 166, unique: 0, equivalent: 2 }, "PATCH_EQUIVALENT"],
  [{ ahead: 3, behind: 351, unique: 2, equivalent: 1 }, "UNIQUE_COMMITS"],
  [{ ahead: null, behind: null, unique: null, equivalent: null }, "UNRELATED"],
])("classifies %o as %s", (input, expected) => {
  expect(classifyRefRelation(input)).toBe(expected);
});
```

- [ ] **Step 3: Write failing alias and summary tests**

Assert the longest matching absolute prefix wins, unknown paths become `UNALIASED`, and summary counts distinguish `ACTIVE_SKIP`, dirty worktrees, unique refs, patch-equivalent refs, open human PRs, and open bot PRs.

- [ ] **Step 4: Run RED**

Run:

```sh
npx vitest run --configLoader runner scripts/__tests__/convergence-inventory-core.test.ts
```

Expected: FAIL because `scripts/convergence-inventory-core.cjs` does not exist.

- [ ] **Step 5: Implement the minimal pure core and run GREEN**

Export the four functions, reject malformed numeric inputs, never treat size/age as cleanup proof, and rerun the focused test until all cases pass.

---

### Task 2: Read-only live inventory CLI

**Files:**
- Create: `scripts/convergence-inventory.mjs`
- Create: `scripts/convergence-inventory.d.mts`
- Create: `scripts/__tests__/convergence-inventory.test.ts`
- Modify: `package.json`

**Interfaces:**
- Consumes: `--legacy-root`, `--canonical-root`, `--output-dir`, and `--expected-main-sha` literal arguments.
- Produces: `<output-dir>/inventory.json` and `<output-dir>/summary.json`, atomically replaced with mode `0600`; stdout contains only schema version, timestamp, SHA, counts, and output locator.

- [ ] **Step 1: Write failing CLI boundary tests with injected runners**

Test that the CLI refuses relative roots, a mismatched expected main SHA, output inside any repository/worktree, missing canonical remote identity, and a changed source observation between the first and final Git probes. Test that every subprocess invocation uses an argument array and `shell: false`.

- [ ] **Step 2: Write failing privacy/output tests**

Use temp repositories and fake process rows. Assert the public summary contains no absolute home path, status path, command line, environment value, file content, or credential-bearing URL. Assert private JSON records path aliases and status counts while secret-like status paths are reduced to a category and hash, not copied verbatim.

- [ ] **Step 3: Run CLI tests and confirm RED**

Run:

```sh
npx vitest run --configLoader runner scripts/__tests__/convergence-inventory.test.ts
```

Expected: FAIL because the CLI module and injected runner interface do not exist.

- [ ] **Step 4: Implement bounded process and repository probes**

Invoke these read-only operations with `spawnSync(..., { shell: false })`:

```text
git worktree list --porcelain
git for-each-ref --format=<literal> refs/heads refs/remotes/origin
git rev-list --left-right --count <ref>...<main>
git cherry <main> <ref>
git status --porcelain=v1 --untracked-files=all
git rev-parse HEAD
git rev-parse --git-common-dir
git remote get-url --all origin
git remote get-url --push --all origin
gh pr list --repo Yehor212/people-first-app --state open --limit 100 --json <literal-fields>
ps -axo pid=,ppid=,etime=,command=
lsof -nP -a -d cwd
```

Apply per-command timeouts and bounded output buffers. Record timeout/error as `UNVERIFIED`; do not drop the source or retry indefinitely.

- [ ] **Step 5: Implement atomic private writes and package wiring**

Create the exact private directory only when every ancestor resolves outside all repository roots, set directory mode `0700`, create a sibling temp file with exclusive mode `0600`, sync, rename atomically, and verify the final regular-file identity/mode. Add:

```json
"convergence:inventory": "node scripts/convergence-inventory.mjs"
```

- [ ] **Step 6: Run focused GREEN verification**

Run both convergence test files, `npm run lint`, `npm run typecheck`, and `git diff --check`.

---

### Task 3: Capture and document the live convergence snapshot

**Files:**
- Create: `docs/convergence/2026-08-31-live-inventory-summary.md`
- Private output: `/Users/yehor/Projects/ZenFlow/quarantine/global-convergence-20260831/live-inventory/inventory.json`
- Private output: `/Users/yehor/Projects/ZenFlow/quarantine/global-convergence-20260831/live-inventory/summary.json`

**Interfaces:**
- Consumes: exact released main SHA and the current process/worktree/PR/ref state.
- Produces: a private exact-locator snapshot plus a sanitized repository summary that drives preservation and integration plans.

- [ ] **Step 1: Verify main and writer state immediately before capture**

Confirm the canonical control clone is clean at exact `b2341c0ca405e2f32892e4e96be86474290abe63`. Re-enumerate tmux panes, Qwen/Codex processes, emulators, process CWDs, and open repository handles. Label observed active paths `ACTIVE_SKIP`; never infer inactivity from elapsed time.

- [ ] **Step 2: Run the inventory once**

Run:

```sh
npm run convergence:inventory -- \
  --legacy-root /Users/yehor/Documents/Codex/2026-06-10/new-chat/people-first-app \
  --canonical-root /Users/yehor/Projects/ZenFlow/people-first-app-convergence-control-20260831 \
  --output-dir /Users/yehor/Projects/ZenFlow/quarantine/global-convergence-20260831/live-inventory \
  --expected-main-sha b2341c0ca405e2f32892e4e96be86474290abe63
```

Do not mutate sources when a probe returns `UNVERIFIED` or changes during capture.

- [ ] **Step 3: Validate the private snapshot**

Check file modes, schema version, canonical SHA, stable source observations, ref/worktree/PR counts, alias coverage, and absence of raw secret-like paths, file contents, credential-bearing remotes, or full process commands.

- [ ] **Step 4: Author the sanitized summary**

Record aggregate counts and stable branch/PR identifiers under these dispositions: `IN_MAIN`, `PATCH_EQUIVALENT`, `UNIQUE_COMMITS`, `DIRTY_ONLY`, `ACTIVE_SKIP`, `UNRELATED`, and `UNVERIFIED`. Do not label anything `SUPERSEDED`, `TAKE`, `QUARANTINE`, or deletion-ready until a later semantic adjudication and recovery packet proves it.

- [ ] **Step 5: Commit and protected delivery**

Run focused/full relevant checks, the narrow secrets security profile, final diff/status review, commit, push exact same-name branch, create a PR, and merge only after required CI passes. After main release proof, use the snapshot as input to separate preservation and semantic-integration plans.

# Kimi Workspace Gate Retirement Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Remove every active Kimi workspace-gate, installer, actor, and branch authorization while retaining the repository's Codex-only isolation, protected delivery, and historical Kimi audio/provenance records.

**Architecture:** Convert the workspace control plane from a two-actor allowlist to a single literal `codex` actor and `codex/` branch namespace. Make the source/registration checker encode absence of retired files and live Kimi authorization, replace the mixed protocol with a Codex-only protocol, and keep historical audio review paths semantically separate from the removed gate.

**Tech Stack:** Node.js CommonJS/ESM, TypeScript declarations, Vitest, Husky, Codex hooks, Git worktrees, GitHub protected pull requests.

**Spec:** `docs/superpowers/specs/2026-08-31-global-convergence-release-parity-design.md`

## Global Constraints

- Work only in a clean locked `codex/kimi-gate-retirement-20260831` lane created from exact `origin/main`.
- Do not modify Qwen CLI configuration or runtime and do not authorize a `qwen/` writer namespace.
- Delete only the active Kimi workspace gate; retain historical Kimi audio, provenance, clean-room reconstruction, and human-review evidence.
- Preserve clean review-only `main`, locked worktrees, canonical remote validation, fetch-only feature synchronization, exact-tip handoff, and protected PR delivery.
- Never weaken reset, clean, stash, force-push, ref-deletion, cross-worktree, or unknown-execution guards.
- No production dependencies, mock runtime data, credentials, private Kimi configuration, or generated output may enter the patch.

---

### Task 1: Encode the Codex-only retirement contract as a failing check

**Files:**
- Modify: `scripts/check-agent-workspace-protocol.cjs`
- Modify: `scripts/__tests__/agent-workspace-core.test.ts`

**Interfaces:**
- Consumes: existing `check:agent-workspace` source/registration contract and `validateCreateRequest()` pure decision helper.
- Produces: a fail-closed absence contract for retired Kimi files and an executable regression asserting that only `agent: "codex"` is accepted.

- [ ] **Step 1: Make the protocol checker require the replacement and forbid retired wiring**

Add a helper that records a failure when a retired path still exists and assertions equivalent to:

```js
for (const retiredPath of [
  "docs/ai/CODEX_KIMI_WORKSPACE_PROTOCOL.md",
  "scripts/install-kimi-workspace-hook.mjs",
  "scripts/install-kimi-workspace-hook.d.mts",
  "scripts/__tests__/install-kimi-workspace-hook.test.ts",
]) {
  requireMissing(retiredPath);
}

if (Object.hasOwn(packageJson.scripts || {}, "agent:kimi-hook")) {
  failures.push("package.json must not expose retired agent:kimi-hook");
}
```

Read `docs/ai/CODEX_WORKSPACE_PROTOCOL.md` and require the existing safety markers against that file. Require `AGENTS.md` to reference `Codex Workspace Isolation` and the new protocol path. Remove every positive installer marker check.

- [ ] **Step 2: Add a pure decision regression for a rejected Kimi actor**

Add an assertion equivalent to:

```ts
it("accepts only the Codex workspace actor", () => {
  const request = {
    slug: "focused-task",
    targetPath: "/repo/worktrees/focused-task",
    repoRoot: "/repo/control",
    branchExists: false,
    targetExists: false,
    worktreePaths: ["/repo/control"],
  };

  expect(validateCreateRequest({ ...request, agent: "codex" })).toMatchObject({
    ok: true,
    branch: "codex/focused-task",
  });
  expect(validateCreateRequest({ ...request, agent: "kimi" })).toMatchObject({ ok: false });
});
```

- [ ] **Step 3: Run the focused checks and record RED**

Run:

```sh
npm run check:agent-workspace
npx vitest run --configLoader runner scripts/__tests__/agent-workspace-core.test.ts
```

Expected: both commands fail because the old protocol/installer still exists and `kimi` remains in `SUPPORTED_AGENTS`.

- [ ] **Step 4: Keep the RED patch uncommitted until the implementation makes it green**

Confirm `git diff --check` succeeds and `git status --short` contains only the plan and the two intended RED files.

---

### Task 2: Remove the installer and publish the Codex-only operating protocol

**Files:**
- Delete: `docs/ai/CODEX_KIMI_WORKSPACE_PROTOCOL.md`
- Create: `docs/ai/CODEX_WORKSPACE_PROTOCOL.md`
- Delete: `scripts/install-kimi-workspace-hook.mjs`
- Delete: `scripts/install-kimi-workspace-hook.d.mts`
- Delete: `scripts/__tests__/install-kimi-workspace-hook.test.ts`
- Modify: `package.json`
- Modify: `AGENTS.md`
- Modify: `.husky/pre-push`
- Modify: `scripts/check-agent-context.mjs`

**Interfaces:**
- Consumes: the existing worktree topology, synchronization, handoff, incident, and human audio-review safety language.
- Produces: one Codex-only protocol at `docs/ai/CODEX_WORKSPACE_PROTOCOL.md` and package/context wiring with no runnable Kimi installer.

- [ ] **Step 1: Replace the mixed protocol with a Codex-only protocol**

Preserve the shared sections for topology, stable control clone, `create --agent codex`, `doctor --agent codex`, fetch-only sync, protected path review, commit/push boundaries, exact-tip handoff, VS Code isolation, historical audio review, incidents, rollback, and authoritative source links. Rewrite active statements so they specify exactly one editing actor and branch namespace:

```markdown
3. Every editing session gets one linked, locked worktree and one unique `codex/<task-slug>` branch.
4. Codex owns that worktree for the lifetime of the task; other assistants remain read-only unless a separately approved protocol gives them an isolated namespace.
```

State explicitly that Qwen is not authorized to write through the retired Kimi path. Keep Kimi-named audio and recovery references only where they describe historical provenance or the read-only review inventory.

- [ ] **Step 2: Delete the retired installer implementation, declaration, and installer test**

Remove the three exact tracked paths. Do not inspect, print, edit, or delete any machine-local `~/.kimi-code` path, backup, receipt, session, or credential.

- [ ] **Step 3: Remove package and repository instruction wiring**

Remove `agent:kimi-hook` and `install-kimi-workspace-hook.test.ts` from `package.json`. Rename the `AGENTS.md` section to `Codex Workspace Isolation`, reference `docs/ai/CODEX_WORKSPACE_PROTOCOL.md`, retain `doctor --agent codex`, and retain the external historical audio caution without Kimi editor instructions. Change the Husky comment to describe a Codex/repository safety boundary.

- [ ] **Step 4: Point agent-context validation at the new section**

Replace the required section marker with:

```js
"Codex Workspace Isolation"
```

- [ ] **Step 5: Commit the documentation and installer retirement unit**

Run `npm run check:agent-context`, `git diff --check`, inspect staged deletions, and commit with:

```sh
git commit -m "chore: retire Kimi workspace installer"
```

---

### Task 3: Restrict workspace creation, hooks, handoff, and push authorization to Codex

**Files:**
- Modify: `scripts/agent-workspace-core.cjs`
- Modify: `scripts/agent-workspace.mjs`
- Modify: `scripts/agent-workspace-runtime.cjs`
- Modify: `scripts/agent-workspace-runtime.d.cts`
- Modify: `scripts/agent-workspace-command-guard.cjs`
- Modify: `scripts/codex-governance/tool-targets.cjs`
- Modify: `.codex/hooks/agent-workspace-guard.cjs`
- Modify: `scripts/__tests__/agent-workspace-core.test.ts`
- Modify: `scripts/__tests__/agent-workspace.test.ts`
- Modify: `scripts/__tests__/agent-workspace-command-guard.test.ts`
- Modify: `scripts/__tests__/agent-workspace-git-hook.test.ts`

**Interfaces:**
- Consumes: `evaluateCommitGuard`, `evaluatePushGuard`, `validateCreateRequest`, `doctorErrors`, `handoffWorkspace`, `evaluateWorkspaceEvent`, and the Codex PreToolUse registration.
- Produces: literal Codex-only actor/branch enforcement with unchanged generic safety behavior.

- [ ] **Step 1: Collapse the pure actor and branch allowlists**

Use one supported actor and one branch prefix:

```js
const SUPPORTED_AGENTS = new Set(["codex"]);
const CODEX_BRANCH = /^codex\//;
const CODEX_REMOTE_BRANCH = /^refs\/heads\/codex\//;
```

Apply those contracts to worktree creation, same-name push validation, and error messages. Keep direct-main, deletion, tag, unsupported namespace, renamed ref, and non-fast-forward rejection intact.

- [ ] **Step 2: Restrict CLI doctor/create help and handoff declarations**

Make edit doctor accept only `--agent codex`; show only `--agent codex` in help; require `codex/` for handoff; and change the declaration type to:

```ts
agent: "codex";
```

Do not rename or remove historical `HUMAN_REVIEW_SOURCE_LEDGER` and audio review labels.

- [ ] **Step 3: Simplify the command guard to the bound Codex actor**

Require `expectedAgent === "codex"`, update read-only lane messages to `codex/`, and remove Kimi installer special cases from dynamic/operator-only parsing. Keep all generic package-selection, shell expansion, privilege, destructive Git/filesystem, repository identity, and cross-worktree checks.

- [ ] **Step 4: Restrict the Codex hook adapter and Git command analyzer**

Make `.codex/hooks/agent-workspace-guard.cjs` accept only the literal `codex` argument. In `tool-targets.cjs`, keep renamed feature-branch pushes forbidden for `codex/`; remove `kimi/` from the exemption regex so attempts to use that retired namespace remain unsupported rather than authorized.

- [ ] **Step 5: Rewrite actor tests without reducing safety coverage**

Use `codex/other-task` for wrong-worktree and cross-worktree scenarios. Replace the positive Kimi hook test with a negative unsupported-actor test:

```ts
expect(runHook(codex, write, "kimi").status).not.toBe(0);
```

Keep an explicit test showing that a `codex/focused-task` source cannot push to `refs/heads/kimi/focused-task`. Convert worktree creation/handoff success fixtures to `agent: "codex"` and `codex/<task>`. Leave historical audio inventory tests unchanged.

- [ ] **Step 6: Run focused GREEN verification**

Run:

```sh
npm run check:agent-workspace
npm run test:agent-workspace
npm run check:agent-context
```

Expected: all commands exit zero and the focused suite reports zero failed tests.

- [ ] **Step 7: Commit the Codex-only enforcement unit**

Review `git diff --check` and commit with:

```sh
git commit -m "refactor: enforce Codex-only workspace lanes"
```

---

### Task 4: Prove absence, security posture, and protected delivery

**Files:**
- Modify only if a check exposes an in-scope omission from Tasks 1-3.

**Interfaces:**
- Consumes: the complete branch diff against exact `origin/main`.
- Produces: fresh local evidence, a security report, exact-tip handoff, and a protected PR ready for main CI.

- [ ] **Step 1: Classify every remaining Kimi match**

Run a repository-wide tracked search excluding dependencies and generated output. Every remaining match must be one of: historical audio/provenance evidence, immutable prior plan/spec history, or the current retirement spec/plan. Fail if any live package script, installer, actor allowlist, hook registration, `kimi/` branch authorization, or mixed active protocol remains.

- [ ] **Step 2: Run the full relevant local gate set**

Run:

```sh
npm run check:agent-workspace
npm run test:agent-workspace
npm run check:agent-context
npm run check:best-practices
npm run check:no-ai-templates
npm run check:task-completion
npm run lint
npm run typecheck
npm test -- --run
npm run build
```

Record exact exit codes and test counts. A missing, skipped, or failed required command remains `UNVERIFIED` or `FAIL`, never `PASS`.

- [ ] **Step 3: Run the narrowest suitable security suite and inspect findings**

Run `/Users/yehor/.codex/bin/codex-security-suite.sh` with the repository-diff/governance profile supported by its help output. Review the generated report for credential exposure, unsafe shell execution, weakened Git protections, dependency drift, and false positives. Do not suppress a valid finding to obtain green output.

- [ ] **Step 4: Review the final diff and working state**

Run `git diff origin/main...HEAD`, `git diff --check`, `git status --short`, and a tracked-file scan for secrets/generated output. Confirm Qwen files are unchanged, historical audio records remain, retired installer files are deleted, and only planned paths changed.

- [ ] **Step 5: Push an exact same-name handoff branch and open a protected PR**

After verification and commits, push `codex/kimi-gate-retirement-20260831`, run `npm run agent:workspace -- handoff --json`, verify local/upstream tip equality, and open a PR targeting `main`. Do not merge until `build`, `android-gate`, `ios-gate`, `production-data-integrity`, and every other required check complete successfully.

- [ ] **Step 6: Verify main release before declaring this subproject complete**

After protected merge, fetch without pruning, prove the PR tip is an ancestor of the new `origin/main`, monitor the main workflows, and run public Web/PWA smoke checks against the deployed main artifact. Record any skipped platform publication separately; repository CI is not proof of app-store release.

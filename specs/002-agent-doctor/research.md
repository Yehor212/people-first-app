# Research: Agent Doctor

## Decision 1 — Use Node child-process argument arrays, not shell commands

**Decision**: Use `spawnSync(command, args, { shell: false, timeout, maxBuffer })`
with `process.execPath` and fixed relative script paths for health probes.

**Why**: ZenFlow's workspace protocol requires argument-array Git invocation and
rejects opaque shell dispatch. Node documents that `spawnSync` supports a finite
`timeout`, bounded `maxBuffer`, and defaults `shell` to `false`; it also warns
against unsanitized input when a shell is enabled.

**Sources**:

- [Node.js child_process API](https://nodejs.org/api/child_process.html)
- Local: `docs/ai/CODEX_KIMI_WORKSPACE_PROTOCOL.md` §§2–4 and
  `scripts/agent-workspace-runtime.cjs`

**Rejected alternatives**:

- One `npm run … && npm run …` alias: stops at the first failure, has no
  per-check report, and offers no safe structured output.
- `exec` or `shell: true`: introduces parsing and injection exposure that the
  fixed command map does not need.
- Parallel children: can interleave output and make evidence ordering less clear
  while providing no material user benefit for a small diagnostic suite.

## Decision 2 — Reuse authorities; do not duplicate their checks

**Decision**: The doctor calls existing script entry points rather than copying
their validation logic.

**Why**: `check:agent-context`, `check:agent-orchestra`, the eval catalog,
context server, automatic context, and workspace doctor each own a different
contract. Duplicating them could drift or turn a fail-closed detail into a
false-green aggregate.

**Local evidence**:

- `package.json` scripts around `check:agent-orchestra` through
  `check:agent-workspace`
- `docs/ai/AGENT_CONTEXT_PERSISTENCE.md` §Verification
- `docs/ai/AGENT_CHANGE_GOVERNANCE.md` §Evidence Gates

## Decision 3 — Use Node's built-in test runner for the focused unit suite

**Decision**: Add a `node --test` test file for the standalone CLI logic and
keep the existing Vitest guard regression for the package-script allowance.

**Why**: The repository supports Node 22, whose stable `node:test` runner runs
explicit test files without adding dependencies. This keeps the new CLI testable
in a clean locked worktree where installing `node_modules` would intentionally
make the workspace doctor report ignored local state.

**Source**:

- [Node.js test runner API](https://nodejs.org/download/release/v22.17.0/docs/api/test.html)

## Decision 4 — Preserve existing ignored-local-state STOP results

**Decision**: Do not filter or reinterpret the existing workspace doctor result.

**Why**: The workspace protocol deliberately rejects ignored local paths before
creation/synchronization because ignored bytes may be overwritten by checkout
hooks. `node_modules/` and Husky generated state can be a normal reason for a
local `STOP`, but hiding it in the aggregate would falsely claim a healthy
workspace.

**Local evidence**:

- `scripts/agent-workspace-runtime.cjs` `listIgnoredPaths()` and
  `createWorkspace()` rejection path
- `docs/ai/CODEX_KIMI_WORKSPACE_PROTOCOL.md` §§2–4

## Decision 5 — No runtime, platform, or release claim

**Decision**: Scope the feature to developer tooling and document the proof
boundary.

**Why**: The command has no ZenFlow UI, native, PWA, sync, or release artifact
reachability. A passing local diagnostic does not demonstrate real Codex profile
loading, effective sandbox permissions, human review, native parity, or public
deployment.

**Local evidence**:

- `AGENTS.md` Cross-Platform Mandate and Persistent Codex Agent Orchestra
- `docs/ai/AGENT_CONTEXT_PERSISTENCE.md` §Verification

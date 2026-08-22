# Research: Agent Governance Evidence

## Decision 1 — Routine lifecycle hooks must not write diagnostics

**Decision**: Remove automatic `.codex-audit.log` writes from
`.codex/hooks/skill-router-gate.cjs`. Diagnostics move to an explicit command.

**Evidence**: The current hook invokes `fs.appendFileSync` on normal allow and
deny paths, while `.gitignore` hides the log. This can make a clean-looking
worktree misleading and exposes CWD-dependent behavior. The [Codex Hooks
documentation](https://learn.chatgpt.com/docs/hooks) says hook commands run with
the session cwd; it does not make hook lifecycle delivery or profile loading a
runtime proof.

**Alternatives rejected**:

- Keep automatic logging behind an environment variable: rejected because a
  default lifecycle path could still have hidden side effects or rely on ambient
  environment state.
- Keep automatic logging but move it outside the repository: rejected because it
  still writes private diagnostic data without an explicit operator action.

## Decision 2 — Local observation is a separate, stdout-first command

**Decision**: Add `run-agent-governance-observation.mjs`, which performs one
controlled local child-process invocation, outputs an allowlisted JSON receipt to
stdout, and writes only when `--output` explicitly names a safe path under
`output/agent-orchestra/`.

**Evidence**: Existing code already has safe in-root path checks, but its general
private writer ultimately replaces a target through `rename`. The new observation
writer must instead use create-only semantics so a later run cannot replace a
prior receipt. Node's [filesystem documentation](https://nodejs.org/api/fs.html)
documents `O_EXCL` creation semantics; the implementation also rejects path
escape, links, nonregular targets, and duplicate destinations.

**Alternatives rejected**:

- Reuse `.codex-audit.log`: rejected; legacy contents are private local state and
  it is written implicitly.
- Accept arbitrary output paths: rejected because a receipt could escape the
  worktree or overwrite another file.
- Store raw hook input or transcript: rejected by the repository privacy and
  no-production-data rules.

## Decision 3 — Local process facts are not host-runtime facts

**Decision**: Every receipt carries evidence class `LOCAL_PROCESS_OBSERVED` and
states that custom-profile loading, effective permissions, host lifecycle
delivery, token/cost, and platform parity are `UNVERIFIED`.

**Evidence**: Current configuration and generated profile files are declarations,
not a launcher-owned effective inventory. The repository evaluator protocol
requires separately observed effective inventory and bounded synthetic denial
before runtime claims; it forbids live write probes.

**Alternatives rejected**:

- Treat `agent_type`, `permission_mode`, or a controlled event payload as proof
  of actual permissions: rejected; those are event data, not verified effective
  capabilities.
- Add a live write/connector probe: rejected; this feature has no external-write
  authorization and such a probe would not be needed for the local contract.

## Decision 4 — Local A/B reports cannot promote policy

**Decision**: Recompute task-slice identity, bind output actors to declared
execution roles, preserve all missing prerequisities individually, and reject any
local `PROMOTABLE` decision.

**Evidence**: The existing validator accepts caller-authored `VERIFIED` states,
numeric counters, a stale task hash, and output actors not declared in the arm.
The [OWASP AI Agent Security Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/AI_Agent_Security_Cheat_Sheet.html)
supports structured validation, least privilege, and limiting sensitive logging;
these principles apply to the local governance boundary.

**Alternatives rejected**:

- Add more self-authored fields/thresholds: rejected because they remain
  unauthenticated local claims.
- Make `PROMOTABLE` possible if all fields say `VERIFIED`: rejected because no
  authenticated external promotion path exists in this feature.

## Decision 5 — PDI timeout must be bounded, fail-closed, and path-safe

**Decision**: Bound Git-root discovery to 1.5 seconds and checker execution to 10
seconds beneath the current 20-second Stop hook timeout, classify child
timeouts/errors with stable categories and a manual command, and make exactly one
checker attempt.

**Evidence**: The current root discovery (5s) plus checker (15s) consume the full
20s outer Stop timeout and relay `spawnSync` error text that can include an
absolute Node path. The existing production-data-integrity policy requires
checker internal errors to block rather than be treated as clean.

**Alternatives rejected**:

- Increase outer timeout only: rejected; it lacks a measured budget and leaves
  path disclosure unchanged.
- Retry automatically: rejected; it can amplify a slow checker and turn timeout
  behavior non-deterministic.
- Convert a timeout to allow: rejected; this weakens integrity enforcement.

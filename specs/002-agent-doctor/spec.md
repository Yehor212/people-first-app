# Feature Specification: Agent Doctor

**Feature ID**: `002-agent-doctor`
**Implementation branch**: `codex/agent-doctor`
**Created**: 2026-08-04
**Status**: Implemented; see [convergence.md](convergence.md) for fresh proof and remaining evidence gaps.
**Input**: User request: "делай по лучшим практикам и через спек кит" after asking for a Codex-equivalent agent doctor.

## Problem and Outcome

ZenFlow has several authoritative agent-health checks, but an operator must know
their names, order, and workspace arguments to use them correctly. A single
failure can be overlooked when the checks are run ad hoc. The outcome is one
local, read-only command, `npm run doctor:agent`, that executes the bounded
agent-health probes, reports every result, and exits non-zero when any probe is
not healthy.

This command diagnoses repository tooling only. It does not alter the shipped
ZenFlow application, synchronize Git state, repair configuration, read private
user data, or claim runtime loading, human review, or release approval.

## User Scenarios & Testing

### User Story 1 — Run one reliable agent-health diagnosis (Priority: P1)

A ZenFlow operator in a supported workspace runs `npm run doctor:agent` and
receives a compact result for every required agent-health probe plus one overall
`GO` or `STOP` result.

**Why this priority**: This removes the current need to remember several
independent commands and prevents a healthy-looking partial diagnosis.

**Independent test**: A focused Node test substitutes deterministic child-process
outcomes and proves that all planned probes are reported, successful probes yield
`GO`, and a failed probe yields `STOP` with a non-zero process result.

**Acceptance scenarios**:

1. **Given** all bounded probes return exit code zero, **when** the operator runs
   the doctor, **then** it reports every probe and returns `GO` with exit code 0.
2. **Given** one bounded probe returns a non-zero code, times out, or cannot
   start, **when** the operator runs the doctor, **then** it still reports the
   other probes, returns `STOP`, and exits with code 2.
3. **Given** the workspace is `main`, `codex/*`, or `kimi/*`, **when** no
   workspace mode is supplied, **then** the doctor selects the corresponding
   review or edit workspace diagnostic without guessing from untrusted input.

---

### User Story 2 — Diagnose a specific workspace mode safely (Priority: P2)

An operator can explicitly select `--mode review` or `--mode edit --agent
codex|kimi` when investigating an unusual lane, and invalid combinations fail
before any diagnostic child process starts.

**Why this priority**: The existing workspace protocol distinguishes the
integration `main` lane from locked agent edit lanes. The aggregate command must
retain that boundary rather than hide it.

**Independent test**: Focused tests cover automatic branch-derived workspace
arguments, explicit valid combinations, and invalid options that produce a
deterministic `STOP` without spawning a shell command.

**Acceptance scenarios**:

1. **Given** `--mode review`, **when** the doctor runs, **then** its workspace
   probe uses review mode and does not add an agent argument.
2. **Given** `--mode edit --agent codex`, **when** the doctor runs, **then** its
   workspace probe uses exactly those argument values.
3. **Given** an unknown flag, unsupported mode, or an edit mode without a valid
   agent, **when** the doctor runs, **then** it exits with code 2 and describes
   the invalid invocation without starting child probes.

---

### User Story 3 — Use results safely in automation (Priority: P3)

An operator or CI-style caller can request `--json` and receive a bounded,
machine-readable result without raw credentials, environment values, or an
unbounded child-process transcript.

**Why this priority**: Health checks often execute close to local configuration;
the diagnostic must be useful without becoming a new secret-exposure channel.

**Independent test**: The focused test asserts that representative credential-like
strings are redacted, summaries are length-bounded, and the JSON schema exposes
only the aggregate status and per-probe diagnostic metadata.

**Acceptance scenarios**:

1. **Given** `--json`, **when** the doctor completes, **then** stdout contains
   one parseable JSON object with overall and per-probe statuses.
2. **Given** a child probe includes a credential-like URL or token in its error
   output, **when** the doctor reports that failure, **then** the sensitive part
   is replaced before it reaches stdout or stderr.

### Edge Cases

- A child probe times out, produces too much output, or cannot be spawned: the
  result is `STOP`, the summary is bounded and redacted, and the remaining
  bounded probes still run.
- The current branch is neither `main`, `codex/*`, nor `kimi/*`: automatic
  workspace selection stops with an explicit configuration error; it does not
  silently choose a different actor.
- A normal `npm ci` installation may leave ignored local directories that the
  existing workspace doctor intentionally treats as `STOP`. The aggregate command
  must surface that existing result unchanged rather than suppressing it.
- The repository is opened on Windows or Linux: command construction remains
  Node-based and path-separator independent, but runtime execution there remains
  separately unverified until it is run on that host.

## Clarification Record

No user question was required. The command name, local-only scope, and safe
default are materially determined by the repository's existing agent-health and
workspace protocols: aggregate their existing fail-closed outcomes, choose
review/edit mode from the current branch only, and provide explicit overrides
for diagnostics. No external side effect, product decision, or irreversible
choice is implied by that interpretation.

## Requirements

### Functional Requirements

- **FR-001**: The repository MUST expose `npm run doctor:agent` as the single
  entry point for the aggregate diagnosis.
- **FR-002**: The doctor MUST run these existing probes as separate named results:
  `check:agent-context`, `check:agent-orchestra`,
  `check:agent-orchestra:eval`, `ai:context:check`, `ai:context:auto-check`,
  and the appropriate `agent:workspace doctor` invocation.
- **FR-003**: The doctor MUST run every named probe even after an earlier probe
  fails, except when command-line validation fails before the plan is safe to
  construct.
- **FR-004**: The aggregate status MUST be `GO` only when every probe exits with
  code 0; non-zero, timeout, spawn error, or invalid invocation MUST yield
  `STOP` and process exit code 2.
- **FR-005**: With no workspace arguments, the doctor MUST derive the workspace
  mode only from the current Git branch: `main` selects review, `codex/*` selects
  edit/Codex, and `kimi/*` selects edit/Kimi. Any other branch MUST stop with a
  configuration error.
- **FR-006**: The doctor MUST support `--mode auto|review|edit`,
  `--agent codex|kimi`, `--json`, and `--help`; unsupported flags and invalid
  combinations MUST fail deterministically without spawning probes.
- **FR-007**: Health probes MUST use the current Node executable with fixed
  argument arrays and `shell: false`. Automatic branch detection MAY use only a
  fixed Git executable and fixed argument array. No user-provided value may form
  a shell command or choose an executable.
- **FR-008**: The doctor MUST not repair, fetch, sync, write repository files,
  modify configuration, or invoke a mutation-capable workspace command.
- **FR-009**: Human-readable and JSON output MUST report the check ID, status,
  exit metadata, elapsed time, and a bounded diagnostic summary. Credential-like
  URL user-info and common token prefixes MUST be redacted before output.
- **FR-010**: `doctor:agent` MUST be recognized by ZenFlow's reviewed
  package-script and agent-workspace command guards as a diagnostic-only command,
  with a regression test for that path.
- **FR-011**: The command and its documentation MUST distinguish local structural
  evidence from runtime profile loading, effective sandbox permissions, human
  approval, and product-platform release evidence.

### Non-Functional Requirements

- **NFR-001**: Each child probe has a finite timeout and bounded captured output
  so one malfunctioning child cannot block or flood the diagnosis indefinitely.
- **NFR-002**: The implementation uses only Node built-ins and introduces no
  package, cloud service, credential, or production dependency.
- **NFR-003**: The command is deterministic for a fixed repository state and
  explicit options; its result format is stable enough for local automation.

### Key Entities

- **Doctor configuration**: Validated command-line intent comprising output
  format, workspace mode, and agent identity when edit mode is selected.
- **Probe definition**: A fixed internal name, Node entry point, arguments,
  timeout, and purpose for one existing health check.
- **Probe result**: Safe status metadata for one probe: identifier, `GO`/`STOP`,
  exit code or failure kind, elapsed milliseconds, and redacted summary.
- **Doctor report**: One aggregate `GO` or `STOP` verdict with the complete ordered
  probe-result list and selected workspace configuration.

## Success Criteria

- **SC-001**: A focused test proves six planned health probes are all reported
  for a healthy simulated run and that the aggregate exit code is 0.
- **SC-002**: A focused negative test proves one failed, timed-out, or unavailable
  probe yields aggregate `STOP` and exit code 2 without omitting later results.
- **SC-003**: A focused test proves option validation and automatic workspace
  selection cover `main`, `codex/*`, `kimi/*`, and an unsupported branch.
- **SC-004**: A focused test proves output redacts representative credential-like
  strings and caps summaries.
- **SC-005**: The real command runs in the isolated Codex worktree, reports all
  six actual checks, and retains the underlying result for any existing failure.
- **SC-006**: The affected guard tests accept literal `npm run doctor:agent` and
  retain denial of dynamic or mutation-capable package-script paths.

## Assumptions and Boundaries

- The request authorizes a local repository implementation only; it does not
  authorize staging, committing, pushing, deploying, changing remote branches,
  or changing production data.
- `check:agent-context`, `check:agent-orchestra`,
  `check:agent-orchestra:eval`, and the context checks remain the authoritative
  implementations. The new command aggregates their outcomes and does not
  reimplement or weaken their logic.
- The command's platform impact is developer tooling only. Web/Vite, installed
  PWA, Android/Capacitor, iOS/WKWebView, and Desktop/Tauri application runtime
  are intentionally N/A; macOS CLI execution is in scope. Windows and Linux
  host execution are `UNVERIFIED` until run on those hosts.
- No interactive clarification is required: a read-only, fail-closed aggregate
  command with an explicit review/edit mode is the safest interpretation of the
  requested agent doctor.

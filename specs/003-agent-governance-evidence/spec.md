# Feature Specification: Agent Governance Evidence

**Feature Branch**: `codex/agent-routing-ab-eval`  
**Created**: 2026-08-04  
**Status**: Draft  
**Input**: User description: "Приступай к рекомендациям через Spec Kit" following the completed, non-promotable agent-routing A/B pilot.

## Goal

Make the next recommendations from the routing pilot operational without treating a
local structural check as proof of Codex-host behavior. The operator must be able to
see when an agent-governance hook is intentionally side-effect free, review the
bounded observations it can produce, and see why a routing result remains
non-promotable when host profile, permission, holdout, human, or token evidence is
absent.

## Explicit Requirements

- Use the full protected Spec Kit lifecycle and retain the routing pilot's evidence
  boundaries.
- Preserve the ten-role catalog and adaptive, evidence-backed routing; do not make
  full-ten fan-out the default and do not delete roles on the basis of one pilot.
- Eliminate every local audit-file mutation from ordinary hook processing and provide
  a separately invoked, bounded local observation command instead.
- Add a privacy-safe, reproducible local observation and validation path for hook and
  runtime-related evidence without falsely claiming that it proves Codex profile
  loading or effective permissions.
- Tighten the A/B evidence boundary so no structural or self-attested observation can
  promote an adaptive routing policy.
- Keep product runtime, user data, remote systems, deployments, paid APIs, role
  permissions, and generated role definitions out of scope.

## Evidence-backed Implied Requirements

- A lifecycle check must not silently dirty the repository through a hidden local log,
  because that undermines workspace-isolation evidence.
- A separately invoked diagnostic needs an explicit output boundary and an error path
  that cannot alter a hook's allow/block decision.
- A receipt must distinguish an observed local process fact from an installed-host
  profile/permission fact, since generated profile files and role prose are not runtime
  proof.
- A validator must preserve `UNVERIFIED` gaps instead of substituting zeroes, defaults,
  simulated facts, or a majority result.
- A local routing evaluator must not accept caller-authored `VERIFIED` fields as enough
  to select a routing policy, because this repository has no authenticated external
  launcher, holdout, qualified-review, permission, or usage receipt.
- A lifecycle timeout/error must remain fail-closed without exposing absolute local
  paths or adding automatic retries that can multiply a slow integrity check.

## Non-Goals

- This feature does not grant, revoke, or test live agent, filesystem, network,
  connector, production, or external-write permissions.
- It does not invoke a paid Codex/model runtime, create owner-controlled holdouts,
  obtain qualified-human review, or measure billed tokens.
- It does not alter ZenFlow Web/Vite, installed PWA, Android/Capacitor, iOS/WKWebView,
  Desktop/Tauri, storage, sync, account flows, release policy, or user-facing copy.
- It does not ratify the proposed Spec Kit constitution or make proposal-only criteria
  a blocking authority.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Keep routine hook checks side-effect free (Priority: P1)

An operator runs an ordinary routing hook check and needs the repository to remain
unchanged unless diagnostics were deliberately enabled, so that a clean worktree is
meaningful evidence rather than an accidental log side effect.

**Why this priority**: The prior A/B closure could not attribute ignored audit-log
writes to a run because it lacked a pre-run baseline.

**Independent Test**: A controlled hook invocation without audit opt-in leaves the
expected audit destination absent or byte-identical; an explicit opt-in records one
bounded lifecycle event without changing the hook's primary allow/block result.

**Acceptance Scenarios**:

1. **Given** audit diagnostics are not explicitly enabled, **When** a supported
   read-only routing-hook event is evaluated, **Then** no local audit file is created
   or changed by that event.
2. **Given** an operator explicitly runs the local observation command with a safe
   ignored output location, **When** its controlled hook-process check completes,
   **Then** it records one bounded receipt without exposing secrets or changing any
   hook decision.
3. **Given** the requested observation destination is unsafe or cannot be written,
   **When** the command runs, **Then** it fails without creating an out-of-worktree
   artifact and without changing any hook decision.

---

### User Story 2 - Inspect what local observations do and do not prove (Priority: P1)

An evidence reviewer needs a deterministic packet for local hook/process observations
and a clear boundary around unavailable host evidence, so that a profile filename,
simulated permission result, or self-attestation is never reported as actual Codex
runtime enforcement.

**Why this priority**: The pilot structurally validated role configuration but could
not prove host profile loading, effective permissions, or lifecycle execution.

**Independent Test**: A valid local observation packet exposes its exact source and
limits; malformed, simulated-as-host, or incomplete host claims are rejected or kept
`UNVERIFIED` and cannot upgrade a routing decision.

**Acceptance Scenarios**:

1. **Given** only repository-local process evidence is available, **When** an
   observation packet is prepared, **Then** it is labelled as local and cannot be
   interpreted as installed-host profile or permission proof.
2. **Given** an observation claims installed-host behavior without the required
   identity, effective-inventory, timestamp, and bounded permission evidence,
   **When** it is validated, **Then** it is rejected or remains explicitly
   `UNVERIFIED`.
3. **Given** the environment cannot supply a trusted host receipt, **When** an
   operator validates a routing pilot, **Then** the missing evidence is reported with
   the exact reason and the routing policy remains non-promotable.

---

### User Story 3 - Preserve conservative A/B promotion boundaries (Priority: P2)

An owner reviewing the routing pilot needs the decision gate to keep targeted routing,
full-ten routing, and root-only observations comparable without falsely selecting a
default route from incomplete evidence.

**Why this priority**: The completed visible pilot is useful only for its exact slice;
it does not establish semantic quality, cost, or host isolation.

**Independent Test**: A completed comparison with absent trusted runtime proof,
owner-controlled holdout, qualified review, or usage ledger always remains
non-promotable and lists each missing prerequisite.

**Acceptance Scenarios**:

1. **Given** a comparison contains only local structural or process observations,
   **When** it is evaluated, **Then** its decision records those observations but does
   not claim runtime enforcement or a general routing winner.
2. **Given** an arm supplies a malformed or contradictory runtime-evidence state,
   **When** validation runs, **Then** the comparison is rejected rather than silently
   normalized.
3. **Given** all roles have current selected/excluded dispositions but promotion
   prerequisites are incomplete, **When** the report is rendered, **Then** adaptive
   routing remains a bounded candidate rather than a default-policy change.

---

### User Story 4 - Receive bounded hook failure feedback (Priority: P2)

An operator whose integrity hook reaches its time limit needs a concise, fail-closed
message and a deterministic next action, so that a diagnostic timeout does not expose
the local executable path or cause an automatic retry storm.

**Why this priority**: The observed Stop hook failure contained a local Node path and
the nested timeout budget had no reserve beneath the outer hook timeout.

**Independent Test**: A controlled checker timeout or internal process failure returns
the same fail-closed category, omits the raw local path, and does not initiate another
checker execution.

**Acceptance Scenarios**:

1. **Given** the integrity checker exceeds its bounded local budget, **When** the
   Stop hook reports the failure, **Then** it retains a blocking outcome with a stable,
   path-safe timeout category and a manual remediation command.
2. **Given** an internal checker process returns an environment-specific error,
   **When** the hook reports it, **Then** the message omits the raw error path while
   preserving a non-success result.
3. **Given** a checker failure occurs, **When** the hook finishes, **Then** it has not
   automatically retried the checker or weakened the integrity decision.

### Edge Cases

- An explicit observation output is requested in a read-only filesystem, through a
  link, or outside the current worktree.
- A hook receives malformed input, an unsupported event, or no bounded target.
- A packet labels a generated profile, test fixture, or stub connector result as
  installed-host evidence.
- A runtime observation becomes stale, references the wrong profile/runtime identity,
  or omits its source and timestamp.
- A later operator has genuine host evidence but no owner-controlled holdout, qualified
  review, or trusted usage ledger.
- The production-data integrity checker consumes its nested time budget or returns an
  environment-specific process error before the outer lifecycle hook completes.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: Routine routing-hook processing MUST be side-effect free with respect to
  local audit files on every supported lifecycle path.
- **FR-002**: A separately invoked local observation command MUST emit minimum
  lifecycle metadata to standard output by default and write a receipt only when the
  operator supplies a safe, ignored in-worktree destination.
- **FR-003**: An unsafe or failed observation write MUST NOT change a routing hook's
  allow/block decision, create an out-of-worktree artifact, or expose secrets or raw
  private content.
- **FR-004**: The system MUST represent local process observations, declared profile
  intent, and installed-host runtime observations as distinct evidence classes.
- **FR-005**: The system MUST require a current source identity, timestamp, scope,
  effective inventory, and bounded permission-observation result before it can mark a
  host-runtime claim as observed; otherwise it MUST remain `UNVERIFIED`.
- **FR-006**: The A/B validator MUST recompute the task-slice identity from its
  retained task fields and require every raw-output actor identity to match the arm's
  declared execution identities exactly.
- **FR-007**: The system MUST reject malformed, contradictory, stale, or
  simulated-as-host observation packets before they can influence an A/B decision.
- **FR-008**: The local A/B decision gate MUST never accept caller-authored
  `VERIFIED` fields, numeric counters, or local receipts as sufficient to return a
  `PROMOTABLE` status; a separately authenticated external promotion path is outside
  this feature.
- **FR-009**: The A/B decision gate MUST preserve every missing prerequisite for
  promotion, including trusted runtime evidence, owner-controlled holdout, qualified
  review, and trusted usage counters.
- **FR-010**: The system MUST preserve all ten role identities and record targeted
  route dispositions without treating the current pilot as authorization to delete a
  role or make full-ten routing the default.
- **FR-011**: The implementation MUST have focused regression coverage for default
  side-effect behavior, explicit diagnostic behavior, malformed observation packets,
  receipt provenance, actor/task binding, and non-promotion boundaries before it
  changes protected production tooling.
- **FR-012**: A timeout or process-error classification in the integrity lifecycle
  hook MUST remain fail-closed, path-safe, bounded to one check attempt, and actionable
  without automatic retry.
- **FR-013**: The implementation MUST retain an explicit rollback path and a
  Web/Vite, PWA, Android, iOS, and Desktop/Tauri status for this governance-only work.
- **FR-014**: A `COMPLETED` A/B arm MUST record at least one invocation. A valid
  local output-file hash still proves only supplied local bytes, not actor execution
  or installed-host behavior.
- **FR-015**: A cancelled A/B run MUST be representable as a terminal
  `PILOT_INTERRUPTED` receipt with at least one `INTERRUPTED` arm, a non-promotable
  decision, and no partial output/review presented as completed evidence.

### Key Entities

- **Local Observation Command**: An explicitly invoked, repository-local process
  check that reports bounded hook lifecycle observations without claiming host runtime
  execution.
- **Local Observation**: A deterministic fact about a repository-local process or
  validation run; it is not installed-host profile or permission evidence.
- **Host Runtime Receipt**: A separately sourced record of a named host/runtime,
  profile, effective capability inventory, and bounded synthetic permission result.
- **Promotion Prerequisite Ledger**: The explicit set of evidence classes required
  before an A/B comparison can influence a routing-policy decision.
- **Failure Category**: A stable, path-safe reason for an integrity lifecycle failure
  that remains distinct from an actual data-integrity finding.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Focused regression checks prove that 100% of tested default
  routing-hook invocations leave the audit destination unchanged.
- **SC-002**: Focused regression checks prove that 100% of tested explicit local
  observation runs emit one bounded result and write no receipt unless a safe output
  is explicitly requested.
- **SC-003**: Every tested malformed, simulated-as-host, stale, or incomplete host
  claim is rejected or retained as `UNVERIFIED`; none upgrades a routing comparison.
- **SC-004**: Every tested task-slice mutation, output-actor mismatch, or
  caller-authored local promotion claim is rejected by the revised validator.
- **SC-005**: Every A/B report accepted by the revised validator lists each missing
  promotion prerequisite individually; no unavailable field becomes a zero, pass, or
  general routing recommendation.
- **SC-006**: Every tested integrity timeout/process-error result stays blocking,
  excludes a raw local path, and runs at most one checker attempt.
- **SC-007**: The final governed diff affects no ZenFlow product-runtime, data,
  native-platform, deployment, or role-definition file.

## Platform and Domain Scope

| Surface | Status | Scope |
| --- | --- | --- |
| Web/Vite | N/A | No app runtime or browser behavior changes. |
| Installed PWA | N/A | No service worker, manifest, install, or cache changes. |
| Android/Capacitor | N/A | No native wrapper, permission, or back-navigation changes. |
| iOS/WKWebView | N/A | No native wrapper, safe-area, or lifecycle changes. |
| Desktop/Tauri | N/A | No desktop application or Rust-side changes. |
| Store/Release | N/A | No build, signing, publication, or deployment action. |
| Accessibility/i18n | N/A | No user-facing interface or translated copy changes. |
| Security/Privacy | IN SCOPE | Local diagnostic boundaries, receipt provenance, and no private data. |
| Performance/Reliability | IN SCOPE | Hook lifecycle behavior, bounded local observation, timeout reserve, and failure isolation. |
| Testing/Operations | IN SCOPE | Deterministic regression proof and operator-facing evidence states. |
| Agent Governance | IN SCOPE | Routing evidence, role-preservation, and promotion guardrails. |

## Assumptions

- The current desktop/CLI environment does not expose a trusted, free-to-run Codex-host
  profile-load and effective-permission probe. The feature must preserve that gap rather
  than simulate a pass.
- A local observation receipt is an operator aid, not a security log, production
  record, or proof of host execution.
- The existing A/B evaluator remains on this isolated branch and can be extended without
  changing generated role profiles, the canonical registry, or application runtime.
- Any future actual-host receipt requires an owner/runtime-operator run with a
  connector-free or synthetic-denial boundary; it is outside this implementation unless
  separately authorized and observable.

## Rollback

Revert the isolated-branch diff for this feature. Delete only ignored local observation
artifacts created by an operator if they no longer need them; no product data or remote
state is created by this feature.

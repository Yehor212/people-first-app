# Feature Specification: Agent Routing A/B Evaluation

**Feature Branch**: `codex/agent-routing-ab-eval`

**Created**: 2026-08-04

**Status**: Draft

**Input**: User description: "делай A/B тестирование через Spec Kit, чтобы проверить пользу ролей агентов, hooks и правил."

## Goal

Give the ZenFlow owner a reproducible, privacy-safe comparison of three ways of
handling the same real agent-governance task: one coordinator alone, the smallest
evidence-backed set of roles, and the fixed ten-role council. The comparison must
show what was actually observed and must not invent a winner when evidence is absent.

## Explicit Requirements

- Run the investigation through the full Spec Kit lifecycle.
- Compare root-only, targeted-role, and fixed-full-ten arms on an identical task slice.
- Measure missing critical outcomes, evidence coverage, duplicate output, elapsed time,
  retries, invocations, and any runtime usage information exposed by the execution environment.
- Keep production data, product runtime, remote systems, and deployment out of scope.

## Non-Goals

- This feature does not change ZenFlow Web/PWA, Android, iOS, Desktop/Tauri, storage,
  sync, user-facing copy, deployment, or release policy.
- It does not claim semantic generalization, runtime sandbox enforcement, qualified-human
  approval, real-user acceptance, or token savings without the separately required evidence.
- It does not use user journal, habit, mood, account, credential, or production data.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Run a Matched Comparison (Priority: P1)

An owner needs to run the same privacy-safe agent-governance task through all three
routing arms, so that agent-count decisions are based on comparable evidence rather
than intuition or a structural checker alone.

**Why this priority**: The existing role catalog can validate configuration shape but
cannot establish whether roles improve this type of task enough to justify their cost.

**Independent Test**: A prepared comparison with three complete, same-input arm
records is accepted only when their required identities and measurements match; a
missing or mismatched record is rejected or remains explicitly unavailable.

**Acceptance Scenarios**:

1. **Given** one approved privacy-safe task slice and one frozen evaluation identity,
   **When** an owner prepares a comparison, **Then** exactly three arms are created in
   recorded randomized order: root-only, targeted roles, and fixed full ten.
2. **Given** a comparison record, **When** any arm uses a different task, runtime,
   tool-permission surface, budget, or adjudication rubric, **Then** the report shows
   the mismatch and cannot make a comparative recommendation.
3. **Given** completed arm records, **When** all required raw outputs and measurements
   are supplied, **Then** the report preserves their identities and exposes arm-level
   elapsed time, invocation count, retries, duplication, and available usage values.

---

### User Story 2 - See Honest Evidence Boundaries (Priority: P1)

An evidence reviewer needs to distinguish a structurally valid pilot from a semantic,
runtime, human, user, or efficiency claim, so that missing evidence never becomes a
false pass.

**Why this priority**: The current baseline is intentionally `NO_SEMANTIC_BASELINE`;
the feature must preserve that honesty rather than replace it with a fabricated score.

**Independent Test**: A completed comparison with unavailable token counters,
unreviewed raw outputs, or no owner-controlled holdout remains non-promotable and lists
the exact missing proof.

**Acceptance Scenarios**:

1. **Given** an execution environment that does not expose token usage, **When** the
   comparison is evaluated, **Then** each unavailable usage field is labelled
   `UNAVAILABLE` and no token-efficiency conclusion is emitted.
2. **Given** a visible task slice but no owner-controlled holdout, **When** a pilot
   result is generated, **Then** it is limited to the exact task slice and does not
   claim general superiority of any routing strategy.
3. **Given** a material risk found in one arm, **When** another arm identifies it with
   recheckable evidence, **Then** the report records the miss separately rather than
   deciding by majority vote or average score.

---

### User Story 3 - Reproduce and Review the Pilot (Priority: P2)

An operator needs a bounded artifact that can be revalidated later, so that a result
can be inspected without trusting a chat summary or hidden model reasoning.

**Why this priority**: Role and hook decisions affect future agents and need a
reviewable rollback path.

**Independent Test**: A report with altered raw output, missing required arm, duplicate
identity, or unsupported status fails deterministic validation.

**Acceptance Scenarios**:

1. **Given** a prepared or completed report, **When** a validator is run, **Then** it
   confirms the frozen task identity, arm order, allowed statuses, required metrics,
   raw-output hashes, and explicit unresolved evidence.
2. **Given** a valid pilot report, **When** a future operator uses a different task,
   runtime, model, tool surface, or rubric, **Then** it is treated as a new comparison
   rather than a continuation of the earlier result.

### Edge Cases

- A role runtime, effective permission surface, token counter, or retry counter is not
  exposed by the host environment.
- A targeted route omits an owner for a trigger that is evidenced in the task slice.
- A full-ten arm has duplicate, empty, malformed, or evidence-free output.
- A task slice contains a production-data reference, secret, personal record, or an
  unapproved external action.
- An arm is interrupted or runs longer than its declared budget.
- A reviewer has no owner-controlled holdout, qualified-human evidence, or real-user study.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The system MUST prepare exactly three named comparison arms: `ROOT_ONLY`,
  `TARGETED`, and `FIXED_FULL_TEN`.
- **FR-002**: The system MUST bind each arm to the same task-slice identity, artifact
  snapshot, declared runtime, tool-permission surface, time budget, and adjudication rubric,
  or record the exact mismatch as non-comparable.
- **FR-003**: The system MUST randomize and retain the arm execution order without
  changing the three required arms.
- **FR-004**: The system MUST retain raw output identities and hashes, elapsed time,
  invocation count, retry/interruption state, evidence coverage, critical misses, and
  duplicate-output results for every completed arm.
- **FR-005**: The system MUST represent unavailable usage, runtime, human, or holdout
  proof explicitly and MUST NOT infer token cost, semantic quality, permissions, or
  user acceptance from structural validity.
- **FR-006**: The system MUST report critical misses, forbidden outcomes, unresolved
  conflicts, and evidence gaps per arm; it MUST NOT select a winner by majority vote
  or an aggregate score that hides a hard blocker.
- **FR-007**: The system MUST allow an adaptive targeted arm only when all ten roles
  have recorded selected or excluded dispositions tied to current evidence locators.
- **FR-008**: The system MUST reject malformed, incomplete, task-mismatched,
  rubric-mismatched, or duplicate-identity records before presenting a comparison result.
- **FR-009**: The system MUST keep pilot inputs and outputs isolated from ZenFlow product
  runtime, data stores, sync, analytics, exports, backups, and deployment artifacts.
- **FR-010**: The system MUST retain a rollback-safe distinction between a completed
  visible-slice pilot and any future promotable baseline.

### Key Entities

- **Task Slice**: One privacy-safe, bounded real ZenFlow governance task with a frozen
  identity, scope, evidence locators, and rubric.
- **Comparison Run**: One three-arm attempt, including the randomized order, snapshots,
  runtime observations, and explicit limitations.
- **Arm Record**: One route's raw outputs, metrics, observed risks, evidence coverage,
  and status for the shared task slice.
- **Usage Ledger**: The available request, token, invocation, elapsed, retry, and
  interruption observations, with unavailable values retained as unavailable.
- **Review Ledger**: The bounded adjudication of required and forbidden outcomes,
  critical misses, unresolved conflict, and evidence status.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Every accepted comparison contains exactly three uniquely named arms and
  one identical task-slice identity across 100% of those arms.
- **SC-002**: Every unavailable required measurement is surfaced as unavailable in the
  final report; no comparison with a missing required efficiency counter is promoted
  as an efficiency result.
- **SC-003**: Every completed arm has a raw-output hash, elapsed-time observation, and
  invocation observation, or is rejected as incomplete.
- **SC-004**: Every role in the targeted and fixed-full-ten routes has a recorded
  disposition or execution record; no role is silently omitted.
- **SC-005**: Any altered identity, duplicate arm, malformed report, or mismatched
  shared condition is deterministically rejected by focused regression tests.

## Platform and Domain Scope

| Surface | Status | Scope |
| --- | --- | --- |
| Web/Vite | N/A | No application runtime behavior changes. |
| Installed PWA | N/A | No service-worker, install, or browser-surface changes. |
| Android/Capacitor | N/A | No native wrapper behavior changes. |
| iOS/WKWebView | N/A | No native wrapper behavior changes. |
| Desktop/Tauri | N/A | No desktop runtime behavior changes. |
| Store/Release | N/A | No build, signing, store, or deployment action. |
| Accessibility/i18n | N/A | No user-facing copy or interface changes. |
| Performance | IN SCOPE | Measure agent-run elapsed time and interruption/retry state only. |
| Security/Privacy | IN SCOPE | Exclude private and production data; preserve evidence boundaries. |
| Testing/Operations | IN SCOPE | Provide deterministic validation and a reviewable pilot receipt. |
| Agent Governance | IN SCOPE | Compare routing scope without changing roles or guard authority. |

## Assumptions

- The user-authorized pilot will use a current privacy-safe ZenFlow governance task;
  it is not a general product-quality study.
- The installed runtime may not expose trusted profile loading, effective permissions,
  exact billed-token counters, or an owner-controlled holdout. Those statuses remain
  `UNVERIFIED` rather than blocking preparation.
- No paid model API, connector, deployment, remote branch change, production data, or
  external write is needed for the harness or its local pilot.
- A wider route is retained only when it adds distinct, recheckable risk coverage for
  this bounded task without a critical miss or unacceptable measured delay.

## Rollback

The feature is reversible by reverting its isolated branch. Pilot packets remain local,
ignored operator artifacts and must never be promoted to application or release data.

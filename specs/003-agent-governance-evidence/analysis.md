# Spec Kit Analysis: Agent Governance Evidence

**Analysis time**: 2026-08-04T08:26:50Z  
**Scope**: Feature 003 only; protected repository-governance hooks and local
tooling, with no ZenFlow product/runtime modification.

## Requirement-to-task coverage

The completed task plan maps all 15 functional requirements to a concrete
implementation boundary and verification item. There are 26 tasks: two setup,
five test-first, fifteen implementation/verification, and four convergence
tasks. No requirement is uncovered.

| Requirement group | Tasks | Current evidence status |
|---|---|---|
| FR-001–005 routine no-write and explicit observation | T003–T011 | Focused hook/receipt tests; local receipt command |
| FR-006–010 A/B identity and non-promotion | T005, T012–T015 | Focused A/B tests and evaluator check |
| FR-011 regression-first governance evidence | T003–T007, T022 | Recorded RED then GREEN suite |
| FR-012 bounded PDI failure classification | T006, T019–T020 | Focused timeout/error path tests |
| FR-013 rollback, scope, and platform boundary | T001, T021–T024 | Convergence packet and final diff review |
| FR-014 completed-arm invocation integrity | T025 | Focused A/B RED→GREEN regression |
| FR-015 interrupted receipt coherence | T026 | Focused cancellation-state RED→GREEN regression |

## Consistency checks

- **Task identity**: the A/B core now recomputes its retained task-slice SHA-256
  before it accepts a result.
- **Actor identity**: completed output actors must equal the arm's declared
  execution role identities, not merely overlap them.
- **Invocation integrity**: a `COMPLETED` arm with `invocation_count: 0` is
  rejected; a local output hash remains file-content evidence, not execution
  provenance.
- **Cancellation integrity**: a cancelled run has a dedicated
  `PILOT_INTERRUPTED` terminal state and cannot retain partial output or a final
  review as completed evidence.
- **Promotion safety**: the local evaluator rejects `PROMOTABLE` even if its
  caller supplies locally authored positive fields; an authenticated external
  promotion path is absent.
- **Observation safety**: ordinary routing-hook handling has no audit-file write;
  the new observation command writes only when the operator explicitly supplies
  a validated create-only destination.
- **Failure safety**: PDI checker timeout, process error, malformed output, and
  unexpected status all block with a stable category and do not reflect raw
  child-process or checker-status text.

## Analyze result

The initial Spec Kit analyze pass found **0 critical**, **0 high**, and **0
medium** uncovered issues. A subsequent independent logic review exposed the
zero-invocation completed-arm counterexample and an unreachable interruption
state; T025–T026 added the minimal RED→GREEN corrections. Two material
boundaries remain deliberately unresolved rather than normalized:

1. A local child-process receipt cannot prove that Codex loaded the custom role
   profile, delivered a lifecycle event, or applied its declared permissions.
2. A local validator cannot establish a trusted holdout, qualified review,
   usage ledger, token cost, or policy-promotion authority.

Both stay `UNVERIFIED`; neither is converted into a product, release, or
routing-policy success claim.

## Non-regression boundary

This feature intentionally does not change role definitions, generated agent
profiles, `src/`, PWA/service-worker assets, Android, iOS, Tauri, deployment,
Supabase, or user data. Its rollback is limited to the Feature 003 diff in this
isolated `codex/agent-routing-ab-eval` worktree.

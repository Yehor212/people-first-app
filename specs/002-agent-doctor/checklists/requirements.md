# Requirements Checklist: Agent Doctor

**Purpose**: Review the written requirements for a fail-closed aggregate agent-health diagnostic.
**Created**: 2026-08-04
**Feature**: [spec.md](../spec.md)

## Requirement Completeness

- [x] CHK001 Are all existing health checks that the aggregate must include named explicitly? [Completeness, Spec §FR-002]
- [x] CHK002 Are the exact aggregate success and failure conditions defined independently of child implementation details? [Completeness, Spec §FR-004]
- [x] CHK003 Are read-only scope and prohibited repair/synchronization behaviors stated explicitly? [Completeness, Spec §FR-008]
- [x] CHK004 Are package entrypoint, guard recognition, test coverage, and documentation included as required deliverables? [Completeness, Spec §FR-001, §FR-010]

## Requirement Clarity

- [x] CHK005 Is automatic workspace selection unambiguous for `main`, `codex/*`, `kimi/*`, and every unsupported branch? [Clarity, Spec §FR-005]
- [x] CHK006 Are valid flags, invalid combinations, and the point at which invalid invocation must stop defined without relying on implied behavior? [Clarity, Spec §FR-006]
- [x] CHK007 Are timeout, bounded-output, and redaction obligations stated in measurable implementation-neutral terms? [Clarity, Spec §FR-009, §NFR-001]

## Consistency and Scenario Coverage

- [x] CHK008 Do the command-safety requirements align with the existing workspace protocol's fail-closed and argument-array constraints? [Consistency, Spec §FR-007]
- [x] CHK009 Are primary, explicit-mode, invalid-input, timeout/spawn-error, and ignored-local-state scenarios all represented? [Coverage, Spec §User Scenarios, §Edge Cases]
- [x] CHK010 Is the distinction between local structural proof and runtime/human/release proof consistently preserved? [Consistency, Spec §FR-011, §Assumptions and Boundaries]

## Acceptance Criteria Quality

- [x] CHK011 Can every success criterion be verified by a named focused test or real isolated-worktree command? [Measurability, Spec §SC-001–SC-006]
- [x] CHK012 Are the Mac-host verification target and the unverified Windows/Linux boundary explicit rather than implied by a cross-platform claim? [Coverage, Spec §Assumptions and Boundaries]

## Notes

- The checklist evaluates the specification only, not the implementation.
- All criteria are complete enough to proceed; no material product or authority
  question remains open for this local, non-mutating tooling feature.

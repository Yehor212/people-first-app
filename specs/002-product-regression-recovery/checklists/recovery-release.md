# Recovery and Release Requirements Checklist: Product Regression Recovery

**Purpose**: Validate that the security, data-recovery, availability, cross-platform, and release requirements are complete enough for implementation and PR review
**Created**: 2026-08-03
**Feature**: [spec.md](../spec.md)
**Depth / actor**: Formal high-risk release gate for author and reviewers

**Note**: This checklist evaluates the written requirements, not implementation behavior.

## Requirement Completeness

- [x] CHK001 Are every protected local object class and the verified-empty case explicitly included in removal requirements? [Completeness, Spec §FR-001-FR-004]
- [x] CHK002 Are the local commit, native cleanup, queue delivery, granular cloud data, backup segment, media blobs, remote vault, and final intent deletion each covered as separate lifecycle stages? [Completeness, Spec §FR-007-FR-010, §FR-061-FR-068]
- [x] CHK003 Are prior, duplicate, conflicting, malformed, and future-version removal operations specified rather than treated as absence? [Completeness, Spec §FR-057, §FR-069-FR-070]
- [x] CHK004 Are journal page requirements complete for verified-empty, ready, degraded, unavailable, and locked states? [Completeness, Spec §FR-013-FR-016, §FR-041]
- [x] CHK005 Are gate requirements defined for user settings, onboarding, local truth, remote rollout, kill switches, build capability, release policy, and missing consumers? [Completeness, Spec §FR-020-FR-027, §FR-072-FR-074]
- [x] CHK006 Are ceremony requirements complete for saved-entry placement, local/cloud status, lifecycle, fallback, release parity, rollback, and human approval? [Completeness, Spec §FR-028-FR-034, §FR-060, §FR-075]

## Requirement Clarity

- [x] CHK007 Are all no-local-change blockers named with stable codes and a defined recovery action? [Clarity, Spec §FR-003, §FR-017]
- [x] CHK008 Is the boundary between a preflight blocker and post-local partial success unambiguous? [Clarity, Spec §FR-004, §FR-008-FR-010]
- [x] CHK009 Is “atomic local removal” defined as all protected objects plus password/vault metadata changing together or none changing? [Clarity, Spec §FR-006-FR-007]
- [x] CHK010 Is remote durability ordered precisely enough to forbid global merge, premature media deletion, and vault deletion before protected-object verification? [Clarity, Spec §FR-061-FR-065]
- [x] CHK011 Is unknown journal count distinguished from a confirmed zero count and assigned a fail-closed availability outcome? [Clarity, Spec §FR-021-FR-023, §FR-041]
- [x] CHK012 Are “technical”, “visual runtime”, “artistic/craft”, and “user approval” defined as separate non-substitutable gates? [Clarity, Spec §FR-033, §FR-060]

## Requirement Consistency

- [x] CHK013 Is read-only preflight consistent with durable attempt recording by explicitly limiting allowed preflight-time writes to privacy-safe operation metadata? [Consistency, Spec §FR-001, §FR-004-FR-005]
- [x] CHK014 Is loss-tolerant display reading consistent with fail-closed export, mutation, migration, and protection removal? [Consistency, Spec §FR-011, §FR-013-FR-016]
- [x] CHK015 Is offline-first local success consistent with a truthful cleanup-pending result rather than remote success? [Consistency, Spec §FR-008-FR-010, §FR-039, §FR-044]
- [x] CHK016 Are feature user preferences kept distinct from rollout, security, billing, and release authorities? [Consistency, Spec §FR-022-FR-026, §FR-072-FR-074]
- [x] CHK017 Is ceremony production disablement consistent across its capability, kill switch, admission rows, and static fallback? [Consistency, Spec §FR-028-FR-034]

## Acceptance Criteria Quality

- [x] CHK018 Can no-change blockers be objectively evaluated through complete before/after fingerprints without inspecting real user content? [Measurability, Spec §SC-002]
- [x] CHK019 Can partial success and cleanup convergence be measured independently for native and cloud boundaries? [Measurability, Spec §SC-003-SC-003c]
- [x] CHK020 Can degraded page behavior be measured by exact readable order, requested count, unavailable count, and privacy-negative controls? [Measurability, Spec §SC-004]
- [x] CHK021 Can gate inventory completeness and boolean-adapter compatibility be objectively measured? [Measurability, Spec §SC-006-SC-007]
- [x] CHK022 Are exact-commit CI, target receipt, public runtime, and unavailable-platform evidence criteria distinct and measurable? [Measurability, Spec §SC-008-SC-011]

## Scenario and Edge-Case Coverage

- [x] CHK023 Are primary, alternate, exception, recovery, restart, duplicate, and concurrent-tab removal scenarios documented? [Coverage, Spec §User Story 1, §Edge Cases]
- [x] CHK024 Are direct stale-row writes and account/vault time-of-check-to-time-of-use changes addressed? [Coverage, Spec §FR-037, §FR-058, §FR-071]
- [x] CHK025 Are remote stale-client, extra protected data, CAS miss, abort, offline replay, and zero-row outcomes addressed without data deletion? [Coverage, Spec §FR-061-FR-065]
- [x] CHK026 Are metadata-only media and each upload, metadata-commit, and old-blob-deletion boundary addressed? [Coverage, Spec §FR-002, §FR-064, §Edge Cases]
- [x] CHK027 Are pagination ties, an unavailable cursor record, all-unavailable pages, and genuine empty pages distinguished? [Coverage, Spec §FR-013-FR-015, §Edge Cases]
- [x] CHK028 Are stale rollout, unavailable count, unknown key, missing consumer, and conflicting build-capability cases covered? [Coverage, Spec §FR-020-FR-027, §FR-072-FR-075]

## Non-Functional Requirements

- [x] CHK029 Are privacy requirements defined for UI, logs, analytics, durable intents, support receipts, test fixtures, and production bundles? [Security/Privacy, Spec §FR-016, §FR-025, §FR-040, §FR-055]
- [x] CHK030 Are owner, revision, row-snapshot, native-credential, sign-out, and account-switch boundaries all specified? [Security, Spec §FR-005-FR-006, §FR-037-FR-038, §FR-058, §FR-066-FR-071]
- [x] CHK031 Are focus, announcement, Escape, Android Back, 44 px, increased text, narrow viewport, eight locales, and RTL requirements documented? [Accessibility/Localization, Spec §FR-017-FR-019, §FR-047]
- [x] CHK032 Are bounded preflight/page work, static motion degradation, main-thread thresholds, bundle budgets, and performance evidence requirements quantified or linked to fixed project thresholds? [Performance, Spec §FR-032, §FR-048, Plan §Technical Context]
- [x] CHK033 Are Web, PWA, Android, iOS, Desktop, release, accessibility, performance, security/privacy, testing, and operations obligations each represented in the platform matrix? [Cross-platform, Spec §Platform Matrix]

## Dependencies, Assumptions, and Evidence Boundaries

- [x] CHK034 Are local-truth, existing sync/auth architecture, supported encryption formats, and no-new-paid-service assumptions explicit? [Assumption, Spec §Assumptions]
- [x] CHK035 Are the exact real-data cause, physical devices, native assistive technology, Windows runtime, artistic judgment, and user approval retained as explicit evidence gaps with closure paths? [Evidence boundary, Spec §Known Evidence Gaps]
- [x] CHK036 Are rollback requirements non-destructive and independent from restoring the 898-file historical snapshot? [Rollback, Spec §FR-035-FR-036, §FR-053]
- [x] CHK037 Is real-account removal authority explicitly reserved for the user or a separate just-in-time confirmation? [Authority, Spec §FR-012]
- [x] CHK038 Are live Supabase, public deployment, production CI, and exact-build claims prevented from inheriting local or subagent evidence? [Evidence boundary, Spec §FR-050-FR-052]

## Validation Notes

- All 38 questions were evaluated against `spec.md`, `plan.md`, `data-model.md`, `research.md`, the four contract documents, and `traceability.md` on 2026-08-03.
- The checklist is complete for requirements-writing quality. It does not assert that implementation, tests, devices, CI, deployment, visual craft, or real-account recovery pass.
- No question depends on fabricated production records. Test scenarios are constrained to isolated fixtures.

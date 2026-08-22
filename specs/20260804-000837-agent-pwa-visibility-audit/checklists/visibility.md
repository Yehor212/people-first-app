# Visibility-Audit Requirements Checklist

**Purpose**: Evaluate whether the audit specification is complete, clear, and safe enough to distinguish worktree, merge, deployment, and client-cache states without producing false platform claims.

**Created**: 2026-08-04

## Requirement Completeness

- [x] CHK001 — Are separate requirements specified for local worktree files, merged `main` changes, deployed web artifacts, and private installed-PWA freshness? [Completeness, Spec §FR-002, §FR-005]
- [x] CHK002 — Does the specification require exact absolute roots, branches, commits, and dirty states for every relevant agent lane? [Completeness, Spec §FR-001]
- [x] CHK003 — Are the original snapshot count and the final reviewed diff count defined as separate required facts? [Completeness, Spec §FR-003]
- [x] CHK004 — Are all five supported platform targets explicitly represented rather than inheriting the Web/PWA result? [Completeness, Spec §FR-006, Platform and Domain Matrix]
- [x] CHK005 — Does the specification state an explicit non-goal for remote Git, deployment, native-release, and personal-storage mutation? [Completeness, Spec §FR-007, Non-Goals]

## Requirement Clarity

- [x] CHK006 — Is the phrase "PWA updated" decomposed into a current `main` SHA, successful deploy job, cache-busted public page, and profile-specific freshness state? [Clarity, Spec §FR-004–005]
- [x] CHK007 — Is the difference between a source snapshot, a merge diff, and a user-visible surface stated without implying equal counts? [Clarity, User Story 2, SC-002]
- [x] CHK008 — Are `VERIFIED`, `UNVERIFIED`, `FAIL`, `N/A`, and `SKIP` defined for the resulting report? [Clarity, contracts/visibility-evidence-contract.md]
- [x] CHK009 — Are exact evidence identifiers required for every final claim rather than vague references to “the latest deploy” or “the active branch”? [Clarity, SC-001, data-model.md]

## Requirement Consistency

- [x] CHK010 — Do the no-side-effect requirements agree with the quickstart's prohibition on clearing site data and unregistering a service worker? [Consistency, Spec §FR-007, quickstart.md]
- [x] CHK011 — Do release-channel requirements consistently keep GitHub Pages separate from Android, iOS, and Desktop/Tauri artifacts? [Consistency, User Story 4, Platform and Domain Matrix]
- [x] CHK012 — Does the specification consistently treat the user's installed PWA profile as private and not infer it from the clean browser observation? [Consistency, Evidence Snapshot, Key Entities, Assumptions]

## Acceptance-Criteria Quality

- [x] CHK013 — Can each primary user story be independently assessed from specific Git, Actions, or public-route evidence? [Measurability, User Stories 1–3]
- [x] CHK014 — Are success criteria framed as evidence-quality outcomes rather than unmeasurable assurances about user satisfaction or visual change counts? [Measurability, SC-001–005]
- [x] CHK015 — Is the safe installed-PWA update outcome specified for current, stale/reload, and unavailable/offline results? [Coverage, User Story 3, quickstart.md]

## Scenario and Edge-Case Coverage

- [x] CHK016 — Are wrong VS Code root and multi-root review workspace scenarios addressed as distinct causes of missing files? [Coverage, Edge Cases]
- [x] CHK017 — Are offline, suspended, and older-service-worker states specified without treating them as confirmed causes? [Exception Flow, Edge Cases]
- [x] CHK018 — Are uncommitted agent worktrees defined as local-only states with a non-destructive handoff boundary? [Recovery, User Story 1]
- [x] CHK019 — Are partially successful workflows and nonblocking annotations prevented from being conflated with the deploy-job result? [Exception Flow, Edge Cases]

## Non-Functional, Privacy, and Operations Coverage

- [x] CHK020 — Are local truth/IndexedDB data-loss risks explicitly considered before any refresh advice is given? [Security and Privacy, User Story 3]
- [x] CHK021 — Are cache-busted public observation and fresh GitHub Actions metadata required for public deployment claims? [Operations, Spec §FR-004]
- [x] CHK022 — Is translated public-route evidence included without claiming a full accessibility or human visual-review pass? [Accessibility and i18n, Platform and Domain Matrix]
- [x] CHK023 — Are personal credentials, browser history, journal data, and raw PWA storage excluded from the audit scope? [Privacy, Non-Goals]

## Dependencies and Assumptions

- [x] CHK024 — Is the nonbinding status of the proposed Spec Kit constitution documented without using it as release authority? [Assumption, Constitution Check]
- [x] CHK025 — Does the screenshot-runtime assumption remain explicitly `UNVERIFIED` until an About/build/release receipt is available? [Assumption, Spec §Assumptions and Unverified Items]
- [x] CHK026 — Are the GitHub Pages, native-store, and Tauri release channels named as distinct external dependencies? [Dependency, Platform and Domain Matrix]
- [x] CHK027 — Does the specification distinguish manual cache-clearing advice from the generated bootstrap's mismatch-triggered Cache Storage/service-worker cleanup? [Consistency, Spec §FR-005]

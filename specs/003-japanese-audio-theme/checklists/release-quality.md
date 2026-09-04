# Requirements Checklist: Audio, Motion, And Internal Release

**Purpose**: Reviewer-facing requirements-quality gate before implementation and Android release work
**Created**: 2026-09-02
**Feature**: [spec.md](../spec.md)

## Requirement Completeness

- [x] CHK001 Are the exact collection size, included existing master, and number of new masters specified? [Completeness, Spec FR-001–FR-002]
- [x] CHK002 Are prohibited audio sources and file-bound provenance requirements defined? [Completeness, Spec FR-003–FR-006]
- [x] CHK003 Are account-entry, authenticated navigation, mobile drawer, and collapsed/expanded control surfaces all named? [Coverage, Spec FR-008–FR-011]
- [x] CHK004 Are first-run, saved opt-in, blocked autoplay, competing owner, background, mute, and error states addressed? [Coverage, Spec FR-007, FR-012–FR-019]
- [x] CHK005 Are the required light/dark triggers, reduced-motion path, rapid-repeat path, drawer path, and persistence-failure path defined? [Coverage, Spec FR-020–FR-025]

## Requirement Clarity

- [x] CHK006 Is “icon-only” defined to exclude visible labels, status text, track names, and hover tooltips while preserving assistive names? [Clarity, Spec FR-010–FR-011]
- [x] CHK007 Is “soft theme change” bounded by a duration, feedback latency, forbidden effects, and latest-request-wins behavior? [Clarity, Spec FR-020–FR-024, SC-005]
- [x] CHK008 Is the intended Japanese character framed as high-level pacing and timbre rather than a copied work or authenticity claim? [Clarity, Spec Assumptions]
- [x] CHK009 Is the only authorized Play destination explicitly distinguished from every excluded track? [Clarity, Spec FR-030]

## Requirement Consistency

- [x] CHK010 Are first-run silence and later saved opt-in consistent across the user stories, requirements, and success criteria? [Consistency, Spec US1, FR-007–FR-008, SC-008]
- [x] CHK011 Are one-player continuity and the no-overlap requirement consistent with track-boundary behavior? [Consistency, Spec FR-012–FR-014, SC-003]
- [x] CHK012 Does the smooth-theme requirement preserve the existing Android atomic contrast guard instead of contradicting it? [Consistency, Spec FR-020–FR-024]
- [x] CHK013 Are the store-release requirements consistent with the human-audio approval and signing gates? [Consistency, Spec US3, FR-006, FR-028–FR-032]

## Acceptance Criteria Quality

- [x] CHK014 Can collection completeness and provenance be measured from exact inventory and hashes? [Measurability, Spec SC-001]
- [x] CHK015 Can icon response, theme feedback, transition duration, and Android frame-gap limits be measured objectively? [Measurability, Spec SC-002, SC-005–SC-006]
- [x] CHK016 Are human listening criteria separated from technical decode and playback evidence? [Clarity, Spec SC-004]
- [x] CHK017 Can Play Console success be tied to one commit, signed bundle, version code, and Internal testing state? [Traceability, Spec SC-011]

## Dependencies And Recovery

- [x] CHK018 Are upload-key, console-access, current-version, exact-hash approval, and required-check dependencies explicit? [Dependency, Spec US3, Assumptions]
- [x] CHK019 Are missing/corrupt audio, offline cache, quota, lifecycle interruption, rapid theme input, and version collision recovery requirements addressed? [Coverage, Spec Edge Cases]
- [x] CHK020 Are rollback and STOP semantics explicit when evidence, signing, or authorization is missing? [Recovery, Spec FR-032, Non-Goals]

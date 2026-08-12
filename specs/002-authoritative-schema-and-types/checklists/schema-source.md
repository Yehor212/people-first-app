# Requirements Quality Checklist: Schema Source Selection

**Purpose**: Audit whether T167 requirements are complete, precise, consistent, and reviewable before task generation
**Created**: 2026-08-12
**Audience**: Task owner, schema maintainer, security/privacy reviewer, and future T168/T169 executor
**Depth**: Release-blocking source-selection contract; runtime claims intentionally excluded
**Spec**: [spec.md](../spec.md)

## Authority and provenance

- [x] CHK001 Does the specification distinguish R0 workspace-recovery authority from security, privacy, production, release, remote, and Git-publication authority? [Completeness, Spec §Assumptions]
- [x] CHK002 Are all pre-write lane identity fields enumerated with an explicit stop condition for drift? [Completeness, Spec FR-001–FR-002]
- [x] CHK003 Are provenance inputs classified by clean lane, dirty umbrella, external descriptor, tracked state, and owning task rather than by filename alone? [Clarity, Spec FR-003–FR-008]
- [x] CHK004 Are byte counts, SHA-256 values, membership count, Git tree, and canonical set serialization defined precisely enough to recompute? [Measurability, Spec FR-004, SC-002]

## Source admission and invalidation

- [x] CHK005 Is the current 80-file set described as a versioned baseline rather than the final post-T168 generation set? [Consistency, Spec §Assumptions]
- [x] CHK006 Are the automation and journal privacy candidates explicitly `NOT_ADMITTED`, with no semantic-review claim inferred from known hashes? [Clarity, Spec FR-005–FR-006]
- [x] CHK007 Is the dirty umbrella configuration excluded for a specific observed reason without treating the full dirty diff as source input? [Traceability, Spec FR-008]
- [x] CHK008 Are future invalidators—membership, status, symlink, index bytes, working-tree bytes, reviewed bytes, and tool/target drift—covered? [Edge coverage, Spec §Edge Cases; Contract §Preconditions]

## Local-only future contract

- [x] CHK009 Is disposable local replay the sole selected path, with linked and remote targets explicitly rejected? [Unambiguity, Spec FR-009–FR-011]
- [x] CHK010 Is seed execution explicitly prohibited despite the base configuration's default seed behavior? [Completeness, Spec FR-010]
- [x] CHK011 Are replay and generation ordered, separately owned, and separately classified as deferred and unverified? [Consistency, Spec FR-012–FR-015]
- [x] CHK012 Are missing CLI/Docker prerequisites kept distinct from the T167 source-selection verdict and from authorization to install tools? [Clarity, Spec FR-015]

## Evidence honesty and scope

- [x] CHK013 Does the specification forbid treating timestamp freshness as semantic schema parity? [Safety, Spec FR-014, SC-009]
- [x] CHK014 Does the receipt contract separate source selection, replay, generation, runtime, platform impact, remaining owner/external gates, prohibited actions, and rollback? [Completeness, Spec FR-016–FR-017]
- [x] CHK015 Are all prohibited code, data, dependency, remote, Git, deployment, T168+, and external-write actions explicit and testable as absence assertions? [Scope, Spec FR-018–FR-019]
- [x] CHK016 Is rollback limited to task-owned docs/evidence and the prior feature pointer, with no implied database or Git-history rollback? [Recoverability, Spec FR-020]

## Cross-platform and downstream gates

- [x] CHK017 Are Web/Vite, installed PWA, Android/Capacitor, iOS/WKWebView, and Desktop/Tauri each required as separate static-impact rows? [Coverage, Spec FR-016]
- [x] CHK018 Are runtime, native, production/live, public deployment, release, and human-acceptance claims explicitly left unverified? [Evidence boundary, Spec FR-017]
- [x] CHK019 Are T168 migration admission and T169 replay/type generation assigned without starting either task? [Dependency clarity, Spec FR-013]
- [x] CHK020 Is the one-prompt handoff rule conditioned strictly on scoped T167 `GO`, with no prompt on an owner wait? [Handoff, Spec FR-021]

## Review Result

All 20 requirement-quality items pass against the T167 specification, research, evidence model, and local replay contract. This checklist validates requirement quality only; it does not prove schema semantics, database replay, generated declarations, runtime behavior, production state, native behavior, deployment, release, or human acceptance.

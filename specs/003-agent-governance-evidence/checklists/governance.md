# Governance Requirements Checklist: Agent Governance Evidence

**Purpose**: Check that the Feature 003 requirements are complete, measurable,
privacy-safe, cross-platform-scoped, and do not promote local observations into
unsupported Codex-host claims.
**Created**: 2026-08-04
**Feature**: [spec.md](../spec.md)

## Requirement Completeness

- [x] CHK001 Does the specification state both the routine hook no-write rule and the separately invoked diagnostic path, rather than leaving an implicit logging mode?
- [x] CHK002 Does it define the local observation, host runtime receipt, promotion prerequisite ledger, and failure category as distinct entities with non-overlapping evidence classes?
- [x] CHK003 Does it preserve the ten canonical roles and explicitly prohibit treating the pilot as authorization for full-ten default routing or role deletion?
- [x] CHK004 Does it state that no product runtime, user data, role-definition, native, deployment, paid API, remote, or external-write scope is included?
- [x] CHK005 Does it require an explicit rollback that preserves pre-existing ignored logs and prior Feature 002 artifacts?

## Clarity And Evidence Boundaries

- [x] CHK006 Is `LOCAL_PROCESS_OBSERVED` defined as the sole local positive evidence class, with profile loading, effective permissions, lifecycle delivery, token/cost, and platform parity explicitly `UNVERIFIED`?
- [x] CHK007 Are the required host-runtime fields and the conditions under which they may be observed named precisely enough that a simulated event payload cannot satisfy them?
- [x] CHK008 Is the optional receipt output restricted by concrete path, creation, permissions, duplicate, and symlink rules instead of a vague "safe file" requirement?
- [x] CHK009 Does the requirement ban raw prompts, tool data, transcripts, credentials, journal data, executable paths, and raw child-process output from the receipt schema?
- [x] CHK010 Is the integrity-hook timeout outcome defined as blocking, single-attempt, path-safe, and manually actionable rather than merely "handling errors"?

## Consistency And Promotion Safety

- [x] CHK011 Do the spec, data model, contract, and plan agree that local A/B reports cannot return `PROMOTABLE`?
- [x] CHK012 Does the task-slice/hash and output-actor binding requirement align with the local validator and runner write set named in the plan?
- [x] CHK013 Does the no-write hook requirement remain compatible with explicit observation storage, so a failed optional receipt cannot change hook allow/block behavior?
- [x] CHK014 Does the plan avoid presenting static registration, generated profile configuration, or an agent summary as proof of actual Codex host loading or permissions?

## Acceptance And Scenario Coverage

- [x] CHK015 Are acceptance scenarios independently testable for read-only, guarded, blocked, unsafe-output, malformed-host-claim, self-attested-promotion, task-mutation, actor-mismatch, timeout, and recursion paths?
- [x] CHK016 Are success criteria quantified as tested behavior (all named controls reject/retain the required status) without fabricating universal host/runtime coverage?
- [x] CHK017 Does the plan require RED evidence before protected behavior code and the same focused proof GREEN afterward?
- [x] CHK018 Does the verification plan include syntax, targeted, governance, integrity, policy, security, audit, final-diff, and Git-status evidence with no commit/push/release action?

## Platform, Authority, And Operational Coverage

- [x] CHK019 Are Web/Vite, installed PWA, Android/Capacitor, iOS/WKWebView, and Desktop/Tauri each declared `N/A` with a reason rather than omitted?
- [x] CHK020 Are Codex-host macOS, Windows, and Linux distinguished from the five ZenFlow product targets and retained as `UNVERIFIED` where no host execution is available?
- [x] CHK021 Does the plan distinguish bounded local implementation completion from blocked routing-policy promotion and M2 independent-closure evidence?
- [x] CHK022 Does the specification identify a safe manual next command for the PDI failure without authorizing retries, weakening, production writes, or external coordination?

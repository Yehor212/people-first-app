# Security and Privacy Requirements Checklist: PWA Sync Continuity

**Purpose**: Test whether the specification and plan state complete, unambiguous security/privacy requirements before implementation.
**Created**: 2026-08-09
**Audience**: Author and security/privacy reviewer before production-code edits.
**Result**: 22/22 requirement-quality checks satisfied.

## Data Authority and Minimization

- [x] CHK001 Is IndexedDB local truth distinguished from in-memory UI state, outbound delivery, remote confirmation, and diagnostics? [Clarity, Spec §FR-001–FR-002]
- [x] CHK002 Is the content-bearing `localStorage` prohibition explicitly scoped to new Web/PWA writes without accidentally banning the one-way legacy reader? [Consistency, Spec §FR-010–FR-012]
- [x] CHK003 Are private payloads and identifiers excluded from all proposed presentation and observability fields? [Completeness, Spec §FR-015–FR-017]
- [x] CHK004 Does the plan avoid introducing analytics, Sentry content, export, share, backup, or production-data sinks? [Data Minimization, Plan §Security and Privacy]

## Account and Ordering Boundaries

- [x] CHK005 Is the active-account check required before and after asynchronous queue/delta work? [Coverage, Spec §FR-006]
- [x] CHK006 Are ownerless and other-owner rows quarantined rather than migrated, sent, exposed, or discarded? [Coverage, Spec §Edge Cases]
- [x] CHK007 Are stable operation identity and late-completion protections required so an older attempt cannot acknowledge a newer action? [Completeness, Spec §US2]
- [x] CHK008 Are leader ownership and cursor atomicity specified independently of network/broadcast arrival? [Consistency, Spec §FR-004–FR-007]

## Legacy Migration

- [x] CHK009 Is validation defined before any durable mutation or legacy deletion? [Ordering, Spec §FR-012]
- [x] CHK010 Is the accepted migration write set committed in one IndexedDB transaction before exact-key removal? [Atomicity, Spec §FR-012]
- [x] CHK011 Are corrupt, incomplete, equal-order conflict, cleanup-failure, and re-entry cases fail-closed and idempotent? [Exception/Recovery, Spec §FR-013–FR-014]
- [x] CHK012 Is migration explicitly prevented from becoming a continuing fallback writer? [Scope, Spec §FR-010–FR-012]

## Diagnostics and Error Handling

- [x] CHK013 Is the diagnostic route contract allowlisted and independent of raw path query/hash serialization? [Privacy, Spec §FR-016]
- [x] CHK014 Are OAuth code, token, state, raw URL, arbitrary error text, device ID, entity ID, queue ID, and operation ID explicitly forbidden? [Completeness, Spec §FR-015]
- [x] CHK015 Are receipt field names, count bounds, string bounds, and safe error classes defined in the contract? [Clarity, Contract §DiagnosticReceipt]
- [x] CHK016 Is diagnostic activation explicit outside development and non-content-bearing if a preference remains? [Least Privilege, Spec §FR-018]
- [x] CHK017 Is storage-full user feedback separated from logs and forbidden from echoing exception messages or record details? [Privacy, Spec §FR-008–FR-009]

## Verification and Release Boundaries

- [x] CHK018 Are negative canaries required across snapshot, receipt, event, DOM, and captured-log surfaces? [Verification, Spec §SC-006]
- [x] CHK019 Are synthetic canaries confined to tests and prohibited from production reachability or real-user sinks? [Production Data Integrity, Spec §FR-022]
- [x] CHK020 Are focused scanner, production-data-integrity, dependency-audit-if-applicable, and diff-scope checks named without claiming they already passed? [Evidence Quality, Quickstart §Verification]
- [x] CHK021 Are live credentials, private logs, journal content, production writes, and support dumps excluded from the proof plan? [Authority, Plan §Security and Privacy]
- [x] CHK022 Are public deployment, native compatibility, human translation, and live same-account proof separately `UNVERIFIED` until observed? [Honest Status, Spec §UNVERIFIED Ledger]

## Notes

These checks validate requirement quality. Scanner execution, runtime privacy proof, and human review remain implementation/release evidence and are not implied by checked boxes.

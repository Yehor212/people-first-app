# Requirements Quality Checklist: Installed PWA Modernization

**Purpose**: Validate that the specification is complete, testable, ZenFlow-specific, and honest before implementation.
**Reviewed**: 2026-08-04
**Scope**: `spec.md`, `research.md`, `data-model.md`, `plan.md`, and evidence contract.

## User and Product Scope

- [x] CHK001 The primary user surface is explicitly the installed browser PWA on macOS and Windows, not Tauri.
- [x] CHK002 Every user story names a concrete current failure mode and an independently testable outcome.
- [x] CHK003 Existing ZenFlow product identity, routes, canonical orb, data ownership, auth, and sync boundaries are preserved.
- [x] CHK004 Obsolete behavior is removed only where current reachability/source evidence exists.
- [x] CHK005 Non-goals prevent generic PWA feature expansion such as widgets, badges, analytics, or Store packaging.

## Functional Precision

- [x] CHK006 Install capability distinguishes installed, one-shot prompt, safe macOS manual guidance, and unavailable states.
- [x] CHK007 Safari's separate local storage is stated as a safety constraint, not hidden or “fixed” with an invented bridge.
- [x] CHK008 Manifest orientation, scope, identity, shortcut route, and responsive-layout requirements are independently measurable.
- [x] CHK009 Offline recovery distinguishes working app shell, degraded document, and unrecoverable state.
- [x] CHK010 Update requirements preserve durable-write preparation and prohibit origin-wide cache deletion.
- [x] CHK011 Locale, RTL, keyboard, reflow, reduced-motion, forced-color, and focus expectations are explicit.
- [x] CHK012 No requirement depends on production mock/demo/sample records.

## Platform and Release Completeness

- [x] CHK013 Web/Vite, installed desktop PWA, installed mobile browser PWA, Android, iOS, Tauri, Store/Release, accessibility, performance, security/privacy, testing, and operations are represented.
- [x] CHK014 Real Windows/mobile installed PWA, public deploy, Store, signing, human accessibility, artistic, and native-speaker proof gaps remain `UNVERIFIED`.
- [x] CHK015 Android/iOS/Tauri are regression boundaries and are not silently claimed in scope or excluded.
- [x] CHK016 Public deployment and external publication require separate authorization and provenance.
- [x] CHK017 Rollout and rollback avoid deletion of user data and origin-wide caches.

## Evidence and Testability

- [x] CHK018 Every P1 story maps to literal acceptance scenarios and a RED/GREEN proof path.
- [x] CHK019 Official sources are separated from local ZenFlow evidence and do not grant product `PASS` by themselves.
- [x] CHK020 The evidence schema restricts statuses to `PASS`, `FAIL`, `N/A`, or `UNVERIFIED` and requires a reason for unknowns.
- [x] CHK021 Build/runtime/source/human scopes are not conflated.
- [x] CHK022 Security and privacy scans supplement, rather than replace, data/cache threat analysis.
- [x] CHK023 Artifact-sensitive build and bundle checks are explicitly sequential.
- [x] CHK024 Final diff/status, secrets/PII, generated assets, and no-mock-runtime review are required.

## Ambiguity and Template Review

- [x] CHK025 No `[NEEDS CLARIFICATION]`, TODO/TBD, placeholder, generic slogan, or invented adoption metric remains.
- [x] CHK026 Product-defining or authority-changing choices are isolated as non-goals or separate blockers.
- [x] CHK027 The advisory Spec Kit constitution is not used as blocking authority.
- [x] CHK028 Success criteria are measurable without claiming unavailable Windows/public/human evidence.

## Checklist Verdict

`PASS` for requirement quality. This does not mean implementation or release has passed. The specification is ready for task decomposition and cross-artifact analysis.

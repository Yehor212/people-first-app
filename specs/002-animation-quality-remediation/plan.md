# Implementation Plan: Animation Quality Remediation

**Branch**: `codex/animation-quality-remediation-20260829` | **Date**: 2026-08-29 | **Spec**: [spec.md](./spec.md)

**Input**: The two live-checked 2026-08-29 audit files, bound to the hashes recorded in the specification, plus current source, tests, installed dependency source, and primary platform documentation.

## Summary

Do not execute the audit literally. Preserve the current full-motion presentation and canonical visual family while implementing only three bounded, source-verified corrections:

1. sanitize route values before the runtime flight recorder or severe-performance guard can retain OAuth or other sensitive query parameters;
2. make every reachable ambient loop in the current Schedule surface honor the existing reactive motion gate without changing its full-motion values;
3. make an empty Android debug AdMob application ID fail at configuration time without embedding Google's sample identity.

Every production edit starts from a focused RED proof. Recommendations that need a device baseline, a product decision, a new dependency, or a visual trajectory change remain classified and deferred. No commit, push, deploy, version bump, cross-lane mutation, mock production data, or canonical-orb change is in scope.

## Technical Context

**Language/Version**: TypeScript 5.x, React 18.3.1, Java 21-compatible Android build, Gradle 8/AGP 8 as pinned by the repository  
**Primary Dependencies**: Vite, Framer Motion/Motion 12.26, Zustand, Capacitor 8, Vitest, Testing Library  
**Storage**: No business-data model change; `sessionStorage` contains a device-local runtime-performance guard snapshot that requires sanitization  
**Testing**: Vitest, repository static contracts, TypeScript, ESLint, Vite production build, Android Gradle configuration/build checks, Playwright visual/runtime probes where reachable without fabricated records  
**Target Platform**: Web/Vite, installed PWA, Android/Capacitor, iOS/WKWebView, Desktop/Tauri  
**Project Type**: Cross-platform client application with web runtime embedded in native shells  
**Performance Goals**: zero additional persistent frame work in reduced-motion Schedule; no full-motion value changes; sensitive query values retained zero times  
**Constraints**: IndexedDB remains local truth; no direct `localStorage`; no production mock/sample records or ad identifiers; safe areas/RTL/canonical orbs remain unchanged; exact platform evidence cannot be transferred between rows  
**Scale/Scope**: three production batches, their focused tests, generated feature artifacts, and the existing architecture-count refresh; no global migration across the audit's 100+ candidate sites

## Constitution Check

The current constitution status is `PROPOSED` and `PROPOSAL_CRITERIA_ONLY`; it is advisory rather than binding. Repository `AGENTS.md` and the governed policy documents remain authoritative.

| Gate | Pre-design status | Post-design status | Evidence / handling |
| --- | --- | --- | --- |
| Locked Codex worktree | PASS | PASS | Doctor returned GO for this exact worktree and branch at base `c779c1171157a563a6bef1bc773528c78eaeb117`. |
| Current architecture counts | PASS after repair | PASS | `npm run constitution:check` now matches 941 source files, 602 test files, 121 memo sites, and 19 documented large components. |
| Test-first | PASS for planning | REQUIRED for code | The current token authorizes documentation only; it must be replaced with the exact focused RED command before production edits. |
| No fabricated production behavior | PASS by design | REQUIRED by gates | Empty/unavailable states are used; test fixtures cannot cross into runtime or bundles. No sample AdMob ID is allowed. |
| Visual integrity | PASS by scope design | UNVERIFIED until runtime evidence | Full-motion constants remain unchanged. Any pixel/trajectory-changing audit item is blocked without a retained baseline. |
| Five-platform impact | PASS | PASS as explicit matrix | Web/PWA are affected by route sanitization; all web runtimes are affected by Schedule gating; Android alone is affected by the configuration fail-fast. Runtime parity remains platform-specific. |
| Security/privacy | PASS for source-to-sink validation | REQUIRED after patch | Full query retention is a validated local privacy finding; no external transmission sink was found. Run focused tests and the narrow security suite. |
| Authority boundary | PASS | PASS | No dependency, version, orientation, root-back, service-worker, publication, release, or cross-lane action. |

## Project Structure

### Documentation (this feature)

```text
specs/002-animation-quality-remediation/
├── spec.md
├── plan.md
├── research.md
├── data-model.md
├── quickstart.md
├── contracts/
│   └── runtime-and-motion-contract.md
├── checklists/
│   ├── requirements.md
│   └── quality.md
└── tasks.md

docs/superpowers/plans/
└── 2026-08-29-animation-quality-remediation.md
```

### Source Code (repository root)

```text
src/
├── observability/
│   ├── runtimeRouteSanitizer.ts
│   ├── runtimeFlightRecorder.ts
│   ├── runtimePerformanceMode.ts
│   └── __tests__/
└── components/schedule/
    ├── ScheduleTimeline.tsx
    ├── ScheduleVisuals.tsx
    ├── TimelineDayColumn.tsx
    └── __tests__/

android/app/
├── build.gradle
└── repository contract tests
```

**Structure Decision**: keep changes in the existing observability, Schedule, and Android configuration owners. The sanitizer is a leaf utility so it can be tested without React or storage. Schedule receives one explicit boolean contract rather than a new global state abstraction. No feature migration or new dependency is justified.

## Implementation Strategy

### Batch 1 — Runtime route privacy

- RED: prove that `code`, `state`, token-like parameters, arbitrary search values, fragments, and legacy stored snapshots currently survive.
- Implement an allowlist-value sanitizer for navigation-only parameters (`nav=v2`, supported `navLayout` values).
- Apply it at explicit and implicit flight-recorder route entry points and while reading the legacy guard snapshot; rewrite a changed legacy snapshot in place while preserving its mode and timing fields.
- GREEN: same negative tests plus existing recorder/performance tests.
- Rollback: remove the leaf utility and restore the two callers; no data migration or remote side effect.

### Batch 2 — Reachable Schedule reduced motion

- RED: prove that current Schedule loop props continue to contain repeating opacity/box-shadow/transform work when the existing motion decision is false.
- Obtain `useShouldAnimate()` once at the reachable Schedule owner and pass `motionAllowed` through the existing component boundary.
- Gate only indefinite ambient loops. Preserve all full-motion arrays, durations, delays, easings, spring values, layer order, colors, dimensions, and event rendering.
- GREEN: false mode is static for the observation contract; true/default control retains the exact current values.
- Rollback: remove the prop threading and ternaries; there is no schema or dependency change.

### Batch 3 — Android debug AdMob fail-fast

- RED: prove that an empty debug application ID reaches the manifest placeholder/configuration path.
- Fail during Gradle configuration with an actionable error unless an authorized real development ID is supplied; do not embed or recommend Google's sample application ID.
- GREEN: empty configuration fails for the exact reason; a syntactically valid injected non-secret test-only environment placeholder allows configuration without being written to tracked files. Release behavior remains unchanged.
- Rollback: remove the debug validation block; no manifest, identity, or version change.

## Verification Strategy

1. Run each focused RED before its production edit and record the expected failure.
2. Rerun the same focused command GREEN, then adjacent observability/Schedule/Android contracts.
3. Run typecheck, lint, focused i18n/RTL checks, canonical-orb checks, production-data integrity diff/full/bundle modes, security suite, npm audit, production build, and current structural gates.
4. For Schedule, capture full-motion and reduced-motion controls from a real empty/unavailable application state only. If authentication or platform access prevents a faithful surface, keep visual runtime `UNVERIFIED`; do not inject plausible user events.
5. Run the visual-integrity critic and independent QA/Role 10 closure against a hash-bound final packet. Artistic acceptance, native-device parity, and release readiness remain separate evidence dimensions.

## Platform Impact

| Batch | Web/Vite | Installed PWA | Android/Capacitor | iOS/WKWebView | Desktop/Tauri |
| --- | --- | --- | --- | --- | --- |
| Route sanitizer | Direct: browser runtime snapshots | Direct: same runtime plus install lifecycle | Conditional: same JS runtime if query-bearing route is entered | Conditional: same JS runtime | Conditional: same JS runtime |
| Schedule gate | Direct | Direct | Direct web content | Direct web content | Direct web content |
| AdMob fail-fast | N/A | N/A | Direct build configuration | N/A | N/A |

No row is a runtime PASS until tested on that target. Source-sharing proves applicability, not native lifecycle behavior.

## Complexity Tracking

| Constraint retained | Why needed | Simpler alternative rejected because |
| --- | --- | --- |
| One new sanitizer leaf | One canonical route boundary is easier to audit and negative-test | Repeating regex filters at each sink can drift and still retain newly introduced sensitive parameters. |
| Explicit Schedule prop threading | The decision remains reactive and visible at every ambient-loop owner | Relying on global `MotionConfig` does not suppress opacity, background color, box-shadow, canvas, or arbitrary animation-frame work. |
| Three independent batches | Each has a different owner, rollback, and evidence class | A wholesale audit sweep cannot separate privacy proof, visual parity, or native configuration risk. |

## Deferred / STOP Register

- A1–A5, A8, A12 and the visual portions of B3–B6 require retained native/browser baselines before edits.
- A6, A9, A11, A13, W4, W23, B1 and B2 contain materially incorrect prescriptions and are not implementation candidates.
- A7, root predictive-back semantics, service-worker reload policy, orientation, Baseline Profiles, new AndroidX versions, and release actions require separate owner authority.
- Global W16–W20/W24 zero-count migrations are rejected until reachability-aware ratchets and per-surface baselines exist.
- Current device, installed-PWA, iOS, Desktop, 90/120 Hz, assistive-technology, store, public deployment, and artistic-human evidence remains `UNVERIFIED` unless freshly produced during verification.

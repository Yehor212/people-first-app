# Feature Specification: Android V2 Motion Smoothness

**Feature Branch**: `codex/android-v2-motion-smoothness`

**Created**: 2026-08-22

**Status**: Approved for local implementation

**Input**: Eliminate reproducible animation jank across Android V2 without any visual, motion-quality, data-contract, or cross-platform behavior change. The canonical visual baseline is clean `main` at `13ca51a80d23220574deba762851fe5a32372e46`.

## User Scenarios & Testing

### User Story 1 - Continuous V2 motion stays fluid (Priority: P1)

An Android user can launch V2, observe and manipulate the canonical orb, and move through all five primary tabs without stalls, visible frame bursts, frozen presentation, or a change in appearance.

**Why this priority**: The current visible interruption is the reported failure and affects the main Android experience.

**Independent Test**: Starting from an empty local test state, run launch, 65-second orb idle, `-1 → 0 → +1` drag, refine/back, and a complete five-tab route cycle while measuring presentation deadlines separately from visual capture.

**Acceptance Scenarios**:

1. **Given** a thermally valid physical Android run after three warmups, **When** steady V2 motion is measured five times, **Then** no more than 1% of frames miss their deadline and no consecutive missed frames, gaps over 100 ms, frozen frames, crashes, ANRs, or WebGL context loss occur.
2. **Given** the clean-SHA visual baseline, **When** the same phase is captured before and after the fix, **Then** geometry, colors, blur, opacity, assets, trajectory, duration, easing, resolution, density, and visual complexity remain inside the measured baseline noise envelope.

---

### User Story 2 - Interactive surfaces and lifecycle transitions do not accumulate work (Priority: P2)

An Android user can use habits, diary, planning, settings, navigation, drawer, sheets, modals, Back, IME, rotation, split-screen, and repeated background/foreground transitions without progressive slowdown or phase jumps.

**Why this priority**: Lifecycle duplication, leaked listeners, and accumulated rendering work can make an initially acceptable session degrade over time.

**Independent Test**: Exercise every named interaction and five background/foreground cycles, then compare active renderer/worker/animation-loop/listener counts and memory across the last three cycles.

**Acceptance Scenarios**:

1. **Given** a warmed Android session, **When** five lifecycle cycles and the interaction matrix complete, **Then** exactly one active renderer, worker, and animation loop remains, listener counts stay stable, and memory does not grow monotonically in the last three cycles.
2. **Given** an animation paused by backgrounding or window reconfiguration, **When** the app resumes, **Then** presentation continues without a visible phase discontinuity, duplicate loop, lost Back ownership, or input failure.

---

### User Story 3 - Android visual and accessibility variants preserve the same design (Priority: P3)

Android users receive the same canonical V2 design in both themes, all supported locales, RTL, portrait, landscape, split-screen, safe-area states, normal motion, and reduced motion.

**Why this priority**: A performance fix is invalid if it only looks correct in one theme, locale, direction, or window configuration.

**Independent Test**: Compare static checkpoints for `en`, `uk`, `es`, `de`, `fr`, `ja`, `ar`, and `he`, plus full motion sequences for `en`, `ar`, and `he`, against five repeated clean-SHA baseline captures.

**Acceptance Scenarios**:

1. **Given** any supported locale and theme, **When** a candidate checkpoint is compared with the phase-matched baseline, **Then** it stays within the predeclared natural noise envelope and introduces no clipping, bidi, safe-area, or geometry regression.
2. **Given** reduced motion is enabled, **When** the same functional flows run, **Then** the existing reduced-motion contract is preserved and is never used as a substitute for normal-motion performance.

### Edge Cases

- The emulator reproduces the issue but cannot prove user-device performance.
- A required physical device is absent, thermally throttled, using battery saver, or under unrelated load.
- Android refresh rate is 60 Hz versus 90/120 Hz, while the orb retains its current 60 Hz motion contract.
- The app backgrounds or rotates with a worker render in flight.
- The IME, drawer, sheet, or modal owns Back during an active animation.
- WebView or GPU startup compiles resources late, the renderer falls back, or the WebGL context is lost.
- Visual captures vary naturally between GPU runs and cannot be compared as exact binary images.
- Diagnostic capture itself changes timing; JavaScript, system-trace, and visual passes therefore remain separate.
- API 26 supports the functional flow but not all modern diagnostic capabilities.

## Requirements

### Functional Requirements

- **FR-001**: The work MUST remain limited to Android V2 motion, Android-only diagnostic/build support, regression tests, and local evidence artifacts.
- **FR-002**: The clean visual baseline MUST be `13ca51a80d23220574deba762851fe5a32372e46`; an installed historical APK MUST NOT replace it.
- **FR-003**: Every reproducible symptom in the scenario matrix MUST be recorded as `FIXED`, `NOT_REPRODUCIBLE`, or `UNVERIFIED` with exact run provenance.
- **FR-004**: JavaScript/WebView telemetry, system frame tracing, and visual capture MUST run as separate passes so capture overhead is not presented as application performance.
- **FR-005**: A production fix MUST address a trace-backed cause and MUST be rejected if the corresponding physical-device scenario does not improve.
- **FR-006**: Rendering density, resolution, target frame cadence, particle/star count, shader quality, blur/filter intensity, opacity, animation timing/easing, assets, blending, and normal motion MUST NOT be reduced.
- **FR-007**: The canonical renderer MUST NOT be replaced with a lower-fidelity renderer, and visual layers MUST NOT be hidden to satisfy metrics.
- **FR-008**: Production release behavior MUST keep WebView debugging disabled; diagnostic debugging MUST be reachable only from a local benchmark variant.
- **FR-009**: The benchmark variant MUST be release-like, minified, profileable, locally debug-signed, and must not add a production dependency.
- **FR-010**: Startup, orb, all five routes, habits, diary, planning, settings, drawer, modal, Back, IME, lifecycle, rotation, split-screen, normal motion, and reduced motion MUST be represented in the evidence matrix.
- **FR-011**: Worker/render pacing changes MUST preserve motion position, speed, direction, phase continuity, and the current 60 Hz orb contract.
- **FR-012**: At steady state there MUST be exactly one active renderer, worker, animation loop, and expected listener set.
- **FR-013**: Local diagnostic runs MUST use empty synthetic test state and MUST NOT capture or transmit real journal, habit, or account data.
- **FR-014**: Public APIs, persisted storage, sync, schema, and user-visible types MUST remain unchanged.
- **FR-015**: Web/Vite, installed PWA, iOS/WKWebView, and Desktop/Tauri runtime behavior MUST remain unchanged by the Android-scoped fix.
- **FR-016**: Baseline thresholds and the noise envelope MUST be fixed before inspecting candidate results and MUST NOT be weakened afterwards.
- **FR-017**: Three warmups and five measured repeats MUST be used per physical device and scenario; invalid thermal, power, or load states MUST invalidate the run.
- **FR-018**: API 36 emulator and API 26 emulator results MUST be labeled compatibility/reproducibility evidence, not physical-device performance proof.
- **FR-019**: Missing physical 60 Hz or 90/120 Hz evidence MUST leave that gate `UNVERIFIED` and MUST prevent an overall performance `PASS`.
- **FR-020**: After three isolated unsuccessful fixes for one root cause, or when improvement requires a visual/energy loss, work MUST stop for a user decision.

## Success Criteria

### Measurable Outcomes

- **SC-001**: Steady physical-device motion has at most 1% deadline-missed frames.
- **SC-002**: `frameOverrunMs` p95 is at most 0 and p99 is at most one target frame period.
- **SC-003**: No measured run contains consecutive missed frames, a presentation gap over 100 ms, a frozen frame of at least 700 ms, ANR, crash, or WebGL context loss.
- **SC-004**: After warmup, worker acknowledgement p95 is at most one target frame period and p99 is at most two.
- **SC-005**: The last three lifecycle cycles show stable listener/resource counts and no monotonic memory increase.
- **SC-006**: Candidate timing does not regress beyond `max(1 ms, 2×MAD)` and jank rate does not regress beyond `max(0.5 percentage points, 2×MAD)` relative to five baseline repeats.
- **SC-007**: Phase-matched candidate frames remain inside the five-capture baseline GPU noise envelope for both themes and all required locale/window checkpoints.
- **SC-008**: The Android 12+ mid-range 60 Hz and Android 14+ 90/120 Hz physical-device gates both pass before an overall performance `PASS` is reported.

## Platform Matrix

| Dimension | Required status |
| --- | --- |
| Android/Capacitor | Full implementation and installed-runtime evidence |
| Web/Vite | Shared-path non-regression only; runtime out of scope |
| Installed PWA | Intentionally N/A by user decision |
| iOS/WKWebView | Intentionally N/A; no runtime claim |
| Desktop/Tauri | Shared-path non-regression only; runtime out of scope |
| Store/Release | N/A; no commit, push, merge, deploy, Play upload, or release claim |
| Accessibility | Existing RTL, reduced-motion, safe-area, Back, and IME contracts preserved |
| Performance | Physical-device proof required; emulator numbers are not acceptance proof |
| Security And Privacy | Local-only empty test state; no external telemetry or debugging in release |
| Testing | Test-first focused contracts plus Android/runtime/visual regression checks |
| Operations | Exact artifact hashes, environment record, thermal validity, and rollback-ready local diff |

## Assumptions

- The user-approved performance and visual thresholds are fixed requirements, not tuning suggestions.
- Available local emulators may be used immediately; unavailable physical devices remain explicit evidence gaps.
- Existing Playwright, image processing, Android tooling, and repository dependencies are sufficient; no paid service or new production dependency is authorized.
- The implementation remains uncommitted and local to the locked worktree until the user gives separate Git authority.

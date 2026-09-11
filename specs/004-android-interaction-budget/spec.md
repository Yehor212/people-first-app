# Feature Specification: Android interaction budget
**Feature Branch**: `codex/android-103ms-20260904`
**Created**: 2026-09-05
**Status**: Design approved; implementation under verification; phone acceptance pending
**Input**: Android phones first; ordinary transitions and animations no longer than 103 ms, without glitches, lag or visual degradation.

## User Scenarios & Testing
### Owner-authorized continuation — 2026-09-10

The owner approved implementing the diagnosed scene-lifetime optimization using best practices and publishing the qualifying update to Google Play. The earlier phase-specific exclusion of a shared renderer owner is extended only for one Android phone decorative background, never private pages, journal records or lock state. Active-page geometry and complete current appearance/motion remain binding. New visits preserve original palette sampling and initial phase; inactive leases draw no frames. Emulator verification does not imply physical-phone proof. Version/track/signing and release status require fresh evidence.

At21:12UTC the owner approved a separate permanent-placement experiment after candidate-c still failed the native103ms gate. Keep one navigation-owned decorative parent, bind its bounds to the actual active page, retain the existing path on unsupported engines, and compare against immutable candidate-c. Do not combine static-texture caching or accept visual changes. Private-page lifetime and all existing admission requirements remain binding.

### User Story 1 - Leave the menu without waiting (Priority: P1)
A person selects Diary, Habits, Planning, Mood or Settings from the phone menu and immediately receives feedback. With reduced motion, closing the menu must never wait for an animation that does not exist.
**Why this priority**: The audited flow retained the old screen for over one second under reduced motion.
**Independent Test**: Open and dismiss the menu with reduced motion, without manufacturing an animation-completion signal; the destination is usable and menu focus/scroll ownership is released.
**Acceptance Scenarios**:
1. Given an open menu and reduced motion, selecting a prepared destination closes the menu and shows that destination without the one-second watchdog.
2. Given an ordinary Android menu transition, the final visible frame and prepared destination are reached within 103 ms of activation.
3. Given an interrupted closing movement and a newly reopened menu, stale work cannot remove the reopened menu or navigate to an obsolete destination.

### User Story 2 - Keep premium visuals comfortable (Priority: P1)
A person can repeat navigation, use Back, change text size and use Arabic or Hebrew without missing controls, flashes or shifted content.
**Why this priority**: Short duration alone does not prevent skipped frames or compositor glitches.
**Independent Test**: Compare separate video and frame-deadline captures of the same build and scenarios after warmup; cover normal/reduced motion, first/warm visits and three repeated runs with ten worst-flow cycles.
**Acceptance Scenarios**:
1. Given any supported refresh rate, frame deadlines are evaluated against that device's actual cadence, separately from interaction duration.
2. Given unavailable content, show an honest loading/error state promptly; do not fabricate records or report destination readiness.
3. Given breathing exercises or continuous decoration, preserve their purpose and canonical appearance; the 103 ms limit applies to ordinary finite navigation/control effects.

### User Story 3 - Trust quality claims (Priority: P2)
The owner receives reports bound to the exact app being tested, and commits cannot evade application type checking through an empty root project.
**Why this priority**: The audited installed and local APKs differed; the old pre-commit typecheck examined zero files.
**Independent Test**: A controlled application type error fails the actual hook typecheck; mismatched artifact identities cannot produce a verified Android run.
**Acceptance Scenarios**:
1. Given different built and installed app hashes, the evidence checker rejects the run.
2. Given no physical phone evidence, phone responsiveness remains UNVERIFIED.
3. Given local structural checks only, runtime, craft and release remain separate explicit statuses.

### Edge Cases
Rapid re-selection; pointer cancellation; reopening before exit completion; transition cancellation; system or in-app reduced motion enabled during exit; Escape/Android Back; IME dismissal; background/resume; cold or failed route loading; RTL; large text; thermal drift. Release and private account mutations require separate authority.

## Requirements
### Explicit Requirements
Android first, 103 ms ordinary interaction target, no glitches/jank or visual downgrades, repository-grounded audit and fixes, one design approval (received 2026-09-05).

### Functional Requirements
- **FR-001**: Reduced motion must preserve navigation while releasing a dismissed menu's ownership without a nonexistent transition event.
- **FR-002**: Ordinary prepared Android transitions must target at most 103 ms for visible response, destination readiness and final transition frame, each measured separately.
- **FR-003**: Cancellation, rapid re-entry, Back, focus, scrolling and lifecycle changes must preserve the current user intent.
- **FR-004**: Appearance, canonical orbs, materials, readability, safe areas and minimum 44 px targets must be preserved; ar/he directionality and large text must be covered.
- **FR-005**: Loading, empty, unavailable and error outcomes must reflect authoritative data. No private records or credentials may enter test reports.
- **FR-006**: Android evidence must bind source snapshot, build inputs, built APK and independently read installed-before/after hashes, package/version, device/WebView, scenario, timestamps and measurement method.
- **FR-007**: Reports must distinguish technical, visual runtime, craft, motion, model, plan and release; missing evidence is UNVERIFIED.
- **FR-008**: Commit type checking must examine application and tooling projects and reject a real type error.
- **FR-009**: Agent instructions must consistently direct editing to a locked codex lane and preserve the retired-orchestra decision.

### Implied Requirements
Frame pacing at 60/90/120 Hz; separate video and profiling runs; physical-phone and production-equivalent proof for phone claims; repeatability/thermal context; honest asynchronous readiness; stale callback cancellation; eight-locale compatibility without new copy or data migrations.

### Key Entities
An interaction observation identifies trigger, source/destination, readiness, motion mode, build/device identity and timing evidence. A verification receipt names the command, timestamp, actual exit status and bounded claim; it is tooling data, never user history.

## Success Criteria
- **SC-001**: No reduced-motion menu close relies on the one-second fallback; focus/scroll and destination remain correct.
- **SC-002**: All recorded prepared-phone interaction maxima are at most 103 ms, with p50/p95/p99/max and missing observations reported; a mean cannot hide a failure.
- **SC-003**: Three warmed runs and ten worst-flow cycles show no blank frames, flicker or lost controls relative to the identical baseline, with frame-deadline attribution.
- **SC-004**: A real type-error negative control fails before commit, while the corrected control passes.
- **SC-005**: Every platform has an explicit evidence status, and mismatched or missing artifact proof cannot count as Android PASS.

## Assumptions, Clarifications And Boundaries
The owner's 2026-09-05 approval accepts the proposed 103 ms interpretation, exact base 939daa7e117331ef75201cff3a2c74d314861be2 and the named clean control/locked lane. No further product ambiguity requires a question.
There is no data model migration, new production dependency, canonical orb replacement, native rewrite or external publication. The available emulator is diagnostic; physical-phone proof is unavailable until a phone is connected.
Reject timing changes that damage compositor ownership, visual craft, accessibility or data integrity. Roll back scoped local changes with a reviewed inverse diff/revert; preserve user data and signer compatibility.
Current code evidence and platform matrix live in [plan.md](plan.md); the approved audit remains the pre-change evidence and is not replaced by candidate results.

## Approved Diary Background Extension — 2026-09-08

The owner explicitly approved replacing the static picture in Diary with the day and night backgrounds from the Orb tab, including their details. This is the sole exception to preserving the old Diary wallpaper. The canonical Orb itself, existing background designs, journal panels and data behavior are unchanged.

### User Story 4 — One visual family for Orb and Diary (Priority: P1)

A person opening the V2 Diary sees the same day or night atmosphere as the Orb tab, while the calendar, lists and writing surfaces remain readable and usable. Daylight color changes, moving light details and the night meteor retain the existing background's behavior, not a new imitation.

Acceptance scenarios:
1. Paper theme shows the Orb daylight scene at the same local time; Ink and OLED show its night scene, without a separate Diary day/night clock.
2. The V2 Diary page has one atmosphere behind its empty/list/shared desktop-editor panes. The old mountain image is absent from that page, and leaving the page releases the atmosphere.
3. Reduced motion and background/resume preserve the same motion policy as the Orb scene. Decoration cannot capture input or alter focus, Back, keyboard or journal-loading/error/privacy states.
4. Phone and wide layouts, Arabic/Hebrew, large text and safe areas remain usable with the new background. Visual proof and frame measurements refer to the exact new build.

### Extension Requirements

- **FR-010**: V2 Diary must reuse the complete existing Orb day/night background, including its theme selection, time-of-day daylight palette, layers and applicable flourishes; no alternate low-detail visual or duplicated raster backdrop.
- **FR-011**: Each active Diary page must own at most one background scene; switching away must release its rendering work and callbacks. No offscreen second page is introduced.
- **FR-012**: Existing journal content, security, persistence, error/loading states, editor paper styles, audio and actions remain unchanged. V1 dialog callers retain their existing presentation.
- **FR-013**: Backgrounds are noninteractive decoration; motion, contrast, forced colors, safe areas, RTL, large text and foreground readability have explicit regression coverage.
- **FR-014**: New-build emulator and browser evidence must distinguish reuse/technical correctness, observed visuals, motion timing and human craft acceptance. Unknown platforms and physical-phone performance are not inferred.

### Clarifications and Scope

The owner stated that only the emulator is available. Continue all available emulator work; absence of a physical phone is not a blocker or a reason to stop implementation. Physical-phone claims remain UNVERIFIED. The existing 103 ms criterion remains unchanged for the measured ordinary interactions; an ambient continuous background is not shortened to 103 ms. Earlier dated phone-proof descriptions remain historical, not a request to obtain unavailable hardware.

No new background art, assets, controls, dependencies, permissions, records, storage cache, schema, sync or account change. This extension does not approve reducing renderer resolution, disabling canonical effects or hiding frame outliers. Reject duplicate scene ownership, unreadable foreground, dropped visual layers and any new loading/privacy regression. Test-first implementation and rollback are specified in [the Diary background plan](../../docs/superpowers/plans/2026-09-08-diary-orb-background.md).

## US2 Native Keyboard Defect Clarification — 2026-09-08

This is a root-cause repair within the owner's continuing glitch/freeze request, not a new product design or replacement plan. On emulator-5560, focusing the blank Diary editor shows a floating Gboard with zero bottom IME overlap. SafeArea removes the 63 px navigation-bar padding, enlarging the viewport from 839.238 to 863.238 CSS px at DPR 2.625 and clipping Tools. Back restores the original geometry. Evidence: `output/android-103ms/gpu-cpu-attribution-20260908.2GdUKi/editor-geometry-with-ime.json` and the matching before/after screenshots.

- **FR-015**: A visible floating keyboard with zero bottom overlap must not remove bottom system-bar safe space or move Diary editor controls behind that bar. Existing 44 px targets and top/side safe areas remain intact.
- **FR-016**: Docked keyboard resize and keyboard dismissal must retain the existing inset ownership without double padding. Legacy WebView, viewport-cover fallback and the 140–143/144 compatibility branches must have isolated regression coverage; simulated version fields are not real-provider runtime proof.
- **FR-017**: Repair only the existing Android SafeArea owner, retaining its installed version and the existing patch-package mechanism. Do not change CSS, journal content/security, canonical backgrounds, keyboard preferences or other platforms to compensate. Native source/APK/installed hashes, actual keyboard actions, restoration, rollback and missing proof remain explicit.

Acceptance: native regression fails before the patch and passes afterward; actual floating-keyboard focus no longer expands content into the 63 px bar; Tools remains fully visible and reachable; docked focus/Back and top/side insets regressions are checked. The separate older docked-IME compositor clipping and 103 ms failures are not declared resolved by this fix. No product-defining question is unresolved; use the existing available emulator and preserve its data/preferences.

## FR-003 Native Back Lifecycle Clarification — 2026-09-08

The first native SafeArea test run exposed a real AndroidBackPlugin crash: `setState` validates `backCallback` before queuing its update, but `handleOnDestroy` can clear that callback before the posted lambda executes. The retained stack points to AndroidBackPlugin.java:57, not SafeArea. This is within the existing Back/lifecycle requirement and full glitch/freeze request; normal-user frequency is not yet established.

A queued Back-state update must reject with the existing invalid-state outcome if its native owner has been destroyed, without advancing navigation revision or resurrecting a callback. Live valid updates and root delegation retain their current behavior; malformed input still rejects. Validate the owner on the main thread where both update and destruction execute. No new Back owner, navigation rule, API, data, dependency, permission or visual change is authorized by this clarification. A real-main-queue native regression precedes production editing; exact APK and Back/resume checks follow.

## FR-016 Docked IME Animation Clarification — 2026-09-08

Four hide transitions have empty strips in both native Android and external-window recordings. The current SafeArea listener applies only the final keyboard overlap; a test-only onProgress redispatch creates alternating final/intermediate padding and is rejected. These receipts are in `output/android-103ms/gpu-cpu-attribution-20260908.2GdUKi/editor-dual-reduced` and `ime-comparison-baseline-repeat.json` / `ime-comparison-progress-repeat2.json`.

- **FR-018**: Docked IME transitions must retain continuously painted editor controls and system-bar clearance, including completion, cancellation and direction changes. No recursive inset redispatch or competing native owner is allowed. Animated native padding is a rejected mechanism: its four regression tests passed but its recorded paint gaps increased to0.500–0.617s. A replacement approach must first prove the native/CSS surface boundary and preserve visible geometry; a green geometry test cannot satisfy this requirement. Older Android/provider runtime outcomes remain explicit UNVERIFIED rows.

The rejected callback's RED/GREEN remains historical mechanism evidence, not a requirement to reinstate animated native padding. A replacement needs its own closest native regression before production editing, all common floating/docked/hidden/version/backdrop/Back controls, and uninterrupted real-editor video with source/APK identity. Reject worse raster gaps, missing controls, altered canonical visuals, new dependencies or private-data access. The full original goal remains open.

## US2 Stable Native Surface Clarification — 2026-09-09

The owner explicitly requested: "так продумай как исправить все гличи по лкушим практикам без визуального регресса ! исправь все" after the native ownership question. This authorizes a bounded native/CSS boundary repair; the earlier no-native-rewrite and FR-017 Java-only boundaries describe the previous floating-keyboard patch, not this newly authorized investigation. It does not authorize visual downgrades, new dependencies or private-data changes.

- **FR-019**: A docked keyboard must reserve its actual bottom overlap once while the editor background and native WebView remain fully painted. Hidden and floating keyboards retain system-bar space; top/side/cutout clearance, zoom/text scaling and all existing controls remain usable. No recursive dispatch, duplicate owner, arbitrary keyboard height or fixed device dimensions.
- **FR-020**: First compare unchanged and stable-root behavior in an opt-in real-app test. If that succeeds, add native and layout regressions before production changes. The same three warmed recordings and ten repeated hide/refocus cycles must retain all controls and show no missing-content strips; source/APK identity and a separate CDP-off presentation run remain mandatory. A fixture or geometry PASS alone cannot close FR-018 or the 103 ms gate.

State boundary: system bars remain native safe space; visible IME bottom overlap is transient geometry, not persisted user state. Dismissal, reversal, resize, rotation and resume must settle the current overlap, not a stale callback. Page changes and teardown must release any observer and restore the default path. The first diagnostic covers only the blank phone editor on the actual API36/WebView133 emulator; adoption additionally requires the existing floating/version/Back controls, English/ar/he, Huge text, normal/reduced motion and day/night review. Other real providers and native platforms remain UNVERIFIED until exercised.

No new product choice is missing. Preserve all earlier repairs, the canonical Orb family and complete day/night atmosphere, exact materials, journal security/loading/data behavior and existing rollback artifacts. The diagnostic is excluded from the application bundle and cannot read or save user text. Production scope will be narrowed from its actual result, not inferred from the standalone fixture.

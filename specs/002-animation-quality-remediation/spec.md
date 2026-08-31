# Feature Specification: Animation Quality Remediation

**Feature Branch**: `codex/animation-quality-remediation-20260829`

**Created**: 2026-08-29

**Status**: Draft — implementation is limited to source-verified, test-first batches

**Input**: Use the two live-checked 2026-08-29 animation audit files under `/Users/yehor/Projects/ZenFlow/` to correct ZenFlow according to current programming practices, with an absolute prohibition on production mock data and visual regression.

## Grounded Context

- The current audit inputs are bound to SHA-256 `4c220f35549268f7f56b0fc05afe92ab9efea45d477595db6814bb449077d6a6` and `7fec1e025bef3ab4ad7e3db8da72addc6223b4ee87c6a86378856ee6a5edb248`.
- Current repository evidence is authoritative over audit prose. The audit incorrectly identifies React 19; the governed repository uses React 18.3.1.
- Literal execution is unsafe. A1, A6, A9, A11, A13, W4, W23, B1, B2, the keyword-only mock gate, and the new commit/push playbook contain refuted, incomplete, unreachable, permission-changing, or product-defining instructions.
- The reachable user problem is inconsistent animation governance and incomplete runtime proof across reduced motion, Android startup, RTL, intermediate frames, device refresh rates, and platform shells. Some counted legacy loops are not reachable from the current V2 production graph.
- This packet authorizes local analysis, plans, tests, and source changes explicitly listed in approved tasks. It does not authorize commit, push, PR creation, deploy, release, version bump, cross-lane mutation, or publication.

## User Scenarios & Testing

### User Story 1 - Preserve the Existing Premium Visual Experience (Priority: P1)

As a ZenFlow user, I see the same canonical composition, layers, colors, text, icons, spatial relationships, and motion intent after remediation, without flashes, pop-ins, clipping, tearing, layout jumps, or cheaper visual substitutes.

**Why this priority**: The owner explicitly prohibits visual regression, and the audit proposes timing, blur, layout, splash, image, and layer changes that endpoint screenshots alone cannot validate.

**Independent Test**: Capture deterministic before/after stills plus intermediate-frame sequences or synchronized video for one reachable surface, then confirm zero unexplained pixel or trajectory differences and no regression in its runtime trace.

**Acceptance Scenarios**:

1. **Given** an unchanged stable state, theme, locale, viewport, and seed-free real application state, **when** a remediated interaction is replayed, **then** its stable composition and canonical visual layers remain equivalent.
2. **Given** an intentional motion-timing correction, **when** before/after trajectories are sampled at matched progress points, **then** the difference is documented, improves the named failure mode, and does not remove detail or craft.
3. **Given** no current visual baseline for a surface, **when** a proposed change could alter pixels or motion trajectory, **then** implementation stops for that surface and records `UNVERIFIED` rather than guessing.

---

### User Story 2 - Respect Motion and Accessibility Preferences (Priority: P1)

As a user who reduces or disables motion, I can use the remediated reachable Schedule surface without ambient pulsing or hidden opacity, shadow, transform, or CSS loops, while the existing full-motion presentation stays intact.

**Why this priority**: The current pre-hydration and application attributes can diverge, while a global motion setting does not suppress every opacity, color, canvas, or animation-frame loop.

**Independent Test**: Render the reachable Schedule surface with the existing reactive motion decision false and true, and verify that ambient loops stop in the false case while exact full-motion values remain in the control.

**Acceptance Scenarios**:

1. **Given** the existing motion decision changes before or after Schedule mounts, **when** Schedule renders, **then** its ambient-loop owners receive the current reactive decision rather than a startup snapshot.
2. **Given** the Schedule motion decision is false, **when** the surface renders, **then** opacity, shadow, transform, and CSS ambient activity stops while the same information remains visible in a static frame.
3. **Given** the Schedule motion decision is true or omitted by an existing direct caller, **when** the surface renders, **then** its current animation arrays, durations, delays, easings, and visual layers remain unchanged.

---

### User Story 3 - Start and Navigate Reliably on Android (Priority: P2)

As an Android developer or tester, I receive an early actionable failure when a debug package lacks an authorized AdMob application ID, without adding a sample identity or disturbing current startup, system-bar, safe-area, orientation, or back owners.

**Why this priority**: Source review confirms a throwaway WebView before bridge creation, incomplete debug AdMob validation, and theme/splash risks, but several audit fixes would themselves violate current Capacitor contracts.

**Independent Test**: Request a debug packaging task with the ID variables absent and verify the exact configuration failure; if an authorized local real development ID exists, verify configuration/build succeeds without printing or persisting it.

**Acceptance Scenarios**:

1. **Given** a debug packaging request without an authorized AdMob application ID, **when** Gradle resolves the task graph, **then** it fails early with an actionable message and never embeds a sample/test publisher identity.
2. **Given** an authorized real development ID supplied through the existing private configuration path, **when** a debug package is requested, **then** validation permits the existing build path without writing the ID into tracked source or logs.
3. **Given** current Capacitor 8 startup, system-bar, safe-area, App Link, orientation, and back owners, **when** this feature is applied, **then** those files and behaviors remain unchanged because their audit prescriptions lack required runtime proof or authority.

---

### User Story 4 - Prevent Motion Drift from Returning (Priority: P3)

As a maintainer, I can distinguish reachable defects from latent code, add a focused regression proof before each correction, and see explicit platform and evidence status instead of relying on global grep zeros, hooks, old reports, or subagent summaries.

**Why this priority**: Current ratchets cover only prior migrations, while the audit's proposed zero-count sweeps would modify more than one hundred files without reachability or user-value proof.

**Independent Test**: Introduce a negative control for one governed pattern and confirm that the focused contract fails for the intended reason, then passes after removal without weakening existing baselines.

**Acceptance Scenarios**:

1. **Given** a newly introduced motion loop or inline value on a governed reachable surface, **when** motion checks run, **then** the violation is rejected or requires an exact, reviewed, expiring waiver.
2. **Given** a latent or unreachable module, **when** it appears in a syntactic inventory, **then** it is classified separately and is not rewritten or deleted without a reachability and ownership decision.
3. **Given** a required proof that cannot run on the exact platform, **when** completion is reported, **then** that row remains `UNVERIFIED` and does not inherit a pass from another platform or a local hook.

### Edge Cases

- The existing motion policy changes while Schedule remains mounted.
- The operating-system motion preference and in-app preference disagree; Schedule consumes the resolved existing decision without redefining precedence.
- Battery or performance gating changes while a Schedule loop is active.
- RTL is activated after initial render; dismissal direction and focus order must update reactively.
- The app starts after an upgrade while offline and cached assets differ from the new bundle.
- Android runs with gesture navigation, three-button navigation, a modal stack, browser history, a deep link, or the root double-tap exit flow.
- App theme and operating-system theme disagree during splash, resume, keyboard display, and system-bar transitions.
- A production build lacks advertising configuration; it must fail closed without a sample identifier.
- A reachable surface has no deterministic baseline or requires a real 90/120 Hz device.
- An audit input changes during execution; all line-bound evidence must be rehashed and revalidated.

## Requirements

### Functional Requirements

- **FR-001**: Every audit recommendation MUST be classified as `VERIFIED_CURRENT`, `REFUTED`, `NEEDS_REPRO`, or `NEEDS_AUTHORITY` against the current repository and exact input hashes before it becomes an implementation task.
- **FR-002**: Refuted instructions MUST NOT be implemented, including removal of bundled SystemBars configuration, removal of the consumed AndroidX WebKit version, duplicate definitions of merged Capacitor colors, redundant predictive-back enablement, unsafe background-thread WebView work, or portrait locking without an essential-orientation basis.
- **FR-003**: The solution MUST prioritize reachable current V2 user failures; latent code MUST remain a separately classified non-goal unless reachability and ownership are proven.
- **FR-004**: Production runtime, bundles, configuration, assets, translations, persistence, telemetry, and evidence MUST contain no fabricated user history, backend facts, success claims, or sample advertising identity.
- **FR-005**: Mock, fixture, factory, synthetic, and fake-timer data MAY exist only in isolated tests or tooling with no production reachability.
- **FR-006**: Production-data integrity MUST be evaluated with semantic source, diff, staged, and bundle gates applicable to changed paths; a keyword-only zero-result grep MUST NOT be used as proof.
- **FR-007**: A change that can affect visible pixels or motion trajectory MUST retain a deterministic before baseline and a matched after artifact before it may be called complete.
- **FR-008**: Canonical `ValenceOrb`, `MiniValenceOrb`, their geometry, renderer, premium layers, identity assets, ads, and App Links MUST remain unchanged in this feature.
- **FR-009**: Full-motion behavior MUST retain the current visual composition unless a specific intentional difference is separately approved and evidenced.
- **FR-010**: The remediated Schedule surface MUST consume the current reactive result of the existing lifecycle-aware motion policy and MUST NOT create a second preference source or startup-only snapshot.
- **FR-011**: Reachable Schedule ambient motion MUST honor the resolved existing motion decision, including opacity, shadow, transform, and CSS work not stopped by transform-only policy.
- **FR-012**: Functional motion MAY retain movement only when a static alternative would make the task less understandable; that exception MUST have explicit accessibility acceptance criteria and qualified evidence rather than clinical claims.
- **FR-013**: Directional motion MUST use reactive locale direction and interaction semantics for ar/he, and MUST preserve keyboard, focus, screen-reader, escape, and Android-back paths.
- **FR-014**: User-facing controls and overlays touched by this feature MUST preserve 44-pixel targets, safe areas, bounded viewport height, and desktop-width behavior.
- **FR-015**: Android WebView APIs MUST run on their supported owning thread; startup optimization MUST preserve correct upgrade and offline asset loading.
- **FR-016**: Debug Android configuration without an authorized real development AdMob ID MUST fail at build time with an actionable message; tracked production or debug configuration MUST NOT embed Google's sample/test publisher IDs.
- **FR-017**: Existing Capacitor Core SystemBars, SafeArea ownership, AndroidX WebKit dependency ownership, merged resources, and current App plugin back dispatcher MUST be preserved unless an exact installed-artifact runtime test proves a change is required.
- **FR-018**: New production dependencies, benchmark modules, profile installers, version changes, orientation policy, root-back semantics, and service-worker reload policy require separate explicit owner approval.
- **FR-019**: Performance acceptance MUST compare the same reachable journey, device class, refresh rate, lifecycle state, and artifact before and after; a faster metric MUST NOT justify visual simplification.
- **FR-020**: Static ratchets MUST be reachability-aware, baseline-bound, and monotonic for governed files; they MUST not require a global rewrite merely to drive syntactic counts to zero.
- **FR-021**: Every implementation batch MUST begin with a focused failing regression test or retained characterization/visual baseline and rerun the same evidence after the patch.
- **FR-022**: Every batch MUST declare status for Web/Vite, installed PWA, Android/Capacitor, iOS/WKWebView, and Desktop/Tauri; platform evidence MUST not be transferred across rows.
- **FR-023**: Completion MUST report technical, visual runtime, artistic/craft, motion, model, and plan evidence separately where applicable.
- **FR-024**: Local hooks and generated reports MUST be treated as guardrails, not proof of visual parity, runtime behavior, authorization, or release readiness.
- **FR-025**: This feature MUST NOT commit, push, open a PR, deploy, publish audits, bump versions, rebase or mutate the separate dirty motion worktree, or change release state.

## Non-Goals and Authority Boundaries

- No wholesale execution of audit phases or global migration of every loop, spring, hover, easing, or duration.
- No modification or deletion of latent V1, stats, stories, breathing, or friends modules without a separate reachability and ownership decision.
- No Android portrait lock; landscape support and any essential-orientation exception require a product decision and WCAG evidence.
- No Baseline Profile/ProfileInstaller/Macrobenchmark dependency or module until the exact dependency set and measured goal are approved.
- No change to root double-tap exit or predictive-back semantics until API 34–36 runtime evidence and an owner decision exist.
- No visual splash, icon-density, theme-color, native-background, blur, layout, lazy-image, or service-worker update change before its exact baseline exists.
- No production-data, sync, storage, auth, privacy, ads, or release redesign. A newly discovered privacy defect is triaged separately and enters this feature only after source-to-sink validation.

## Platform and Domain Matrix

| Surface | Web/Vite | Installed PWA | Android/Capacitor | iOS/WKWebView | Desktop/Tauri |
| --- | --- | --- | --- | --- | --- |
| Motion gate lifecycle | Required runtime proof | Required install/resume proof | Required WebView/resume proof | Required WKWebView/resume proof | Required window/resume proof |
| RTL and accessibility | en/ar/he browser matrix | Same plus install state | Same plus back/safe area/IME | Same plus safe area | Same plus keyboard/hover/window width |
| Native startup | N/A — no Android shell | N/A — PWA startup is separate | Required API 26/31/34/36 evidence | N/A for Android batch; iOS remains explicit `UNVERIFIED` | N/A for Android batch |
| Visual parity | Required for reachable web surfaces | Required for installed presentation | Required for WebView and native chrome | Required before parity claim | Required before parity claim |
| Store/release | No release action | No release action | No version/store action | No version/store action | No release action |

## Success Criteria

### Measurable Outcomes

- **SC-001**: Every implemented audit item has one current classification, local evidence, affected-platform row, regression proof, rollback path, and `GO/STOP/ASK` verdict; no implemented item remains unclassified.
- **SC-002**: Stable before/after captures for changed visual surfaces contain zero unexplained composition or layer differences; intentional trajectory differences have matched-progress evidence and explicit acceptance.
- **SC-003**: In the tested Schedule reduced-motion state, sampled transform, opacity, shadow, and CSS ambient activity remains static for the complete observation window, while the same surface retains the exact current full-motion control values.
- **SC-004**: Schedule receives the current resolved motion decision through false → true → false rerenders without adding a second preference source or remount-only snapshot.
- **SC-005**: An Android debug packaging request with all application-ID sources absent fails before packaging with the exact actionable configuration error and no sample publisher identity in source or output.
- **SC-006**: Existing Android release-ID guards remain unchanged and green; successful debug packaging is PASS only when an authorized private real development ID is present, otherwise that path is `UNVERIFIED`.
- **SC-007**: Production-data integrity source/diff/bundle checks report zero unwaived errors on changed paths, and negative controls demonstrate that production-reachable synthetic data would be rejected.
- **SC-008**: Focused tests, typecheck, lint, relevant i18n/RTL checks, production build, motion/visual contracts, and current structural gates complete without unexplained failures.
- **SC-009**: The final five-platform matrix has no implicit pass: every row is `PASS`, reasoned `N/A`, `FAIL`, or `UNVERIFIED` with exact evidence or blocker.
- **SC-010**: No dependency, version, publication, release, cross-lane, canonical-orb, ad surface/identity, App-Link, business storage, sync, or auth-flow change appears in the final diff; the only privacy storage change is minimized route retention in the existing session snapshot.

## Assumptions

- The current implementation target is the locked worktree `/Users/yehor/Projects/ZenFlow/worktrees/codex-animation-quality-remediation-20260829` at base `c779c1171157a563a6bef1bc773528c78eaeb117`.
- Current source, installed package source, executed tests, and primary platform documentation outrank audit statements.
- The owner wants safe local implementation but has not authorized publication, release, new production dependencies, versioning, destructive cleanup, or mutation of any other worktree.
- Missing native devices, Apple runtime, artistic human acceptance, or store evidence remain `UNVERIFIED`; they are never inferred from web or static checks.

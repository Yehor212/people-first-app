# ZenFlow Animation Quality Remediation Implementation Plan

> Follow the repository Test-First Agent Policy. Execute one task at a time; production edits are forbidden until the named focused proof has failed for the expected reason.

**Goal:** Correct only current, source-verified audit defects while preserving full-motion visual behavior and eliminating production mock/sample behavior.

**Architecture:** A leaf route sanitizer minimizes device-local diagnostic routes. The current Schedule owner obtains one reactive policy decision and explicitly passes it to ambient-loop owners. Android Gradle validation fails closed for missing debug ad configuration. No new dependency, store, schema, visual identity, or feature architecture is introduced.

**Stack:** React 18, TypeScript, Motion 12.26, Vitest, Vite, Capacitor 8, Android Gradle.

---

## Task 1: Create route privacy RED

**Files**

- Modify: src/observability/__tests__/runtimeFlightRecorder.test.ts
- Create: src/observability/__tests__/runtimeRouteSanitizer.test.ts
- Modify or create: src/observability/__tests__/runtimePerformanceMode.test.ts

**Steps**

1. Assert that safe navigation values survive while callback codes, state, token variants, email/reset/error values, unknown parameters, and fragments do not.
2. Assert install/markRoute cannot retain explicit unsafe route strings.
3. Persist a valid legacy strained snapshot with an unsafe route; assert read returns and rewrites the minimized route with other fields unchanged.
4. Run only these tests and confirm RED because the sanitizer does not exist and current capture preserves full search.

## Task 2: Implement route privacy

**Files**

- Create: src/observability/runtimeRouteSanitizer.ts
- Modify: src/observability/runtimeFlightRecorder.ts
- Modify: src/observability/runtimePerformanceMode.ts

**Steps**

1. Implement a URL-based, fail-closed, idempotent key-and-value allowlist.
2. Use it in currentRoute and explicit markRoute.
3. Sanitize legacy snapshots on read and rewrite only when changed.
4. Run the same RED command GREEN, then all observability tests.
5. Run the narrow security suite; fix validated findings in changed code and rescan.

## Task 3: Create Schedule reduced-motion RED

**Files**

- Create: scripts/__tests__/schedule-reduced-motion-contract.test.ts

**Steps**

1. Bind the contract to ScheduleTimeline, ScheduleVisuals, TimelineDayColumn, and ParticleBackground.
2. Require a reactive useShouldAnimate decision at ScheduleTimeline.
3. Require each reachable ambient loop to be conditional on motionAllowed and require ParticleBackground to retain static particles without animation classes.
4. Lock exact current true/default animation arrays and transition values as a negative visual-regression control.
5. Run the focused contract and confirm RED on the missing gate.

## Task 4: Implement Schedule gate-only remediation

**Files**

- Modify: src/components/stats/ParticleBackground.tsx
- Modify: src/components/schedule/ScheduleTimeline.tsx
- Modify: src/components/schedule/ScheduleVisuals.tsx
- Modify: src/components/schedule/TimelineDayColumn.tsx

**Steps**

1. Add animated with default true to ParticleBackground; when false retain particle geometry/opacity but omit animation classes and timing style.
2. Call useShouldAnimate once in ScheduleTimeline.
3. Gate local loops and pass motionAllowed to all leaf owners.
4. Use first array values and non-repeating transitions for false mode; leave true/default values byte-equivalent.
5. Run the same contract GREEN and existing Schedule tests.
6. Run canonical-orb and visual guards to prove protected visuals were not touched.

## Task 5: Create and implement Android debug fail-fast

**Files**

- Modify: scripts/__tests__/admob-production-no-mockdata.test.ts
- Modify: android/app/build.gradle

**Steps**

1. Extend the static contract to require debug packaging task detection, an empty-ID error, and rejection of Google's sample publisher.
2. Run the test RED.
3. Add task-graph validation for assembleDebug, bundleDebug, and packageDebug while preserving existing release validation.
4. Run the same test GREEN.
5. Run assembleDebug with the ID variables unset and confirm the expected early failure.
6. Do not synthesize or persist an application ID. If no authorized real local ID exists, mark successful debug runtime UNVERIFIED.

## Task 6: Broad verification

**Files**

- Review all changed files and dist after build.

**Steps**

1. Run TypeScript and Vitest separately.
2. Run lint, i18n/deep/RTL, architecture/constitution, canonical-orbs, best-practices, no-AI-templates, production-data integrity diff/full, npm audit, build, then production-data bundle.
3. Use no seeded records for runtime capture. Keep blocked platform rows UNVERIFIED.
4. Inspect diff/status and ensure no unrelated, generated, secret, sample-ID, mock-runtime, version, dependency, orb, release, or publication change.

## Task 7: Independent closure

1. Run visual-integrity-critic with before/after artifacts or explicitly record missing runtime evidence.
2. Run Role 8 QA against fresh command outputs.
3. Hash the final packet and run Role 10 Pass B.
4. Run Spec Kit converge.
5. Report PASS, FAIL, UNVERIFIED, and STOP without commit/push/deploy.


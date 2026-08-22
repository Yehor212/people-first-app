# T178-R Core Without Monetization Implementation Plan

**Goal:** Prove that ZenFlow startup, habit, diary, mood, planning, and settings remain truthful and usable when monetization is absent, unsupported, denied, stale/OFF, or offline.

**Architecture:** Keep monetization compile-time OFF behind the existing compatibility API. Compose only the current hash-bound T177-R byte set plus the six non-overlapping T175-R habit durability paths; T176-R is attributed through T177-R's verified reconciliation. IndexedDB/Dexie remains local truth, and optional publication stays downstream of durable commits.

**Tech Stack:** React 18, TypeScript, Vite/Vitest, Dexie, Capacitor 8, Android Gradle, Playwright, Xcode/Tauri checks where locally available.

**Authority boundary:** Task-local uncommitted work only. No cumulative integration lane, commit, push, PR, merge, deployment, Play Console, Supabase remote, analytics, messaging, or successor task.

## Task 1: Freeze prerequisites and obtain RED

**Files:**
- Add: src/lib/__tests__/adController.adsOff.test.ts
- Evidence: output/android21/core/t178-r/prerequisite-manifest.json
- Evidence: output/android21/core/t178-r/red-green.json

1. Bind canonical T178 specification hashes and current HEAD.
2. Recompute T175-R, T176-R, and replacement T177-R receipt/manifests and replay them read-only.
3. Add only the prerequisite ADS_OFF regression test.
4. Run npx vitest run src/lib/__tests__/adController.adsOff.test.ts.
5. Record the expected baseline failure showing reachable AdMob/UMP calls.

## Task 2: Compose exact current prerequisite bytes

**Files:**
- Modify/add: the 46 paths in the current T177-R changed-path manifest.
- Modify/add: the six T175-R-only habit paths:
  - src/hooks/__tests__/useHabitHandlers.test.ts
  - src/hooks/useHabitHandlers.ts
  - src/pages/nav-v2/habits/HabitsPage.tsx
  - src/pages/nav-v2/habits/__tests__/metrics-wiring.test.tsx
  - src/storage/__tests__/habitCompletionCommit.test.ts
  - src/storage/habitCompletionCommit.ts
- Evidence: output/android21/core/t178-r/composition-manifest.json

1. Apply T177-R files byte-for-byte from its verified lane.
2. Apply only the six non-overlapping T175-R habit files byte-for-byte.
3. Prove every imported path hash and its single attribution.
4. Verify T176-R paths are either byte-identical to or explicitly reconciled by T177-R.
5. Never describe this union as an approved integration lane.

## Task 3: Focused core contracts

**Files:**
- Reuse: the exact imported T175-R/T176-R/T177-R unit and contract tests.
- Evidence-only harness: output/android21/core/t178-r/e2e/core-without-monetization.spec.ts
- Modify only if a fresh failure proves it necessary: the smallest relevant core production path.

1. Characterize startup with ADS_OFF and no SDK/UMP call.
2. Exercise durable habit create/update/reload and completion ordering.
3. Exercise diary save/recovery/privacy-safe failure diagnostics.
4. Exercise mood save/reload, planning persistence, and settings persistence.
5. Exercise offline/degraded publication while local commits remain authoritative.
6. Rerun the ADS_OFF RED command and focused core tests to GREEN.

**Execution result:** No additional production edit was needed after exact prerequisite composition. The focused final set passed 189/189 and the broader exact-composition set passed 388/388; the output-only Playwright harness passed the core Web persistence flow without ad requests.

## Task 4: Source, bundle, and native provenance

**Files:**
- Evidence/tools: output/android21/core/t178-r/tools/
- Evidence: output/android21/core/t178-r/provenance-matrix.json

1. Run ordinary source scans and ADS_OFF contract tests.
2. Build Vite, sync Capacitor, and build release APK and AAB.
3. Scan source, lockfile, bundle, Capacitor plugin manifest, merged manifests, APK, and AAB for AdMob/UMP/sample IDs/reward paths.
4. Bind build inputs and artifact SHA-256 hashes.
5. Run Snyk or the documented local fallback on modified first-party supported code.

## Task 5: Runtime and visual matrices

**Files:**
- Evidence/tools: output/android21/core/t178-r/tools/
- Evidence: output/android21/core/t178-r/runtime-matrix.json
- Evidence: output/android21/core/t178-r/visual-matrix.json

1. Use Playwright CLI against a production-equivalent local build for Web and installed-PWA-style lifecycle checks.
2. Install only the final release-derived Android APK on codex_pixel_10_custom_api36.
3. Bind the CUSTOM_SPEC_PROFILE config hash and installed package/artifact hash.
4. Exercise startup, habit, diary, mood, planning, settings, reload, Activity recreation, force-stop/cold-launch, Back, and IME where applicable.
5. Capture representative eight-locale states, RTL, font scale, reduced motion, safe areas, and detect blank/stale/clipped captures without private prose or PII.
6. Run strongest safe iOS and Desktop build/runtime evidence; mark unavailable installed runtime exactly UNVERIFIED.

## Task 6: Broad gates, seal, and cleanup

**Files:**
- Evidence: output/android21/core/t178-r/receipt.json
- Evidence: output/android21/core/t178-r/changed-path-manifest.json
- Evidence: output/android21/core/t178-r/artifact-manifest.json
- Evidence: output/android21/core/t178-r/source-freeze.json
- Evidence: output/android21/core/t178-r/failures-unverified.json
- Evidence/tool: output/android21/core/t178-r/tools/replay-evidence.mjs

1. Run focused tests, broader tests, typecheck, lint, i18n/RTL, production-data-integrity, no-AI-template, best-practices, canonical orb, sync, PWA/native/platform checks, APK+AAB builds, and required security scans.
2. Review exact final git diff and git status; staged must be zero.
3. Generate path+XY+hash, build-input, artifact, runtime, visual, negative-control, privacy-redacted log, and external-write ledgers.
4. Run replay and tamper negative controls against the final sealed receipt.
5. Stop local servers, release ADB/emulator, and confirm no process/resource leak.
6. Set TASK_GO only if failures and remaining in-scope arrays are empty; retain all unavailable native/human/performance/release proof as UNVERIFIED.

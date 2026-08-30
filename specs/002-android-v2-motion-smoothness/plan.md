# Implementation Plan: Android V2 Motion Smoothness

**Branch**: `codex/android-v2-motion-smoothness` | **Date**: 2026-08-22 | **Spec**: [spec.md](./spec.md)

**Input**: Approved Android-only motion diagnosis and remediation at visual baseline `13ca51a80d23220574deba762851fe5a32372e46`.

## Summary

Build a local, release-like Android benchmark lane that exposes WebView diagnostics only in that variant; bind exact APK/web/environment provenance; reproduce V2 jank with separate JavaScript, Perfetto FrameTimeline, and visual passes; patch only a demonstrated bottleneck; and reject any candidate outside the baseline visual/resource-noise envelope. The production release remains non-debuggable and no quality knob, product data, storage/sync contract, public API, or non-Android runtime behavior changes.

## Technical Context

**Language/Version**: TypeScript 5.8, React 18, Java 17, Gradle/Android Gradle Plugin from the locked repository

**Primary Dependencies**: Capacitor 8, Vite, Playwright, Sharp, Android SDK/ADB, system Perfetto and FrameTimeline

**Storage**: Product storage unchanged; diagnostic JSON, traces, screenshots, and recordings under ignored `output/android-v2-motion/`

**Testing**: Vitest, Playwright, existing canonical-orb/visual guards, Gradle assembly/install, ADB/CDP, Perfetto trace processor queries when available

**Target Platform**: Installed Android/Capacitor; API 26 compatibility, API 36 diagnostic emulator, Android 12+ 60 Hz and Android 14+ 90/120 Hz physical gates

**Project Type**: Hybrid Android application with React/WebGL WebView content and native Capacitor shell

**Performance Goals**: ≤1% deadline-missed steady frames; `frameOverrunMs` p95 ≤0 and p99 ≤1 target period; ACK p95 ≤1 and p99 ≤2 target periods; no consecutive misses, >100 ms gaps, frozen frames, ANR/crash/context loss

**Constraints**: Exact visual parity; current 60 Hz orb contract; no lowered density/FPS/quality/complexity; no external telemetry; no new production dependency; no commit/push/merge/deploy/release

**Scale/Scope**: Five V2 tabs, orb and all named interactive/lifecycle states, two themes, eight static locales, three full-motion locales, portrait/landscape/split-screen, normal/reduced motion

## Constitution Check

The repository constitution reports `PROPOSED`, `ratified:false`, and `binding:false`; proposal-only criteria are advisory and cannot create a false `CRITICAL` result. Active `AGENTS.md` and repository contracts remain mandatory.

| Gate | Pre-design status | Design response |
| --- | --- | --- |
| People-first and visual fidelity | PASS | Candidate is rejected on any visual/motion-quality loss. |
| Test-first behavior change | PASS | Benchmark contract and runtime characterization precede production edits. |
| Android installed-runtime evidence | PARTIAL | API 36 emulator available; both required physical gates remain `UNVERIFIED` until connected. |
| Privacy and production data integrity | PASS | Empty local test state; ignored local evidence; no external telemetry or product-data changes. |
| Cross-platform impact declaration | PASS | Android direct; Web/PWA/iOS/Desktop runtime excluded with shared-path non-regression checks. |
| Accessibility and localization | PASS | RTL, reduced motion, Back/IME, safe areas, window modes, and eight locales are explicit. |
| SOLO execution | PASS | No subagents, orchestra, or independent-agent proof; final critic is an inline SOLO audit. |
| Release authority | PASS | Local uncommitted lane only; release/publication stays blocked. |

Post-design re-check: PASS for plan completeness, with physical-device performance and human artistic approval intentionally `UNVERIFIED` rather than diluted.

## Architecture and Evidence Flow

```text
exact clean SHA
  ├─ clean release-like web bundle + APK hash
  ├─ benchmark-only build flag/profileable/debuggable WebView
  └─ deterministic empty local state
        ├─ JS/CDP pass → long tasks, LoAF, layouts, ACK, loops/listeners, memory
        ├─ CDP-off Perfetto pass → FrameTimeline, scheduler, GPU, GC, SurfaceFlinger, thermal
        └─ visual pass → phase frames, screenshots, recordings, noise envelope
                              ↓
                  one trace-backed root cause
                              ↓
              smallest Android-scoped production patch
                              ↓
               same passes + exact before/after ledger
```

## Root-Cause Decision Tree

1. Attribute missed frames to main thread, WebView compositor/GPU, worker pacing, lifecycle ownership, startup compilation, or an unresolved external factor.
2. Change only the attributed path: remove dead work/coalesce writes; constrain intermediate-surface work without changing pixels; latest-state worker pacing without phase drift; enforce single lifecycle ownership; or prewarm while retaining the last complete frame.
3. Repeat the exact scenario and reject a candidate that does not improve a physical run or that exceeds timing, memory, thermal, or visual noise limits.
4. Stop after three unsuccessful isolated changes for the same cause or when the remaining option costs visual or energy quality.

## Project Structure

### Documentation and contracts

```text
specs/002-android-v2-motion-smoothness/
├── spec.md
├── plan.md
├── research.md
├── data-model.md
├── quickstart.md
├── contracts/android-motion-evidence.schema.json
├── checklists/requirements.md
├── checklists/performance.md
└── tasks.md
```

### Source and diagnostic touch points

```text
android/app/build.gradle
android/app/src/main/AndroidManifest.xml
android/app/src/main/java/com/zenflow/app/MainActivity.java
android/app/src/benchmark/AndroidManifest.xml
src/components/state-of-mind/ValenceOrb.tsx
src/components/state-of-mind/orbWorker.ts
src/pages/nav-v2/**
src/pages/nav-v2/__tests__/androidMotionBenchmarkContract.test.ts
e2e/orb-long-session-cadence.spec.ts
e2e/settings-final-audit.spec.ts
e2e/android-v2-motion-visual.spec.ts
scripts/android-motion/**
output/android-v2-motion/**  # ignored runtime evidence only
```

**Structure Decision**: Preserve the current React/Capacitor architecture. Native changes provide a benchmark-only diagnostic boundary; shared runtime files are edited only if the trace proves a shared code path is the Android cause and the edit is Android-gated without changing other platforms.

## Platform and Domain Matrix

| Area | Implementation impact | Required evidence |
| --- | --- | --- |
| Android/Capacitor | Direct | benchmark/debug assemblies, install, scenarios, Perfetto, visual captures |
| Web/Vite | No intended runtime change | shared tests/build and diff audit |
| Installed PWA | None by user decision | N/A |
| iOS/WKWebView | None by user decision | N/A; ensure no ungated shared behavior change |
| Desktop/Tauri | No intended runtime change | shared tests/build and diff audit |
| Store/Release | None | no release claim or upload |
| Accessibility | Preserve current behavior | RTL, reduced motion, safe area, Back, IME, rotation/split-screen |
| Performance | Direct | fixed thresholds, five-repeat median/MAD, thermal validity |
| Security/Privacy | Diagnostic boundary only | release debugging false; empty local state; no network telemetry |
| Testing | Expanded | red/green focused tests, e2e scenarios, device evidence |
| Operations | Local evidence | hashes, timestamps, environment, validity and status ledger |

## Complexity Tracking

No architecture exception or new dependency is justified. A Macrobenchmark/ProfileInstaller module is rejected because it would broaden production dependency/wiring for a WebView/WebGL diagnosis already covered by the approved ADB/CDP/Perfetto method.

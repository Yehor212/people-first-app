# Validation Quickstart: Android V2 Motion Smoothness

## Preconditions

1. Run only from locked `codex/android-v2-motion-smoothness` at baseline SHA `13ca51a80d23220574deba762851fe5a32372e46` plus the task diff.
2. Use an empty local test state. Do not sign in with or capture a real user profile.
3. Keep Android animation scales at `1x`; disable battery saver and unrelated host/device load.
4. Record WebView version, API, GPU, refresh rate, density, thermal status, theme, locale, and window mode.
5. Treat emulator data as reproducibility/compatibility evidence only.

## Static and focused checks

```bash
npx vitest run src/pages/nav-v2/__tests__/androidMotionBenchmarkContract.test.ts
npx vitest run src/components/state-of-mind/__tests__/canonicalOrbInvariant.test.ts
npm run check:canonical-orbs
npm run check:visual
```

## Build and install

```bash
npm run cap:sync:android
cd android
./gradlew :app:assembleBenchmark :app:assembleDebug --no-daemon
adb install -r app/build/outputs/apk/benchmark/app-benchmark.apk
```

Record SHA-256 for the APK, `dist/` manifest, installed package, and exact Git diff before measuring.

## Three-pass scenario protocol

For each approved scenario, use the same scenario ID and state but separate executions:

1. JavaScript/CDP pass: long tasks, LoAF, forced layout/style, allocations, worker request/render/ACK, active resources/listeners.
2. CDP-off Perfetto pass: FrameTimeline, SurfaceFlinger, scheduler, GPU, GC, memory, and thermal.
3. Visual pass: phase screenshots and recording only; never use capture cadence as the performance metric.

Physical-device runs require three warmups and five measured repetitions. Discard any run with thermal throttling, battery saver, invalid animation scales, or unrelated load.

## Acceptance boundary

- Do not claim overall performance `PASS` without both required physical-device classes.
- Do not claim artistic approval from automated image comparison.
- Do not accept a candidate that changes pixels/trajectory or exceeds the fixed timing/resource noise envelope.
- Stop after three unsuccessful isolated candidates for one root cause or when only a quality/energy tradeoff remains.

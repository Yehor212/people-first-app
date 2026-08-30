# Research: Android V2 Motion Smoothness

## Decision 1: Use FrameTimeline as the system frame source

**Decision**: Attribute app, GPU, and SurfaceFlinger timing with Perfetto FrameTimeline; retain `gfxinfo` only as a bounded supplementary signal.

**Rationale**: Android documents that `gfxinfo` does not necessarily cover all OpenGL/WebView rendering, while FrameTimeline provides expected/actual frame timelines and jank attribution across the rendering pipeline.

**Alternatives considered**: `gfxinfo` alone was rejected as incomplete for a worker WebGL canvas inside WebView. Visual recording was rejected as a timing source because capture overhead and video cadence can distort the measured app.

**Primary sources**: [Android slow rendering](https://developer.android.com/topic/performance/vitals/render), [Perfetto FrameTimeline](https://perfetto.dev/docs/data-sources/frametimeline), [Android system tracing](https://developer.android.com/topic/performance/tracing).

## Decision 2: Separate diagnostic passes

**Decision**: Run JavaScript/CDP, CDP-off Perfetto, and visual capture as independent passes over the same deterministic scenario.

**Rationale**: DevTools allocations/screenshots and screen recording can perturb scheduling, GPU work, memory, and thermals. Separate passes preserve causality while identical scenario IDs/timestamps bind the evidence.

**Alternatives considered**: One all-instrumented run was rejected because it cannot distinguish app jank from observer/capture overhead.

## Decision 3: Add a benchmark-only Android variant

**Decision**: Add a minified release-like `benchmark` build type, locally debug-signed and profileable, with WebView debugging enabled only when the benchmark BuildConfig flag is true.

**Rationale**: Official Android WebView debugging requires explicit runtime enablement. A build-time boundary keeps release debugging false and supports CDP without weakening production.

**Alternatives considered**: Enabling debugging globally or in release was rejected. Debug APK timing was rejected as non-representative. A new Macrobenchmark/ProfileInstaller dependency was rejected as unnecessary scope and insufficient by itself for WebView/WebGL attribution.

**Primary source**: [Debug web apps with WebView](https://developer.android.com/develop/ui/views/layout/webapps/debugging).

## Decision 4: Fix only trace-backed work

**Decision**: Treat compositor layers, worker ACK, orientation writes, GC, lifecycle duplication, and startup compilation as hypotheses until a controlled pass attributes a reproducible symptom.

**Rationale**: Prior local evidence found a large backdrop surface but removing it did not close jank. Static code shape and old traces cannot establish the current cause.

**Alternatives considered**: Bulk CSS simplification, lower density/frame rate, reduced visual complexity, Canvas2D fallback, and always-on reduced motion were rejected by the canonical visual contract and the user’s explicit prohibitions.

## Decision 5: Compare against a measured visual noise envelope

**Decision**: Use five phase-matched baseline captures to derive per-checkpoint GPU noise, then require the candidate to remain within that envelope.

**Rationale**: Animated GPU output may vary naturally, so exact file hash equality is too strict while an arbitrary tolerance can conceal a visual regression. The tolerance is fixed before candidate review.

**Alternatives considered**: A single screenshot, pixel-perfect equality, and post-hoc tolerance adjustment were rejected.

## Decision 6: Keep physical-device gates authoritative

**Decision**: Use API 36 and API 26 emulators for reproducibility/compatibility only. Require Android 12+ mid-range 60 Hz and Android 14+ 90/120 Hz physical results for overall performance acceptance.

**Rationale**: Emulator scheduling/GPU behavior does not represent user hardware and cannot prove high-refresh pacing or thermal stability.

**Alternatives considered**: Treating emulator results or `BUILD SUCCESSFUL` as user-performance proof was rejected.

## Decision 7: Keep evidence local and non-personal

**Decision**: Store traces and ledgers only under ignored `output/android-v2-motion/`, seed an empty local test state, and prohibit real journal/habit/account capture or external telemetry.

**Rationale**: Performance traces and screenshots can expose user content. The diagnosis needs rendering metadata, not personal records.

**Alternatives considered**: Capturing an existing signed-in profile or uploading traces to a hosted service was rejected.

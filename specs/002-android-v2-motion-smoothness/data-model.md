# Diagnostic Data Model: Android V2 Motion Smoothness

These entities describe ignored local evidence only. They do not change production storage, sync, schema, exports, analytics, or user data.

## EnvironmentFingerprint

- `baselineSha`: exact 40-character Git SHA.
- `artifactSha256`: APK and web-bundle hashes.
- `packageVersion`: installed version name/code and build type.
- `device`: serial alias, model, API, ABI, physical/emulator classification.
- `graphics`: GPU/renderer, WebView version, resolution, density, refresh modes.
- `state`: theme, locale, direction, window mode, motion preference.
- `validity`: thermal status, battery saver/power state, animation scales, background-load note.

Validation: no raw credentials, account identifiers, journal text, habit content, tokens, or external telemetry endpoint may appear.

## ScenarioRun

- `runId`: stable `<scenario>-<pass>-<repeat>-<timestamp>` identifier.
- `scenario`: one of the approved launch/orb/route/feature/lifecycle/window scenarios.
- `pass`: `javascript`, `perfetto`, or `visual`.
- `startedAt` and `endedAt`: UTC timestamps.
- `warmupIndex` or `measuredIndex`: explicit repetition role.
- `environmentRef`: fingerprint hash.
- `status`: `FIXED`, `NOT_REPRODUCIBLE`, or `UNVERIFIED`.
- `symptom`, `attribution`, `rootCause`, `fix`: evidence-bound statements; unknown values are explicit `null`, never invented.
- `artifacts`: relative paths plus SHA-256.

State transition: `UNVERIFIED` may become `NOT_REPRODUCIBLE` after the full fixed matrix or `FIXED` only after before/after evidence. No status is inferred from build success.

## FrameMetrics

- Frame count, deadline-missed count/rate, consecutive misses.
- `frameOverrunMs` p50/p95/p99/max.
- Presentation gaps and frozen-frame count.
- CPU/GPU/Scheduler/SurfaceFlinger attribution when trace data provides it.
- Frame period and refresh-rate context.

## JavaScriptTelemetry

- Long tasks, long animation frames, forced style/layout time, and relevant allocation deltas.
- Worker request/post/render/ack timestamps and p50/p95/p99.
- Active renderer, worker, animation-loop, and listener counts.
- Lifecycle and context-loss events.

## ResourceSeries

- Per-cycle Java/Native/Graphics/Total memory.
- Thermal status and battery/power validity.
- CPU/GPU frequency evidence when available.
- Monotonic-growth result for the final three lifecycle cycles.

## VisualCapture

- Scenario phase, theme, locale, direction, orientation/window mode, motion mode.
- Baseline/candidate artifact hashes.
- Geometry/color/blur/opacity/trajectory checks.
- Baseline noise statistics and candidate delta.
- Human artistic approval remains separate and is never synthesized from pixel metrics.

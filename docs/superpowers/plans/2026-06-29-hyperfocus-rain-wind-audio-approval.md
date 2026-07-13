# Hyperfocus Rain Wind Audio Approval Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the blocked Hyperfocus V2 audio set with the approved target families `forest`, `rain`, `ocean`, `fireplace`, `river`, and `wind`, then obtain independent subagent approval.

**Architecture:** Keep the existing Hyperfocus audio catalog and QC script ownership. Replace only the blocked family slots and regenerate derived manifest/provenance/docs/package evidence from local files.

**Tech Stack:** React/TypeScript catalog, Node QC scripts, MP3 assets, Capacitor/Tauri packaging.

---

### Task 1: Red Contract

**Files:**
- Modify: `src/lib/__tests__/hyperfocusAudioCatalog.test.ts`
- Modify: `scripts/__tests__/check-hyperfocus-audio-assets.test.ts`

- [ ] Add a failing test proving the required family set is exactly `forest/rain/ocean/fireplace/river/wind`.
- [ ] Run the focused test and confirm it fails because current code still exposes `underwater/thunderstorm`.

### Task 2: Audio Assets

**Files:**
- Add: `public/sounds/hyperfocus/hyperfocus-rain-{soft,deep,intense}.mp3`
- Add: `public/sounds/hyperfocus/hyperfocus-wind-{soft,deep,intense}.mp3`
- Remove from active set: `public/sounds/hyperfocus/hyperfocus-underwater-*.mp3`, `public/sounds/hyperfocus/hyperfocus-thunderstorm-*.mp3`

- [ ] Use licensed free nature sources only, with source/license proof.
- [ ] Normalize to the current strict 30-second MP3 loop policy.
- [ ] Run strict audio QC and fix any clipping/seam/duration failures.

### Task 3: Runtime And Provenance

**Files:**
- Modify: `src/lib/hyperfocusAudioCatalog.ts`
- Regenerate/modify: `src/lib/hyperfocusGeneratedAudioManifest.ts`
- Modify: `docs/audio/hyperfocus-generated-audio-provenance.json`
- Modify: `docs/audio/hyperfocus-audio-intensity-profile.json`
- Modify: `docs/audio/hyperfocus-nature-soundscape-spec.json`
- Modify: `docs/audio/hyperfocus-nature-pack-qc-2026-06-29.md`
- Modify: `docs/audio/hyperfocus-three-level-audio-plan-2026-06-19.md`

- [ ] Update visible families and labels to the requested nature set.
- [ ] Keep legacy `cafe` safe and avoid live references to removed blocked families.
- [ ] Regenerate manifest/provenance/intensity docs so hashes and durations match files.

### Task 4: Platform Proof

**Files/outputs:**
- `dist/sounds/hyperfocus`
- `android/app/src/main/assets/public/sounds/hyperfocus`
- `ios/App/App/public/sounds/hyperfocus`
- `src-tauri/target/**/sounds/hyperfocus`

- [ ] Run package sync/build commands needed to refresh Web/PWA, Android, iOS, and Desktop package assets.
- [ ] Run the package report and fix any missing target.

### Task 5: Approval Loop

- [ ] Run focused Hyperfocus tests, i18n, typecheck, lint, audit/Snyk where applicable.
- [ ] Spawn a read-only subagent with the same strict best-practices rubric.
- [ ] If subagent returns `BLOCK`, fix blockers and rerun the loop.
- [ ] Final status may only be `APPROVE` or explicitly documented `UNVERIFIED` for unavailable real human/device/public deploy proof.

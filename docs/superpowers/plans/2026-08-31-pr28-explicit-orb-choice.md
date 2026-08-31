# PR #28 Explicit Orb Choice Salvage Plan

**Goal:** Salvage the two still-missing user-facing behaviors from PR #28—an explicit mood choice before Next and a truthful muted disabled state—without importing obsolete orchestration, lockfile, or superseded WebGPU implementation.

**Source:** PR #28 tip `118cf7cf60c72a8a4a2500eb33ccbe38865ae39e`.

**Base:** Stacked on PR #86 tip `de89921d251227d89842b0038ce05388d4c6335b`.

## Boundaries

- Do not modify `ValenceOrb`, `MiniValenceOrb`, WebGPU/WebGL renderers, shaders, motion timing, or canonical orb policy.
- Do not restore `.Codex`, Ruflow/teamlead skills, Claude settings, retired agent orchestration, or the stale lockfile.
- Preserve RTL arrow direction, 44px minimum target, light/dark themes, specific-time validation, and the existing Diary handoff.
- The neutral visual center remains the initial display; it must not be silently committed as a user choice.

## Tasks

- [x] Add RED tests for explicit selection, specific-time plus selection, disabled styling, and existing handoff/layout consumers.
- [x] Require `draftValence !== null` before refine, save, or Diary handoff.
- [x] Render muted disabled and primary enabled Next states while preserving RTL.
- [x] Run focused Orb, sensitive-link, handoff, canonical-renderer, typecheck, and lint checks.
- [x] Capture and inspect fresh phone/desktop, light/dark, enabled/disabled, and Arabic RTL browser evidence.
- [x] Run the independent read-only visual integrity critic.
- [x] Run full repository, build, production-data, release-artifact, and security gates.
- [ ] Commit, push, open the replacement PR, and wait for required CI.
- [ ] Merge and verify main release before closing PR #28.

# PR #28 Semantic Adjudication — 2026-08-31

## Scope

- Source PR: `#28` — `codex/webgpu-orb-evidence-batch`
- Source tip: `118cf7cf60c72a8a4a2500eb33ccbe38865ae39e`
- Replacement branch: `codex/pr28-explicit-orb-choice-20260831`
- Replacement stack base: PR #86 tip `de89921d251227d89842b0038ce05388d4c6335b`

The six source commits are adjudicated individually. The old branch is not merged wholesale.

## Commit Ledger

| Source commit | Intent | Disposition | Replacement or proof |
| --- | --- | --- | --- |
| `f5f6f439b072e7555e90f74ddd7e630202545866` | WebGPU orb routing plus agent/evidence files | `IN_MAIN_NEWER_PARTIAL_REJECT` | current `ValenceOrb` uses the newer `createOrbWebGPUAsync` implementation and canonical tests; retired `.Codex`/Ruflow/teamlead orchestration stays deleted |
| `f020f2bd05c36104f1f02b202b65561201d3a7b5` | stabilize orb flow and visual evidence | `IN_MAIN_NEWER` | current canonical WebGPU/WebGL lifecycle, runtime probes, readiness, and visual tests materially exceed the source implementation |
| `5558d018fa362aa9cbf4ef1995331f72763f42f6` | require explicit mood selection | `TAKE_SEMANTIC` | current replacement requires non-null `draftValence` before refine, save, or Diary handoff and removes implicit neutral commitment |
| `1b7a7d6ccdbbfa61eeb368a466fe36fa5ec5f95e` | synchronize old dependency lockfile | `SUPERSEDED` | current lock belongs to the later 2.1.2 release and cannot be replaced by the historical branch lock |
| `20b40604b05752e0844886b3051900e091b3cb55` | visually mute disabled Next | `TAKE_SEMANTIC` | replacement uses current `cn` and preserves the current RTL arrow while switching between muted disabled and primary enabled states |
| `118cf7cf60c72a8a4a2500eb33ccbe38865ae39e` | make legacy enforcement checker portable | `IN_MAIN_NEWER` | current Codex enforcement checker is repository-relative, cross-platform, and no longer depends on retired Claude law files/settings |

## Verification

- RED: focused Orb test produced two expected failures before implementation—the initial Next button was enabled and specific time alone enabled it.
- Focused final: 5 files, 165 tests passed across Orb flow, sensitive support, Diary handoff, canonical renderer, and ValenceOrb motion.
- TypeScript and scoped ESLint passed.
- Final full Vitest: 754 files passed, 1 skipped; 9,191 tests passed, 23 skipped, 7 todo.
- Full lint, typecheck, production build, PDI diff and bundle (`scanned=2435`, `reachable=822`), release-artifact verification, canonical-orb, best-practices, no-AI-template, task-completion, and agent-context gates passed.
- The exact staged `e2e/orb-user-flow-performance.spec.ts` release test passed locally in 7.5 seconds without changing its 2,500 ms visual-ready budget.
- Strict secrets profile `20260831T162422Z-4694`: Gitleaks and TruffleHog returned zero.
- Fresh Chromium evidence was inspected at 390×844 and 1280×900 for light/dark, disabled/enabled, and Arabic RTL states; the console had zero errors.
- The disabled button remains readable but visually recessive; enabled primary hierarchy is clear; Arabic uses `dir=rtl`, `lang=ar`, and the arrow mirrors left.

## Visual Integrity Critic

- `GO`
- Technical: `PASS`
- Artistic/Craft: `PASS`
- Motion: `PASS` (unchanged)
- Model: `PASS` (canonical renderer unchanged)
- Plan: `PASS`

Local screenshots are verification artifacts only and are intentionally not committed.

## Release Boundary

The replacement remains `UNVERIFIED` for release until full repository/build/security gates pass, the exact replacement tip is merged into `origin/main`, and the resulting main build, Visual, Android, iOS, Pages, privacy, and auth workflows pass. PR #28 and its branch remain recovery locators until then.

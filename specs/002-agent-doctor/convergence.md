# Convergence: Agent Doctor

**Date**: 2026-08-04
**Branch**: `codex/agent-doctor`
**Decision**: Implementation `GO`; full release/governance closure `STOP` until
the documented evidence gaps and inherited dependency advisories are resolved.

## Delivered scope

`npm run doctor:agent` now aggregates six existing local agent-health checks in
a fixed order. It validates its options before executing probes, selects the
workspace diagnostic only from `main`, `codex/*`, or `kimi/*`, runs bounded
Node child processes with `shell: false`, retains later results after a failure,
and emits redacted, bounded text or JSON metadata. It neither repairs nor
synchronizes a workspace.

The change adds the reviewed package-script and hook allow path, a focused
Node-only regression suite, and operator documentation. No product runtime,
sync, storage, native project, deployment, or external state was changed.

## Fresh evidence ledger

| Evidence | Result | Boundary |
| --- | --- | --- |
| RED-first focused test before module creation | PASS | Initial import failed with `ERR_MODULE_NOT_FOUND`, then implementation followed. |
| `npm run test:agent-doctor` | PASS | 9 tests passed; covers aggregation, retained failures, branch/mode validation, fixed arguments, redaction, bounds, and package wiring. |
| `npm run test:agent-workspace` | UNVERIFIED | The clean locked worktree has no `vitest` executable, so zero tests in that existing suite ran. The literal new allow path was separately exercised through the real hook adapter and exited 0; dynamic package-script selection remained blocked with exit 2. |
| New CLI in clean control checkout | PASS | `node .../agent-doctor.mjs --mode review --json` reported all six probes `GO` and exit 0 against clean `main` at `13ca51a80d23220574deba762851fe5a32372e46`. |
| New CLI in implementation lane | PASS (expected STOP) | Five structural probes were `GO`; the existing workspace probe remained `STOP` because the active edit worktree intentionally contains uncommitted changes. No result was suppressed. |
| Agent governance checks | PASS with stated limits | `check:agent-context`, `check:agent-orchestra`, `check:agent-orchestra:eval`, `check:agent-workspace`, `check:best-practices`, and `check:no-ai-templates` exited 0. Orchestra checks themselves correctly retain runtime, permission, semantic, and human evidence as `UNVERIFIED`. |
| Production-data integrity / enforcement | UNVERIFIED | `check:production-data-integrity:diff` and therefore `enforcement:check` could not load the absent `typescript` module. The enforcement aggregate printed `FAIL`; no production-data pass is claimed. |
| New/modified-path security scan | PASS (scoped) | `codex-security-suite.sh --path scripts/agent-doctor.mjs --profile quick` completed Gitleaks, TruffleHog, and Trivy with exit 0. Snyk Code scanned the new supported `.mjs` file with zero results; the broader `scripts/` scan reported no result location in a modified file. |
| Existing Snyk source findings | UNVERIFIED, inherited | The broader `scripts/` scan reports three `javascript/PT` notes in unchanged `scripts/run-shared-dist-build.mjs` (lines 360, 369, and 370). The same three notes reproduced when that file was scanned from clean base `main`; no triage or unrelated change was authorized here. |
| Dependency audit | STOP, inherited | `npm audit --audit-level=high` reports high advisories for `brace-expansion` and `fast-uri`, plus moderate `undici`. The identical result reproduced on clean base `main`; no dependency or lockfile changed in this feature. |

## Platform and domain matrix

| Target/domain | Status | Reason |
| --- | --- | --- |
| macOS developer CLI | PASS | Focused test and both clean-control/active-lane executions ran locally. |
| Web/Vite | N/A | No shipped web code, route, asset, service worker, or build output changed. |
| Installed PWA | N/A | No manifest, cache, service-worker, or runtime behavior changed. |
| Android/Capacitor | N/A | No native project, bridge, permission, or packaged runtime changed. |
| iOS/WKWebView | N/A | No native project, safe-area, bridge, or packaged runtime changed. |
| Desktop/Tauri | N/A | No Tauri source, packaging, or desktop application runtime changed. |
| Windows/Linux developer CLI | UNVERIFIED | The Node argument-array design avoids host-specific shell strings, but it was not executed on those hosts. |
| Accessibility, i18n, user privacy data | N/A | No user-facing surface, translation key, storage, or user-data flow changed. |
| Runtime profile loading, sandbox effectiveness, human approval | UNVERIFIED | Static checks cannot prove these runtime or human conditions. |

## Required follow-up before a release claim

1. Provision the reviewed dev dependencies in an isolated verification lane and
   rerun `npm run test:agent-workspace`, production-data integrity, and the
   enforcement aggregate.
2. Address or formally triage the inherited high dependency advisories in a
   separate authorized dependency change; this feature does not modify them.
3. Triage the three inherited Snyk path-traversal notes in
   `scripts/run-shared-dist-build.mjs` before using a broad scripts scan as a
   release-security approval.
4. Run the CLI on Windows and Linux before claiming host parity.

No commit, push, deploy, dependency installation, remote mutation, or production
data action was performed in this work.

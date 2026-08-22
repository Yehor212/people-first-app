# Implementation Plan: Agent Doctor

**Feature**: `002-agent-doctor` | **Branch**: `codex/agent-doctor` | **Date**: 2026-08-04
**Spec**: [spec.md](spec.md)

## Summary

Add `npm run doctor:agent` as a small Node CLI that aggregates the existing
ZenFlow agent-health checks in a deterministic order. It will use fixed Node
entry points and argument arrays, report every result, preserve failures as an
overall `STOP`, and select the existing workspace doctor mode from the current
branch only. It will not reimplement or weaken any existing check.

## Technical Context

**Language/Version**: JavaScript ESM on the repository-supported Node
`>=22.12 <25`; local implementation host reports Node `v22.22.0`.
**Primary Dependencies**: Node built-ins only (`node:child_process`,
`node:perf_hooks`, `node:url`, `node:test`, `node:assert/strict`).
**Storage**: N/A — no persistence, migration, cache, or user data.
**Testing**: Focused `node --test` suite plus existing Vitest guard suite.
**Target Platform**: Developer CLI on macOS; Node-based construction intended to
avoid path/shell assumptions.
**Project Type**: Repository tooling / local CLI.
**Performance Goals**: Run bounded checks sequentially; each child has a finite
45-second timeout and 128 KiB captured-output ceiling.
**Constraints**: No shell execution, no dynamic executable or child arguments,
no automatic repair/fetch/sync/write, no secret-bearing transcripts, and no
production dependency.
**Scale/Scope**: Six existing local diagnostics, one package command, two guard
surfaces, one focused Node suite, one existing Vitest guard regression, and one
operator document.

## Constitution Check

`check-zenflow-constitution-status.sh --json` reports the Spec Kit constitution
as `PROPOSED`, `binding: false`, and `blocking_authority: false`. Its proposal
criteria inform this plan, but no proposed item is treated as a blocking or
critical authority.

## Research and Decisions

See [research.md](research.md). The implementation uses `spawnSync` deliberately
because this is a short-lived CLI: Node documents fixed argument arrays,
`shell: false`, `timeout`, and `maxBuffer` for controlled child processes. The
diagnostic must collect all outcomes in order, so synchronous sequential probing
is clearer and fail-closed here than concurrent fire-and-forget work.

## Design

### Command flow

```text
argv → strict parse → validate mode/agent
                  ↓
          auto mode only: fixed Git branch lookup
                  ↓
  fixed six-probe plan → sequential Node spawnSync calls (shell: false)
                  ↓
    redact + bound diagnostic metadata → text or JSON report → 0 or 2
```

### Fixed probe map

| ID | Existing authority | Invocation |
| --- | --- | --- |
| `agent-context` | Context and governance structure | `scripts/check-agent-context.mjs` |
| `agent-orchestra` | Exact-ten generated artifact parity | `scripts/sync-persistent-agent-orchestra.mjs --check` |
| `agent-orchestra-eval` | Eval catalog structure | `scripts/validate-persistent-agent-orchestra-eval-report.mjs --catalog` |
| `context-startup` | Context server startup query | `tools/zenflow-context/server.mjs --cli --context startup --topic "startup verification" --max-chars 5000` |
| `auto-context` | Automatic context composition | `tools/zenflow-context/auto-context.mjs --check` |
| `workspace` | Existing isolation contract | `scripts/agent-workspace.mjs doctor --mode … [--agent …] --json` |

The first five commands always use `process.execPath`; the workspace mode is
validated before its fixed arguments are constructed. The branch lookup uses a
fixed `git symbolic-ref --quiet --short HEAD` argument array and no user input.

### Failure semantics

- All six probes run even if any earlier probe reports `STOP`.
- Invalid CLI options or an unsupported automatic branch stop before the probe
  plan is built and exit 2.
- Child non-zero exits, timeouts, signal exits, buffer exhaustion, and spawn
  errors become explicit `STOP` records; no error is silently swallowed.
- Success results show only `exit 0`; failure summaries are redacted, whitespace
  normalized, and capped before text or JSON output.
- The command has no repair path. A `STOP` tells the operator which existing
  command to inspect; it never changes workspace state.

## Project Structure

```text
scripts/
├── agent-doctor.mjs                         # new aggregate CLI
├── agent-workspace-command-guard.cjs        # recognizes doctor as diagnostic-only
├── codex-governance/tool-targets.cjs         # reviewed npm-script allowlist
└── __tests__/
    ├── agent-doctor.test.mjs                 # new focused Node tests
    └── agent-workspace-command-guard.test.ts # literal command regression

docs/ai/
└── AGENT_DOCTOR.md                           # operator contract and limits

specs/002-agent-doctor/
├── spec.md
├── plan.md
├── research.md
├── data-model.md
├── quickstart.md
├── contracts/cli.md
├── tasks.md
└── checklists/requirements.md
```

## Best-Practices Implied Requirements Packet

| Area | Decision | Status |
| --- | --- | --- |
| Web/Vite and installed PWA | No shipped-app code, route, asset, or service worker changes | N/A |
| Android/Capacitor and iOS/WKWebView | No native project or bridge changes | N/A |
| Desktop/Tauri | No Tauri application/runtime change | N/A |
| macOS developer CLI | Isolated lane command and focused tests will run locally | Planned |
| Windows/Linux developer CLI | Node argument arrays avoid platform-specific shell strings; no host run available | UNVERIFIED |
| Accessibility and localization | No user-facing app surface; concise CLI output remains English developer tooling | N/A |
| Security and privacy | Fixed executables/args, no shell, finite output, redaction, no credentials or data reads | Planned |
| Testing and operations | RED-first focused test, existing guard regression, real command, diff/status review | Planned |
| Release/store | No deploy, store asset, or release artifact impact | N/A |

## Complexity Tracking

No constitution exception or added project abstraction is required. The command
delegates to existing authorities instead of creating a duplicate validation
framework.

# Implementation Plan: Agent Governance Evidence

**Branch**: `codex/agent-routing-ab-eval` | **Date**: 2026-08-04 | **Spec**: [spec.md](./spec.md)

## Summary

Make the agent-governance control plane honest by removing automatic audit-file
writes from the routine skill-routing hook, adding a deliberately invoked local
observation command, hardening the local routing A/B receipt validator, and
making production-data-integrity timeout errors path-safe and fail-closed. The
change is governance tooling only: it does not change the ZenFlow product or
claim that a local subprocess proves an installed Codex host profile or its
effective permissions.

## Technical Context

**Language/Version**: Node.js 22, CommonJS hooks and ESM local CLIs; TypeScript for
existing metrics/health scripts.

**Primary Dependencies**: Node built-ins, existing `tool-targets.cjs`, Vitest, and
the existing persistent-agent-orchestra validation helpers. No package or paid
service dependency will be added.

**Storage**: No product data. An optional operator receipt may be created only
under ignored `output/agent-orchestra/`, using a create-only, path-contained,
symlink-rejecting writer with `0600` permissions. Standard output is the default.

**Testing**: Focused Vitest tests first (RED → scoped implementation → GREEN),
then agent-governance, integrity, policy, and syntax checks. The tests use only
temporary test directories and controlled local child processes.

**Target Platform**: Local Codex repository tooling on macOS, Windows, and Linux;
actual host delivery remains `UNVERIFIED`. Product targets are not modified.

**Project Type**: Repository governance hooks and local CLI tooling in a React/Vite
application repository.

**Performance Goals**: No routine skill-routing hook filesystem mutation; Git-root
resolution bounded to 1.5 seconds and checker execution bounded to 10 seconds
under the existing 20-second outer hook budget; exactly one integrity checker
attempt per event.

**Constraints**:

- Preserve all ten canonical roles and the existing adaptive-routing design.
- Never turn local/self-authored fields, numeric counters, or local receipts into
  `PROMOTABLE` policy evidence.
- Do not read, print, or persist raw user prompts, tool input/output, transcripts,
  secrets, journal data, or local executable paths in receipts or messages.
- A timeout remains blocking; no automatic retry, timeout-to-allow conversion, or
  hidden retry loop is allowed.
- Preserve the existing ignored `.codex-audit.log` file if it exists locally; do
  not delete or read its private contents.

**Scale/Scope**: One isolated worktree; protected hook/scripts/test surfaces;
one new local observation command; no app/native/runtime or remote write surface.

## Constitution Check

`./.specify/scripts/bash/check-zenflow-constitution-status.sh --json` reported
`PROPOSED` before planning. Its proposal-only criteria are informative and do not
become `CRITICAL` authority. Repository `AGENTS.md` remains binding.

| Binding gate | Plan response | Status before implementation |
|---|---|---|
| Protected agent/hook change governance | `AGENT_CHANGE_NOTICE` posted; isolated Codex worktree and rollback by reverting this feature diff | Planned |
| Test-first policy | Each behavior change has a focused failing regression test before its production-tooling patch | Planned |
| Skill routing | Full Spec Kit sequence selected and recorded in a fresh preflight token before protected edits | Planned |
| No-AI-template / best-practices | Grounded source/research decisions, platform matrix, explicit unknowns, no generic or fabricated runtime claim | Planned |
| PDI integrity | PDI diff checker runs after applicable protected-source changes; timeout behavior remains fail-closed | Planned |
| M2 independent closure | Role 10 Pass A was launched, but effective read-only runtime isolation was not demonstrated and it inspected a different legacy `main` root. Its independence is therefore `UNVERIFIED` and cannot close M2 or authorize policy promotion. | STOP for external governance closure; non-blocking for bounded local implementation |

## Research Decisions

The evidence and source links are retained in [research.md](./research.md). The
implementation decisions are:

1. **Default-no-write hook.** Remove all `appendFileSync` audit behavior from
   `skill-router-gate`; safe allow/deny behavior must remain independent of a
   diagnostic destination. Resolve the Git worktree root with a bounded fallback
   so nested cwd token lookup is correct without writing a log.
2. **Explicit local observation.** Add a separate local CLI that invokes a bounded,
   controlled hook subprocess and emits an allowlisted receipt to stdout. `--output`
   is opt-in and only accepts a create-only file under `output/agent-orchestra/`.
3. **Evidence classes stay separate.** The observation contract can assert
   `LOCAL_PROCESS_OBSERVED`; Codex profile loading, effective permissions,
   lifecycle scheduling, token/cost, and platform parity stay `UNVERIFIED`.
4. **No local promotion.** The A/B validator recomputes the retained task-slice
   hash, binds actor identities to execution role identities, records missing
   prerequisites, and rejects `PROMOTABLE` from the local evaluator regardless of
   caller-authored `VERIFIED` fields.
5. **PDI safe timeout.** Set Git-root resolution to 1.5 seconds and child checker
   execution to 10 seconds beneath the existing 20-second outer hook deadline;
   classify a child timeout with a stable, path-free message, leave it blocking,
   and never retry.
6. **Metrics/health honesty.** Replace automatic audit-log parsing with a static
   registration count plus explicit `UNVERIFIED` runtime/effective-permission
   boundary. A local receipt is not host-load evidence.

## Project Structure

```text
.codex/
├── hooks/
│   ├── skill-router-gate.cjs                         # remove hidden audit write; root lookup
│   └── production-data-integrity-gate.cjs            # safe one-shot timeout classification
└── hooks.json                                        # read-only reference; outer timeout stays explicit

scripts/
├── persistent-agent-orchestra/
│   ├── routing-ab-core.mjs                           # task/actor/promotion validation
│   └── governance-observation-core.mjs               # new strict local-receipt model + create-only writer
├── production-data-integrity/
│   └── hook-checker-result.cjs                        # bounded, path-safe child-process classification
├── run-agent-routing-ab-eval.mjs                     # share canonical task-slice identity
├── run-agent-governance-observation.mjs              # new explicit stdout-first observation CLI
├── enforcement-metrics.ts                            # no hidden audit-log parsing
├── check-enforcement-health.ts                       # honest observation boundary
└── __tests__/
    ├── skill-routing-hook-payload.test.ts            # no-write/nested-root regression
    ├── production-data-integrity-hook.test.ts        # safe timeout/no-retry regression
    ├── agent-routing-ab-eval.test.mjs                # self-attestation/task/actor rejection
    ├── agent-governance-observation.test.mjs         # receipt/path/privacy regression
    └── codex-agent-orchestra-integration.test.mjs    # metrics contract update

specs/003-agent-governance-evidence/
├── spec.md
├── plan.md
├── research.md
├── data-model.md
├── quickstart.md
├── contracts/local-observation-receipt.md
├── checklists/governance.md
├── tasks.md
├── analysis.md
└── convergence.md
```

**Structure Decision**: Keep behavior next to the existing governance tooling;
add only one focused core module and one explicit operator CLI. No product module,
native module, generated role source, or service is introduced.

## Design / Test Matrix

| Requirement | Implementation boundary | RED evidence before patch | GREEN evidence after patch |
|---|---|---|---|
| FR-001 | Skill-router hook removes `audit()` and uses canonical root lookup | read-only/unguarded/guarded/block invocation creates no log | same tests show no audit write and correct decision |
| FR-002–005 | New observation core + explicit CLI | stdout has no file side effect; invalid output/host claim fails | valid stdout receipt; safe `--output` creates one private receipt |
| FR-006–010 | A/B core and runner share canonical task identity | mutated task hash, actor mismatch, self-attested promotion validate today | all controls reject/retain non-promotion; role set unchanged |
| FR-011 | Focused test files above | named tests fail for pre-change behavior | named tests pass and are included in focused suite |
| FR-012 | PDI hook bounded classifier | injected timeout/error exposes raw child message or wrong category | timeout blocks once with safe code/manual command; recursion guard stays unchanged |
| FR-013 | Spec/convergence/verification packet | file/path matrix reviewed | diff has no product/native/deploy/role-definition files |
| FR-014 | A/B completed-arm measurement validation | a zero-invocation completed arm validates | the arm is rejected and output hashes remain explicitly local-only evidence |
| FR-015 | A/B cancellation terminal state | an interrupted arm has no valid terminal report | `PILOT_INTERRUPTED` validates only with an interrupted arm and remains non-promotable |

## Platform And Domain Matrix

| Surface | Impact | Verification / boundary |
|---|---|---|
| Web/Vite | N/A | No `src/`, Vite, route, UI, or runtime files in write set |
| Installed PWA | N/A | No manifest, service worker, cache, or browser code changed |
| Android/Capacitor | N/A | No `android/`, Capacitor, safe-area, or native bridge files changed |
| iOS/WKWebView | N/A | No `ios/`, WebView, or native bridge files changed |
| Desktop/Tauri | N/A | No `src-tauri/` or Tauri/runtime code changed |
| Codex host macOS | Indirect governance only | local child-process receipt is not actual host delivery proof: `UNVERIFIED` |
| Codex host Windows/Linux | Indirect governance only | source is cross-platform-shaped; host delivery remains `UNVERIFIED` |
| Security/privacy | In scope | no automatic logs, allowlisted receipt, safe paths, no raw error paths |
| Reliability/operations | In scope | one-shot timeout classification and honest metrics boundary |
| Release/policy promotion | No policy change | local implementation can be verified; routing-policy promotion remains STOP |

## Rollback

Revert only the committed/handed-off Feature 003 diff in this isolated branch. Do
not delete an existing ignored `.codex-audit.log`, output receipt, user work, or
prior Feature 002 artifacts. If the new observation CLI fails, it is an explicit
operator command and must not affect normal hook allow/block decisions.

## Verification Plan

1. Run the named focused tests red before changing production governance code; retain
   exact outcomes in the test-first token.
2. Patch the smallest coherent code paths; re-run the same tests green.
3. Run syntax checks plus `npm run test:agent-orchestra`,
   `npm run check:agent-orchestra`, `npm run check:agent-orchestra:eval`,
   `npm run check:agent-context`, `npm run enforcement:check`,
   `npm run check:no-ai-templates`, `npm run check:best-practices`, and
   `npm run check:production-data-integrity:diff`.
4. Run the narrow local security suite/profile and `npm audit --audit-level=high`;
   authentication/network limits remain `UNVERIFIED` rather than PASS.
5. Review `git diff --check`, full final diff, status, policy write set, and the
   platform/domain matrix. Do not stage, commit, push, merge, deploy, or alter
   user/local artifacts without a new explicit instruction.

## Complexity Tracking

No constitution violation is accepted. The extra core module exists solely to
keep the privacy/path-validation logic independently testable and out of the
routine hook lifecycle.

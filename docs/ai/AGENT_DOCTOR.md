# Agent Doctor

`npm run doctor:agent` is the bounded, read-only health check for ZenFlow's
agent tooling. It aggregates existing authorities; it does not replace their
logic, repair their findings, or authorize an edit, sync, handoff, commit, push,
or release.

## Use it in the correct lane

```sh
# Locked Codex or Kimi edit lane: mode is inferred only from the branch prefix.
npm run doctor:agent

# Clean integration main lane:
npm run doctor:agent -- --mode review

# Explicit diagnostic override:
npm run doctor:agent -- --mode edit --agent codex

# Structured local report:
npm run doctor:agent -- --json
```

Automatic selection is deliberately narrow:

| Branch | Workspace check |
| --- | --- |
| `main` | review mode |
| `codex/<task>` | edit mode for Codex |
| `kimi/<task>` | edit mode for Kimi |
| anything else or detached HEAD | `STOP`; choose an explicit mode and agent |

## Included checks

1. `check:agent-context` — canonical instructions, RAG wiring, and governance
   structure.
2. `check:agent-orchestra` — exact-ten registry and generated-artifact parity.
3. `check:agent-orchestra:eval` — local eval-catalog structure only.
4. `ai:context:check` — bounded startup context query.
5. `ai:context:auto-check` — automatic context composition.
6. `agent:workspace doctor` — current isolated-workspace contract.

Every check is run even after an earlier one stops. The aggregate is `GO` only
when all six exit 0; otherwise it exits 2 and returns `STOP`. Output contains
safe metadata, not raw child-process transcripts. Failure summaries are bounded
and redact credential-like URL user-info and supported token prefixes.

## What a result means

`GO` is local structural evidence, not an assertion that the active Codex
runtime loaded custom profiles or hooks, that sandbox declarations are effective,
or that a qualified human approved the system. It also does not prove Web/PWA,
Android, iOS, Tauri, store, or public-release behavior, because this command has
no shipped application-runtime reachability.

The workspace check intentionally preserves a `STOP` for ignored local paths.
For example, a normal dependency installation can leave `node_modules/` or
Husky-generated files. Inspect that result through
`docs/ai/CODEX_KIMI_WORKSPACE_PROTOCOL.md`; do not delete, suppress, or
auto-repair files merely to turn the doctor green.

## Verification

```sh
npm run test:agent-doctor
npm run test:agent-workspace
```

The focused doctor suite uses Node's built-in test runner and contains no
production data or runtime fixture. The workspace suite retains the literal
reviewed package-script allow path and its existing denial coverage for dynamic
or mutation-capable commands.

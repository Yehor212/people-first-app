# CLI Contract: `doctor:agent`

## Entry point

```text
npm run doctor:agent -- [options]
```

The package entry point is `node scripts/agent-doctor.mjs`.

## Options

| Option | Values | Default | Contract |
| --- | --- | --- | --- |
| `--mode` | `auto`, `review`, `edit` | `auto` | Selects workspace diagnostic intent. |
| `--agent` | `codex`, `kimi` | none | Required only for explicit `--mode edit`; forbidden for explicit review or auto. |
| `--json` | flag | false | Emits one JSON report to stdout. |
| `--help` | flag | false | Emits usage and exits 0 without probes. |

Unknown, duplicate, or incomplete options are invalid. Invalid input emits a
`STOP` report, does not run health probes, and exits 2.

## Automatic workspace selection

| Current branch | Selected workspace probe |
| --- | --- |
| `main` | `doctor --mode review --json` |
| `codex/<task>` | `doctor --mode edit --agent codex --json` |
| `kimi/<task>` | `doctor --mode edit --agent kimi --json` |
| any other or detached branch | invalid automatic configuration, exit 2 |

## JSON output

```json
{
  "schemaVersion": 1,
  "status": "GO",
  "exitCode": 0,
  "configuration": {
    "mode": "edit",
    "agent": "codex",
    "source": "automatic",
    "branch": "codex/example"
  },
  "checks": [
    {
      "id": "agent-context",
      "status": "GO",
      "exitCode": 0,
      "failureKind": null,
      "elapsedMs": 42,
      "summary": "exit 0"
    }
  ],
  "errors": []
}
```

`status` is `GO` only if every planned check returns exit code 0. Every other
outcome is `STOP` with `exitCode: 2`. Text and JSON summaries are redacted and
bounded; child transcripts are not relayed verbatim.

## Non-side-effect contract

The command may execute existing read-only diagnostics only. It must not call
workspace `create`, `sync`, `sync --apply`, `handoff`, Kimi-hook installation,
Git mutation, network publish, repair, or configuration write commands.

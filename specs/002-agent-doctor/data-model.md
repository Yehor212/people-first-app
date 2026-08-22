# Data Model: Agent Doctor

No persistent data model, database table, migration, sync event, or user record
is created.

## In-memory report model

```text
DoctorConfig
  mode: auto | review | edit
  agent: codex | kimi | null
  source: automatic | explicit
  branch: string | null

ProbeDefinition
  id: fixed string
  command: fixed executable
  args: fixed string array
  timeoutMs: positive integer

ProbeResult
  id: fixed string
  status: GO | STOP
  exitCode: integer | null
  failureKind: exit | signal | timeout | spawn-error | invalid-input | null
  elapsedMs: non-negative integer
  summary: redacted, bounded string

DoctorReport
  schemaVersion: 1
  status: GO | STOP
  exitCode: 0 | 2
  configuration: DoctorConfig | null
  checks: ProbeResult[]
  errors: redacted, bounded string[]
```

## Invariants

- `checks` preserves the fixed probe order and contains every planned probe.
- A report has `status: GO` only when every `ProbeResult.status` is `GO`.
- `exitCode` is `0` for `GO` and `2` for `STOP`.
- A failure summary never contains raw credential-like URL user-info or supported
  token prefixes and cannot exceed the documented bound.
- The model is created in memory for one invocation and is never written to disk.

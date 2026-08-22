# Contract: Local Observation Receipt v1

This is a local CLI contract, not a product API and not installed-host evidence.

```json
{
  "schema_version": 1,
  "evidence_class": "LOCAL_PROCESS_OBSERVED",
  "observed_at": "2026-08-04T00:00:00.000Z",
  "repository": {
    "hook_relative_path": ".codex/hooks/skill-router-gate.cjs",
    "hook_sha256": "64-lowercase-hex"
  },
  "observation": {
    "hook_event_name": "PreToolUse",
    "exit_class": "ALLOW|BLOCK|ERROR",
    "primary_decision": "ALLOW|BLOCK|NONE"
  },
  "host_runtime": {
    "custom_profile_loading": "UNVERIFIED",
    "effective_permissions": "UNVERIFIED",
    "lifecycle_delivery": "UNVERIFIED"
  },
  "limitations": ["non-empty bounded text"]
}
```

Validation rules:

1. The exact keys shown above are allowed; unknown keys fail validation.
2. `evidence_class` is fixed to `LOCAL_PROCESS_OBSERVED`.
3. Every `host_runtime` value is fixed to `UNVERIFIED`; an input payload cannot
   change it to `VERIFIED`.
4. No input, prompt, command, path outside `repository.hook_relative_path`, raw
   stdout/stderr, actor transcript, secret, or token field exists in this schema.
5. `--output` is optional; when supplied it must be a safe new relative path under
   `output/agent-orchestra/` and receive a `0600`, create-only file.
6. A valid local receipt is admissible only as a local-process observation. It
   cannot change a routing A/B decision to `PROMOTABLE`.

CLI surface:

```text
node scripts/run-agent-governance-observation.mjs
node scripts/run-agent-governance-observation.mjs --output output/agent-orchestra/<new-name>.json
```

The command uses a fixed controlled event and no user-supplied hook payload. Any
output-write error returns nonzero after the local observation, but never changes
the behavior of the independently executed hook.

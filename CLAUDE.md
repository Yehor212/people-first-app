@AGENTS.md

# Claude Code Deltas

- This file is intentionally a thin tracked bridge. Keep durable project instructions in `AGENTS.md`.
- Claude-specific local preferences belong in ignored `CLAUDE.local.md`.
- Claude hooks and rules live under `.claude/`; verify hook/context changes with `npm run ai:context:auto-check` and the narrow hook tests that apply.
- Claude protected-file edits use `.claude-md-unlock`; Codex protected-file edits use `.Codex-md-unlock`.
- Do not duplicate architecture counts, CI matrices, or safety rules here; update `AGENTS.md` or the tracked `docs/ai/**` source instead.

@AGENTS.md

# Claude Code Deltas

- This file is intentionally a thin tracked bridge. Keep durable project instructions in `AGENTS.md`.
- Claude-specific local preferences belong in ignored `CLAUDE.local.md`.
- This bridge is not an active role source. The canonical project roles are generated for Codex from `config/persistent-agent-orchestra.json`.
- Verify agent-context changes with `npm run check:agent-orchestra`, `npm run check:agent-context`, and `npm run ai:context:auto-check`.
- Do not duplicate architecture counts, CI matrices, or safety rules here; update `AGENTS.md` or the tracked `docs/ai/**` source instead.

@AGENTS.md

# Claude Code Deltas

- This file is intentionally a thin tracked bridge. Keep durable project instructions in `AGENTS.md`.
- Claude-specific local preferences belong in ignored `CLAUDE.local.md`.
- This bridge is not an active role source. ZenFlow installs no project custom agent profiles and defaults to SOLO execution.
- Verify agent-context changes with `npm run check:solo-agent-governance`, `npm run check:agent-context`, and `npm run ai:context:auto-check`.
- Do not duplicate architecture counts, CI matrices, or safety rules here; update `AGENTS.md` or the tracked `docs/ai/**` source instead.

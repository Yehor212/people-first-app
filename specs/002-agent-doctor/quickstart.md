# Quickstart: Agent Doctor

From an isolated Codex lane:

```sh
npm run doctor:agent
```

From a clean integration `main` lane:

```sh
npm run doctor:agent -- --mode review
```

For machine-readable output:

```sh
npm run doctor:agent -- --json
```

For the focused implementation checks:

```sh
npm run test:agent-doctor
npm run test:agent-workspace
```

Interpretation:

- `GO` means every included local structural probe exited 0.
- `STOP` names the failing probe and preserves its local diagnostic boundary.
- A workspace `STOP` caused by ignored local state is intentionally retained;
  inspect it rather than deleting or suppressing files automatically.
- Neither result proves real Codex profile loading, effective sandbox permissions,
  human review, Windows/Linux host behavior, app platform parity, or release
  readiness.

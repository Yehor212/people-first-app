# ZenFlow Agent Guide

## Snyk Security At Inception

- Always run the `snyk_code_scan` tool for new first-party code in a Snyk-supported language when that tool is available.
- If Snyk reports issues in newly introduced or modified code or dependencies, fix them and rescan.
- If the Snyk MCP tool is unavailable, use the local Snyk CLI fallback documented below and report any auth/network blocker as `UNVERIFIED`, not `PASS`.

## Stack

Capacitor 8 + React 18 + TypeScript + Vite + Tailwind + shadcn/ui.
Zustand, Dexie/IndexedDB, Supabase, Firebase, Sentry, AdMob, and custom i18n.
Supported languages: en, uk, es, de, fr, ja, ar, he. Treat ar/he as RTL risk.
Supported platforms: Web/Vite, PWA, Android/Capacitor, iOS/WKWebView, Desktop/Tauri.

## Architecture

- Read `ARCHITECTURE.md` before code changes; it is the single source of truth for app structure and live counts.
- Do not hand-edit generated count blocks in `ARCHITECTURE.md`; use `npm run doc-counts:update`.
- Current architecture: `src/pages/Index.tsx` orchestrates app shell; runtime state uses 8 Zustand stores plus 2 hydrate bridges; IndexedDB is the local source of truth.
- Modal rendering goes through `ModalLayer` and `OverlayLayer`.
- Feature-module target is documented in `ARCHITECTURE.md`; only migrate features when the task explicitly justifies it.

## Agent Entry Points

- `AGENTS.md` is the canonical tracked instruction file for Codex and other agents that support it.
- `CLAUDE.md` must stay a thin tracked bridge that imports `AGENTS.md` and contains only Claude-specific deltas.
- Local/private notes belong in ignored files such as `CLAUDE.local.md`, not in tracked agent instructions.
- Repo-local context packs are documented in `docs/ai/AGENT_CONTEXT_PERSISTENCE.md` and served by `tools/zenflow-context/server.mjs`.
- Verify agent context health with `npm run check:agent-context`, `npm run ai:context:check`, and `npm run ai:context:auto-check`.

## Ruflow+ And Work Mode

- For substantial work, use the tracked source of truth in `docs/ai/RUFLOW_PLUS_BLUEPRINT.md`.
- Use `docs/ai/PREFLIGHT_OPERATOR_TEMPLATE.md` for visible evidence-backed preflight artifacts.
- For radical or protected-surface changes, read `docs/ai/AGENT_CHANGE_GOVERNANCE.md` and emit an `AGENT_CHANGE_NOTICE` before editing.
- Simple 1-3 file tasks can stay solo.
- Medium 4-10 file or 2+ domain tasks use a small guided team or guardian review.
- Complex audits, architecture changes, enforcement changes, and 10+ file work use Ruflow+/Teamlead discipline.
- Every specialist output must include evidence, platform/domain impact, verification, unresolved risk, and `GO / STOP / ASK`.

## Agent Change Governance

- A radical change is any broad rewrite, visible-system replacement, route/shell change, storage/sync/auth/privacy change, native/platform change, dependency/security/CI/hook change, or docs/prompt change that alters how future agents work.
- Before such work, post an `AGENT_CHANGE_NOTICE` with risk level, trigger, current behavior evidence, proposed write set, platform/domain impact, rollback, verification, and `GO / ASK / STOP`.
- User requests for narrow bug fixes do not authorize redesigns, visual replacements, data migrations, or weakened guards unless the user explicitly approves that scope.
- Treat `AGENTS.md`, `ARCHITECTURE.md`, `docs/ai/**`, `.github/**`, `.claude/**`, `.codex/**`, `.Codex/**`, `.agents/**`, `scripts/**`, storage/sync/auth/privacy, native folders, service worker/PWA, and canonical orb files as protected surfaces.
- For architecture/refactor claims, stale `doc-counts` or `constitution:check` output is a STOP/UNVERIFIED condition until refreshed or explicitly waived.
- For public, runtime, sync, security, visual, or cross-platform claims, use fresh command/browser/CI evidence and mark unknowns `UNVERIFIED`; never cite old CI, memory, or subagent summaries as PASS by themselves.

## Conventions

- Use theme tokens for colors; do not add hardcoded colors.
- Touch targets must be at least 44px and safe areas must be respected.
- Z-index rules: nav `z-50`, modals at least `z-[60]`.
- Use `-webkit-backdrop-filter` with backdrop blur for cross-platform support.
- No direct `localStorage`; use the repo storage helpers.
- No silent `.catch(() => {})`; failures need logging, user feedback, or explicit rationale.
- Android back handling is required for all modals.
- Preserve existing architecture and local patterns before introducing new abstractions.

## Runtime And Visual Invariants

- Read `docs/ai/TELEGRAM_GRADE_RUNTIME_CONTRACT.md` before startup, performance, sync, navigation, service worker, WebGL/canvas, IndexedDB/Dexie, Supabase, offline queue, app lifecycle, or cross-platform flow changes.
- The canonical state-of-mind orb family is frozen. Full surfaces use `ValenceOrb`; compact surfaces use `MiniValenceOrb`.
- Run `npm run check:canonical-orbs` for orb or visual runtime changes.
- Do not replace premium visuals with cheaper approximations to make performance metrics pass.
- UI, motion, layout, style, and accessibility changes require visual-audit coverage and proof appropriate to the risk.

## Safety

- Supabase: use MCP tools before raw SQL. `profiles` has no `email` column. A broken `handle_new_user()` breaks all signups.
- Deletion tracker IDs are permanent; never reuse them.
- Pull before push in sync operations.
- Never commit or push law docs: `docs/law*.md`, `docs/laws*.md`, `docs/visual-aesthetic.md`.
- Do not expose secrets, tokens, local MCP credentials, user journal content, habit data, or unnecessary PII.
- Do not read or print raw `.mcp.json`; inspect only redacted server names/config shape when absolutely necessary.
- `.mcp.json` is local and ignored. Examples must use placeholders or environment variables only.
- `AGENTS.md` and `.Codex/settings.json` are protected; create `.Codex-md-unlock` only for an authorized edit and remove it afterward.

## CI And Verification

- `npm run check:all` = typecheck, lint, i18n checks, color check, visual checks.
- `npm run ci:preflight` is the broad local release gate.
- Lightweight freshness checks: `npm run doc-counts`, `npm run check:types-fresh`, `npm run check:supabase-migration-prefixes`.
- Agent guidance checks: `npm run check:agent-context`, `npm run ai:ruflow-plus:check`, `npm run ai:context:check`, `npm run ai:context:auto-check`.
- Runtime/performance proof for startup, orb, sync, or cross-platform flows defaults to `npm run check:canonical-orbs`, `npm run check:all`, and `npm run smoke:chrome-performance`.
- Sync/account proof uses `npm run check:sync-contract`; add sync smoke scripts when making same-account or public sync claims.
- If native PowerShell/npm is flaky, retry repo scripts with `cmd /c npm run <script>` before treating the script as broken.
- Never cite old CI or test output as current evidence; rerun the relevant command.

## Snyk And Security Fallback

- Preferred: use `snyk_code_scan` when the MCP tool is callable.
- Fallback: run local Snyk CLI against a tracked-file-only scan copy or a scoped safe path, for example `snyk code test --json-file-output=output/snyk-code-YYYYMMDD.json <path>`.
- Run `npm audit --audit-level=high` when dependencies or security-sensitive code are touched.
- Treat scanner output as evidence, not a substitute for threat modeling.

## Obsidian Vault

- Vault path: `C:\project\Zenflow\`.
- Write incident, ADR, lesson, security, or pattern notes only when the local REST API is reachable and the task justifies durable writeback.
- Use `process.env.OBSIDIAN_API_KEY` or the existing vault context helper; never print the key.
- If Obsidian is unreachable, skip silently and do not block engineering work.

## Commit Pipeline

- Read `memory/feedback_commit_pipeline_knowledge.md` before the first commit when committing is requested.
- `.verification-done` evidence must include test counts.
- Put `confidence` and `git_history_checked` inside `self_reflection`.
- `tools_skipped[]` entries use `name` and `reason`.
- Use single-quoted commit messages.
- For more than 7 files, include the word `batch` in the commit message.
- Run `tsc` and `vitest` separately so the CI tracker records both.

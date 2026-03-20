# ZenFlow — Project Guide

## Stack

Capacitor 8 + React 18 + TypeScript + Vite + Tailwind + shadcn/ui
Zustand (4 stores) + Dexie (IndexedDB) + Supabase + Firebase
i18n: 8 languages (en, uk, es, de, fr, ja, ar, he)

## Architecture

Read ARCHITECTURE.md before any code changes. It is the single source of truth.
Index.tsx = orchestrator. 6 TabTypes, 5 visible. 4 Zustand stores + IndexedDB.
56 hooks in src/hooks/. ModalLayer + OverlayLayer for modals.

## Conventions

- All colors via theme tokens, zero hardcoded colors
- Touch targets >= 44px, safe areas respected
- Z-index: modals >= z-[60], nav = z-50
- `-webkit-backdrop-filter` for cross-platform blur
- No direct localStorage, no silent `.catch(() => {})`
- Android back handler required on all modals

## Enforcement

Mechanical hooks in `.claude/hooks/` enforce quality gates at framework level (27 hooks, 5 blocking + 22 advisory).
Domain-specific rules in `.claude/rules/` load per file context (12 rule files).
Lifecycle: session-start → preflight-inject → protected-files + preflight-gate → edit → ide-diagnostic-gate (+ postflight invalidation) + auto-format → quality-stop-gate → commit-gate (8 layers) → push → pre-compact.
Token files (`.preflight-token`, `.postflight-done`, `.fullcycle-active`, `.fullcycle-laws-read`, `.claude-md-unlock`) are gitignored, one-time, consumed after use.
SDK architecture: hooks use stdin JSON (not env vars). Security hooks fail-closed (exit 2). Audit log: `.claude-audit.log`.
Self-tampering defense: CLAUDE.md and `.claude/settings.json` require `.claude-md-unlock` token for edits (AAI006).

## Safety

- Supabase: use MCP tools BEFORE raw SQL. `profiles` has NO `email` column. `handle_new_user()` failure = ALL signups break
- Deletion tracker IDs are permanent, never reuse
- Pull BEFORE push in sync operations
- Never commit/push law docs (`docs/law*.md`, `docs/visual-aesthetic.md`)
- iOS/Android/Desktop must be equal (Law 10)

## CI

`npm run ci:preflight` = eslint (zero warnings) → tsc → i18n:check → vitest → vite build → ratchet:check
Quality floor enforced by Ratchet Law (Law 27) — can only go up, never down.

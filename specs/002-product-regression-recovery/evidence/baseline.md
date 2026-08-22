# Baseline Evidence: Epic 002

**Captured**: 2026-08-03
**Worktree**: `/Users/yehor/Projects/ZenFlow/worktrees/codex-product-regression-recovery`
**Branch**: `codex/002-product-regression-recovery`
**HEAD**: `13ca51a80d23220574deba762851fe5a32372e46`
**Fetched `origin/main`**: `13ca51a80d23220574deba762851fe5a32372e46`
**Isolation**: External locked worktree; control clone at `/Users/yehor/Projects/ZenFlow/people-first-app-control-002`; no stash or 898-file snapshot restored.

## Toolchain

| Tool | Fresh result |
| --- | --- |
| Node | `v22.22.0` |
| npm | `10.9.4` |
| Specify CLI | `0.15.1`, Python 3.12.13, Darwin arm64 |
| Git | `2.50.1 (Apple Git-155)` |
| Host kernel | Darwin 25.5.0 arm64 |

## Setup

| Command | Status | Evidence boundary |
| --- | --- | --- |
| `npm ci` | VERIFIED | 1080 packages installed from `package-lock.json`; postinstall patches applied; npm audit summary reported 0 vulnerabilities |
| `npm run rag:preflight -- "Epic 002 ..."` | VERIFIED | Task hash `a26c14973f978f954471a8b0324d023d9d742a8fad34df0e2d12bb923debdd74`; groups `agent_rules`, `coach_journal`; generated ignored local context only |
| `git fetch origin main --prune` | VERIFIED | `HEAD` and fetched `origin/main` matched the SHA above |

## Current-code baseline

| Command | Fresh result | Scope |
| --- | --- | --- |
| Focused Vitest: seven journal/feature/ceremony files | VERIFIED: 7 files, 167 tests passed | Existing behavior only; expected provider-negative tests emitted jsdom error text but suite exit was 0 |
| `npm run check:sync-contract` | VERIFIED: 409 invariants | Static sync-contract scope only |
| `npm run check:types-fresh` | VERIFIED | Generated types were current against migration `20260714120403_journal_cloud_write_integrity.sql` |
| `npm run check:production-data-integrity:diff` | VERIFIED: errors 0, warnings 0, scanned 1865, reachable 783 | Current documentation-only diff; not a bundle or staged proof |
| `npm run check:no-ai-templates` | VERIFIED | Agent/policy wiring scope; scanner does not independently prove all Epic prose quality |
| `npm run doc-counts` | VERIFIED | 76 hooks, 9 stores, `Index.tsx` 278 LOC |

## Baseline limitations

No new Epic contract test had been added at this capture, so this is not RED evidence. Exact real-journal blocker, live Supabase cleanup, browser post-fix behavior, public deployment, physical Android/iOS, native assistive technology, Windows/Tauri runtime, and ceremony artistic/user approval remain `UNVERIFIED`.

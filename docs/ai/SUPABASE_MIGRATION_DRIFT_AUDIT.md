# Supabase Migration Drift Audit

Date: 2026-05-25
Branch: `codex/closure-cleanup`

## Scope

This audit closes the current actionable Supabase drift without `supabase db push`
or historical mass-apply. The rule used here is conservative:

- duplicate-prefix legacy migrations are documented only, not repaired;
- unique local-only migrations are repaired only when live remote schema proves
  the effects already exist;
- when required objects are missing, create and apply a new timestamped
  idempotent reconciliation migration, then repair only the proven history rows.

Supabase MCP tools were searched for in this Codex session but no Supabase MCP
SQL/docs tool was exposed, so verification used Supabase CLI v2.101.0 with
read-only SQL first. Current Supabase docs were refreshed from
`https://supabase.com/changelog.md`, `https://supabase.com/docs/guides/realtime/authorization.md`,
and `https://supabase.com/docs/guides/realtime/broadcast.md`.

## Commands And Evidence

| Check | Evidence |
| --- | --- |
| CLI version | `cmd /c npx supabase --version` -> `2.101.0` |
| Pre-repair drift | `cmd /c npx supabase migration list --linked` showed `20260417` and `20260505053700` as unique local-only rows, plus legacy duplicate-prefix local-only rows |
| `20260417` proof | Live SQL found `public.design_flags` row `design.nav.v2` with `enabled=false`, `rollout_percent=0`, `killswitch=true` |
| `20260505053700` proof before reconciliation | Live SQL found missing `habit_completions` semantic columns, constraints, and index |
| New reconciliation | `supabase/migrations/20260525225407_reconcile_habit_completion_entry_semantics.sql` was created and applied with `cmd /c npx supabase db query --linked --file ...` |
| Function privilege hardening | `supabase/migrations/20260525230508_revoke_weekly_summary_public_execute.sql` was created after CodeRabbit review and applied with `cmd /c npx supabase db query --linked --file ...` |
| Stats RPC hardening | `supabase/migrations/20260525231436_harden_get_user_stats_auth_null_check.sql` was created after CodeRabbit review and applied with `cmd /c npx supabase db query --linked --file ...` |
| Generated type alignment | `supabase/migrations/20260526000416_sync_events_seq_default_for_generated_types.sql` was created so generated Supabase Insert types keep `sync_events.seq` optional while the trigger remains the ordering authority |
| Migration repair | `cmd /c npx supabase migration repair --linked --status applied 20260417`, `20260525225407`, `20260505053700`, `20260525230508`, `20260525231436`, and `20260526000416` after schema convergence proof |
| Post-repair schema proof | Live SQL found semantic columns, check constraints, `idx_habit_completions_user_date_complete`, and `get_user_stats` / `get_user_weekly_summary` containing `is_complete = true` |
| Function privilege proof | Live SQL returned `stats_has_null_check=true`, `stats_public_execute=false`, `stats_authenticated_execute=true`, `weekly_public_execute=false`, and `weekly_authenticated_execute=true` |
| Realtime private signal proof | Live SQL found RLS enabled on `realtime.messages` with authenticated SELECT/INSERT policies limited to `sync-signal:<auth.uid()>` and `extension='broadcast'` |
| Sync RLS proof | Live SQL found RLS enabled on `sync_events`, `sync_tombstones`, and `device_sessions` with own-user authenticated policies |

## Repaired Unique Rows

| Version | Action | Reason |
| --- | --- | --- |
| `20260417` | Marked applied with migration repair | Remote already had the `design.nav.v2` flag row created by the local migration |
| `20260505053700` | Marked applied after reconciliation | Remote did not initially have the schema effects; new migration `20260525225407` applied the idempotent equivalent first |
| `20260525225407` | Created, applied, and marked applied | New timestamped reconciliation migration for habit completion entry semantics |
| `20260525230508` | Created, applied, and marked applied | Revoked default PUBLIC execute on `get_user_weekly_summary(date)` after CodeRabbit review |
| `20260525231436` | Created, applied, and marked applied | Added explicit `auth.uid()` NULL guard and PUBLIC revoke proof for `get_user_stats(uuid)` after CodeRabbit review |
| `20260526000416` | Created, applied, and marked applied | Added a harmless `sync_events.seq DEFAULT 0` so generated Insert types do not require clients to send server-owned sequence values |

## Remaining Historical Rows

These rows remain intentionally unrepaired. The duplicate-prefix groups cannot be
safely represented by Supabase migration history because the same version maps
to multiple local files; marking a version would not identify which file was
actually represented. The early non-timestamp rows are also broad historical
bootstrap migrations and were not repaired without a full object-by-object
remote proof.

| Local row | Status | Reason |
| --- | --- | --- |
| `001_initial_schema.sql` | Unrepaired | Broad legacy bootstrap row; not in scoped repair |
| `002_user_backups_safe.sql` | Unrepaired | Broad legacy row; not in scoped repair |
| `20260113_*` duplicate group | Unrepaired | Duplicate prefix group |
| `20260125_*` duplicate group | Unrepaired | Duplicate prefix group |
| `20260201_*` duplicate group | Unrepaired | Duplicate prefix group |
| `20260203_*` duplicate group | Unrepaired | Duplicate prefix group |
| `20260215_*` duplicate group | Unrepaired | Duplicate prefix group |
| `20260307_*` duplicate group | Unrepaired | Duplicate prefix group |
| `20260311_*` duplicate group | Unrepaired | Duplicate prefix group |
| `20260314_*` duplicate group | Unrepaired | Duplicate prefix group |

## Runtime Contract Notes

- `sync_events.seq` remains the durable ordering authority.
- `trg_assign_sync_seq` still overwrites `NEW.seq` before insert; the default
  exists only to align generated client types with trigger-owned sequencing.
- Supabase Broadcast remains a private wake signal only; entity payloads are not
  sourced from Realtime.
- `device_sessions` remains privacy-safe sync presence and soft revoke only; it
  is not Auth-token revocation.
- No OpenAI, Twilio, Temporal, Cloudflare, MarcoPolo, worker layer, or new sync
  dependency was added.

## Rollback

Code rollback is a normal revert of this branch's migration and lockfile commit.
Live database rollback should be DBA-led because the reconciliation added
backward-compatible columns and replaced functions. The safe operational path is
to leave the additive columns in place, revert application code if needed, and
only drop columns/functions after confirming no deployed client version reads
them.

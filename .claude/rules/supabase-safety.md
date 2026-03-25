---
description: Supabase safety rules — applies to supabase/**, migrations, edge functions
---

# Supabase Safety Rules

- Use MCP tools (execute_sql, list_tables) BEFORE writing raw SQL — verify schema first
- `profiles` table: access email via `auth.users` only — the `profiles` table stores profile data exclusively
- `handle_new_user()` trigger is critical path — failure breaks ALL signups. Test changes on branch first
- Create new migration files only — treat existing migrations as immutable
- Include rollback strategy in migration comments
- Test migrations on Supabase branch (`create_branch` → `execute_sql` → verify → `merge_branch`) before applying to production
- Edge functions: always import from `_shared/` for common auth/validation logic
- Past incidents documented in memory/supabase-lessons.md — read before Supabase changes

## Cron + Edge Functions (Incident: 96 x 401 errors, Mar 2026)

- Edge functions with `verify_jwt=true` reject requests at GATEWAY level BEFORE function code runs
- Cron jobs calling edge functions MUST include `Authorization: Bearer <service_role_key>` header
- Use the Authorization header exclusively — gateway validates only the Authorization header (custom headers like X-Cron-Secret are ignored at gateway level)
- Service role key: store in `vault.decrypted_secrets` as `service_role_key`, reference via subquery
- Pattern: `'Authorization', 'Bearer ' || (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'service_role_key' LIMIT 1)`
- After creating/modifying cron→edge function: VERIFY in Supabase Dashboard → Edge Functions → Logs within 15 min

---
description: Supabase safety rules — applies to supabase/**, migrations, edge functions
---

# Supabase Safety Rules

- Use MCP tools (execute_sql, list_tables) BEFORE writing raw SQL — verify schema first
- `profiles` table has NO `email` column — auth.users has it, not profiles
- `handle_new_user()` trigger is critical path — failure breaks ALL signups. Test changes on branch first
- Never modify existing migration files — create new migrations only
- Include rollback strategy in migration comments
- Test migrations on Supabase branch (`create_branch` → `execute_sql` → verify → `merge_branch`) before applying to production
- Edge functions: always import from `_shared/` for common auth/validation logic
- Past incidents documented in memory/supabase-lessons.md — read before Supabase changes

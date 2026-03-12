-- ==========================================================================
-- Migration: Fix user_reminder_settings + user_inner_world
-- Date: 2026-03-11
-- Problem: Production 400 on POST /rest/v1/user_reminder_settings
--          user_inner_world never had CREATE TABLE in any migration
-- Strategy: Idempotent — safe to run on any production state
-- ==========================================================================

-- ============================================
-- 1. USER REMINDER SETTINGS
-- ============================================

-- 1a. Create table if it doesn't exist at all
CREATE TABLE IF NOT EXISTS public.user_reminder_settings (
  user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  enabled BOOLEAN NOT NULL DEFAULT FALSE,
  mood_time TEXT,
  mood_time_morning TEXT,
  mood_time_afternoon TEXT,
  mood_time_evening TEXT,
  habit_time TEXT,
  focus_time TEXT,
  days INT[] NOT NULL DEFAULT '{}',
  quiet_start TEXT,
  quiet_end TEXT,
  habit_ids TEXT[] NOT NULL DEFAULT '{}',
  timezone TEXT,
  language TEXT,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 1b. Ensure all columns exist (handles table created from older schema)
ALTER TABLE public.user_reminder_settings ADD COLUMN IF NOT EXISTS mood_time TEXT;
ALTER TABLE public.user_reminder_settings ADD COLUMN IF NOT EXISTS mood_time_morning TEXT;
ALTER TABLE public.user_reminder_settings ADD COLUMN IF NOT EXISTS mood_time_afternoon TEXT;
ALTER TABLE public.user_reminder_settings ADD COLUMN IF NOT EXISTS mood_time_evening TEXT;
ALTER TABLE public.user_reminder_settings ADD COLUMN IF NOT EXISTS habit_time TEXT;
ALTER TABLE public.user_reminder_settings ADD COLUMN IF NOT EXISTS focus_time TEXT;
ALTER TABLE public.user_reminder_settings ADD COLUMN IF NOT EXISTS quiet_start TEXT;
ALTER TABLE public.user_reminder_settings ADD COLUMN IF NOT EXISTS quiet_end TEXT;
ALTER TABLE public.user_reminder_settings ADD COLUMN IF NOT EXISTS timezone TEXT;
ALTER TABLE public.user_reminder_settings ADD COLUMN IF NOT EXISTS language TEXT;

-- 1c. Enable RLS
ALTER TABLE public.user_reminder_settings ENABLE ROW LEVEL SECURITY;

-- 1d. Drop ALL known policy names from migration history
--     Source: supabase/sql/user_reminder_settings.sql
DROP POLICY IF EXISTS "Users can read own reminder settings" ON public.user_reminder_settings;
DROP POLICY IF EXISTS "Users can upsert own reminder settings" ON public.user_reminder_settings;
--     Source: 20260204_optimize_rls_policies.sql
DROP POLICY IF EXISTS "Users can manage own settings" ON public.user_reminder_settings;
DROP POLICY IF EXISTS "user_reminder_settings_select" ON public.user_reminder_settings;
DROP POLICY IF EXISTS "user_reminder_settings_insert" ON public.user_reminder_settings;
DROP POLICY IF EXISTS "user_reminder_settings_update" ON public.user_reminder_settings;
DROP POLICY IF EXISTS "user_reminder_settings_delete" ON public.user_reminder_settings;
--     Source: 20260307_push_tables.sql / this migration
DROP POLICY IF EXISTS "user_reminder_settings_all" ON public.user_reminder_settings;

-- 1e. Create single consolidated policy with (SELECT auth.uid()) for performance
--     (SELECT auth.uid()) is evaluated once per statement vs auth.uid() per row
--     Pattern from: 20260204_optimize_rls_policies.sql:280-288
CREATE POLICY "user_reminder_settings_all"
  ON public.user_reminder_settings
  FOR ALL
  USING (user_id = (SELECT auth.uid()))
  WITH CHECK (user_id = (SELECT auth.uid()));

-- 1f. Index: send-scheduled-push Edge Function queries WHERE enabled = true
--     Partial index — only indexes enabled rows, minimal storage overhead
CREATE INDEX IF NOT EXISTS idx_reminder_settings_enabled
  ON public.user_reminder_settings (enabled)
  WHERE enabled = true;

-- 1g. Index: updated_at for sync ordering
CREATE INDEX IF NOT EXISTS idx_reminder_settings_updated_at
  ON public.user_reminder_settings (updated_at);

-- 1h. PostgREST API documentation via COMMENT ON
COMMENT ON TABLE public.user_reminder_settings
  IS 'Per-user push notification schedule and preferences. One row per user.';
COMMENT ON COLUMN public.user_reminder_settings.enabled
  IS 'Master toggle for all push notifications. Queried by send-scheduled-push Edge Function.';
COMMENT ON COLUMN public.user_reminder_settings.days
  IS 'Array of ISO weekday numbers (1=Monday..7=Sunday) when notifications are active.';
COMMENT ON COLUMN public.user_reminder_settings.habit_ids
  IS 'Array of habit IDs the user wants reminders for. Empty = no habit reminders.';
COMMENT ON COLUMN public.user_reminder_settings.timezone
  IS 'IANA timezone string (e.g. Europe/Kyiv). Used by Edge Function to schedule at local time.';

-- ============================================
-- 2. USER INNER WORLD
-- ============================================

-- 2a. Create table — was missing from ALL migration files
--     Referenced by: innerWorldCloudSync.ts, 20260204 (RLS), 20260205 (realtime removal)
CREATE TABLE IF NOT EXISTS public.user_inner_world (
  user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  world_data JSONB NOT NULL DEFAULT '{}',
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 2b. Enable RLS
ALTER TABLE public.user_inner_world ENABLE ROW LEVEL SECURITY;

-- 2c. Drop ALL known policy names from migration history
--     Source: 20260204_optimize_rls_policies.sql
DROP POLICY IF EXISTS "Users can manage own inner world" ON public.user_inner_world;
DROP POLICY IF EXISTS "Users can view own inner world" ON public.user_inner_world;
DROP POLICY IF EXISTS "Users can insert own inner world" ON public.user_inner_world;
DROP POLICY IF EXISTS "Users can update own inner world" ON public.user_inner_world;
--     Source: 20260204 consolidated / this migration
DROP POLICY IF EXISTS "user_inner_world_all" ON public.user_inner_world;

-- 2d. Create single consolidated policy with (SELECT auth.uid()) for performance
CREATE POLICY "user_inner_world_all"
  ON public.user_inner_world
  FOR ALL
  USING (user_id = (SELECT auth.uid()))
  WITH CHECK (user_id = (SELECT auth.uid()));

-- 2e. Index: updated_at for sync ordering
CREATE INDEX IF NOT EXISTS idx_inner_world_updated_at
  ON public.user_inner_world (updated_at);

-- 2f. PostgREST API documentation via COMMENT ON
COMMENT ON TABLE public.user_inner_world
  IS 'Per-user gamification state (treats, plants, creatures, companion, streaks). One JSONB blob per user.';
COMMENT ON COLUMN public.user_inner_world.world_data
  IS 'Complete InnerWorld JSON: treats, plants, creatures, companion, weather, streaks, daysActive.';

-- ============================================
-- 3. RELOAD POSTGREST SCHEMA CACHE
-- ============================================
-- Critical: without this, PostgREST may not recognize new tables/columns/indexes
-- until the next automatic reload (which can take minutes)
NOTIFY pgrst, 'reload schema';

-- ============================================
-- 4. DIAGNOSTIC QUERIES (uncomment to verify)
-- ============================================
-- SELECT table_name FROM information_schema.tables
--   WHERE table_name IN ('user_reminder_settings', 'user_inner_world');
--
-- SELECT column_name, data_type, column_default
--   FROM information_schema.columns
--   WHERE table_name = 'user_reminder_settings'
--   ORDER BY ordinal_position;
--
-- SELECT policyname, cmd, qual, with_check
--   FROM pg_policies
--   WHERE tablename IN ('user_reminder_settings', 'user_inner_world');
--
-- SELECT indexname, indexdef
--   FROM pg_indexes
--   WHERE tablename IN ('user_reminder_settings', 'user_inner_world');

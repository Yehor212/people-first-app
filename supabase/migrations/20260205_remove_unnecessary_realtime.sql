-- =============================================
-- Migration: Remove Unnecessary Realtime Subscriptions
-- Created: 2026-02-05
-- Description: Optimize query performance by removing tables from
--   supabase_realtime publication. WAL query was consuming 96% of
--   database time due to too many realtime subscriptions.
--
-- KEEP: friend_challenge_members (needed for live leaderboard)
-- REMOVE: All other tables (data syncs on app resume instead)
-- =============================================

-- Remove tables from realtime publication if they exist
-- This reduces WAL processing overhead significantly

DO $$
DECLARE
  tables_to_remove TEXT[] := ARRAY[
    'moods',
    'habits',
    'habit_completions',
    'habit_reminders',
    'focus_sessions',
    'gratitude_entries',
    'user_challenges',
    'user_badges',
    'user_tasks',
    'user_quests',
    'user_inner_world',
    'user_settings',
    'user_stats',
    'user_data',
    'user_backups',
    'user_reminder_settings',
    'leaderboards',
    'push_subscriptions',
    'push_logs',
    'push_device_tokens',
    'profiles',
    'challenges',
    'badges',
    'adhd_state',
    'mystery_boxes',
    'time_challenges',
    'analytics_events'
  ];
  tbl TEXT;
BEGIN
  FOREACH tbl IN ARRAY tables_to_remove
  LOOP
    -- Check if table is in the publication before trying to remove
    IF EXISTS (
      SELECT 1 FROM pg_publication_tables
      WHERE pubname = 'supabase_realtime'
        AND schemaname = 'public'
        AND tablename = tbl
    ) THEN
      EXECUTE format('ALTER PUBLICATION supabase_realtime DROP TABLE public.%I', tbl);
      RAISE NOTICE 'Removed % from supabase_realtime publication', tbl;
    END IF;
  END LOOP;
END $$;

-- =============================================
-- VERIFICATION (run after migration)
-- =============================================
-- Check which tables remain in the realtime publication:
--
-- SELECT tablename
-- FROM pg_publication_tables
-- WHERE pubname = 'supabase_realtime'
--   AND schemaname = 'public';
--
-- Expected: Only 'friend_challenge_members' (and maybe 'friend_challenges')

-- =============================================
-- ROLLBACK (if needed)
-- =============================================
-- To re-add a table to realtime:
-- ALTER PUBLICATION supabase_realtime ADD TABLE public.table_name;

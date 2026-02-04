-- =============================================
-- Migration: Optimize RLS Policies for Performance
-- Created: 2026-02-04
-- Description: Fix 221 performance issues:
--   1. Replace auth.uid() with (select auth.uid()) - evaluated once per query
--   2. Remove duplicate policies (keep one per table/action)
--   3. Remove duplicate indexes
-- =============================================

-- =============================================
-- SECTION 1: Drop ALL existing policies on affected tables
-- We'll recreate them with optimized syntax
-- =============================================

-- profiles
DROP POLICY IF EXISTS "Users can view own profile" ON public.profiles;
DROP POLICY IF EXISTS "Users can update own profile" ON public.profiles;
DROP POLICY IF EXISTS "Users can insert own profile" ON public.profiles;

-- moods
DROP POLICY IF EXISTS "Users can CRUD own moods" ON public.moods;

-- habits
DROP POLICY IF EXISTS "Users can CRUD own habits" ON public.habits;

-- habit_completions
DROP POLICY IF EXISTS "Users can CRUD own habit completions" ON public.habit_completions;

-- habit_reminders
DROP POLICY IF EXISTS "Users can CRUD own habit reminders" ON public.habit_reminders;

-- focus_sessions
DROP POLICY IF EXISTS "Users can CRUD own focus sessions" ON public.focus_sessions;

-- gratitude_entries
DROP POLICY IF EXISTS "Users can CRUD own gratitude entries" ON public.gratitude_entries;

-- challenges
DROP POLICY IF EXISTS "Users can CRUD own challenges" ON public.challenges;

-- badges
DROP POLICY IF EXISTS "Users can CRUD own badges" ON public.badges;

-- adhd_state
DROP POLICY IF EXISTS "Users can CRUD own ADHD state" ON public.adhd_state;

-- mystery_boxes
DROP POLICY IF EXISTS "Users can CRUD own mystery boxes" ON public.mystery_boxes;

-- time_challenges
DROP POLICY IF EXISTS "Users can CRUD own time challenges" ON public.time_challenges;

-- user_backups (has duplicates)
DROP POLICY IF EXISTS "Users can CRUD own backups" ON public.user_backups;
DROP POLICY IF EXISTS "Users can read own backups" ON public.user_backups;
DROP POLICY IF EXISTS "Users can upsert own backups" ON public.user_backups;

-- user_settings
DROP POLICY IF EXISTS "Users can view own settings" ON public.user_settings;
DROP POLICY IF EXISTS "Users can insert own settings" ON public.user_settings;
DROP POLICY IF EXISTS "Users can update own settings" ON public.user_settings;
DROP POLICY IF EXISTS "Users can CRUD own settings" ON public.user_settings;

-- user_data
DROP POLICY IF EXISTS "Users can view their own data" ON public.user_data;
DROP POLICY IF EXISTS "Users can insert their own data" ON public.user_data;
DROP POLICY IF EXISTS "Users can update their own data" ON public.user_data;
DROP POLICY IF EXISTS "Users can delete their own data" ON public.user_data;

-- push_subscriptions (has duplicates)
DROP POLICY IF EXISTS "Users can CRUD own push subscriptions" ON public.push_subscriptions;
DROP POLICY IF EXISTS "Users can view their own subscriptions" ON public.push_subscriptions;
DROP POLICY IF EXISTS "Users can insert their own subscriptions" ON public.push_subscriptions;
DROP POLICY IF EXISTS "Users can update their own subscriptions" ON public.push_subscriptions;
DROP POLICY IF EXISTS "Users can delete their own subscriptions" ON public.push_subscriptions;

-- push_logs (has duplicates)
DROP POLICY IF EXISTS "Users can read own push logs" ON public.push_logs;
DROP POLICY IF EXISTS "Users read own push logs" ON public.push_logs;
DROP POLICY IF EXISTS "Users insert own push logs" ON public.push_logs;

-- push_device_tokens
DROP POLICY IF EXISTS "Users manage own device tokens" ON public.push_device_tokens;

-- user_challenges (has duplicates)
DROP POLICY IF EXISTS "Users can view their own challenges" ON public.user_challenges;
DROP POLICY IF EXISTS "Users can insert their own challenges" ON public.user_challenges;
DROP POLICY IF EXISTS "Users can update their own challenges" ON public.user_challenges;
DROP POLICY IF EXISTS "Users can delete their own challenges" ON public.user_challenges;
DROP POLICY IF EXISTS "Users can manage own challenges" ON public.user_challenges;

-- user_badges (has duplicates)
DROP POLICY IF EXISTS "Users can view their own badges" ON public.user_badges;
DROP POLICY IF EXISTS "Users can insert their own badges" ON public.user_badges;
DROP POLICY IF EXISTS "Users can update their own badges" ON public.user_badges;
DROP POLICY IF EXISTS "Users can delete their own badges" ON public.user_badges;
DROP POLICY IF EXISTS "Users can manage own badges" ON public.user_badges;

-- user_tasks (has duplicates)
DROP POLICY IF EXISTS "Users can view their own tasks" ON public.user_tasks;
DROP POLICY IF EXISTS "Users can insert their own tasks" ON public.user_tasks;
DROP POLICY IF EXISTS "Users can update their own tasks" ON public.user_tasks;
DROP POLICY IF EXISTS "Users can delete their own tasks" ON public.user_tasks;
DROP POLICY IF EXISTS "Users can manage own tasks" ON public.user_tasks;

-- user_quests (has duplicates)
DROP POLICY IF EXISTS "Users can view their own quests" ON public.user_quests;
DROP POLICY IF EXISTS "Users can insert their own quests" ON public.user_quests;
DROP POLICY IF EXISTS "Users can update their own quests" ON public.user_quests;
DROP POLICY IF EXISTS "Users can delete their own quests" ON public.user_quests;
DROP POLICY IF EXISTS "Users can manage own quests" ON public.user_quests;

-- user_stats
DROP POLICY IF EXISTS "Users can view own stats" ON public.user_stats;
DROP POLICY IF EXISTS "Users can update own stats" ON public.user_stats;
DROP POLICY IF EXISTS "Users can insert own stats" ON public.user_stats;

-- user_inner_world
DROP POLICY IF EXISTS "Users can manage own inner world" ON public.user_inner_world;
DROP POLICY IF EXISTS "Users can view own inner world" ON public.user_inner_world;
DROP POLICY IF EXISTS "Users can insert own inner world" ON public.user_inner_world;
DROP POLICY IF EXISTS "Users can update own inner world" ON public.user_inner_world;

-- user_reminder_settings
DROP POLICY IF EXISTS "Users can manage own settings" ON public.user_reminder_settings;
DROP POLICY IF EXISTS "Users can read own reminder settings" ON public.user_reminder_settings;
DROP POLICY IF EXISTS "Users can upsert own reminder settings" ON public.user_reminder_settings;

-- leaderboards (has duplicates)
DROP POLICY IF EXISTS "Anyone can view opted-in leaderboards" ON public.leaderboards;
DROP POLICY IF EXISTS "Users can view their own leaderboard entry" ON public.leaderboards;
DROP POLICY IF EXISTS "Users can create their own leaderboard entry" ON public.leaderboards;
DROP POLICY IF EXISTS "Users can update their own leaderboard entry" ON public.leaderboards;
DROP POLICY IF EXISTS "Users can delete their own leaderboard entry" ON public.leaderboards;

-- friend_challenges
DROP POLICY IF EXISTS "Anyone can view challenges" ON public.friend_challenges;
DROP POLICY IF EXISTS "Users can create challenges" ON public.friend_challenges;
DROP POLICY IF EXISTS "Creator can update challenge" ON public.friend_challenges;
DROP POLICY IF EXISTS "Creator can delete challenge" ON public.friend_challenges;

-- friend_challenge_members
DROP POLICY IF EXISTS "Members can view challenge participants" ON public.friend_challenge_members;
DROP POLICY IF EXISTS "Users can join challenges" ON public.friend_challenge_members;
DROP POLICY IF EXISTS "Users can update own progress" ON public.friend_challenge_members;
DROP POLICY IF EXISTS "Users can leave challenges" ON public.friend_challenge_members;

-- app_config
DROP POLICY IF EXISTS "Anyone can read app_config" ON public.app_config;
DROP POLICY IF EXISTS "Service role can update app_config" ON public.app_config;
DROP POLICY IF EXISTS "Service role can insert app_config" ON public.app_config;

-- analytics_events
DROP POLICY IF EXISTS "Users insert own analytics events" ON public.analytics_events;

-- =============================================
-- SECTION 2: Recreate policies with (select auth.uid())
-- Using subquery for performance optimization
-- =============================================

-- profiles
CREATE POLICY "profiles_select" ON public.profiles FOR SELECT
  USING (id = (select auth.uid()));
CREATE POLICY "profiles_insert" ON public.profiles FOR INSERT
  WITH CHECK (id = (select auth.uid()));
CREATE POLICY "profiles_update" ON public.profiles FOR UPDATE
  USING (id = (select auth.uid()));

-- moods
CREATE POLICY "moods_all" ON public.moods FOR ALL
  USING (user_id = (select auth.uid()))
  WITH CHECK (user_id = (select auth.uid()));

-- habits
CREATE POLICY "habits_all" ON public.habits FOR ALL
  USING (user_id = (select auth.uid()))
  WITH CHECK (user_id = (select auth.uid()));

-- habit_completions
CREATE POLICY "habit_completions_all" ON public.habit_completions FOR ALL
  USING (user_id = (select auth.uid()))
  WITH CHECK (user_id = (select auth.uid()));

-- habit_reminders
CREATE POLICY "habit_reminders_all" ON public.habit_reminders FOR ALL
  USING (user_id = (select auth.uid()))
  WITH CHECK (user_id = (select auth.uid()));

-- focus_sessions
CREATE POLICY "focus_sessions_all" ON public.focus_sessions FOR ALL
  USING (user_id = (select auth.uid()))
  WITH CHECK (user_id = (select auth.uid()));

-- gratitude_entries
CREATE POLICY "gratitude_entries_all" ON public.gratitude_entries FOR ALL
  USING (user_id = (select auth.uid()))
  WITH CHECK (user_id = (select auth.uid()));

-- challenges
CREATE POLICY "challenges_all" ON public.challenges FOR ALL
  USING (user_id = (select auth.uid()))
  WITH CHECK (user_id = (select auth.uid()));

-- badges
CREATE POLICY "badges_all" ON public.badges FOR ALL
  USING (user_id = (select auth.uid()))
  WITH CHECK (user_id = (select auth.uid()));

-- adhd_state
CREATE POLICY "adhd_state_all" ON public.adhd_state FOR ALL
  USING (user_id = (select auth.uid()))
  WITH CHECK (user_id = (select auth.uid()));

-- mystery_boxes
CREATE POLICY "mystery_boxes_all" ON public.mystery_boxes FOR ALL
  USING (user_id = (select auth.uid()))
  WITH CHECK (user_id = (select auth.uid()));

-- time_challenges
CREATE POLICY "time_challenges_all" ON public.time_challenges FOR ALL
  USING (user_id = (select auth.uid()))
  WITH CHECK (user_id = (select auth.uid()));

-- user_backups (single policy replaces duplicates)
CREATE POLICY "user_backups_all" ON public.user_backups FOR ALL
  USING (user_id = (select auth.uid()))
  WITH CHECK (user_id = (select auth.uid()));

-- user_settings
CREATE POLICY "user_settings_all" ON public.user_settings FOR ALL
  USING (user_id = (select auth.uid()))
  WITH CHECK (user_id = (select auth.uid()));

-- user_data
CREATE POLICY "user_data_all" ON public.user_data FOR ALL
  USING (user_id = (select auth.uid()))
  WITH CHECK (user_id = (select auth.uid()));

-- push_subscriptions (single policy replaces duplicates)
CREATE POLICY "push_subscriptions_all" ON public.push_subscriptions FOR ALL
  USING (user_id = (select auth.uid()))
  WITH CHECK (user_id = (select auth.uid()));

-- push_logs
CREATE POLICY "push_logs_select" ON public.push_logs FOR SELECT
  USING (user_id = (select auth.uid()));
CREATE POLICY "push_logs_insert" ON public.push_logs FOR INSERT
  WITH CHECK (user_id = (select auth.uid()));

-- push_device_tokens
CREATE POLICY "push_device_tokens_all" ON public.push_device_tokens FOR ALL
  USING (user_id = (select auth.uid()))
  WITH CHECK (user_id = (select auth.uid()));

-- user_challenges (single policy replaces duplicates)
CREATE POLICY "user_challenges_all" ON public.user_challenges FOR ALL
  USING (user_id = (select auth.uid()))
  WITH CHECK (user_id = (select auth.uid()));

-- user_badges (single policy replaces duplicates)
CREATE POLICY "user_badges_all" ON public.user_badges FOR ALL
  USING (user_id = (select auth.uid()))
  WITH CHECK (user_id = (select auth.uid()));

-- user_tasks (single policy replaces duplicates)
CREATE POLICY "user_tasks_all" ON public.user_tasks FOR ALL
  USING (user_id = (select auth.uid()))
  WITH CHECK (user_id = (select auth.uid()));

-- user_quests (single policy replaces duplicates)
CREATE POLICY "user_quests_all" ON public.user_quests FOR ALL
  USING (user_id = (select auth.uid()))
  WITH CHECK (user_id = (select auth.uid()));

-- user_stats
CREATE POLICY "user_stats_all" ON public.user_stats FOR ALL
  USING (user_id = (select auth.uid()))
  WITH CHECK (user_id = (select auth.uid()));

-- user_inner_world (single policy replaces duplicates)
CREATE POLICY "user_inner_world_all" ON public.user_inner_world FOR ALL
  USING (user_id = (select auth.uid()))
  WITH CHECK (user_id = (select auth.uid()));

-- user_reminder_settings
CREATE POLICY "user_reminder_settings_all" ON public.user_reminder_settings FOR ALL
  USING (user_id = (select auth.uid()))
  WITH CHECK (user_id = (select auth.uid()));

-- leaderboards (needs special handling for public view)
CREATE POLICY "leaderboards_public_select" ON public.leaderboards FOR SELECT
  USING (opt_in = true OR user_id = (select auth.uid()));
CREATE POLICY "leaderboards_insert" ON public.leaderboards FOR INSERT
  WITH CHECK (user_id = (select auth.uid()));
CREATE POLICY "leaderboards_update" ON public.leaderboards FOR UPDATE
  USING (user_id = (select auth.uid()));
CREATE POLICY "leaderboards_delete" ON public.leaderboards FOR DELETE
  USING (user_id = (select auth.uid()));

-- friend_challenges (public view for join by code)
CREATE POLICY "friend_challenges_select" ON public.friend_challenges FOR SELECT
  USING (true);
CREATE POLICY "friend_challenges_insert" ON public.friend_challenges FOR INSERT
  WITH CHECK (creator_id = (select auth.uid()));
CREATE POLICY "friend_challenges_update" ON public.friend_challenges FOR UPDATE
  USING (creator_id = (select auth.uid()));
CREATE POLICY "friend_challenges_delete" ON public.friend_challenges FOR DELETE
  USING (creator_id = (select auth.uid()));

-- friend_challenge_members
CREATE POLICY "friend_challenge_members_select" ON public.friend_challenge_members FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.friend_challenge_members m
      WHERE m.challenge_id = friend_challenge_members.challenge_id
        AND m.user_id = (select auth.uid())
    )
  );
CREATE POLICY "friend_challenge_members_insert" ON public.friend_challenge_members FOR INSERT
  WITH CHECK (user_id = (select auth.uid()));
CREATE POLICY "friend_challenge_members_update" ON public.friend_challenge_members FOR UPDATE
  USING (user_id = (select auth.uid()));
CREATE POLICY "friend_challenge_members_delete" ON public.friend_challenge_members FOR DELETE
  USING (user_id = (select auth.uid()));

-- app_config (public read, service_role write)
CREATE POLICY "app_config_select" ON public.app_config FOR SELECT
  USING (true);
CREATE POLICY "app_config_update" ON public.app_config FOR UPDATE
  USING ((select auth.role()) = 'service_role');
CREATE POLICY "app_config_insert" ON public.app_config FOR INSERT
  WITH CHECK ((select auth.role()) = 'service_role');

-- analytics_events
CREATE POLICY "analytics_events_insert" ON public.analytics_events FOR INSERT
  WITH CHECK (user_id = (select auth.uid()));

-- =============================================
-- SECTION 3: Fix duplicate indexes
-- =============================================

-- Check and remove duplicate indexes on push_logs
DROP INDEX IF EXISTS push_logs_user_type_date_idx;
-- Keep push_logs_user_id_type_date_key if it exists as primary

-- =============================================
-- VERIFICATION (run after migration)
-- =============================================
-- Check policy count per table:
-- SELECT tablename, COUNT(*) as policy_count
-- FROM pg_policies
-- WHERE schemaname = 'public'
-- GROUP BY tablename
-- ORDER BY tablename;

-- Check for auth.uid() without select wrapper:
-- SELECT tablename, policyname, qual, with_check
-- FROM pg_policies
-- WHERE schemaname = 'public'
--   AND (qual LIKE '%auth.uid()%' OR with_check LIKE '%auth.uid()%')
--   AND (qual NOT LIKE '%(select auth.uid())%' AND with_check NOT LIKE '%(select auth.uid())%');
-- Expected: 0 rows

-- Migration: tighten user-owned RLS policies with explicit authenticated scope
-- Date: 2026-04-20
-- Why:
--   Supabase recommends combining user ownership predicates with `TO authenticated`
--   so anonymous traffic is filtered before evaluating the policy body.
-- Scope:
--   Keep existing ownership semantics unchanged.
--   Only recreate hot user-owned policies and storage policies with explicit role scope.

-- ============================================================
-- Core user-owned tables from consolidated RLS migrations
-- ============================================================

DROP POLICY IF EXISTS "profiles_select" ON public.profiles;
CREATE POLICY "profiles_select" ON public.profiles
  FOR SELECT
  TO authenticated
  USING (id = (select auth.uid()));

DROP POLICY IF EXISTS "profiles_insert" ON public.profiles;
CREATE POLICY "profiles_insert" ON public.profiles
  FOR INSERT
  TO authenticated
  WITH CHECK (id = (select auth.uid()));

DROP POLICY IF EXISTS "profiles_update" ON public.profiles;
CREATE POLICY "profiles_update" ON public.profiles
  FOR UPDATE
  TO authenticated
  USING (id = (select auth.uid()));

DROP POLICY IF EXISTS "user_profiles_select" ON public.user_profiles;
CREATE POLICY "user_profiles_select" ON public.user_profiles
  FOR SELECT
  TO authenticated
  USING (auth.role() = 'authenticated');

DROP POLICY IF EXISTS "user_profiles_insert" ON public.user_profiles;
CREATE POLICY "user_profiles_insert" ON public.user_profiles
  FOR INSERT
  TO authenticated
  WITH CHECK (user_id = (select auth.uid()));

DROP POLICY IF EXISTS "user_profiles_update" ON public.user_profiles;
CREATE POLICY "user_profiles_update" ON public.user_profiles
  FOR UPDATE
  TO authenticated
  USING (user_id = (select auth.uid()));

DROP POLICY IF EXISTS "user_profiles_delete" ON public.user_profiles;
CREATE POLICY "user_profiles_delete" ON public.user_profiles
  FOR DELETE
  TO authenticated
  USING (user_id = (select auth.uid()));

DROP POLICY IF EXISTS "moods_all" ON public.moods;
CREATE POLICY "moods_all" ON public.moods
  FOR ALL
  TO authenticated
  USING (user_id = (select auth.uid()))
  WITH CHECK (user_id = (select auth.uid()));

DROP POLICY IF EXISTS "habits_all" ON public.habits;
CREATE POLICY "habits_all" ON public.habits
  FOR ALL
  TO authenticated
  USING (user_id = (select auth.uid()))
  WITH CHECK (user_id = (select auth.uid()));

DROP POLICY IF EXISTS "habit_completions_all" ON public.habit_completions;
CREATE POLICY "habit_completions_all" ON public.habit_completions
  FOR ALL
  TO authenticated
  USING (user_id = (select auth.uid()))
  WITH CHECK (user_id = (select auth.uid()));

DROP POLICY IF EXISTS "habit_reminders_all" ON public.habit_reminders;
CREATE POLICY "habit_reminders_all" ON public.habit_reminders
  FOR ALL
  TO authenticated
  USING (user_id = (select auth.uid()))
  WITH CHECK (user_id = (select auth.uid()));

DROP POLICY IF EXISTS "focus_sessions_all" ON public.focus_sessions;
CREATE POLICY "focus_sessions_all" ON public.focus_sessions
  FOR ALL
  TO authenticated
  USING (user_id = (select auth.uid()))
  WITH CHECK (user_id = (select auth.uid()));

DROP POLICY IF EXISTS "gratitude_entries_all" ON public.gratitude_entries;
CREATE POLICY "gratitude_entries_all" ON public.gratitude_entries
  FOR ALL
  TO authenticated
  USING (user_id = (select auth.uid()))
  WITH CHECK (user_id = (select auth.uid()));

DROP POLICY IF EXISTS "challenges_all" ON public.challenges;
CREATE POLICY "challenges_all" ON public.challenges
  FOR ALL
  TO authenticated
  USING (user_id = (select auth.uid()))
  WITH CHECK (user_id = (select auth.uid()));

DROP POLICY IF EXISTS "badges_all" ON public.badges;
CREATE POLICY "badges_all" ON public.badges
  FOR ALL
  TO authenticated
  USING (user_id = (select auth.uid()))
  WITH CHECK (user_id = (select auth.uid()));

DROP POLICY IF EXISTS "adhd_state_all" ON public.adhd_state;
CREATE POLICY "adhd_state_all" ON public.adhd_state
  FOR ALL
  TO authenticated
  USING (user_id = (select auth.uid()))
  WITH CHECK (user_id = (select auth.uid()));

DROP POLICY IF EXISTS "mystery_boxes_all" ON public.mystery_boxes;
CREATE POLICY "mystery_boxes_all" ON public.mystery_boxes
  FOR ALL
  TO authenticated
  USING (user_id = (select auth.uid()))
  WITH CHECK (user_id = (select auth.uid()));

DROP POLICY IF EXISTS "time_challenges_all" ON public.time_challenges;
CREATE POLICY "time_challenges_all" ON public.time_challenges
  FOR ALL
  TO authenticated
  USING (user_id = (select auth.uid()))
  WITH CHECK (user_id = (select auth.uid()));

DROP POLICY IF EXISTS "user_backups_all" ON public.user_backups;
CREATE POLICY "user_backups_all" ON public.user_backups
  FOR ALL
  TO authenticated
  USING (user_id = (select auth.uid()))
  WITH CHECK (user_id = (select auth.uid()));

DROP POLICY IF EXISTS "user_settings_all" ON public.user_settings;
CREATE POLICY "user_settings_all" ON public.user_settings
  FOR ALL
  TO authenticated
  USING (user_id = (select auth.uid()))
  WITH CHECK (user_id = (select auth.uid()));

DROP POLICY IF EXISTS "user_data_all" ON public.user_data;
CREATE POLICY "user_data_all" ON public.user_data
  FOR ALL
  TO authenticated
  USING (user_id = (select auth.uid()))
  WITH CHECK (user_id = (select auth.uid()));

DROP POLICY IF EXISTS "push_subscriptions_all" ON public.push_subscriptions;
CREATE POLICY "push_subscriptions_all" ON public.push_subscriptions
  FOR ALL
  TO authenticated
  USING (user_id = (select auth.uid()))
  WITH CHECK (user_id = (select auth.uid()));

DROP POLICY IF EXISTS "push_logs_select" ON public.push_logs;
CREATE POLICY "push_logs_select" ON public.push_logs
  FOR SELECT
  TO authenticated
  USING (user_id = (select auth.uid()));

DROP POLICY IF EXISTS "push_logs_insert" ON public.push_logs;
CREATE POLICY "push_logs_insert" ON public.push_logs
  FOR INSERT
  TO authenticated
  WITH CHECK (user_id = (select auth.uid()));

DROP POLICY IF EXISTS "push_device_tokens_all" ON public.push_device_tokens;
CREATE POLICY "push_device_tokens_all" ON public.push_device_tokens
  FOR ALL
  TO authenticated
  USING (user_id = (select auth.uid()))
  WITH CHECK (user_id = (select auth.uid()));

DROP POLICY IF EXISTS "leaderboards_insert" ON public.leaderboards;
CREATE POLICY "leaderboards_insert" ON public.leaderboards
  FOR INSERT
  TO authenticated
  WITH CHECK (user_id = (select auth.uid()));

DROP POLICY IF EXISTS "leaderboards_update" ON public.leaderboards;
CREATE POLICY "leaderboards_update" ON public.leaderboards
  FOR UPDATE
  TO authenticated
  USING (user_id = (select auth.uid()));

DROP POLICY IF EXISTS "leaderboards_delete" ON public.leaderboards;
CREATE POLICY "leaderboards_delete" ON public.leaderboards
  FOR DELETE
  TO authenticated
  USING (user_id = (select auth.uid()));

DROP POLICY IF EXISTS "friend_challenges_insert" ON public.friend_challenges;
CREATE POLICY "friend_challenges_insert" ON public.friend_challenges
  FOR INSERT
  TO authenticated
  WITH CHECK (creator_id = (select auth.uid()));

DROP POLICY IF EXISTS "friend_challenges_update" ON public.friend_challenges;
CREATE POLICY "friend_challenges_update" ON public.friend_challenges
  FOR UPDATE
  TO authenticated
  USING (creator_id = (select auth.uid()));

DROP POLICY IF EXISTS "friend_challenges_delete" ON public.friend_challenges;
CREATE POLICY "friend_challenges_delete" ON public.friend_challenges
  FOR DELETE
  TO authenticated
  USING (creator_id = (select auth.uid()));

DROP POLICY IF EXISTS "friend_challenge_members_insert" ON public.friend_challenge_members;
CREATE POLICY "friend_challenge_members_insert" ON public.friend_challenge_members
  FOR INSERT
  TO authenticated
  WITH CHECK (user_id = (select auth.uid()));

DROP POLICY IF EXISTS "friend_challenge_members_update" ON public.friend_challenge_members;
CREATE POLICY "friend_challenge_members_update" ON public.friend_challenge_members
  FOR UPDATE
  TO authenticated
  USING (user_id = (select auth.uid()));

DROP POLICY IF EXISTS "friend_challenge_members_delete" ON public.friend_challenge_members;
CREATE POLICY "friend_challenge_members_delete" ON public.friend_challenge_members
  FOR DELETE
  TO authenticated
  USING (user_id = (select auth.uid()));

DROP POLICY IF EXISTS "user_challenges_all" ON public.user_challenges;
CREATE POLICY "user_challenges_all" ON public.user_challenges
  FOR ALL
  TO authenticated
  USING (user_id = (select auth.uid()))
  WITH CHECK (user_id = (select auth.uid()));

DROP POLICY IF EXISTS "user_badges_all" ON public.user_badges;
CREATE POLICY "user_badges_all" ON public.user_badges
  FOR ALL
  TO authenticated
  USING (user_id = (select auth.uid()))
  WITH CHECK (user_id = (select auth.uid()));

DROP POLICY IF EXISTS "user_tasks_all" ON public.user_tasks;
CREATE POLICY "user_tasks_all" ON public.user_tasks
  FOR ALL
  TO authenticated
  USING (user_id = (select auth.uid()))
  WITH CHECK (user_id = (select auth.uid()));

DROP POLICY IF EXISTS "user_quests_all" ON public.user_quests;
CREATE POLICY "user_quests_all" ON public.user_quests
  FOR ALL
  TO authenticated
  USING (user_id = (select auth.uid()))
  WITH CHECK (user_id = (select auth.uid()));

DROP POLICY IF EXISTS "user_stats_all" ON public.user_stats;
CREATE POLICY "user_stats_all" ON public.user_stats
  FOR ALL
  TO authenticated
  USING (user_id = (select auth.uid()))
  WITH CHECK (user_id = (select auth.uid()));

DROP POLICY IF EXISTS "analytics_events_insert" ON public.analytics_events;
CREATE POLICY "analytics_events_insert" ON public.analytics_events
  FOR INSERT
  TO authenticated
  WITH CHECK (user_id = (select auth.uid()));

DROP POLICY IF EXISTS "analytics_events_select" ON public.analytics_events;
CREATE POLICY "analytics_events_select" ON public.analytics_events
  FOR SELECT
  TO authenticated
  USING (user_id = (select auth.uid()));

-- ============================================================
-- Journal and sync tables with active runtime traffic
-- ============================================================

DROP POLICY IF EXISTS "journal_entries_all" ON public.journal_entries;
CREATE POLICY "journal_entries_all" ON public.journal_entries
  FOR ALL
  TO authenticated
  USING (user_id = (select auth.uid()))
  WITH CHECK (user_id = (select auth.uid()));

DROP POLICY IF EXISTS "journal_photos_all" ON public.journal_photos;
CREATE POLICY "journal_photos_all" ON public.journal_photos
  FOR ALL
  TO authenticated
  USING (user_id = (select auth.uid()))
  WITH CHECK (user_id = (select auth.uid()));

DROP POLICY IF EXISTS "journal_audio_all" ON public.journal_audio;
CREATE POLICY "journal_audio_all" ON public.journal_audio
  FOR ALL
  TO authenticated
  USING (user_id = (select auth.uid()))
  WITH CHECK (user_id = (select auth.uid()));

DROP POLICY IF EXISTS "user_reminder_settings_all" ON public.user_reminder_settings;
CREATE POLICY "user_reminder_settings_all" ON public.user_reminder_settings
  FOR ALL
  TO authenticated
  USING (user_id = (select auth.uid()))
  WITH CHECK (user_id = (select auth.uid()));

DROP POLICY IF EXISTS "user_inner_world_all" ON public.user_inner_world;
CREATE POLICY "user_inner_world_all" ON public.user_inner_world
  FOR ALL
  TO authenticated
  USING (user_id = (select auth.uid()))
  WITH CHECK (user_id = (select auth.uid()));

DROP POLICY IF EXISTS "sync_seq_counters_select_own" ON public.sync_seq_counters;
CREATE POLICY "sync_seq_counters_select_own" ON public.sync_seq_counters
  FOR SELECT
  TO authenticated
  USING ((select auth.uid()) = user_id);

DROP POLICY IF EXISTS "sync_events_select_own" ON public.sync_events;
CREATE POLICY "sync_events_select_own" ON public.sync_events
  FOR SELECT
  TO authenticated
  USING ((select auth.uid()) = user_id);

DROP POLICY IF EXISTS "sync_events_insert_own" ON public.sync_events;
CREATE POLICY "sync_events_insert_own" ON public.sync_events
  FOR INSERT
  TO authenticated
  WITH CHECK ((select auth.uid()) = user_id);

DROP POLICY IF EXISTS "Users can read own embeddings" ON public.journal_embeddings;
CREATE POLICY "Users can read own embeddings" ON public.journal_embeddings
  FOR SELECT
  TO authenticated
  USING ((select auth.uid()) = user_id);

DROP POLICY IF EXISTS "Users can insert own embeddings" ON public.journal_embeddings;
CREATE POLICY "Users can insert own embeddings" ON public.journal_embeddings
  FOR INSERT
  TO authenticated
  WITH CHECK ((select auth.uid()) = user_id);

DROP POLICY IF EXISTS "Users can delete own embeddings" ON public.journal_embeddings;
CREATE POLICY "Users can delete own embeddings" ON public.journal_embeddings
  FOR DELETE
  TO authenticated
  USING ((select auth.uid()) = user_id);

-- ============================================================
-- Storage objects: same folder ownership logic, explicit role scope
-- ============================================================

DROP POLICY IF EXISTS "journal_photos_upload" ON storage.objects;
CREATE POLICY "journal_photos_upload" ON storage.objects
  FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'journal-photos'
    AND (storage.foldername(name))[1] = (select auth.uid())::text
  );

DROP POLICY IF EXISTS "journal_photos_select" ON storage.objects;
CREATE POLICY "journal_photos_select" ON storage.objects
  FOR SELECT
  TO authenticated
  USING (
    bucket_id = 'journal-photos'
    AND (storage.foldername(name))[1] = (select auth.uid())::text
  );

DROP POLICY IF EXISTS "journal_photos_delete" ON storage.objects;
CREATE POLICY "journal_photos_delete" ON storage.objects
  FOR DELETE
  TO authenticated
  USING (
    bucket_id = 'journal-photos'
    AND (storage.foldername(name))[1] = (select auth.uid())::text
  );

DROP POLICY IF EXISTS "journal_audio_upload" ON storage.objects;
CREATE POLICY "journal_audio_upload" ON storage.objects
  FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'journal-audio'
    AND (storage.foldername(name))[1] = (select auth.uid())::text
  );

DROP POLICY IF EXISTS "journal_audio_select" ON storage.objects;
CREATE POLICY "journal_audio_select" ON storage.objects
  FOR SELECT
  TO authenticated
  USING (
    bucket_id = 'journal-audio'
    AND (storage.foldername(name))[1] = (select auth.uid())::text
  );

DROP POLICY IF EXISTS "journal_audio_delete" ON storage.objects;
CREATE POLICY "journal_audio_delete" ON storage.objects
  FOR DELETE
  TO authenticated
  USING (
    bucket_id = 'journal-audio'
    AND (storage.foldername(name))[1] = (select auth.uid())::text
  );

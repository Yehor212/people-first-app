-- Harden SECURITY DEFINER RPC exposure and advisor-covered RLS initplans.
--
-- Evidence source:
-- - Supabase security advisors 0028/0029 reported SECURITY DEFINER functions
--   executable through the exposed API by anon/authenticated roles.
-- - Supabase performance advisors 0003 reported auth helper calls evaluated
--   per row in three RLS policies.
--
-- Intent:
-- - Remove default PUBLIC execute from SECURITY DEFINER functions.
-- - Keep authenticated execute only for RPCs currently used by the app.
-- - Leave trigger/job-only functions callable only by their owning execution
--   context.

REVOKE ALL ON FUNCTION public.assign_sync_seq() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.calculate_streak(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.handle_new_user() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.handle_user_login() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.match_journal_entries(public.vector, uuid, double precision, integer) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.reset_monthly_leaderboard() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.reset_weekly_leaderboard() FROM PUBLIC;

REVOKE ALL ON FUNCTION public.get_user_stats(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_user_stats(uuid) TO authenticated;

REVOKE ALL ON FUNCTION public.get_user_weekly_summary(date) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_user_weekly_summary(date) TO authenticated;

REVOKE ALL ON FUNCTION public.get_challenge_leaderboard(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_challenge_leaderboard(uuid) TO authenticated;

REVOKE ALL ON FUNCTION public.update_member_progress(uuid, uuid, integer, integer) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.update_member_progress(uuid, uuid, integer, integer) TO authenticated;

DROP POLICY IF EXISTS "Users can update own embeddings" ON public.journal_embeddings;
CREATE POLICY "Users can update own embeddings"
  ON public.journal_embeddings
  FOR UPDATE
  TO authenticated
  USING (user_id = (select auth.uid()))
  WITH CHECK (user_id = (select auth.uid()));

DROP POLICY IF EXISTS "friend_challenges_select" ON public.friend_challenges;
CREATE POLICY "friend_challenges_select"
  ON public.friend_challenges
  FOR SELECT
  TO authenticated
  USING (
    creator_id = (select auth.uid())
    OR EXISTS (
      SELECT 1
      FROM public.friend_challenge_members AS member
      WHERE member.challenge_id = friend_challenges.id
        AND member.user_id = (select auth.uid())
    )
  );

DROP POLICY IF EXISTS "user_profiles_select" ON public.user_profiles;
CREATE POLICY "user_profiles_select"
  ON public.user_profiles
  FOR SELECT
  TO authenticated
  USING (true);

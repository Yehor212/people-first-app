-- Explicitly revoke API role EXECUTE on SECURITY DEFINER functions.
--
-- Previous hardening revoked from PUBLIC, but live Supabase advisors showed that
-- explicit role grants can still leave anon/authenticated able to call exposed
-- SECURITY DEFINER RPC endpoints. This migration removes those explicit grants.

REVOKE ALL ON FUNCTION public.assign_sync_seq() FROM anon, authenticated;
REVOKE ALL ON FUNCTION public.calculate_streak(uuid) FROM anon, authenticated;
REVOKE ALL ON FUNCTION public.handle_new_user() FROM anon, authenticated;
REVOKE ALL ON FUNCTION public.handle_user_login() FROM anon, authenticated;
REVOKE ALL ON FUNCTION public.match_journal_entries(public.vector, uuid, double precision, integer) FROM anon, authenticated;
REVOKE ALL ON FUNCTION public.reset_monthly_leaderboard() FROM anon, authenticated;
REVOKE ALL ON FUNCTION public.reset_weekly_leaderboard() FROM anon, authenticated;

REVOKE ALL ON FUNCTION public.get_user_stats(uuid) FROM anon;
REVOKE ALL ON FUNCTION public.get_user_weekly_summary(date) FROM anon;
REVOKE ALL ON FUNCTION public.get_challenge_leaderboard(uuid) FROM anon;
REVOKE ALL ON FUNCTION public.update_member_progress(uuid, uuid, integer, integer) FROM anon;

GRANT EXECUTE ON FUNCTION public.get_user_stats(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_user_weekly_summary(date) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_challenge_leaderboard(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.update_member_progress(uuid, uuid, integer, integer) TO authenticated;

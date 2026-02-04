-- =============================================
-- Migration: Fix Friend Challenge Functions Security
-- Created: 2026-02-03
-- Description: Add SET search_path to functions created after 20260129
-- Fixes: Supabase Security Advisor "mutable search_path" warnings
-- =============================================

-- =============================================
-- 1. Fix update_friend_challenge_updated_at function
-- Risk: LOW (SECURITY INVOKER)
-- =============================================
CREATE OR REPLACE FUNCTION public.update_friend_challenge_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

-- =============================================
-- 2. Fix get_challenge_leaderboard function
-- Risk: HIGH (SECURITY DEFINER without search_path)
-- =============================================
CREATE OR REPLACE FUNCTION public.get_challenge_leaderboard(p_challenge_id UUID)
RETURNS TABLE (
  id UUID,
  challenge_id UUID,
  user_id UUID,
  display_name TEXT,
  days_completed INTEGER,
  current_streak INTEGER,
  last_activity_date DATE,
  completed BOOLEAN,
  completed_at TIMESTAMPTZ,
  joined_at TIMESTAMPTZ
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT
    m.id,
    m.challenge_id,
    m.user_id,
    m.display_name,
    m.days_completed,
    m.current_streak,
    m.last_activity_date,
    m.completed,
    m.completed_at,
    m.joined_at
  FROM public.friend_challenge_members m
  WHERE m.challenge_id = p_challenge_id
  ORDER BY m.days_completed DESC, m.current_streak DESC;
END;
$$;

-- =============================================
-- 3. Fix update_member_progress function
-- Risk: HIGH (SECURITY DEFINER without search_path)
-- =============================================
CREATE OR REPLACE FUNCTION public.update_member_progress(
  p_challenge_id UUID,
  p_user_id UUID,
  p_days_completed INTEGER,
  p_current_streak INTEGER
)
RETURNS public.friend_challenge_members
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_challenge public.friend_challenges;
  v_member public.friend_challenge_members;
BEGIN
  -- Get challenge info
  SELECT * INTO v_challenge FROM public.friend_challenges WHERE id = p_challenge_id;

  -- Update member progress
  UPDATE public.friend_challenge_members
  SET
    days_completed = p_days_completed,
    current_streak = p_current_streak,
    last_activity_date = CURRENT_DATE,
    completed = CASE WHEN p_days_completed >= v_challenge.duration THEN TRUE ELSE FALSE END,
    completed_at = CASE WHEN p_days_completed >= v_challenge.duration AND completed_at IS NULL THEN NOW() ELSE completed_at END
  WHERE challenge_id = p_challenge_id AND user_id = p_user_id
  RETURNING * INTO v_member;

  RETURN v_member;
END;
$$;

-- =============================================
-- 4. Restrict function execution to authenticated users only
-- Prevents anonymous access to SECURITY DEFINER functions
-- =============================================
REVOKE ALL ON FUNCTION public.get_challenge_leaderboard(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_challenge_leaderboard(UUID) TO authenticated;

REVOKE ALL ON FUNCTION public.update_member_progress(UUID, UUID, INTEGER, INTEGER) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.update_member_progress(UUID, UUID, INTEGER, INTEGER) TO authenticated;

-- =============================================
-- VERIFICATION (run manually after migration)
-- =============================================
-- Check all functions have SET search_path:
--
-- SELECT
--   proname AS function_name,
--   CASE
--     WHEN 'search_path=public' = ANY(proconfig) THEN 'FIXED'
--     ELSE 'MISSING'
--   END AS search_path_status
-- FROM pg_proc
-- WHERE pronamespace = 'public'::regnamespace
--   AND proname IN (
--     'update_friend_challenge_updated_at',
--     'get_challenge_leaderboard',
--     'update_member_progress',
--     'update_updated_at_column',
--     'handle_new_user',
--     'calculate_streak',
--     'get_user_stats',
--     'update_user_backups_updated_at',
--     'update_leaderboards_updated_at',
--     'reset_weekly_leaderboard',
--     'reset_monthly_leaderboard',
--     'update_user_settings_timestamp',
--     'check_feedback_rate_limit'
--   );
--
-- Expected: All should show 'FIXED'

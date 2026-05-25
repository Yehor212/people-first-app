-- Harden SECURITY DEFINER user stats RPC against NULL auth.uid() comparisons.
-- The reconciliation migration now includes the same explicit NULL check for
-- fresh environments; this follow-up records the live fix for the linked
-- project where 20260525225407 had already been applied.

CREATE OR REPLACE FUNCTION public.get_user_stats(p_user_id UUID)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_stats JSON;
  v_user_id UUID;
BEGIN
  v_user_id := auth.uid();

  IF v_user_id IS NULL OR p_user_id != v_user_id THEN
    RAISE EXCEPTION 'Unauthorized: cannot access other user stats'
      USING ERRCODE = '42501';
  END IF;

  SELECT json_build_object(
    'total_moods', (SELECT COUNT(*) FROM moods WHERE user_id = p_user_id),
    'total_habits', (SELECT COUNT(*) FROM habits WHERE user_id = p_user_id),
    'completed_habits', (
      SELECT COUNT(*)
      FROM habit_completions
      WHERE user_id = p_user_id
        AND is_complete = true
    ),
    'focus_minutes', (SELECT COALESCE(SUM(duration), 0) FROM focus_sessions WHERE user_id = p_user_id),
    'current_streak', calculate_streak(p_user_id)
  ) INTO v_stats;

  RETURN v_stats;
END;
$$;

REVOKE ALL ON FUNCTION public.get_user_stats(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_user_stats(UUID) TO authenticated;

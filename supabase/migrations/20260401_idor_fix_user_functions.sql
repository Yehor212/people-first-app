-- OWASP A01 IDOR Fix: get_user_stats() and calculate_streak()
-- Both SECURITY DEFINER functions accepted any p_user_id without auth.uid() check.
-- Any authenticated user could read another user's stats/streak.
-- Audit: 2026-04-01, Agent owasp-a01-a03, Finding A01-1 (HIGH) and A01-2 (MEDIUM).

-- Fix get_user_stats: add auth.uid() ownership check
CREATE OR REPLACE FUNCTION get_user_stats(p_user_id UUID)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_stats JSON;
BEGIN
  -- IDOR fix: only allow querying own stats
  IF p_user_id != (SELECT auth.uid()) THEN
    RAISE EXCEPTION 'Unauthorized: cannot access other user stats'
      USING ERRCODE = '42501'; -- insufficient_privilege
  END IF;

  SELECT json_build_object(
    'total_moods', (SELECT COUNT(*) FROM moods WHERE user_id = p_user_id),
    'total_habits', (SELECT COUNT(*) FROM habits WHERE user_id = p_user_id),
    'completed_habits', (SELECT COUNT(*) FROM habit_completions WHERE user_id = p_user_id),
    'focus_minutes', (SELECT COALESCE(SUM(duration), 0) FROM focus_sessions WHERE user_id = p_user_id),
    'current_streak', calculate_streak(p_user_id)
  ) INTO v_stats;

  RETURN v_stats;
END;
$$;

-- Fix calculate_streak: add auth.uid() ownership check
CREATE OR REPLACE FUNCTION public.calculate_streak(p_user_id UUID)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_streak INTEGER := 0;
  v_date DATE;
  v_prev_date DATE;
  v_record RECORD;
BEGIN
  -- IDOR fix: only allow querying own streak
  -- Exception: called internally by get_user_stats (same auth context)
  IF p_user_id != (SELECT auth.uid()) THEN
    RAISE EXCEPTION 'Unauthorized: cannot access other user streak'
      USING ERRCODE = '42501';
  END IF;

  FOR v_record IN
    SELECT DISTINCT date::DATE AS mood_date
    FROM moods
    WHERE user_id = p_user_id
    ORDER BY mood_date DESC
  LOOP
    IF v_prev_date IS NULL THEN
      v_prev_date := v_record.mood_date;
      v_streak := 1;
    ELSIF v_prev_date - v_record.mood_date = 1 THEN
      v_streak := v_streak + 1;
      v_prev_date := v_record.mood_date;
    ELSE
      EXIT;
    END IF;
  END LOOP;

  RETURN v_streak;
END;
$$;

-- Restrict function access to authenticated users only
REVOKE ALL ON FUNCTION get_user_stats(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION get_user_stats(UUID) TO authenticated;

REVOKE ALL ON FUNCTION calculate_streak(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION calculate_streak(UUID) TO authenticated;

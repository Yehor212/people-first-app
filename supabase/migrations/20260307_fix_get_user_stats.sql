-- Fix get_user_stats(): column 'duration_minutes' does not exist in focus_sessions.
-- Correct column name is 'duration'.
CREATE OR REPLACE FUNCTION get_user_stats(p_user_id UUID)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_stats JSON;
BEGIN
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

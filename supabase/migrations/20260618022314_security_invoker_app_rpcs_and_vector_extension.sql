-- Convert app-used RPCs to caller-rights execution and move pgvector out of public.
--
-- This closes the remaining executable privileged-function advisor rows while
-- preserving RPCs that the application and Edge Functions actively call.

CREATE SCHEMA IF NOT EXISTS extensions;
ALTER EXTENSION vector SET SCHEMA extensions;
GRANT USAGE ON SCHEMA extensions TO anon, authenticated, service_role;

ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public
  REVOKE EXECUTE ON FUNCTIONS FROM PUBLIC;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public
  REVOKE EXECUTE ON FUNCTIONS FROM anon, authenticated;

CREATE OR REPLACE FUNCTION public.calculate_streak(p_user_id uuid)
RETURNS integer
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  v_user_id uuid;
  v_streak integer := 0;
  v_prev_date date;
  v_record record;
BEGIN
  v_user_id := auth.uid();

  IF v_user_id IS NULL OR p_user_id != v_user_id THEN
    RAISE EXCEPTION 'Unauthorized: cannot access other user streak'
      USING ERRCODE = '42501';
  END IF;

  FOR v_record IN
    SELECT DISTINCT date::date AS mood_date
    FROM public.moods
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

CREATE OR REPLACE FUNCTION public.get_user_stats(p_user_id uuid)
RETURNS json
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  v_stats json;
  v_user_id uuid;
BEGIN
  v_user_id := auth.uid();

  IF v_user_id IS NULL OR p_user_id != v_user_id THEN
    RAISE EXCEPTION 'Unauthorized: cannot access other user stats'
      USING ERRCODE = '42501';
  END IF;

  SELECT json_build_object(
    'total_moods', (SELECT COUNT(*) FROM public.moods WHERE user_id = p_user_id),
    'total_habits', (SELECT COUNT(*) FROM public.habits WHERE user_id = p_user_id),
    'completed_habits', (
      SELECT COUNT(*)
      FROM public.habit_completions
      WHERE user_id = p_user_id
        AND is_complete = true
    ),
    'focus_minutes', (SELECT COALESCE(SUM(duration), 0) FROM public.focus_sessions WHERE user_id = p_user_id),
    'current_streak', public.calculate_streak(p_user_id)
  ) INTO v_stats;

  RETURN v_stats;
END;
$$;

CREATE OR REPLACE FUNCTION public.get_user_weekly_summary(p_week_start date DEFAULT NULL)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  v_user_id uuid;
  v_week_start date;
  v_week_end date;
  v_prev_week_start date;
  v_prev_week_end date;
  v_result jsonb;
  v_mood_count int;
  v_mood_avg numeric;
  v_prev_mood_avg numeric;
  v_mood_best text;
  v_mood_worst text;
  v_mood_distribution jsonb;
  v_habit_completions int;
  v_habit_unique_days int;
  v_habit_unique_habits int;
  v_prev_habit_completions int;
  v_top_habit jsonb;
  v_focus_sessions int;
  v_focus_total_min int;
  v_focus_avg_min int;
  v_prev_focus_total_min int;
  v_gratitude_count int;
  v_prev_gratitude_count int;
  v_weekly_xp int;
  v_current_streak int;
  v_badges_unlocked int;
  v_new_badges jsonb;
BEGIN
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated' USING ERRCODE = '42501';
  END IF;

  IF p_week_start IS NOT NULL THEN
    v_week_start := p_week_start;
  ELSE
    v_week_start := date_trunc('week', CURRENT_DATE - interval '7 days')::date;
  END IF;
  v_week_end := v_week_start + 6;
  v_prev_week_start := v_week_start - 7;
  v_prev_week_end := v_week_start - 1;

  SELECT
    COUNT(*),
    ROUND(AVG(CASE mood WHEN 'great' THEN 5 WHEN 'good' THEN 4 WHEN 'okay' THEN 3 WHEN 'bad' THEN 2 WHEN 'terrible' THEN 1 END), 2)
  INTO v_mood_count, v_mood_avg
  FROM public.moods
  WHERE user_id = v_user_id
    AND date >= v_week_start AND date <= v_week_end;

  SELECT ROUND(AVG(CASE mood WHEN 'great' THEN 5 WHEN 'good' THEN 4 WHEN 'okay' THEN 3 WHEN 'bad' THEN 2 WHEN 'terrible' THEN 1 END), 2)
  INTO v_prev_mood_avg
  FROM public.moods
  WHERE user_id = v_user_id
    AND date >= v_prev_week_start AND date <= v_prev_week_end;

  SELECT mood INTO v_mood_best
  FROM public.moods
  WHERE user_id = v_user_id
    AND date >= v_week_start AND date <= v_week_end
  ORDER BY CASE mood WHEN 'great' THEN 5 WHEN 'good' THEN 4 WHEN 'okay' THEN 3 WHEN 'bad' THEN 2 WHEN 'terrible' THEN 1 END DESC, timestamp DESC
  LIMIT 1;

  SELECT mood INTO v_mood_worst
  FROM public.moods
  WHERE user_id = v_user_id
    AND date >= v_week_start AND date <= v_week_end
  ORDER BY CASE mood WHEN 'great' THEN 5 WHEN 'good' THEN 4 WHEN 'okay' THEN 3 WHEN 'bad' THEN 2 WHEN 'terrible' THEN 1 END ASC, timestamp ASC
  LIMIT 1;

  SELECT COALESCE(jsonb_object_agg(mood, cnt), '{}'::jsonb)
  INTO v_mood_distribution
  FROM (
    SELECT mood, COUNT(*) as cnt
    FROM public.moods
    WHERE user_id = v_user_id
      AND date >= v_week_start AND date <= v_week_end
    GROUP BY mood
  ) sub;

  SELECT COUNT(*), COUNT(DISTINCT date), COUNT(DISTINCT habit_id)
  INTO v_habit_completions, v_habit_unique_days, v_habit_unique_habits
  FROM public.habit_completions
  WHERE user_id = v_user_id
    AND date >= v_week_start AND date <= v_week_end
    AND is_complete = true;

  SELECT COUNT(*)
  INTO v_prev_habit_completions
  FROM public.habit_completions
  WHERE user_id = v_user_id
    AND date >= v_prev_week_start AND date <= v_prev_week_end
    AND is_complete = true;

  SELECT jsonb_build_object('name', h.name, 'icon', h.icon, 'count', COUNT(*))
  INTO v_top_habit
  FROM public.habit_completions hc
  JOIN public.habits h ON hc.habit_id = h.id
  WHERE hc.user_id = v_user_id
    AND hc.date >= v_week_start AND hc.date <= v_week_end
    AND hc.is_complete = true
  GROUP BY h.id, h.name, h.icon
  ORDER BY COUNT(*) DESC
  LIMIT 1;

  SELECT COUNT(*), COALESCE(SUM(duration), 0), CASE WHEN COUNT(*) > 0 THEN ROUND(AVG(duration)) ELSE 0 END
  INTO v_focus_sessions, v_focus_total_min, v_focus_avg_min
  FROM public.focus_sessions
  WHERE user_id = v_user_id
    AND date >= v_week_start AND date <= v_week_end
    AND status = 'completed';

  SELECT COALESCE(SUM(duration), 0)
  INTO v_prev_focus_total_min
  FROM public.focus_sessions
  WHERE user_id = v_user_id
    AND date >= v_prev_week_start AND date <= v_prev_week_end
    AND status = 'completed';

  SELECT COUNT(*)
  INTO v_gratitude_count
  FROM public.gratitude_entries
  WHERE user_id = v_user_id
    AND date >= v_week_start AND date <= v_week_end;

  SELECT COUNT(*)
  INTO v_prev_gratitude_count
  FROM public.gratitude_entries
  WHERE user_id = v_user_id
    AND date >= v_prev_week_start AND date <= v_prev_week_end;

  SELECT COALESCE(weekly_xp, 0), COALESCE(current_streak, 0)
  INTO v_weekly_xp, v_current_streak
  FROM public.leaderboards
  WHERE user_id = v_user_id;

  IF v_weekly_xp IS NULL THEN v_weekly_xp := 0; END IF;
  IF v_current_streak IS NULL THEN v_current_streak := 0; END IF;

  SELECT COUNT(*), COALESCE(jsonb_agg(jsonb_build_object(
    'badge_id', badge_id,
    'category', category,
    'rarity', rarity,
    'unlocked_at', unlocked_at
  )), '[]'::jsonb)
  INTO v_badges_unlocked, v_new_badges
  FROM public.user_badges
  WHERE user_id = v_user_id
    AND unlocked = true
    AND unlocked_at >= v_week_start::timestamptz
    AND unlocked_at < (v_week_end + 1)::timestamptz;

  v_result := jsonb_build_object(
    'week_start', v_week_start,
    'week_end', v_week_end,
    'generated_at', NOW(),
    'mood', jsonb_build_object(
      'count', v_mood_count,
      'average', v_mood_avg,
      'previous_average', v_prev_mood_avg,
      'trend', CASE WHEN v_mood_avg IS NULL OR v_prev_mood_avg IS NULL THEN 'no_data' WHEN v_mood_avg > v_prev_mood_avg THEN 'up' WHEN v_mood_avg < v_prev_mood_avg THEN 'down' ELSE 'stable' END,
      'best_mood', v_mood_best,
      'worst_mood', v_mood_worst,
      'distribution', v_mood_distribution
    ),
    'habits', jsonb_build_object(
      'completions', v_habit_completions,
      'previous_completions', v_prev_habit_completions,
      'trend', CASE WHEN v_habit_completions > v_prev_habit_completions THEN 'up' WHEN v_habit_completions < v_prev_habit_completions THEN 'down' ELSE 'stable' END,
      'active_days', v_habit_unique_days,
      'unique_habits', v_habit_unique_habits,
      'top_habit', COALESCE(v_top_habit, 'null'::jsonb)
    ),
    'focus', jsonb_build_object(
      'sessions', v_focus_sessions,
      'total_minutes', v_focus_total_min,
      'average_minutes', v_focus_avg_min,
      'previous_total_minutes', v_prev_focus_total_min,
      'trend', CASE WHEN v_focus_total_min > v_prev_focus_total_min THEN 'up' WHEN v_focus_total_min < v_prev_focus_total_min THEN 'down' ELSE 'stable' END
    ),
    'gratitude', jsonb_build_object(
      'count', v_gratitude_count,
      'previous_count', v_prev_gratitude_count,
      'trend', CASE WHEN v_gratitude_count > v_prev_gratitude_count THEN 'up' WHEN v_gratitude_count < v_prev_gratitude_count THEN 'down' ELSE 'stable' END
    ),
    'gamification', jsonb_build_object(
      'weekly_xp', v_weekly_xp,
      'current_streak', v_current_streak,
      'badges_unlocked', v_badges_unlocked,
      'new_badges', v_new_badges
    )
  );

  RETURN v_result;
END;
$$;

CREATE OR REPLACE FUNCTION public.get_challenge_leaderboard(p_challenge_id uuid)
RETURNS TABLE (
  id uuid,
  challenge_id uuid,
  user_id uuid,
  display_name text,
  days_completed integer,
  current_streak integer,
  last_activity_date date,
  completed boolean,
  completed_at timestamptz,
  joined_at timestamptz
)
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT m.id, m.challenge_id, m.user_id, m.display_name, m.days_completed,
    m.current_streak, m.last_activity_date, m.completed, m.completed_at, m.joined_at
  FROM public.friend_challenge_members m
  WHERE m.challenge_id = p_challenge_id
  ORDER BY m.days_completed DESC, m.current_streak DESC;
END;
$$;

CREATE OR REPLACE FUNCTION public.update_member_progress(
  p_challenge_id uuid,
  p_user_id uuid,
  p_days_completed integer,
  p_current_streak integer
)
RETURNS public.friend_challenge_members
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  v_challenge public.friend_challenges;
  v_member public.friend_challenge_members;
BEGIN
  IF auth.uid() IS NULL OR p_user_id != auth.uid() THEN
    RAISE EXCEPTION 'Unauthorized: cannot update another user''s progress'
      USING ERRCODE = '42501';
  END IF;

  SELECT * INTO v_challenge
  FROM public.friend_challenges
  WHERE id = p_challenge_id;

  IF v_challenge.id IS NULL THEN
    RAISE EXCEPTION 'Challenge not found or not accessible'
      USING ERRCODE = '42501';
  END IF;

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

CREATE OR REPLACE FUNCTION public.match_journal_entries(
  query_embedding extensions.vector(768),
  match_user_id uuid,
  match_threshold double precision DEFAULT 0.3,
  match_count integer DEFAULT 10
)
RETURNS TABLE (entry_id text, similarity double precision)
LANGUAGE plpgsql
STABLE
SECURITY INVOKER
SET search_path = public, extensions
AS $$
BEGIN
  IF auth.uid() IS NULL OR match_user_id != auth.uid() THEN
    RAISE EXCEPTION 'Unauthorized: cannot search another user''s journal'
      USING ERRCODE = '42501';
  END IF;

  RETURN QUERY
  SELECT je.entry_id, (1 - (je.embedding <=> query_embedding))::double precision AS similarity
  FROM public.journal_embeddings je
  WHERE je.user_id = match_user_id
    AND (1 - (je.embedding <=> query_embedding)) > match_threshold
  ORDER BY je.embedding <=> query_embedding
  LIMIT match_count;
END;
$$;

REVOKE ALL ON FUNCTION public.calculate_streak(uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.get_user_stats(uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.get_user_weekly_summary(date) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.get_challenge_leaderboard(uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.update_member_progress(uuid, uuid, integer, integer) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.match_journal_entries(extensions.vector, uuid, double precision, integer) FROM PUBLIC, anon;

GRANT EXECUTE ON FUNCTION public.calculate_streak(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_user_stats(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_user_weekly_summary(date) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_challenge_leaderboard(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.update_member_progress(uuid, uuid, integer, integer) TO authenticated;
GRANT EXECUTE ON FUNCTION public.match_journal_entries(extensions.vector, uuid, double precision, integer) TO authenticated;

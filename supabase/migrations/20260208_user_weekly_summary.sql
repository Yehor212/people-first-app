-- Per-user weekly summary function
-- Returns a JSONB digest of the previous week's activity for the calling user
-- Usage: SELECT get_user_weekly_summary();
-- Optional: SELECT get_user_weekly_summary('2026-01-27'::date); -- custom week start

CREATE OR REPLACE FUNCTION public.get_user_weekly_summary(
  p_week_start date DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id uuid;
  v_week_start date;
  v_week_end date;
  v_prev_week_start date;
  v_prev_week_end date;
  v_result jsonb;

  -- Mood
  v_mood_count int;
  v_mood_avg numeric;
  v_prev_mood_avg numeric;
  v_mood_best text;
  v_mood_worst text;
  v_mood_distribution jsonb;

  -- Habits
  v_habit_completions int;
  v_habit_unique_days int;
  v_habit_unique_habits int;
  v_prev_habit_completions int;
  v_top_habit jsonb;

  -- Focus
  v_focus_sessions int;
  v_focus_total_min int;
  v_focus_avg_min int;
  v_prev_focus_total_min int;

  -- Gratitude
  v_gratitude_count int;
  v_prev_gratitude_count int;

  -- Gamification
  v_weekly_xp int;
  v_current_streak int;
  v_badges_unlocked int;
  v_new_badges jsonb;
BEGIN
  -- Auth check
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  -- Week range: Monday to Sunday
  IF p_week_start IS NOT NULL THEN
    v_week_start := p_week_start;
  ELSE
    -- Previous full week (Monday-Sunday)
    v_week_start := date_trunc('week', CURRENT_DATE - interval '7 days')::date;
  END IF;
  v_week_end := v_week_start + 6;
  v_prev_week_start := v_week_start - 7;
  v_prev_week_end := v_week_start - 1;

  -- ===========================
  -- MOOD SUMMARY
  -- ===========================
  SELECT
    COUNT(*),
    ROUND(AVG(
      CASE mood
        WHEN 'great' THEN 5
        WHEN 'good' THEN 4
        WHEN 'okay' THEN 3
        WHEN 'bad' THEN 2
        WHEN 'terrible' THEN 1
      END
    ), 2)
  INTO v_mood_count, v_mood_avg
  FROM moods
  WHERE user_id = v_user_id
    AND date >= v_week_start AND date <= v_week_end;

  -- Previous week mood avg (for trend)
  SELECT ROUND(AVG(
    CASE mood
      WHEN 'great' THEN 5
      WHEN 'good' THEN 4
      WHEN 'okay' THEN 3
      WHEN 'bad' THEN 2
      WHEN 'terrible' THEN 1
    END
  ), 2)
  INTO v_prev_mood_avg
  FROM moods
  WHERE user_id = v_user_id
    AND date >= v_prev_week_start AND date <= v_prev_week_end;

  -- Best and worst mood day
  SELECT mood INTO v_mood_best
  FROM moods
  WHERE user_id = v_user_id
    AND date >= v_week_start AND date <= v_week_end
  ORDER BY
    CASE mood
      WHEN 'great' THEN 5 WHEN 'good' THEN 4 WHEN 'okay' THEN 3
      WHEN 'bad' THEN 2 WHEN 'terrible' THEN 1
    END DESC,
    timestamp DESC
  LIMIT 1;

  SELECT mood INTO v_mood_worst
  FROM moods
  WHERE user_id = v_user_id
    AND date >= v_week_start AND date <= v_week_end
  ORDER BY
    CASE mood
      WHEN 'great' THEN 5 WHEN 'good' THEN 4 WHEN 'okay' THEN 3
      WHEN 'bad' THEN 2 WHEN 'terrible' THEN 1
    END ASC,
    timestamp ASC
  LIMIT 1;

  -- Mood distribution
  SELECT COALESCE(jsonb_object_agg(mood, cnt), '{}'::jsonb)
  INTO v_mood_distribution
  FROM (
    SELECT mood, COUNT(*) as cnt
    FROM moods
    WHERE user_id = v_user_id
      AND date >= v_week_start AND date <= v_week_end
    GROUP BY mood
  ) sub;

  -- ===========================
  -- HABIT SUMMARY
  -- ===========================
  SELECT
    COUNT(*),
    COUNT(DISTINCT date),
    COUNT(DISTINCT habit_id)
  INTO v_habit_completions, v_habit_unique_days, v_habit_unique_habits
  FROM habit_completions
  WHERE user_id = v_user_id
    AND date >= v_week_start AND date <= v_week_end;

  -- Previous week habit completions (for trend)
  SELECT COUNT(*)
  INTO v_prev_habit_completions
  FROM habit_completions
  WHERE user_id = v_user_id
    AND date >= v_prev_week_start AND date <= v_prev_week_end;

  -- Top habit (most completed)
  SELECT jsonb_build_object('name', h.name, 'icon', h.icon, 'count', COUNT(*))
  INTO v_top_habit
  FROM habit_completions hc
  JOIN habits h ON hc.habit_id = h.id
  WHERE hc.user_id = v_user_id
    AND hc.date >= v_week_start AND hc.date <= v_week_end
  GROUP BY h.id, h.name, h.icon
  ORDER BY COUNT(*) DESC
  LIMIT 1;

  -- ===========================
  -- FOCUS SUMMARY
  -- ===========================
  SELECT
    COUNT(*),
    COALESCE(SUM(duration), 0),
    CASE WHEN COUNT(*) > 0 THEN ROUND(AVG(duration)) ELSE 0 END
  INTO v_focus_sessions, v_focus_total_min, v_focus_avg_min
  FROM focus_sessions
  WHERE user_id = v_user_id
    AND date >= v_week_start::text AND date <= v_week_end::text
    AND status = 'completed';

  -- Previous week focus (for trend)
  SELECT COALESCE(SUM(duration), 0)
  INTO v_prev_focus_total_min
  FROM focus_sessions
  WHERE user_id = v_user_id
    AND date >= v_prev_week_start::text AND date <= v_prev_week_end::text
    AND status = 'completed';

  -- ===========================
  -- GRATITUDE SUMMARY
  -- ===========================
  SELECT COUNT(*)
  INTO v_gratitude_count
  FROM gratitude_entries
  WHERE user_id = v_user_id
    AND date >= v_week_start AND date <= v_week_end;

  SELECT COUNT(*)
  INTO v_prev_gratitude_count
  FROM gratitude_entries
  WHERE user_id = v_user_id
    AND date >= v_prev_week_start AND date <= v_prev_week_end;

  -- ===========================
  -- GAMIFICATION
  -- ===========================
  SELECT COALESCE(weekly_xp, 0), COALESCE(current_streak, 0)
  INTO v_weekly_xp, v_current_streak
  FROM leaderboards
  WHERE user_id = v_user_id;

  -- If no leaderboard row exists
  IF v_weekly_xp IS NULL THEN v_weekly_xp := 0; END IF;
  IF v_current_streak IS NULL THEN v_current_streak := 0; END IF;

  -- Badges unlocked this week
  SELECT COUNT(*), COALESCE(jsonb_agg(jsonb_build_object(
    'badge_id', badge_id,
    'category', category,
    'rarity', rarity,
    'unlocked_at', unlocked_at
  )), '[]'::jsonb)
  INTO v_badges_unlocked, v_new_badges
  FROM user_badges
  WHERE user_id = v_user_id
    AND unlocked = true
    AND unlocked_at >= v_week_start::timestamptz
    AND unlocked_at < (v_week_end + 1)::timestamptz;

  -- ===========================
  -- BUILD RESULT
  -- ===========================
  v_result := jsonb_build_object(
    'week_start', v_week_start,
    'week_end', v_week_end,
    'generated_at', NOW(),

    'mood', jsonb_build_object(
      'count', v_mood_count,
      'average', v_mood_avg,
      'previous_average', v_prev_mood_avg,
      'trend', CASE
        WHEN v_mood_avg IS NULL OR v_prev_mood_avg IS NULL THEN 'no_data'
        WHEN v_mood_avg > v_prev_mood_avg THEN 'up'
        WHEN v_mood_avg < v_prev_mood_avg THEN 'down'
        ELSE 'stable'
      END,
      'best_mood', v_mood_best,
      'worst_mood', v_mood_worst,
      'distribution', v_mood_distribution
    ),

    'habits', jsonb_build_object(
      'completions', v_habit_completions,
      'previous_completions', v_prev_habit_completions,
      'trend', CASE
        WHEN v_habit_completions > v_prev_habit_completions THEN 'up'
        WHEN v_habit_completions < v_prev_habit_completions THEN 'down'
        ELSE 'stable'
      END,
      'active_days', v_habit_unique_days,
      'unique_habits', v_habit_unique_habits,
      'top_habit', COALESCE(v_top_habit, 'null'::jsonb)
    ),

    'focus', jsonb_build_object(
      'sessions', v_focus_sessions,
      'total_minutes', v_focus_total_min,
      'average_minutes', v_focus_avg_min,
      'previous_total_minutes', v_prev_focus_total_min,
      'trend', CASE
        WHEN v_focus_total_min > v_prev_focus_total_min THEN 'up'
        WHEN v_focus_total_min < v_prev_focus_total_min THEN 'down'
        ELSE 'stable'
      END
    ),

    'gratitude', jsonb_build_object(
      'count', v_gratitude_count,
      'previous_count', v_prev_gratitude_count,
      'trend', CASE
        WHEN v_gratitude_count > v_prev_gratitude_count THEN 'up'
        WHEN v_gratitude_count < v_prev_gratitude_count THEN 'down'
        ELSE 'stable'
      END
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

-- Grant execute to authenticated users
GRANT EXECUTE ON FUNCTION public.get_user_weekly_summary(date) TO authenticated;

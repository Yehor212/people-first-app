-- Habit completion entry semantics for V2 habit statistics.
-- The legacy habit_completions row meant "some tracked entry happened", but
-- numerical habits need to distinguish partial progress from true completion.

ALTER TABLE public.habit_completions
  ADD COLUMN IF NOT EXISTS entry_value integer,
  ADD COLUMN IF NOT EXISTS entry_status text NOT NULL DEFAULT 'completed',
  ADD COLUMN IF NOT EXISTS is_complete boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS habit_type text NOT NULL DEFAULT 'boolean',
  ADD COLUMN IF NOT EXISTS target_type text;

UPDATE public.habit_completions AS hc
SET
  habit_type = CASE
    WHEN h.type IN ('multiple', 'reduce') THEN 'numerical'
    ELSE 'boolean'
  END,
  target_type = CASE
    WHEN h.type = 'reduce' THEN 'atMost'
    WHEN h.type = 'multiple' THEN 'atLeast'
    ELSE NULL
  END,
  entry_value = CASE
    WHEN h.type IN ('multiple', 'reduce') THEN COALESCE(hc.duration, GREATEST(COALESCE(hc.count, 1), 0) * 1000)
    ELSE 2
  END,
  entry_status = 'completed',
  is_complete = true
FROM public.habits AS h
WHERE h.id = hc.habit_id
  AND (
    hc.entry_value IS NULL
    OR hc.habit_type = 'boolean'
    OR hc.target_type IS NULL
  );

DO $$
BEGIN
  ALTER TABLE public.habit_completions
    ADD CONSTRAINT habit_completions_entry_status_check
    CHECK (entry_status IN ('completed', 'partial', 'over_limit'));
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  ALTER TABLE public.habit_completions
    ADD CONSTRAINT habit_completions_habit_type_check
    CHECK (habit_type IN ('boolean', 'numerical'));
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  ALTER TABLE public.habit_completions
    ADD CONSTRAINT habit_completions_target_type_check
    CHECK (target_type IS NULL OR target_type IN ('atLeast', 'atMost'));
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

CREATE INDEX IF NOT EXISTS idx_habit_completions_user_date_complete
  ON public.habit_completions (user_id, date, habit_id)
  WHERE is_complete = true;

COMMENT ON COLUMN public.habit_completions.entry_value IS
  'Exact local entry value: boolean uses ENTRY constants; numerical stores real value multiplied by 1000.';
COMMENT ON COLUMN public.habit_completions.entry_status IS
  'Semantic entry status for statistics: completed, partial, or over_limit.';
COMMENT ON COLUMN public.habit_completions.is_complete IS
  'True only when the entry met the habit target and should count in completion aggregates.';
COMMENT ON COLUMN public.habit_completions.habit_type IS
  'Local habit type at write time: boolean or numerical.';
COMMENT ON COLUMN public.habit_completions.target_type IS
  'Numerical target direction at write time: atLeast or atMost.';

CREATE OR REPLACE FUNCTION public.get_user_stats(p_user_id UUID)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_stats JSON;
BEGIN
  IF p_user_id != (SELECT auth.uid()) THEN
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
    RAISE EXCEPTION 'Not authenticated';
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

  SELECT COALESCE(jsonb_object_agg(mood, cnt), '{}'::jsonb)
  INTO v_mood_distribution
  FROM (
    SELECT mood, COUNT(*) as cnt
    FROM moods
    WHERE user_id = v_user_id
      AND date >= v_week_start AND date <= v_week_end
    GROUP BY mood
  ) sub;

  SELECT
    COUNT(*),
    COUNT(DISTINCT date),
    COUNT(DISTINCT habit_id)
  INTO v_habit_completions, v_habit_unique_days, v_habit_unique_habits
  FROM habit_completions
  WHERE user_id = v_user_id
    AND date >= v_week_start AND date <= v_week_end
    AND is_complete = true;

  SELECT COUNT(*)
  INTO v_prev_habit_completions
  FROM habit_completions
  WHERE user_id = v_user_id
    AND date >= v_prev_week_start AND date <= v_prev_week_end
    AND is_complete = true;

  SELECT jsonb_build_object('name', h.name, 'icon', h.icon, 'count', COUNT(*))
  INTO v_top_habit
  FROM habit_completions hc
  JOIN habits h ON hc.habit_id = h.id
  WHERE hc.user_id = v_user_id
    AND hc.date >= v_week_start AND hc.date <= v_week_end
    AND hc.is_complete = true
  GROUP BY h.id, h.name, h.icon
  ORDER BY COUNT(*) DESC
  LIMIT 1;

  SELECT
    COUNT(*),
    COALESCE(SUM(duration), 0),
    CASE WHEN COUNT(*) > 0 THEN ROUND(AVG(duration)) ELSE 0 END
  INTO v_focus_sessions, v_focus_total_min, v_focus_avg_min
  FROM focus_sessions
  WHERE user_id = v_user_id
    AND date >= v_week_start AND date <= v_week_end
    AND status = 'completed';

  SELECT COALESCE(SUM(duration), 0)
  INTO v_prev_focus_total_min
  FROM focus_sessions
  WHERE user_id = v_user_id
    AND date >= v_prev_week_start AND date <= v_prev_week_end
    AND status = 'completed';

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

  SELECT COALESCE(weekly_xp, 0), COALESCE(current_streak, 0)
  INTO v_weekly_xp, v_current_streak
  FROM leaderboards
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
  FROM user_badges
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

GRANT EXECUTE ON FUNCTION public.get_user_weekly_summary(date) TO authenticated;

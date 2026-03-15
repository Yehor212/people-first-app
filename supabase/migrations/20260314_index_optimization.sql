-- =============================================
-- Migration: Index cleanup + optimization
-- Created: 2026-03-14
-- Applied via Supabase MCP (already live)
-- Fixes: I1 (push_logs dup), I2 (leaderboards redundant), I3 (user_data redundant)
-- Adds: I4 (moods composite), I5 (habit_completions composite)
-- =============================================

-- I1: Drop duplicate push_logs index (pkey already on same columns)
DROP INDEX IF EXISTS public.push_logs_user_type_date_idx;

-- I2: Drop 3 redundant unfiltered leaderboard indexes
-- (filtered versions with WHERE opt_in = true are strictly better)
DROP INDEX IF EXISTS public.idx_leaderboard_monthly;
DROP INDEX IF EXISTS public.idx_leaderboard_weekly;
DROP INDEX IF EXISTS public.idx_leaderboard_streak;

-- I3: Drop redundant user_data index (unique constraint already creates index)
DROP INDEX IF EXISTS public.idx_user_data_user_id;

-- I4: Composite index for moods (calculate_streak + get_user_weekly_summary)
CREATE INDEX IF NOT EXISTS idx_moods_user_date ON public.moods (user_id, date DESC);

-- I5: Composite index for habit_completions (get_user_weekly_summary)
CREATE INDEX IF NOT EXISTS idx_habit_completions_user_date ON public.habit_completions (user_id, date);

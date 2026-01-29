-- Leaderboards table for ZenFlow v1.3.0 "Harmony"
-- Privacy-first: anonymous by default, opt-in for public display

-- Create leaderboards table
CREATE TABLE IF NOT EXISTS public.leaderboards (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,

  -- Display settings (privacy-first)
  display_name TEXT DEFAULT 'Zen User',
  opt_in BOOLEAN DEFAULT false,

  -- Stats
  weekly_xp INTEGER DEFAULT 0,
  monthly_xp INTEGER DEFAULT 0,
  all_time_xp INTEGER DEFAULT 0,
  current_streak INTEGER DEFAULT 0,
  longest_streak INTEGER DEFAULT 0,

  -- Week tracking (ISO week number)
  current_week INTEGER DEFAULT EXTRACT(WEEK FROM NOW()),
  current_month INTEGER DEFAULT EXTRACT(MONTH FROM NOW()),
  current_year INTEGER DEFAULT EXTRACT(YEAR FROM NOW()),

  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  -- Unique constraint on user_id
  UNIQUE(user_id)
);

-- Enable RLS
ALTER TABLE public.leaderboards ENABLE ROW LEVEL SECURITY;

-- Policy: Users can read all opted-in leaderboard entries
CREATE POLICY "Anyone can view opted-in leaderboards"
  ON public.leaderboards
  FOR SELECT
  USING (opt_in = true);

-- Policy: Users can read their own entry regardless of opt_in
CREATE POLICY "Users can view their own leaderboard entry"
  ON public.leaderboards
  FOR SELECT
  USING (auth.uid() = user_id);

-- Policy: Users can insert their own entry
CREATE POLICY "Users can create their own leaderboard entry"
  ON public.leaderboards
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Policy: Users can update their own entry
CREATE POLICY "Users can update their own leaderboard entry"
  ON public.leaderboards
  FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Policy: Users can delete their own entry
CREATE POLICY "Users can delete their own leaderboard entry"
  ON public.leaderboards
  FOR DELETE
  USING (auth.uid() = user_id);

-- Create indexes for efficient queries
CREATE INDEX IF NOT EXISTS idx_leaderboards_weekly_xp ON public.leaderboards (weekly_xp DESC) WHERE opt_in = true;
CREATE INDEX IF NOT EXISTS idx_leaderboards_monthly_xp ON public.leaderboards (monthly_xp DESC) WHERE opt_in = true;
CREATE INDEX IF NOT EXISTS idx_leaderboards_streak ON public.leaderboards (current_streak DESC) WHERE opt_in = true;
CREATE INDEX IF NOT EXISTS idx_leaderboards_user_id ON public.leaderboards (user_id);

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_leaderboards_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger for updated_at
DROP TRIGGER IF EXISTS leaderboards_updated_at ON public.leaderboards;
CREATE TRIGGER leaderboards_updated_at
  BEFORE UPDATE ON public.leaderboards
  FOR EACH ROW
  EXECUTE FUNCTION update_leaderboards_updated_at();

-- Function to reset weekly stats (call via cron)
CREATE OR REPLACE FUNCTION reset_weekly_leaderboard()
RETURNS void AS $$
BEGIN
  UPDATE public.leaderboards
  SET
    weekly_xp = 0,
    current_week = EXTRACT(WEEK FROM NOW())
  WHERE current_week != EXTRACT(WEEK FROM NOW());
END;
$$ LANGUAGE plpgsql;

-- Function to reset monthly stats (call via cron)
CREATE OR REPLACE FUNCTION reset_monthly_leaderboard()
RETURNS void AS $$
BEGIN
  UPDATE public.leaderboards
  SET
    monthly_xp = 0,
    current_month = EXTRACT(MONTH FROM NOW())
  WHERE current_month != EXTRACT(MONTH FROM NOW());
END;
$$ LANGUAGE plpgsql;

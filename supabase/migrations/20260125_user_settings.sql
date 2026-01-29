-- User Settings table for ZenFlow v1.3.0
-- Stores per-user preferences like weekly digest subscription

CREATE TABLE IF NOT EXISTS public.user_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL UNIQUE,

  -- Weekly digest preference
  weekly_digest_enabled BOOLEAN DEFAULT false,

  -- Future settings can be added here
  -- theme TEXT DEFAULT 'auto',
  -- notifications_enabled BOOLEAN DEFAULT true,

  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE public.user_settings ENABLE ROW LEVEL SECURITY;

-- Users can view their own settings
CREATE POLICY "Users can view own settings"
  ON public.user_settings
  FOR SELECT
  USING (auth.uid() = user_id);

-- Users can create their own settings
CREATE POLICY "Users can create own settings"
  ON public.user_settings
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Users can update their own settings
CREATE POLICY "Users can update own settings"
  ON public.user_settings
  FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Index for fast lookup
CREATE INDEX IF NOT EXISTS idx_user_settings_user_id ON public.user_settings(user_id);
CREATE INDEX IF NOT EXISTS idx_user_settings_weekly_digest ON public.user_settings(weekly_digest_enabled) WHERE weekly_digest_enabled = true;

-- Auto-update timestamp
CREATE OR REPLACE FUNCTION update_user_settings_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS user_settings_timestamp ON public.user_settings;
CREATE TRIGGER user_settings_timestamp
  BEFORE UPDATE ON public.user_settings
  FOR EACH ROW
  EXECUTE FUNCTION update_user_settings_timestamp();

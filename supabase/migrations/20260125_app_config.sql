-- App configuration table for storing app settings like version info
-- This table is used for fallback update checking when Google Play In-App Updates is unavailable

CREATE TABLE IF NOT EXISTS public.app_config (
  key TEXT PRIMARY KEY,
  value JSONB NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE public.app_config ENABLE ROW LEVEL SECURITY;

-- Anyone can read config (needed for app to check version)
CREATE POLICY "Anyone can read app_config"
  ON public.app_config FOR SELECT
  USING (true);

-- Only authenticated users with service role can update (admin only)
CREATE POLICY "Service role can update app_config"
  ON public.app_config FOR UPDATE
  USING (auth.role() = 'service_role');

CREATE POLICY "Service role can insert app_config"
  ON public.app_config FOR INSERT
  WITH CHECK (auth.role() = 'service_role');

-- Insert initial version config
-- Update this when releasing new versions!
INSERT INTO public.app_config (key, value) VALUES
  ('app_version', '{"latestVersion": "1.3.5", "minVersion": "1.0.0", "forceUpdate": false, "releaseNotes": "Security & Stability: PKCE improvements, deadlock prevention, CSS sanitization, sensitive data redaction"}')
ON CONFLICT (key) DO UPDATE SET
  value = EXCLUDED.value,
  updated_at = NOW();

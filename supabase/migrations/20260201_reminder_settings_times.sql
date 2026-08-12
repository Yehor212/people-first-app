-- Add morning/afternoon/evening mood check-in times to reminder settings
-- The old mood_time column is replaced with three specific time slots

-- Some historical environments created this table through
-- supabase/sql/user_reminder_settings.sql instead of migration history.
-- Establish the same baseline before applying the column transition so a
-- clean local replay and an already-provisioned environment converge.
CREATE TABLE IF NOT EXISTS public.user_reminder_settings (
  user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  enabled BOOLEAN NOT NULL DEFAULT FALSE,
  mood_time TEXT,
  mood_time_morning TEXT,
  mood_time_afternoon TEXT,
  mood_time_evening TEXT,
  habit_time TEXT,
  focus_time TEXT,
  days INT[] NOT NULL DEFAULT '{}',
  quiet_start TEXT,
  quiet_end TEXT,
  habit_ids TEXT[] NOT NULL DEFAULT '{}',
  timezone TEXT,
  language TEXT,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.user_reminder_settings ENABLE ROW LEVEL SECURITY;

-- Add new columns
ALTER TABLE public.user_reminder_settings
ADD COLUMN IF NOT EXISTS mood_time_morning text,
ADD COLUMN IF NOT EXISTS mood_time_afternoon text,
ADD COLUMN IF NOT EXISTS mood_time_evening text;

-- Migrate old mood_time to mood_time_morning (default slot)
UPDATE public.user_reminder_settings
SET mood_time_morning = mood_time
WHERE mood_time IS NOT NULL AND mood_time_morning IS NULL;

-- Drop old column (optional - keep for backwards compatibility)
-- ALTER TABLE public.user_reminder_settings DROP COLUMN IF EXISTS mood_time;

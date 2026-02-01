-- Add morning/afternoon/evening mood check-in times to reminder settings
-- The old mood_time column is replaced with three specific time slots

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

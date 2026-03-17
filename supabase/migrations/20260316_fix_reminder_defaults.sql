-- Fix missing DEFAULT values on NOT NULL columns.
-- Root cause: table was created by 20260307 migration without defaults,
-- then 20260311's CREATE TABLE IF NOT EXISTS was skipped (table already existed).
-- This caused 400 errors when any field was omitted from the upsert payload.

ALTER TABLE public.user_reminder_settings
  ALTER COLUMN enabled SET DEFAULT FALSE,
  ALTER COLUMN days SET DEFAULT '{}',
  ALTER COLUMN mood_time SET DEFAULT '09:00',
  ALTER COLUMN habit_time SET DEFAULT '08:00',
  ALTER COLUMN focus_time SET DEFAULT '14:00',
  ALTER COLUMN quiet_start SET DEFAULT '22:00',
  ALTER COLUMN quiet_end SET DEFAULT '07:00',
  ALTER COLUMN timezone SET DEFAULT 'UTC',
  ALTER COLUMN habit_ids SET DEFAULT '{}';

-- Force PostgREST to pick up new defaults
NOTIFY pgrst, 'reload schema';

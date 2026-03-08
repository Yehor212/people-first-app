-- State of Mind: extend moods table for Apple Health-style mood tracking
-- New columns: valence (continuous -1.0 to 1.0), log_type, emotion_tags, contexts
-- Drop UNIQUE(user_id, date) to allow multiple entries per day

-- Add new columns
ALTER TABLE public.moods ADD COLUMN IF NOT EXISTS valence REAL;
ALTER TABLE public.moods ADD COLUMN IF NOT EXISTS log_type TEXT DEFAULT 'momentary';
ALTER TABLE public.moods ADD COLUMN IF NOT EXISTS emotion_tags TEXT[] DEFAULT '{}';
ALTER TABLE public.moods ADD COLUMN IF NOT EXISTS contexts TEXT[] DEFAULT '{}';

-- Drop the unique constraint on (user_id, date) to allow multiple daily entries
-- The constraint name from 001_initial_schema.sql is auto-generated as "moods_user_id_date_key"
ALTER TABLE public.moods DROP CONSTRAINT IF EXISTS moods_user_id_date_key;

-- Also drop old index if it exists (some Supabase deployments create separate index)
DROP INDEX IF EXISTS idx_moods_user_date_unique;

-- Make mood column nullable for future entries (valence replaces it)
-- Drop existing CHECK constraint that blocks NULL values, then re-add with NULL allowed
ALTER TABLE public.moods DROP CONSTRAINT IF EXISTS moods_mood_check;
ALTER TABLE public.moods ALTER COLUMN mood DROP NOT NULL;
-- Re-add CHECK: allow NULL (valence-only entries) OR valid legacy mood values
ALTER TABLE public.moods ADD CONSTRAINT moods_mood_check
  CHECK (mood IS NULL OR mood IN ('great', 'good', 'okay', 'bad', 'terrible'));

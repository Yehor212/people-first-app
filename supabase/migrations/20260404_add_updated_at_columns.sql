-- Add updated_at column to focus_sessions and gratitude_entries
-- for cross-device timestamp-based merge
-- (moods table already has updated_at)

ALTER TABLE focus_sessions
  ADD COLUMN IF NOT EXISTS updated_at timestamptz DEFAULT now();

ALTER TABLE gratitude_entries
  ADD COLUMN IF NOT EXISTS updated_at timestamptz DEFAULT now();

-- Backfill existing rows with their creation timestamp
UPDATE focus_sessions SET updated_at = to_timestamp(completed_at / 1000.0) WHERE updated_at IS NULL;
UPDATE gratitude_entries SET updated_at = to_timestamp(timestamp / 1000.0) WHERE updated_at IS NULL;

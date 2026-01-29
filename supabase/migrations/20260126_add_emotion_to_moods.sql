-- Migration: Add emotion JSONB column to moods table
-- Date: 2026-01-26
-- Description: Support for Plutchik emotion wheel data (primary, secondary, intensity)

-- Add emotion JSONB column to moods table
ALTER TABLE moods ADD COLUMN IF NOT EXISTS emotion JSONB;

-- Create GIN index for emotion queries (enables fast JSONB containment searches)
CREATE INDEX IF NOT EXISTS idx_moods_emotion ON moods USING GIN (emotion);

-- Add comment for documentation
COMMENT ON COLUMN moods.emotion IS 'Plutchik emotion data: {primary: string, secondary?: string, intensity: mild|moderate|intense}';

-- Example emotion data structure:
-- {
--   "primary": "joy",
--   "secondary": "serenity",
--   "intensity": "moderate"
-- }

-- ZenFlow User Backups - Safe Migration (can be re-run)
-- This script handles the user_backups table that is used for cloud sync

-- ============================================
-- USER BACKUPS TABLE (for cloud sync)
-- ============================================

-- Create table if not exists
CREATE TABLE IF NOT EXISTS user_backups (
  user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  payload JSONB NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS (safe to call multiple times)
ALTER TABLE user_backups ENABLE ROW LEVEL SECURITY;

-- Drop existing policies (if any) and recreate
DROP POLICY IF EXISTS "Users can CRUD own backups" ON user_backups;
DROP POLICY IF EXISTS "Users can read own backups" ON user_backups;
DROP POLICY IF EXISTS "Users can upsert own backups" ON user_backups;
DROP POLICY IF EXISTS "Users can insert own backups" ON user_backups;
DROP POLICY IF EXISTS "Users can update own backups" ON user_backups;
DROP POLICY IF EXISTS "Users can delete own backups" ON user_backups;

-- Create single policy for all operations
CREATE POLICY "Users can CRUD own backups" ON user_backups
  FOR ALL USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Create updated_at trigger
CREATE OR REPLACE FUNCTION update_user_backups_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS update_user_backups_updated_at ON user_backups;
CREATE TRIGGER update_user_backups_updated_at
  BEFORE UPDATE ON user_backups
  FOR EACH ROW EXECUTE FUNCTION update_user_backups_updated_at();

-- Grant access to authenticated users
GRANT ALL ON user_backups TO authenticated;

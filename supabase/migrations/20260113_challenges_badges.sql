-- Migration: Add Challenges and Badges tables
-- Created: 2026-01-13
-- Description: Tables for storing user challenges and badges for cloud sync

-- Enable UUID extension if not already enabled
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Table: user_challenges
-- Stores all challenges that users have started
CREATE TABLE IF NOT EXISTS user_challenges (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,

  -- Challenge identification
  challenge_id TEXT NOT NULL, -- Local challenge ID
  type TEXT NOT NULL CHECK (type IN ('streak', 'total', 'focus', 'gratitude')),

  -- Progress tracking
  progress INTEGER DEFAULT 0,
  target INTEGER NOT NULL,
  completed BOOLEAN DEFAULT FALSE,

  -- Dates
  started_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  completed_at TIMESTAMP WITH TIME ZONE,

  -- Challenge details (multilingual)
  icon TEXT NOT NULL,
  title JSONB NOT NULL DEFAULT '{}'::jsonb,
  description JSONB NOT NULL DEFAULT '{}'::jsonb,

  -- Optional fields
  habit_id TEXT, -- For habit-specific challenges
  end_date DATE,
  reward TEXT, -- Badge ID to unlock on completion

  -- Metadata
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

  -- Ensure user can't have duplicate challenges
  UNIQUE(user_id, challenge_id)
);

-- Table: user_badges
-- Stores all badges and their unlock status
CREATE TABLE IF NOT EXISTS user_badges (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,

  -- Badge identification
  badge_id TEXT NOT NULL,
  category TEXT NOT NULL CHECK (category IN ('streak', 'habit', 'focus', 'gratitude', 'special')),

  -- Unlock status
  unlocked BOOLEAN DEFAULT FALSE,
  unlocked_at TIMESTAMP WITH TIME ZONE,

  -- Badge details (multilingual)
  icon TEXT NOT NULL,
  title JSONB NOT NULL DEFAULT '{}'::jsonb,
  description JSONB NOT NULL DEFAULT '{}'::jsonb,

  -- Requirements
  requirement INTEGER NOT NULL,
  rarity TEXT NOT NULL CHECK (rarity IN ('common', 'rare', 'epic', 'legendary')),

  -- Metadata
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

  -- Ensure user can't have duplicate badges
  UNIQUE(user_id, badge_id)
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_user_challenges_user_id ON user_challenges(user_id);
CREATE INDEX IF NOT EXISTS idx_user_challenges_completed ON user_challenges(user_id, completed);
CREATE INDEX IF NOT EXISTS idx_user_challenges_type ON user_challenges(user_id, type);
CREATE INDEX IF NOT EXISTS idx_user_challenges_updated ON user_challenges(user_id, updated_at DESC);

CREATE INDEX IF NOT EXISTS idx_user_badges_user_id ON user_badges(user_id);
CREATE INDEX IF NOT EXISTS idx_user_badges_unlocked ON user_badges(user_id, unlocked);
CREATE INDEX IF NOT EXISTS idx_user_badges_category ON user_badges(user_id, category);
CREATE INDEX IF NOT EXISTS idx_user_badges_rarity ON user_badges(user_id, rarity);

-- Function: Update updated_at timestamp automatically
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Triggers for updated_at
DROP TRIGGER IF EXISTS update_user_challenges_updated_at ON user_challenges;
CREATE TRIGGER update_user_challenges_updated_at
  BEFORE UPDATE ON user_challenges
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_user_badges_updated_at ON user_badges;
CREATE TRIGGER update_user_badges_updated_at
  BEFORE UPDATE ON user_badges
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Row Level Security (RLS) policies

-- Enable RLS
ALTER TABLE user_challenges ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_badges ENABLE ROW LEVEL SECURITY;

-- Policies for user_challenges
-- Users can only see their own challenges
CREATE POLICY "Users can view their own challenges"
  ON user_challenges FOR SELECT
  USING (auth.uid() = user_id);

-- Users can insert their own challenges
CREATE POLICY "Users can insert their own challenges"
  ON user_challenges FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Users can update their own challenges
CREATE POLICY "Users can update their own challenges"
  ON user_challenges FOR UPDATE
  USING (auth.uid() = user_id);

-- Users can delete their own challenges
CREATE POLICY "Users can delete their own challenges"
  ON user_challenges FOR DELETE
  USING (auth.uid() = user_id);

-- Policies for user_badges
-- Users can only see their own badges
CREATE POLICY "Users can view their own badges"
  ON user_badges FOR SELECT
  USING (auth.uid() = user_id);

-- Users can insert their own badges
CREATE POLICY "Users can insert their own badges"
  ON user_badges FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Users can update their own badges
CREATE POLICY "Users can update their own badges"
  ON user_badges FOR UPDATE
  USING (auth.uid() = user_id);

-- Users can delete their own badges
CREATE POLICY "Users can delete their own badges"
  ON user_badges FOR DELETE
  USING (auth.uid() = user_id);

-- Comments for documentation
COMMENT ON TABLE user_challenges IS 'Stores user challenges for tracking goals and awarding badges';
COMMENT ON TABLE user_badges IS 'Stores user badges and their unlock status';

COMMENT ON COLUMN user_challenges.challenge_id IS 'Local challenge identifier for matching with app templates';
COMMENT ON COLUMN user_challenges.type IS 'Type of challenge: streak, total, focus, or gratitude';
COMMENT ON COLUMN user_challenges.progress IS 'Current progress towards target';
COMMENT ON COLUMN user_challenges.target IS 'Target value to complete challenge';
COMMENT ON COLUMN user_challenges.title IS 'Challenge title in multiple languages (JSONB)';
COMMENT ON COLUMN user_challenges.description IS 'Challenge description in multiple languages (JSONB)';

COMMENT ON COLUMN user_badges.badge_id IS 'Unique badge identifier matching app badge definitions';
COMMENT ON COLUMN user_badges.category IS 'Badge category: streak, habit, focus, gratitude, or special';
COMMENT ON COLUMN user_badges.unlocked IS 'Whether the badge has been unlocked';
COMMENT ON COLUMN user_badges.rarity IS 'Badge rarity: common, rare, epic, or legendary';

-- Friend Challenges Backend
-- Part of Phase 5.15 - Participants Leaderboard
-- Created: 2026-02-01

-- ===========================================
-- TABLE: friend_challenges (master record)
-- ===========================================
CREATE TABLE IF NOT EXISTS public.friend_challenges (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Challenge identification
  code TEXT NOT NULL UNIQUE, -- ZEN-XXXXXX
  creator_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,

  -- Challenge details
  habit_name TEXT NOT NULL,
  habit_icon TEXT NOT NULL DEFAULT '🎯',
  duration INTEGER NOT NULL CHECK (duration > 0 AND duration <= 365),

  -- Dates
  start_date DATE NOT NULL DEFAULT CURRENT_DATE,
  end_date DATE NOT NULL,

  -- Status
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'completed', 'expired')),

  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ===========================================
-- TABLE: friend_challenge_members
-- ===========================================
CREATE TABLE IF NOT EXISTS public.friend_challenge_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- References
  challenge_id UUID REFERENCES public.friend_challenges(id) ON DELETE CASCADE NOT NULL,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,

  -- Display
  display_name TEXT NOT NULL DEFAULT 'Zen User',

  -- Progress tracking
  days_completed INTEGER DEFAULT 0,
  current_streak INTEGER DEFAULT 0,
  last_activity_date DATE,

  -- Status
  completed BOOLEAN DEFAULT FALSE,
  completed_at TIMESTAMPTZ,

  -- Timestamps
  joined_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  -- One user per challenge
  UNIQUE(challenge_id, user_id)
);

-- ===========================================
-- INDEXES
-- ===========================================
CREATE INDEX IF NOT EXISTS idx_friend_challenges_code ON public.friend_challenges(code);
CREATE INDEX IF NOT EXISTS idx_friend_challenges_creator ON public.friend_challenges(creator_id);
CREATE INDEX IF NOT EXISTS idx_friend_challenges_status ON public.friend_challenges(status);

CREATE INDEX IF NOT EXISTS idx_friend_challenge_members_challenge ON public.friend_challenge_members(challenge_id);
CREATE INDEX IF NOT EXISTS idx_friend_challenge_members_user ON public.friend_challenge_members(user_id);
CREATE INDEX IF NOT EXISTS idx_friend_challenge_members_progress ON public.friend_challenge_members(challenge_id, days_completed DESC);

-- ===========================================
-- RLS POLICIES
-- ===========================================
ALTER TABLE public.friend_challenges ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.friend_challenge_members ENABLE ROW LEVEL SECURITY;

-- friend_challenges policies
-- Anyone can view challenges (for joining by code)
CREATE POLICY "Anyone can view challenges"
  ON public.friend_challenges FOR SELECT
  USING (true);

-- Creator can insert
CREATE POLICY "Users can create challenges"
  ON public.friend_challenges FOR INSERT
  WITH CHECK (auth.uid() = creator_id);

-- Creator can update
CREATE POLICY "Creator can update challenge"
  ON public.friend_challenges FOR UPDATE
  USING (auth.uid() = creator_id);

-- Creator can delete
CREATE POLICY "Creator can delete challenge"
  ON public.friend_challenges FOR DELETE
  USING (auth.uid() = creator_id);

-- friend_challenge_members policies
-- Participants can see all members of challenges they're in
CREATE POLICY "Members can view challenge participants"
  ON public.friend_challenge_members FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.friend_challenge_members m
      WHERE m.challenge_id = friend_challenge_members.challenge_id
        AND m.user_id = auth.uid()
    )
  );

-- Users can join challenges
CREATE POLICY "Users can join challenges"
  ON public.friend_challenge_members FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Users can update their own progress
CREATE POLICY "Users can update own progress"
  ON public.friend_challenge_members FOR UPDATE
  USING (auth.uid() = user_id);

-- Users can leave challenges
CREATE POLICY "Users can leave challenges"
  ON public.friend_challenge_members FOR DELETE
  USING (auth.uid() = user_id);

-- ===========================================
-- TRIGGERS
-- ===========================================
CREATE OR REPLACE FUNCTION update_friend_challenge_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS friend_challenges_updated_at ON public.friend_challenges;
CREATE TRIGGER friend_challenges_updated_at
  BEFORE UPDATE ON public.friend_challenges
  FOR EACH ROW
  EXECUTE FUNCTION update_friend_challenge_updated_at();

DROP TRIGGER IF EXISTS friend_challenge_members_updated_at ON public.friend_challenge_members;
CREATE TRIGGER friend_challenge_members_updated_at
  BEFORE UPDATE ON public.friend_challenge_members
  FOR EACH ROW
  EXECUTE FUNCTION update_friend_challenge_updated_at();

-- ===========================================
-- HELPER FUNCTIONS
-- ===========================================

-- Drop existing functions if they have different signatures
DROP FUNCTION IF EXISTS get_challenge_leaderboard(UUID);
DROP FUNCTION IF EXISTS update_member_progress(UUID, UUID, INTEGER, INTEGER);

-- Get challenge leaderboard
CREATE OR REPLACE FUNCTION get_challenge_leaderboard(p_challenge_id UUID)
RETURNS TABLE (
  id UUID,
  challenge_id UUID,
  user_id UUID,
  display_name TEXT,
  days_completed INTEGER,
  current_streak INTEGER,
  last_activity_date DATE,
  completed BOOLEAN,
  completed_at TIMESTAMPTZ,
  joined_at TIMESTAMPTZ
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    m.id,
    m.challenge_id,
    m.user_id,
    m.display_name,
    m.days_completed,
    m.current_streak,
    m.last_activity_date,
    m.completed,
    m.completed_at,
    m.joined_at
  FROM public.friend_challenge_members m
  WHERE m.challenge_id = p_challenge_id
  ORDER BY m.days_completed DESC, m.current_streak DESC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Update progress and check completion
CREATE OR REPLACE FUNCTION update_member_progress(
  p_challenge_id UUID,
  p_user_id UUID,
  p_days_completed INTEGER,
  p_current_streak INTEGER
)
RETURNS public.friend_challenge_members AS $$
DECLARE
  v_challenge public.friend_challenges;
  v_member public.friend_challenge_members;
BEGIN
  -- Get challenge info
  SELECT * INTO v_challenge FROM public.friend_challenges WHERE id = p_challenge_id;

  -- Update member progress
  UPDATE public.friend_challenge_members
  SET
    days_completed = p_days_completed,
    current_streak = p_current_streak,
    last_activity_date = CURRENT_DATE,
    completed = CASE WHEN p_days_completed >= v_challenge.duration THEN TRUE ELSE FALSE END,
    completed_at = CASE WHEN p_days_completed >= v_challenge.duration AND completed_at IS NULL THEN NOW() ELSE completed_at END
  WHERE challenge_id = p_challenge_id AND user_id = p_user_id
  RETURNING * INTO v_member;

  RETURN v_member;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Enable realtime for members table (to see updates from other participants)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime'
    AND tablename = 'friend_challenge_members'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.friend_challenge_members;
  END IF;
END $$;

-- Comments
COMMENT ON TABLE public.friend_challenges IS 'Friend challenge definitions for social habit tracking';
COMMENT ON TABLE public.friend_challenge_members IS 'Challenge participants and their progress';
COMMENT ON FUNCTION get_challenge_leaderboard IS 'Get ranked leaderboard for a challenge';
COMMENT ON FUNCTION update_member_progress IS 'Update member progress and auto-complete if target reached';

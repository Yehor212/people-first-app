-- =============================================
-- Migration: Security Hardening — RLS + Function Auth
-- Created: 2026-03-14
-- Applied via Supabase MCP (already live)
-- Fixes: S2 (feedback RLS), S3 (friend_challenges RLS), S5 (update_member_progress auth)
-- =============================================

-- S2: Fix feedback RLS — remove overly permissive policy
-- feedback table has no user_id (anonymous), so no authenticated user should read ALL
-- Service role policy already exists separately
DROP POLICY IF EXISTS "Admins can read feedback" ON public.feedback;

-- S3: Fix friend_challenges RLS — restrict to participants only
-- Previously: friend_challenges_select had qual=true (anyone could read all challenges)
DROP POLICY IF EXISTS "friend_challenges_select" ON public.friend_challenges;
CREATE POLICY "friend_challenges_select"
  ON public.friend_challenges FOR SELECT TO authenticated
  USING (
    creator_id = auth.uid() OR
    id IN (SELECT challenge_id FROM public.friend_challenge_members WHERE user_id = auth.uid())
  );

-- S5: Add authorization check to update_member_progress
-- Previously: accepted any p_user_id without verifying it matches the caller
CREATE OR REPLACE FUNCTION public.update_member_progress(
  p_challenge_id UUID,
  p_user_id UUID,
  p_days_completed INTEGER,
  p_current_streak INTEGER
)
RETURNS public.friend_challenge_members
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_challenge public.friend_challenges;
  v_member public.friend_challenge_members;
BEGIN
  -- Authorization: caller can only update their own progress
  IF p_user_id != auth.uid() THEN
    RAISE EXCEPTION 'Unauthorized: cannot update another user''s progress';
  END IF;

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
$$;

REVOKE ALL ON FUNCTION public.update_member_progress(UUID, UUID, INTEGER, INTEGER) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.update_member_progress(UUID, UUID, INTEGER, INTEGER) TO authenticated;

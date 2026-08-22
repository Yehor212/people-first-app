-- Private, authenticated friend-challenge join by opaque code.
-- The base table stays participant-only under RLS. This RPC performs the
-- lookup and membership insert atomically without exposing creator identity.

-- The historical member SELECT policy queried friend_challenge_members from
-- inside that table's own RLS predicate. PostgreSQL re-entered the policy and
-- rejected every authenticated participant read with SQLSTATE 42P17. This
-- narrowly scoped predicate runs as the table owner to perform only the
-- caller's indexed self-membership check; it never returns member identity.
CREATE OR REPLACE FUNCTION public.is_friend_challenge_participant(
  p_challenge_id UUID
)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT
    (SELECT auth.uid()) IS NOT NULL
    AND EXISTS (
      SELECT 1
      FROM public.friend_challenge_members AS member
      WHERE member.challenge_id = p_challenge_id
        AND member.user_id = (SELECT auth.uid())
    );
$$;

REVOKE ALL ON FUNCTION public.is_friend_challenge_participant(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.is_friend_challenge_participant(uuid) FROM anon;
REVOKE ALL ON FUNCTION public.is_friend_challenge_participant(uuid) FROM service_role;
GRANT EXECUTE ON FUNCTION public.is_friend_challenge_participant(uuid) TO authenticated;

DROP POLICY IF EXISTS "friend_challenge_members_select" ON public.friend_challenge_members;
CREATE POLICY "friend_challenge_members_select"
  ON public.friend_challenge_members
  FOR SELECT
  TO authenticated
  USING ((SELECT public.is_friend_challenge_participant(friend_challenge_members.challenge_id)));

DROP POLICY IF EXISTS "friend_challenges_select" ON public.friend_challenges;
CREATE POLICY "friend_challenges_select"
  ON public.friend_challenges
  FOR SELECT
  TO authenticated
  USING (
    creator_id = (SELECT auth.uid())
    OR (SELECT public.is_friend_challenge_participant(friend_challenges.id))
  );

-- The projected schema's postgres default ACL deliberately omits CRUD, so RLS
-- alone is not sufficient to admit participant reads. Grant only SELECT to the
-- authenticated role and remove non-read table capabilities from API roles;
-- the join write remains confined to the authenticated security-definer RPC.
REVOKE ALL ON TABLE public.friend_challenges FROM PUBLIC, anon;
REVOKE ALL ON TABLE public.friend_challenge_members FROM PUBLIC, anon;
REVOKE INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER, MAINTAIN
  ON TABLE public.friend_challenges FROM authenticated;
REVOKE INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER, MAINTAIN
  ON TABLE public.friend_challenge_members FROM authenticated;
GRANT SELECT ON TABLE public.friend_challenges TO authenticated;
GRANT SELECT ON TABLE public.friend_challenge_members TO authenticated;

CREATE TABLE public.friend_challenge_join_attempts (
  user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  window_started_at TIMESTAMPTZ NOT NULL,
  attempt_count INTEGER NOT NULL CHECK (attempt_count BETWEEN 1 AND 11)
);

CREATE INDEX friend_challenge_join_attempts_retention_idx
  ON public.friend_challenge_join_attempts (window_started_at);

ALTER TABLE public.friend_challenge_join_attempts ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE public.friend_challenge_join_attempts FROM PUBLIC;
REVOKE ALL ON TABLE public.friend_challenge_join_attempts FROM anon;
REVOKE ALL ON TABLE public.friend_challenge_join_attempts FROM authenticated;

CREATE OR REPLACE FUNCTION public.join_friend_challenge_by_code(p_code TEXT)
RETURNS TABLE (
  code TEXT,
  habit_name TEXT,
  habit_icon TEXT,
  duration INTEGER,
  start_date DATE
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_user_id UUID := auth.uid();
  v_code TEXT := upper(btrim(p_code));
  v_attempt_count INTEGER;
  v_challenge public.friend_challenges%ROWTYPE;
BEGIN
  -- Authentication is checked before any code lookup or rate-limit state write.
  IF v_user_id IS NULL THEN
    RETURN;
  END IF;

  -- The rate-limit record has no diagnostic value after one day. Lazy global
  -- expiry makes ordinary authenticated traffic a bounded deletion path;
  -- auth-account deletion remains an immediate per-user CASCADE clear path.
  DELETE FROM public.friend_challenge_join_attempts
  WHERE window_started_at < clock_timestamp() - INTERVAL '1 day';

  -- Generated codes omit ambiguous characters. Invalid inputs receive the
  -- same empty result as missing, expired, and rate-limited codes.
  IF v_code !~ '^ZEN-[A-HJ-NP-Z2-9]{6}$' THEN
    RETURN;
  END IF;

  -- One row per authenticated principal makes retention bounded. The atomic
  -- UPSERT takes the row lock, so concurrent attempts cannot bypass the limit.
  INSERT INTO public.friend_challenge_join_attempts AS attempts (
    user_id,
    window_started_at,
    attempt_count
  )
  VALUES (v_user_id, clock_timestamp(), 1)
  ON CONFLICT (user_id) DO UPDATE
  SET
    window_started_at = CASE
      WHEN attempts.window_started_at < clock_timestamp() - INTERVAL '5 minutes'
        THEN clock_timestamp()
      ELSE attempts.window_started_at
    END,
    attempt_count = CASE
      WHEN attempts.window_started_at < clock_timestamp() - INTERVAL '5 minutes'
        THEN 1
      ELSE LEAST(attempts.attempt_count + 1, 11)
    END
  RETURNING attempts.attempt_count INTO v_attempt_count;

  IF v_attempt_count > 10 THEN
    RETURN;
  END IF;

  SELECT challenge.*
  INTO v_challenge
  FROM public.friend_challenges AS challenge
  WHERE challenge.code = v_code
    AND challenge.status = 'active'
    AND challenge.end_date >= CURRENT_DATE
  LIMIT 1;

  IF NOT FOUND THEN
    RETURN;
  END IF;

  INSERT INTO public.friend_challenge_members (challenge_id, user_id)
  VALUES (v_challenge.id, v_user_id)
  ON CONFLICT (challenge_id, user_id) DO NOTHING;

  RETURN QUERY
  SELECT
    v_challenge.code,
    v_challenge.habit_name,
    v_challenge.habit_icon,
    v_challenge.duration,
    v_challenge.start_date;
END;
$$;

REVOKE ALL ON FUNCTION public.join_friend_challenge_by_code(text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.join_friend_challenge_by_code(text) FROM anon;
GRANT EXECUTE ON FUNCTION public.join_friend_challenge_by_code(text) TO authenticated;

COMMENT ON TABLE public.friend_challenge_join_attempts IS
  'One private rate-limit window per authenticated joiner; lazily purged after one day and cascade-cleared with auth account deletion.';
COMMENT ON FUNCTION public.is_friend_challenge_participant(uuid) IS
  'RLS-only self-membership predicate; returns no challenge or participant identity.';
COMMENT ON FUNCTION public.join_friend_challenge_by_code(text) IS
  'Atomically joins an authenticated user by opaque code and returns a minimal challenge preview.';

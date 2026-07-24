-- AI-assisted journal search is opt-in. The server remains authoritative even
-- when a stale or modified client attempts to call the Edge Functions directly.

CREATE TABLE IF NOT EXISTS public.journal_ai_consents (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  granted_at timestamptz,
  revoked_at timestamptz,
  generation bigint NOT NULL DEFAULT 0,
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT journal_ai_consents_single_state
    CHECK ((granted_at IS NOT NULL) <> (revoked_at IS NOT NULL))
);

ALTER TABLE public.journal_ai_consents
  ADD COLUMN IF NOT EXISTS generation bigint NOT NULL DEFAULT 0;

ALTER TABLE public.journal_ai_consents ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE public.journal_ai_consents FROM PUBLIC, anon;
GRANT SELECT, INSERT, UPDATE ON TABLE public.journal_ai_consents TO authenticated;

DROP POLICY IF EXISTS "Users can read own journal AI consent"
  ON public.journal_ai_consents;
CREATE POLICY "Users can read own journal AI consent"
  ON public.journal_ai_consents
  FOR SELECT
  TO authenticated
  USING ((SELECT auth.uid()) = user_id);

DROP POLICY IF EXISTS "Users can insert own journal AI consent"
  ON public.journal_ai_consents;
CREATE POLICY "Users can insert own journal AI consent"
  ON public.journal_ai_consents
  FOR INSERT
  TO authenticated
  WITH CHECK ((SELECT auth.uid()) = user_id);

DROP POLICY IF EXISTS "Users can update own journal AI consent"
  ON public.journal_ai_consents;
CREATE POLICY "Users can update own journal AI consent"
  ON public.journal_ai_consents
  FOR UPDATE
  TO authenticated
  USING ((SELECT auth.uid()) = user_id)
  WITH CHECK ((SELECT auth.uid()) = user_id);

DROP FUNCTION IF EXISTS public.grant_journal_ai_consent();
CREATE OR REPLACE FUNCTION public.grant_journal_ai_consent(p_expected_generation bigint)
RETURNS boolean
LANGUAGE plpgsql
VOLATILE
SECURITY INVOKER
SET search_path = ''
AS $$
DECLARE
  caller_id uuid := (SELECT auth.uid());
BEGIN
  IF caller_id IS NULL THEN
    RAISE EXCEPTION 'Authentication required' USING ERRCODE = '42501';
  END IF;

  UPDATE public.journal_ai_consents
  SET granted_at = now(),
      revoked_at = NULL,
      generation = generation + 1,
      updated_at = now()
  WHERE user_id = caller_id
    AND generation = p_expected_generation;

  IF FOUND THEN
    RETURN true;
  END IF;

  IF p_expected_generation <> 0 THEN
    RETURN false;
  END IF;

  INSERT INTO public.journal_ai_consents (
    user_id,
    granted_at,
    revoked_at,
    generation,
    updated_at
  )
  VALUES (caller_id, now(), NULL, 1, now())
  ON CONFLICT (user_id) DO NOTHING;

  RETURN FOUND;
END;
$$;

CREATE OR REPLACE FUNCTION public.revoke_journal_ai_consent()
RETURNS boolean
LANGUAGE plpgsql
VOLATILE
SECURITY INVOKER
SET search_path = ''
AS $$
DECLARE
  caller_id uuid := (SELECT auth.uid());
BEGIN
  IF caller_id IS NULL THEN
    RAISE EXCEPTION 'Authentication required' USING ERRCODE = '42501';
  END IF;

  INSERT INTO public.journal_ai_consents AS consent (
    user_id,
    granted_at,
    revoked_at,
    generation,
    updated_at
  )
  VALUES (caller_id, NULL, now(), 1, now())
  ON CONFLICT (user_id) DO UPDATE
  SET granted_at = NULL,
      revoked_at = EXCLUDED.revoked_at,
      generation = consent.generation + 1,
      updated_at = EXCLUDED.updated_at;

  DELETE FROM public.journal_embeddings
  WHERE user_id = caller_id;

  RETURN true;
END;
$$;

CREATE OR REPLACE FUNCTION public.upsert_journal_embeddings_if_consented(
  p_rows jsonb
)
RETURNS integer
LANGUAGE plpgsql
VOLATILE
SECURITY INVOKER
SET search_path = ''
AS $$
DECLARE
  caller_id uuid := (SELECT auth.uid());
  requested_count integer;
  stored_count integer;
BEGIN
  IF caller_id IS NULL THEN
    RAISE EXCEPTION 'Authentication required' USING ERRCODE = '42501';
  END IF;

  IF jsonb_typeof(p_rows) <> 'array' OR jsonb_array_length(p_rows) > 20 THEN
    RAISE EXCEPTION 'Invalid journal embedding batch' USING ERRCODE = '22023';
  END IF;

  SELECT count(*)::integer
  INTO requested_count
  FROM jsonb_to_recordset(p_rows) AS payload(
    entry_id text,
    embedding text,
    content_hash text
  )
  JOIN public.journal_entries AS entry
    ON entry.id = payload.entry_id
   AND entry.user_id = caller_id
  WHERE payload.entry_id IS NOT NULL
    AND payload.embedding IS NOT NULL
    AND payload.content_hash IS NOT NULL;

  IF requested_count <> jsonb_array_length(p_rows) THEN
    RAISE EXCEPTION 'Journal embedding ownership check failed' USING ERRCODE = '42501';
  END IF;

  PERFORM 1
  FROM public.journal_ai_consents
  WHERE user_id = caller_id
    AND granted_at IS NOT NULL
    AND revoked_at IS NULL
  FOR SHARE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Journal AI consent required' USING ERRCODE = '42501';
  END IF;

  INSERT INTO public.journal_embeddings AS target (
    entry_id,
    user_id,
    embedding,
    content_hash
  )
  SELECT
    payload.entry_id,
    caller_id,
    payload.embedding::vector(768),
    payload.content_hash
  FROM jsonb_to_recordset(p_rows) AS payload(
    entry_id text,
    embedding text,
    content_hash text
  )
  ON CONFLICT (entry_id) DO UPDATE
  SET embedding = EXCLUDED.embedding,
      content_hash = EXCLUDED.content_hash,
      created_at = now()
  WHERE target.user_id = caller_id;

  GET DIAGNOSTICS stored_count = ROW_COUNT;
  IF stored_count <> requested_count THEN
    RAISE EXCEPTION 'Journal embedding write was incomplete' USING ERRCODE = '42501';
  END IF;

  RETURN stored_count;
END;
$$;

REVOKE ALL ON FUNCTION public.grant_journal_ai_consent(bigint) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.grant_journal_ai_consent(bigint) TO authenticated;

REVOKE ALL ON FUNCTION public.revoke_journal_ai_consent() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.revoke_journal_ai_consent() TO authenticated;

REVOKE ALL ON FUNCTION public.upsert_journal_embeddings_if_consented(jsonb)
  FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.upsert_journal_embeddings_if_consented(jsonb)
  TO authenticated;

COMMENT ON TABLE public.journal_ai_consents IS
  'Owner-controlled server authority for journal AI search and embedding consent.';
COMMENT ON FUNCTION public.revoke_journal_ai_consent() IS
  'Atomically records revocation and removes the authenticated owner journal embeddings.';
COMMENT ON FUNCTION public.upsert_journal_embeddings_if_consented(jsonb) IS
  'Stores owner journal embeddings only while an authenticated consent row remains locked in the granted state.';

NOTIFY pgrst, 'reload schema';

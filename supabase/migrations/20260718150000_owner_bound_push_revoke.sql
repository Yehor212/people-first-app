-- A stale cleanup for account A must never delete a push installation that a
-- newer account B has already claimed. The advisory locks match the claim RPC,
-- while the expected-owner predicate makes the delete safe under either JWT.

BEGIN;

DROP FUNCTION IF EXISTS public.revoke_push_install(text, text);

CREATE FUNCTION public.revoke_push_install(
  p_device_id text,
  p_expected_owner_user_id uuid,
  p_token text
)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  caller_id uuid := auth.uid();
  deleted_count integer;
BEGIN
  IF caller_id IS NULL THEN
    RAISE EXCEPTION 'Authentication required' USING ERRCODE = '42501';
  END IF;
  IF p_expected_owner_user_id IS NULL THEN
    RAISE EXCEPTION 'Expected push owner is required' USING ERRCODE = '22023';
  END IF;
  IF p_device_id IS NULL OR pg_catalog.length(p_device_id) < 24 OR pg_catalog.length(p_device_id) > 256 THEN
    RAISE EXCEPTION 'Invalid push installation id' USING ERRCODE = '22023';
  END IF;
  -- Cross-owner cleanup is deliberately capability-bound: the authenticated
  -- replacement session must possess both unguessable local identifiers.
  IF p_token IS NULL OR (pg_catalog.length(p_token) < 8 OR pg_catalog.length(p_token) > 4096) THEN
    RAISE EXCEPTION 'Invalid push token' USING ERRCODE = '22023';
  END IF;

  -- Use the same lock order as claim_push_install so a claim and revoke cannot
  -- pass each other between the owner check and the row mutation.
  PERFORM pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(p_device_id, 0));
  PERFORM pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(p_token, 1));

  DELETE FROM public.push_device_tokens
  WHERE user_id = p_expected_owner_user_id
    AND device_id = p_device_id
    AND token = p_token;
  GET DIAGNOSTICS deleted_count = ROW_COUNT;

  -- A zero exact-delete is safe only when the expected owner no longer owns
  -- this installation. A rotated token can be newer than the local token when
  -- the remote claim committed before local persistence; fail closed so the
  -- client must invalidate the native registration or keep the boundary shut.
  IF deleted_count = 0 AND EXISTS (
    SELECT 1
    FROM public.push_device_tokens
    WHERE user_id = p_expected_owner_user_id
      AND device_id = p_device_id
  ) THEN
    RAISE EXCEPTION 'Push installation token changed' USING ERRCODE = '40001';
  END IF;

  RETURN deleted_count;
END;
$$;

REVOKE ALL ON FUNCTION public.revoke_push_install(text, uuid, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.revoke_push_install(text, uuid, text) FROM anon;
GRANT EXECUTE ON FUNCTION public.revoke_push_install(text, uuid, text) TO authenticated;

NOTIFY pgrst, 'reload schema';

COMMIT;

-- Keep already-installed clients compatible while preserving the owner-bound
-- RPCs introduced by the account-boundary migrations. The legacy revoke
-- overload is deliberately owner- and capability-bound to an exact
-- install-token pair; it never accepts an install-only or cross-owner delete.

BEGIN;

CREATE OR REPLACE FUNCTION public.claim_push_install(
  p_token text,
  p_device_id text,
  p_platform text DEFAULT 'android'
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  caller_id uuid := auth.uid();
BEGIN
  IF caller_id IS NULL THEN
    RAISE EXCEPTION 'Authentication required' USING ERRCODE = '42501';
  END IF;

  RETURN public.claim_push_install(
    p_token,
    p_device_id,
    caller_id,
    p_platform
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.revoke_push_install(
  p_device_id text,
  p_token text DEFAULT NULL
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
  IF p_device_id IS NULL
    OR pg_catalog.length(p_device_id) < 24
    OR pg_catalog.length(p_device_id) > 256
  THEN
    RAISE EXCEPTION 'Invalid push installation id' USING ERRCODE = '22023';
  END IF;
  IF p_token IS NULL THEN
    RAISE EXCEPTION 'Push token is required' USING ERRCODE = '22023';
  END IF;
  IF pg_catalog.length(p_token) < 8 OR pg_catalog.length(p_token) > 4096 THEN
    RAISE EXCEPTION 'Invalid push token' USING ERRCODE = '22023';
  END IF;

  PERFORM pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(p_device_id, 0)
  );
  PERFORM pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(p_token, 1)
  );

  DELETE FROM public.push_device_tokens
  WHERE user_id = caller_id
    AND device_id = p_device_id
    AND token = p_token;
  GET DIAGNOSTICS deleted_count = ROW_COUNT;

  IF deleted_count = 0 AND EXISTS (
    SELECT 1
    FROM public.push_device_tokens
    WHERE device_id = p_device_id
      AND token = p_token
  ) THEN
    RAISE EXCEPTION 'Push owner changed' USING ERRCODE = '42501';
  END IF;

  RETURN deleted_count;
END;
$$;

REVOKE ALL ON FUNCTION public.claim_push_install(text, text, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.claim_push_install(text, text, text) FROM anon;
GRANT EXECUTE ON FUNCTION public.claim_push_install(text, text, text) TO authenticated;

REVOKE ALL ON FUNCTION public.revoke_push_install(text, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.revoke_push_install(text, text) FROM anon;
GRANT EXECUTE ON FUNCTION public.revoke_push_install(text, text) TO authenticated;

COMMENT ON FUNCTION public.claim_push_install(text, text, text) IS
  'Legacy client overload; delegates to the owner-bound claim using auth.uid().';
COMMENT ON FUNCTION public.revoke_push_install(text, text) IS
  'Legacy client overload; revokes only the authenticated owner exact install-token pair.';

NOTIFY pgrst, 'reload schema';

COMMIT;

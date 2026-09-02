-- Ordinary sign-out may revoke only the authenticated account's current
-- installation. It must not delete the same account's other device tokens.

BEGIN;

DROP FUNCTION IF EXISTS public.revoke_current_push_install(uuid, text, text);

CREATE FUNCTION public.revoke_current_push_install(
  p_expected_owner_user_id uuid,
  p_device_id text DEFAULT NULL,
  p_token text DEFAULT NULL
)
RETURNS integer
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = ''
AS $$
DECLARE
  caller_id uuid := (select auth.uid());
  deleted_count integer;
BEGIN
  IF caller_id IS NULL THEN
    RAISE EXCEPTION 'Authentication required' USING ERRCODE = '42501';
  END IF;
  IF p_expected_owner_user_id IS NULL THEN
    RAISE EXCEPTION 'Expected push owner is required' USING ERRCODE = '22023';
  END IF;
  IF caller_id <> p_expected_owner_user_id THEN
    RAISE EXCEPTION 'Push owner changed' USING ERRCODE = '42501';
  END IF;
  IF p_device_id IS NULL AND p_token IS NULL THEN
    RAISE EXCEPTION 'Push installation capability is required' USING ERRCODE = '22023';
  END IF;
  IF p_device_id IS NOT NULL AND (
    pg_catalog.length(p_device_id) < 24
    OR pg_catalog.length(p_device_id) > 256
  ) THEN
    RAISE EXCEPTION 'Invalid push installation id' USING ERRCODE = '22023';
  END IF;
  IF p_token IS NOT NULL AND (
    pg_catalog.length(p_token) < 8
    OR pg_catalog.length(p_token) > 4096
  ) THEN
    RAISE EXCEPTION 'Invalid push token' USING ERRCODE = '22023';
  END IF;

  IF p_device_id IS NOT NULL THEN
    PERFORM pg_catalog.pg_advisory_xact_lock(
      pg_catalog.hashtextextended(p_device_id, 0)
    );
  END IF;
  IF p_token IS NOT NULL THEN
    PERFORM pg_catalog.pg_advisory_xact_lock(
      pg_catalog.hashtextextended(p_token, 1)
    );
  END IF;

  DELETE FROM public.push_device_tokens
  WHERE user_id = caller_id
    AND (
      (p_device_id IS NOT NULL AND device_id = p_device_id)
      OR (p_device_id IS NULL AND p_token IS NOT NULL AND token = p_token)
    );
  GET DIAGNOSTICS deleted_count = ROW_COUNT;

  RETURN deleted_count;
END;
$$;

REVOKE ALL ON FUNCTION public.revoke_current_push_install(uuid, text, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.revoke_current_push_install(uuid, text, text) FROM anon;
GRANT EXECUTE ON FUNCTION public.revoke_current_push_install(uuid, text, text) TO authenticated;

COMMENT ON FUNCTION public.revoke_current_push_install(uuid, text, text) IS
  'Revokes only the authenticated owner current installation by install id or token; never revokes every device for the account.';

NOTIFY pgrst, 'reload schema';

COMMIT;

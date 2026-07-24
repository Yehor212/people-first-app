-- Keep push installation ownership fail-closed at the database boundary.
-- Claims may rotate only the authenticated caller's own installation row.

BEGIN;

DROP FUNCTION IF EXISTS public.claim_push_install(text, text, text);

CREATE OR REPLACE FUNCTION public.claim_push_install(
  p_token text,
  p_device_id text,
  p_expected_owner_user_id uuid,
  p_platform text DEFAULT 'android'
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  caller_id uuid := auth.uid();
  claimed_id uuid;
BEGIN
  IF caller_id IS NULL THEN
    RAISE EXCEPTION 'Authentication required' USING ERRCODE = '42501';
  END IF;
  IF p_expected_owner_user_id IS NULL OR caller_id <> p_expected_owner_user_id THEN
    RAISE EXCEPTION 'Push owner changed' USING ERRCODE = '42501';
  END IF;
  IF p_token IS NULL OR pg_catalog.length(p_token) < 8 OR pg_catalog.length(p_token) > 4096 THEN
    RAISE EXCEPTION 'Invalid push token' USING ERRCODE = '22023';
  END IF;
  IF p_device_id IS NULL OR pg_catalog.length(p_device_id) < 24 OR pg_catalog.length(p_device_id) > 256 THEN
    RAISE EXCEPTION 'Invalid push installation id' USING ERRCODE = '22023';
  END IF;
  IF p_platform NOT IN ('android', 'ios') THEN
    RAISE EXCEPTION 'Invalid push platform' USING ERRCODE = '22023';
  END IF;

  PERFORM pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(p_device_id, 0)
  );
  PERFORM pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(p_token, 1)
  );

  IF EXISTS (
    SELECT 1
    FROM public.push_device_tokens
    WHERE user_id <> caller_id
      AND (token = p_token OR device_id = p_device_id)
  ) THEN
    RAISE EXCEPTION 'Push installation belongs to another owner' USING ERRCODE = '42501';
  END IF;

  DELETE FROM public.push_device_tokens
  WHERE user_id = caller_id
    AND (token = p_token OR device_id = p_device_id);

  INSERT INTO public.push_device_tokens (user_id, token, platform, device_id, updated_at)
  VALUES (caller_id, p_token, p_platform, p_device_id, pg_catalog.now())
  RETURNING id INTO claimed_id;

  RETURN claimed_id;
END;
$$;

REVOKE ALL ON FUNCTION public.claim_push_install(text, text, uuid, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.claim_push_install(text, text, uuid, text) FROM anon;
GRANT EXECUTE ON FUNCTION public.claim_push_install(text, text, uuid, text) TO authenticated;

REVOKE INSERT, UPDATE, DELETE ON TABLE public.push_device_tokens FROM authenticated;
REVOKE INSERT, UPDATE, DELETE ON TABLE public.push_device_tokens FROM anon;

DROP POLICY IF EXISTS "push_device_tokens_all" ON public.push_device_tokens;
DROP POLICY IF EXISTS "push_device_tokens_select_own" ON public.push_device_tokens;
CREATE POLICY "push_device_tokens_select_own" ON public.push_device_tokens
  FOR SELECT
  TO authenticated
  USING (user_id = (select auth.uid()));

NOTIFY pgrst, 'reload schema';

COMMIT;

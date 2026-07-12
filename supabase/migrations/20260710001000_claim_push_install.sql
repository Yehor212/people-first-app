-- One physical push installation must have exactly one active account owner.
-- Android token deletion is asynchronous below the Capacitor bridge, so server
-- ownership cannot rely on native unregister completing before the next login.

WITH ranked AS (
  SELECT id, row_number() OVER (
    PARTITION BY token
    ORDER BY updated_at DESC NULLS LAST, created_at DESC NULLS LAST, id DESC
  ) AS position
  FROM public.push_device_tokens
)
DELETE FROM public.push_device_tokens target
USING ranked
WHERE target.id = ranked.id AND ranked.position > 1;

WITH ranked AS (
  SELECT id, row_number() OVER (
    PARTITION BY device_id
    ORDER BY updated_at DESC NULLS LAST, created_at DESC NULLS LAST, id DESC
  ) AS position
  FROM public.push_device_tokens
  WHERE device_id IS NOT NULL
)
DELETE FROM public.push_device_tokens target
USING ranked
WHERE target.id = ranked.id AND ranked.position > 1;

CREATE UNIQUE INDEX IF NOT EXISTS push_device_tokens_token_unique_idx
  ON public.push_device_tokens (token);

CREATE UNIQUE INDEX IF NOT EXISTS push_device_tokens_device_unique_idx
  ON public.push_device_tokens (device_id)
  WHERE device_id IS NOT NULL;

CREATE OR REPLACE FUNCTION public.claim_push_install(
  p_token text,
  p_device_id text,
  p_platform text DEFAULT 'android'
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  caller_id uuid := auth.uid();
  claimed_id uuid;
BEGIN
  IF caller_id IS NULL THEN
    RAISE EXCEPTION 'Authentication required' USING ERRCODE = '42501';
  END IF;
  IF p_token IS NULL OR length(p_token) < 8 OR length(p_token) > 4096 THEN
    RAISE EXCEPTION 'Invalid push token' USING ERRCODE = '22023';
  END IF;
  IF p_device_id IS NULL OR length(p_device_id) < 24 OR length(p_device_id) > 256 THEN
    RAISE EXCEPTION 'Invalid push installation id' USING ERRCODE = '22023';
  END IF;
  IF p_platform NOT IN ('android', 'ios') THEN
    RAISE EXCEPTION 'Invalid push platform' USING ERRCODE = '22023';
  END IF;

  -- The global unique indexes and this function's row locks serialize a token
  -- rotation/reassignment. A stale A row is deleted before B becomes active.
  PERFORM pg_advisory_xact_lock(hashtextextended(p_device_id, 0));
  PERFORM pg_advisory_xact_lock(hashtextextended(p_token, 1));
  DELETE FROM public.push_device_tokens
  WHERE token = p_token OR device_id = p_device_id;

  INSERT INTO public.push_device_tokens (user_id, token, platform, device_id, updated_at)
  VALUES (caller_id, p_token, p_platform, p_device_id, now())
  RETURNING id INTO claimed_id;

  RETURN claimed_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.revoke_push_install(
  p_device_id text,
  p_token text DEFAULT NULL
)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  caller_id uuid := auth.uid();
  deleted_count integer;
BEGIN
  IF caller_id IS NULL THEN
    RAISE EXCEPTION 'Authentication required' USING ERRCODE = '42501';
  END IF;
  IF p_device_id IS NULL OR length(p_device_id) < 24 OR length(p_device_id) > 256 THEN
    RAISE EXCEPTION 'Invalid push installation id' USING ERRCODE = '22023';
  END IF;

  PERFORM pg_advisory_xact_lock(hashtextextended(p_device_id, 0));
  DELETE FROM public.push_device_tokens
  WHERE device_id = p_device_id
    AND (p_token IS NULL OR token = p_token);
  GET DIAGNOSTICS deleted_count = ROW_COUNT;
  RETURN deleted_count;
END;
$$;

REVOKE ALL ON FUNCTION public.claim_push_install(text, text, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.revoke_push_install(text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.claim_push_install(text, text, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.revoke_push_install(text, text) TO authenticated;

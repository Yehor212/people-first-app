-- Restore the authenticated legacy claim overload after the delivery-realm
-- hardening migration removed it. Ownership remains fail-closed: callers
-- cannot supply an owner id, and the canonical four-argument function still
-- performs all capability, platform, and cross-owner validation.

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

REVOKE ALL ON FUNCTION public.claim_push_install(text, text, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.claim_push_install(text, text, text) FROM anon;
GRANT EXECUTE ON FUNCTION public.claim_push_install(text, text, text) TO authenticated;

COMMENT ON FUNCTION public.claim_push_install(text, text, text) IS
  'Legacy client overload restored after push-realm hardening; ownership is derived from auth.uid() and enforced by the canonical claim function.';

NOTIFY pgrst, 'reload schema';

COMMIT;

-- Fix: update_user_settings_timestamp missing SET search_path
-- All other custom functions have search_path=public (set in 20260129 security sweep).
-- This trigger function was missed. Adding for consistency and defense-in-depth.

CREATE OR REPLACE FUNCTION public.update_user_settings_timestamp()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

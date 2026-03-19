-- =============================================
-- Profile Activity Tracking
-- Adds last_active_at and app_version to profiles
-- Server-side trigger on auth.users for reliable login tracking
-- =============================================

-- Add activity tracking columns
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS last_active_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS app_version TEXT;

-- Index for admin queries ("who was active today?")
CREATE INDEX IF NOT EXISTS idx_profiles_last_active_at
  ON public.profiles(last_active_at DESC NULLS LAST);

-- Server-side trigger function: track login from auth.users
-- Fires when Supabase updates last_sign_in_at on authentication
CREATE OR REPLACE FUNCTION public.handle_user_login()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF (NEW.last_sign_in_at IS NOT NULL AND
      (OLD.last_sign_in_at IS NULL OR NEW.last_sign_in_at != OLD.last_sign_in_at)) THEN
    UPDATE public.profiles
    SET last_active_at = NEW.last_sign_in_at,
        updated_at = NOW()
    WHERE id = NEW.id;
  END IF;
  RETURN NEW;
END;
$$;

-- Trigger on auth.users UPDATE (fires when user authenticates)
DROP TRIGGER IF EXISTS on_user_login ON auth.users;
CREATE TRIGGER on_user_login
  AFTER UPDATE ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_user_login();

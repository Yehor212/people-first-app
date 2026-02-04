-- =============================================
-- Migration: Fix Remaining Security Issues
-- Created: 2026-02-03
-- Description: Fix 4 remaining security warnings:
--   1. update_updated_at_column - mutable search_path
--   2. update_challenge_updated_at - mutable search_path (if exists)
--   3. feedback RLS policy - remove old permissive policy
--   4. Leaked password protection - requires Pro plan (manual)
-- =============================================

-- =============================================
-- 1. Re-fix update_updated_at_column
-- This function may have been overwritten or migration not applied
-- =============================================
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

-- =============================================
-- 2. Fix update_challenge_updated_at if it exists
-- This function is not in migrations but may exist in DB
-- =============================================
DO $$
BEGIN
  -- Check if function exists and fix it
  IF EXISTS (
    SELECT 1 FROM pg_proc
    WHERE proname = 'update_challenge_updated_at'
    AND pronamespace = 'public'::regnamespace
  ) THEN
    -- Drop and recreate with proper search_path
    EXECUTE '
      CREATE OR REPLACE FUNCTION public.update_challenge_updated_at()
      RETURNS TRIGGER
      LANGUAGE plpgsql
      SET search_path = public
      AS $func$
      BEGIN
        NEW.updated_at = NOW();
        RETURN NEW;
      END;
      $func$;
    ';
    RAISE NOTICE 'Fixed update_challenge_updated_at function';
  ELSE
    RAISE NOTICE 'update_challenge_updated_at does not exist, skipping';
  END IF;
END $$;

-- =============================================
-- 3. Fix feedback table RLS policies
-- Remove old permissive policy, ensure only secure one exists
-- =============================================

-- Drop ALL existing INSERT policies on feedback to ensure clean state
DROP POLICY IF EXISTS "Anyone can insert feedback" ON public.feedback;
DROP POLICY IF EXISTS "Anyone can submit feedback" ON public.feedback;
DROP POLICY IF EXISTS "Anonymous feedback insert" ON public.feedback;

-- Recreate the secure policy
CREATE POLICY "Secure anonymous feedback insert"
  ON public.feedback
  FOR INSERT
  TO anon, authenticated
  WITH CHECK (
    -- Required field validation
    category IS NOT NULL AND
    category IN ('bug', 'feature', 'other') AND
    message IS NOT NULL AND
    LENGTH(TRIM(message)) > 0 AND
    LENGTH(message) <= 5000
  );

-- Ensure SELECT is restricted to service_role only
DROP POLICY IF EXISTS "Service role can read feedback" ON public.feedback;
CREATE POLICY "Service role reads feedback"
  ON public.feedback
  FOR SELECT
  TO service_role
  USING (true);

-- =============================================
-- 4. Leaked password protection
-- MANUAL: Requires Supabase Pro plan
-- Go to: Dashboard → Authentication → Providers → Email
-- Enable "Leaked password protection"
-- If not on Pro plan, this warning will remain (acceptable)
-- =============================================

-- =============================================
-- VERIFICATION (run after migration)
-- =============================================
-- Check all trigger functions have search_path fixed:
--
-- SELECT
--   proname AS function_name,
--   CASE
--     WHEN 'search_path=public' = ANY(proconfig) THEN 'FIXED'
--     ELSE 'MISSING'
--   END AS status
-- FROM pg_proc
-- WHERE pronamespace = 'public'::regnamespace
--   AND proname LIKE '%updated_at%';
--
-- Check feedback policies:
--
-- SELECT policyname, cmd, qual, with_check
-- FROM pg_policies
-- WHERE tablename = 'feedback';

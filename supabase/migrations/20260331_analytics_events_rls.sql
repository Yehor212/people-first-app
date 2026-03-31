-- Ensure analytics_events has RLS enabled.
-- Table was created outside migration chain (likely via Dashboard).
-- Policy analytics_events_insert already exists (20260204_optimize_rls_policies.sql:335).
-- This migration adds the missing ENABLE RLS + SELECT policy for defense-in-depth.
--
-- Rollback: ALTER TABLE public.analytics_events DISABLE ROW LEVEL SECURITY;

ALTER TABLE IF EXISTS public.analytics_events ENABLE ROW LEVEL SECURITY;

-- Users can read their own analytics events (defense-in-depth)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'analytics_events'
    AND policyname = 'analytics_events_select'
  ) THEN
    CREATE POLICY "analytics_events_select"
      ON public.analytics_events FOR SELECT
      USING (user_id = (select auth.uid()));
  END IF;
END $$;

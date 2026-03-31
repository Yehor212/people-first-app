-- Ensure analytics_events has RLS enabled.
-- Table was created outside migration chain (likely via Dashboard).
-- Policy analytics_events_insert already exists (20260204_optimize_rls_policies.sql:335).
-- This migration adds the missing ENABLE RLS + SELECT policy for defense-in-depth.
--
-- Rollback: ALTER TABLE public.analytics_events DISABLE ROW LEVEL SECURITY;

ALTER TABLE IF EXISTS public.analytics_events ENABLE ROW LEVEL SECURITY;

-- Users can read their own analytics events (defense-in-depth)
CREATE POLICY IF NOT EXISTS "analytics_events_select"
  ON public.analytics_events FOR SELECT
  USING (user_id = (select auth.uid()));

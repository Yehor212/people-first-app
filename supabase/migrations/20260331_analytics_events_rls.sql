-- Ensure analytics_events has RLS enabled.
-- Table was created outside migration chain (likely via Dashboard).
-- Policy analytics_events_insert already exists (20260204_optimize_rls_policies.sql:335).
-- This migration adds the missing ENABLE RLS + SELECT policy for defense-in-depth.
--
-- Rollback: drop only analytics_events_select if required; retain RLS.

DO $$
BEGIN
  IF to_regclass('public.analytics_events') IS NOT NULL THEN
    ALTER TABLE public.analytics_events ENABLE ROW LEVEL SECURITY;

    IF NOT EXISTS (
      SELECT 1 FROM pg_policies
      WHERE schemaname = 'public'
        AND tablename = 'analytics_events'
        AND policyname = 'analytics_events_select'
    ) THEN
      CREATE POLICY "analytics_events_select"
        ON public.analytics_events FOR SELECT
        USING (user_id = (select auth.uid()));
    END IF;
  END IF;
END $$;

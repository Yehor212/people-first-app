-- Phase 2-B: Design System feature flags (distinct from user-facing FeatureFlagsContext)
--
-- Purpose: per-surface rollout gating for OKLCH migration, paper theme, motion adoption.
-- Why separate from FeatureFlagsContext? FeatureFlagsContext = client-only localStorage
-- toggles for USER features (focusTimer, gratitudeJournal, etc). design_flags = cloud-backed,
-- admin-controlled ROLLOUT flags for design-system phases. Different audiences, different
-- write paths, different lifecycles.
--
-- ROLLBACK:
--   DROP TABLE public.design_flags CASCADE;
--   DROP FUNCTION IF EXISTS public.design_flags_set_updated_at() CASCADE;

CREATE TABLE IF NOT EXISTS public.design_flags (
  key text PRIMARY KEY,
  enabled boolean NOT NULL DEFAULT false,
  rollout_percent integer NOT NULL DEFAULT 0 CHECK (rollout_percent BETWEEN 0 AND 100),
  killswitch boolean NOT NULL DEFAULT false,
  description text,
  updated_at timestamptz NOT NULL DEFAULT now(),
  updated_by uuid REFERENCES auth.users(id)
);

COMMENT ON TABLE public.design_flags IS 'Design system rollout flags (Phase 2-B). Distinct from FeatureFlagsContext (user UI toggles).';

-- Auto-update updated_at on row mutation
CREATE OR REPLACE FUNCTION public.design_flags_set_updated_at()
RETURNS trigger
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS design_flags_updated_at_trg ON public.design_flags;
CREATE TRIGGER design_flags_updated_at_trg
  BEFORE UPDATE ON public.design_flags
  FOR EACH ROW EXECUTE FUNCTION public.design_flags_set_updated_at();

-- RLS
ALTER TABLE public.design_flags ENABLE ROW LEVEL SECURITY;

-- Public read (authenticated + anon users read flags for offline-first cache).
-- Flags are non-sensitive rollout metadata; reading them does not expose user data.
DROP POLICY IF EXISTS design_flags_read_all ON public.design_flags;
CREATE POLICY design_flags_read_all ON public.design_flags
  FOR SELECT
  USING (true);

-- Writes restricted to service_role only (admin ops via Supabase Dashboard or RPC).
-- Prevents client tampering with rollout percentages.
DROP POLICY IF EXISTS design_flags_write_service ON public.design_flags;
CREATE POLICY design_flags_write_service ON public.design_flags
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- Seed the 4 Phase 0-2 design-system flags
INSERT INTO public.design_flags (key, enabled, rollout_percent, killswitch, description) VALUES
  ('design.typography.v2', true, 100, false, 'Fraunces + Inter + Caveat + Literata (Phase 0-B, already rolled)'),
  ('design.motion.v2', true, 100, false, 'Motion verbs + View Transitions (Phase 1 + 2-A, already rolled)'),
  ('design.colors.oklch.mood-slider', false, 0, false, 'OKLCH migration pilot — MoodSlider surface only'),
  ('design.theme.paper', false, 0, false, 'Paper theme replaces light default (Phase 0-C infrastructure built; flip deferred)')
ON CONFLICT (key) DO NOTHING;

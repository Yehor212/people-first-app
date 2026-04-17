-- Phase 3-A: Navigation V2 feature flag
--
-- Purpose: Gate the new 4-page IA (Orb/Habits/Diary/Settings) behind a rollout flag
-- so V1 navigation remains the default path while V2 infrastructure lands.
--
-- Killswitch ON at insert-time — admin explicitly flips it off to unblock a cohort.
-- Rollout 0 → no users see V2 automatically. Opt-in routes:
--   1) ?nav=v2 query param (dev/QA)
--   2) rollout_percent > 0 (bucketed percentage rollout)
--   3) killswitch=false + enabled=true (100% on)
--
-- ROLLBACK:
--   DELETE FROM public.design_flags WHERE key = 'design.nav.v2';

INSERT INTO public.design_flags (key, enabled, rollout_percent, killswitch, description)
VALUES (
  'design.nav.v2',
  false,
  0,
  true,
  'Phase 3-A — New 4-page IA: Orb/Habits/Diary/Settings. Killswitch ON; enabled per-user via rollout. Cutover target: Phase 3-F.'
)
ON CONFLICT (key) DO UPDATE SET
  description = EXCLUDED.description,
  killswitch = EXCLUDED.killswitch;

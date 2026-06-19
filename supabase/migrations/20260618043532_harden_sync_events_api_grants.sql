-- Harden sync_events Data API grants to the minimum client surface.
-- RLS already restricts rows to authenticated users, but grants decide whether
-- anon/authenticated can reach the table at all through Supabase APIs.

REVOKE ALL PRIVILEGES ON TABLE public.sync_events FROM anon;
REVOKE ALL PRIVILEGES ON TABLE public.sync_events FROM authenticated;

GRANT SELECT, INSERT ON TABLE public.sync_events TO authenticated;

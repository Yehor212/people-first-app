-- Telegram-grade sync hardening: privacy-safe device/session presence.
--
-- Why:
--   Telegram-style sync is not only ordered data convergence. Users also need a
--   clear account boundary: which devices are attached, which one is current,
--   and when each device last participated in sync. This table stores only
--   coarse, privacy-safe presence metadata. It does not store raw user-agent,
--   journal content, habit names, payloads, IP addresses, or push tokens.
--
-- Security model:
--   - RLS is enabled because the table lives in public.
--   - Users can read, insert, and update only their own rows.
--   - Deletes are revoked; device removal is a soft revoke via revoked_at so
--     audit/history survives sync repair and stale clients cannot hide traces.
--   - This is product-level sync presence. It is not a Supabase Auth token
--     revocation mechanism; strict token invalidation needs a trusted backend.

CREATE TABLE IF NOT EXISTS public.device_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  device_id TEXT NOT NULL CHECK (char_length(device_id) BETWEEN 8 AND 128),
  label TEXT NOT NULL CHECK (char_length(label) BETWEEN 1 AND 80),
  platform TEXT NOT NULL CHECK (platform IN (
    'web',
    'pwa',
    'desktop',
    'android',
    'ios',
    'unknown'
  )),
  app_version TEXT,
  first_seen_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_seen_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  revoked_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, device_id)
);

CREATE INDEX IF NOT EXISTS device_sessions_user_last_seen_idx
  ON public.device_sessions (user_id, last_seen_at DESC);

CREATE INDEX IF NOT EXISTS device_sessions_user_active_idx
  ON public.device_sessions (user_id, revoked_at, last_seen_at DESC);

ALTER TABLE public.device_sessions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "device_sessions_select_own" ON public.device_sessions;
CREATE POLICY "device_sessions_select_own"
  ON public.device_sessions
  FOR SELECT
  TO authenticated
  USING ((SELECT auth.uid()) = user_id);

DROP POLICY IF EXISTS "device_sessions_insert_own" ON public.device_sessions;
CREATE POLICY "device_sessions_insert_own"
  ON public.device_sessions
  FOR INSERT
  TO authenticated
  WITH CHECK ((SELECT auth.uid()) = user_id);

DROP POLICY IF EXISTS "device_sessions_update_own" ON public.device_sessions;
CREATE POLICY "device_sessions_update_own"
  ON public.device_sessions
  FOR UPDATE
  TO authenticated
  USING ((SELECT auth.uid()) = user_id)
  WITH CHECK ((SELECT auth.uid()) = user_id);

REVOKE ALL ON TABLE public.device_sessions FROM anon, authenticated;
GRANT SELECT, INSERT, UPDATE ON TABLE public.device_sessions TO authenticated;

COMMENT ON TABLE public.device_sessions IS
  'Privacy-safe per-user device sync presence; soft revoke only, not Auth token invalidation.';
COMMENT ON COLUMN public.device_sessions.device_id IS
  'Stable local sync device id from IndexedDB, never shown raw in UI.';
COMMENT ON COLUMN public.device_sessions.label IS
  'Coarse display label such as Chrome on Windows; raw user-agent is not stored.';
COMMENT ON COLUMN public.device_sessions.revoked_at IS
  'Soft sync-session revoke marker. Auth token revocation requires trusted backend support.';

-- =============================================
-- Migration: Event-sourced delta sync (Phase 2)
-- Created: 2026-04-05
-- Implements Telegram-style seq-based sync
--
-- Rollback:
--   DROP TRIGGER IF EXISTS trg_assign_sync_seq ON public.sync_events;
--   DROP FUNCTION IF EXISTS public.assign_sync_seq();
--   DROP TABLE IF EXISTS public.sync_events;
--   DROP TABLE IF EXISTS public.sync_seq_counters;
-- =============================================

-- ── Sequence counters (one row per user) ──────────────────────────────
CREATE TABLE IF NOT EXISTS public.sync_seq_counters (
  user_id  UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  last_seq BIGINT NOT NULL DEFAULT 0
);

ALTER TABLE public.sync_seq_counters ENABLE ROW LEVEL SECURITY;

-- Counter table accessed only by trigger (SECURITY DEFINER).
-- Authenticated users need SELECT to read their own counter.
CREATE POLICY "sync_seq_counters_select_own"
  ON public.sync_seq_counters FOR SELECT
  USING ((SELECT auth.uid()) = user_id);

-- ── Event log ─────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.sync_events (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  seq         BIGINT      NOT NULL,
  entity_type TEXT        NOT NULL CHECK (entity_type IN (
                            'mood', 'habit', 'focus', 'gratitude', 'journal',
                            'habit_completion', 'setting')),
  entity_id   TEXT        NOT NULL,
  op          TEXT        NOT NULL CHECK (op IN ('upsert', 'delete')),
  payload     JSONB,
  device_id   TEXT        NOT NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Unique per-user seq (gapless, assigned by trigger)
CREATE UNIQUE INDEX IF NOT EXISTS sync_events_user_seq_idx
  ON public.sync_events (user_id, seq);

-- Primary query pattern: WHERE user_id=$1 AND seq > $2 ORDER BY seq
CREATE INDEX IF NOT EXISTS sync_events_user_seq_fetch_idx
  ON public.sync_events (user_id, seq ASC);

-- BRIN index for TTL cleanup (append-only timestamps)
CREATE INDEX IF NOT EXISTS sync_events_created_at_brin
  ON public.sync_events USING BRIN (created_at)
  WITH (pages_per_range = 32);

ALTER TABLE public.sync_events ENABLE ROW LEVEL SECURITY;

-- Optimized RLS: (SELECT auth.uid()) evaluates once per query
CREATE POLICY "sync_events_select_own"
  ON public.sync_events FOR SELECT
  USING ((SELECT auth.uid()) = user_id);

CREATE POLICY "sync_events_insert_own"
  ON public.sync_events FOR INSERT
  WITH CHECK ((SELECT auth.uid()) = user_id);

-- Events are immutable: NO UPDATE or DELETE policies
-- Explicitly revoke for defense-in-depth
REVOKE UPDATE, DELETE ON public.sync_events FROM authenticated;

-- ── Seq assignment trigger ────────────────────────────────────────────
-- FOR UPDATE locks only the user's counter row — no cross-user contention.
-- ON CONFLICT handles race where two txns both see NOT FOUND.
CREATE OR REPLACE FUNCTION public.assign_sync_seq()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  next_seq BIGINT;
BEGIN
  -- Atomically increment counter with row lock
  UPDATE sync_seq_counters
    SET last_seq = last_seq + 1
    WHERE user_id = NEW.user_id
    RETURNING last_seq INTO next_seq;

  -- First event for this user: create counter row
  IF NOT FOUND THEN
    INSERT INTO sync_seq_counters (user_id, last_seq)
      VALUES (NEW.user_id, 1)
      ON CONFLICT (user_id)
        DO UPDATE SET last_seq = sync_seq_counters.last_seq + 1
      RETURNING last_seq INTO next_seq;
  END IF;

  NEW.seq := next_seq;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_assign_sync_seq
  BEFORE INSERT ON public.sync_events
  FOR EACH ROW
  EXECUTE FUNCTION public.assign_sync_seq();

-- ── Backfill: existing users get counter row (seq=0 = no events yet) ──
INSERT INTO public.sync_seq_counters (user_id, last_seq)
  SELECT id, 0 FROM auth.users
  ON CONFLICT (user_id) DO NOTHING;

-- ── NOTE: sync_events is intentionally NOT in supabase_realtime publication.
-- Cross-device signaling uses Broadcast (zero WAL overhead).
-- See: 20260205_remove_unnecessary_realtime.sql

-- ── TTL cleanup (add via Supabase Dashboard → Database → Extensions → pg_cron):
-- SELECT cron.schedule('sync_events_ttl', '0 3 * * *',
--   $$DELETE FROM sync_events WHERE created_at < NOW() - INTERVAL '90 days'
--     AND id NOT IN (
--       SELECT DISTINCT ON (user_id, entity_type, entity_id) id
--       FROM sync_events ORDER BY user_id, entity_type, entity_id, seq DESC
--     )$$);

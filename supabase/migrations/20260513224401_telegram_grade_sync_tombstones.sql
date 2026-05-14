-- Telegram-grade sync hardening: durable delete tombstones.
--
-- Why:
--   sync_events.seq already gives ZenFlow an ordered event log, but delete
--   events must also become durable server state. Otherwise a later
--   backup/snapshot repair can reintroduce an entity whose delete event has
--   already been applied locally, especially after event-log TTL cleanup.
--
-- Model:
--   - sync_events remains the ordered append-only log.
--   - sync_tombstones stores the latest delete for each durable entity id.
--   - Clients can SELECT their own tombstones for backup repair/bootstrap.
--   - Clients cannot directly INSERT/UPDATE/DELETE tombstones; the trigger
--     derives them from ordered delete events.

-- Existing V2 events allowed NULL idempotency keys. Close that hole before
-- relying on event idempotency as a sync invariant.
ALTER TABLE public.sync_events
  ALTER COLUMN idempotency_key SET DEFAULT gen_random_uuid();

UPDATE public.sync_events
SET idempotency_key = gen_random_uuid()
WHERE idempotency_key IS NULL;

ALTER TABLE public.sync_events
  ALTER COLUMN idempotency_key SET NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS sync_events_idempotency_idx
  ON public.sync_events (user_id, idempotency_key);

-- Durable server tombstones for entity families that have standalone local
-- records and anti-resurrection requirements. Habit completions and settings
-- are intentionally excluded: completions are embedded in habit entries and
-- settings deletion is not part of the current user-facing destructive flow.
CREATE TABLE IF NOT EXISTS public.sync_tombstones (
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  entity_type TEXT NOT NULL CHECK (entity_type IN (
    'mood',
    'habit',
    'focus',
    'gratitude',
    'journal'
  )),
  entity_id TEXT NOT NULL,
  deleted_seq BIGINT NOT NULL,
  deleted_event_id UUID REFERENCES public.sync_events(id) ON DELETE SET NULL,
  device_id TEXT NOT NULL,
  deleted_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, entity_type, entity_id)
);

CREATE INDEX IF NOT EXISTS sync_tombstones_user_seq_idx
  ON public.sync_tombstones (user_id, deleted_seq ASC);

CREATE INDEX IF NOT EXISTS sync_tombstones_user_entity_idx
  ON public.sync_tombstones (user_id, entity_type, entity_id);

ALTER TABLE public.sync_tombstones ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "sync_tombstones_select_own" ON public.sync_tombstones;
CREATE POLICY "sync_tombstones_select_own" ON public.sync_tombstones
  FOR SELECT
  TO authenticated
  USING ((SELECT auth.uid()) = user_id);

REVOKE ALL ON TABLE public.sync_tombstones FROM anon, authenticated;
GRANT SELECT ON TABLE public.sync_tombstones TO authenticated;

-- Keep the sync counter readable, but not client-writable.
GRANT SELECT ON TABLE public.sync_seq_counters TO authenticated;
REVOKE INSERT, UPDATE, DELETE ON TABLE public.sync_seq_counters FROM anon, authenticated;

-- Keep event reads/inserts explicit for the Data API and RLS policies.
GRANT SELECT, INSERT ON TABLE public.sync_events TO authenticated;
REVOKE UPDATE, DELETE ON TABLE public.sync_events FROM anon, authenticated;

CREATE OR REPLACE FUNCTION public.apply_sync_event_tombstone()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.op = 'delete'
     AND NEW.entity_type IN ('mood', 'habit', 'focus', 'gratitude', 'journal') THEN
    INSERT INTO public.sync_tombstones (
      user_id,
      entity_type,
      entity_id,
      deleted_seq,
      deleted_event_id,
      device_id,
      deleted_at
    )
    VALUES (
      NEW.user_id,
      NEW.entity_type,
      NEW.entity_id,
      NEW.seq,
      NEW.id,
      NEW.device_id,
      NEW.created_at
    )
    ON CONFLICT (user_id, entity_type, entity_id)
    DO UPDATE SET
      deleted_seq = EXCLUDED.deleted_seq,
      deleted_event_id = EXCLUDED.deleted_event_id,
      device_id = EXCLUDED.device_id,
      deleted_at = EXCLUDED.deleted_at
    WHERE public.sync_tombstones.deleted_seq < EXCLUDED.deleted_seq;
  END IF;

  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.apply_sync_event_tombstone() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.apply_sync_event_tombstone() FROM anon, authenticated;

DROP TRIGGER IF EXISTS trg_apply_sync_event_tombstone ON public.sync_events;
CREATE TRIGGER trg_apply_sync_event_tombstone
  AFTER INSERT ON public.sync_events
  FOR EACH ROW
  EXECUTE FUNCTION public.apply_sync_event_tombstone();

-- Backfill existing delete events into the durable tombstone table.
INSERT INTO public.sync_tombstones (
  user_id,
  entity_type,
  entity_id,
  deleted_seq,
  deleted_event_id,
  device_id,
  deleted_at,
  created_at
)
SELECT DISTINCT ON (user_id, entity_type, entity_id)
  user_id,
  entity_type,
  entity_id,
  seq,
  id,
  device_id,
  created_at,
  created_at
FROM public.sync_events
WHERE op = 'delete'
  AND entity_type IN ('mood', 'habit', 'focus', 'gratitude', 'journal')
ORDER BY user_id, entity_type, entity_id, seq DESC
ON CONFLICT (user_id, entity_type, entity_id)
DO UPDATE SET
  deleted_seq = EXCLUDED.deleted_seq,
  deleted_event_id = EXCLUDED.deleted_event_id,
  device_id = EXCLUDED.device_id,
  deleted_at = EXCLUDED.deleted_at
WHERE public.sync_tombstones.deleted_seq < EXCLUDED.deleted_seq;

COMMENT ON TABLE public.sync_tombstones IS
  'Durable per-user delete tombstones derived from ordered sync_events delete events.';
COMMENT ON FUNCTION public.apply_sync_event_tombstone() IS
  'Maintains sync_tombstones from ordered sync_events deletes.';

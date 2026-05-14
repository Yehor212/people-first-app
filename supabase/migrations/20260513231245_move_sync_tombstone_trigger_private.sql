-- Move the sync tombstone trigger function out of the exposed public schema.
--
-- The first tombstone migration intentionally revoked direct EXECUTE, but
-- Supabase security guidance is stricter for SECURITY DEFINER functions:
-- keep privileged trigger code in a non-exposed schema when possible.

CREATE SCHEMA IF NOT EXISTS private;

REVOKE ALL ON SCHEMA private FROM PUBLIC;
REVOKE ALL ON SCHEMA private FROM anon, authenticated;

CREATE OR REPLACE FUNCTION private.apply_sync_event_tombstone()
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

REVOKE ALL ON FUNCTION private.apply_sync_event_tombstone() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION private.apply_sync_event_tombstone() FROM anon, authenticated;

DROP TRIGGER IF EXISTS trg_apply_sync_event_tombstone ON public.sync_events;
CREATE TRIGGER trg_apply_sync_event_tombstone
  AFTER INSERT ON public.sync_events
  FOR EACH ROW
  EXECUTE FUNCTION private.apply_sync_event_tombstone();

DROP FUNCTION IF EXISTS public.apply_sync_event_tombstone();

COMMENT ON FUNCTION private.apply_sync_event_tombstone() IS
  'Maintains public.sync_tombstones from ordered public.sync_events deletes.';

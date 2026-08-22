-- Journal sync events are ordering hints, not a second copy of the private
-- journal row. Current content is fetched from journal_entries under owner RLS.
-- This migration also removes legacy content-bearing event payloads in place.

CREATE OR REPLACE FUNCTION public.enforce_contentless_journal_sync_event()
RETURNS trigger
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = pg_catalog, public
AS $function$
BEGIN
  IF NEW.entity_type = 'journal' THEN
    NEW.payload := CASE
      WHEN NEW.op = 'upsert' THEN jsonb_build_object('schemaVersion', 1)
      ELSE NULL
    END;
  END IF;
  RETURN NEW;
END;
$function$;

REVOKE ALL ON FUNCTION public.enforce_contentless_journal_sync_event()
  FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS trg_contentless_journal_sync_event ON public.sync_events;
CREATE TRIGGER trg_contentless_journal_sync_event
  BEFORE INSERT ON public.sync_events
  FOR EACH ROW
  EXECUTE FUNCTION public.enforce_contentless_journal_sync_event();

-- Privacy deletion: legacy journal event bodies are redundant because the
-- authoritative owner-scoped row lives in journal_entries. Delete events keep
-- a NULL payload; upserts retain only their schema marker.
UPDATE public.sync_events
SET payload = CASE
  WHEN op = 'upsert' THEN jsonb_build_object('schemaVersion', 1)
  ELSE NULL
END
WHERE entity_type = 'journal'
  AND payload IS DISTINCT FROM CASE
    WHEN op = 'upsert' THEN jsonb_build_object('schemaVersion', 1)
    ELSE NULL
  END;

ALTER TABLE public.sync_events
  DROP CONSTRAINT IF EXISTS journal_sync_event_payload_is_contentless;
ALTER TABLE public.sync_events
  ADD CONSTRAINT journal_sync_event_payload_is_contentless CHECK (
    entity_type <> 'journal'
    OR (
      op = 'upsert'
      AND payload = jsonb_build_object('schemaVersion', 1)
    )
    OR (
      op = 'delete'
      AND payload IS NULL
    )
  ) NOT VALID;
ALTER TABLE public.sync_events
  VALIDATE CONSTRAINT journal_sync_event_payload_is_contentless;

COMMENT ON FUNCTION public.enforce_contentless_journal_sync_event() IS
  'Replaces journal sync event payloads with a fixed schema marker before storage.';
COMMENT ON CONSTRAINT journal_sync_event_payload_is_contentless ON public.sync_events IS
  'Journal ordered events contain no title, content, media list, stack, or arbitrary caller context.';

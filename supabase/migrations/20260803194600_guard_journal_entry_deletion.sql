-- Make journal entry identifiers permanently non-reusable and linearize remote
-- deletion with its durable sync event. This is expand-safe for installed
-- clients: direct PostgREST writes are guarded by triggers, while the current
-- client uses the owner-bound RPC for idempotent recovery when the row is
-- already absent.

BEGIN;

CREATE TABLE IF NOT EXISTS private.journal_entry_lifecycles (
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  entry_id text NOT NULL,
  state text NOT NULL CHECK (state IN ('live', 'deleted')),
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, entry_id)
);

REVOKE ALL ON TABLE private.journal_entry_lifecycles
  FROM PUBLIC, anon, authenticated, service_role;

-- Supabase CLI executes migration statements as a batch without adding an
-- implicit file-wide transaction. The explicit transaction above keeps these
-- DML locks through contradiction checks, backfill, and trigger installation.
-- Fail fast under sustained write load so deployment can retry without an
-- unbounded application write pause.
SET LOCAL lock_timeout = '10s';
LOCK TABLE
  public.journal_entries,
  public.sync_tombstones,
  public.sync_events
IN SHARE ROW EXCLUSIVE MODE;

-- A live row and a durable tombstone for the same owner-bound identifier is an
-- irreconcilable privacy state: silently choosing either side could resurrect
-- deleted content or strand a visible row. Abort before mutating the registry
-- and report only the aggregate count.
DO $$
DECLARE
  v_contradictory_rows bigint;
BEGIN
  SELECT pg_catalog.count(*)
  INTO v_contradictory_rows
  FROM public.journal_entries AS entries
  JOIN public.sync_tombstones AS tombstones
    ON tombstones.user_id = entries.user_id
    AND tombstones.entity_type = 'journal'
    AND tombstones.entity_id = entries.id;

  IF v_contradictory_rows > 0 THEN
    RAISE EXCEPTION 'Journal deletion lifecycle preflight failed: % contradictory rows',
      v_contradictory_rows
      USING ERRCODE = '23514',
        HINT = 'Inspect and approve owner-safe remediation before rerunning.';
  END IF;
END;
$$;

-- The contradiction preflight above makes the two backfill sources mutually
-- exclusive. Existing rows are live; durable tombstones remain deleted.
INSERT INTO private.journal_entry_lifecycles (user_id, entry_id, state)
SELECT entries.user_id, entries.id, 'live'
FROM public.journal_entries AS entries
ON CONFLICT (user_id, entry_id) DO NOTHING;

INSERT INTO private.journal_entry_lifecycles (user_id, entry_id, state, updated_at)
SELECT tombstones.user_id, tombstones.entity_id, 'deleted', tombstones.deleted_at
FROM public.sync_tombstones AS tombstones
WHERE tombstones.entity_type = 'journal'
ON CONFLICT (user_id, entry_id)
DO UPDATE SET
  state = 'deleted',
  updated_at = GREATEST(
    private.journal_entry_lifecycles.updated_at,
    EXCLUDED.updated_at
  );

CREATE OR REPLACE FUNCTION private.guard_journal_entry_lifecycle()
RETURNS trigger
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_state text;
BEGIN
  IF TG_OP = 'UPDATE' THEN
    IF NEW.id IS DISTINCT FROM OLD.id
      OR NEW.user_id IS DISTINCT FROM OLD.user_id
    THEN
      RAISE EXCEPTION 'Journal entry identity is immutable'
        USING ERRCODE = '55000';
    END IF;
  END IF;

  IF NEW.user_id IS NULL OR NEW.id IS NULL OR length(NEW.id) = 0 THEN
    RAISE EXCEPTION 'Invalid journal entry identity' USING ERRCODE = '22023';
  END IF;

  INSERT INTO private.journal_entry_lifecycles AS lifecycle (
    user_id,
    entry_id,
    state,
    updated_at
  )
  VALUES (NEW.user_id, NEW.id, 'live', now())
  ON CONFLICT (user_id, entry_id)
  DO UPDATE SET updated_at = EXCLUDED.updated_at
  WHERE private.journal_entry_lifecycles.state = 'live'
  RETURNING lifecycle.state INTO v_state;

  IF NOT FOUND OR v_state IS DISTINCT FROM 'live' THEN
    RAISE EXCEPTION 'Journal entry identifier was permanently deleted'
      USING ERRCODE = '55000';
  END IF;

  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION private.guard_journal_entry_lifecycle()
  FROM PUBLIC, anon, authenticated, service_role;

DROP TRIGGER IF EXISTS guard_journal_entry_lifecycle
  ON public.journal_entries;
CREATE TRIGGER guard_journal_entry_lifecycle
  BEFORE INSERT OR UPDATE ON public.journal_entries
  FOR EACH ROW
  EXECUTE FUNCTION private.guard_journal_entry_lifecycle();

CREATE OR REPLACE FUNCTION private.record_permanent_journal_entry_delete(
  p_owner_id uuid,
  p_entry_id text,
  p_device_id text
)
RETURNS void
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_idempotency_key uuid;
  v_inserted_rows integer;
BEGIN
  IF p_owner_id IS NULL
    OR p_entry_id IS NULL
    OR length(p_entry_id) = 0
    OR p_device_id IS NULL
    OR length(p_device_id) NOT BETWEEN 1 AND 512
  THEN
    RAISE EXCEPTION 'Invalid journal deletion identity' USING ERRCODE = '22023';
  END IF;

  INSERT INTO private.journal_entry_lifecycles AS lifecycle (
    user_id,
    entry_id,
    state,
    updated_at
  )
  VALUES (p_owner_id, p_entry_id, 'deleted', now())
  ON CONFLICT (user_id, entry_id)
  DO UPDATE SET
    state = 'deleted',
    updated_at = EXCLUDED.updated_at;

  v_idempotency_key := pg_catalog.md5(
    p_owner_id::text || ':' || p_entry_id || ':journal:delete'
  )::uuid;

  INSERT INTO public.sync_events (
    user_id,
    entity_type,
    entity_id,
    op,
    payload,
    device_id,
    idempotency_key
  )
  VALUES (
    p_owner_id,
    'journal',
    p_entry_id,
    'delete',
    NULL,
    p_device_id,
    v_idempotency_key
  )
  ON CONFLICT (user_id, idempotency_key) DO NOTHING;

  GET DIAGNOSTICS v_inserted_rows = ROW_COUNT;
  IF v_inserted_rows = 0 AND NOT EXISTS (
    SELECT 1
    FROM public.sync_events AS events
    WHERE events.user_id = p_owner_id
      AND events.idempotency_key = v_idempotency_key
      AND events.entity_type = 'journal'
      AND events.entity_id = p_entry_id
      AND events.op = 'delete'
      AND events.payload IS NULL
  ) THEN
    RAISE EXCEPTION 'Journal delete event idempotency collision'
      USING ERRCODE = '23505';
  END IF;
END;
$$;

REVOKE ALL ON FUNCTION private.record_permanent_journal_entry_delete(uuid, text, text)
  FROM PUBLIC, anon, authenticated, service_role;

CREATE OR REPLACE FUNCTION private.record_journal_entry_delete_trigger()
RETURNS trigger
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  -- Account deletion is already protected by its permanent barrier and does not
  -- need per-entry events while the whole owner is being removed.
  IF EXISTS (
    SELECT 1
    FROM public.account_deletion_blocks AS deletion_block
    WHERE deletion_block.user_id = OLD.user_id
  ) THEN
    RETURN OLD;
  END IF;

  IF (SELECT auth.uid()) IS DISTINCT FROM OLD.user_id THEN
    RAISE EXCEPTION 'Journal entry delete owner mismatch' USING ERRCODE = '42501';
  END IF;

  PERFORM private.record_permanent_journal_entry_delete(
    OLD.user_id,
    OLD.id,
    'server:legacy-journal-delete'
  );
  RETURN OLD;
END;
$$;

REVOKE ALL ON FUNCTION private.record_journal_entry_delete_trigger()
  FROM PUBLIC, anon, authenticated, service_role;

DROP TRIGGER IF EXISTS record_permanent_journal_entry_delete
  ON public.journal_entries;
CREATE TRIGGER record_permanent_journal_entry_delete
  BEFORE DELETE ON public.journal_entries
  FOR EACH ROW
  EXECUTE FUNCTION private.record_journal_entry_delete_trigger();

CREATE OR REPLACE FUNCTION public.delete_journal_entry_permanently(
  p_entry_id text,
  p_device_id text
)
RETURNS text
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_user_id uuid := (SELECT auth.uid());
  v_write_mode text;
  v_entry_exists boolean;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Authentication required' USING ERRCODE = '42501';
  END IF;
  IF p_entry_id IS NULL
    OR length(p_entry_id) = 0
    OR p_device_id IS NULL
    OR length(p_device_id) NOT BETWEEN 1 AND 512
  THEN
    RAISE EXCEPTION 'Invalid journal deletion identity' USING ERRCODE = '22023';
  END IF;

  PERFORM pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(v_user_id::text, 0)
  );

  -- Lock an existing row before journal security state. A concurrent UPDATE
  -- already holds the row before its protected-write trigger locks that state,
  -- so this order avoids the inverse state-to-row deadlock.
  PERFORM 1
  FROM public.journal_entries AS entries
  WHERE entries.user_id = v_user_id
    AND entries.id = p_entry_id
  FOR UPDATE;
  v_entry_exists := FOUND;

  SELECT state_row.journal_write_mode
  INTO v_write_mode
  FROM public.journal_security_states AS state_row
  WHERE state_row.user_id = v_user_id
  FOR UPDATE;

  IF FOUND AND v_write_mode = 'paused' THEN
    RETURN 'paused';
  END IF;

  IF v_entry_exists THEN
    -- Existing ON DELETE CASCADE constraints remove photos, audio, and
    -- embeddings inside this transaction. The BEFORE DELETE trigger appends
    -- the permanent lifecycle and exact durable event after the pause fence.
    DELETE FROM public.journal_entries
    WHERE user_id = v_user_id
      AND id = p_entry_id;

    RETURN 'complete';
  END IF;

  -- For an already-absent row, security-state then lifecycle ordering matches
  -- protected INSERT. Marking the lifecycle deleted blocks a concurrent
  -- resurrection; the final DELETE catches a row admitted just before it.
  PERFORM private.record_permanent_journal_entry_delete(
    v_user_id,
    p_entry_id,
    p_device_id
  );

  DELETE FROM public.journal_entries
  WHERE user_id = v_user_id
    AND id = p_entry_id;

  RETURN 'complete';
END;
$$;

REVOKE ALL ON FUNCTION public.delete_journal_entry_permanently(text, text)
  FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.delete_journal_entry_permanently(text, text)
  TO authenticated;

COMMENT ON TABLE private.journal_entry_lifecycles IS
  'Permanent owner-bound journal entry identifier registry; deleted identifiers are never reusable.';
COMMENT ON FUNCTION public.delete_journal_entry_permanently(text, text) IS
  'Atomically tombstones a journal entry identifier, deletes the row and cascaded metadata, and appends its durable delete event.';

NOTIFY pgrst, 'reload schema';

COMMIT;

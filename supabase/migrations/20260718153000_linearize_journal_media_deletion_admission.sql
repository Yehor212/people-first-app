-- Linearize authenticated journal-media writes with the durable account
-- deletion tombstone. The deletion worker already sweeps Storage before and
-- after row deletion; this migration closes the remaining late-commit window
-- without adding a third best-effort sweep.

-- Keep the SECURITY DEFINER policy helper outside the schemas exposed by the
-- tracked Data API config. Authenticated receives only the USAGE/EXECUTE pair
-- needed for policy evaluation; arbitrary-owner calls fail before locking.
CREATE SCHEMA IF NOT EXISTS security;

REVOKE ALL ON SCHEMA security FROM PUBLIC, anon, authenticated, service_role;
GRANT USAGE ON SCHEMA security TO authenticated;

CREATE OR REPLACE FUNCTION security.authorize_journal_media_write(
  p_owner_id uuid
)
RETURNS boolean
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_caller_id uuid;
  v_write_allowed boolean;
BEGIN
  v_caller_id := (SELECT auth.uid());

  IF p_owner_id IS NULL
    OR v_caller_id IS NULL
    OR p_owner_id <> v_caller_id
  THEN
    RETURN false;
  END IF;

  -- This key and seed are identical to account-deletion admission. A write
  -- that owns the lock commits before the block can commit; a write that waits
  -- performs the tombstone query below with a fresh VOLATILE-function snapshot.
  -- PostgreSQL snapshot contract:
  -- https://www.postgresql.org/docs/current/xfunc-volatility.html
  PERFORM pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(p_owner_id::text, 0)
  );

  SELECT NOT EXISTS (
    SELECT 1
    FROM public.account_deletion_blocks AS deletion_block
    WHERE deletion_block.user_id = p_owner_id
  )
  INTO v_write_allowed;

  RETURN v_write_allowed;
END;
$$;

REVOKE ALL ON FUNCTION security.authorize_journal_media_write(uuid)
  FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION security.authorize_journal_media_write(uuid)
  TO authenticated;

COMMENT ON FUNCTION security.authorize_journal_media_write(uuid) IS
  'Caller-bound journal Storage write admission serialized with the permanent account-deletion tombstone.';

CREATE OR REPLACE FUNCTION private.serialize_account_deletion_block_insert()
RETURNS trigger
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  IF NEW.user_id IS NULL THEN
    RAISE EXCEPTION 'Account deletion block owner is required'
      USING ERRCODE = '23502';
  END IF;

  PERFORM pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(NEW.user_id::text, 0)
  );

  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION private.serialize_account_deletion_block_insert()
  FROM PUBLIC, anon, authenticated, service_role;

DROP TRIGGER IF EXISTS serialize_account_deletion_block_insert
  ON public.account_deletion_blocks;
-- ON CONFLICT reaches this BEFORE ROW trigger before PostgreSQL performs conflict arbitration.
-- https://www.postgresql.org/docs/current/sql-insert.html#SQL-ON-CONFLICT
CREATE TRIGGER serialize_account_deletion_block_insert
  BEFORE INSERT ON public.account_deletion_blocks
  FOR EACH ROW
  EXECUTE FUNCTION private.serialize_account_deletion_block_insert();

COMMENT ON FUNCTION private.serialize_account_deletion_block_insert() IS
  'Acquires the account owner deletion-admission lock for every tombstone INSERT, including ON CONFLICT DO NOTHING.';

-- The recovery RPC previously took its operation-row lock before inserting the
-- block. Once block INSERTs acquire the owner lock, that would invert the
-- authenticated begin path (owner lock, then operation row) and permit a
-- deadlock. Resolve the capability without a row lock, acquire the owner lock,
-- then re-read and lock the operation while revalidating the capability.
CREATE OR REPLACE FUNCTION public.claim_account_deletion_operation(
  p_operation_id uuid,
  p_recovery_secret_hash text
)
RETURNS TABLE (
  state text,
  user_id uuid,
  lease_token uuid,
  lease_epoch bigint,
  phase text
)
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = ''
AS $$
DECLARE
  v_operation private.account_deletion_operations%ROWTYPE;
  v_owner_user_id uuid;
BEGIN
  IF p_operation_id IS NULL
    OR p_recovery_secret_hash !~ '^[a-f0-9]{64}$'
  THEN
    RETURN QUERY SELECT 'invalid'::text, NULL::uuid, NULL::uuid, NULL::bigint, NULL::text;
    RETURN;
  END IF;

  -- A wrong capability never discovers or locks the operation owner.
  SELECT operation_row.user_id
  INTO v_owner_user_id
  FROM private.account_deletion_operations AS operation_row
  WHERE operation_row.operation_id = p_operation_id
    AND operation_row.recovery_secret_hash = decode(p_recovery_secret_hash, 'hex');

  IF NOT FOUND THEN
    RETURN QUERY SELECT 'invalid'::text, NULL::uuid, NULL::uuid, NULL::bigint, NULL::text;
    RETURN;
  END IF;

  IF v_owner_user_id IS NOT NULL THEN
    PERFORM pg_catalog.pg_advisory_xact_lock(
      pg_catalog.hashtextextended(v_owner_user_id::text, 0)
    );
  END IF;

  SELECT operation_row.*
  INTO v_operation
  FROM private.account_deletion_operations AS operation_row
  WHERE operation_row.operation_id = p_operation_id
    AND operation_row.recovery_secret_hash = decode(p_recovery_secret_hash, 'hex')
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN QUERY SELECT 'invalid'::text, NULL::uuid, NULL::uuid, NULL::bigint, NULL::text;
    RETURN;
  END IF;

  IF v_operation.status = 'deleted' THEN
    RETURN QUERY SELECT 'deleted'::text, NULL::uuid, NULL::uuid, v_operation.lease_epoch, v_operation.phase;
    RETURN;
  END IF;

  IF v_operation.user_id IS NULL
    OR v_owner_user_id IS NULL
    OR v_operation.user_id IS DISTINCT FROM v_owner_user_id
  THEN
    RETURN QUERY SELECT 'invalid'::text, NULL::uuid, NULL::uuid, NULL::bigint, NULL::text;
    RETURN;
  END IF;

  INSERT INTO public.account_deletion_blocks (user_id, blocked_at)
  VALUES (v_operation.user_id, now())
  ON CONFLICT ON CONSTRAINT account_deletion_blocks_pkey DO NOTHING;

  IF v_operation.status = 'running'
    AND v_operation.lease_expires_at > now()
  THEN
    RETURN QUERY SELECT 'pending'::text, NULL::uuid, NULL::uuid, v_operation.lease_epoch, v_operation.phase;
    RETURN;
  END IF;

  UPDATE private.account_deletion_operations AS operation_row
  SET
    status = 'running',
    lease_token = extensions.gen_random_uuid(),
    lease_epoch = operation_row.lease_epoch + 1,
    lease_expires_at = now() + interval '2 minutes',
    updated_at = now()
  WHERE operation_row.operation_id = p_operation_id
  RETURNING operation_row.* INTO v_operation;

  RETURN QUERY
  SELECT
    'claimed'::text,
    v_operation.user_id,
    v_operation.lease_token,
    v_operation.lease_epoch,
    v_operation.phase;
END;
$$;

-- Recreate only write policies. Existing SELECT/DELETE barriers remain intact.
-- Parent journal membership is still authoritative for both media families.
DROP POLICY IF EXISTS "journal_photos_upload" ON storage.objects;
CREATE POLICY "journal_photos_upload" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'journal-photos'
    AND (storage.foldername(name))[1] = (SELECT auth.uid())::text
    AND security.authorize_journal_media_write((SELECT auth.uid()))
    AND EXISTS (
      SELECT 1 FROM public.journal_entries AS entries
      WHERE entries.user_id = (SELECT auth.uid())
        AND split_part(storage.filename(name), '.', 1) = ANY (
          COALESCE(entries.photo_ids, '{}'::text[])
        )
    )
  );

DROP POLICY IF EXISTS "journal_photos_update" ON storage.objects;
CREATE POLICY "journal_photos_update" ON storage.objects
  FOR UPDATE TO authenticated
  USING (
    bucket_id = 'journal-photos'
    AND (storage.foldername(name))[1] = (SELECT auth.uid())::text
    AND security.authorize_journal_media_write((SELECT auth.uid()))
    AND EXISTS (
      SELECT 1 FROM public.journal_entries AS entries
      WHERE entries.user_id = (SELECT auth.uid())
        AND split_part(storage.filename(name), '.', 1) = ANY (
          COALESCE(entries.photo_ids, '{}'::text[])
        )
    )
  )
  WITH CHECK (
    bucket_id = 'journal-photos'
    AND (storage.foldername(name))[1] = (SELECT auth.uid())::text
    AND security.authorize_journal_media_write((SELECT auth.uid()))
    AND EXISTS (
      SELECT 1 FROM public.journal_entries AS entries
      WHERE entries.user_id = (SELECT auth.uid())
        AND split_part(storage.filename(name), '.', 1) = ANY (
          COALESCE(entries.photo_ids, '{}'::text[])
        )
    )
  );

DROP POLICY IF EXISTS "journal_audio_upload" ON storage.objects;
CREATE POLICY "journal_audio_upload" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'journal-audio'
    AND (storage.foldername(name))[1] = (SELECT auth.uid())::text
    AND security.authorize_journal_media_write((SELECT auth.uid()))
    AND EXISTS (
      SELECT 1 FROM public.journal_entries AS entries
      WHERE entries.user_id = (SELECT auth.uid())
        AND split_part(storage.filename(name), '.', 1) = ANY (
          COALESCE(entries.audio_ids, '{}'::text[])
        )
    )
  );

DROP POLICY IF EXISTS "journal_audio_update" ON storage.objects;
CREATE POLICY "journal_audio_update" ON storage.objects
  FOR UPDATE TO authenticated
  USING (
    bucket_id = 'journal-audio'
    AND (storage.foldername(name))[1] = (SELECT auth.uid())::text
    AND security.authorize_journal_media_write((SELECT auth.uid()))
    AND EXISTS (
      SELECT 1 FROM public.journal_entries AS entries
      WHERE entries.user_id = (SELECT auth.uid())
        AND split_part(storage.filename(name), '.', 1) = ANY (
          COALESCE(entries.audio_ids, '{}'::text[])
        )
    )
  )
  WITH CHECK (
    bucket_id = 'journal-audio'
    AND (storage.foldername(name))[1] = (SELECT auth.uid())::text
    AND security.authorize_journal_media_write((SELECT auth.uid()))
    AND EXISTS (
      SELECT 1 FROM public.journal_entries AS entries
      WHERE entries.user_id = (SELECT auth.uid())
        AND split_part(storage.filename(name), '.', 1) = ANY (
          COALESCE(entries.audio_ids, '{}'::text[])
        )
    )
  );

REVOKE ALL ON FUNCTION public.claim_account_deletion_operation(uuid, text)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.claim_account_deletion_operation(uuid, text)
  TO service_role;

NOTIFY pgrst, 'reload schema';

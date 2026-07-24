-- Close stale-snapshot windows around journal-media admission, push permits,
-- and account-deletion terminal transitions. These functions deliberately
-- fail closed outside READ COMMITTED: PostgreSQL cannot refresh a transaction
-- snapshot after waiting on an advisory lock under REPEATABLE READ or
-- SERIALIZABLE.

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

  IF pg_catalog.current_setting('transaction_isolation') <> 'read committed' THEN
    RETURN false;
  END IF;

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

REVOKE ALL ON SCHEMA security FROM PUBLIC, anon, authenticated, service_role;
GRANT USAGE ON SCHEMA security TO authenticated;

REVOKE ALL ON FUNCTION security.authorize_journal_media_write(uuid)
  FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION security.authorize_journal_media_write(uuid)
  TO authenticated;

COMMENT ON FUNCTION security.authorize_journal_media_write(uuid) IS
  'Caller-bound journal Storage write admission serialized with account deletion; fail-closed outside READ COMMITTED.';

CREATE OR REPLACE FUNCTION public.acquire_push_delivery_permit(
  p_owner_id uuid,
  p_permit_token uuid
)
RETURNS TABLE (
  state text,
  owner_id uuid,
  permit_token uuid,
  lease_epoch bigint,
  lease_expires_at timestamptz
)
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_now timestamptz;
  v_active_permit_count integer;
  v_lease_epoch bigint;
  v_lease_expires_at timestamptz;
BEGIN
  IF p_owner_id IS NULL OR p_permit_token IS NULL THEN
    RETURN QUERY
    SELECT 'unavailable'::text, NULL::uuid, NULL::uuid, NULL::bigint, NULL::timestamptz;
    RETURN;
  END IF;

  IF pg_catalog.current_setting('transaction_isolation') <> 'read committed' THEN
    RETURN QUERY
    SELECT 'unavailable'::text, NULL::uuid, NULL::uuid, NULL::bigint, NULL::timestamptz;
    RETURN;
  END IF;

  PERFORM pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(p_owner_id::text, 0)
  );
  v_now := pg_catalog.clock_timestamp();

  IF EXISTS (
    SELECT 1
    FROM public.account_deletion_blocks AS deletion_block
    WHERE deletion_block.user_id = p_owner_id
  ) THEN
    RETURN QUERY
    SELECT 'blocked'::text, NULL::uuid, NULL::uuid, NULL::bigint, NULL::timestamptz;
    RETURN;
  END IF;

  DELETE FROM private.push_delivery_permits AS permit
  WHERE permit.user_id = p_owner_id
    AND permit.lease_expires_at <= v_now;

  DELETE FROM private.push_delivery_permits AS permit
  WHERE permit.ctid IN (
    SELECT expired_permit.ctid
    FROM private.push_delivery_permits AS expired_permit
    WHERE expired_permit.lease_expires_at <= v_now
    ORDER BY expired_permit.lease_expires_at
    LIMIT 256
    FOR UPDATE SKIP LOCKED
  );

  SELECT count(*)::integer
  INTO v_active_permit_count
  FROM private.push_delivery_permits AS active_permit
  WHERE active_permit.user_id = p_owner_id
    AND active_permit.lease_expires_at > v_now;

  IF v_active_permit_count >= 32 THEN
    RETURN QUERY
    SELECT 'unavailable'::text, NULL::uuid, NULL::uuid, NULL::bigint, NULL::timestamptz;
    RETURN;
  END IF;

  v_lease_epoch := nextval('private.push_delivery_permit_epoch_seq');
  v_lease_expires_at := v_now + interval '10 minutes';

  BEGIN
    INSERT INTO private.push_delivery_permits (
      user_id,
      permit_token,
      lease_epoch,
      lease_expires_at
    ) VALUES (
      p_owner_id,
      p_permit_token,
      v_lease_epoch,
      v_lease_expires_at
    );
  EXCEPTION WHEN unique_violation THEN
    RETURN QUERY
    SELECT 'unavailable'::text, NULL::uuid, NULL::uuid, NULL::bigint, NULL::timestamptz;
    RETURN;
  END;

  RETURN QUERY
  SELECT
    'admitted'::text,
    p_owner_id,
    p_permit_token,
    v_lease_epoch,
    v_lease_expires_at;
END;
$$;

CREATE OR REPLACE FUNCTION public.drain_account_push_delivery_permits(
  p_operation_id uuid,
  p_recovery_secret_hash text,
  p_lease_token uuid,
  p_lease_epoch bigint
)
RETURNS boolean
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  operation_row record;
  v_owner_user_id uuid;
  v_now timestamptz;
BEGIN
  IF p_operation_id IS NULL
    OR p_recovery_secret_hash !~ '^[a-f0-9]{64}$'
    OR p_lease_token IS NULL
    OR p_lease_epoch IS NULL
    OR p_lease_epoch <= 0
  THEN
    RETURN false;
  END IF;

  IF pg_catalog.current_setting('transaction_isolation') <> 'read committed' THEN
    RETURN false;
  END IF;

  SELECT candidate.user_id
  INTO v_owner_user_id
  FROM private.account_deletion_operations AS candidate
  WHERE candidate.operation_id = p_operation_id
    AND candidate.recovery_secret_hash = decode(p_recovery_secret_hash, 'hex');

  IF NOT FOUND OR v_owner_user_id IS NULL THEN
    RETURN false;
  END IF;

  PERFORM pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(v_owner_user_id::text, 0)
  );
  v_now := pg_catalog.clock_timestamp();

  SELECT current_operation.*
  INTO operation_row
  FROM private.account_deletion_operations AS current_operation
  WHERE current_operation.operation_id = p_operation_id
    AND current_operation.recovery_secret_hash = decode(p_recovery_secret_hash, 'hex')
  FOR UPDATE;

  IF NOT FOUND OR NOT (
    operation_row.user_id IS NOT DISTINCT FROM v_owner_user_id
    AND operation_row.status = 'running'
    AND operation_row.lease_token = p_lease_token
    AND operation_row.lease_epoch = p_lease_epoch
    AND operation_row.phase = 'push-drain'
    AND operation_row.lease_expires_at > v_now
  ) THEN
    RETURN false;
  END IF;

  DELETE FROM private.push_delivery_permits AS permit
  WHERE permit.user_id = v_owner_user_id
    AND permit.lease_expires_at <= v_now;

  RETURN NOT EXISTS (
    SELECT 1
    FROM private.push_delivery_permits AS active_permit
    WHERE active_permit.user_id = v_owner_user_id
      AND active_permit.lease_expires_at > v_now
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.advance_account_deletion_operation_phase(
  p_operation_id uuid,
  p_recovery_secret_hash text,
  p_lease_token uuid,
  p_lease_epoch bigint,
  p_next_phase text
)
RETURNS boolean
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  operation_row record;
  v_owner_user_id uuid;
  v_now timestamptz;
BEGIN
  IF p_operation_id IS NULL
    OR p_recovery_secret_hash !~ '^[a-f0-9]{64}$'
    OR p_lease_token IS NULL
    OR p_lease_epoch IS NULL
    OR p_lease_epoch <= 0
    OR p_next_phase IS NULL
  THEN
    RETURN false;
  END IF;

  IF pg_catalog.current_setting('transaction_isolation') <> 'read committed' THEN
    RETURN false;
  END IF;

  SELECT candidate.user_id
  INTO v_owner_user_id
  FROM private.account_deletion_operations AS candidate
  WHERE candidate.operation_id = p_operation_id
    AND candidate.recovery_secret_hash = decode(p_recovery_secret_hash, 'hex');

  IF NOT FOUND OR v_owner_user_id IS NULL THEN
    RETURN false;
  END IF;

  PERFORM pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(v_owner_user_id::text, 0)
  );
  v_now := pg_catalog.clock_timestamp();

  SELECT current_operation.*
  INTO operation_row
  FROM private.account_deletion_operations AS current_operation
  WHERE current_operation.operation_id = p_operation_id
    AND current_operation.recovery_secret_hash = decode(p_recovery_secret_hash, 'hex')
  FOR UPDATE;

  IF NOT FOUND OR NOT (
    operation_row.user_id IS NOT DISTINCT FROM v_owner_user_id
    AND operation_row.status = 'running'
    AND operation_row.lease_token = p_lease_token
    AND operation_row.lease_epoch = p_lease_epoch
    AND operation_row.lease_expires_at > v_now
  ) THEN
    RETURN false;
  END IF;

  IF operation_row.phase = 'push-drain'
    AND p_next_phase = 'media-before-rows'
  THEN
    IF NOT EXISTS (
      SELECT 1
      FROM private.push_delivery_permits AS active_permit
      WHERE active_permit.user_id = v_owner_user_id
        AND active_permit.lease_expires_at > v_now
    ) THEN
      UPDATE private.account_deletion_operations AS current_operation
      SET phase = p_next_phase, updated_at = v_now
      WHERE current_operation.operation_id = p_operation_id
        AND current_operation.user_id = v_owner_user_id
        AND current_operation.recovery_secret_hash = decode(p_recovery_secret_hash, 'hex')
        AND current_operation.status = 'running'
        AND current_operation.phase = 'push-drain'
        AND current_operation.lease_token = p_lease_token
        AND current_operation.lease_epoch = p_lease_epoch
        AND current_operation.lease_expires_at > v_now;
      RETURN FOUND;
    END IF;

    RETURN false;
  END IF;

  IF NOT (
    (operation_row.phase = 'media-before-rows' AND p_next_phase = 'rows')
    OR (operation_row.phase = 'rows' AND p_next_phase = 'media-after-rows')
    OR (operation_row.phase = 'media-after-rows' AND p_next_phase = 'auth')
  ) THEN
    RETURN false;
  END IF;

  UPDATE private.account_deletion_operations AS current_operation
  SET phase = p_next_phase, updated_at = v_now
  WHERE current_operation.operation_id = p_operation_id
    AND current_operation.user_id = v_owner_user_id
    AND current_operation.recovery_secret_hash = decode(p_recovery_secret_hash, 'hex')
    AND current_operation.status = 'running'
    AND current_operation.phase = operation_row.phase
    AND current_operation.lease_token = p_lease_token
    AND current_operation.lease_epoch = p_lease_epoch
    AND current_operation.lease_expires_at > v_now;

  RETURN FOUND;
END;
$$;

CREATE OR REPLACE FUNCTION public.complete_account_deletion_operation(
  p_operation_id uuid,
  p_recovery_secret_hash text,
  p_lease_token uuid,
  p_lease_epoch bigint
)
RETURNS boolean
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  operation_row record;
  v_owner_user_id uuid;
  v_now timestamptz;
BEGIN
  IF p_operation_id IS NULL
    OR p_recovery_secret_hash !~ '^[a-f0-9]{64}$'
    OR p_lease_token IS NULL
    OR p_lease_epoch IS NULL
    OR p_lease_epoch <= 0
  THEN
    RETURN false;
  END IF;

  IF pg_catalog.current_setting('transaction_isolation') <> 'read committed' THEN
    RETURN false;
  END IF;

  SELECT candidate.user_id
  INTO v_owner_user_id
  FROM private.account_deletion_operations AS candidate
  WHERE candidate.operation_id = p_operation_id
    AND candidate.recovery_secret_hash = decode(p_recovery_secret_hash, 'hex');

  IF NOT FOUND OR v_owner_user_id IS NULL THEN
    RETURN false;
  END IF;

  PERFORM pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(v_owner_user_id::text, 0)
  );
  v_now := pg_catalog.clock_timestamp();

  SELECT current_operation.*
  INTO operation_row
  FROM private.account_deletion_operations AS current_operation
  WHERE current_operation.operation_id = p_operation_id
    AND current_operation.recovery_secret_hash = decode(p_recovery_secret_hash, 'hex')
  FOR UPDATE;

  IF NOT FOUND OR NOT (
    operation_row.user_id IS NOT DISTINCT FROM v_owner_user_id
    AND operation_row.status = 'running'
    AND operation_row.phase = 'auth'
    AND operation_row.lease_token = p_lease_token
    AND operation_row.lease_epoch = p_lease_epoch
    AND operation_row.lease_expires_at > v_now
  ) THEN
    RETURN false;
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM auth.users AS auth_user
    WHERE auth_user.id = v_owner_user_id
  ) AND NOT EXISTS (
    SELECT 1
    FROM private.push_delivery_permits AS active_permit
    WHERE active_permit.user_id = v_owner_user_id
      AND active_permit.lease_expires_at > v_now
  ) THEN
    UPDATE private.account_deletion_operations AS current_operation
    SET
      user_id = NULL,
      status = 'deleted',
      lease_token = NULL,
      lease_expires_at = NULL,
      completed_at = v_now,
      updated_at = v_now
    WHERE current_operation.operation_id = p_operation_id
      AND current_operation.user_id = v_owner_user_id
      AND current_operation.recovery_secret_hash = decode(p_recovery_secret_hash, 'hex')
      AND current_operation.status = 'running'
      AND current_operation.phase = 'auth'
      AND current_operation.lease_token = p_lease_token
      AND current_operation.lease_epoch = p_lease_epoch
      AND current_operation.lease_expires_at > v_now;

    RETURN FOUND;
  END IF;

  RETURN false;
END;
$$;

REVOKE ALL ON FUNCTION public.acquire_push_delivery_permit(uuid, uuid)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.acquire_push_delivery_permit(uuid, uuid)
  TO service_role;

REVOKE ALL ON FUNCTION public.drain_account_push_delivery_permits(uuid, text, uuid, bigint)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.drain_account_push_delivery_permits(uuid, text, uuid, bigint)
  TO service_role;

REVOKE ALL ON FUNCTION public.advance_account_deletion_operation_phase(uuid, text, uuid, bigint, text)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.advance_account_deletion_operation_phase(uuid, text, uuid, bigint, text)
  TO service_role;

REVOKE ALL ON FUNCTION public.complete_account_deletion_operation(uuid, text, uuid, bigint)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.complete_account_deletion_operation(uuid, text, uuid, bigint)
  TO service_role;

NOTIFY pgrst, 'reload schema';

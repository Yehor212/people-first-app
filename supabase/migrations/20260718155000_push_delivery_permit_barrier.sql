-- Serialize push-provider admission with the permanent account-deletion
-- tombstone. A live permit is a bounded lease, not proof that a provider
-- accepted or a device displayed the notification.

CREATE SEQUENCE private.push_delivery_permit_epoch_seq AS bigint NO CYCLE;

CREATE TABLE private.push_delivery_permits (
  user_id uuid NOT NULL,
  permit_token uuid NOT NULL,
  lease_epoch bigint NOT NULL
    DEFAULT nextval('private.push_delivery_permit_epoch_seq'),
  lease_expires_at timestamptz NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, permit_token),
  FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE,
  CHECK (lease_epoch > 0)
);

CREATE INDEX push_delivery_permits_expiry_idx
  ON private.push_delivery_permits (lease_expires_at);

ALTER TABLE private.push_delivery_permits ENABLE ROW LEVEL SECURITY;
ALTER TABLE private.push_delivery_permits FORCE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE private.push_delivery_permits
  FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON SEQUENCE private.push_delivery_permit_epoch_seq
  FROM PUBLIC, anon, authenticated, service_role;

COMMENT ON TABLE private.push_delivery_permits IS
  'Short-lived service permits that fence push-provider calls from account deletion. Provider acceptance and device delivery remain outside this database contract.';

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

  -- This lock key and seed are identical to the deletion-block trigger. The
  -- winner commits before the waiter evaluates the tombstone/permit state.
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

  -- The owner lock makes exact-owner expiry cleanup deterministic. A bounded
  -- opportunistic sweep prevents expired crash leases accumulating globally
  -- without letting one request perform unbounded maintenance work.
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
  -- Supabase Edge Functions have a 400-second paid-plan wall-clock limit. A
  -- ten-minute lease outlives that runtime while remaining self-recovering.
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

CREATE OR REPLACE FUNCTION public.release_push_delivery_permit(
  p_owner_id uuid,
  p_permit_token uuid,
  p_lease_epoch bigint
)
RETURNS boolean
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  IF p_owner_id IS NULL
    OR p_permit_token IS NULL
    OR p_lease_epoch IS NULL
    OR p_lease_epoch <= 0
  THEN
    RETURN false;
  END IF;

  PERFORM pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(p_owner_id::text, 0)
  );

  DELETE FROM private.push_delivery_permits AS permit
  WHERE permit.user_id = p_owner_id
    AND permit.permit_token = p_permit_token
    AND permit.lease_epoch = p_lease_epoch;
  RETURN FOUND;
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
  operation_row private.account_deletion_operations%ROWTYPE;
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

  -- Resolve only a capability-authorized owner before taking any owner lock.
  SELECT candidate.user_id
  INTO v_owner_user_id
  FROM private.account_deletion_operations AS candidate
  WHERE candidate.operation_id = p_operation_id
    AND candidate.recovery_secret_hash = decode(p_recovery_secret_hash, 'hex');

  IF NOT FOUND OR v_owner_user_id IS NULL THEN
    RETURN false;
  END IF;

  -- Preserve the project-wide order: owner advisory lock, then operation row.
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
  WHERE permit.user_id = operation_row.user_id
    AND permit.lease_expires_at <= v_now;

  RETURN NOT EXISTS (
    SELECT 1
    FROM private.push_delivery_permits AS active_permit
    WHERE active_permit.user_id = operation_row.user_id
      AND active_permit.lease_expires_at > v_now
  );
END;
$$;

ALTER TABLE private.account_deletion_operations
  DROP CONSTRAINT IF EXISTS account_deletion_operations_phase_check;
ALTER TABLE private.account_deletion_operations
  ADD CONSTRAINT account_deletion_operations_phase_check
  CHECK (phase IN ('push-drain', 'media-before-rows', 'rows', 'media-after-rows', 'auth'));
ALTER TABLE private.account_deletion_operations
  ALTER COLUMN phase SET DEFAULT 'push-drain';

CREATE OR REPLACE FUNCTION public.advance_account_deletion_operation_phase(
  p_operation_id uuid,
  p_recovery_secret_hash text,
  p_lease_token uuid,
  p_lease_epoch bigint,
  p_next_phase text
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = ''
AS $$
BEGIN
  UPDATE private.account_deletion_operations AS operation_row
  SET phase = p_next_phase, updated_at = now()
  WHERE operation_row.operation_id = p_operation_id
    AND operation_row.recovery_secret_hash = decode(p_recovery_secret_hash, 'hex')
    AND operation_row.status = 'running'
    AND operation_row.lease_token = p_lease_token
    AND operation_row.lease_epoch = p_lease_epoch
    AND operation_row.lease_expires_at > now()
    AND (
      (operation_row.phase = 'push-drain' AND p_next_phase = 'media-before-rows')
      OR (operation_row.phase = 'media-before-rows' AND p_next_phase = 'rows')
      OR (operation_row.phase = 'rows' AND p_next_phase = 'media-after-rows')
      OR (operation_row.phase = 'media-after-rows' AND p_next_phase = 'auth')
    );
  RETURN FOUND;
END;
$$;

REVOKE ALL ON FUNCTION public.acquire_push_delivery_permit(uuid, uuid)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.acquire_push_delivery_permit(uuid, uuid)
  TO service_role;

REVOKE ALL ON FUNCTION public.release_push_delivery_permit(uuid, uuid, bigint)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.release_push_delivery_permit(uuid, uuid, bigint)
  TO service_role;

REVOKE ALL ON FUNCTION public.drain_account_push_delivery_permits(uuid, text, uuid, bigint)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.drain_account_push_delivery_permits(uuid, text, uuid, bigint)
  TO service_role;

REVOKE ALL ON FUNCTION public.advance_account_deletion_operation_phase(uuid, text, uuid, bigint, text)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.advance_account_deletion_operation_phase(uuid, text, uuid, bigint, text)
  TO service_role;

NOTIFY pgrst, 'reload schema';

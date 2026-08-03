-- Bound public account-deletion recovery work without trusting caller-supplied
-- network headers. A valid capability must pass this database-backed admission
-- gate before the Edge worker can claim or continue destructive work.

ALTER TABLE private.account_deletion_operations
  ADD COLUMN abandoned_at timestamptz;

ALTER TABLE private.account_deletion_operations
  DROP CONSTRAINT account_deletion_operations_status_check;
ALTER TABLE private.account_deletion_operations
  DROP CONSTRAINT account_deletion_operations_check;

ALTER TABLE private.account_deletion_operations
  ADD CONSTRAINT account_deletion_operations_status_check
  CHECK (status IN ('pending', 'running', 'deleted', 'abandoned'));

ALTER TABLE private.account_deletion_operations
  ADD CONSTRAINT account_deletion_operations_state_check
  CHECK (
    (status = 'pending' AND user_id IS NOT NULL AND lease_token IS NULL
      AND lease_expires_at IS NULL AND completed_at IS NULL
      AND abandoned_at IS NULL)
    OR
    (status = 'running' AND user_id IS NOT NULL AND lease_token IS NOT NULL
      AND lease_expires_at IS NOT NULL AND completed_at IS NULL
      AND abandoned_at IS NULL)
    OR
    (status = 'deleted' AND user_id IS NULL AND lease_token IS NULL
      AND lease_expires_at IS NULL AND completed_at IS NOT NULL
      AND abandoned_at IS NULL)
    OR
    (status = 'abandoned' AND user_id IS NULL AND lease_token IS NULL
      AND lease_expires_at IS NULL AND completed_at IS NULL
      AND abandoned_at IS NOT NULL)
  );

CREATE INDEX account_deletion_operations_active_owner_updated_idx
  ON private.account_deletion_operations (user_id, updated_at)
  WHERE status IN ('pending', 'running');

CREATE TABLE private.account_deletion_recovery_admission (
  operation_id uuid PRIMARY KEY
    REFERENCES private.account_deletion_operations(operation_id)
    ON DELETE CASCADE,
  tokens numeric(8, 4) NOT NULL DEFAULT 6.0000
    CHECK (tokens >= 0 AND tokens <= 6.0000),
  refilled_at timestamptz NOT NULL DEFAULT now(),
  last_seen_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX account_deletion_recovery_admission_last_seen_idx
  ON private.account_deletion_recovery_admission (last_seen_at);

ALTER TABLE private.account_deletion_recovery_admission ENABLE ROW LEVEL SECURITY;
ALTER TABLE private.account_deletion_recovery_admission FORCE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE private.account_deletion_recovery_admission
  FROM PUBLIC, anon, authenticated;
GRANT ALL ON TABLE private.account_deletion_recovery_admission TO service_role;

COMMENT ON TABLE private.account_deletion_recovery_admission IS
  'Distributed six-token recovery bucket. Rows are created only by a matching capability, contain no raw capability or network identity, and are pruned after 30 days of inactivity.';

-- Recreate authenticated admission so a still-live Auth owner can replace
-- abandoned capabilities. Fifteen minutes is deliberately greater than twice
-- the documented 400-second hosted Edge maximum wall-clock duration: a worker
-- cannot still be executing in that hosted request after this grace expires.
-- If Auth has already been deleted, this RPC cannot be reached as that owner,
-- so the last recovery capability remains usable through the public claim RPC.
CREATE OR REPLACE FUNCTION public.begin_account_deletion_operation(
  p_operation_id uuid,
  p_user_id uuid,
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
  v_now timestamptz;
  v_abandon_before timestamptz;
BEGIN
  IF p_operation_id IS NULL
    OR p_user_id IS NULL
    OR p_recovery_secret_hash !~ '^[a-f0-9]{64}$'
  THEN
    RETURN QUERY SELECT 'invalid'::text, NULL::uuid, NULL::uuid, NULL::bigint, NULL::text;
    RETURN;
  END IF;

  -- This owner key and seed must remain identical to Storage write admission
  -- and the permanent block trigger introduced by migration 153000.
  PERFORM pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(p_user_id::text, 0)
  );

  v_now := clock_timestamp();
  v_abandon_before := v_now - interval '15 minutes';

  SELECT operation_row.*
  INTO v_operation
  FROM private.account_deletion_operations AS operation_row
  WHERE operation_row.operation_id = p_operation_id
    AND operation_row.recovery_secret_hash = decode(p_recovery_secret_hash, 'hex')
    AND operation_row.owner_binding_hash = extensions.digest(
      convert_to(p_user_id::text || ':' || p_recovery_secret_hash, 'UTF8'),
      'sha256'
    )
    AND (
      (
        operation_row.status IN ('pending', 'running')
        AND operation_row.user_id = p_user_id
      )
      OR operation_row.status = 'deleted'
    )
  FOR UPDATE;

  IF NOT FOUND THEN
    -- A colliding UUID with the wrong owner/capability is rejected without
    -- taking that operation row's lock or rotating any of this owner's rows.
    IF EXISTS (
      SELECT 1
      FROM private.account_deletion_operations AS colliding_operation
      WHERE colliding_operation.operation_id = p_operation_id
    )
    THEN
      RETURN QUERY SELECT 'invalid'::text, NULL::uuid, NULL::uuid, NULL::bigint, NULL::text;
      RETURN;
    END IF;

    -- Rotation is authenticated and owner-serialized. It preserves the
    -- permanent account_deletion_blocks row while revoking only operations
    -- that cannot still have a live hosted Edge worker.
    UPDATE private.account_deletion_operations AS abandoned_operation
    SET
      status = 'abandoned',
      user_id = NULL,
      lease_token = NULL,
      lease_epoch = abandoned_operation.lease_epoch + 1,
      lease_expires_at = NULL,
      updated_at = v_now,
      abandoned_at = v_now
    WHERE abandoned_operation.user_id = p_user_id
      AND abandoned_operation.operation_id <> p_operation_id
      AND (
        (
          abandoned_operation.status = 'pending'
          AND abandoned_operation.updated_at <= v_abandon_before
        )
        OR
        (
          abandoned_operation.status = 'running'
          AND abandoned_operation.lease_expires_at <= v_now
          AND abandoned_operation.updated_at <= v_abandon_before
        )
      );

    DELETE FROM private.account_deletion_recovery_admission AS retired_admission
    WHERE retired_admission.operation_id IN (
      SELECT abandoned_operation.operation_id
      FROM private.account_deletion_operations AS abandoned_operation
      WHERE abandoned_operation.status = 'abandoned'
        AND abandoned_operation.abandoned_at = v_now
    );

    IF (
      SELECT count(*)
      FROM private.account_deletion_operations AS active_operation
      WHERE active_operation.user_id = p_user_id
        AND active_operation.status IN ('pending', 'running')
    ) >= 8
    THEN
      RETURN QUERY SELECT 'invalid'::text, NULL::uuid, NULL::uuid, NULL::bigint, NULL::text;
      RETURN;
    END IF;

    BEGIN
      INSERT INTO private.account_deletion_operations (
        operation_id,
        user_id,
        recovery_secret_hash,
        owner_binding_hash
      ) VALUES (
        p_operation_id,
        p_user_id,
        decode(p_recovery_secret_hash, 'hex'),
        extensions.digest(
          convert_to(p_user_id::text || ':' || p_recovery_secret_hash, 'UTF8'),
          'sha256'
        )
      )
      RETURNING * INTO v_operation;
    EXCEPTION WHEN unique_violation THEN
      RETURN QUERY SELECT 'invalid'::text, NULL::uuid, NULL::uuid, NULL::bigint, NULL::text;
      RETURN;
    END;
  END IF;

  IF NOT FOUND
    OR v_operation.operation_id <> p_operation_id
    OR v_operation.recovery_secret_hash <> decode(p_recovery_secret_hash, 'hex')
    OR v_operation.owner_binding_hash <> extensions.digest(
      convert_to(p_user_id::text || ':' || p_recovery_secret_hash, 'UTF8'),
      'sha256'
    )
    OR (
      v_operation.status <> 'deleted'
      AND (
        v_operation.status NOT IN ('pending', 'running')
        OR v_operation.user_id IS DISTINCT FROM p_user_id
      )
    )
  THEN
    RETURN QUERY SELECT 'invalid'::text, NULL::uuid, NULL::uuid, NULL::bigint, NULL::text;
    RETURN;
  END IF;

  IF v_operation.status = 'deleted' THEN
    RETURN QUERY SELECT 'deleted'::text, NULL::uuid, NULL::uuid, v_operation.lease_epoch, v_operation.phase;
    RETURN;
  END IF;

  INSERT INTO public.account_deletion_blocks (user_id, blocked_at)
  VALUES (p_user_id, v_now)
  ON CONFLICT ON CONSTRAINT account_deletion_blocks_pkey DO NOTHING;

  IF v_operation.status = 'running'
    AND v_operation.lease_expires_at > v_now
  THEN
    RETURN QUERY SELECT 'pending'::text, NULL::uuid, NULL::uuid, v_operation.lease_epoch, v_operation.phase;
    RETURN;
  END IF;

  UPDATE private.account_deletion_operations AS operation_row
  SET
    status = 'running',
    lease_token = extensions.gen_random_uuid(),
    lease_epoch = operation_row.lease_epoch + 1,
    lease_expires_at = v_now + interval '2 minutes',
    updated_at = v_now,
    abandoned_at = NULL
  WHERE operation_row.operation_id = p_operation_id
    AND operation_row.status IN ('pending', 'running')
  RETURNING operation_row.* INTO v_operation;

  IF NOT FOUND THEN
    RETURN QUERY SELECT 'invalid'::text, NULL::uuid, NULL::uuid, NULL::bigint, NULL::text;
    RETURN;
  END IF;

  RETURN QUERY
  SELECT
    'claimed'::text,
    v_operation.user_id,
    v_operation.lease_token,
    v_operation.lease_epoch,
    v_operation.phase;
END;
$$;

-- One operation receives six immediate attempts and then refills at one token
-- per ten seconds. The row lives in Postgres, so every Edge isolate observes
-- the same budget. Invalid capabilities return before any limiter write/lock.
CREATE OR REPLACE FUNCTION public.admit_account_deletion_recovery_attempt(
  p_operation_id uuid,
  p_recovery_secret_hash text
)
RETURNS TABLE (
  state text,
  retry_after_seconds integer
)
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = ''
AS $$
DECLARE
  v_now timestamptz := clock_timestamp();
  v_admitted_operation_id uuid;
  v_tokens numeric(8, 4);
  v_refilled_at timestamptz;
  v_effective_tokens numeric;
BEGIN
  IF p_operation_id IS NULL
    OR p_recovery_secret_hash !~ '^[a-f0-9]{64}$'
  THEN
    RETURN QUERY SELECT 'invalid'::text, 0;
    RETURN;
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM private.account_deletion_operations AS operation_row
    WHERE operation_row.operation_id = p_operation_id
      AND operation_row.recovery_secret_hash = decode(p_recovery_secret_hash, 'hex')
  )
  THEN
    RETURN QUERY SELECT 'invalid'::text, 0;
    RETURN;
  END IF;

  -- Opportunistic cleanup is bounded so a valid recovery request cannot turn
  -- retention work into unbounded latency. Invalid requests never reach it.
  DELETE FROM private.account_deletion_recovery_admission AS expired_admission
  WHERE expired_admission.operation_id IN (
    SELECT stale_admission.operation_id
    FROM private.account_deletion_recovery_admission AS stale_admission
    WHERE stale_admission.last_seen_at < v_now - interval '30 days'
    ORDER BY stale_admission.last_seen_at
    LIMIT 32
    FOR UPDATE SKIP LOCKED
  );

  INSERT INTO private.account_deletion_recovery_admission AS recovery_admission (
    operation_id,
    tokens,
    refilled_at,
    last_seen_at
  )
  SELECT
    operation_row.operation_id,
    5.0000,
    v_now,
    v_now
  FROM private.account_deletion_operations AS operation_row
  WHERE operation_row.operation_id = p_operation_id
    AND operation_row.recovery_secret_hash = decode(p_recovery_secret_hash, 'hex')
  ON CONFLICT (operation_id) DO UPDATE
  SET
    tokens = LEAST(
      6.0000,
      recovery_admission.tokens
        + GREATEST(
          0,
          EXTRACT(EPOCH FROM (v_now - recovery_admission.refilled_at))::numeric
            / 10.0000
        )
    ) - 1.0000,
    refilled_at = v_now,
    last_seen_at = v_now
  WHERE LEAST(
    6.0000,
    recovery_admission.tokens
      + GREATEST(
        0,
        EXTRACT(EPOCH FROM (v_now - recovery_admission.refilled_at))::numeric
          / 10.0000
      )
  ) >= 1.0000
  RETURNING recovery_admission.operation_id INTO v_admitted_operation_id;

  IF v_admitted_operation_id IS NOT NULL THEN
    RETURN QUERY SELECT 'allowed'::text, 0;
    RETURN;
  END IF;

  SELECT admission_row.tokens, admission_row.refilled_at
  INTO v_tokens, v_refilled_at
  FROM private.account_deletion_recovery_admission AS admission_row
  JOIN private.account_deletion_operations AS operation_row
    ON operation_row.operation_id = admission_row.operation_id
  WHERE operation_row.operation_id = p_operation_id
    AND operation_row.recovery_secret_hash = decode(p_recovery_secret_hash, 'hex');

  IF NOT FOUND THEN
    RETURN QUERY SELECT 'invalid'::text, 0;
    RETURN;
  END IF;

  v_effective_tokens := LEAST(
    6.0000,
    v_tokens
      + GREATEST(
        0,
        EXTRACT(EPOCH FROM (v_now - v_refilled_at))::numeric / 10.0000
      )
  );

  RETURN QUERY
  SELECT
    'limited'::text,
    GREATEST(
      1,
      CEIL((1.0000 - v_effective_tokens) * 10.0000)::integer
    );
END;
$$;

REVOKE ALL ON FUNCTION public.begin_account_deletion_operation(uuid, uuid, text)
  FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.admit_account_deletion_recovery_attempt(uuid, text)
  FROM PUBLIC, anon, authenticated;

GRANT EXECUTE ON FUNCTION public.begin_account_deletion_operation(uuid, uuid, text)
  TO service_role;
GRANT EXECUTE ON FUNCTION public.admit_account_deletion_recovery_attempt(uuid, text)
  TO service_role;

NOTIFY pgrst, 'reload schema';

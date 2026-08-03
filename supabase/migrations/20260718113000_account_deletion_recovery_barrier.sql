-- Durable, capability-bound account deletion recovery.
-- The operation ledger intentionally has no auth.users foreign key: a client
-- must still be able to read a terminal receipt after Auth deletion succeeds
-- but the HTTP response is lost.

CREATE EXTENSION IF NOT EXISTS pgcrypto WITH SCHEMA extensions;

CREATE TABLE private.account_deletion_operations (
  operation_id uuid PRIMARY KEY,
  user_id uuid,
  recovery_secret_hash bytea NOT NULL
    CHECK (octet_length(recovery_secret_hash) = 32),
  owner_binding_hash bytea NOT NULL
    CHECK (octet_length(owner_binding_hash) = 32),
  status text NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'running', 'deleted')),
  phase text NOT NULL DEFAULT 'media-before-rows'
    CHECK (phase IN ('media-before-rows', 'rows', 'media-after-rows', 'auth')),
  lease_token uuid,
  lease_epoch bigint NOT NULL DEFAULT 0 CHECK (lease_epoch >= 0),
  lease_expires_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  completed_at timestamptz,
  CHECK (
    (status = 'pending' AND user_id IS NOT NULL AND lease_token IS NULL
      AND lease_expires_at IS NULL AND completed_at IS NULL)
    OR
    (status = 'running' AND user_id IS NOT NULL AND lease_token IS NOT NULL
      AND lease_expires_at IS NOT NULL AND completed_at IS NULL)
    OR
    (status = 'deleted' AND user_id IS NULL AND lease_token IS NULL
      AND lease_expires_at IS NULL AND completed_at IS NOT NULL)
  )
);

GRANT USAGE ON SCHEMA private TO service_role;

ALTER TABLE private.account_deletion_operations ENABLE ROW LEVEL SECURITY;
ALTER TABLE private.account_deletion_operations FORCE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE private.account_deletion_operations FROM PUBLIC, anon, authenticated;
GRANT ALL ON TABLE private.account_deletion_operations TO service_role;

COMMENT ON TABLE private.account_deletion_operations IS
  'Capability-hash deletion ledger. Completed receipts remove the owner UUID, retain a one-way owner/capability binding, and remain independent of auth.users so lost responses can converge.';

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
BEGIN
  IF p_operation_id IS NULL
    OR p_user_id IS NULL
    OR p_recovery_secret_hash !~ '^[a-f0-9]{64}$'
  THEN
    RETURN QUERY SELECT 'invalid'::text, NULL::uuid, NULL::uuid, NULL::bigint, NULL::text;
    RETURN;
  END IF;

  -- Serialize admission for one owner. Multiple devices may each hold an
  -- independent recovery capability, but a valid or stolen session cannot
  -- create an unbounded durable ledger or fan out unbounded Storage work.
  PERFORM pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(p_user_id::text, 0)
  );

  SELECT operation_row.*
  INTO v_operation
  FROM private.account_deletion_operations AS operation_row
  WHERE operation_row.operation_id = p_operation_id
  FOR UPDATE;

  IF NOT FOUND THEN
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
      -- A deliberately reused operation UUID must not expose or acquire the
      -- other operation, regardless of which owner submitted it.
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
    OR (v_operation.status <> 'deleted' AND v_operation.user_id <> p_user_id)
  THEN
    RETURN QUERY SELECT 'invalid'::text, NULL::uuid, NULL::uuid, NULL::bigint, NULL::text;
    RETURN;
  END IF;

  IF v_operation.status = 'deleted' THEN
    RETURN QUERY SELECT 'deleted'::text, NULL::uuid, NULL::uuid, v_operation.lease_epoch, v_operation.phase;
    RETURN;
  END IF;

  -- The block and first operation claim commit in this single RPC transaction
  -- before any Storage, row, or Auth deletion starts.
  INSERT INTO public.account_deletion_blocks (user_id, blocked_at)
  VALUES (p_user_id, now())
  ON CONFLICT (user_id) DO NOTHING;

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
BEGIN
  IF p_operation_id IS NULL
    OR p_recovery_secret_hash !~ '^[a-f0-9]{64}$'
  THEN
    RETURN QUERY SELECT 'invalid'::text, NULL::uuid, NULL::uuid, NULL::bigint, NULL::text;
    RETURN;
  END IF;

  SELECT operation_row.*
  INTO v_operation
  FROM private.account_deletion_operations AS operation_row
  WHERE operation_row.operation_id = p_operation_id
  FOR UPDATE;

  IF NOT FOUND
    OR v_operation.recovery_secret_hash <> decode(p_recovery_secret_hash, 'hex')
  THEN
    RETURN QUERY SELECT 'invalid'::text, NULL::uuid, NULL::uuid, NULL::bigint, NULL::text;
    RETURN;
  END IF;

  IF v_operation.status = 'deleted' THEN
    RETURN QUERY SELECT 'deleted'::text, NULL::uuid, NULL::uuid, v_operation.lease_epoch, v_operation.phase;
    RETURN;
  END IF;

  IF v_operation.user_id IS NULL THEN
    RETURN QUERY SELECT 'invalid'::text, NULL::uuid, NULL::uuid, NULL::bigint, NULL::text;
    RETURN;
  END IF;

  INSERT INTO public.account_deletion_blocks (user_id, blocked_at)
  VALUES (v_operation.user_id, now())
  ON CONFLICT (user_id) DO NOTHING;

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

CREATE OR REPLACE FUNCTION public.renew_account_deletion_operation_lease(
  p_operation_id uuid,
  p_recovery_secret_hash text,
  p_lease_token uuid,
  p_lease_epoch bigint
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = ''
AS $$
BEGIN
  UPDATE private.account_deletion_operations AS operation_row
  SET lease_expires_at = now() + interval '2 minutes', updated_at = now()
  WHERE operation_row.operation_id = p_operation_id
    AND operation_row.recovery_secret_hash = decode(p_recovery_secret_hash, 'hex')
    AND operation_row.status = 'running'
    AND operation_row.lease_token = p_lease_token
    AND operation_row.lease_epoch = p_lease_epoch
    AND operation_row.lease_expires_at > now();
  RETURN FOUND;
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
      (operation_row.phase = 'media-before-rows' AND p_next_phase = 'rows')
      OR (operation_row.phase = 'rows' AND p_next_phase = 'media-after-rows')
      OR (operation_row.phase = 'media-after-rows' AND p_next_phase = 'auth')
    );
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
SECURITY INVOKER
SET search_path = ''
AS $$
BEGIN
  UPDATE private.account_deletion_operations AS operation_row
  SET
    user_id = NULL,
    status = 'deleted',
    lease_token = NULL,
    lease_expires_at = NULL,
    completed_at = now(),
    updated_at = now()
  WHERE operation_row.operation_id = p_operation_id
    AND operation_row.recovery_secret_hash = decode(p_recovery_secret_hash, 'hex')
    AND operation_row.status = 'running'
    AND operation_row.phase = 'auth'
    AND operation_row.lease_token = p_lease_token
    AND operation_row.lease_epoch = p_lease_epoch
    AND operation_row.lease_expires_at > now();
  RETURN FOUND;
END;
$$;

CREATE OR REPLACE FUNCTION public.release_account_deletion_operation(
  p_operation_id uuid,
  p_recovery_secret_hash text,
  p_lease_token uuid,
  p_lease_epoch bigint
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = ''
AS $$
BEGIN
  UPDATE private.account_deletion_operations AS operation_row
  SET
    status = 'pending',
    lease_token = NULL,
    lease_expires_at = NULL,
    updated_at = now()
  WHERE operation_row.operation_id = p_operation_id
    AND operation_row.recovery_secret_hash = decode(p_recovery_secret_hash, 'hex')
    AND operation_row.status = 'running'
    AND operation_row.lease_token = p_lease_token
    AND operation_row.lease_epoch = p_lease_epoch;
  RETURN FOUND;
END;
$$;

REVOKE ALL ON FUNCTION public.begin_account_deletion_operation(uuid, uuid, text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.claim_account_deletion_operation(uuid, text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.renew_account_deletion_operation_lease(uuid, text, uuid, bigint) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.advance_account_deletion_operation_phase(uuid, text, uuid, bigint, text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.complete_account_deletion_operation(uuid, text, uuid, bigint) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.release_account_deletion_operation(uuid, text, uuid, bigint) FROM PUBLIC, anon, authenticated;

GRANT EXECUTE ON FUNCTION public.begin_account_deletion_operation(uuid, uuid, text) TO service_role;
GRANT EXECUTE ON FUNCTION public.claim_account_deletion_operation(uuid, text) TO service_role;
GRANT EXECUTE ON FUNCTION public.renew_account_deletion_operation_lease(uuid, text, uuid, bigint) TO service_role;
GRANT EXECUTE ON FUNCTION public.advance_account_deletion_operation_phase(uuid, text, uuid, bigint, text) TO service_role;
GRANT EXECUTE ON FUNCTION public.complete_account_deletion_operation(uuid, text, uuid, bigint) TO service_role;
GRANT EXECUTE ON FUNCTION public.release_account_deletion_operation(uuid, text, uuid, bigint) TO service_role;

-- PostgREST validates the JWT signature locally. This pre-request hook denies
-- every Data API request from a principal once deletion begins. Storage and
-- Realtime are separate services and retain their own policy barriers below.
CREATE OR REPLACE FUNCTION public.enforce_account_deletion_api_barrier()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  IF (SELECT auth.role()) = 'authenticated'
    AND EXISTS (
      SELECT 1
      FROM public.account_deletion_blocks AS deletion_block
      WHERE deletion_block.user_id = (SELECT auth.uid())
    )
  THEN
    RAISE EXCEPTION 'Account deletion is in progress'
      USING ERRCODE = '42501';
  END IF;
END;
$$;

REVOKE ALL ON FUNCTION public.enforce_account_deletion_api_barrier() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.enforce_account_deletion_api_barrier()
  TO authenticator, anon, authenticated, service_role;

DO $$
DECLARE
  existing_setting text;
BEGIN
  SELECT config_entry
  INTO existing_setting
  FROM (
    SELECT unnest(COALESCE(role_row.rolconfig, ARRAY[]::text[])) AS config_entry
    FROM pg_catalog.pg_roles AS role_row
    WHERE role_row.rolname = 'authenticator'
    UNION ALL
    SELECT unnest(database_setting.setconfig) AS config_entry
    FROM pg_catalog.pg_db_role_setting AS database_setting
    LEFT JOIN pg_catalog.pg_roles AS role_row
      ON role_row.oid = database_setting.setrole
    WHERE (
        database_setting.setrole = 0
        OR role_row.rolname = 'authenticator'
      )
      AND database_setting.setdatabase IN (
        0,
        (SELECT database_row.oid FROM pg_catalog.pg_database AS database_row
          WHERE database_row.datname = current_database())
      )
  ) AS effective_settings
  WHERE config_entry LIKE 'pgrst.db_pre_request=%'
    AND config_entry <>
      'pgrst.db_pre_request=public.enforce_account_deletion_api_barrier'
  LIMIT 1;

  IF existing_setting IS NOT NULL THEN
    RAISE EXCEPTION
      'Refusing to replace existing pgrst.db_pre_request hook: %',
      existing_setting;
  END IF;
END;
$$;

ALTER ROLE authenticator
  SET pgrst.db_pre_request = 'public.enforce_account_deletion_api_barrier';
NOTIFY pgrst, 'reload config';

DROP POLICY IF EXISTS "sync broadcast receive own topic" ON realtime.messages;
CREATE POLICY "sync broadcast receive own topic"
ON realtime.messages
FOR SELECT
TO authenticated
USING (
  realtime.messages.extension = 'broadcast'
  AND (SELECT realtime.topic()) = 'sync-signal:' || (SELECT auth.uid())::text
  AND NOT EXISTS (
    SELECT 1
    FROM public.account_deletion_blocks AS deletion_block
    WHERE deletion_block.user_id = (SELECT auth.uid())
  )
);

DROP POLICY IF EXISTS "sync broadcast send own topic" ON realtime.messages;
CREATE POLICY "sync broadcast send own topic"
ON realtime.messages
FOR INSERT
TO authenticated
WITH CHECK (
  realtime.messages.extension = 'broadcast'
  AND (SELECT realtime.topic()) = 'sync-signal:' || (SELECT auth.uid())::text
  AND NOT EXISTS (
    SELECT 1
    FROM public.account_deletion_blocks AS deletion_block
    WHERE deletion_block.user_id = (SELECT auth.uid())
  )
);

COMMENT ON POLICY "sync broadcast receive own topic" ON realtime.messages IS
  'Receives only the owner sync topic and denies principals whose account deletion has started.';

COMMENT ON POLICY "sync broadcast send own topic" ON realtime.messages IS
  'Sends only to the owner sync topic and denies principals whose account deletion has started.';

NOTIFY pgrst, 'reload schema';

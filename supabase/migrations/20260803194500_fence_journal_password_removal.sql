-- Fence journal password removal against stale authenticated clients.
--
-- The removal worker may need several resumable client requests to replace
-- encrypted rows and blobs with plaintext. The durable state below makes that
-- window server-authoritative: protected writes serialize on the owner state,
-- while plaintext writes remain available. Final verification, vault deletion,
-- and the unprotected tombstone commit in one database transaction.

BEGIN;

-- Bound every DDL/DML lock acquisition in this explicit cutover transaction.
-- A busy deployment fails for a safe retry instead of pausing app writes
-- indefinitely while the old admission rules are still active.
SET LOCAL lock_timeout = '10s';
SET LOCAL statement_timeout = '30s';

CREATE SCHEMA IF NOT EXISTS security;
CREATE SCHEMA IF NOT EXISTS private;
CREATE EXTENSION IF NOT EXISTS pgcrypto WITH SCHEMA extensions;

REVOKE ALL ON SCHEMA security FROM PUBLIC, anon;
GRANT USAGE ON SCHEMA security TO authenticated;

CREATE TABLE IF NOT EXISTS public.journal_security_states (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  vault_revision bigint NOT NULL CHECK (
    vault_revision >= 0 AND vault_revision <= 9007199254740991
  ),
  wrapper_revision bigint NOT NULL DEFAULT 0 CHECK (
    wrapper_revision >= 0 AND wrapper_revision <= 9007199254740991
  ),
  protection_state text NOT NULL CHECK (
    protection_state IN ('protected', 'removing', 'unprotected')
  ),
  removal_operation_revision text,
  last_aborted_removal_operation_revision text,
  removal_inventory jsonb,
  removal_previous_write_mode text,
  removal_mutation_started boolean NOT NULL DEFAULT false,
  removal_media_reservations jsonb NOT NULL DEFAULT '[]'::jsonb,
  removal_event_receipts jsonb NOT NULL DEFAULT '[]'::jsonb,
  journal_write_mode text NOT NULL DEFAULT 'legacy' CHECK (
    journal_write_mode IN ('legacy', 'strict', 'paused')
  ),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT journal_security_state_operation_shape CHECK (
    (
      protection_state = 'protected'
      AND removal_operation_revision IS NULL
    )
    OR (
      protection_state IN ('removing', 'unprotected')
      AND removal_operation_revision IS NOT NULL
      AND length(removal_operation_revision) BETWEEN 3 AND 128
    )
  )
);

ALTER TABLE public.journal_security_states
  ADD COLUMN IF NOT EXISTS journal_write_mode text NOT NULL DEFAULT 'legacy';
ALTER TABLE public.journal_security_states
  ADD COLUMN IF NOT EXISTS wrapper_revision bigint NOT NULL DEFAULT 0;
ALTER TABLE public.journal_security_states
  ADD COLUMN IF NOT EXISTS removal_inventory jsonb;
ALTER TABLE public.journal_security_states
  ADD COLUMN IF NOT EXISTS removal_previous_write_mode text;
ALTER TABLE public.journal_security_states
  ADD COLUMN IF NOT EXISTS removal_mutation_started boolean NOT NULL DEFAULT false;
ALTER TABLE public.journal_security_states
  ADD COLUMN IF NOT EXISTS removal_media_reservations jsonb NOT NULL DEFAULT '[]'::jsonb;
ALTER TABLE public.journal_security_states
  ADD COLUMN IF NOT EXISTS removal_event_receipts jsonb NOT NULL DEFAULT '[]'::jsonb;
ALTER TABLE public.journal_security_states
  ADD COLUMN IF NOT EXISTS last_aborted_removal_operation_revision text;

ALTER TABLE public.journal_security_states
  DROP CONSTRAINT IF EXISTS journal_security_states_last_aborted_revision_safe;
ALTER TABLE public.journal_security_states
  ADD CONSTRAINT journal_security_states_last_aborted_revision_safe CHECK (
    last_aborted_removal_operation_revision IS NULL
    OR length(last_aborted_removal_operation_revision) BETWEEN 3 AND 128
  );

ALTER TABLE public.journal_security_states
  DROP CONSTRAINT IF EXISTS journal_security_states_wrapper_revision_safe;
ALTER TABLE public.journal_security_states
  ADD CONSTRAINT journal_security_states_wrapper_revision_safe CHECK (
    wrapper_revision BETWEEN 0 AND 9007199254740991
  );

ALTER TABLE public.journal_security_states
  ALTER COLUMN journal_write_mode SET DEFAULT 'legacy';

ALTER TABLE public.journal_security_states
  DROP CONSTRAINT IF EXISTS journal_security_states_journal_write_mode_check;
ALTER TABLE public.journal_security_states
  ADD CONSTRAINT journal_security_states_journal_write_mode_check CHECK (
    journal_write_mode IN ('legacy', 'strict', 'paused')
  );

ALTER TABLE public.journal_security_states
  DROP CONSTRAINT IF EXISTS journal_security_state_operation_shape;
ALTER TABLE public.journal_security_states
  ADD CONSTRAINT journal_security_state_operation_shape CHECK (
    (
      protection_state = 'protected'
      AND removal_operation_revision IS NULL
      AND removal_inventory IS NULL
      AND removal_previous_write_mode IS NULL
      AND removal_mutation_started = false
      AND removal_media_reservations = '[]'::jsonb
      AND removal_event_receipts = '[]'::jsonb
    )
    OR (
      protection_state = 'removing'
      AND removal_operation_revision IS NOT NULL
      AND length(removal_operation_revision) BETWEEN 3 AND 128
      AND pg_catalog.jsonb_typeof(removal_inventory) = 'object'
      AND removal_previous_write_mode IN ('legacy', 'strict')
      AND pg_catalog.jsonb_typeof(removal_media_reservations) = 'array'
      AND pg_catalog.jsonb_typeof(removal_event_receipts) = 'array'
    )
    OR (
      protection_state = 'unprotected'
      AND removal_operation_revision IS NOT NULL
      AND length(removal_operation_revision) BETWEEN 3 AND 128
      AND removal_inventory IS NULL
      AND removal_previous_write_mode IS NULL
      AND removal_mutation_started = false
      AND removal_media_reservations = '[]'::jsonb
      AND pg_catalog.jsonb_typeof(removal_event_receipts) = 'array'
    )
  );

ALTER TABLE public.journal_entries
  ADD COLUMN IF NOT EXISTS vault_revision bigint;
ALTER TABLE public.journal_entries
  ADD COLUMN IF NOT EXISTS row_revision bigint NOT NULL DEFAULT 0;
ALTER TABLE public.journal_photos
  ADD COLUMN IF NOT EXISTS vault_revision bigint;
ALTER TABLE public.journal_photos
  ADD COLUMN IF NOT EXISTS row_revision bigint NOT NULL DEFAULT 0;
ALTER TABLE public.journal_audio
  ADD COLUMN IF NOT EXISTS vault_revision bigint;
ALTER TABLE public.journal_audio
  ADD COLUMN IF NOT EXISTS row_revision bigint NOT NULL DEFAULT 0;
ALTER TABLE public.user_backups
  ADD COLUMN IF NOT EXISTS vault_revision bigint;

ALTER TABLE public.journal_entries
  DROP CONSTRAINT IF EXISTS journal_entries_vault_revision_safe;
ALTER TABLE public.journal_entries
  ADD CONSTRAINT journal_entries_vault_revision_safe CHECK (
    vault_revision IS NULL OR vault_revision BETWEEN 0 AND 9007199254740991
  ) NOT VALID;
ALTER TABLE public.journal_photos
  DROP CONSTRAINT IF EXISTS journal_photos_vault_revision_safe;
ALTER TABLE public.journal_photos
  ADD CONSTRAINT journal_photos_vault_revision_safe CHECK (
    vault_revision IS NULL OR vault_revision BETWEEN 0 AND 9007199254740991
  ) NOT VALID;
ALTER TABLE public.journal_audio
  DROP CONSTRAINT IF EXISTS journal_audio_vault_revision_safe;
ALTER TABLE public.journal_audio
  ADD CONSTRAINT journal_audio_vault_revision_safe CHECK (
    vault_revision IS NULL OR vault_revision BETWEEN 0 AND 9007199254740991
  ) NOT VALID;
ALTER TABLE public.user_backups
  DROP CONSTRAINT IF EXISTS user_backups_vault_revision_safe;
ALTER TABLE public.user_backups
  ADD CONSTRAINT user_backups_vault_revision_safe CHECK (
    vault_revision IS NULL OR vault_revision BETWEEN 0 AND 9007199254740991
  ) NOT VALID;

ALTER TABLE public.journal_entries
  DROP CONSTRAINT IF EXISTS journal_entries_row_revision_safe;
ALTER TABLE public.journal_entries
  ADD CONSTRAINT journal_entries_row_revision_safe CHECK (
    row_revision BETWEEN 0 AND 9007199254740991
  ) NOT VALID;
ALTER TABLE public.journal_photos
  DROP CONSTRAINT IF EXISTS journal_photos_row_revision_safe;
ALTER TABLE public.journal_photos
  ADD CONSTRAINT journal_photos_row_revision_safe CHECK (
    row_revision BETWEEN 0 AND 9007199254740991
  ) NOT VALID;
ALTER TABLE public.journal_audio
  DROP CONSTRAINT IF EXISTS journal_audio_row_revision_safe;
ALTER TABLE public.journal_audio
  ADD CONSTRAINT journal_audio_row_revision_safe CHECK (
    row_revision BETWEEN 0 AND 9007199254740991
  ) NOT VALID;

ALTER TABLE public.journal_security_states ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.journal_security_states FROM PUBLIC, anon, authenticated;
GRANT ALL ON TABLE public.journal_security_states TO service_role;

COMMENT ON TABLE public.journal_security_states IS
  'Private owner-bound journal vault epoch and durable password-removal fence.';

-- Release ACCESS EXCLUSIVE locks from column and NOT VALID constraint setup
-- before scanning existing rows or installing the function body. The nullable
-- columns and NOT VALID checks already reject invalid new writes; validation
-- uses the weaker SHARE UPDATE EXCLUSIVE lock and does not block ordinary DML.
COMMIT;

BEGIN;
SET LOCAL lock_timeout = '10s';
SET LOCAL statement_timeout = '2min';

ALTER TABLE public.journal_entries
  VALIDATE CONSTRAINT journal_entries_vault_revision_safe;
ALTER TABLE public.journal_photos
  VALIDATE CONSTRAINT journal_photos_vault_revision_safe;
ALTER TABLE public.journal_audio
  VALIDATE CONSTRAINT journal_audio_vault_revision_safe;
ALTER TABLE public.user_backups
  VALIDATE CONSTRAINT user_backups_vault_revision_safe;
ALTER TABLE public.journal_entries
  VALIDATE CONSTRAINT journal_entries_row_revision_safe;
ALTER TABLE public.journal_photos
  VALIDATE CONSTRAINT journal_photos_row_revision_safe;
ALTER TABLE public.journal_audio
  VALIDATE CONSTRAINT journal_audio_row_revision_safe;

COMMIT;

BEGIN;
SET LOCAL lock_timeout = '10s';
SET LOCAL statement_timeout = '30s';

CREATE OR REPLACE FUNCTION security.read_journal_vault_revision(
  p_value jsonb
)
RETURNS bigint
LANGUAGE plpgsql
IMMUTABLE
SECURITY INVOKER
SET search_path = ''
AS $$
DECLARE
  v_revision numeric;
BEGIN
  IF p_value IS NULL
    OR pg_catalog.jsonb_typeof(p_value) <> 'object'
    OR NOT (p_value ? 'updatedAt')
    OR (p_value ->> 'updatedAt') !~ '^[0-9]+$'
  THEN
    RETURN NULL;
  END IF;

  v_revision := (p_value ->> 'updatedAt')::numeric;
  IF v_revision <> pg_catalog.trunc(v_revision)
    OR v_revision < 0
    OR v_revision > 9007199254740991
  THEN
    RETURN NULL;
  END IF;

  RETURN v_revision::bigint;
EXCEPTION
  WHEN numeric_value_out_of_range OR invalid_text_representation THEN
    RETURN NULL;
END;
$$;

REVOKE ALL ON FUNCTION security.read_journal_vault_revision(jsonb)
  FROM PUBLIC, anon, authenticated, service_role;

CREATE OR REPLACE FUNCTION security.read_journal_vault_wrapper_revision(
  p_value jsonb
)
RETURNS bigint
LANGUAGE plpgsql
IMMUTABLE
SECURITY INVOKER
SET search_path = ''
AS $$
DECLARE
  v_revision numeric;
BEGIN
  IF p_value IS NULL OR pg_catalog.jsonb_typeof(p_value) <> 'object' THEN
    RETURN NULL;
  END IF;

  -- Values created before wrapper CAS are generation zero.
  IF NOT (p_value ? 'wrapperRevision') THEN
    RETURN 0;
  END IF;
  IF (p_value ->> 'wrapperRevision') !~ '^[0-9]+$' THEN
    RETURN NULL;
  END IF;

  v_revision := (p_value ->> 'wrapperRevision')::numeric;
  IF v_revision <> pg_catalog.trunc(v_revision)
    OR v_revision < 0
    OR v_revision > 9007199254740991
  THEN
    RETURN NULL;
  END IF;

  RETURN v_revision::bigint;
EXCEPTION
  WHEN numeric_value_out_of_range OR invalid_text_representation THEN
    RETURN NULL;
END;
$$;

REVOKE ALL ON FUNCTION security.read_journal_vault_wrapper_revision(jsonb)
  FROM PUBLIC, anon, authenticated, service_role;

CREATE OR REPLACE FUNCTION security.read_json_vault_revision(
  p_value jsonb
)
RETURNS bigint
LANGUAGE plpgsql
IMMUTABLE
SECURITY INVOKER
SET search_path = ''
AS $$
DECLARE
  v_revision numeric;
BEGIN
  IF p_value IS NULL
    OR pg_catalog.jsonb_typeof(p_value) <> 'object'
    OR NOT (p_value ? 'vaultRevision')
    OR (p_value ->> 'vaultRevision') !~ '^[0-9]+$'
  THEN
    RETURN NULL;
  END IF;
  v_revision := (p_value ->> 'vaultRevision')::numeric;
  IF v_revision <> pg_catalog.trunc(v_revision)
    OR v_revision < 0
    OR v_revision > 9007199254740991
  THEN
    RETURN NULL;
  END IF;
  RETURN v_revision::bigint;
EXCEPTION
  WHEN numeric_value_out_of_range OR invalid_text_representation THEN
    RETURN NULL;
END;
$$;

REVOKE ALL ON FUNCTION security.read_json_vault_revision(jsonb)
  FROM PUBLIC, anon, authenticated, service_role;

CREATE OR REPLACE FUNCTION security.read_journal_media_vault_revision(
  p_path text
)
RETURNS bigint
LANGUAGE plpgsql
IMMUTABLE
SECURITY INVOKER
SET search_path = ''
AS $$
DECLARE
  v_match text;
  v_revision numeric;
BEGIN
  v_match := pg_catalog.substring(p_path FROM '\.v([0-9]+)\.bin$');
  IF v_match IS NULL THEN
    RETURN NULL;
  END IF;
  v_revision := v_match::numeric;
  IF v_revision <> pg_catalog.trunc(v_revision)
    OR v_revision < 0
    OR v_revision > 9007199254740991
  THEN
    RETURN NULL;
  END IF;
  RETURN v_revision::bigint;
EXCEPTION
  WHEN numeric_value_out_of_range OR invalid_text_representation THEN
    RETURN NULL;
END;
$$;

REVOKE ALL ON FUNCTION security.read_journal_media_vault_revision(text)
  FROM PUBLIC, anon, authenticated, service_role;

CREATE OR REPLACE FUNCTION security.stamp_journal_backup_vault_epoch(
  p_payload jsonb,
  p_vault_revision bigint
)
RETURNS jsonb
LANGUAGE plpgsql
IMMUTABLE
SECURITY INVOKER
SET search_path = ''
AS $$
DECLARE
  v_payload jsonb := p_payload;
  v_field text;
  v_items jsonb;
BEGIN
  FOREACH v_field IN ARRAY ARRAY[
    'journalEntries',
    'journalPhotos',
    'journalAudio',
    'journalSpaces',
    'journalSpaceCaptures'
  ] LOOP
    v_items := v_payload #> ARRAY['data', v_field];
    IF v_items IS NULL THEN
      CONTINUE;
    END IF;
    IF pg_catalog.jsonb_typeof(v_items) <> 'array' THEN
      RETURN NULL;
    END IF;
    SELECT COALESCE(
      pg_catalog.jsonb_agg(item || pg_catalog.jsonb_build_object(
        'vaultRevision', p_vault_revision
      )),
      '[]'::jsonb
    )
    INTO v_items
    FROM pg_catalog.jsonb_array_elements(v_items) AS item;
    v_payload := pg_catalog.jsonb_set(
      v_payload,
      ARRAY['data', v_field],
      v_items,
      true
    );
  END LOOP;
  RETURN v_payload;
END;
$$;

REVOKE ALL ON FUNCTION security.stamp_journal_backup_vault_epoch(jsonb, bigint)
  FROM PUBLIC, anon, authenticated, service_role;

CREATE OR REPLACE FUNCTION security.validate_journal_backup_vault_epoch(
  p_payload jsonb,
  p_vault_revision bigint
)
RETURNS boolean
LANGUAGE plpgsql
IMMUTABLE
SECURITY INVOKER
SET search_path = ''
AS $$
DECLARE
  v_field text;
  v_items jsonb;
  v_item jsonb;
BEGIN
  IF p_payload IS NULL OR pg_catalog.jsonb_typeof(p_payload) <> 'object' THEN
    RETURN false;
  END IF;

  FOREACH v_field IN ARRAY ARRAY[
    'journalEntries',
    'journalPhotos',
    'journalAudio',
    'journalSpaces',
    'journalSpaceCaptures'
  ] LOOP
    v_items := p_payload #> ARRAY['data', v_field];
    IF v_items IS NULL THEN
      CONTINUE;
    END IF;
    IF pg_catalog.jsonb_typeof(v_items) <> 'array' THEN
      RETURN false;
    END IF;
    FOR v_item IN SELECT value FROM pg_catalog.jsonb_array_elements(v_items) LOOP
      IF security.read_json_vault_revision(v_item) IS DISTINCT FROM p_vault_revision THEN
        RETURN false;
      END IF;
      IF p_vault_revision IS NOT NULL
        AND v_field = 'journalEntries'
        AND COALESCE(v_item ->> 'content', '') NOT LIKE 'zenflow:journal-content:v1:%'
      THEN
        RETURN false;
      END IF;
    END LOOP;
  END LOOP;

  IF p_vault_revision IS NULL THEN
    RETURN COALESCE(
      (p_payload #> '{data}')::text NOT LIKE '%zenflow:journal-content:v1:%'
      AND (p_payload #> '{data}')::text NOT LIKE '%zenflow:journal-media:v1:%',
      true
    );
  END IF;
  RETURN true;
END;
$$;

REVOKE ALL ON FUNCTION security.validate_journal_backup_vault_epoch(jsonb, bigint)
  FROM PUBLIC, anon, authenticated, service_role;

-- Authenticated journal-security mutations share the permanent account
-- deletion admission lock. Under READ COMMITTED, the query after a wait gets a
-- fresh statement snapshot; stronger transaction isolation is rejected because
-- it could retain a pre-tombstone snapshot after acquiring the owner lock.
CREATE OR REPLACE FUNCTION security.assert_journal_owner_active(
  p_owner_id uuid
)
RETURNS void
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  IF p_owner_id IS NULL THEN
    RAISE EXCEPTION 'Journal owner is required' USING ERRCODE = '42501';
  END IF;

  IF pg_catalog.current_setting('transaction_isolation') <> 'read committed' THEN
    RAISE EXCEPTION 'Journal security mutation requires read committed'
      USING ERRCODE = '42501';
  END IF;

  PERFORM pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(p_owner_id::text, 0)
  );

  IF EXISTS (
    SELECT 1
    FROM public.account_deletion_blocks AS deletion_block
    WHERE deletion_block.user_id = p_owner_id
  ) THEN
    RAISE EXCEPTION 'Account deletion is final' USING ERRCODE = '42501';
  END IF;
END;
$$;

REVOKE ALL ON FUNCTION security.assert_journal_owner_active(uuid)
  FROM PUBLIC, anon, authenticated, service_role;

-- Existing protected rows deliberately remain unbound. PostgreSQL cannot
-- prove which historical key encrypted ciphertext, so stamping the current
-- epoch here would launder an E1 row into E2. A current client may bind a
-- legacy local row only after decrypting it with the unlocked key, then it
-- rewrites the remote row with the explicit revision. Existing owners remain
-- in compatibility mode until the owner-scoped strict activation proves that
-- no unbound protected data remains.

CREATE OR REPLACE FUNCTION private.admit_journal_vault_write()
RETURNS trigger
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_caller_id uuid := (SELECT auth.uid());
  v_revision bigint;
  v_wrapper_revision bigint;
  v_current_value jsonb;
  v_current_revision bigint;
  v_current_wrapper_revision bigint;
  v_current_found boolean := false;
  v_state public.journal_security_states%ROWTYPE;
  v_state_found boolean := false;
BEGIN
  IF NEW.key IS DISTINCT FROM 'journal_vault_key' THEN
    RETURN NEW;
  END IF;

  IF NEW.user_id IS NULL
    OR (v_caller_id IS NOT NULL AND NEW.user_id IS DISTINCT FROM v_caller_id)
  THEN
    RAISE EXCEPTION 'Journal vault owner mismatch' USING ERRCODE = '42501';
  END IF;

  v_revision := security.read_journal_vault_revision(NEW.value);
  v_wrapper_revision := security.read_journal_vault_wrapper_revision(NEW.value);
  IF v_revision IS NULL
    OR v_wrapper_revision IS NULL
    OR NEW.value IS NULL
    OR pg_catalog.jsonb_typeof(NEW.value) <> 'object'
    OR COALESCE(pg_catalog.jsonb_typeof(NEW.value -> 'wrappedKey'), '') <> 'string'
    OR length(COALESCE(NEW.value ->> 'wrappedKey', '')) NOT BETWEEN 1 AND 16384
    OR COALESCE(NEW.value ->> 'createdAt', '') !~ '^[0-9]+$'
  THEN
    RAISE EXCEPTION 'Journal vault revision is invalid' USING ERRCODE = '22023';
  END IF;

  PERFORM security.assert_journal_owner_active(NEW.user_id);

  IF TG_OP = 'UPDATE' THEN
    v_current_value := OLD.value;
    v_current_found := true;
  ELSE
    SELECT settings.value
    INTO v_current_value
    FROM public.user_settings AS settings
    WHERE settings.user_id = NEW.user_id
      AND settings.key = 'journal_vault_key'
    FOR UPDATE;
    v_current_found := FOUND;
  END IF;
  IF v_current_found THEN
    v_current_revision := security.read_journal_vault_revision(v_current_value);
    v_current_wrapper_revision :=
      security.read_journal_vault_wrapper_revision(v_current_value);
  END IF;

  SELECT state_row.*
  INTO v_state
  FROM public.journal_security_states AS state_row
  WHERE state_row.user_id = NEW.user_id
  FOR UPDATE;
  v_state_found := FOUND;

  IF v_state_found THEN
    IF v_state.protection_state = 'removing' THEN
      RAISE EXCEPTION 'Journal vault removal is pending' USING ERRCODE = '55000';
    END IF;

    IF v_revision < v_state.vault_revision
      OR (
        v_state.protection_state = 'unprotected'
        AND v_revision <= v_state.vault_revision
      )
    THEN
      RAISE EXCEPTION 'Journal vault revision is stale' USING ERRCODE = '40001';
    END IF;

    IF v_revision = v_state.vault_revision THEN
      IF v_wrapper_revision < v_state.wrapper_revision THEN
        RAISE EXCEPTION 'Journal vault wrapper generation is stale'
          USING ERRCODE = '40001';
      END IF;
      IF v_wrapper_revision > v_state.wrapper_revision + 1 THEN
        RAISE EXCEPTION 'Journal vault wrapper generation skipped'
          USING ERRCODE = '40001';
      END IF;

      IF v_wrapper_revision = v_state.wrapper_revision + 1 THEN
        -- Same-epoch wrapper changes are compare-and-swap updates. Reject the
        -- INSERT phase of ON CONFLICT upserts so it cannot mutate state before
        -- PostgreSQL resolves the existing row.
        IF TG_OP <> 'UPDATE'
          OR NOT v_current_found
          OR v_current_revision IS DISTINCT FROM v_state.vault_revision
          OR v_current_wrapper_revision IS DISTINCT FROM v_state.wrapper_revision
        THEN
          RAISE EXCEPTION 'Journal vault wrapper compare-and-swap is required'
            USING ERRCODE = '40001';
        END IF;

        UPDATE public.journal_security_states
        SET
          wrapper_revision = v_wrapper_revision,
          protection_state = 'protected',
          removal_operation_revision = NULL,
          removal_event_receipts = '[]'::jsonb,
          updated_at = now()
        WHERE user_id = NEW.user_id;
      ELSIF v_current_found AND v_current_value IS DISTINCT FROM NEW.value THEN
        -- A larger content epoch may have advanced state during the INSERT
        -- phase of this exact ON CONFLICT statement. No same-epoch wrapper
        -- conflict is otherwise accepted at an unchanged generation.
        IF v_current_revision IS NULL OR v_current_revision >= v_revision THEN
          RAISE EXCEPTION 'Journal vault wrapper generation is stale'
            USING ERRCODE = '40001';
        END IF;
      END IF;
    ELSE
      UPDATE public.journal_security_states
      SET
        vault_revision = v_revision,
        wrapper_revision = v_wrapper_revision,
        protection_state = 'protected',
        removal_operation_revision = NULL,
        removal_event_receipts = '[]'::jsonb,
        updated_at = now()
      WHERE user_id = NEW.user_id;
    END IF;
  ELSE
    INSERT INTO public.journal_security_states (
      user_id,
      vault_revision,
      wrapper_revision,
      protection_state,
      removal_operation_revision,
      updated_at
    ) VALUES (
      NEW.user_id,
      v_revision,
      v_wrapper_revision,
      'protected',
      NULL,
      now()
    );
  END IF;

  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION private.admit_journal_vault_write()
  FROM PUBLIC, anon, authenticated, service_role;

CREATE OR REPLACE FUNCTION public.compare_and_swap_journal_vault_wrapper(
  p_expected_value jsonb,
  p_next_value jsonb
)
RETURNS jsonb
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_user_id uuid := (SELECT auth.uid());
  v_state public.journal_security_states%ROWTYPE;
  v_current_value jsonb;
  v_expected_revision bigint;
  v_expected_wrapper_revision bigint;
  v_next_revision bigint;
  v_next_wrapper_revision bigint;
  v_updated_rows integer;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Authentication required' USING ERRCODE = '42501';
  END IF;

  v_expected_revision := security.read_journal_vault_revision(p_expected_value);
  v_expected_wrapper_revision :=
    security.read_journal_vault_wrapper_revision(p_expected_value);
  v_next_revision := security.read_journal_vault_revision(p_next_value);
  v_next_wrapper_revision :=
    security.read_journal_vault_wrapper_revision(p_next_value);

  IF v_expected_revision IS NULL
    OR v_expected_wrapper_revision IS NULL
    OR v_next_revision IS DISTINCT FROM v_expected_revision
    OR v_next_wrapper_revision IS DISTINCT FROM v_expected_wrapper_revision + 1
    OR COALESCE(pg_catalog.jsonb_typeof(p_next_value -> 'wrappedKey'), '') <> 'string'
    OR length(COALESCE(p_next_value ->> 'wrappedKey', '')) NOT BETWEEN 1 AND 16384
    OR p_next_value ->> 'createdAt' IS DISTINCT FROM p_expected_value ->> 'createdAt'
  THEN
    RETURN 'stale';
  END IF;

  PERFORM security.assert_journal_owner_active(v_user_id);

  SELECT settings.value
  INTO v_current_value
  FROM public.user_settings AS settings
  WHERE settings.user_id = v_user_id
    AND settings.key = 'journal_vault_key'
  FOR UPDATE;
  IF NOT FOUND THEN
    RETURN 'stale';
  END IF;

  SELECT state_row.*
  INTO v_state
  FROM public.journal_security_states AS state_row
  WHERE state_row.user_id = v_user_id
  FOR UPDATE;
  IF NOT FOUND THEN
    RETURN 'stale';
  END IF;

  -- Retrying after a lost response is safe only for the exact committed value.
  IF v_current_value = p_next_value
    AND v_state.protection_state = 'protected'
    AND v_state.vault_revision = v_next_revision
    AND v_state.wrapper_revision = v_next_wrapper_revision
  THEN
    RETURN 'committed';
  END IF;

  IF v_current_value IS DISTINCT FROM p_expected_value
    OR v_state.protection_state <> 'protected'
    OR v_state.vault_revision IS DISTINCT FROM v_expected_revision
    OR v_state.wrapper_revision IS DISTINCT FROM v_expected_wrapper_revision
  THEN
    RETURN 'stale';
  END IF;

  UPDATE public.user_settings
  SET
    value = p_next_value,
    updated_at = now()
  WHERE user_id = v_user_id
    AND key = 'journal_vault_key'
    AND value = p_expected_value;

  GET DIAGNOSTICS v_updated_rows = ROW_COUNT;
  IF v_updated_rows <> 1 THEN
    RETURN 'stale';
  END IF;

  RETURN 'committed';
END;
$$;

REVOKE ALL ON FUNCTION public.compare_and_swap_journal_vault_wrapper(jsonb, jsonb)
  FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.compare_and_swap_journal_vault_wrapper(jsonb, jsonb)
  TO authenticated;

CREATE OR REPLACE FUNCTION private.admit_journal_vault_delete()
RETURNS trigger
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_caller_id uuid := (SELECT auth.uid());
  v_state public.journal_security_states%ROWTYPE;
BEGIN
  IF OLD.key IS DISTINCT FROM 'journal_vault_key' THEN
    RETURN OLD;
  END IF;

  -- Account deletion establishes this permanent owner tombstone before
  -- deleting auth.users. It is the only bypass: role names and session roles
  -- are intentionally not trusted because service-role code also performs
  -- ordinary maintenance outside the deletion protocol.
  IF EXISTS (
    SELECT 1
    FROM public.account_deletion_blocks AS deletion_block
    WHERE deletion_block.user_id = OLD.user_id
  ) THEN
    RETURN OLD;
  END IF;

  IF OLD.user_id IS NULL
    OR (v_caller_id IS NOT NULL AND OLD.user_id IS DISTINCT FROM v_caller_id)
  THEN
    RAISE EXCEPTION 'Journal vault owner mismatch' USING ERRCODE = '42501';
  END IF;

  SELECT state_row.*
  INTO v_state
  FROM public.journal_security_states AS state_row
  WHERE state_row.user_id = OLD.user_id
  FOR UPDATE;

  IF NOT FOUND
    OR v_state.protection_state <> 'unprotected'
    OR v_state.removal_operation_revision IS NULL
    OR v_state.vault_revision IS DISTINCT FROM
      security.read_journal_vault_revision(OLD.value)
  THEN
    RAISE EXCEPTION 'Journal vault deletion requires finalized removal'
      USING ERRCODE = '42501';
  END IF;

  RETURN OLD;
END;
$$;

REVOKE ALL ON FUNCTION private.admit_journal_vault_delete()
  FROM PUBLIC, anon, authenticated, service_role;

CREATE OR REPLACE FUNCTION security.authorize_protected_journal_write(
  p_owner_id uuid,
  p_vault_revision bigint
)
RETURNS boolean
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_caller_id uuid := (SELECT auth.uid());
  v_state public.journal_security_states%ROWTYPE;
  v_remote_revision bigint;
BEGIN
  IF p_owner_id IS NULL
    OR p_vault_revision IS NULL
    OR v_caller_id IS NULL
    OR p_owner_id IS DISTINCT FROM v_caller_id
  THEN
    RETURN false;
  END IF;

  SELECT state_row.*
  INTO v_state
  FROM public.journal_security_states AS state_row
  WHERE state_row.user_id = p_owner_id
  FOR UPDATE;

  IF NOT FOUND
    OR v_state.journal_write_mode = 'paused'
    OR v_state.protection_state <> 'protected'
    OR p_vault_revision IS DISTINCT FROM v_state.vault_revision
  THEN
    RETURN false;
  END IF;

  SELECT security.read_journal_vault_revision(settings.value)
  INTO v_remote_revision
  FROM public.user_settings AS settings
  WHERE settings.user_id = p_owner_id
    AND settings.key = 'journal_vault_key';

  RETURN v_remote_revision IS NOT NULL
    AND v_remote_revision = v_state.vault_revision;
END;
$$;

REVOKE ALL ON FUNCTION security.authorize_protected_journal_write(uuid, bigint)
  FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION security.authorize_protected_journal_write(uuid, bigint)
  TO authenticated;

CREATE OR REPLACE FUNCTION private.enforce_journal_protected_write_fence()
RETURNS trigger
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_is_protected boolean := false;
  v_backup_fields jsonb;
  v_removal_context_owner text;
  v_removal_context_operation text;
  v_removal_context_vault text;
  v_state public.journal_security_states%ROWTYPE;
  v_state_found boolean := false;
BEGIN
  IF TG_TABLE_NAME = 'journal_entries' THEN
    v_is_protected := NEW.content LIKE 'zenflow:journal-content:v1:%';
  ELSIF TG_TABLE_NAME IN ('journal_photos', 'journal_audio') THEN
    v_is_protected := NEW.storage_path IS NOT NULL
      AND pg_catalog.right(NEW.storage_path, 4) = '.bin';
  ELSIF TG_TABLE_NAME = 'user_backups' THEN
    v_backup_fields := pg_catalog.jsonb_build_object(
      'journalEntries', NEW.payload #> '{data,journalEntries}',
      'journalPhotos', NEW.payload #> '{data,journalPhotos}',
      'journalAudio', NEW.payload #> '{data,journalAudio}',
      'journalHubPreferences', NEW.payload #> '{data,journalHubPreferences}',
      'journalSpaces', NEW.payload #> '{data,journalSpaces}',
      'journalPracticeSessions', NEW.payload #> '{data,journalPracticeSessions}',
      'journalEntryLinks', NEW.payload #> '{data,journalEntryLinks}',
      'journalSpaceCaptures', NEW.payload #> '{data,journalSpaceCaptures}'
    );
    v_is_protected := COALESCE(
      v_backup_fields::text LIKE '%zenflow:journal-content:v1:%'
      OR v_backup_fields::text LIKE '%zenflow:journal-media:v1:%',
      false
    );
  END IF;

  SELECT state_row.*
  INTO v_state
  FROM public.journal_security_states AS state_row
  WHERE state_row.user_id = NEW.user_id
  FOR UPDATE;
  v_state_found := FOUND;

  IF v_state_found AND v_state.journal_write_mode = 'paused' THEN
    v_removal_context_owner := pg_catalog.current_setting(
      'zenflow.journal_removal_owner',
      true
    );
    v_removal_context_operation := pg_catalog.current_setting(
      'zenflow.journal_removal_operation',
      true
    );
    v_removal_context_vault := pg_catalog.current_setting(
      'zenflow.journal_removal_vault_revision',
      true
    );
    IF v_state.protection_state <> 'removing'
      OR v_is_protected
      OR NEW.vault_revision IS NOT NULL
      OR v_removal_context_owner IS DISTINCT FROM NEW.user_id::text
      OR v_removal_context_operation IS DISTINCT FROM v_state.removal_operation_revision
      OR v_removal_context_vault IS DISTINCT FROM v_state.vault_revision::text
      OR (
        TG_TABLE_NAME = 'user_backups'
        AND NOT security.validate_journal_backup_vault_epoch(NEW.payload, NULL)
      )
    THEN
      RAISE EXCEPTION 'Protected journal writes are paused for removal'
        USING ERRCODE = '55000';
    END IF;

    -- Only an operation-bound SECURITY DEFINER RPC sets this transaction-local
    -- context. Direct or stale clients cannot write plaintext through the
    -- paused window, even when they still own the account.
    RETURN NEW;
  END IF;

  IF v_is_protected THEN
    IF NOT v_state_found OR v_state.protection_state <> 'protected' THEN
      RAISE EXCEPTION 'Journal vault epoch mismatch'
        USING ERRCODE = '42501';
    END IF;

    -- Expand phase: already-installed clients did not send vault_revision and
    -- used unversioned *.bin object names. They remain admitted only while the
    -- owner is protected and the durable vault setting still matches the
    -- locked state. Any explicit revision must already be exact.
    IF v_state.journal_write_mode = 'legacy' THEN
      IF NEW.vault_revision IS NOT NULL
        AND NEW.vault_revision IS DISTINCT FROM v_state.vault_revision
      THEN
        RAISE EXCEPTION 'Journal vault epoch mismatch'
          USING ERRCODE = '42501';
      END IF;

      IF NEW.vault_revision IS NOT NULL
        AND TG_TABLE_NAME IN ('journal_photos', 'journal_audio')
        AND security.read_journal_media_vault_revision(NEW.storage_path)
          IS DISTINCT FROM NEW.vault_revision
      THEN
        RAISE EXCEPTION 'Journal vault epoch mismatch'
          USING ERRCODE = '42501';
      END IF;

      IF NEW.vault_revision IS NOT NULL
        AND TG_TABLE_NAME = 'user_backups'
        AND NOT security.validate_journal_backup_vault_epoch(
          NEW.payload,
          NEW.vault_revision
        )
      THEN
        RAISE EXCEPTION 'Journal vault epoch mismatch'
          USING ERRCODE = '42501';
      END IF;

      IF NOT security.authorize_protected_journal_write(
        NEW.user_id,
        v_state.vault_revision
      ) THEN
        RAISE EXCEPTION 'Journal vault epoch mismatch'
          USING ERRCODE = '42501';
      END IF;

      RETURN NEW;
    END IF;

    -- Contract phase: once an owner has no legacy protected data, every row,
    -- backup item, and object name must carry the exact active epoch.
    IF NEW.vault_revision IS DISTINCT FROM v_state.vault_revision THEN
      RAISE EXCEPTION 'Journal vault epoch mismatch'
        USING ERRCODE = '42501';
    END IF;

    IF TG_TABLE_NAME IN ('journal_photos', 'journal_audio')
      AND security.read_journal_media_vault_revision(NEW.storage_path)
        IS DISTINCT FROM NEW.vault_revision
    THEN
      RAISE EXCEPTION 'Journal vault epoch mismatch'
        USING ERRCODE = '42501';
    END IF;

    IF TG_TABLE_NAME = 'user_backups'
      AND NOT security.validate_journal_backup_vault_epoch(
        NEW.payload,
        NEW.vault_revision
      )
    THEN
      RAISE EXCEPTION 'Journal vault epoch mismatch'
        USING ERRCODE = '42501';
    END IF;

    IF NOT security.authorize_protected_journal_write(NEW.user_id, NEW.vault_revision) THEN
      RAISE EXCEPTION 'Journal vault epoch mismatch'
        USING ERRCODE = '42501';
    END IF;
  ELSE
    IF NEW.vault_revision IS NOT NULL THEN
      RAISE EXCEPTION 'Journal vault epoch mismatch'
        USING ERRCODE = '42501';
    END IF;

    IF TG_TABLE_NAME = 'user_backups'
      AND NOT security.validate_journal_backup_vault_epoch(NEW.payload, NULL)
    THEN
      RAISE EXCEPTION 'Journal vault epoch mismatch'
        USING ERRCODE = '42501';
    END IF;

    IF v_state_found AND v_state.protection_state = 'protected' THEN
      RAISE EXCEPTION 'Journal plaintext write rejected while vault is protected'
        USING ERRCODE = '42501';
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION private.enforce_journal_protected_write_fence()
  FROM PUBLIC, anon, authenticated, service_role;

-- A stale client must not make protected data disappear while the removal
-- worker is proving that every object has a readable plaintext replacement.
-- Account deletion remains the sole permanent-barrier bypass.
CREATE OR REPLACE FUNCTION private.enforce_journal_removal_delete_fence()
RETURNS trigger
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_removal_context_owner text;
  v_removal_context_operation text;
  v_removal_context_vault text;
  v_state public.journal_security_states%ROWTYPE;
BEGIN
  IF EXISTS (
    SELECT 1
    FROM public.account_deletion_blocks AS deletion_block
    WHERE deletion_block.user_id = OLD.user_id
  ) THEN
    RETURN OLD;
  END IF;

  SELECT state_row.*
  INTO v_state
  FROM public.journal_security_states AS state_row
  WHERE state_row.user_id = OLD.user_id
  FOR UPDATE;

  IF FOUND AND v_state.journal_write_mode = 'paused' THEN
    v_removal_context_owner := pg_catalog.current_setting(
      'zenflow.journal_removal_owner',
      true
    );
    v_removal_context_operation := pg_catalog.current_setting(
      'zenflow.journal_removal_operation',
      true
    );
    v_removal_context_vault := pg_catalog.current_setting(
      'zenflow.journal_removal_vault_revision',
      true
    );
    IF v_state.protection_state <> 'removing'
      OR v_removal_context_owner IS DISTINCT FROM OLD.user_id::text
      OR v_removal_context_operation IS DISTINCT FROM v_state.removal_operation_revision
      OR v_removal_context_vault IS DISTINCT FROM v_state.vault_revision::text
    THEN
      RAISE EXCEPTION 'Journal deletion is paused for removal'
        USING ERRCODE = '55000';
    END IF;
  END IF;

  RETURN OLD;
END;
$$;

REVOKE ALL ON FUNCTION private.enforce_journal_removal_delete_fence()
  FROM PUBLIC, anon, authenticated, service_role;

CREATE OR REPLACE FUNCTION security.authorize_journal_media_write(
  p_owner_id uuid,
  p_bucket_id text,
  p_object_name text
)
RETURNS boolean
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_caller_id uuid := (SELECT auth.uid());
  v_write_allowed boolean;
  v_object_revision bigint;
  v_state public.journal_security_states%ROWTYPE;
  v_state_found boolean := false;
BEGIN
  IF p_owner_id IS NULL
    OR p_object_name IS NULL
    OR p_bucket_id NOT IN ('journal-photos', 'journal-audio')
    OR v_caller_id IS NULL
    OR p_owner_id IS DISTINCT FROM v_caller_id
  THEN
    RETURN false;
  END IF;

  -- Preserve the terminal account-deletion fence: higher isolation levels
  -- cannot refresh a stale snapshot after waiting on the owner lock.
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

  IF NOT v_write_allowed THEN
    RETURN false;
  END IF;

  SELECT state_row.*
  INTO v_state
  FROM public.journal_security_states AS state_row
  WHERE state_row.user_id = p_owner_id
  FOR UPDATE;
  v_state_found := FOUND;

  IF v_state_found AND v_state.journal_write_mode = 'paused' THEN
    RETURN v_state.protection_state = 'removing'
      AND v_state.removal_mutation_started
      AND pg_catalog.right(p_object_name, 4) <> '.bin'
      AND (storage.foldername(p_object_name))[2] = 'removal'
      AND (storage.foldername(p_object_name))[3]
        = v_state.removal_operation_revision
      AND EXISTS (
        SELECT 1
        FROM pg_catalog.jsonb_array_elements(
          v_state.removal_media_reservations
        ) AS reservation(value)
        WHERE reservation.value ->> 'bucket' = p_bucket_id
          AND reservation.value ->> 'path' = p_object_name
      );
  END IF;

  IF pg_catalog.right(p_object_name, 4) = '.bin' THEN
    IF NOT v_state_found OR v_state.protection_state <> 'protected' THEN
      RETURN false;
    END IF;

    v_object_revision := security.read_journal_media_vault_revision(
      p_object_name
    );

    IF v_state.journal_write_mode = 'legacy' THEN
      IF v_object_revision IS NOT NULL
        AND v_object_revision IS DISTINCT FROM v_state.vault_revision
      THEN
        RETURN false;
      END IF;

      RETURN security.authorize_protected_journal_write(
        p_owner_id,
        v_state.vault_revision
      );
    END IF;

    IF v_object_revision IS NULL THEN
      RETURN false;
    END IF;

    RETURN security.authorize_protected_journal_write(
      p_owner_id,
      v_object_revision
    );
  END IF;

  RETURN NOT v_state_found OR v_state.protection_state <> 'protected';
END;
$$;

REVOKE ALL ON FUNCTION security.authorize_journal_media_write(uuid, text, text)
  FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION security.authorize_journal_media_write(uuid, text, text)
  TO authenticated;

CREATE OR REPLACE FUNCTION security.authorize_journal_media_delete(
  p_owner_id uuid,
  p_bucket_id text,
  p_object_name text
)
RETURNS boolean
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_caller_id uuid := (SELECT auth.uid());
  v_state public.journal_security_states%ROWTYPE;
  v_state_found boolean := false;
BEGIN
  IF p_owner_id IS NULL
    OR p_object_name IS NULL
    OR p_bucket_id NOT IN ('journal-photos', 'journal-audio')
    OR v_caller_id IS NULL
    OR p_owner_id IS DISTINCT FROM v_caller_id
  THEN
    RETURN false;
  END IF;

  -- Storage deletion uses the same fail-closed snapshot rule as admission.
  IF pg_catalog.current_setting('transaction_isolation') <> 'read committed' THEN
    RETURN false;
  END IF;

  PERFORM pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(p_owner_id::text, 0)
  );

  IF EXISTS (
    SELECT 1
    FROM public.account_deletion_blocks AS deletion_block
    WHERE deletion_block.user_id = p_owner_id
  ) THEN
    RETURN false;
  END IF;

  SELECT state_row.*
  INTO v_state
  FROM public.journal_security_states AS state_row
  WHERE state_row.user_id = p_owner_id
  FOR UPDATE;
  v_state_found := FOUND;

  IF NOT v_state_found OR v_state.journal_write_mode <> 'paused' THEN
    RETURN true;
  END IF;

  IF v_state.protection_state <> 'removing'
  THEN
    RETURN false;
  END IF;

  -- Plaintext replacements are deletable only inside the current operation
  -- namespace and only after no metadata row references them.
  IF pg_catalog.right(p_object_name, 4) <> '.bin' THEN
    IF (storage.foldername(p_object_name))[2] IS DISTINCT FROM 'removal'
      OR (storage.foldername(p_object_name))[3]
        IS DISTINCT FROM v_state.removal_operation_revision
    THEN
      RETURN false;
    END IF;
  -- Protected predecessors have no operation namespace on legacy clients.
  -- Restrict them to the exact frozen current inventory, then require that the
  -- operation-bound metadata mutation already stopped referencing the object.
  ELSIF NOT EXISTS (
    SELECT 1
    FROM pg_catalog.jsonb_array_elements(
      COALESCE(v_state.removal_inventory -> 'storageObjects', '[]'::jsonb)
    ) AS inventory_item(value)
    WHERE inventory_item.value ->> 'bucket' = p_bucket_id
      AND inventory_item.value ->> 'path' = p_object_name
  ) THEN
    RETURN false;
  END IF;

  IF p_bucket_id = 'journal-photos' THEN
    RETURN NOT EXISTS (
      SELECT 1
      FROM public.journal_photos AS photos
      WHERE photos.user_id = p_owner_id
        AND photos.storage_path = p_object_name
    );
  END IF;

  RETURN NOT EXISTS (
    SELECT 1
    FROM public.journal_audio AS audio
    WHERE audio.user_id = p_owner_id
      AND audio.storage_path = p_object_name
  );
END;
$$;

REVOKE ALL ON FUNCTION security.authorize_journal_media_delete(uuid, text, text)
  FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION security.authorize_journal_media_delete(uuid, text, text)
  TO authenticated;

-- Contract phase is owner-scoped and opt-in. Deploying this migration keeps
-- every existing owner in legacy mode; a current client may request strict
-- admission only after every protected row, backup item, and Storage object
-- already carries the exact active vault revision.
CREATE OR REPLACE FUNCTION public.enable_journal_strict_write_fence(
  p_expected_vault_revision bigint
)
RETURNS text
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_user_id uuid := (SELECT auth.uid());
  v_state public.journal_security_states%ROWTYPE;
  v_remote_revision bigint;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Authentication required' USING ERRCODE = '42501';
  END IF;

  IF p_expected_vault_revision IS NULL
    OR p_expected_vault_revision < 0
    OR p_expected_vault_revision > 9007199254740991
  THEN
    RETURN 'stale';
  END IF;

  PERFORM security.assert_journal_owner_active(v_user_id);

  SELECT security.read_journal_vault_revision(settings.value)
  INTO v_remote_revision
  FROM public.user_settings AS settings
  WHERE settings.user_id = v_user_id
    AND settings.key = 'journal_vault_key'
  FOR UPDATE;

  SELECT state_row.*
  INTO v_state
  FROM public.journal_security_states AS state_row
  WHERE state_row.user_id = v_user_id
  FOR UPDATE;

  IF NOT FOUND
    OR v_state.protection_state <> 'protected'
    OR v_state.journal_write_mode = 'paused'
    OR v_state.vault_revision IS DISTINCT FROM p_expected_vault_revision
  THEN
    RETURN 'stale';
  END IF;

  IF v_remote_revision IS DISTINCT FROM p_expected_vault_revision THEN
    RETURN 'stale';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM public.journal_entries AS entries
    WHERE entries.user_id = v_user_id
      AND (
        COALESCE(
          entries.content LIKE 'zenflow:journal-content:v1:%',
          false
        ) IS NOT TRUE
        OR entries.vault_revision IS DISTINCT FROM p_expected_vault_revision
      )
  ) OR EXISTS (
    SELECT 1
    FROM public.journal_photos AS photos
    WHERE photos.user_id = v_user_id
      AND (
        photos.storage_path IS NULL
        OR pg_catalog.right(photos.storage_path, 4) <> '.bin'
        OR photos.vault_revision IS DISTINCT FROM p_expected_vault_revision
        OR security.read_journal_media_vault_revision(photos.storage_path)
          IS DISTINCT FROM p_expected_vault_revision
      )
  ) OR EXISTS (
    SELECT 1
    FROM public.journal_audio AS audio
    WHERE audio.user_id = v_user_id
      AND (
        audio.storage_path IS NULL
        OR pg_catalog.right(audio.storage_path, 4) <> '.bin'
        OR audio.vault_revision IS DISTINCT FROM p_expected_vault_revision
        OR security.read_journal_media_vault_revision(audio.storage_path)
          IS DISTINCT FROM p_expected_vault_revision
      )
  ) OR EXISTS (
    SELECT 1
    FROM public.user_backups AS backups
    WHERE backups.user_id = v_user_id
      AND (
        backups.vault_revision IS DISTINCT FROM p_expected_vault_revision
        OR NOT security.validate_journal_backup_vault_epoch(
          backups.payload,
          p_expected_vault_revision
        )
      )
  ) OR EXISTS (
    SELECT 1
    FROM storage.objects AS objects
    WHERE objects.bucket_id IN ('journal-photos', 'journal-audio')
      AND (storage.foldername(objects.name))[1] = v_user_id::text
      AND security.read_journal_media_vault_revision(objects.name)
        IS DISTINCT FROM p_expected_vault_revision
  ) THEN
    RETURN 'legacy-data';
  END IF;

  UPDATE public.journal_security_states
  SET
    journal_write_mode = 'strict',
    updated_at = now()
  WHERE user_id = v_user_id;

  RETURN 'strict';
END;
$$;

REVOKE ALL ON FUNCTION public.enable_journal_strict_write_fence(bigint)
  FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.enable_journal_strict_write_fence(bigint)
  TO authenticated;

-- Preserve the latest parent-membership and account-deletion checks while
-- adding the object-name-aware journal vault fence.
DROP POLICY IF EXISTS "journal_photos_upload" ON storage.objects;
CREATE POLICY "journal_photos_upload" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'journal-photos'
    AND (storage.foldername(name))[1] = (SELECT auth.uid())::text
      AND security.authorize_journal_media_write((SELECT auth.uid()), bucket_id, name)
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
      AND security.authorize_journal_media_write((SELECT auth.uid()), bucket_id, name)
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
      AND security.authorize_journal_media_write((SELECT auth.uid()), bucket_id, name)
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
      AND security.authorize_journal_media_write((SELECT auth.uid()), bucket_id, name)
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
      AND security.authorize_journal_media_write((SELECT auth.uid()), bucket_id, name)
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
      AND security.authorize_journal_media_write((SELECT auth.uid()), bucket_id, name)
    AND EXISTS (
      SELECT 1 FROM public.journal_entries AS entries
      WHERE entries.user_id = (SELECT auth.uid())
        AND split_part(storage.filename(name), '.', 1) = ANY (
          COALESCE(entries.audio_ids, '{}'::text[])
        )
    )
  );

-- Preserve the existing deletion-barrier contract while serializing removal
-- cleanup. A protected blob can be deleted during the paused window only
-- after the corresponding row points at its acknowledged plaintext version.
DROP POLICY IF EXISTS "journal_photos_delete" ON storage.objects;
CREATE POLICY "journal_photos_delete" ON storage.objects
  FOR DELETE TO authenticated
  USING (
    bucket_id = 'journal-photos'
    AND (storage.foldername(name))[1] = (SELECT auth.uid())::text
    AND NOT EXISTS (
      SELECT 1
      FROM public.account_deletion_blocks AS deletion_block
      WHERE deletion_block.user_id = (SELECT auth.uid())
    )
    AND security.authorize_journal_media_delete(
      (SELECT auth.uid()),
      bucket_id,
      name
    )
  );

DROP POLICY IF EXISTS "journal_audio_delete" ON storage.objects;
CREATE POLICY "journal_audio_delete" ON storage.objects
  FOR DELETE TO authenticated
  USING (
    bucket_id = 'journal-audio'
    AND (storage.foldername(name))[1] = (SELECT auth.uid())::text
    AND NOT EXISTS (
      SELECT 1
      FROM public.account_deletion_blocks AS deletion_block
      WHERE deletion_block.user_id = (SELECT auth.uid())
    )
    AND security.authorize_journal_media_delete(
      (SELECT auth.uid()),
      bucket_id,
      name
    )
  );

DROP FUNCTION IF EXISTS security.authorize_journal_media_write(uuid);
DROP FUNCTION IF EXISTS security.authorize_journal_media_write(uuid, text);
DROP FUNCTION IF EXISTS security.authorize_protected_journal_write(uuid);
DROP FUNCTION IF EXISTS public.begin_journal_password_removal(bigint, text);

CREATE OR REPLACE FUNCTION security.canonical_journal_inventory_json(
  p_value jsonb
)
RETURNS text
LANGUAGE plpgsql
IMMUTABLE
SECURITY INVOKER
SET search_path = ''
AS $$
DECLARE
  v_type text := pg_catalog.jsonb_typeof(p_value);
  v_result text;
BEGIN
  IF p_value IS NULL OR v_type = 'null' THEN
    RETURN 'null';
  END IF;
  IF v_type IN ('string', 'boolean') THEN
    RETURN p_value::text;
  END IF;
  IF v_type = 'number' THEN
    -- JavaScript JSON serialization may emit exponent notation while jsonb
    -- expands it and may retain fractional zeroes. Canonicalize both runtimes
    -- to a full decimal without insignificant scale before hashing.
    RETURN pg_catalog.trim_scale((p_value::text)::numeric)::text;
  END IF;
  IF v_type = 'array' THEN
    SELECT '[' || COALESCE(
      pg_catalog.string_agg(
        security.canonical_journal_inventory_json(item.value),
        ',' ORDER BY item.ordinality
      ),
      ''
    ) || ']'
    INTO v_result
    FROM pg_catalog.jsonb_array_elements(p_value) WITH ORDINALITY AS item(value, ordinality);
    RETURN v_result;
  END IF;
  IF v_type = 'object' THEN
    SELECT '{' || COALESCE(
      pg_catalog.string_agg(
        pg_catalog.to_jsonb(item.key)::text || ':' ||
          security.canonical_journal_inventory_json(item.value),
        ',' ORDER BY item.key COLLATE "C"
      ),
      ''
    ) || '}'
    INTO v_result
    FROM pg_catalog.jsonb_each(p_value) AS item(key, value);
    RETURN v_result;
  END IF;
  RAISE EXCEPTION 'Unsupported journal inventory JSON type'
    USING ERRCODE = '22023';
END;
$$;

REVOKE ALL ON FUNCTION security.canonical_journal_inventory_json(jsonb)
  FROM PUBLIC, anon, authenticated, service_role;

CREATE OR REPLACE FUNCTION security.journal_inventory_security_projection(
  p_kind text,
  p_value jsonb
)
RETURNS jsonb
LANGUAGE plpgsql
IMMUTABLE
SECURITY INVOKER
SET search_path = ''
AS $$
DECLARE
  v_fields jsonb;
BEGIN
  IF p_value IS NULL OR pg_catalog.jsonb_typeof(p_value) <> 'object' THEN
    RETURN NULL;
  END IF;

  CASE p_kind
    -- The row digest covers every client-mutable column. Ownership is checked
    -- separately and row_revision is the post-begin TOCTOU token, so neither is
    -- duplicated inside this pre-begin snapshot digest.
    WHEN 'entry-row' THEN
      RETURN pg_catalog.jsonb_build_object(
        'id', p_value -> 'id',
        'date', p_value -> 'date',
        'title', p_value -> 'title',
        'content', p_value -> 'content',
        'stickers', p_value -> 'stickers',
        'mood', p_value -> 'mood',
        'tags', p_value -> 'tags',
        'template_id', p_value -> 'template_id',
        'habit_snapshot', p_value -> 'habit_snapshot',
        'photo_ids', p_value -> 'photo_ids',
        'audio_ids', p_value -> 'audio_ids',
        'photo_layout', p_value -> 'photo_layout',
        'bg_pattern', p_value -> 'bg_pattern',
        'bg_intensity', p_value -> 'bg_intensity',
        'paper_color', p_value -> 'paper_color',
        'paper_texture', p_value -> 'paper_texture',
        'font', p_value -> 'font',
        'font_size', p_value -> 'font_size',
        'ink_color', p_value -> 'ink_color',
        'theme', p_value -> 'theme',
        'particle_speed', p_value -> 'particle_speed',
        'created_at', p_value -> 'created_at',
        'updated_at', p_value -> 'updated_at',
        'vault_revision', p_value ->> 'vault_revision'
      );
    WHEN 'photo-row' THEN
      RETURN pg_catalog.jsonb_build_object(
        'id', p_value -> 'id',
        'entry_id', p_value -> 'entry_id',
        'width', p_value -> 'width',
        'height', p_value -> 'height',
        'storage_path', p_value -> 'storage_path',
        'storage_url', p_value -> 'storage_url',
        'created_at', p_value -> 'created_at',
        'vault_revision', p_value ->> 'vault_revision'
      );
    WHEN 'audio-row' THEN
      RETURN pg_catalog.jsonb_build_object(
        'id', p_value -> 'id',
        'entry_id', p_value -> 'entry_id',
        'duration', p_value -> 'duration',
        'mime_type', p_value -> 'mime_type',
        'storage_path', p_value -> 'storage_path',
        'storage_url', p_value -> 'storage_url',
        'created_at', p_value -> 'created_at',
        'vault_revision', p_value ->> 'vault_revision'
      );
    WHEN 'entry-backup', 'photo-backup', 'audio-backup',
      'space-backup', 'capture-backup' THEN
      -- Backup items are preservation receipts, not decryption hints. Hash the
      -- complete exported object so no unlisted field can be silently replaced.
      RETURN p_value;
    ELSE
      RETURN NULL;
  END CASE;
END;
$$;

REVOKE ALL ON FUNCTION security.journal_inventory_security_projection(text, jsonb)
  FROM PUBLIC, anon, authenticated, service_role;

CREATE OR REPLACE FUNCTION security.journal_inventory_sha256(
  p_value jsonb
)
RETURNS text
LANGUAGE sql
IMMUTABLE
SECURITY INVOKER
SET search_path = ''
AS $$
  SELECT pg_catalog.encode(
    extensions.digest(
      pg_catalog.convert_to(
        security.canonical_journal_inventory_json(p_value),
        'UTF8'
      ),
      'sha256'
    ),
    'hex'
  )
$$;

REVOKE ALL ON FUNCTION security.journal_inventory_sha256(jsonb)
  FROM PUBLIC, anon, authenticated, service_role;

CREATE OR REPLACE FUNCTION security.jsonb_object_has_exact_keys(
  p_value jsonb,
  p_keys text[]
)
RETURNS boolean
LANGUAGE sql
IMMUTABLE
SECURITY INVOKER
SET search_path = ''
AS $$
  SELECT pg_catalog.jsonb_typeof(p_value) = 'object'
    AND (
      SELECT pg_catalog.array_agg(item.key ORDER BY item.key)
      FROM pg_catalog.jsonb_object_keys(p_value) AS item(key)
    ) IS NOT DISTINCT FROM (
      SELECT pg_catalog.array_agg(item.key ORDER BY item.key)
      FROM pg_catalog.unnest(p_keys) AS item(key)
    )
$$;

REVOKE ALL ON FUNCTION security.jsonb_object_has_exact_keys(jsonb, text[])
  FROM PUBLIC, anon, authenticated, service_role;

CREATE OR REPLACE FUNCTION security.journal_removal_recent_auth_is_valid()
RETURNS boolean
LANGUAGE plpgsql
STABLE
SECURITY INVOKER
SET search_path = ''
AS $$
DECLARE
  v_jwt jsonb := auth.jwt();
  v_now bigint := pg_catalog.extract(epoch FROM pg_catalog.clock_timestamp())::bigint;
BEGIN
  IF v_jwt IS NULL
    OR pg_catalog.jsonb_typeof(v_jwt) <> 'object'
    OR v_jwt -> 'is_anonymous' IS DISTINCT FROM 'false'::jsonb
    OR pg_catalog.jsonb_typeof(v_jwt -> 'amr') IS DISTINCT FROM 'array'
  THEN
    RETURN false;
  END IF;

  RETURN EXISTS (
    SELECT 1
    FROM pg_catalog.jsonb_array_elements(auth.jwt() -> 'amr') AS method(value)
    WHERE pg_catalog.jsonb_typeof(method.value) = 'object'
      AND method.value ->> 'method' IN (
        'password', 'otp', 'totp', 'oauth', 'sso/saml', 'magiclink', 'recovery'
      )
      AND method.value ->> 'method' <> 'token_refresh'
      AND method.value ->> 'timestamp' ~ '^[0-9]+$'
      AND (method.value ->> 'timestamp')::numeric BETWEEN v_now - 600 AND v_now
  );
EXCEPTION
  WHEN numeric_value_out_of_range OR invalid_text_representation THEN
    RETURN false;
END;
$$;

REVOKE ALL ON FUNCTION security.journal_removal_recent_auth_is_valid()
  FROM PUBLIC, anon, authenticated, service_role;

CREATE OR REPLACE FUNCTION private.bump_journal_row_revision()
RETURNS trigger
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    NEW.row_revision := 0;
    RETURN NEW;
  END IF;
  IF OLD.row_revision >= 9007199254740991 THEN
    RAISE EXCEPTION 'Journal row revision exhausted' USING ERRCODE = '22003';
  END IF;
  NEW.row_revision := OLD.row_revision + 1;
  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION private.bump_journal_row_revision()
  FROM PUBLIC, anon, authenticated, service_role;

CREATE OR REPLACE FUNCTION security.journal_removal_inventory_covers_legacy_untrusted(
  p_owner_id uuid,
  p_expected_vault_revision bigint,
  p_inventory jsonb
)
RETURNS boolean
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_backup_payload jsonb;
  v_backup_vault_revision bigint;
  v_collection jsonb;
  v_inventory_collection jsonb;
  v_field text;
  v_projection_kind text;
BEGIN
  IF p_owner_id IS NULL
    OR p_expected_vault_revision IS NULL
    OR p_inventory IS NULL
    OR pg_catalog.jsonb_typeof(p_inventory) <> 'object'
    OR p_inventory ->> 'version' <> '1'
  THEN
    RETURN false;
  END IF;

  FOREACH v_field IN ARRAY ARRAY[
    'entries', 'photos', 'audios', 'spaces', 'captures', 'storageObjects'
  ] LOOP
    IF pg_catalog.jsonb_typeof(p_inventory -> v_field) IS DISTINCT FROM 'array' THEN
      RETURN false;
    END IF;
  END LOOP;

  IF EXISTS (
    SELECT 1
    FROM public.journal_entries AS entries
    WHERE entries.user_id = p_owner_id
      AND (
        entries.content LIKE 'zenflow:journal-content:v1:%'
        OR entries.vault_revision IS NOT NULL
      )
      AND NOT EXISTS (
        SELECT 1
        FROM pg_catalog.jsonb_array_elements(p_inventory -> 'entries') AS item(value)
        WHERE item.value ->> 'id' = entries.id
          AND item.value ->> 'rowSha256' ~ '^[0-9a-f]{64}$'
          AND item.value ->> 'rowSha256' = security.journal_inventory_sha256(
            security.journal_inventory_security_projection(
              'entry-row',
              pg_catalog.to_jsonb(entries)
            )
          )
      )
  ) THEN
    RETURN false;
  END IF;

  IF EXISTS (
    SELECT 1
    FROM public.journal_photos AS photos
    WHERE photos.user_id = p_owner_id
      AND (
        (photos.storage_path IS NOT NULL AND pg_catalog.right(photos.storage_path, 4) = '.bin')
        OR photos.vault_revision IS NOT NULL
      )
      AND NOT EXISTS (
        SELECT 1
        FROM pg_catalog.jsonb_array_elements(p_inventory -> 'photos') AS item(value)
        WHERE item.value ->> 'id' = photos.id
          AND item.value ->> 'parentId' = photos.entry_id
          AND item.value ->> 'rowSha256' ~ '^[0-9a-f]{64}$'
          AND item.value ->> 'rowSha256' = security.journal_inventory_sha256(
            security.journal_inventory_security_projection(
              'photo-row',
              pg_catalog.to_jsonb(photos)
            )
          )
      )
  ) THEN
    RETURN false;
  END IF;

  IF EXISTS (
    SELECT 1
    FROM public.journal_audio AS audio
    WHERE audio.user_id = p_owner_id
      AND (
        (audio.storage_path IS NOT NULL AND pg_catalog.right(audio.storage_path, 4) = '.bin')
        OR audio.vault_revision IS NOT NULL
      )
      AND NOT EXISTS (
        SELECT 1
        FROM pg_catalog.jsonb_array_elements(p_inventory -> 'audios') AS item(value)
        WHERE item.value ->> 'id' = audio.id
          AND item.value ->> 'parentId' = audio.entry_id
          AND item.value ->> 'rowSha256' ~ '^[0-9a-f]{64}$'
          AND item.value ->> 'rowSha256' = security.journal_inventory_sha256(
            security.journal_inventory_security_projection(
              'audio-row',
              pg_catalog.to_jsonb(audio)
            )
          )
      )
  ) THEN
    RETURN false;
  END IF;

  IF EXISTS (
    SELECT 1
    FROM storage.objects AS objects
    WHERE objects.bucket_id IN ('journal-photos', 'journal-audio')
      AND (storage.foldername(objects.name))[1] = p_owner_id::text
      AND pg_catalog.right(objects.name, 4) = '.bin'
      AND NOT EXISTS (
        SELECT 1
        FROM pg_catalog.jsonb_array_elements(p_inventory -> 'storageObjects') AS item(value)
        WHERE item.value ->> 'bucket' = objects.bucket_id
          AND item.value ->> 'path' = objects.name
          AND item.value ->> 'objectId' = objects.id::text
          AND item.value ->> 'version' = objects.version
          AND COALESCE(item.value ->> 'etag', '') = COALESCE(
            objects.metadata ->> 'eTag',
            objects.metadata ->> 'etag',
            ''
          )
          AND COALESCE(item.value ->> 'size', '') = COALESCE(
            objects.metadata ->> 'size',
            ''
          )
      )
  ) THEN
    RETURN false;
  END IF;

  SELECT backups.payload, backups.vault_revision
  INTO v_backup_payload, v_backup_vault_revision
  FROM public.user_backups AS backups
  WHERE backups.user_id = p_owner_id;

  IF NOT FOUND THEN
    RETURN true;
  END IF;
  IF v_backup_vault_revision IS DISTINCT FROM p_expected_vault_revision
    OR NOT security.validate_journal_backup_vault_epoch(
      v_backup_payload,
      p_expected_vault_revision
    )
  THEN
    RETURN false;
  END IF;

  FOREACH v_field IN ARRAY ARRAY[
    'journalEntries',
    'journalPhotos',
    'journalAudio',
    'journalSpaces',
    'journalSpaceCaptures'
  ] LOOP
    v_collection := COALESCE(
      v_backup_payload #> ARRAY['data', v_field],
      '[]'::jsonb
    );
    IF pg_catalog.jsonb_typeof(v_collection) <> 'array' THEN
      RETURN false;
    END IF;
    v_inventory_collection := p_inventory -> CASE v_field
      WHEN 'journalEntries' THEN 'entries'
      WHEN 'journalPhotos' THEN 'photos'
      WHEN 'journalAudio' THEN 'audios'
      WHEN 'journalSpaces' THEN 'spaces'
      ELSE 'captures'
    END;
    v_projection_kind := CASE v_field
      WHEN 'journalEntries' THEN 'entry-backup'
      WHEN 'journalPhotos' THEN 'photo-backup'
      WHEN 'journalAudio' THEN 'audio-backup'
      WHEN 'journalSpaces' THEN 'space-backup'
      ELSE 'capture-backup'
    END;
    IF EXISTS (
      SELECT 1
      FROM pg_catalog.jsonb_array_elements(v_collection) AS backup_item(value)
      WHERE pg_catalog.jsonb_typeof(backup_item.value) <> 'object'
        OR NOT EXISTS (
          SELECT 1
          FROM pg_catalog.jsonb_array_elements(v_inventory_collection) AS item(value)
          WHERE item.value ->> 'id' = backup_item.value ->> 'id'
            AND item.value ->> 'backupSha256' ~ '^[0-9a-f]{64}$'
            AND item.value ->> 'backupSha256' =
              security.journal_inventory_sha256(
                security.journal_inventory_security_projection(
                  v_projection_kind,
                  backup_item.value
                )
              )
        )
    ) THEN
      RETURN false;
    END IF;
  END LOOP;

  RETURN true;
END;
$$;

REVOKE ALL ON FUNCTION security.journal_removal_inventory_covers_legacy_untrusted(uuid, bigint, jsonb)
  FROM PUBLIC, anon, authenticated, service_role;

-- The draft one-way coverage helper above is created and dropped in the same
-- migration transaction so a partially reviewed draft can never remain
-- callable. The closed validator below is the only installed contract.
DROP FUNCTION security.journal_removal_inventory_covers_legacy_untrusted(uuid, bigint, jsonb);

CREATE OR REPLACE FUNCTION security.journal_removal_inventory_covers(
  p_owner_id uuid,
  p_expected_vault_revision bigint,
  p_inventory jsonb
)
RETURNS boolean
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_backup_payload jsonb;
  v_backup_vault_revision bigint;
  v_collection jsonb;
  v_inventory_collection jsonb;
  v_field text;
  v_inventory_field text;
  v_row_count bigint;
BEGIN
  IF p_owner_id IS NULL
    OR p_expected_vault_revision IS NULL
    OR p_expected_vault_revision NOT BETWEEN 0 AND 9007199254740991
    OR p_inventory IS NULL
    OR pg_catalog.pg_column_size(p_inventory) > 4194304
    OR NOT security.jsonb_object_has_exact_keys(
      p_inventory,
      ARRAY['version', 'entries', 'photos', 'audios', 'spaces', 'captures', 'storageObjects']
    )
    OR p_inventory -> 'version' IS DISTINCT FROM '1'::jsonb
  THEN
    RETURN false;
  END IF;

  FOREACH v_field IN ARRAY ARRAY[
    'entries', 'photos', 'audios', 'spaces', 'captures', 'storageObjects'
  ] LOOP
    IF pg_catalog.jsonb_typeof(p_inventory -> v_field) IS DISTINCT FROM 'array' THEN
      RETURN false;
    END IF;
  END LOOP;
  IF pg_catalog.jsonb_array_length(p_inventory -> 'entries') > 10000
    OR pg_catalog.jsonb_array_length(p_inventory -> 'photos') > 50000
    OR pg_catalog.jsonb_array_length(p_inventory -> 'audios') > 50000
    OR pg_catalog.jsonb_array_length(p_inventory -> 'spaces') > 10000
    OR pg_catalog.jsonb_array_length(p_inventory -> 'captures') > 50000
    OR pg_catalog.jsonb_array_length(p_inventory -> 'storageObjects') > 50000
  THEN
    RETURN false;
  END IF;

  IF EXISTS (
    SELECT 1
    FROM pg_catalog.jsonb_array_elements(p_inventory -> 'entries') AS item(value)
    WHERE NOT security.jsonb_object_has_exact_keys(
      item.value,
      ARRAY['id', 'rowSha256', 'backupSha256', 'postimageBackupSha256']
    )
      OR length(COALESCE(item.value ->> 'id', '')) NOT BETWEEN 1 AND 256
      OR COALESCE(item.value ->> 'rowSha256', '') !~ '^[0-9a-f]{64}$'
      OR COALESCE(item.value ->> 'backupSha256', '') !~ '^[0-9a-f]{64}$'
      OR COALESCE(item.value ->> 'postimageBackupSha256', '') !~ '^[0-9a-f]{64}$'
  ) OR EXISTS (
    SELECT 1
    FROM pg_catalog.jsonb_array_elements(p_inventory -> 'photos') AS item(value)
    WHERE NOT security.jsonb_object_has_exact_keys(
      item.value,
      ARRAY['id', 'parentId', 'rowSha256', 'backupSha256', 'postimageBackupSha256']
    )
      OR length(COALESCE(item.value ->> 'id', '')) NOT BETWEEN 1 AND 256
      OR length(COALESCE(item.value ->> 'parentId', '')) NOT BETWEEN 1 AND 256
      OR COALESCE(item.value ->> 'rowSha256', '') !~ '^[0-9a-f]{64}$'
      OR COALESCE(item.value ->> 'backupSha256', '') !~ '^[0-9a-f]{64}$'
      OR COALESCE(item.value ->> 'postimageBackupSha256', '') !~ '^[0-9a-f]{64}$'
  ) OR EXISTS (
    SELECT 1
    FROM pg_catalog.jsonb_array_elements(p_inventory -> 'audios') AS item(value)
    WHERE NOT security.jsonb_object_has_exact_keys(
      item.value,
      ARRAY['id', 'parentId', 'rowSha256', 'backupSha256', 'postimageBackupSha256']
    )
      OR length(COALESCE(item.value ->> 'id', '')) NOT BETWEEN 1 AND 256
      OR length(COALESCE(item.value ->> 'parentId', '')) NOT BETWEEN 1 AND 256
      OR COALESCE(item.value ->> 'rowSha256', '') !~ '^[0-9a-f]{64}$'
      OR COALESCE(item.value ->> 'backupSha256', '') !~ '^[0-9a-f]{64}$'
      OR COALESCE(item.value ->> 'postimageBackupSha256', '') !~ '^[0-9a-f]{64}$'
  ) OR EXISTS (
    SELECT 1
    FROM pg_catalog.jsonb_array_elements(p_inventory -> 'spaces') AS item(value)
    WHERE NOT security.jsonb_object_has_exact_keys(
      item.value,
      ARRAY['id', 'backupSha256', 'postimageBackupSha256']
    )
      OR length(COALESCE(item.value ->> 'id', '')) NOT BETWEEN 1 AND 256
      OR COALESCE(item.value ->> 'backupSha256', '') !~ '^[0-9a-f]{64}$'
      OR COALESCE(item.value ->> 'postimageBackupSha256', '') !~ '^[0-9a-f]{64}$'
  ) OR EXISTS (
    SELECT 1
    FROM pg_catalog.jsonb_array_elements(p_inventory -> 'captures') AS item(value)
    WHERE NOT security.jsonb_object_has_exact_keys(
      item.value,
      ARRAY['id', 'backupSha256', 'postimageBackupSha256']
    )
      OR length(COALESCE(item.value ->> 'id', '')) NOT BETWEEN 1 AND 256
      OR COALESCE(item.value ->> 'backupSha256', '') !~ '^[0-9a-f]{64}$'
      OR COALESCE(item.value ->> 'postimageBackupSha256', '') !~ '^[0-9a-f]{64}$'
  ) OR EXISTS (
    SELECT 1
    FROM pg_catalog.jsonb_array_elements(p_inventory -> 'storageObjects') AS item(value)
    WHERE NOT security.jsonb_object_has_exact_keys(
      item.value,
      ARRAY['bucket', 'path', 'objectId', 'version', 'etag', 'size']
    )
      OR item.value ->> 'bucket' NOT IN ('journal-photos', 'journal-audio')
      OR length(COALESCE(item.value ->> 'path', '')) NOT BETWEEN 1 AND 1024
      OR length(COALESCE(item.value ->> 'objectId', '')) NOT BETWEEN 1 AND 128
      OR length(COALESCE(item.value ->> 'version', '')) NOT BETWEEN 1 AND 256
      OR (item.value -> 'etag' <> 'null'::jsonb AND pg_catalog.jsonb_typeof(item.value -> 'etag') <> 'string')
      OR (item.value -> 'size' <> 'null'::jsonb AND (
        pg_catalog.jsonb_typeof(item.value -> 'size') <> 'number'
        OR COALESCE(item.value ->> 'size', '') !~ '^[0-9]+$'
      ))
  ) THEN
    RETURN false;
  END IF;

  IF EXISTS (
    SELECT 1 FROM (
      SELECT COUNT(*) AS total, COUNT(DISTINCT item.value ->> 'id') AS unique_total
      FROM pg_catalog.jsonb_array_elements(p_inventory -> 'entries') AS item(value)
    ) AS counts WHERE counts.total <> counts.unique_total
  ) OR EXISTS (
    SELECT 1 FROM (
      SELECT COUNT(*) AS total, COUNT(DISTINCT item.value ->> 'id') AS unique_total
      FROM pg_catalog.jsonb_array_elements(p_inventory -> 'photos') AS item(value)
    ) AS counts WHERE counts.total <> counts.unique_total
  ) OR EXISTS (
    SELECT 1 FROM (
      SELECT COUNT(*) AS total, COUNT(DISTINCT item.value ->> 'id') AS unique_total
      FROM pg_catalog.jsonb_array_elements(p_inventory -> 'audios') AS item(value)
    ) AS counts WHERE counts.total <> counts.unique_total
  ) OR EXISTS (
    SELECT 1 FROM (
      SELECT COUNT(*) AS total, COUNT(DISTINCT item.value ->> 'id') AS unique_total
      FROM pg_catalog.jsonb_array_elements(p_inventory -> 'spaces') AS item(value)
    ) AS counts WHERE counts.total <> counts.unique_total
  ) OR EXISTS (
    SELECT 1 FROM (
      SELECT COUNT(*) AS total, COUNT(DISTINCT item.value ->> 'id') AS unique_total
      FROM pg_catalog.jsonb_array_elements(p_inventory -> 'captures') AS item(value)
    ) AS counts WHERE counts.total <> counts.unique_total
  ) OR EXISTS (
    SELECT 1 FROM (
      SELECT COUNT(*) AS total,
        COUNT(DISTINCT (item.value ->> 'bucket') || E'\n' || (item.value ->> 'path')) AS unique_total
      FROM pg_catalog.jsonb_array_elements(p_inventory -> 'storageObjects') AS item(value)
    ) AS counts WHERE counts.total <> counts.unique_total
  ) THEN
    RETURN false;
  END IF;

  SELECT COUNT(*) INTO v_row_count
  FROM public.journal_entries AS entries
  WHERE entries.user_id = p_owner_id
    AND (entries.content LIKE 'zenflow:journal-content:v1:%' OR entries.vault_revision IS NOT NULL);
  IF v_row_count <> pg_catalog.jsonb_array_length(p_inventory -> 'entries') OR EXISTS (
    SELECT 1
    FROM pg_catalog.jsonb_array_elements(p_inventory -> 'entries') AS item(value)
    WHERE NOT EXISTS (
      SELECT 1 FROM public.journal_entries AS entries
      WHERE entries.user_id = p_owner_id
        AND entries.id = item.value ->> 'id'
        AND (entries.content LIKE 'zenflow:journal-content:v1:%' OR entries.vault_revision IS NOT NULL)
        AND item.value ->> 'rowSha256' = security.journal_inventory_sha256(
          security.journal_inventory_security_projection('entry-row', pg_catalog.to_jsonb(entries))
        )
    )
  ) THEN
    RETURN false;
  END IF;

  SELECT COUNT(*) INTO v_row_count
  FROM public.journal_photos AS photos
  WHERE photos.user_id = p_owner_id
    AND ((photos.storage_path IS NOT NULL AND pg_catalog.right(photos.storage_path, 4) = '.bin') OR photos.vault_revision IS NOT NULL);
  IF v_row_count <> pg_catalog.jsonb_array_length(p_inventory -> 'photos') OR EXISTS (
    SELECT 1
    FROM pg_catalog.jsonb_array_elements(p_inventory -> 'photos') AS item(value)
    WHERE NOT EXISTS (
      SELECT 1 FROM public.journal_photos AS photos
      WHERE photos.user_id = p_owner_id
        AND photos.id = item.value ->> 'id'
        AND photos.entry_id = item.value ->> 'parentId'
        AND ((photos.storage_path IS NOT NULL AND pg_catalog.right(photos.storage_path, 4) = '.bin') OR photos.vault_revision IS NOT NULL)
        AND item.value ->> 'rowSha256' = security.journal_inventory_sha256(
          security.journal_inventory_security_projection('photo-row', pg_catalog.to_jsonb(photos))
        )
    )
  ) THEN
    RETURN false;
  END IF;

  SELECT COUNT(*) INTO v_row_count
  FROM public.journal_audio AS audio
  WHERE audio.user_id = p_owner_id
    AND ((audio.storage_path IS NOT NULL AND pg_catalog.right(audio.storage_path, 4) = '.bin') OR audio.vault_revision IS NOT NULL);
  IF v_row_count <> pg_catalog.jsonb_array_length(p_inventory -> 'audios') OR EXISTS (
    SELECT 1
    FROM pg_catalog.jsonb_array_elements(p_inventory -> 'audios') AS item(value)
    WHERE NOT EXISTS (
      SELECT 1 FROM public.journal_audio AS audio
      WHERE audio.user_id = p_owner_id
        AND audio.id = item.value ->> 'id'
        AND audio.entry_id = item.value ->> 'parentId'
        AND ((audio.storage_path IS NOT NULL AND pg_catalog.right(audio.storage_path, 4) = '.bin') OR audio.vault_revision IS NOT NULL)
        AND item.value ->> 'rowSha256' = security.journal_inventory_sha256(
          security.journal_inventory_security_projection('audio-row', pg_catalog.to_jsonb(audio))
        )
    )
  ) THEN
    RETURN false;
  END IF;

  SELECT COUNT(*) INTO v_row_count
  FROM storage.objects AS objects
  WHERE objects.bucket_id IN ('journal-photos', 'journal-audio')
    AND (storage.foldername(objects.name))[1] = p_owner_id::text
    AND pg_catalog.right(objects.name, 4) = '.bin';
  IF v_row_count <> pg_catalog.jsonb_array_length(p_inventory -> 'storageObjects') OR EXISTS (
    SELECT 1
    FROM pg_catalog.jsonb_array_elements(p_inventory -> 'storageObjects') AS item(value)
    WHERE NOT EXISTS (
      SELECT 1 FROM storage.objects AS objects
      WHERE objects.bucket_id = item.value ->> 'bucket'
        AND objects.name = item.value ->> 'path'
        AND objects.id::text = item.value ->> 'objectId'
        AND objects.version = item.value ->> 'version'
        AND COALESCE(objects.metadata ->> 'eTag', objects.metadata ->> 'etag', '') = COALESCE(item.value ->> 'etag', '')
        AND COALESCE(objects.metadata ->> 'size', '') = COALESCE(item.value ->> 'size', '')
    )
  ) THEN
    RETURN false;
  END IF;

  SELECT backups.payload, backups.vault_revision
  INTO v_backup_payload, v_backup_vault_revision
  FROM public.user_backups AS backups
  WHERE backups.user_id = p_owner_id;
  IF NOT FOUND THEN
    RETURN pg_catalog.jsonb_array_length(p_inventory -> 'spaces') = 0
      AND pg_catalog.jsonb_array_length(p_inventory -> 'captures') = 0;
  END IF;
  IF v_backup_vault_revision IS DISTINCT FROM p_expected_vault_revision
    OR NOT security.validate_journal_backup_vault_epoch(v_backup_payload, p_expected_vault_revision)
  THEN
    RETURN false;
  END IF;

  FOREACH v_field IN ARRAY ARRAY[
    'journalEntries', 'journalPhotos', 'journalAudio', 'journalSpaces', 'journalSpaceCaptures'
  ] LOOP
    v_inventory_field := CASE v_field
      WHEN 'journalEntries' THEN 'entries'
      WHEN 'journalPhotos' THEN 'photos'
      WHEN 'journalAudio' THEN 'audios'
      WHEN 'journalSpaces' THEN 'spaces'
      ELSE 'captures'
    END;
    v_collection := COALESCE(v_backup_payload #> ARRAY['data', v_field], '[]'::jsonb);
    v_inventory_collection := p_inventory -> v_inventory_field;
    IF pg_catalog.jsonb_typeof(v_collection) <> 'array'
      OR EXISTS (
        SELECT 1 FROM (
          SELECT COUNT(*) AS total, COUNT(DISTINCT item.value ->> 'id') AS unique_total
          FROM pg_catalog.jsonb_array_elements(v_collection) AS item(value)
        ) AS counts WHERE counts.total <> counts.unique_total
      )
      OR EXISTS (
        SELECT 1
        FROM pg_catalog.jsonb_array_elements(v_collection) AS backup_item(value)
        WHERE pg_catalog.jsonb_typeof(backup_item.value) <> 'object'
          OR length(COALESCE(backup_item.value ->> 'id', '')) NOT BETWEEN 1 AND 256
          OR NOT EXISTS (
            SELECT 1
            FROM pg_catalog.jsonb_array_elements(v_inventory_collection) AS item(value)
            WHERE item.value ->> 'id' = backup_item.value ->> 'id'
              AND item.value ->> 'backupSha256' = security.journal_inventory_sha256(
                security.journal_inventory_security_projection(
                  CASE v_field
                    WHEN 'journalEntries' THEN 'entry-backup'
                    WHEN 'journalPhotos' THEN 'photo-backup'
                    WHEN 'journalAudio' THEN 'audio-backup'
                    WHEN 'journalSpaces' THEN 'space-backup'
                    ELSE 'capture-backup'
                  END,
                  backup_item.value
                )
              )
          )
      )
      OR (
        v_inventory_field IN ('spaces', 'captures')
        AND pg_catalog.jsonb_array_length(v_collection)
          <> pg_catalog.jsonb_array_length(v_inventory_collection)
      )
    THEN
      RETURN false;
    END IF;
  END LOOP;

  RETURN true;
EXCEPTION
  WHEN numeric_value_out_of_range OR invalid_text_representation THEN
    RETURN false;
END;
$$;

REVOKE ALL ON FUNCTION security.journal_removal_inventory_covers(uuid, bigint, jsonb)
  FROM PUBLIC, anon, authenticated, service_role;

CREATE OR REPLACE FUNCTION security.journal_removal_inventory_without_revisions(
  p_inventory jsonb
)
RETURNS jsonb
LANGUAGE plpgsql
IMMUTABLE
SECURITY INVOKER
SET search_path = ''
AS $$
DECLARE
  v_result jsonb := p_inventory;
  v_field text;
  v_items jsonb;
BEGIN
  IF p_inventory IS NULL OR pg_catalog.jsonb_typeof(p_inventory) <> 'object' THEN
    RETURN NULL;
  END IF;
  FOREACH v_field IN ARRAY ARRAY['entries', 'photos', 'audios'] LOOP
    SELECT COALESCE(
      pg_catalog.jsonb_agg(item.value - 'rowRevision' ORDER BY item.ordinality),
      '[]'::jsonb
    )
    INTO v_items
    FROM pg_catalog.jsonb_array_elements(p_inventory -> v_field)
      WITH ORDINALITY AS item(value, ordinality);
    v_result := pg_catalog.jsonb_set(v_result, ARRAY[v_field], v_items, false);
  END LOOP;
  RETURN v_result;
END;
$$;

REVOKE ALL ON FUNCTION security.journal_removal_inventory_without_revisions(jsonb)
  FROM PUBLIC, anon, authenticated, service_role;

CREATE OR REPLACE FUNCTION security.journal_removal_inventory_with_revisions(
  p_owner_id uuid,
  p_inventory jsonb
)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_result jsonb := p_inventory;
  v_items jsonb;
BEGIN
  SELECT COALESCE(
    pg_catalog.jsonb_agg(
      item.value || pg_catalog.jsonb_build_object('rowRevision', entries.row_revision)
      ORDER BY item.ordinality
    ),
    '[]'::jsonb
  )
  INTO v_items
  FROM pg_catalog.jsonb_array_elements(p_inventory -> 'entries')
    WITH ORDINALITY AS item(value, ordinality)
  JOIN public.journal_entries AS entries
    ON entries.user_id = p_owner_id AND entries.id = item.value ->> 'id';
  v_result := pg_catalog.jsonb_set(v_result, ARRAY['entries'], v_items, false);

  SELECT COALESCE(
    pg_catalog.jsonb_agg(
      item.value || pg_catalog.jsonb_build_object('rowRevision', photos.row_revision)
      ORDER BY item.ordinality
    ),
    '[]'::jsonb
  )
  INTO v_items
  FROM pg_catalog.jsonb_array_elements(p_inventory -> 'photos')
    WITH ORDINALITY AS item(value, ordinality)
  JOIN public.journal_photos AS photos
    ON photos.user_id = p_owner_id AND photos.id = item.value ->> 'id';
  v_result := pg_catalog.jsonb_set(v_result, ARRAY['photos'], v_items, false);

  SELECT COALESCE(
    pg_catalog.jsonb_agg(
      item.value || pg_catalog.jsonb_build_object('rowRevision', audio.row_revision)
      ORDER BY item.ordinality
    ),
    '[]'::jsonb
  )
  INTO v_items
  FROM pg_catalog.jsonb_array_elements(p_inventory -> 'audios')
    WITH ORDINALITY AS item(value, ordinality)
  JOIN public.journal_audio AS audio
    ON audio.user_id = p_owner_id AND audio.id = item.value ->> 'id';
  v_result := pg_catalog.jsonb_set(v_result, ARRAY['audios'], v_items, false);

  RETURN v_result;
END;
$$;

REVOKE ALL ON FUNCTION security.journal_removal_inventory_with_revisions(uuid, jsonb)
  FROM PUBLIC, anon, authenticated, service_role;

CREATE OR REPLACE FUNCTION public.begin_journal_password_removal(
  p_expected_vault_revision bigint,
  p_operation_revision text,
  p_inventory jsonb
)
RETURNS text
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_user_id uuid := (SELECT auth.uid());
  v_state public.journal_security_states%ROWTYPE;
  v_remote_revision bigint;
  v_state_found boolean := false;
  v_vault_found boolean := false;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Authentication required' USING ERRCODE = '42501';
  END IF;

  IF p_expected_vault_revision IS NULL
    OR p_expected_vault_revision < 0
    OR p_expected_vault_revision > 9007199254740991
    OR p_operation_revision IS NULL
    OR length(p_operation_revision) NOT BETWEEN 3 AND 128
    OR p_operation_revision !~ '^[0-9]+:[a-z0-9]+$'
  THEN
    RETURN 'stale';
  END IF;

  PERFORM security.assert_journal_owner_active(v_user_id);

  SELECT state_row.*
  INTO v_state
  FROM public.journal_security_states AS state_row
  WHERE state_row.user_id = v_user_id
  FOR UPDATE;
  v_state_found := FOUND;

  IF v_state_found
    AND v_state.protection_state = 'unprotected'
    AND v_state.vault_revision = p_expected_vault_revision
    AND v_state.removal_operation_revision = p_operation_revision
  THEN
    RETURN 'complete';
  END IF;

  SELECT security.read_journal_vault_revision(settings.value)
  INTO v_remote_revision
  FROM public.user_settings AS settings
  WHERE settings.user_id = v_user_id
    AND settings.key = 'journal_vault_key';
  v_vault_found := FOUND;

  IF NOT v_vault_found
    OR v_remote_revision IS DISTINCT FROM p_expected_vault_revision
  THEN
    RETURN 'stale';
  END IF;

  IF NOT v_state_found THEN
    INSERT INTO public.journal_security_states (
      user_id,
      vault_revision,
      protection_state,
      removal_operation_revision,
      updated_at
    ) VALUES (
      v_user_id,
      p_expected_vault_revision,
      'protected',
      NULL,
      now()
    )
    RETURNING * INTO v_state;
  END IF;

  IF v_remote_revision IS DISTINCT FROM p_expected_vault_revision
    OR v_state.vault_revision IS DISTINCT FROM p_expected_vault_revision
  THEN
    RETURN 'stale';
  END IF;

  IF v_state.protection_state = 'removing' THEN
    IF v_state.removal_operation_revision IS DISTINCT FROM p_operation_revision THEN
      RETURN 'stale';
    END IF;

    IF security.canonical_journal_inventory_json(
      security.journal_removal_inventory_without_revisions(v_state.removal_inventory)
    )
      IS DISTINCT FROM security.canonical_journal_inventory_json(p_inventory)
    THEN
      RETURN 'inventory-mismatch';
    END IF;

    -- Preserve the exact already-created fence when its initiating session has
    -- aged out. The client must reauthenticate and resume this same operation;
    -- treating it as an unfenced attempt would orphan journal_write_mode=paused.
    IF NOT security.journal_removal_recent_auth_is_valid() THEN
      RETURN 'fresh-auth-required-existing-fence';
    END IF;

    UPDATE public.journal_security_states
    SET
      journal_write_mode = 'paused',
      updated_at = now()
    WHERE user_id = v_user_id;

    RETURN 'ready';
  END IF;

  IF v_state.protection_state <> 'protected' THEN
    RETURN 'stale';
  END IF;

  -- Account authentication is deliberately separate from local vault-key
  -- knowledge. The local decrypt preflight proves the latter; this short-lived
  -- AMR gate prevents a stale refresh-token session from creating a fence.
  IF NOT security.journal_removal_recent_auth_is_valid() THEN
    RETURN 'fresh-auth-required-no-fence';
  END IF;

  IF NOT security.journal_removal_inventory_covers(
    v_user_id,
    p_expected_vault_revision,
    p_inventory
  ) THEN
    RETURN 'coverage-mismatch';
  END IF;

  UPDATE public.journal_security_states
  SET
    protection_state = 'removing',
    removal_operation_revision = p_operation_revision,
    removal_inventory = security.journal_removal_inventory_with_revisions(
      v_user_id,
      p_inventory
    ),
    removal_previous_write_mode = journal_write_mode,
    removal_mutation_started = false,
    removal_media_reservations = '[]'::jsonb,
    removal_event_receipts = '[]'::jsonb,
    journal_write_mode = 'paused',
    updated_at = now()
  WHERE user_id = v_user_id;

  RETURN 'ready';
END;
$$;

REVOKE ALL ON FUNCTION public.begin_journal_password_removal(bigint, text, jsonb)
  FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.begin_journal_password_removal(bigint, text, jsonb)
  TO authenticated;

-- Every conversion request re-locks the exact owner/vault/operation tuple and
-- installs a transaction-local capability consumed by the row triggers. A
-- client-side preflight is not an admission token.
CREATE OR REPLACE FUNCTION private.authorize_journal_removal_operation(
  p_expected_vault_revision bigint,
  p_operation_revision text
)
RETURNS uuid
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_user_id uuid := (SELECT auth.uid());
  v_state public.journal_security_states%ROWTYPE;
  v_remote_revision bigint;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Authentication required' USING ERRCODE = '42501';
  END IF;

  PERFORM security.assert_journal_owner_active(v_user_id);

  SELECT security.read_journal_vault_revision(settings.value)
  INTO v_remote_revision
  FROM public.user_settings AS settings
  WHERE settings.user_id = v_user_id
    AND settings.key = 'journal_vault_key'
  FOR UPDATE;

  SELECT state_row.*
  INTO v_state
  FROM public.journal_security_states AS state_row
  WHERE state_row.user_id = v_user_id
  FOR UPDATE;

  IF NOT FOUND
    OR v_remote_revision IS DISTINCT FROM p_expected_vault_revision
    OR v_state.vault_revision IS DISTINCT FROM p_expected_vault_revision
    OR v_state.protection_state <> 'removing'
    OR v_state.journal_write_mode <> 'paused'
    OR v_state.removal_operation_revision IS DISTINCT FROM p_operation_revision
    OR pg_catalog.jsonb_typeof(v_state.removal_inventory) IS DISTINCT FROM 'object'
  THEN
    RAISE EXCEPTION 'Journal removal operation is stale'
      USING ERRCODE = '40001';
  END IF;

  PERFORM pg_catalog.set_config(
    'zenflow.journal_removal_owner',
    v_user_id::text,
    true
  );
  PERFORM pg_catalog.set_config(
    'zenflow.journal_removal_operation',
    p_operation_revision,
    true
  );
  PERFORM pg_catalog.set_config(
    'zenflow.journal_removal_vault_revision',
    p_expected_vault_revision::text,
    true
  );

  RETURN v_user_id;
END;
$$;

REVOKE ALL ON FUNCTION private.authorize_journal_removal_operation(bigint, text)
  FROM PUBLIC, anon, authenticated, service_role;

CREATE OR REPLACE FUNCTION public.reserve_journal_password_removal_media(
  p_expected_vault_revision bigint,
  p_operation_revision text,
  p_bucket_id text,
  p_entity_id text,
  p_storage_path text,
  p_content_sha256 text,
  p_content_size bigint,
  p_mime_type text
)
RETURNS text
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_user_id uuid;
  v_inventory_field text;
  v_exact_reservation jsonb;
BEGIN
  IF p_bucket_id NOT IN ('journal-photos', 'journal-audio')
    OR p_entity_id IS NULL OR length(p_entity_id) NOT BETWEEN 1 AND 256
    OR p_storage_path IS NULL OR length(p_storage_path) NOT BETWEEN 1 AND 1024
    OR p_content_sha256 IS NULL OR p_content_sha256 !~ '^[0-9a-f]{64}$'
    OR p_content_size IS NULL OR p_content_size <= 0
    OR p_content_size > CASE p_bucket_id
      WHEN 'journal-photos' THEN 1048576
      ELSE 20971520
    END
    OR p_mime_type IS NULL OR length(p_mime_type) NOT BETWEEN 1 AND 128
    OR (storage.foldername(p_storage_path))[2] IS DISTINCT FROM 'removal'
    OR (storage.foldername(p_storage_path))[3] IS DISTINCT FROM p_operation_revision
    OR pg_catalog.split_part(storage.filename(p_storage_path), '.', 1)
      IS DISTINCT FROM p_entity_id
    OR pg_catalog.right(p_storage_path, 4) = '.bin'
    OR (
      p_bucket_id = 'journal-photos'
      AND p_mime_type NOT IN ('image/jpeg', 'image/png', 'image/webp')
    )
    OR (
      p_bucket_id = 'journal-audio'
      AND p_mime_type NOT IN (
        'audio/webm', 'audio/mp4', 'audio/ogg', 'audio/mpeg', 'audio/wav'
      )
    )
  THEN
    RETURN 'stale';
  END IF;
  v_user_id := private.authorize_journal_removal_operation(
    p_expected_vault_revision,
    p_operation_revision
  );
  v_inventory_field := CASE p_bucket_id
    WHEN 'journal-photos' THEN 'photos'
    ELSE 'audios'
  END;
  IF NOT EXISTS (
    SELECT 1
    FROM public.journal_security_states AS state_row,
      LATERAL pg_catalog.jsonb_array_elements(
        state_row.removal_inventory -> v_inventory_field
      ) AS inventory_item(value)
    WHERE state_row.user_id = v_user_id
      AND inventory_item.value ->> 'id' = p_entity_id
  ) THEN
    RETURN 'stale';
  END IF;

  IF (storage.foldername(p_storage_path))[1] IS DISTINCT FROM v_user_id::text THEN
    RETURN 'stale';
  END IF;

  v_exact_reservation := pg_catalog.jsonb_build_object(
    'bucket', p_bucket_id,
    'id', p_entity_id,
    'path', p_storage_path,
    'sha256', p_content_sha256,
    'size', p_content_size,
    'mimeType', p_mime_type
  );

  IF EXISTS (
    SELECT 1
    FROM public.journal_security_states AS state_row,
      LATERAL pg_catalog.jsonb_array_elements(
        state_row.removal_media_reservations
      ) AS reservation(value)
    WHERE state_row.user_id = v_user_id
      AND (
        (
          reservation.value ->> 'bucket' = p_bucket_id
          AND reservation.value ->> 'id' = p_entity_id
        )
        OR (
          reservation.value ->> 'bucket' = p_bucket_id
          AND reservation.value ->> 'path' = p_storage_path
        )
      )
      AND reservation.value IS DISTINCT FROM v_exact_reservation
  ) THEN
    RETURN 'stale';
  END IF;

  -- A retry after upload is accepted only for the exact reserved object
  -- metadata. The storage service records actual byte size separately.
  IF EXISTS (
    SELECT 1
    FROM storage.objects AS object_row
    WHERE object_row.bucket_id = p_bucket_id
      AND object_row.name = p_storage_path
      AND (
        object_row.user_metadata ->> 'zenflowSha256' IS DISTINCT FROM p_content_sha256
        OR object_row.user_metadata ->> 'zenflowEntityId' IS DISTINCT FROM p_entity_id
        OR object_row.user_metadata ->> 'zenflowOperationRevision'
          IS DISTINCT FROM p_operation_revision
        OR object_row.user_metadata ->> 'zenflowMimeType' IS DISTINCT FROM p_mime_type
        OR object_row.metadata ->> 'mimetype' IS DISTINCT FROM p_mime_type
        OR COALESCE(object_row.metadata ->> 'size', '')
          IS DISTINCT FROM p_content_size::text
      )
  ) THEN
    RETURN 'stale';
  END IF;

  UPDATE public.journal_security_states
  SET
    removal_mutation_started = true,
    removal_media_reservations = CASE
      WHEN EXISTS (
        SELECT 1
        FROM pg_catalog.jsonb_array_elements(removal_media_reservations)
          AS reservation(value)
        WHERE reservation.value IS NOT DISTINCT FROM v_exact_reservation
      ) THEN removal_media_reservations
      ELSE removal_media_reservations || pg_catalog.jsonb_build_array(
        v_exact_reservation
      )
    END,
    updated_at = now()
  WHERE user_id = v_user_id;
  RETURN 'reserved';
END;
$$;

REVOKE ALL ON FUNCTION public.reserve_journal_password_removal_media(
  bigint, text, text, text, text, text, bigint, text
) FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.reserve_journal_password_removal_media(
  bigint, text, text, text, text, text, bigint, text
) TO authenticated;

CREATE OR REPLACE FUNCTION private.journal_removal_event_receipt(
  p_owner_id uuid,
  p_operation_revision text,
  p_discriminator text,
  p_entity_type text,
  p_entity_id text,
  p_op text,
  p_payload jsonb
)
RETURNS jsonb
LANGUAGE plpgsql
IMMUTABLE
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_idempotency_key uuid;
  v_idempotency_hex text;
  v_event_payload jsonb;
  v_payload_sha256 text;
BEGIN
  IF p_owner_id IS NULL
    OR p_operation_revision IS NULL
    OR length(p_operation_revision) NOT BETWEEN 3 AND 128
    OR p_operation_revision !~ '^[0-9]+:[a-z0-9]+$'
    OR p_discriminator IS NULL
    OR length(p_discriminator) NOT BETWEEN 1 AND 512
    OR p_entity_type NOT IN ('journal', 'setting')
    OR p_entity_id IS NULL
    OR length(p_entity_id) NOT BETWEEN 1 AND 256
    OR p_op NOT IN ('upsert', 'delete')
  THEN
    RAISE EXCEPTION 'Invalid journal removal event receipt'
      USING ERRCODE = '22023';
  END IF;

  v_event_payload := CASE
    WHEN p_payload IS NULL THEN pg_catalog.jsonb_build_object(
      'removalOperationRevision', p_operation_revision
    )
    ELSE p_payload || pg_catalog.jsonb_build_object(
      'removalOperationRevision',
      p_operation_revision
    )
  END;
  v_payload_sha256 := security.journal_inventory_sha256(v_event_payload);
  v_idempotency_hex := pg_catalog.md5(
    p_owner_id::text || ':' || p_operation_revision || ':'
      || p_discriminator || ':' || p_entity_type || ':' || p_entity_id
      || ':' || p_op || ':' || v_payload_sha256
  );
  -- This is an RFC 4122 name-based MD5 UUID (version 3). Keep the deterministic
  -- 128-bit digest while setting the matching version and variant bits required
  -- by the client and the sync_events UUID contract.
  v_idempotency_key := (
    pg_catalog.substr(v_idempotency_hex, 1, 8) || '-' ||
    pg_catalog.substr(v_idempotency_hex, 9, 4) || '-3' ||
    pg_catalog.substr(v_idempotency_hex, 14, 3) || '-8' ||
    pg_catalog.substr(v_idempotency_hex, 18, 3) || '-' ||
    pg_catalog.substr(v_idempotency_hex, 21, 12)
  )::uuid;

  RETURN pg_catalog.jsonb_build_object(
    'entityType', p_entity_type,
    'entityId', p_entity_id,
    'op', p_op,
    'payload', v_event_payload,
    'deviceId', 'server:journal-password-removal',
    'idempotencyKey', v_idempotency_key,
    'payloadSha256', v_payload_sha256
  );
END;
$$;

REVOKE ALL ON FUNCTION private.journal_removal_event_receipt(
  uuid, text, text, text, text, text, jsonb
) FROM PUBLIC, anon, authenticated, service_role;

CREATE OR REPLACE FUNCTION private.record_journal_removal_event_receipt(
  p_owner_id uuid,
  p_receipt jsonb
)
RETURNS void
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_state public.journal_security_states%ROWTYPE;
  v_idempotency_key text;
  v_operation_revision text;
  v_existing jsonb;
BEGIN
  IF p_owner_id IS NULL
    OR NOT security.jsonb_object_has_exact_keys(
      p_receipt,
      ARRAY[
        'entityType', 'entityId', 'op', 'payload', 'deviceId',
        'idempotencyKey', 'payloadSha256'
      ]
    )
    OR p_receipt ->> 'idempotencyKey' !~
      '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
    OR p_receipt ->> 'payloadSha256' !~ '^[0-9a-f]{64}$'
    OR pg_catalog.jsonb_typeof(p_receipt -> 'payload') <> 'object'
  THEN
    RAISE EXCEPTION 'Invalid journal removal event receipt'
      USING ERRCODE = '22023';
  END IF;

  v_idempotency_key := p_receipt ->> 'idempotencyKey';
  v_operation_revision := p_receipt #>> ARRAY['payload', 'removalOperationRevision'];
  SELECT state_row.* INTO v_state
  FROM public.journal_security_states AS state_row
  WHERE state_row.user_id = p_owner_id
  FOR UPDATE;
  IF NOT FOUND
    OR v_state.protection_state <> 'removing'
    OR v_state.removal_operation_revision IS DISTINCT FROM v_operation_revision
    OR pg_catalog.jsonb_typeof(v_state.removal_event_receipts) <> 'array'
  THEN
    RAISE EXCEPTION 'Journal removal event state is stale'
      USING ERRCODE = '40001';
  END IF;

  SELECT receipt.value INTO v_existing
  FROM pg_catalog.jsonb_array_elements(v_state.removal_event_receipts) AS receipt(value)
  WHERE receipt.value ->> 'idempotencyKey' = v_idempotency_key;
  IF FOUND THEN
    IF v_existing IS DISTINCT FROM p_receipt THEN
      RAISE EXCEPTION 'Journal removal event receipt collision'
        USING ERRCODE = '23505';
    END IF;
    RETURN;
  END IF;
  IF pg_catalog.jsonb_array_length(v_state.removal_event_receipts) >= 20000 THEN
    RAISE EXCEPTION 'Journal removal event receipt limit exceeded'
      USING ERRCODE = '54000';
  END IF;

  UPDATE public.journal_security_states
  SET
    removal_event_receipts = removal_event_receipts ||
      pg_catalog.jsonb_build_array(p_receipt),
    removal_mutation_started = true,
    updated_at = now()
  WHERE user_id = p_owner_id;
END;
$$;

REVOKE ALL ON FUNCTION private.record_journal_removal_event_receipt(uuid, jsonb)
  FROM PUBLIC, anon, authenticated, service_role;

CREATE OR REPLACE FUNCTION private.journal_removal_refetch_event_receipt(
  p_owner_id uuid,
  p_operation_revision text,
  p_vault_revision bigint,
  p_entry_id text
)
RETURNS jsonb
LANGUAGE sql
IMMUTABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT private.journal_removal_event_receipt(
    p_owner_id,
    p_operation_revision,
    'journal-refetch:' || p_entry_id,
    'journal',
    p_entry_id,
    'upsert',
    pg_catalog.jsonb_build_object(
      'journalRemovalRefetch', true,
      'vaultRevision', p_vault_revision
    )
  )
$$;

REVOKE ALL ON FUNCTION private.journal_removal_refetch_event_receipt(
  uuid, text, bigint, text
) FROM PUBLIC, anon, authenticated, service_role;

CREATE OR REPLACE FUNCTION public.commit_journal_password_removal_entry(
  p_expected_vault_revision bigint,
  p_operation_revision text,
  p_entry jsonb
)
RETURNS jsonb
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_user_id uuid;
  v_entry public.journal_entries%ROWTYPE;
  v_current public.journal_entries%ROWTYPE;
  v_inventory_item jsonb;
  v_event_receipt jsonb;
  v_affected_rows integer;
BEGIN
  IF p_entry IS NULL OR pg_catalog.jsonb_typeof(p_entry) <> 'object' THEN
    RETURN pg_catalog.jsonb_build_object('status', 'stale');
  END IF;

  v_user_id := private.authorize_journal_removal_operation(
    p_expected_vault_revision,
    p_operation_revision
  );
  v_entry := pg_catalog.jsonb_populate_record(NULL::public.journal_entries, p_entry);

  IF v_entry.user_id IS DISTINCT FROM v_user_id
    OR v_entry.id IS NULL
    OR v_entry.content LIKE 'zenflow:journal-content:v1:%'
    OR v_entry.vault_revision IS NOT NULL
  THEN
    RETURN pg_catalog.jsonb_build_object('status', 'stale');
  END IF;

  SELECT inventory_item.value
  INTO v_inventory_item
  FROM public.journal_security_states AS state_row,
    LATERAL pg_catalog.jsonb_array_elements(
      state_row.removal_inventory -> 'entries'
    ) AS inventory_item(value)
  WHERE state_row.user_id = v_user_id
    AND inventory_item.value ->> 'id' = v_entry.id;
  IF NOT FOUND THEN
    RETURN pg_catalog.jsonb_build_object('status', 'stale');
  END IF;

  SELECT entries.* INTO v_current
  FROM public.journal_entries AS entries
  WHERE entries.user_id = v_user_id AND entries.id = v_entry.id
  FOR UPDATE;
  IF NOT FOUND THEN
    RETURN pg_catalog.jsonb_build_object('status', 'stale');
  END IF;

  v_event_receipt := private.journal_removal_refetch_event_receipt(
    v_user_id,
    p_operation_revision,
    p_expected_vault_revision,
    v_entry.id
  );

  -- Exact replay after a lost response performs no second row mutation.
  IF v_current.vault_revision IS NULL
    AND security.canonical_journal_inventory_json(
      security.journal_inventory_security_projection(
        'entry-row', pg_catalog.to_jsonb(v_current)
      )
    ) = security.canonical_journal_inventory_json(
      security.journal_inventory_security_projection(
        'entry-row', pg_catalog.to_jsonb(v_entry)
      )
    )
  THEN
    PERFORM private.record_journal_removal_event_receipt(
      v_user_id,
      v_event_receipt
    );
    RETURN pg_catalog.jsonb_build_object('status', 'committed');
  END IF;

  IF v_current.row_revision IS DISTINCT FROM (v_inventory_item ->> 'rowRevision')::bigint
    OR v_inventory_item ->> 'rowSha256' IS DISTINCT FROM
      security.journal_inventory_sha256(
        security.journal_inventory_security_projection(
          'entry-row', pg_catalog.to_jsonb(v_current)
        )
      )
  THEN
    RETURN pg_catalog.jsonb_build_object('status', 'stale');
  END IF;

  UPDATE public.journal_entries
  SET
    date = v_entry.date,
    title = v_entry.title,
    content = v_entry.content,
    stickers = v_entry.stickers,
    mood = v_entry.mood,
    tags = v_entry.tags,
    template_id = v_entry.template_id,
    habit_snapshot = v_entry.habit_snapshot,
    photo_ids = v_entry.photo_ids,
    audio_ids = v_entry.audio_ids,
    photo_layout = v_entry.photo_layout,
    bg_pattern = v_entry.bg_pattern,
    bg_intensity = v_entry.bg_intensity,
    paper_color = v_entry.paper_color,
    paper_texture = v_entry.paper_texture,
    font = v_entry.font,
    font_size = v_entry.font_size,
    ink_color = v_entry.ink_color,
    theme = v_entry.theme,
    particle_speed = v_entry.particle_speed,
    created_at = v_entry.created_at,
    updated_at = v_entry.updated_at,
    vault_revision = NULL
  WHERE user_id = v_user_id
    AND id = v_entry.id
    AND row_revision = (v_inventory_item ->> 'rowRevision')::bigint
  RETURNING * INTO v_entry;

  GET DIAGNOSTICS v_affected_rows = ROW_COUNT;
  IF v_affected_rows <> 1 THEN
    RETURN pg_catalog.jsonb_build_object('status', 'stale');
  END IF;

  PERFORM private.record_journal_removal_event_receipt(
    v_user_id,
    v_event_receipt
  );
  RETURN pg_catalog.jsonb_build_object('status', 'committed');
END;
$$;

REVOKE ALL ON FUNCTION public.commit_journal_password_removal_entry(
  bigint, text, jsonb
) FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.commit_journal_password_removal_entry(
  bigint, text, jsonb
) TO authenticated;

CREATE OR REPLACE FUNCTION public.commit_journal_password_removal_photo(
  p_expected_vault_revision bigint,
  p_operation_revision text,
  p_photo jsonb
)
RETURNS jsonb
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_user_id uuid;
  v_photo public.journal_photos%ROWTYPE;
  v_current public.journal_photos%ROWTYPE;
  v_inventory_item jsonb;
  v_reservation jsonb;
  v_event_receipt jsonb;
  v_affected_rows integer;
BEGIN
  IF p_photo IS NULL OR pg_catalog.jsonb_typeof(p_photo) <> 'object' THEN
    RETURN pg_catalog.jsonb_build_object('status', 'stale');
  END IF;
  v_user_id := private.authorize_journal_removal_operation(
    p_expected_vault_revision,
    p_operation_revision
  );
  v_photo := pg_catalog.jsonb_populate_record(NULL::public.journal_photos, p_photo);
  IF v_photo.user_id IS DISTINCT FROM v_user_id
    OR v_photo.id IS NULL
    OR v_photo.vault_revision IS NOT NULL
    OR v_photo.storage_path IS NULL
    OR (storage.foldername(v_photo.storage_path))[1] IS DISTINCT FROM v_user_id::text
    OR (storage.foldername(v_photo.storage_path))[2] IS DISTINCT FROM 'removal'
    OR (storage.foldername(v_photo.storage_path))[3]
      IS DISTINCT FROM p_operation_revision
    OR pg_catalog.right(v_photo.storage_path, 4) = '.bin'
    OR NOT EXISTS (
      SELECT 1 FROM public.journal_entries AS parent_entry
      WHERE parent_entry.id = v_photo.entry_id
        AND parent_entry.user_id = v_user_id
    )
  THEN
    RETURN pg_catalog.jsonb_build_object('status', 'stale');
  END IF;

  SELECT inventory_item.value
  INTO v_inventory_item
  FROM public.journal_security_states AS state_row,
    LATERAL pg_catalog.jsonb_array_elements(
      state_row.removal_inventory -> 'photos'
    ) AS inventory_item(value)
  WHERE state_row.user_id = v_user_id
    AND inventory_item.value ->> 'id' = v_photo.id
    AND inventory_item.value ->> 'parentId' = v_photo.entry_id;
  IF NOT FOUND THEN
    RETURN pg_catalog.jsonb_build_object('status', 'stale');
  END IF;

  SELECT photos.* INTO v_current
  FROM public.journal_photos AS photos
  WHERE photos.user_id = v_user_id AND photos.id = v_photo.id
  FOR UPDATE;
  IF NOT FOUND THEN
    RETURN pg_catalog.jsonb_build_object('status', 'stale');
  END IF;

  IF v_current.vault_revision IS NULL
    AND security.canonical_journal_inventory_json(
      security.journal_inventory_security_projection(
        'photo-row', pg_catalog.to_jsonb(v_current)
      )
    ) = security.canonical_journal_inventory_json(
      security.journal_inventory_security_projection(
        'photo-row', pg_catalog.to_jsonb(v_photo)
      )
    )
  THEN
    v_event_receipt := private.journal_removal_refetch_event_receipt(
      v_user_id,
      p_operation_revision,
      p_expected_vault_revision,
      v_photo.entry_id
    );
    PERFORM private.record_journal_removal_event_receipt(
      v_user_id,
      v_event_receipt
    );
    RETURN pg_catalog.jsonb_build_object('status', 'committed');
  END IF;

  SELECT reservation.value
  INTO v_reservation
  FROM public.journal_security_states AS state_row,
    LATERAL pg_catalog.jsonb_array_elements(
      state_row.removal_media_reservations
    ) AS reservation(value)
  WHERE state_row.user_id = v_user_id
    AND reservation.value ->> 'bucket' = 'journal-photos'
    AND reservation.value ->> 'id' = v_photo.id
    AND reservation.value ->> 'path' = v_photo.storage_path;

  IF NOT FOUND
    OR v_current.row_revision IS DISTINCT FROM (v_inventory_item ->> 'rowRevision')::bigint
    OR v_inventory_item ->> 'rowSha256' IS DISTINCT FROM
      security.journal_inventory_sha256(
        security.journal_inventory_security_projection(
          'photo-row', pg_catalog.to_jsonb(v_current)
        )
      )
    OR NOT EXISTS (
      SELECT 1
      FROM storage.objects AS object_row
      WHERE object_row.bucket_id = 'journal-photos'
        AND object_row.name = v_photo.storage_path
        AND object_row.user_metadata ->> 'zenflowSha256' = v_reservation ->> 'sha256'
        AND object_row.user_metadata ->> 'zenflowEntityId' = v_photo.id
        AND object_row.user_metadata ->> 'zenflowOperationRevision' = p_operation_revision
        AND object_row.user_metadata ->> 'zenflowMimeType' = v_reservation ->> 'mimeType'
        AND object_row.metadata ->> 'mimetype' = v_reservation ->> 'mimeType'
        AND COALESCE(object_row.metadata ->> 'size', '') = v_reservation ->> 'size'
    )
  THEN
    RETURN pg_catalog.jsonb_build_object('status', 'stale');
  END IF;

  UPDATE public.journal_photos
  SET
    entry_id = v_photo.entry_id,
    width = v_photo.width,
    height = v_photo.height,
    storage_path = v_photo.storage_path,
    storage_url = NULL,
    created_at = v_photo.created_at,
    vault_revision = NULL
  WHERE user_id = v_user_id
    AND id = v_photo.id
    AND row_revision = (v_inventory_item ->> 'rowRevision')::bigint;
  GET DIAGNOSTICS v_affected_rows = ROW_COUNT;
  IF v_affected_rows <> 1 THEN
    RETURN pg_catalog.jsonb_build_object('status', 'stale');
  END IF;
  UPDATE public.journal_security_states
  SET
    removal_media_reservations = COALESCE(
    (
      SELECT pg_catalog.jsonb_agg(reservation.value)
      FROM pg_catalog.jsonb_array_elements(removal_media_reservations)
        AS reservation(value)
      WHERE reservation.value IS DISTINCT FROM v_reservation
    ),
    '[]'::jsonb
    ),
    updated_at = now()
  WHERE user_id = v_user_id;
  v_event_receipt := private.journal_removal_refetch_event_receipt(
    v_user_id,
    p_operation_revision,
    p_expected_vault_revision,
    v_photo.entry_id
  );
  PERFORM private.record_journal_removal_event_receipt(
    v_user_id,
    v_event_receipt
  );
  RETURN pg_catalog.jsonb_build_object('status', 'committed');
END;
$$;

REVOKE ALL ON FUNCTION public.commit_journal_password_removal_photo(
  bigint, text, jsonb
) FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.commit_journal_password_removal_photo(
  bigint, text, jsonb
) TO authenticated;

CREATE OR REPLACE FUNCTION public.commit_journal_password_removal_audio(
  p_expected_vault_revision bigint,
  p_operation_revision text,
  p_audio jsonb
)
RETURNS jsonb
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_user_id uuid;
  v_audio public.journal_audio%ROWTYPE;
  v_current public.journal_audio%ROWTYPE;
  v_inventory_item jsonb;
  v_reservation jsonb;
  v_parent_entry public.journal_entries%ROWTYPE;
  v_event_receipt jsonb;
  v_affected_rows integer;
BEGIN
  IF p_audio IS NULL OR pg_catalog.jsonb_typeof(p_audio) <> 'object' THEN
    RETURN pg_catalog.jsonb_build_object('status', 'stale');
  END IF;
  v_user_id := private.authorize_journal_removal_operation(
    p_expected_vault_revision,
    p_operation_revision
  );
  v_audio := pg_catalog.jsonb_populate_record(NULL::public.journal_audio, p_audio);
  IF v_audio.user_id IS DISTINCT FROM v_user_id
    OR v_audio.id IS NULL
    OR v_audio.vault_revision IS NOT NULL
    OR v_audio.storage_path IS NULL
    OR (storage.foldername(v_audio.storage_path))[1] IS DISTINCT FROM v_user_id::text
    OR (storage.foldername(v_audio.storage_path))[2] IS DISTINCT FROM 'removal'
    OR (storage.foldername(v_audio.storage_path))[3]
      IS DISTINCT FROM p_operation_revision
    OR pg_catalog.right(v_audio.storage_path, 4) = '.bin'
    OR NOT EXISTS (
      SELECT 1 FROM public.journal_entries AS parent_entry
      WHERE parent_entry.id = v_audio.entry_id
        AND parent_entry.user_id = v_user_id
    )
  THEN
    RETURN pg_catalog.jsonb_build_object('status', 'stale');
  END IF;

  SELECT inventory_item.value
  INTO v_inventory_item
  FROM public.journal_security_states AS state_row,
    LATERAL pg_catalog.jsonb_array_elements(
      state_row.removal_inventory -> 'audios'
    ) AS inventory_item(value)
  WHERE state_row.user_id = v_user_id
    AND inventory_item.value ->> 'id' = v_audio.id
    AND inventory_item.value ->> 'parentId' = v_audio.entry_id;
  IF NOT FOUND THEN
    RETURN pg_catalog.jsonb_build_object('status', 'stale');
  END IF;

  SELECT audio.* INTO v_current
  FROM public.journal_audio AS audio
  WHERE audio.user_id = v_user_id AND audio.id = v_audio.id
  FOR UPDATE;
  IF NOT FOUND THEN
    RETURN pg_catalog.jsonb_build_object('status', 'stale');
  END IF;

  IF v_current.vault_revision IS NULL
    AND security.canonical_journal_inventory_json(
      security.journal_inventory_security_projection(
        'audio-row', pg_catalog.to_jsonb(v_current)
      )
    ) = security.canonical_journal_inventory_json(
      security.journal_inventory_security_projection(
        'audio-row', pg_catalog.to_jsonb(v_audio)
      )
    )
  THEN
    SELECT entries.* INTO v_parent_entry
    FROM public.journal_entries AS entries
    WHERE entries.user_id = v_user_id AND entries.id = v_audio.entry_id;
    IF NOT FOUND THEN
      RETURN pg_catalog.jsonb_build_object('status', 'stale');
    END IF;
    v_event_receipt := private.journal_removal_refetch_event_receipt(
      v_user_id,
      p_operation_revision,
      p_expected_vault_revision,
      v_audio.entry_id
    );
    PERFORM private.record_journal_removal_event_receipt(
      v_user_id,
      v_event_receipt
    );
    RETURN pg_catalog.jsonb_build_object('status', 'committed');
  END IF;

  SELECT reservation.value
  INTO v_reservation
  FROM public.journal_security_states AS state_row,
    LATERAL pg_catalog.jsonb_array_elements(
      state_row.removal_media_reservations
    ) AS reservation(value)
  WHERE state_row.user_id = v_user_id
    AND reservation.value ->> 'bucket' = 'journal-audio'
    AND reservation.value ->> 'id' = v_audio.id
    AND reservation.value ->> 'path' = v_audio.storage_path;

  IF NOT FOUND
    OR v_current.row_revision IS DISTINCT FROM (v_inventory_item ->> 'rowRevision')::bigint
    OR v_inventory_item ->> 'rowSha256' IS DISTINCT FROM
      security.journal_inventory_sha256(
        security.journal_inventory_security_projection(
          'audio-row', pg_catalog.to_jsonb(v_current)
        )
      )
    OR v_reservation ->> 'mimeType' IS DISTINCT FROM v_audio.mime_type
    OR NOT EXISTS (
      SELECT 1
      FROM storage.objects AS object_row
      WHERE object_row.bucket_id = 'journal-audio'
        AND object_row.name = v_audio.storage_path
        AND object_row.user_metadata ->> 'zenflowSha256' = v_reservation ->> 'sha256'
        AND object_row.user_metadata ->> 'zenflowEntityId' = v_audio.id
        AND object_row.user_metadata ->> 'zenflowOperationRevision' = p_operation_revision
        AND object_row.user_metadata ->> 'zenflowMimeType' = v_reservation ->> 'mimeType'
        AND object_row.metadata ->> 'mimetype' = v_reservation ->> 'mimeType'
        AND COALESCE(object_row.metadata ->> 'size', '') = v_reservation ->> 'size'
    )
  THEN
    RETURN pg_catalog.jsonb_build_object('status', 'stale');
  END IF;

  UPDATE public.journal_audio
  SET
    entry_id = v_audio.entry_id,
    duration = v_audio.duration,
    mime_type = v_audio.mime_type,
    storage_path = v_audio.storage_path,
    storage_url = NULL,
    created_at = v_audio.created_at,
    vault_revision = NULL
  WHERE user_id = v_user_id
    AND id = v_audio.id
    AND row_revision = (v_inventory_item ->> 'rowRevision')::bigint;

  GET DIAGNOSTICS v_affected_rows = ROW_COUNT;
  IF v_affected_rows <> 1 THEN
    RETURN pg_catalog.jsonb_build_object('status', 'stale');
  END IF;
  UPDATE public.journal_security_states
  SET
    removal_mutation_started = true,
    removal_media_reservations = COALESCE(
    (
      SELECT pg_catalog.jsonb_agg(reservation.value)
      FROM pg_catalog.jsonb_array_elements(removal_media_reservations)
        AS reservation(value)
      WHERE reservation.value IS DISTINCT FROM v_reservation
    ),
    '[]'::jsonb
    ),
    updated_at = now()
  WHERE user_id = v_user_id;

  SELECT entries.* INTO v_parent_entry
  FROM public.journal_entries AS entries
  WHERE entries.user_id = v_user_id AND entries.id = v_audio.entry_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Journal removal audio parent is stale'
      USING ERRCODE = '40001';
  END IF;
  v_event_receipt := private.journal_removal_refetch_event_receipt(
    v_user_id,
    p_operation_revision,
    p_expected_vault_revision,
    v_audio.entry_id
  );
  PERFORM private.record_journal_removal_event_receipt(
    v_user_id,
    v_event_receipt
  );
  RETURN pg_catalog.jsonb_build_object('status', 'committed');
END;
$$;

REVOKE ALL ON FUNCTION public.commit_journal_password_removal_audio(
  bigint, text, jsonb
) FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.commit_journal_password_removal_audio(
  bigint, text, jsonb
) TO authenticated;

CREATE OR REPLACE FUNCTION public.delete_journal_password_removal_artifact(
  p_expected_vault_revision bigint,
  p_operation_revision text,
  p_surface text,
  p_entity_id text,
  p_parent_entry jsonb
)
RETURNS jsonb
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_user_id uuid;
  v_inventory_field text;
  v_inventory_item jsonb;
  v_parent_entry public.journal_entries%ROWTYPE;
  v_parent_status jsonb;
  v_remote_media_owner uuid;
  v_remote_parent_id text;
  v_current_row_revision bigint;
  v_current_row_sha256 text;
  v_affected_rows integer;
  v_event_receipt jsonb;
BEGIN
  IF p_surface NOT IN ('entry', 'photo', 'audio')
    OR p_entity_id IS NULL
    OR length(p_entity_id) = 0
  THEN
    RETURN pg_catalog.jsonb_build_object('status', 'stale');
  END IF;
  v_user_id := private.authorize_journal_removal_operation(
    p_expected_vault_revision,
    p_operation_revision
  );
  v_inventory_field := CASE p_surface
    WHEN 'entry' THEN 'entries'
    WHEN 'photo' THEN 'photos'
    ELSE 'audios'
  END;
  SELECT inventory_item.value
  INTO v_inventory_item
  FROM public.journal_security_states AS state_row,
    LATERAL pg_catalog.jsonb_array_elements(
      state_row.removal_inventory -> v_inventory_field
    ) AS inventory_item(value)
  WHERE state_row.user_id = v_user_id
    AND inventory_item.value ->> 'id' = p_entity_id;
  IF NOT FOUND THEN
    RETURN pg_catalog.jsonb_build_object('status', 'stale');
  END IF;

  IF p_surface = 'entry' THEN
    IF p_parent_entry IS NOT NULL THEN
      RETURN pg_catalog.jsonb_build_object('status', 'stale');
    END IF;

    SELECT
      entries.row_revision,
      security.journal_inventory_sha256(
        security.journal_inventory_security_projection(
          'entry-row', pg_catalog.to_jsonb(entries)
        )
      )
    INTO v_current_row_revision, v_current_row_sha256
    FROM public.journal_entries AS entries
    WHERE entries.user_id = v_user_id AND entries.id = p_entity_id
    FOR UPDATE;

    v_event_receipt := private.journal_removal_event_receipt(
      v_user_id,
      p_operation_revision,
      'entry-delete',
      'journal',
      p_entity_id,
      'delete',
      NULL
    );
    IF NOT FOUND THEN
      PERFORM private.record_journal_removal_event_receipt(
        v_user_id,
        v_event_receipt
      );
      RETURN pg_catalog.jsonb_build_object('status', 'committed');
    END IF;
    IF v_current_row_revision IS DISTINCT FROM (v_inventory_item ->> 'rowRevision')::bigint
      OR v_current_row_sha256 IS DISTINCT FROM v_inventory_item ->> 'rowSha256'
    THEN
      RETURN pg_catalog.jsonb_build_object('status', 'stale');
    END IF;

    DELETE FROM public.journal_entries
    WHERE user_id = v_user_id
      AND id = p_entity_id
      AND row_revision = (v_inventory_item ->> 'rowRevision')::bigint;
    GET DIAGNOSTICS v_affected_rows = ROW_COUNT;
    IF v_affected_rows <> 1 THEN
      RETURN pg_catalog.jsonb_build_object('status', 'stale');
    END IF;
    PERFORM private.record_journal_removal_event_receipt(
      v_user_id,
      v_event_receipt
    );
    RETURN pg_catalog.jsonb_build_object('status', 'committed');
  END IF;

  IF p_parent_entry IS NULL OR pg_catalog.jsonb_typeof(p_parent_entry) <> 'object' THEN
    RETURN pg_catalog.jsonb_build_object('status', 'stale');
  END IF;
  v_parent_entry := pg_catalog.jsonb_populate_record(
    NULL::public.journal_entries,
    p_parent_entry
  );
  IF v_parent_entry.user_id IS DISTINCT FROM v_user_id
    OR v_parent_entry.id IS NULL
    OR v_inventory_item ->> 'parentId' IS DISTINCT FROM v_parent_entry.id
  THEN
    RETURN pg_catalog.jsonb_build_object('status', 'stale');
  END IF;

  IF EXISTS (
    SELECT 1
    FROM public.journal_security_states AS state_row,
      LATERAL pg_catalog.jsonb_array_elements(state_row.removal_media_reservations)
        AS reservation(value)
    WHERE state_row.user_id = v_user_id
      AND reservation.value ->> 'bucket' = CASE p_surface
        WHEN 'photo' THEN 'journal-photos'
        ELSE 'journal-audio'
      END
      AND reservation.value ->> 'id' = p_entity_id
  )
  THEN
    RETURN pg_catalog.jsonb_build_object('status', 'stale');
  END IF;

  IF p_surface = 'photo' THEN
    SELECT
      photos.user_id,
      photos.entry_id,
      photos.row_revision,
      security.journal_inventory_sha256(
        security.journal_inventory_security_projection(
          'photo-row', pg_catalog.to_jsonb(photos)
        )
      )
    INTO v_remote_media_owner, v_remote_parent_id,
      v_current_row_revision, v_current_row_sha256
    FROM public.journal_photos AS photos
    WHERE photos.id = p_entity_id
    FOR UPDATE;
    IF FOUND AND (
      v_remote_media_owner IS DISTINCT FROM v_user_id
      OR v_remote_parent_id IS DISTINCT FROM v_parent_entry.id
      OR v_current_row_revision IS DISTINCT FROM (v_inventory_item ->> 'rowRevision')::bigint
      OR v_current_row_sha256 IS DISTINCT FROM v_inventory_item ->> 'rowSha256'
    ) THEN
      RETURN pg_catalog.jsonb_build_object('status', 'stale');
    END IF;
  ELSE
    SELECT
      audio.user_id,
      audio.entry_id,
      audio.row_revision,
      security.journal_inventory_sha256(
        security.journal_inventory_security_projection(
          'audio-row', pg_catalog.to_jsonb(audio)
        )
      )
    INTO v_remote_media_owner, v_remote_parent_id,
      v_current_row_revision, v_current_row_sha256
    FROM public.journal_audio AS audio
    WHERE audio.id = p_entity_id
    FOR UPDATE;
    IF FOUND AND (
      v_remote_media_owner IS DISTINCT FROM v_user_id
      OR v_remote_parent_id IS DISTINCT FROM v_parent_entry.id
      OR v_current_row_revision IS DISTINCT FROM (v_inventory_item ->> 'rowRevision')::bigint
      OR v_current_row_sha256 IS DISTINCT FROM v_inventory_item ->> 'rowSha256'
    ) THEN
      RETURN pg_catalog.jsonb_build_object('status', 'stale');
    END IF;
  END IF;

  IF p_surface = 'photo' THEN
    DELETE FROM public.journal_photos
    WHERE user_id = v_user_id
      AND id = p_entity_id
      AND row_revision = (v_inventory_item ->> 'rowRevision')::bigint;
  ELSE
    DELETE FROM public.journal_audio
    WHERE user_id = v_user_id
      AND id = p_entity_id
      AND row_revision = (v_inventory_item ->> 'rowRevision')::bigint;
  END IF;
  GET DIAGNOSTICS v_affected_rows = ROW_COUNT;
  -- Zero is the exact replay case after the prior delete committed.
  IF v_affected_rows NOT IN (0, 1) THEN
    RETURN pg_catalog.jsonb_build_object('status', 'stale');
  END IF;

  v_parent_status := public.commit_journal_password_removal_entry(
    p_expected_vault_revision,
    p_operation_revision,
    p_parent_entry
  );
  IF v_parent_status ->> 'status' <> 'committed' THEN
    RAISE EXCEPTION 'Journal removal parent commit is stale'
      USING ERRCODE = '40001';
  END IF;
  UPDATE public.journal_security_states
  SET removal_mutation_started = true, updated_at = now()
  WHERE user_id = v_user_id;
  RETURN v_parent_status;
END;
$$;

REVOKE ALL ON FUNCTION public.delete_journal_password_removal_artifact(
  bigint, text, text, text, jsonb
) FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.delete_journal_password_removal_artifact(
  bigint, text, text, text, jsonb
) TO authenticated;

CREATE OR REPLACE FUNCTION security.journal_backup_non_journal_projection(
  p_payload jsonb
)
RETURNS jsonb
LANGUAGE plpgsql
IMMUTABLE
SECURITY INVOKER
SET search_path = ''
AS $$
DECLARE
  v_data jsonb;
BEGIN
  IF p_payload IS NULL
    OR pg_catalog.jsonb_typeof(p_payload) <> 'object'
    OR pg_catalog.jsonb_typeof(p_payload -> 'data') <> 'object'
  THEN
    RETURN NULL;
  END IF;
  v_data := (p_payload -> 'data')
    - 'journalEntries'
    - 'journalPhotos'
    - 'journalAudio'
    - 'journalSpaces'
    - 'journalSpaceCaptures';
  RETURN pg_catalog.jsonb_set(p_payload, ARRAY['data'], v_data, false);
END;
$$;

REVOKE ALL ON FUNCTION security.journal_backup_non_journal_projection(jsonb)
  FROM PUBLIC, anon, authenticated, service_role;

CREATE OR REPLACE FUNCTION public.commit_journal_password_removal_backup(
  p_expected_vault_revision bigint,
  p_operation_revision text,
  p_journal_patch jsonb,
  p_deleted_inventory jsonb
)
RETURNS jsonb
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_user_id uuid;
  v_current_payload jsonb;
  v_current_vault_revision bigint;
  v_next_payload jsonb;
  v_non_journal_sha256 text;
  v_next_non_journal_sha256 text;
  v_state public.journal_security_states%ROWTYPE;
  v_deleted_field text;
  v_inventory_field text;
  v_backup_field text;
  v_projection_kind text;
  v_affected_rows integer;
BEGIN
  IF p_journal_patch IS NULL
    OR NOT security.jsonb_object_has_exact_keys(
      p_journal_patch,
      ARRAY[
        'journalEntries', 'journalPhotos', 'journalAudio',
        'journalSpaces', 'journalSpaceCaptures'
      ]
    )
    OR p_deleted_inventory IS NULL
    OR NOT security.jsonb_object_has_exact_keys(
      p_deleted_inventory,
      ARRAY['entryIds', 'photoIds', 'audioIds']
    )
  THEN
    RETURN pg_catalog.jsonb_build_object('status', 'stale');
  END IF;
  v_user_id := private.authorize_journal_removal_operation(
    p_expected_vault_revision,
    p_operation_revision
  );
  SELECT state_row.* INTO v_state
  FROM public.journal_security_states AS state_row
  WHERE state_row.user_id = v_user_id;

  FOREACH v_deleted_field IN ARRAY ARRAY[
    'entryIds', 'photoIds', 'audioIds'
  ] LOOP
    v_inventory_field := CASE v_deleted_field
      WHEN 'entryIds' THEN 'entries'
      WHEN 'photoIds' THEN 'photos'
      ELSE 'audios'
    END;
    IF pg_catalog.jsonb_typeof(p_deleted_inventory -> v_deleted_field)
      IS DISTINCT FROM 'array'
      OR EXISTS (
        SELECT 1 FROM (
          SELECT COUNT(*) AS total, COUNT(DISTINCT deleted_item.id) AS unique_total
          FROM pg_catalog.jsonb_array_elements_text(
            p_deleted_inventory -> v_deleted_field
          ) AS deleted_item(id)
        ) AS counts WHERE counts.total <> counts.unique_total
      )
      OR EXISTS (
        SELECT 1
        FROM pg_catalog.jsonb_array_elements_text(
          p_deleted_inventory -> v_deleted_field
        ) AS deleted_item(id)
        WHERE NOT EXISTS (
          SELECT 1
          FROM pg_catalog.jsonb_array_elements(
            v_state.removal_inventory -> v_inventory_field
          ) AS inventory_item(value)
          WHERE inventory_item.value ->> 'id' = deleted_item.id
        )
      )
    THEN
      RETURN pg_catalog.jsonb_build_object('status', 'stale');
    END IF;
  END LOOP;

  SELECT backups.payload, backups.vault_revision
  INTO v_current_payload, v_current_vault_revision
  FROM public.user_backups AS backups
  WHERE backups.user_id = v_user_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN pg_catalog.jsonb_build_object('status', 'committed');
  END IF;

  v_next_payload := v_current_payload;
  v_non_journal_sha256 := security.journal_inventory_sha256(
    security.journal_backup_non_journal_projection(v_current_payload)
  );

  FOREACH v_backup_field IN ARRAY ARRAY[
    'journalEntries', 'journalPhotos', 'journalAudio',
    'journalSpaces', 'journalSpaceCaptures'
  ] LOOP
    v_deleted_field := CASE v_backup_field
      WHEN 'journalEntries' THEN 'entryIds'
      WHEN 'journalPhotos' THEN 'photoIds'
      WHEN 'journalAudio' THEN 'audioIds'
      ELSE NULL
    END;
    v_inventory_field := CASE v_backup_field
      WHEN 'journalEntries' THEN 'entries'
      WHEN 'journalPhotos' THEN 'photos'
      WHEN 'journalAudio' THEN 'audios'
      WHEN 'journalSpaces' THEN 'spaces'
      ELSE 'captures'
    END;
    v_projection_kind := CASE v_backup_field
      WHEN 'journalEntries' THEN 'entry-backup'
      WHEN 'journalPhotos' THEN 'photo-backup'
      WHEN 'journalAudio' THEN 'audio-backup'
      WHEN 'journalSpaces' THEN 'space-backup'
      ELSE 'capture-backup'
    END;
    IF pg_catalog.jsonb_typeof(p_journal_patch -> v_backup_field)
      IS DISTINCT FROM 'array'
      OR EXISTS (
        SELECT 1 FROM (
          SELECT COUNT(*) AS total, COUNT(DISTINCT next_item.value ->> 'id') AS unique_total
          FROM pg_catalog.jsonb_array_elements(p_journal_patch -> v_backup_field)
            AS next_item(value)
        ) AS counts WHERE counts.total <> counts.unique_total
      )
      OR (
        v_current_vault_revision IS NOT NULL
        AND EXISTS (
        SELECT 1
        FROM pg_catalog.jsonb_array_elements(
          COALESCE(v_current_payload #> ARRAY['data', v_backup_field], '[]'::jsonb)
        ) AS current_item(value)
        WHERE NOT EXISTS (
          SELECT 1
          FROM pg_catalog.jsonb_array_elements(
            v_state.removal_inventory -> v_inventory_field
          ) AS inventory_item(value)
          WHERE inventory_item.value ->> 'id' = current_item.value ->> 'id'
            AND inventory_item.value ->> 'backupSha256' =
              security.journal_inventory_sha256(
                security.journal_inventory_security_projection(
                  v_projection_kind,
                  current_item.value
                )
              )
        )
      )
      )
      OR EXISTS (
        SELECT 1
        FROM pg_catalog.jsonb_array_elements(p_journal_patch -> v_backup_field)
          AS next_item(value)
        WHERE pg_catalog.jsonb_typeof(next_item.value) <> 'object'
          OR length(COALESCE(next_item.value ->> 'id', '')) NOT BETWEEN 1 AND 256
          OR NOT EXISTS (
            SELECT 1
            FROM pg_catalog.jsonb_array_elements(
              v_state.removal_inventory -> v_inventory_field
            ) AS inventory_item(value)
            WHERE inventory_item.value ->> 'id' = next_item.value ->> 'id'
              AND inventory_item.value ->> 'postimageBackupSha256' ~ '^[0-9a-f]{64}$'
              AND inventory_item.value ->> 'postimageBackupSha256' =
                security.journal_inventory_sha256(
                  security.journal_inventory_security_projection(
                    v_projection_kind,
                    next_item.value
                  )
                )
          )
          OR NOT EXISTS (
            SELECT 1
            FROM pg_catalog.jsonb_array_elements(
              COALESCE(v_current_payload #> ARRAY['data', v_backup_field], '[]'::jsonb)
            ) AS current_item(value)
            WHERE current_item.value ->> 'id' = next_item.value ->> 'id'
          )
      )
      OR EXISTS (
        SELECT 1
        FROM pg_catalog.jsonb_array_elements(
          COALESCE(v_current_payload #> ARRAY['data', v_backup_field], '[]'::jsonb)
        ) AS current_item(value)
        WHERE NOT EXISTS (
          SELECT 1
          FROM pg_catalog.jsonb_array_elements(p_journal_patch -> v_backup_field)
            AS next_item(value)
          WHERE next_item.value ->> 'id' = current_item.value ->> 'id'
        )
        AND (
          v_deleted_field IS NULL
          OR NOT (p_deleted_inventory -> v_deleted_field)
            ? (current_item.value ->> 'id')
        )
      )
    THEN
      RETURN pg_catalog.jsonb_build_object('status', 'stale');
    END IF;
    v_next_payload := pg_catalog.jsonb_set(
      v_next_payload,
      ARRAY['data', v_backup_field],
      p_journal_patch -> v_backup_field,
      false
    );
  END LOOP;

  IF NOT security.validate_journal_backup_vault_epoch(v_next_payload, NULL) THEN
    RETURN pg_catalog.jsonb_build_object('status', 'stale');
  END IF;
  v_next_non_journal_sha256 := security.journal_inventory_sha256(
    security.journal_backup_non_journal_projection(v_next_payload)
  );
  IF v_next_non_journal_sha256 IS DISTINCT FROM v_non_journal_sha256 THEN
    RETURN pg_catalog.jsonb_build_object('status', 'stale');
  END IF;

  IF v_current_vault_revision IS NULL
    AND security.canonical_journal_inventory_json(v_current_payload)
      = security.canonical_journal_inventory_json(v_next_payload)
  THEN
    RETURN pg_catalog.jsonb_build_object('status', 'committed');
  END IF;
  IF v_current_vault_revision IS DISTINCT FROM p_expected_vault_revision
    OR NOT security.validate_journal_backup_vault_epoch(
      v_current_payload,
      p_expected_vault_revision
    )
  THEN
    RETURN pg_catalog.jsonb_build_object('status', 'stale');
  END IF;

  UPDATE public.user_backups
  SET
    payload = v_next_payload,
    updated_at = now(),
    vault_revision = NULL
  WHERE user_id = v_user_id
    AND vault_revision = p_expected_vault_revision;
  GET DIAGNOSTICS v_affected_rows = ROW_COUNT;
  IF v_affected_rows <> 1 THEN
    RETURN pg_catalog.jsonb_build_object('status', 'stale');
  END IF;
  UPDATE public.journal_security_states
  SET removal_mutation_started = true, updated_at = now()
  WHERE user_id = v_user_id;
  RETURN pg_catalog.jsonb_build_object('status', 'committed');
END;
$$;

REVOKE ALL ON FUNCTION public.commit_journal_password_removal_backup(
  bigint, text, jsonb, jsonb
) FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.commit_journal_password_removal_backup(
  bigint, text, jsonb, jsonb
) TO authenticated;

CREATE OR REPLACE FUNCTION public.abort_journal_password_removal(
  p_expected_vault_revision bigint,
  p_operation_revision text
)
RETURNS text
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_user_id uuid := (SELECT auth.uid());
  v_remote_revision bigint;
  v_state public.journal_security_states%ROWTYPE;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Authentication required' USING ERRCODE = '42501';
  END IF;
  PERFORM security.assert_journal_owner_active(v_user_id);
  SELECT security.read_journal_vault_revision(settings.value)
  INTO v_remote_revision
  FROM public.user_settings AS settings
  WHERE settings.user_id = v_user_id
    AND settings.key = 'journal_vault_key'
  FOR UPDATE;
  SELECT state_row.* INTO v_state
  FROM public.journal_security_states AS state_row
  WHERE state_row.user_id = v_user_id
  FOR UPDATE;
  IF FOUND
    AND v_remote_revision IS NOT DISTINCT FROM p_expected_vault_revision
    AND v_state.vault_revision IS NOT DISTINCT FROM p_expected_vault_revision
    AND v_state.protection_state = 'protected'
    AND v_state.last_aborted_removal_operation_revision = p_operation_revision
  THEN
    RETURN 'aborted';
  END IF;
  IF NOT FOUND
    OR v_remote_revision IS DISTINCT FROM p_expected_vault_revision
    OR v_state.vault_revision IS DISTINCT FROM p_expected_vault_revision
    OR v_state.protection_state <> 'removing'
    OR v_state.removal_operation_revision IS DISTINCT FROM p_operation_revision
  THEN
    RETURN 'stale';
  END IF;
  IF v_state.removal_mutation_started
    OR v_state.removal_media_reservations <> '[]'::jsonb
    OR EXISTS (
      SELECT 1
      FROM storage.objects AS object_row
      WHERE object_row.bucket_id IN ('journal-photos', 'journal-audio')
        AND (storage.foldername(object_row.name))[1] = v_user_id::text
        AND (storage.foldername(object_row.name))[2] = 'removal'
        AND (storage.foldername(object_row.name))[3] = p_operation_revision
    )
    OR EXISTS (
      SELECT 1
      FROM public.sync_events AS event_row
      WHERE event_row.user_id = v_user_id
        AND event_row.device_id LIKE 'server:journal-password-removal%'
        AND event_row.payload ->> 'removalOperationRevision' = p_operation_revision
    )
  THEN
    RETURN 'mutation-started';
  END IF;
  IF NOT security.journal_removal_inventory_covers(
    v_user_id,
    p_expected_vault_revision,
    v_state.removal_inventory
  ) THEN
    RETURN 'mutation-started';
  END IF;
  UPDATE public.journal_security_states
  SET
    protection_state = 'protected',
    removal_operation_revision = NULL,
    last_aborted_removal_operation_revision = p_operation_revision,
    removal_inventory = NULL,
    removal_mutation_started = false,
    removal_media_reservations = '[]'::jsonb,
    removal_event_receipts = '[]'::jsonb,
    journal_write_mode = removal_previous_write_mode,
    removal_previous_write_mode = NULL,
    updated_at = now()
  WHERE user_id = v_user_id;
  RETURN 'aborted';
END;
$$;

REVOKE ALL ON FUNCTION public.abort_journal_password_removal(bigint, text)
  FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.abort_journal_password_removal(bigint, text)
  TO authenticated;

CREATE OR REPLACE FUNCTION security.journal_removal_has_protected_data(
  p_owner_id uuid
)
RETURNS boolean
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_backup_payload jsonb;
  v_backup_vault_revision bigint;
BEGIN
  IF EXISTS (
    SELECT 1
    FROM public.journal_entries AS entries
    WHERE entries.user_id = p_owner_id
      AND (
        entries.content LIKE 'zenflow:journal-content:v1:%'
        OR entries.vault_revision IS NOT NULL
      )
  ) OR EXISTS (
    SELECT 1
    FROM public.journal_photos AS photos
    WHERE photos.user_id = p_owner_id
      AND (
        (
          photos.storage_path IS NOT NULL
          AND pg_catalog.right(photos.storage_path, 4) = '.bin'
        )
        OR photos.vault_revision IS NOT NULL
      )
  ) OR EXISTS (
    SELECT 1
    FROM public.journal_audio AS audio
    WHERE audio.user_id = p_owner_id
      AND (
        (
          audio.storage_path IS NOT NULL
          AND pg_catalog.right(audio.storage_path, 4) = '.bin'
        )
        OR audio.vault_revision IS NOT NULL
      )
  ) OR EXISTS (
    SELECT 1
    FROM storage.objects AS objects
    WHERE objects.bucket_id IN ('journal-photos', 'journal-audio')
      AND (storage.foldername(objects.name))[1] = p_owner_id::text
      AND pg_catalog.right(objects.name, 4) = '.bin'
  ) THEN
    RETURN true;
  END IF;

  SELECT backups.payload, backups.vault_revision
  INTO v_backup_payload, v_backup_vault_revision
  FROM public.user_backups AS backups
  WHERE backups.user_id = p_owner_id;

  IF NOT FOUND THEN
    RETURN false;
  END IF;

  RETURN v_backup_vault_revision IS NOT NULL
    OR NOT security.validate_journal_backup_vault_epoch(
      v_backup_payload,
      NULL
    );
END;
$$;

REVOKE ALL ON FUNCTION security.journal_removal_has_protected_data(uuid)
  FROM PUBLIC, anon, authenticated, service_role;

-- Vault deletion returns a deterministic receipt. The authenticated client
-- persists that exact receipt through the normal event writer; the database
-- never fabricates user sync rows under definer privileges.

CREATE OR REPLACE FUNCTION public.recover_journal_password_removal()
RETURNS jsonb
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_user_id uuid := (SELECT auth.uid());
  v_state public.journal_security_states%ROWTYPE;
  v_remote_revision bigint;
  v_deleted_rows integer;
  v_event_receipt jsonb;
  v_event_receipts jsonb;
  v_orphan_objects jsonb;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Authentication required' USING ERRCODE = '42501';
  END IF;

  PERFORM security.assert_journal_owner_active(v_user_id);

  SELECT security.read_journal_vault_revision(settings.value)
  INTO v_remote_revision
  FROM public.user_settings AS settings
  WHERE settings.user_id = v_user_id
    AND settings.key = 'journal_vault_key'
  FOR UPDATE;

  SELECT state_row.*
  INTO v_state
  FROM public.journal_security_states AS state_row
  WHERE state_row.user_id = v_user_id
  FOR UPDATE;

  IF NOT FOUND OR v_state.protection_state = 'protected' THEN
    RETURN pg_catalog.jsonb_build_object('status', 'not-pending');
  END IF;

  IF v_state.protection_state = 'unprotected' THEN
    v_event_receipt := private.journal_removal_event_receipt(
      v_user_id,
      v_state.removal_operation_revision,
      'journal_vault_key:delete',
      'setting',
      'journal_vault_key',
      'delete',
      pg_catalog.jsonb_build_object(
        'key', 'journal_vault_key',
        'operationRevision', v_state.removal_operation_revision,
        'vaultRevision', v_state.vault_revision
      )
    );
    v_event_receipts := pg_catalog.jsonb_build_array(v_event_receipt) ||
      v_state.removal_event_receipts;

    RETURN pg_catalog.jsonb_build_object(
      'status', 'complete',
      'operationRevision', v_state.removal_operation_revision,
      'vaultRevision', v_state.vault_revision,
      'eventReceipts', v_event_receipts
    );
  END IF;

  UPDATE public.journal_security_states
  SET
    journal_write_mode = 'paused',
    updated_at = now()
  WHERE user_id = v_user_id;

  SELECT COALESCE(
    pg_catalog.jsonb_agg(
      pg_catalog.jsonb_build_object(
        'bucket', object_row.bucket_id,
        'path', object_row.name
      )
      ORDER BY object_row.bucket_id, object_row.name
    ),
    '[]'::jsonb
  )
  INTO v_orphan_objects
  FROM storage.objects AS object_row
  WHERE object_row.bucket_id IN ('journal-photos', 'journal-audio')
    AND (storage.foldername(object_row.name))[1] = v_user_id::text
    AND (storage.foldername(object_row.name))[2] = 'removal'
    AND (storage.foldername(object_row.name))[3]
      = v_state.removal_operation_revision
    AND NOT EXISTS (
      SELECT 1 FROM public.journal_photos AS photos
      WHERE object_row.bucket_id = 'journal-photos'
        AND photos.user_id = v_user_id
        AND photos.storage_path = object_row.name
      UNION ALL
      SELECT 1 FROM public.journal_audio AS audio
      WHERE object_row.bucket_id = 'journal-audio'
        AND audio.user_id = v_user_id
        AND audio.storage_path = object_row.name
    );

  IF v_remote_revision IS NOT DISTINCT FROM v_state.vault_revision
    AND NOT v_state.removal_mutation_started
    AND v_state.removal_media_reservations = '[]'::jsonb
    AND v_orphan_objects = '[]'::jsonb
    AND NOT EXISTS (
      SELECT 1
      FROM public.sync_events AS event_row
      WHERE event_row.user_id = v_user_id
        AND event_row.device_id LIKE 'server:journal-password-removal%'
        AND event_row.payload ->> 'removalOperationRevision'
          = v_state.removal_operation_revision
    )
    AND security.journal_removal_inventory_covers(
      v_user_id,
      v_state.vault_revision,
      v_state.removal_inventory
    )
  THEN
    RETURN pg_catalog.jsonb_build_object(
      'status', 'abortable',
      'operationRevision', v_state.removal_operation_revision,
      'vaultRevision', v_state.vault_revision
    );
  END IF;

  IF v_remote_revision IS DISTINCT FROM v_state.vault_revision
    OR v_state.removal_media_reservations <> '[]'::jsonb
    OR v_orphan_objects <> '[]'::jsonb
    OR security.journal_removal_has_protected_data(v_user_id)
  THEN
    RETURN pg_catalog.jsonb_build_object(
      'status', 'manual-recovery-required',
      'operationRevision', v_state.removal_operation_revision,
      'vaultRevision', v_state.vault_revision,
      'pendingMediaCount',
        pg_catalog.jsonb_array_length(v_state.removal_media_reservations),
      'orphanObjectCount', pg_catalog.jsonb_array_length(v_orphan_objects)
    );
  END IF;

  UPDATE public.journal_security_states
  SET
    protection_state = 'unprotected',
    removal_inventory = NULL,
    removal_previous_write_mode = NULL,
    removal_mutation_started = false,
    journal_write_mode = 'legacy',
    updated_at = now()
  WHERE user_id = v_user_id;

  DELETE FROM public.user_settings
  WHERE user_id = v_user_id
    AND key = 'journal_vault_key'
    AND security.read_journal_vault_revision(value) = v_state.vault_revision;

  GET DIAGNOSTICS v_deleted_rows = ROW_COUNT;
  IF v_deleted_rows <> 1 THEN
    RAISE EXCEPTION 'Journal vault changed during recovery'
      USING ERRCODE = '40001';
  END IF;

  v_event_receipt := private.journal_removal_event_receipt(
    v_user_id,
    v_state.removal_operation_revision,
    'journal_vault_key:delete',
    'setting',
    'journal_vault_key',
    'delete',
    pg_catalog.jsonb_build_object(
      'key', 'journal_vault_key',
      'operationRevision', v_state.removal_operation_revision,
      'vaultRevision', v_state.vault_revision
    )
  );
  v_event_receipts := pg_catalog.jsonb_build_array(v_event_receipt) ||
    v_state.removal_event_receipts;

  RETURN pg_catalog.jsonb_build_object(
    'status', 'complete',
    'operationRevision', v_state.removal_operation_revision,
    'vaultRevision', v_state.vault_revision,
    'eventReceipts', v_event_receipts
  );
END;
$$;

REVOKE ALL ON FUNCTION public.recover_journal_password_removal()
  FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.recover_journal_password_removal()
  TO authenticated;

CREATE OR REPLACE FUNCTION public.finalize_journal_password_removal(
  p_expected_vault_revision bigint,
  p_operation_revision text
)
RETURNS jsonb
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_user_id uuid := (SELECT auth.uid());
  v_state public.journal_security_states%ROWTYPE;
  v_remote_revision bigint;
  v_deleted_rows integer;
  v_backup_payload jsonb;
  v_backup_vault_revision bigint;
  v_event_receipt jsonb;
  v_event_receipts jsonb;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Authentication required' USING ERRCODE = '42501';
  END IF;

  IF p_expected_vault_revision IS NULL
    OR p_expected_vault_revision < 0
    OR p_expected_vault_revision > 9007199254740991
    OR p_operation_revision IS NULL
    OR length(p_operation_revision) NOT BETWEEN 3 AND 128
    OR p_operation_revision !~ '^[0-9]+:[a-z0-9]+$'
  THEN
    RETURN pg_catalog.jsonb_build_object('status', 'stale');
  END IF;

  PERFORM security.assert_journal_owner_active(v_user_id);

  SELECT security.read_journal_vault_revision(settings.value)
  INTO v_remote_revision
  FROM public.user_settings AS settings
  WHERE settings.user_id = v_user_id
    AND settings.key = 'journal_vault_key'
  FOR UPDATE;

  SELECT state_row.*
  INTO v_state
  FROM public.journal_security_states AS state_row
  WHERE state_row.user_id = v_user_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN pg_catalog.jsonb_build_object('status', 'stale');
  END IF;

  IF v_state.protection_state = 'unprotected'
    AND v_state.vault_revision = p_expected_vault_revision
    AND v_state.removal_operation_revision = p_operation_revision
  THEN
    v_event_receipt := private.journal_removal_event_receipt(
      v_user_id,
      p_operation_revision,
      'journal_vault_key:delete',
      'setting',
      'journal_vault_key',
      'delete',
      pg_catalog.jsonb_build_object(
        'key', 'journal_vault_key',
        'operationRevision', p_operation_revision,
        'vaultRevision', p_expected_vault_revision
      )
    );
    v_event_receipts := pg_catalog.jsonb_build_array(v_event_receipt) ||
      v_state.removal_event_receipts;
    RETURN pg_catalog.jsonb_build_object(
      'status', 'complete', 'eventReceipts', v_event_receipts
    );
  END IF;

  IF v_state.protection_state <> 'removing'
    OR v_state.vault_revision IS DISTINCT FROM p_expected_vault_revision
    OR v_state.removal_operation_revision IS DISTINCT FROM p_operation_revision
  THEN
    RETURN pg_catalog.jsonb_build_object('status', 'stale');
  END IF;

  UPDATE public.journal_security_states
  SET
    journal_write_mode = 'paused',
    updated_at = now()
  WHERE user_id = v_user_id;

  IF v_remote_revision IS DISTINCT FROM p_expected_vault_revision THEN
    RETURN pg_catalog.jsonb_build_object('status', 'stale');
  END IF;

  IF v_state.removal_media_reservations <> '[]'::jsonb THEN
    RETURN pg_catalog.jsonb_build_object(
      'status', 'media-pending',
      'mediaReservations', v_state.removal_media_reservations
    );
  END IF;

  IF EXISTS (
    SELECT 1
    FROM storage.objects AS objects
    WHERE objects.bucket_id IN ('journal-photos', 'journal-audio')
      AND (storage.foldername(objects.name))[1] = v_user_id::text
      AND (storage.foldername(objects.name))[2] = 'removal'
      AND (storage.foldername(objects.name))[3] = p_operation_revision
      AND NOT EXISTS (
        SELECT 1
        FROM public.journal_photos AS photos
        WHERE objects.bucket_id = 'journal-photos'
          AND photos.user_id = v_user_id
          AND photos.id = objects.user_metadata ->> 'zenflowEntityId'
          AND photos.storage_path = objects.name
          AND objects.user_metadata ->> 'zenflowOperationRevision'
            = p_operation_revision
          AND objects.user_metadata ->> 'zenflowSha256' ~ '^[0-9a-f]{64}$'
          AND objects.user_metadata ->> 'zenflowMimeType'
            = objects.metadata ->> 'mimetype'
        UNION ALL
        SELECT 1
        FROM public.journal_audio AS audio
        WHERE objects.bucket_id = 'journal-audio'
          AND audio.user_id = v_user_id
          AND audio.id = objects.user_metadata ->> 'zenflowEntityId'
          AND audio.storage_path = objects.name
          AND audio.mime_type = objects.metadata ->> 'mimetype'
          AND objects.user_metadata ->> 'zenflowOperationRevision'
            = p_operation_revision
          AND objects.user_metadata ->> 'zenflowSha256' ~ '^[0-9a-f]{64}$'
          AND objects.user_metadata ->> 'zenflowMimeType' = audio.mime_type
      )
  ) THEN
    RETURN pg_catalog.jsonb_build_object('status', 'media-orphan');
  END IF;

  IF EXISTS (
    SELECT 1
    FROM public.journal_entries AS entries
    WHERE entries.user_id = v_user_id
      AND (
        entries.content LIKE 'zenflow:journal-content:v1:%'
        OR entries.vault_revision IS NOT NULL
      )
  ) OR EXISTS (
    SELECT 1
    FROM public.journal_photos AS photos
    WHERE photos.user_id = v_user_id
      AND (
        (
          photos.storage_path IS NOT NULL
          AND pg_catalog.right(photos.storage_path, 4) = '.bin'
        )
        OR photos.vault_revision IS NOT NULL
      )
  ) OR EXISTS (
    SELECT 1
    FROM public.journal_audio AS audio
    WHERE audio.user_id = v_user_id
      AND (
        (
          audio.storage_path IS NOT NULL
          AND pg_catalog.right(audio.storage_path, 4) = '.bin'
        )
        OR audio.vault_revision IS NOT NULL
      )
  ) OR EXISTS (
    SELECT 1
    FROM storage.objects AS objects
    WHERE objects.bucket_id IN ('journal-photos', 'journal-audio')
      AND (storage.foldername(objects.name))[1] = v_user_id::text
      AND pg_catalog.right(objects.name, 4) = '.bin'
  ) THEN
    RETURN pg_catalog.jsonb_build_object('status', 'protected-data');
  END IF;

  SELECT backups.payload, backups.vault_revision
  INTO v_backup_payload, v_backup_vault_revision
  FROM public.user_backups AS backups
  WHERE backups.user_id = v_user_id;

  IF FOUND
    AND (
      v_backup_vault_revision IS NOT NULL
      OR NOT security.validate_journal_backup_vault_epoch(
        v_backup_payload,
        NULL
      )
    )
  THEN
    RETURN pg_catalog.jsonb_build_object('status', 'protected-data');
  END IF;

  UPDATE public.journal_security_states
  SET
    protection_state = 'unprotected',
    removal_operation_revision = p_operation_revision,
    removal_inventory = NULL,
    removal_previous_write_mode = NULL,
    removal_mutation_started = false,
    journal_write_mode = 'legacy',
    updated_at = now()
  WHERE user_id = v_user_id;

  DELETE FROM public.user_settings
  WHERE user_id = v_user_id
    AND key = 'journal_vault_key'
    AND security.read_journal_vault_revision(value) = p_expected_vault_revision;

  GET DIAGNOSTICS v_deleted_rows = ROW_COUNT;
  IF v_deleted_rows <> 1 THEN
    RAISE EXCEPTION 'Journal vault changed during finalization'
      USING ERRCODE = '40001';
  END IF;

  v_event_receipt := private.journal_removal_event_receipt(
    v_user_id,
    p_operation_revision,
    'journal_vault_key:delete',
    'setting',
    'journal_vault_key',
    'delete',
    pg_catalog.jsonb_build_object(
      'key', 'journal_vault_key',
      'operationRevision', p_operation_revision,
      'vaultRevision', p_expected_vault_revision
    )
  );
  v_event_receipts := pg_catalog.jsonb_build_array(v_event_receipt) ||
    v_state.removal_event_receipts;

  RETURN pg_catalog.jsonb_build_object(
    'status', 'complete', 'eventReceipts', v_event_receipts
  );
END;
$$;

REVOKE ALL ON FUNCTION public.finalize_journal_password_removal(bigint, text)
  FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.finalize_journal_password_removal(bigint, text)
  TO authenticated;

CREATE OR REPLACE FUNCTION public.acknowledge_journal_password_removal_events(
  p_expected_vault_revision bigint,
  p_operation_revision text
)
RETURNS text
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_user_id uuid := (SELECT auth.uid());
  v_state public.journal_security_states%ROWTYPE;
  v_vault_receipt jsonb;
  v_manifest jsonb;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Authentication required' USING ERRCODE = '42501';
  END IF;
  IF p_expected_vault_revision IS NULL
    OR p_expected_vault_revision < 0
    OR p_expected_vault_revision > 9007199254740991
    OR p_operation_revision IS NULL
    OR p_operation_revision !~ '^[0-9]+:[a-z0-9]+$'
  THEN
    RETURN 'stale';
  END IF;
  PERFORM security.assert_journal_owner_active(v_user_id);

  SELECT state_row.* INTO v_state
  FROM public.journal_security_states AS state_row
  WHERE state_row.user_id = v_user_id
  FOR UPDATE;
  IF NOT FOUND
    OR v_state.protection_state <> 'unprotected'
    OR v_state.vault_revision IS DISTINCT FROM p_expected_vault_revision
    OR v_state.removal_operation_revision IS DISTINCT FROM p_operation_revision
  THEN
    RETURN 'stale';
  END IF;

  v_vault_receipt := private.journal_removal_event_receipt(
    v_user_id,
    p_operation_revision,
    'journal_vault_key:delete',
    'setting',
    'journal_vault_key',
    'delete',
    pg_catalog.jsonb_build_object(
      'key', 'journal_vault_key',
      'operationRevision', p_operation_revision,
      'vaultRevision', p_expected_vault_revision
    )
  );
  v_manifest := pg_catalog.jsonb_build_array(v_vault_receipt) ||
    v_state.removal_event_receipts;

  IF EXISTS (
    SELECT 1
    FROM pg_catalog.jsonb_array_elements(v_manifest) AS receipt(value)
    WHERE NOT EXISTS (
      SELECT 1
      FROM public.sync_events AS event_row
      WHERE event_row.user_id = v_user_id
        AND event_row.idempotency_key =
          (receipt.value ->> 'idempotencyKey')::uuid
        AND event_row.entity_type = receipt.value ->> 'entityType'
        AND event_row.entity_id = receipt.value ->> 'entityId'
        AND event_row.op = receipt.value ->> 'op'
        AND event_row.payload IS NOT DISTINCT FROM receipt.value -> 'payload'
        AND event_row.device_id = receipt.value ->> 'deviceId'
    )
  ) THEN
    RETURN 'events-missing';
  END IF;

  UPDATE public.journal_security_states
  SET removal_event_receipts = '[]'::jsonb, updated_at = now()
  WHERE user_id = v_user_id;
  RETURN 'acknowledged';
END;
$$;

REVOKE ALL ON FUNCTION public.acknowledge_journal_password_removal_events(
  bigint, text
) FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.acknowledge_journal_password_removal_events(
  bigint, text
) TO authenticated;

-- A lost upsert response is considered an exact replay only when both the row
-- and its explicit vault epoch still match the server-authoritative state.
CREATE OR REPLACE FUNCTION public.is_journal_entry_payload_current(
  p_entry jsonb
)
RETURNS boolean
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_user_id uuid := (SELECT auth.uid());
  v_incoming public.journal_entries%ROWTYPE;
  v_state public.journal_security_states%ROWTYPE;
  v_state_found boolean := false;
  v_remote_revision bigint;
  v_is_protected boolean := false;
  v_payload_matches boolean := false;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Authentication required' USING ERRCODE = '42501';
  END IF;

  IF p_entry IS NULL OR pg_catalog.jsonb_typeof(p_entry) <> 'object' THEN
    RAISE EXCEPTION 'Journal entry payload must be an object'
      USING ERRCODE = '22023';
  END IF;

  v_incoming := pg_catalog.jsonb_populate_record(
    NULL::public.journal_entries,
    p_entry
  );
  IF v_incoming.user_id IS DISTINCT FROM v_user_id THEN
    RAISE EXCEPTION 'Journal entry owner mismatch' USING ERRCODE = '42501';
  END IF;

  v_is_protected := v_incoming.content LIKE 'zenflow:journal-content:v1:%';

  SELECT state_row.*
  INTO v_state
  FROM public.journal_security_states AS state_row
  WHERE state_row.user_id = v_user_id;
  v_state_found := FOUND;

  IF v_state_found AND v_state.journal_write_mode = 'paused' THEN
    RETURN false;
  END IF;

  IF v_is_protected THEN
    IF NOT v_state_found OR v_state.protection_state <> 'protected' THEN
      RETURN false;
    END IF;

    IF v_state.journal_write_mode = 'strict'
      AND v_incoming.vault_revision IS DISTINCT FROM v_state.vault_revision
    THEN
      RETURN false;
    END IF;

    IF v_state.journal_write_mode = 'legacy'
      AND v_incoming.vault_revision IS NOT NULL
      AND v_incoming.vault_revision IS DISTINCT FROM v_state.vault_revision
    THEN
      RETURN false;
    END IF;

    SELECT security.read_journal_vault_revision(settings.value)
    INTO v_remote_revision
    FROM public.user_settings AS settings
    WHERE settings.user_id = v_user_id
      AND settings.key = 'journal_vault_key';
    IF v_remote_revision IS DISTINCT FROM v_state.vault_revision THEN
      RETURN false;
    END IF;
  ELSIF v_incoming.vault_revision IS NOT NULL
    OR (v_state_found AND v_state.protection_state = 'protected')
  THEN
    RETURN false;
  END IF;

  SELECT pg_catalog.to_jsonb(entries) = pg_catalog.to_jsonb(v_incoming)
  INTO v_payload_matches
  FROM public.journal_entries AS entries
  WHERE entries.id = v_incoming.id
    AND entries.user_id = v_user_id;

  RETURN COALESCE(v_payload_matches, false);
END;
$$;

REVOKE EXECUTE ON FUNCTION public.is_journal_entry_payload_current(jsonb)
  FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.is_journal_entry_payload_current(jsonb)
  TO authenticated;

COMMENT ON FUNCTION public.begin_journal_password_removal(bigint, text, jsonb) IS
  'Starts or resumes the exact owner-bound journal removal epoch only when privacy-safe row, backup, and Storage freshness identities cover every protected remote object.';
COMMENT ON FUNCTION public.finalize_journal_password_removal(bigint, text) IS
  'Atomically verifies no protected journal rows, backup fields, or blobs remain before deleting the vault.';
COMMENT ON FUNCTION public.recover_journal_password_removal() IS
  'Adopts an orphan fence forward: finalizes only fully converted data or reports manual recovery without exposing journal content.';
COMMENT ON FUNCTION public.enable_journal_strict_write_fence(bigint) IS
  'Owner-scoped contract step: enables exact-epoch protected writes only after all journal rows, backup items, and Storage objects are version-bound.';

-- Final bounded vault-admission cutover. All function bodies are defined before
-- these locks are acquired. The one ordered LOCK statement prevents cross-table
-- deadlocks and holds write-blocking locks only while ten triggers are attached
-- and current vault rows are seeded; the transaction commits immediately after.
-- Writes committed before the lock are visible to the seed, and writes waiting
-- behind it pass the new trigger fences after commit.
LOCK TABLE
  public.journal_entries,
  public.journal_photos,
  public.journal_audio,
  public.user_backups,
  public.user_settings
IN SHARE ROW EXCLUSIVE MODE;

DROP TRIGGER IF EXISTS bump_journal_entry_row_revision
  ON public.journal_entries;
CREATE TRIGGER bump_journal_entry_row_revision
  BEFORE INSERT OR UPDATE ON public.journal_entries
  FOR EACH ROW
  EXECUTE FUNCTION private.bump_journal_row_revision();

DROP TRIGGER IF EXISTS bump_journal_photo_row_revision
  ON public.journal_photos;
CREATE TRIGGER bump_journal_photo_row_revision
  BEFORE INSERT OR UPDATE ON public.journal_photos
  FOR EACH ROW
  EXECUTE FUNCTION private.bump_journal_row_revision();

DROP TRIGGER IF EXISTS bump_journal_audio_row_revision
  ON public.journal_audio;
CREATE TRIGGER bump_journal_audio_row_revision
  BEFORE INSERT OR UPDATE ON public.journal_audio
  FOR EACH ROW
  EXECUTE FUNCTION private.bump_journal_row_revision();

DROP TRIGGER IF EXISTS enforce_journal_protected_write_fence
  ON public.journal_entries;
CREATE TRIGGER enforce_journal_protected_write_fence
  BEFORE INSERT OR UPDATE ON public.journal_entries
  FOR EACH ROW
  EXECUTE FUNCTION private.enforce_journal_protected_write_fence();

DROP TRIGGER IF EXISTS enforce_journal_photo_protected_write_fence
  ON public.journal_photos;
CREATE TRIGGER enforce_journal_photo_protected_write_fence
  BEFORE INSERT OR UPDATE ON public.journal_photos
  FOR EACH ROW
  EXECUTE FUNCTION private.enforce_journal_protected_write_fence();

DROP TRIGGER IF EXISTS enforce_journal_audio_protected_write_fence
  ON public.journal_audio;
CREATE TRIGGER enforce_journal_audio_protected_write_fence
  BEFORE INSERT OR UPDATE ON public.journal_audio
  FOR EACH ROW
  EXECUTE FUNCTION private.enforce_journal_protected_write_fence();

DROP TRIGGER IF EXISTS enforce_journal_backup_protected_write_fence
  ON public.user_backups;
CREATE TRIGGER enforce_journal_backup_protected_write_fence
  BEFORE INSERT OR UPDATE ON public.user_backups
  FOR EACH ROW
  EXECUTE FUNCTION private.enforce_journal_protected_write_fence();

DROP TRIGGER IF EXISTS enforce_journal_entry_removal_delete_fence
  ON public.journal_entries;
CREATE TRIGGER enforce_journal_entry_removal_delete_fence
  BEFORE DELETE ON public.journal_entries
  FOR EACH ROW
  EXECUTE FUNCTION private.enforce_journal_removal_delete_fence();

DROP TRIGGER IF EXISTS enforce_journal_photo_removal_delete_fence
  ON public.journal_photos;
CREATE TRIGGER enforce_journal_photo_removal_delete_fence
  BEFORE DELETE ON public.journal_photos
  FOR EACH ROW
  EXECUTE FUNCTION private.enforce_journal_removal_delete_fence();

DROP TRIGGER IF EXISTS enforce_journal_audio_removal_delete_fence
  ON public.journal_audio;
CREATE TRIGGER enforce_journal_audio_removal_delete_fence
  BEFORE DELETE ON public.journal_audio
  FOR EACH ROW
  EXECUTE FUNCTION private.enforce_journal_removal_delete_fence();

DROP TRIGGER IF EXISTS enforce_journal_backup_removal_delete_fence
  ON public.user_backups;
CREATE TRIGGER enforce_journal_backup_removal_delete_fence
  BEFORE DELETE ON public.user_backups
  FOR EACH ROW
  EXECUTE FUNCTION private.enforce_journal_removal_delete_fence();

DROP TRIGGER IF EXISTS admit_journal_vault_delete ON public.user_settings;
CREATE TRIGGER admit_journal_vault_delete
  BEFORE DELETE ON public.user_settings
  FOR EACH ROW
  EXECUTE FUNCTION private.admit_journal_vault_delete();

DROP TRIGGER IF EXISTS admit_journal_vault_write ON public.user_settings;
CREATE TRIGGER admit_journal_vault_write
  BEFORE INSERT OR UPDATE ON public.user_settings
  FOR EACH ROW
  EXECUTE FUNCTION private.admit_journal_vault_write();

-- Existing valid vault rows establish the initial protected epoch. Invalid or
-- missing vault rows are not guessed, repaired, or deleted; their data remains
-- untouched and future protected writes fail closed until a valid activation.
INSERT INTO public.journal_security_states (
  user_id,
  vault_revision,
  wrapper_revision,
  protection_state,
  removal_operation_revision,
  updated_at
)
SELECT
  settings.user_id,
  security.read_journal_vault_revision(settings.value),
  security.read_journal_vault_wrapper_revision(settings.value),
  'protected',
  NULL,
  now()
FROM public.user_settings AS settings
WHERE settings.key = 'journal_vault_key'
  AND security.read_journal_vault_revision(settings.value) IS NOT NULL
  AND security.read_journal_vault_wrapper_revision(settings.value) IS NOT NULL
ON CONFLICT (user_id) DO UPDATE
SET
  vault_revision = EXCLUDED.vault_revision,
  wrapper_revision = CASE
    WHEN EXCLUDED.vault_revision > public.journal_security_states.vault_revision
      THEN EXCLUDED.wrapper_revision
    ELSE pg_catalog.greatest(
      public.journal_security_states.wrapper_revision,
      EXCLUDED.wrapper_revision
    )
  END,
  protection_state = 'protected',
  removal_operation_revision = NULL,
  removal_event_receipts = '[]'::jsonb,
  updated_at = now()
WHERE public.journal_security_states.protection_state = 'protected'
  AND EXCLUDED.vault_revision >= public.journal_security_states.vault_revision;

NOTIFY pgrst, 'reload schema';

COMMIT;

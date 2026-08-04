-- Fence journal password removal against stale authenticated clients.
--
-- The removal worker may need several resumable client requests to replace
-- encrypted rows and blobs with plaintext. The durable state below makes that
-- window server-authoritative: protected writes serialize on the owner state,
-- while plaintext writes remain available. Final verification, vault deletion,
-- and the unprotected tombstone commit in one database transaction.

BEGIN;

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
    )
    OR (
      protection_state IN ('removing', 'unprotected')
      AND removal_operation_revision IS NOT NULL
      AND length(removal_operation_revision) BETWEEN 3 AND 128
    )
  );

ALTER TABLE public.journal_entries
  ADD COLUMN IF NOT EXISTS vault_revision bigint;
ALTER TABLE public.journal_photos
  ADD COLUMN IF NOT EXISTS vault_revision bigint;
ALTER TABLE public.journal_audio
  ADD COLUMN IF NOT EXISTS vault_revision bigint;
ALTER TABLE public.user_backups
  ADD COLUMN IF NOT EXISTS vault_revision bigint;

ALTER TABLE public.journal_entries
  DROP CONSTRAINT IF EXISTS journal_entries_vault_revision_safe;
ALTER TABLE public.journal_entries
  ADD CONSTRAINT journal_entries_vault_revision_safe CHECK (
    vault_revision IS NULL OR vault_revision BETWEEN 0 AND 9007199254740991
  );
ALTER TABLE public.journal_photos
  DROP CONSTRAINT IF EXISTS journal_photos_vault_revision_safe;
ALTER TABLE public.journal_photos
  ADD CONSTRAINT journal_photos_vault_revision_safe CHECK (
    vault_revision IS NULL OR vault_revision BETWEEN 0 AND 9007199254740991
  );
ALTER TABLE public.journal_audio
  DROP CONSTRAINT IF EXISTS journal_audio_vault_revision_safe;
ALTER TABLE public.journal_audio
  ADD CONSTRAINT journal_audio_vault_revision_safe CHECK (
    vault_revision IS NULL OR vault_revision BETWEEN 0 AND 9007199254740991
  );
ALTER TABLE public.user_backups
  DROP CONSTRAINT IF EXISTS user_backups_vault_revision_safe;
ALTER TABLE public.user_backups
  ADD CONSTRAINT user_backups_vault_revision_safe CHECK (
    vault_revision IS NULL OR vault_revision BETWEEN 0 AND 9007199254740991
  );

ALTER TABLE public.journal_security_states ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.journal_security_states FROM PUBLIC, anon, authenticated;
GRANT ALL ON TABLE public.journal_security_states TO service_role;

COMMENT ON TABLE public.journal_security_states IS
  'Private owner-bound journal vault epoch and durable password-removal fence.';

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
  updated_at = now()
WHERE public.journal_security_states.protection_state = 'protected'
  AND EXCLUDED.vault_revision >= public.journal_security_states.vault_revision;

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

DROP TRIGGER IF EXISTS admit_journal_vault_write ON public.user_settings;
CREATE TRIGGER admit_journal_vault_write
  BEFORE INSERT OR UPDATE ON public.user_settings
  FOR EACH ROW
  EXECUTE FUNCTION private.admit_journal_vault_write();

CREATE OR REPLACE FUNCTION public.compare_and_swap_journal_vault_wrapper(
  p_expected_value jsonb,
  p_next_value jsonb
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

  PERFORM pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(v_user_id::text, 0)
  );

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

DROP TRIGGER IF EXISTS admit_journal_vault_delete ON public.user_settings;
CREATE TRIGGER admit_journal_vault_delete
  BEFORE DELETE ON public.user_settings
  FOR EACH ROW
  EXECUTE FUNCTION private.admit_journal_vault_delete();

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
    IF v_state.protection_state <> 'removing'
      OR v_is_protected
      OR NEW.vault_revision IS NOT NULL
      OR (
        TG_TABLE_NAME = 'user_backups'
        AND NOT security.validate_journal_backup_vault_epoch(NEW.payload, NULL)
      )
    THEN
      RAISE EXCEPTION 'Protected journal writes are paused for removal'
        USING ERRCODE = '55000';
    END IF;

    -- The owner-bound removal worker may only replace protected material with
    -- plaintext while the fence is active. Protected/stamped stale-client
    -- writes remain blocked until finalization.
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
    RAISE EXCEPTION 'Journal deletion is paused for removal'
      USING ERRCODE = '55000';
  END IF;

  RETURN OLD;
END;
$$;

REVOKE ALL ON FUNCTION private.enforce_journal_removal_delete_fence()
  FROM PUBLIC, anon, authenticated, service_role;

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

CREATE OR REPLACE FUNCTION security.authorize_journal_media_write(
  p_owner_id uuid,
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
    OR v_caller_id IS NULL
    OR p_owner_id IS DISTINCT FROM v_caller_id
  THEN
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
      AND pg_catalog.right(p_object_name, 4) <> '.bin';
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

REVOKE ALL ON FUNCTION security.authorize_journal_media_write(uuid, text)
  FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION security.authorize_journal_media_write(uuid, text)
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
    OR pg_catalog.right(p_object_name, 4) <> '.bin'
  THEN
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

  PERFORM pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(v_user_id::text, 0)
  );

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
    AND security.authorize_journal_media_write((SELECT auth.uid()), name)
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
    AND security.authorize_journal_media_write((SELECT auth.uid()), name)
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
    AND security.authorize_journal_media_write((SELECT auth.uid()), name)
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
    AND security.authorize_journal_media_write((SELECT auth.uid()), name)
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
    AND security.authorize_journal_media_write((SELECT auth.uid()), name)
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
    AND security.authorize_journal_media_write((SELECT auth.uid()), name)
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
  IF v_type IN ('string', 'number', 'boolean') THEN
    RETURN p_value::text;
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
    WHEN 'entry-row' THEN
      RETURN pg_catalog.jsonb_build_object(
        'id', p_value ->> 'id',
        'content', p_value ->> 'content',
        'vault_revision', p_value ->> 'vault_revision'
      );
    WHEN 'photo-row', 'audio-row' THEN
      RETURN pg_catalog.jsonb_build_object(
        'id', p_value ->> 'id',
        'entry_id', p_value ->> 'entry_id',
        'storage_path', p_value ->> 'storage_path',
        'vault_revision', p_value ->> 'vault_revision'
      );
    WHEN 'entry-backup' THEN
      RETURN pg_catalog.jsonb_build_object(
        'id', p_value ->> 'id',
        'content', p_value ->> 'content',
        'vaultRevision', p_value ->> 'vaultRevision'
      );
    WHEN 'photo-backup' THEN
      RETURN pg_catalog.jsonb_build_object(
        'id', p_value ->> 'id',
        'entryId', p_value ->> 'entryId',
        'data', p_value ->> 'data',
        'thumbnail', p_value ->> 'thumbnail',
        'storagePath', p_value ->> 'storagePath',
        'vaultRevision', p_value ->> 'vaultRevision'
      );
    WHEN 'audio-backup' THEN
      RETURN pg_catalog.jsonb_build_object(
        'id', p_value ->> 'id',
        'entryId', p_value ->> 'entryId',
        'data', p_value ->> 'data',
        'storagePath', p_value ->> 'storagePath',
        'vaultRevision', p_value ->> 'vaultRevision'
      );
    WHEN 'space-backup' THEN
      RETURN pg_catalog.jsonb_build_object(
        'id', p_value ->> 'id',
        'name', p_value ->> 'name',
        'description', p_value ->> 'description',
        'vaultRevision', p_value ->> 'vaultRevision'
      );
    WHEN 'capture-backup' THEN
      IF pg_catalog.jsonb_typeof(p_value -> 'fields') IS DISTINCT FROM 'array' THEN
        RETURN NULL;
      END IF;
      SELECT COALESCE(
        pg_catalog.jsonb_agg(
          pg_catalog.jsonb_build_object(
            'prompt', field.value ->> 'prompt',
            'value', field.value ->> 'value'
          )
          ORDER BY field.ordinality
        ),
        '[]'::jsonb
      )
      INTO v_fields
      FROM pg_catalog.jsonb_array_elements(p_value -> 'fields')
        WITH ORDINALITY AS field(value, ordinality);
      RETURN pg_catalog.jsonb_build_object(
        'id', p_value ->> 'id',
        'spaceId', p_value ->> 'spaceId',
        'spaceName', p_value ->> 'spaceName',
        'title', p_value ->> 'title',
        'fields', v_fields,
        'entryId', p_value ->> 'entryId',
        'vaultRevision', p_value ->> 'vaultRevision'
      );
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

REVOKE ALL ON FUNCTION security.journal_removal_inventory_covers(uuid, bigint, jsonb)
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

-- Publish the vault deletion from the same PostgreSQL transaction that removes
-- the row. Client-side publication can be interrupted after the delete, which
-- would strand every other device with a stale password wrapper. The operation-
-- bound UUID makes retries and the orphan-recovery path exact replays.
CREATE OR REPLACE FUNCTION private.record_journal_vault_removal_event(
  p_owner_id uuid,
  p_operation_revision text,
  p_vault_revision bigint
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
    OR p_operation_revision IS NULL
    OR length(p_operation_revision) NOT BETWEEN 3 AND 128
    OR p_operation_revision !~ '^[0-9]+:[a-z0-9]+$'
    OR p_vault_revision IS NULL
    OR p_vault_revision < 0
    OR p_vault_revision > 9007199254740991
  THEN
    RAISE EXCEPTION 'Invalid journal vault removal event identity'
      USING ERRCODE = '22023';
  END IF;

  v_idempotency_key := pg_catalog.md5(
    p_owner_id::text
      || ':' || p_operation_revision
      || ':journal_vault_key:delete'
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
    'setting',
    'journal_vault_key',
    'delete',
    pg_catalog.jsonb_build_object(
      'key', 'journal_vault_key',
      'operationRevision', p_operation_revision,
      'vaultRevision', p_vault_revision,
      'deletedAt', pg_catalog.clock_timestamp()
    ),
    'server:journal-password-removal',
    v_idempotency_key
  )
  ON CONFLICT (user_id, idempotency_key) DO NOTHING;

  GET DIAGNOSTICS v_inserted_rows = ROW_COUNT;
  IF v_inserted_rows = 0 AND NOT EXISTS (
    SELECT 1
    FROM public.sync_events AS events
    WHERE events.user_id = p_owner_id
      AND events.idempotency_key = v_idempotency_key
      AND events.entity_type = 'setting'
      AND events.entity_id = 'journal_vault_key'
      AND events.op = 'delete'
      AND events.payload ->> 'key' = 'journal_vault_key'
      AND events.payload ->> 'operationRevision' = p_operation_revision
      AND events.payload ->> 'vaultRevision' = p_vault_revision::text
      AND events.device_id = 'server:journal-password-removal'
  ) THEN
    RAISE EXCEPTION 'Journal vault event idempotency collision'
      USING ERRCODE = '23505';
  END IF;
END;
$$;

REVOKE ALL ON FUNCTION private.record_journal_vault_removal_event(uuid, text, bigint)
  FROM PUBLIC, anon, authenticated, service_role;

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
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Authentication required' USING ERRCODE = '42501';
  END IF;

  PERFORM pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(v_user_id::text, 0)
  );

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
    UPDATE public.journal_security_states
    SET
      journal_write_mode = 'legacy',
      updated_at = now()
    WHERE user_id = v_user_id;

    PERFORM private.record_journal_vault_removal_event(
      v_user_id,
      v_state.removal_operation_revision,
      v_state.vault_revision
    );

    RETURN pg_catalog.jsonb_build_object(
      'status', 'complete',
      'operationRevision', v_state.removal_operation_revision,
      'vaultRevision', v_state.vault_revision
    );
  END IF;

  UPDATE public.journal_security_states
  SET
    journal_write_mode = 'paused',
    updated_at = now()
  WHERE user_id = v_user_id;

  IF v_remote_revision IS DISTINCT FROM v_state.vault_revision THEN
    RETURN pg_catalog.jsonb_build_object(
      'status', 'manual-recovery-required',
      'operationRevision', v_state.removal_operation_revision,
      'vaultRevision', v_state.vault_revision
    );
  END IF;

  IF security.journal_removal_has_protected_data(v_user_id) THEN
    RETURN pg_catalog.jsonb_build_object(
      'status', 'manual-recovery-required',
      'operationRevision', v_state.removal_operation_revision,
      'vaultRevision', v_state.vault_revision
    );
  END IF;

  UPDATE public.journal_security_states
  SET
    protection_state = 'unprotected',
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

  PERFORM private.record_journal_vault_removal_event(
    v_user_id,
    v_state.removal_operation_revision,
    v_state.vault_revision
  );

  RETURN pg_catalog.jsonb_build_object(
    'status', 'complete',
    'operationRevision', v_state.removal_operation_revision,
    'vaultRevision', v_state.vault_revision
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
  v_deleted_rows integer;
  v_backup_payload jsonb;
  v_backup_vault_revision bigint;
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
    RETURN 'stale';
  END IF;

  IF v_state.protection_state = 'unprotected'
    AND v_state.vault_revision = p_expected_vault_revision
    AND v_state.removal_operation_revision = p_operation_revision
  THEN
    UPDATE public.journal_security_states
    SET
      journal_write_mode = 'legacy',
      updated_at = now()
    WHERE user_id = v_user_id;

    PERFORM private.record_journal_vault_removal_event(
      v_user_id,
      p_operation_revision,
      p_expected_vault_revision
    );

    RETURN 'complete';
  END IF;

  IF v_state.protection_state <> 'removing'
    OR v_state.vault_revision IS DISTINCT FROM p_expected_vault_revision
    OR v_state.removal_operation_revision IS DISTINCT FROM p_operation_revision
  THEN
    RETURN 'stale';
  END IF;

  UPDATE public.journal_security_states
  SET
    journal_write_mode = 'paused',
    updated_at = now()
  WHERE user_id = v_user_id;

  IF v_remote_revision IS DISTINCT FROM p_expected_vault_revision THEN
    RETURN 'stale';
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
    RETURN 'protected-data';
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
    RETURN 'protected-data';
  END IF;

  UPDATE public.journal_security_states
  SET
    protection_state = 'unprotected',
    removal_operation_revision = p_operation_revision,
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

  PERFORM private.record_journal_vault_removal_event(
    v_user_id,
    p_operation_revision,
    p_expected_vault_revision
  );

  RETURN 'complete';
END;
$$;

REVOKE ALL ON FUNCTION public.finalize_journal_password_removal(bigint, text)
  FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.finalize_journal_password_removal(bigint, text)
  TO authenticated;

-- A lost upsert response is considered an exact replay only when both the row
-- and its explicit vault epoch still match the server-authoritative state.
CREATE OR REPLACE FUNCTION public.is_journal_entry_payload_current(
  p_entry jsonb
)
RETURNS boolean
LANGUAGE plpgsql
STABLE
SECURITY INVOKER
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

NOTIFY pgrst, 'reload schema';

COMMIT;

-- Journal cloud writes must reject stale device state, and derived embeddings
-- must not survive deletion of their source entry.

DO $$
DECLARE
  orphan_embedding_count bigint;
  orphan_photo_count bigint;
  orphan_audio_count bigint;
BEGIN
  SELECT count(*)
  INTO orphan_embedding_count
  FROM public.journal_embeddings AS embeddings
  WHERE NOT EXISTS (
    SELECT 1
    FROM public.journal_entries AS entries
    WHERE entries.id = embeddings.entry_id
  );

  IF orphan_embedding_count > 0 THEN
    RAISE EXCEPTION
      'Journal embedding integrity preflight failed: % orphan rows require owner-reviewed remediation',
      orphan_embedding_count
      USING ERRCODE = '23503',
            HINT = 'Inspect the orphan count and approve a privacy-safe cleanup before rerunning this migration.';
  END IF;

  SELECT count(*)
  INTO orphan_photo_count
  FROM public.journal_photos AS photos
  WHERE NOT EXISTS (
    SELECT 1
    FROM public.journal_entries AS entries
    WHERE entries.id = photos.entry_id
  );

  IF orphan_photo_count > 0 THEN
    RAISE EXCEPTION
      'Journal photo integrity preflight failed: % orphan rows require owner-reviewed remediation',
      orphan_photo_count
      USING ERRCODE = '23503',
            HINT = 'Inspect the orphan count and approve a privacy-safe cleanup before rerunning this migration.';
  END IF;

  SELECT count(*)
  INTO orphan_audio_count
  FROM public.journal_audio AS audio
  WHERE NOT EXISTS (
    SELECT 1
    FROM public.journal_entries AS entries
    WHERE entries.id = audio.entry_id
  );

  IF orphan_audio_count > 0 THEN
    RAISE EXCEPTION
      'Journal audio integrity preflight failed: % orphan rows require owner-reviewed remediation',
      orphan_audio_count
      USING ERRCODE = '23503',
            HINT = 'Inspect the orphan count and approve a privacy-safe cleanup before rerunning this migration.';
  END IF;
END
$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'journal_embeddings_entry_id_fkey'
      AND conrelid = 'public.journal_embeddings'::regclass
  ) THEN
    ALTER TABLE public.journal_embeddings
      ADD CONSTRAINT journal_embeddings_entry_id_fkey
      FOREIGN KEY (entry_id)
      REFERENCES public.journal_entries(id)
      ON DELETE CASCADE
      NOT VALID;
  END IF;
END
$$;

ALTER TABLE public.journal_embeddings
  VALIDATE CONSTRAINT journal_embeddings_entry_id_fkey;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'journal_photos_entry_id_fkey'
      AND conrelid = 'public.journal_photos'::regclass
  ) THEN
    ALTER TABLE public.journal_photos
      ADD CONSTRAINT journal_photos_entry_id_fkey
      FOREIGN KEY (entry_id)
      REFERENCES public.journal_entries(id)
      ON DELETE CASCADE
      NOT VALID;
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'journal_audio_entry_id_fkey'
      AND conrelid = 'public.journal_audio'::regclass
  ) THEN
    ALTER TABLE public.journal_audio
      ADD CONSTRAINT journal_audio_entry_id_fkey
      FOREIGN KEY (entry_id)
      REFERENCES public.journal_entries(id)
      ON DELETE CASCADE
      NOT VALID;
  END IF;
END
$$;

ALTER TABLE public.journal_photos
  VALIDATE CONSTRAINT journal_photos_entry_id_fkey;

ALTER TABLE public.journal_audio
  VALIDATE CONSTRAINT journal_audio_entry_id_fkey;

CREATE OR REPLACE FUNCTION public.reject_stale_journal_entry_update()
RETURNS trigger
LANGUAGE plpgsql
VOLATILE
SECURITY INVOKER
SET search_path = ''
AS $$
BEGIN
  IF NEW.user_id IS DISTINCT FROM OLD.user_id THEN
    RAISE EXCEPTION 'Journal entry owner cannot change' USING ERRCODE = '42501';
  END IF;

  IF NEW.updated_at <= OLD.updated_at THEN
    RETURN NULL;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS reject_stale_journal_entry_update
  ON public.journal_entries;

CREATE TRIGGER reject_stale_journal_entry_update
  BEFORE UPDATE ON public.journal_entries
  FOR EACH ROW
  EXECUTE FUNCTION public.reject_stale_journal_entry_update();

REVOKE EXECUTE ON FUNCTION public.reject_stale_journal_entry_update()
  FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.is_journal_entry_payload_current(p_entry jsonb)
RETURNS boolean
LANGUAGE plpgsql
STABLE
SECURITY INVOKER
SET search_path = ''
AS $$
DECLARE
  auth_user_id uuid := (SELECT auth.uid());
  incoming public.journal_entries%ROWTYPE;
  payload_matches boolean := false;
BEGIN
  IF auth_user_id IS NULL THEN
    RAISE EXCEPTION 'Authentication required' USING ERRCODE = '42501';
  END IF;

  IF p_entry IS NULL OR jsonb_typeof(p_entry) <> 'object' THEN
    RAISE EXCEPTION 'Journal entry payload must be an object' USING ERRCODE = '22023';
  END IF;

  incoming := jsonb_populate_record(NULL::public.journal_entries, p_entry);

  IF incoming.user_id IS DISTINCT FROM auth_user_id THEN
    RAISE EXCEPTION 'Journal entry owner mismatch' USING ERRCODE = '42501';
  END IF;

  SELECT to_jsonb(entries) = to_jsonb(incoming)
  INTO payload_matches
  FROM public.journal_entries AS entries
  WHERE entries.id = incoming.id
    AND entries.user_id = auth_user_id;

  RETURN COALESCE(payload_matches, false);
END;
$$;

REVOKE EXECUTE ON FUNCTION public.is_journal_entry_payload_current(jsonb)
  FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.is_journal_entry_payload_current(jsonb)
  TO authenticated;

COMMENT ON FUNCTION public.is_journal_entry_payload_current(jsonb) IS
  'Returns only whether an authenticated caller payload exactly matches the current RLS-visible journal row.';

NOTIFY pgrst, 'reload schema';

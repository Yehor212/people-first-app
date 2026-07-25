-- Journal entry arrays are the parent-authoritative media membership set.
-- Fail closed on existing drift; remediation must be reviewed, never silently deleted.
DO $$
DECLARE
  orphan_photo_membership_count bigint;
  orphan_audio_membership_count bigint;
BEGIN
  SELECT count(*)
  INTO orphan_photo_membership_count
  FROM public.journal_photos AS photos
  WHERE NOT EXISTS (
    SELECT 1
    FROM public.journal_entries AS entries
    WHERE entries.id = photos.entry_id
      AND entries.user_id = photos.user_id
      AND photos.id::text = ANY (COALESCE(entries.photo_ids, '{}'::text[]))
  );

  IF orphan_photo_membership_count > 0 THEN
    RAISE EXCEPTION
      'Journal photo membership preflight failed: % metadata rows are absent from their parent photo_ids',
      orphan_photo_membership_count
      USING ERRCODE = '23503',
            HINT = 'Inspect and owner-approve a privacy-safe cleanup before rerunning this migration.';
  END IF;

  SELECT count(*)
  INTO orphan_audio_membership_count
  FROM public.journal_audio AS audio
  WHERE NOT EXISTS (
    SELECT 1
    FROM public.journal_entries AS entries
    WHERE entries.id = audio.entry_id
      AND entries.user_id = audio.user_id
      AND audio.id::text = ANY (COALESCE(entries.audio_ids, '{}'::text[]))
  );

  IF orphan_audio_membership_count > 0 THEN
    RAISE EXCEPTION
      'Journal audio membership preflight failed: % metadata rows are absent from their parent audio_ids',
      orphan_audio_membership_count
      USING ERRCODE = '23503',
            HINT = 'Inspect and owner-approve a privacy-safe cleanup before rerunning this migration.';
  END IF;
END
$$;

-- Cover parent lookups and foreign-key cascades without duplicating the
-- existing owner-first indexes used by per-user media queries.
CREATE INDEX IF NOT EXISTS journal_photos_entry_id_idx
  ON public.journal_photos (entry_id, user_id);
CREATE INDEX IF NOT EXISTS journal_audio_entry_id_idx
  ON public.journal_audio (entry_id, user_id);

CREATE OR REPLACE FUNCTION public.enforce_journal_photo_parent_membership()
RETURNS trigger
LANGUAGE plpgsql
VOLATILE
SECURITY INVOKER
SET search_path = ''
AS $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM public.journal_entries AS entries
    WHERE entries.id = NEW.entry_id
      AND entries.user_id = NEW.user_id
      AND NEW.id::text = ANY (COALESCE(entries.photo_ids, '{}'::text[]))
  ) THEN
    RAISE EXCEPTION 'Journal photo is not referenced by its current parent entry'
      USING ERRCODE = '23503';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS enforce_journal_photo_parent_membership
  ON public.journal_photos;
CREATE TRIGGER enforce_journal_photo_parent_membership
  BEFORE INSERT OR UPDATE ON public.journal_photos
  FOR EACH ROW
  EXECUTE FUNCTION public.enforce_journal_photo_parent_membership();

CREATE OR REPLACE FUNCTION public.enforce_journal_audio_parent_membership()
RETURNS trigger
LANGUAGE plpgsql
VOLATILE
SECURITY INVOKER
SET search_path = ''
AS $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM public.journal_entries AS entries
    WHERE entries.id = NEW.entry_id
      AND entries.user_id = NEW.user_id
      AND NEW.id::text = ANY (COALESCE(entries.audio_ids, '{}'::text[]))
  ) THEN
    RAISE EXCEPTION 'Journal audio is not referenced by its current parent entry'
      USING ERRCODE = '23503';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS enforce_journal_audio_parent_membership
  ON public.journal_audio;
CREATE TRIGGER enforce_journal_audio_parent_membership
  BEFORE INSERT OR UPDATE ON public.journal_audio
  FOR EACH ROW
  EXECUTE FUNCTION public.enforce_journal_audio_parent_membership();

REVOKE EXECUTE ON FUNCTION public.enforce_journal_photo_parent_membership()
  FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.enforce_journal_audio_parent_membership()
  FROM PUBLIC, anon, authenticated;

DROP POLICY IF EXISTS "journal_photos_upload" ON storage.objects;
CREATE POLICY "journal_photos_upload" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'journal-photos'
    AND (storage.foldername(name))[1] = (SELECT auth.uid())::text
    AND NOT EXISTS (
      SELECT 1 FROM public.account_deletion_blocks AS deletion_block
      WHERE deletion_block.user_id = (SELECT auth.uid())
    )
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
    AND NOT EXISTS (
      SELECT 1 FROM public.account_deletion_blocks AS deletion_block
      WHERE deletion_block.user_id = (SELECT auth.uid())
    )
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
    AND NOT EXISTS (
      SELECT 1 FROM public.account_deletion_blocks AS deletion_block
      WHERE deletion_block.user_id = (SELECT auth.uid())
    )
    AND EXISTS (
      SELECT 1 FROM public.journal_entries AS entries
      WHERE entries.user_id = (SELECT auth.uid())
        AND split_part(storage.filename(name), '.', 1) = ANY (
          COALESCE(entries.photo_ids, '{}'::text[])
        )
    )
  );

DROP POLICY IF EXISTS "journal_photos_select" ON storage.objects;
CREATE POLICY "journal_photos_select" ON storage.objects
  FOR SELECT TO authenticated
  USING (
    bucket_id = 'journal-photos'
    AND (storage.foldername(name))[1] = (SELECT auth.uid())::text
    AND NOT EXISTS (
      SELECT 1 FROM public.account_deletion_blocks AS deletion_block
      WHERE deletion_block.user_id = (SELECT auth.uid())
    )
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
    AND NOT EXISTS (
      SELECT 1 FROM public.account_deletion_blocks AS deletion_block
      WHERE deletion_block.user_id = (SELECT auth.uid())
    )
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
    AND NOT EXISTS (
      SELECT 1 FROM public.account_deletion_blocks AS deletion_block
      WHERE deletion_block.user_id = (SELECT auth.uid())
    )
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
    AND NOT EXISTS (
      SELECT 1 FROM public.account_deletion_blocks AS deletion_block
      WHERE deletion_block.user_id = (SELECT auth.uid())
    )
    AND EXISTS (
      SELECT 1 FROM public.journal_entries AS entries
      WHERE entries.user_id = (SELECT auth.uid())
        AND split_part(storage.filename(name), '.', 1) = ANY (
          COALESCE(entries.audio_ids, '{}'::text[])
        )
    )
  );

DROP POLICY IF EXISTS "journal_audio_select" ON storage.objects;
CREATE POLICY "journal_audio_select" ON storage.objects
  FOR SELECT TO authenticated
  USING (
    bucket_id = 'journal-audio'
    AND (storage.foldername(name))[1] = (SELECT auth.uid())::text
    AND NOT EXISTS (
      SELECT 1 FROM public.account_deletion_blocks AS deletion_block
      WHERE deletion_block.user_id = (SELECT auth.uid())
    )
    AND EXISTS (
      SELECT 1 FROM public.journal_entries AS entries
      WHERE entries.user_id = (SELECT auth.uid())
        AND split_part(storage.filename(name), '.', 1) = ANY (
          COALESCE(entries.audio_ids, '{}'::text[])
        )
    )
  );

NOTIFY pgrst, 'reload schema';

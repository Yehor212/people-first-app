-- Complete the journal media constraints when an earlier production migration
-- recorded success before the photo and audio foreign keys were present.

DO $$
DECLARE
  orphan_photo_count bigint;
  orphan_audio_count bigint;
BEGIN
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
      'Journal photo integrity repair preflight failed: % orphan rows require owner-reviewed remediation',
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
      'Journal audio integrity repair preflight failed: % orphan rows require owner-reviewed remediation',
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

NOTIFY pgrst, 'reload schema';

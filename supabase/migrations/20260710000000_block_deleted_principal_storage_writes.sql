-- Keep a permanent principal tombstone outside auth.users so an access JWT
-- issued before account deletion cannot recreate or read journal media.
CREATE TABLE IF NOT EXISTS public.account_deletion_blocks (
  user_id uuid PRIMARY KEY,
  blocked_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.account_deletion_blocks ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE public.account_deletion_blocks FROM PUBLIC, anon, authenticated;
GRANT SELECT ON TABLE public.account_deletion_blocks TO authenticated;
GRANT ALL ON TABLE public.account_deletion_blocks TO service_role;

DROP POLICY IF EXISTS "account_deletion_blocks_select_own" ON public.account_deletion_blocks;
CREATE POLICY "account_deletion_blocks_select_own"
  ON public.account_deletion_blocks
  FOR SELECT
  TO authenticated
  USING (user_id = (select auth.uid()));

COMMENT ON TABLE public.account_deletion_blocks IS
  'Permanent deletion barrier; intentionally has no auth.users foreign key or cascade.';

-- Existing JWTs remain cryptographically valid until expiry. Every journal
-- Storage policy therefore rejects a principal once its deletion barrier exists.
DROP POLICY IF EXISTS "journal_photos_upload" ON storage.objects;
CREATE POLICY "journal_photos_upload" ON storage.objects
  FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'journal-photos'
    AND (storage.foldername(name))[1] = (select auth.uid())::text
    AND NOT EXISTS (
      SELECT 1
      FROM public.account_deletion_blocks AS deletion_block
      WHERE deletion_block.user_id = (select auth.uid())
    )
  );

DROP POLICY IF EXISTS "journal_photos_select" ON storage.objects;
CREATE POLICY "journal_photos_select" ON storage.objects
  FOR SELECT
  TO authenticated
  USING (
    bucket_id = 'journal-photos'
    AND (storage.foldername(name))[1] = (select auth.uid())::text
    AND NOT EXISTS (
      SELECT 1
      FROM public.account_deletion_blocks AS deletion_block
      WHERE deletion_block.user_id = (select auth.uid())
    )
  );

DROP POLICY IF EXISTS "journal_photos_delete" ON storage.objects;
CREATE POLICY "journal_photos_delete" ON storage.objects
  FOR DELETE
  TO authenticated
  USING (
    bucket_id = 'journal-photos'
    AND (storage.foldername(name))[1] = (select auth.uid())::text
    AND NOT EXISTS (
      SELECT 1
      FROM public.account_deletion_blocks AS deletion_block
      WHERE deletion_block.user_id = (select auth.uid())
    )
  );

DROP POLICY IF EXISTS "journal_audio_upload" ON storage.objects;
CREATE POLICY "journal_audio_upload" ON storage.objects
  FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'journal-audio'
    AND (storage.foldername(name))[1] = (select auth.uid())::text
    AND NOT EXISTS (
      SELECT 1
      FROM public.account_deletion_blocks AS deletion_block
      WHERE deletion_block.user_id = (select auth.uid())
    )
  );

DROP POLICY IF EXISTS "journal_audio_select" ON storage.objects;
CREATE POLICY "journal_audio_select" ON storage.objects
  FOR SELECT
  TO authenticated
  USING (
    bucket_id = 'journal-audio'
    AND (storage.foldername(name))[1] = (select auth.uid())::text
    AND NOT EXISTS (
      SELECT 1
      FROM public.account_deletion_blocks AS deletion_block
      WHERE deletion_block.user_id = (select auth.uid())
    )
  );

DROP POLICY IF EXISTS "journal_audio_delete" ON storage.objects;
CREATE POLICY "journal_audio_delete" ON storage.objects
  FOR DELETE
  TO authenticated
  USING (
    bucket_id = 'journal-audio'
    AND (storage.foldername(name))[1] = (select auth.uid())::text
    AND NOT EXISTS (
      SELECT 1
      FROM public.account_deletion_blocks AS deletion_block
      WHERE deletion_block.user_id = (select auth.uid())
    )
  );

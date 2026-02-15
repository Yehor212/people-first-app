-- Create Storage buckets for journal media
-- Photos: compressed JPEG ~100-200KB, thumbnails ~5-10KB
-- Audio: WebM/MP4 64kbps, up to 5min (~19MB max)

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES
  ('journal-photos', 'journal-photos', false, 1048576,  -- 1MB max per photo
   ARRAY['image/jpeg', 'image/png', 'image/webp']),
  ('journal-audio',  'journal-audio',  false, 20971520, -- 20MB max per audio
   ARRAY['audio/webm', 'audio/mp4', 'audio/mpeg', 'audio/ogg'])
ON CONFLICT (id) DO NOTHING;

-- RLS: users can only access their own files
-- Storage path convention: {user_id}/{file_id}.ext

-- journal-photos policies
CREATE POLICY "Users can upload own photos"
  ON storage.objects FOR INSERT
  WITH CHECK (
    bucket_id = 'journal-photos'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

CREATE POLICY "Users can view own photos"
  ON storage.objects FOR SELECT
  USING (
    bucket_id = 'journal-photos'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

CREATE POLICY "Users can delete own photos"
  ON storage.objects FOR DELETE
  USING (
    bucket_id = 'journal-photos'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

-- journal-audio policies
CREATE POLICY "Users can upload own audio"
  ON storage.objects FOR INSERT
  WITH CHECK (
    bucket_id = 'journal-audio'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

CREATE POLICY "Users can view own audio"
  ON storage.objects FOR SELECT
  USING (
    bucket_id = 'journal-audio'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

CREATE POLICY "Users can delete own audio"
  ON storage.objects FOR DELETE
  USING (
    bucket_id = 'journal-audio'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

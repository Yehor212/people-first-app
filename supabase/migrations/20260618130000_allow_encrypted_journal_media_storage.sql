-- Allow encrypted journal media payloads in private Storage buckets.
-- Encrypted objects use application/octet-stream and .bin paths so Supabase Storage
-- never needs plaintext diary photo/audio bytes after local vault encryption.

UPDATE storage.buckets
SET
  file_size_limit = 1052672,
  allowed_mime_types = ARRAY['image/jpeg', 'image/png', 'image/webp', 'application/octet-stream']
WHERE id = 'journal-photos';

UPDATE storage.buckets
SET
  file_size_limit = 20975616,
  allowed_mime_types = ARRAY['audio/webm', 'audio/mp4', 'audio/mpeg', 'audio/ogg', 'audio/wav', 'application/octet-stream']
WHERE id = 'journal-audio';

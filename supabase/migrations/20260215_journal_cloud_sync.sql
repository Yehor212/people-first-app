-- Journal Cloud Sync Tables
-- Phase 2: Enable cross-device journal synchronization
--
-- Architecture:
--   journal_entries: entry metadata (title, content, mood, tags, etc.)
--   journal_photos:  photo metadata + Storage path (NO base64 — binary lives in Storage bucket)
--   journal_audio:   audio metadata + Storage path (NO base64 — binary lives in Storage bucket)

-- ============================================
-- JOURNAL ENTRIES
-- ============================================

CREATE TABLE IF NOT EXISTS public.journal_entries (
  id TEXT PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  date TEXT NOT NULL,                       -- "YYYY-MM-DD"
  title TEXT NOT NULL DEFAULT '',
  content TEXT NOT NULL DEFAULT '',
  stickers TEXT[] NOT NULL DEFAULT '{}',    -- emoji array, max 5
  mood TEXT,                                -- 'great' | 'good' | 'okay' | 'bad' | 'terrible'
  tags TEXT[] NOT NULL DEFAULT '{}',
  template_id TEXT,
  habit_snapshot JSONB,                     -- [{habitId, habitName, habitIcon, completed}]
  photo_ids TEXT[] NOT NULL DEFAULT '{}',
  audio_ids TEXT[] NOT NULL DEFAULT '{}',
  created_at BIGINT NOT NULL,
  updated_at BIGINT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_journal_entries_user_id
  ON public.journal_entries(user_id);

CREATE INDEX IF NOT EXISTS idx_journal_entries_user_date
  ON public.journal_entries(user_id, date);

ALTER TABLE public.journal_entries ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own journal entries"
  ON public.journal_entries FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own journal entries"
  ON public.journal_entries FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own journal entries"
  ON public.journal_entries FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own journal entries"
  ON public.journal_entries FOR DELETE
  USING (auth.uid() = user_id);

-- ============================================
-- JOURNAL PHOTOS (metadata only — binary in Storage)
-- ============================================

CREATE TABLE IF NOT EXISTS public.journal_photos (
  id TEXT PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  entry_id TEXT NOT NULL,
  width INTEGER NOT NULL DEFAULT 0,
  height INTEGER NOT NULL DEFAULT 0,
  storage_path TEXT,                        -- e.g. "{userId}/{photoId}.jpg"
  storage_url TEXT,                         -- signed URL for CDN access
  created_at BIGINT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_journal_photos_user_id
  ON public.journal_photos(user_id);

CREATE INDEX IF NOT EXISTS idx_journal_photos_entry_id
  ON public.journal_photos(user_id, entry_id);

ALTER TABLE public.journal_photos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own journal photos"
  ON public.journal_photos FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own journal photos"
  ON public.journal_photos FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own journal photos"
  ON public.journal_photos FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own journal photos"
  ON public.journal_photos FOR DELETE
  USING (auth.uid() = user_id);

-- ============================================
-- JOURNAL AUDIO (metadata only — binary in Storage)
-- ============================================

CREATE TABLE IF NOT EXISTS public.journal_audio (
  id TEXT PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  entry_id TEXT NOT NULL,
  duration REAL NOT NULL DEFAULT 0,         -- seconds
  mime_type TEXT NOT NULL DEFAULT 'audio/webm',
  storage_path TEXT,
  storage_url TEXT,
  created_at BIGINT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_journal_audio_user_id
  ON public.journal_audio(user_id);

CREATE INDEX IF NOT EXISTS idx_journal_audio_entry_id
  ON public.journal_audio(user_id, entry_id);

ALTER TABLE public.journal_audio ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own journal audio"
  ON public.journal_audio FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own journal audio"
  ON public.journal_audio FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own journal audio"
  ON public.journal_audio FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own journal audio"
  ON public.journal_audio FOR DELETE
  USING (auth.uid() = user_id);

-- ============================================
-- GRANTS
-- ============================================

GRANT ALL ON public.journal_entries TO authenticated;
GRANT ALL ON public.journal_photos TO authenticated;
GRANT ALL ON public.journal_audio TO authenticated;

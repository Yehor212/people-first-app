-- Keep journal photo placement and visual style stable across devices.
-- Version matches the migration recorded by the production Supabase project.
ALTER TABLE public.journal_entries
  ADD COLUMN IF NOT EXISTS photo_layout JSONB,
  ADD COLUMN IF NOT EXISTS theme TEXT,
  ADD COLUMN IF NOT EXISTS font TEXT,
  ADD COLUMN IF NOT EXISTS ink_color TEXT,
  ADD COLUMN IF NOT EXISTS paper_texture TEXT,
  ADD COLUMN IF NOT EXISTS bg_pattern TEXT,
  ADD COLUMN IF NOT EXISTS paper_color TEXT,
  ADD COLUMN IF NOT EXISTS bg_intensity TEXT,
  ADD COLUMN IF NOT EXISTS particle_speed TEXT,
  ADD COLUMN IF NOT EXISTS font_size TEXT;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'journal_entries_photo_layout_object'
      AND conrelid = 'public.journal_entries'::regclass
  ) THEN
    ALTER TABLE public.journal_entries
      ADD CONSTRAINT journal_entries_photo_layout_object
      CHECK (
        photo_layout IS NULL OR (
          jsonb_typeof(photo_layout) = 'object'
          AND jsonb_array_length(jsonb_path_query_array(photo_layout, '$.keyvalue()')) <= 5
          AND NOT jsonb_path_exists(
            photo_layout,
            '$.keyvalue().value ? (
              @.type() != "object" ||
              !exists(@.x) || !exists(@.y) || !exists(@.width) ||
              @.x.type() != "number" || @.x < 0 || @.x > 100 ||
              @.y.type() != "number" || @.y < 0 || @.y > 100 ||
              @.width.type() != "number" || @.width < 80 || @.width > 500
            )'
          )
        )
      );
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'journal_entries_theme_valid'
      AND conrelid = 'public.journal_entries'::regclass
  ) THEN
    ALTER TABLE public.journal_entries
      ADD CONSTRAINT journal_entries_theme_valid
      CHECK (theme IS NULL OR theme IN ('light', 'dark', 'sepia', 'forest', 'ocean', 'sunset', 'lavender', 'rose', 'midnight', 'cherry'));
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'journal_entries_font_valid'
      AND conrelid = 'public.journal_entries'::regclass
  ) THEN
    ALTER TABLE public.journal_entries
      ADD CONSTRAINT journal_entries_font_valid
      CHECK (font IS NULL OR font IN ('caveat', 'cormorant', 'outfit', 'dancing'));
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'journal_entries_ink_color_valid'
      AND conrelid = 'public.journal_entries'::regclass
  ) THEN
    ALTER TABLE public.journal_entries
      ADD CONSTRAINT journal_entries_ink_color_valid
      CHECK (ink_color IS NULL OR ink_color ~ '^#([0-9A-Fa-f]{3}|[0-9A-Fa-f]{4}|[0-9A-Fa-f]{6}|[0-9A-Fa-f]{8})$');
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'journal_entries_paper_texture_valid'
      AND conrelid = 'public.journal_entries'::regclass
  ) THEN
    ALTER TABLE public.journal_entries
      ADD CONSTRAINT journal_entries_paper_texture_valid
      CHECK (paper_texture IS NULL OR paper_texture IN ('clean', 'dots', 'grid', 'lines', 'linen', 'craft'));
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'journal_entries_paper_color_valid'
      AND conrelid = 'public.journal_entries'::regclass
  ) THEN
    ALTER TABLE public.journal_entries
      ADD CONSTRAINT journal_entries_paper_color_valid
      CHECK (paper_color IS NULL OR paper_color IN ('white', 'dark', 'milky'));
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'journal_entries_bg_pattern_valid'
      AND conrelid = 'public.journal_entries'::regclass
  ) THEN
    ALTER TABLE public.journal_entries
      ADD CONSTRAINT journal_entries_bg_pattern_valid
      CHECK (bg_pattern IS NULL OR bg_pattern IN (
        'none', 'sakura', 'honey', 'washi-morning', 'cloud', 'matcha', 'peach',
        'aurora', 'moonlight', 'watercolor', 'stardust', 'garden', 'cotton-candy',
        'sunset-beach', 'snowfall'
      ));
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'journal_entries_bg_intensity_valid'
      AND conrelid = 'public.journal_entries'::regclass
  ) THEN
    ALTER TABLE public.journal_entries
      ADD CONSTRAINT journal_entries_bg_intensity_valid
      CHECK (bg_intensity IS NULL OR bg_intensity IN ('full', 'dim', 'off'));
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'journal_entries_particle_speed_valid'
      AND conrelid = 'public.journal_entries'::regclass
  ) THEN
    ALTER TABLE public.journal_entries
      ADD CONSTRAINT journal_entries_particle_speed_valid
      CHECK (particle_speed IS NULL OR particle_speed IN ('off', 'slow', 'drift'));
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'journal_entries_font_size_valid'
      AND conrelid = 'public.journal_entries'::regclass
  ) THEN
    ALTER TABLE public.journal_entries
      ADD CONSTRAINT journal_entries_font_size_valid
      CHECK (font_size IS NULL OR font_size IN ('small', 'medium', 'large'));
  END IF;
END
$$;

NOTIFY pgrst, 'reload schema';

-- Create push notification tables that were missing from migrations
-- These tables are referenced by Edge Functions and client code
-- Using IF NOT EXISTS for idempotency (tables may have been created manually)

-- ============================================
-- PUSH DEVICE TOKENS (FCM tokens for Android)
-- ============================================
CREATE TABLE IF NOT EXISTS public.push_device_tokens (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  token TEXT NOT NULL,
  platform TEXT NOT NULL DEFAULT 'android',
  device_id TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS push_device_tokens_user_token_idx
  ON public.push_device_tokens (user_id, token);

ALTER TABLE public.push_device_tokens ENABLE ROW LEVEL SECURITY;

-- RLS: users manage own tokens
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'push_device_tokens' AND policyname = 'push_device_tokens_all'
  ) THEN
    CREATE POLICY "push_device_tokens_all" ON public.push_device_tokens
      FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
  END IF;
END $$;

-- ============================================
-- PUSH LOGS (deduplication for scheduled push)
-- ============================================
CREATE TABLE IF NOT EXISTS public.push_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  type TEXT NOT NULL,
  date_key TEXT NOT NULL,
  sent_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS push_logs_user_type_date_idx
  ON public.push_logs (user_id, type, date_key);

ALTER TABLE public.push_logs ENABLE ROW LEVEL SECURITY;

-- RLS: users can read own logs, service_role inserts via Edge Function
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'push_logs' AND policyname = 'push_logs_select'
  ) THEN
    CREATE POLICY "push_logs_select" ON public.push_logs
      FOR SELECT USING (auth.uid() = user_id);
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'push_logs' AND policyname = 'push_logs_insert'
  ) THEN
    CREATE POLICY "push_logs_insert" ON public.push_logs
      FOR INSERT WITH CHECK (auth.uid() = user_id);
  END IF;
END $$;

-- ============================================
-- USER REMINDER SETTINGS
-- ============================================
CREATE TABLE IF NOT EXISTS public.user_reminder_settings (
  user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  enabled BOOLEAN NOT NULL DEFAULT FALSE,
  mood_time TEXT,
  mood_time_morning TEXT,
  mood_time_afternoon TEXT,
  mood_time_evening TEXT,
  habit_time TEXT,
  focus_time TEXT,
  days INT[] NOT NULL DEFAULT '{}',
  quiet_start TEXT,
  quiet_end TEXT,
  habit_ids TEXT[] NOT NULL DEFAULT '{}',
  timezone TEXT,
  language TEXT,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.user_reminder_settings ENABLE ROW LEVEL SECURITY;

-- RLS: users manage own settings
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'user_reminder_settings' AND policyname = 'user_reminder_settings_all'
  ) THEN
    CREATE POLICY "user_reminder_settings_all" ON public.user_reminder_settings
      FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
  END IF;
END $$;

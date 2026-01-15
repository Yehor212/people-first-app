-- ZenFlow Database Schema
-- Initial migration for Supabase backend

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================
-- PROFILES TABLE (extends auth.users)
-- ============================================
CREATE TABLE IF NOT EXISTS profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  display_name TEXT,
  avatar_url TEXT,
  preferred_language TEXT DEFAULT 'en',
  timezone TEXT DEFAULT 'UTC',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

-- Profiles policies
CREATE POLICY "Users can view own profile" ON profiles
  FOR SELECT USING (auth.uid() = id);

CREATE POLICY "Users can update own profile" ON profiles
  FOR UPDATE USING (auth.uid() = id);

CREATE POLICY "Users can insert own profile" ON profiles
  FOR INSERT WITH CHECK (auth.uid() = id);

-- Auto-create profile on user signup
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, display_name)
  VALUES (NEW.id, NEW.raw_user_meta_data->>'full_name');
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION handle_new_user();

-- ============================================
-- MOODS TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS moods (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  mood TEXT NOT NULL CHECK (mood IN ('great', 'good', 'okay', 'bad', 'terrible')),
  note TEXT,
  tags TEXT[] DEFAULT '{}',
  date DATE NOT NULL,
  timestamp BIGINT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  -- Prevent duplicate entries for same date
  UNIQUE(user_id, date)
);

-- Indexes
CREATE INDEX idx_moods_user_date ON moods(user_id, date DESC);
CREATE INDEX idx_moods_user_timestamp ON moods(user_id, timestamp DESC);

-- Enable RLS
ALTER TABLE moods ENABLE ROW LEVEL SECURITY;

-- Moods policies
CREATE POLICY "Users can CRUD own moods" ON moods
  FOR ALL USING (auth.uid() = user_id);

-- ============================================
-- HABITS TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS habits (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  icon TEXT NOT NULL DEFAULT '✨',
  color TEXT NOT NULL DEFAULT '#6366f1',
  type TEXT NOT NULL DEFAULT 'daily' CHECK (type IN ('continuous', 'daily', 'scheduled', 'multiple', 'reduce')),
  frequency TEXT NOT NULL DEFAULT 'daily' CHECK (frequency IN ('once', 'daily', 'weekly', 'custom')),
  custom_days INTEGER[] DEFAULT '{}',
  requires_duration BOOLEAN DEFAULT FALSE,
  target_duration INTEGER,
  start_date DATE,
  daily_target INTEGER DEFAULT 1,
  target_count INTEGER,
  template_id TEXT,
  is_archived BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX idx_habits_user ON habits(user_id);
CREATE INDEX idx_habits_user_active ON habits(user_id) WHERE NOT is_archived;

-- Enable RLS
ALTER TABLE habits ENABLE ROW LEVEL SECURITY;

-- Habits policies
CREATE POLICY "Users can CRUD own habits" ON habits
  FOR ALL USING (auth.uid() = user_id);

-- ============================================
-- HABIT COMPLETIONS TABLE (normalized from completedDates)
-- ============================================
CREATE TABLE IF NOT EXISTS habit_completions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  habit_id UUID NOT NULL REFERENCES habits(id) ON DELETE CASCADE,
  date DATE NOT NULL,
  count INTEGER DEFAULT 1, -- For multiple habits
  duration INTEGER, -- Minutes spent
  created_at TIMESTAMPTZ DEFAULT NOW(),

  -- One completion record per habit per day
  UNIQUE(habit_id, date)
);

-- Indexes
CREATE INDEX idx_habit_completions_user ON habit_completions(user_id, date DESC);
CREATE INDEX idx_habit_completions_habit ON habit_completions(habit_id, date DESC);

-- Enable RLS
ALTER TABLE habit_completions ENABLE ROW LEVEL SECURITY;

-- Habit completions policies
CREATE POLICY "Users can CRUD own habit completions" ON habit_completions
  FOR ALL USING (auth.uid() = user_id);

-- ============================================
-- HABIT REMINDERS TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS habit_reminders (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  habit_id UUID NOT NULL REFERENCES habits(id) ON DELETE CASCADE,
  enabled BOOLEAN DEFAULT TRUE,
  time TIME NOT NULL DEFAULT '09:00',
  days INTEGER[] DEFAULT '{1,2,3,4,5}', -- Days of week (0=Sun, 6=Sat)
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE habit_reminders ENABLE ROW LEVEL SECURITY;

-- Habit reminders policies
CREATE POLICY "Users can CRUD own habit reminders" ON habit_reminders
  FOR ALL USING (auth.uid() = user_id);

-- ============================================
-- FOCUS SESSIONS TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS focus_sessions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  duration INTEGER NOT NULL, -- Minutes
  label TEXT,
  status TEXT DEFAULT 'completed' CHECK (status IN ('completed', 'aborted')),
  reflection INTEGER CHECK (reflection >= 1 AND reflection <= 5),
  date DATE NOT NULL,
  completed_at BIGINT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX idx_focus_sessions_user_date ON focus_sessions(user_id, date DESC);
CREATE INDEX idx_focus_sessions_user_completed ON focus_sessions(user_id, completed_at DESC);

-- Enable RLS
ALTER TABLE focus_sessions ENABLE ROW LEVEL SECURITY;

-- Focus sessions policies
CREATE POLICY "Users can CRUD own focus sessions" ON focus_sessions
  FOR ALL USING (auth.uid() = user_id);

-- ============================================
-- GRATITUDE ENTRIES TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS gratitude_entries (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  text TEXT NOT NULL,
  date DATE NOT NULL,
  timestamp BIGINT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX idx_gratitude_user_date ON gratitude_entries(user_id, date DESC);

-- Enable RLS
ALTER TABLE gratitude_entries ENABLE ROW LEVEL SECURITY;

-- Gratitude entries policies
CREATE POLICY "Users can CRUD own gratitude entries" ON gratitude_entries
  FOR ALL USING (auth.uid() = user_id);

-- ============================================
-- USER SETTINGS TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS user_settings (
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  key TEXT NOT NULL,
  value JSONB,
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  PRIMARY KEY (user_id, key)
);

-- Enable RLS
ALTER TABLE user_settings ENABLE ROW LEVEL SECURITY;

-- User settings policies
CREATE POLICY "Users can CRUD own settings" ON user_settings
  FOR ALL USING (auth.uid() = user_id);

-- ============================================
-- CHALLENGES TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS challenges (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  type TEXT NOT NULL CHECK (type IN ('streak', 'total', 'focus', 'gratitude')),
  habit_id UUID REFERENCES habits(id) ON DELETE SET NULL,
  target INTEGER NOT NULL,
  progress INTEGER DEFAULT 0,
  start_date DATE NOT NULL,
  end_date DATE,
  completed BOOLEAN DEFAULT FALSE,
  completed_date DATE,
  icon TEXT NOT NULL,
  title_ru TEXT,
  title_en TEXT,
  description_ru TEXT,
  description_en TEXT,
  reward TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE challenges ENABLE ROW LEVEL SECURITY;

-- Challenges policies
CREATE POLICY "Users can CRUD own challenges" ON challenges
  FOR ALL USING (auth.uid() = user_id);

-- ============================================
-- BADGES TABLE (earned badges)
-- ============================================
CREATE TABLE IF NOT EXISTS badges (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  badge_type TEXT NOT NULL, -- Badge ID from frontend badge definitions
  unlocked_date DATE NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),

  UNIQUE(user_id, badge_type)
);

-- Enable RLS
ALTER TABLE badges ENABLE ROW LEVEL SECURITY;

-- Badges policies
CREATE POLICY "Users can CRUD own badges" ON badges
  FOR ALL USING (auth.uid() = user_id);

-- ============================================
-- ADHD HOOKS - GAMIFICATION DATA
-- ============================================
CREATE TABLE IF NOT EXISTS adhd_state (
  user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  combo_count INTEGER DEFAULT 0,
  combo_multiplier NUMERIC(3,1) DEFAULT 1.0,
  combo_last_action BIGINT,
  combo_expires_at BIGINT,
  spin_tokens INTEGER DEFAULT 0,
  login_streak INTEGER DEFAULT 0,
  last_login_date DATE,
  total_xp INTEGER DEFAULT 0,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE adhd_state ENABLE ROW LEVEL SECURITY;

-- ADHD state policies
CREATE POLICY "Users can CRUD own ADHD state" ON adhd_state
  FOR ALL USING (auth.uid() = user_id);

-- ============================================
-- MYSTERY BOXES
-- ============================================
CREATE TABLE IF NOT EXISTS mystery_boxes (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  type TEXT NOT NULL CHECK (type IN ('bronze', 'silver', 'gold', 'diamond')),
  icon TEXT NOT NULL,
  unlocked_at BIGINT NOT NULL,
  opened_at BIGINT,
  rewards JSONB DEFAULT '[]',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE mystery_boxes ENABLE ROW LEVEL SECURITY;

-- Mystery boxes policies
CREATE POLICY "Users can CRUD own mystery boxes" ON mystery_boxes
  FOR ALL USING (auth.uid() = user_id);

-- ============================================
-- TIME CHALLENGES
-- ============================================
CREATE TABLE IF NOT EXISTS time_challenges (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  type TEXT NOT NULL CHECK (type IN ('flash', 'hourly', 'weekend')),
  title TEXT NOT NULL,
  description TEXT,
  icon TEXT NOT NULL,
  target INTEGER NOT NULL,
  progress INTEGER DEFAULT 0,
  reward_xp INTEGER NOT NULL,
  reward_spins INTEGER DEFAULT 0,
  expires_at BIGINT NOT NULL,
  completed BOOLEAN DEFAULT FALSE,
  claimed BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX idx_time_challenges_user ON time_challenges(user_id, expires_at DESC);

-- Enable RLS
ALTER TABLE time_challenges ENABLE ROW LEVEL SECURITY;

-- Time challenges policies
CREATE POLICY "Users can CRUD own time challenges" ON time_challenges
  FOR ALL USING (auth.uid() = user_id);

-- ============================================
-- USER BACKUPS (legacy, for full sync fallback)
-- ============================================
CREATE TABLE IF NOT EXISTS user_backups (
  user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  payload JSONB NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE user_backups ENABLE ROW LEVEL SECURITY;

-- User backups policies
CREATE POLICY "Users can CRUD own backups" ON user_backups
  FOR ALL USING (auth.uid() = user_id);

-- ============================================
-- PUSH SUBSCRIPTIONS
-- ============================================
CREATE TABLE IF NOT EXISTS push_subscriptions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  endpoint TEXT NOT NULL,
  keys JSONB NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),

  UNIQUE(user_id, endpoint)
);

-- Enable RLS
ALTER TABLE push_subscriptions ENABLE ROW LEVEL SECURITY;

-- Push subscriptions policies
CREATE POLICY "Users can CRUD own push subscriptions" ON push_subscriptions
  FOR ALL USING (auth.uid() = user_id);

-- ============================================
-- HELPER FUNCTIONS
-- ============================================

-- Function to calculate streak
CREATE OR REPLACE FUNCTION calculate_streak(p_user_id UUID)
RETURNS INTEGER AS $$
DECLARE
  v_streak INTEGER := 0;
  v_current_date DATE := CURRENT_DATE;
  v_check_date DATE;
  v_has_activity BOOLEAN;
BEGIN
  v_check_date := v_current_date;

  LOOP
    -- Check if user had any activity on this date
    SELECT EXISTS (
      SELECT 1 FROM moods WHERE user_id = p_user_id AND date = v_check_date
      UNION ALL
      SELECT 1 FROM habit_completions WHERE user_id = p_user_id AND date = v_check_date
      UNION ALL
      SELECT 1 FROM focus_sessions WHERE user_id = p_user_id AND date = v_check_date
      UNION ALL
      SELECT 1 FROM gratitude_entries WHERE user_id = p_user_id AND date = v_check_date
    ) INTO v_has_activity;

    IF v_has_activity THEN
      v_streak := v_streak + 1;
      v_check_date := v_check_date - INTERVAL '1 day';
    ELSE
      -- Allow one grace day if checking yesterday
      IF v_check_date = v_current_date THEN
        v_check_date := v_check_date - INTERVAL '1 day';
      ELSE
        EXIT;
      END IF;
    END IF;

    -- Safety limit
    IF v_streak > 1000 THEN
      EXIT;
    END IF;
  END LOOP;

  RETURN v_streak;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to get user stats
CREATE OR REPLACE FUNCTION get_user_stats(p_user_id UUID)
RETURNS JSON AS $$
DECLARE
  v_stats JSON;
BEGIN
  SELECT json_build_object(
    'currentStreak', calculate_streak(p_user_id),
    'totalFocusMinutes', COALESCE((SELECT SUM(duration) FROM focus_sessions WHERE user_id = p_user_id), 0),
    'habitsCompleted', COALESCE((SELECT COUNT(*) FROM habit_completions WHERE user_id = p_user_id), 0),
    'moodEntries', COALESCE((SELECT COUNT(*) FROM moods WHERE user_id = p_user_id), 0),
    'gratitudeEntries', COALESCE((SELECT COUNT(*) FROM gratitude_entries WHERE user_id = p_user_id), 0),
    'totalBadges', COALESCE((SELECT COUNT(*) FROM badges WHERE user_id = p_user_id), 0)
  ) INTO v_stats;

  RETURN v_stats;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Updated_at trigger function
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply updated_at triggers
CREATE TRIGGER update_profiles_updated_at BEFORE UPDATE ON profiles
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_moods_updated_at BEFORE UPDATE ON moods
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_habits_updated_at BEFORE UPDATE ON habits
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_user_settings_updated_at BEFORE UPDATE ON user_settings
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_adhd_state_updated_at BEFORE UPDATE ON adhd_state
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_user_backups_updated_at BEFORE UPDATE ON user_backups
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

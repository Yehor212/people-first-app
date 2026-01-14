-- Tasks and Quests Cloud Sync Tables

-- User Tasks
CREATE TABLE IF NOT EXISTS user_tasks (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  task_id TEXT NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  urgent BOOLEAN DEFAULT FALSE,
  estimated_minutes INTEGER NOT NULL,
  user_rating INTEGER,
  completed BOOLEAN DEFAULT FALSE,
  due_date TIMESTAMPTZ,
  category TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, task_id)
);

-- User Quests
CREATE TABLE IF NOT EXISTS user_quests (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  quest_id TEXT NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('daily', 'weekly', 'bonus')),
  category TEXT NOT NULL,
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  condition JSONB NOT NULL,
  reward JSONB NOT NULL,
  progress INTEGER DEFAULT 0,
  total INTEGER NOT NULL,
  completed BOOLEAN DEFAULT FALSE,
  expires_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, quest_id)
);

-- Indexes for faster queries
CREATE INDEX IF NOT EXISTS idx_user_tasks_user_id ON user_tasks(user_id);
CREATE INDEX IF NOT EXISTS idx_user_tasks_completed ON user_tasks(completed);
CREATE INDEX IF NOT EXISTS idx_user_quests_user_id ON user_quests(user_id);
CREATE INDEX IF NOT EXISTS idx_user_quests_type ON user_quests(type);
CREATE INDEX IF NOT EXISTS idx_user_quests_completed ON user_quests(completed);

-- Row Level Security (RLS) Policies
ALTER TABLE user_tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_quests ENABLE ROW LEVEL SECURITY;

-- Tasks policies (with DROP IF EXISTS to avoid conflicts)
DROP POLICY IF EXISTS "Users can view their own tasks" ON user_tasks;
CREATE POLICY "Users can view their own tasks"
  ON user_tasks FOR SELECT
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can insert their own tasks" ON user_tasks;
CREATE POLICY "Users can insert their own tasks"
  ON user_tasks FOR INSERT
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update their own tasks" ON user_tasks;
CREATE POLICY "Users can update their own tasks"
  ON user_tasks FOR UPDATE
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can delete their own tasks" ON user_tasks;
CREATE POLICY "Users can delete their own tasks"
  ON user_tasks FOR DELETE
  USING (auth.uid() = user_id);

-- Quests policies (with DROP IF EXISTS to avoid conflicts)
DROP POLICY IF EXISTS "Users can view their own quests" ON user_quests;
CREATE POLICY "Users can view their own quests"
  ON user_quests FOR SELECT
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can insert their own quests" ON user_quests;
CREATE POLICY "Users can insert their own quests"
  ON user_quests FOR INSERT
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update their own quests" ON user_quests;
CREATE POLICY "Users can update their own quests"
  ON user_quests FOR UPDATE
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can delete their own quests" ON user_quests;
CREATE POLICY "Users can delete their own quests"
  ON user_quests FOR DELETE
  USING (auth.uid() = user_id);

-- Updated_at trigger function
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Triggers for updated_at
DROP TRIGGER IF EXISTS update_user_tasks_updated_at ON user_tasks;
CREATE TRIGGER update_user_tasks_updated_at
  BEFORE UPDATE ON user_tasks
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_user_quests_updated_at ON user_quests;
CREATE TRIGGER update_user_quests_updated_at
  BEFORE UPDATE ON user_quests
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

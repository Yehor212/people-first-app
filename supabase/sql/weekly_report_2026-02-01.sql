-- ZenFlow Weekly Report
-- Week: 2026-01-26 to 2026-02-01
-- Generated: 2026-02-01

-- ============================================
-- 1. USER STATISTICS
-- ============================================

-- Total registered users
SELECT
  'Total Users' as metric,
  COUNT(*) as value
FROM auth.users;

-- New users this week
SELECT
  'New Users (This Week)' as metric,
  COUNT(*) as value
FROM auth.users
WHERE created_at >= '2026-01-26'::date
  AND created_at < '2026-02-02'::date;

-- Active users this week (logged mood or completed habit)
SELECT
  'Active Users (This Week)' as metric,
  COUNT(DISTINCT user_id) as value
FROM (
  SELECT user_id FROM moods WHERE date >= '2026-01-26' AND date <= '2026-02-01'
  UNION
  SELECT user_id FROM habit_completions WHERE date >= '2026-01-26' AND date <= '2026-02-01'
) active;

-- ============================================
-- 2. MOOD STATISTICS
-- ============================================

-- Mood entries this week
SELECT
  'Mood Entries (This Week)' as metric,
  COUNT(*) as value
FROM moods
WHERE date >= '2026-01-26' AND date <= '2026-02-01';

-- Mood distribution this week
SELECT
  mood,
  COUNT(*) as count,
  ROUND(COUNT(*) * 100.0 / SUM(COUNT(*)) OVER(), 1) as percentage
FROM moods
WHERE date >= '2026-01-26' AND date <= '2026-02-01'
GROUP BY mood
ORDER BY
  CASE mood
    WHEN 'great' THEN 1
    WHEN 'good' THEN 2
    WHEN 'okay' THEN 3
    WHEN 'bad' THEN 4
    WHEN 'terrible' THEN 5
  END;

-- Average mood score (great=5, good=4, okay=3, bad=2, terrible=1)
SELECT
  'Average Mood Score' as metric,
  ROUND(AVG(
    CASE mood
      WHEN 'great' THEN 5
      WHEN 'good' THEN 4
      WHEN 'okay' THEN 3
      WHEN 'bad' THEN 2
      WHEN 'terrible' THEN 1
    END
  ), 2) as value
FROM moods
WHERE date >= '2026-01-26' AND date <= '2026-02-01';

-- ============================================
-- 3. HABIT STATISTICS
-- ============================================

-- Total habits created
SELECT
  'Total Habits' as metric,
  COUNT(*) as value
FROM habits
WHERE is_archived = false;

-- New habits this week
SELECT
  'New Habits (This Week)' as metric,
  COUNT(*) as value
FROM habits
WHERE created_at >= '2026-01-26'::date
  AND created_at < '2026-02-02'::date;

-- Habit completions this week
SELECT
  'Habit Completions (This Week)' as metric,
  COUNT(*) as value
FROM habit_completions
WHERE date >= '2026-01-26' AND date <= '2026-02-01';

-- Top 5 most completed habits this week
SELECT
  h.name,
  h.icon,
  COUNT(hc.*) as completions
FROM habit_completions hc
JOIN habits h ON hc.habit_id = h.id
WHERE hc.date >= '2026-01-26' AND hc.date <= '2026-02-01'
GROUP BY h.id, h.name, h.icon
ORDER BY completions DESC
LIMIT 5;

-- 4. CHALLENGES STATISTICS

SELECT 'Active Challenges' as metric, COUNT(*) as value
FROM friend_challenges WHERE status = 'active';

SELECT 'New Challenges (This Week)' as metric, COUNT(*) as value
FROM friend_challenges
WHERE created_at >= '2026-01-26'::timestamptz AND created_at < '2026-02-02'::timestamptz;

SELECT 'Total Challenge Participants' as metric, COUNT(*) as value
FROM friend_challenge_members;

-- ============================================
-- 5. PUSH NOTIFICATIONS
-- ============================================

-- Users with push enabled
SELECT
  'Users with Push Enabled' as metric,
  COUNT(*) as value
FROM user_reminder_settings
WHERE enabled = true;

-- Push tokens registered
SELECT
  'Push Tokens Registered' as metric,
  COUNT(*) as value
FROM push_device_tokens;

-- ============================================
-- 6. FEEDBACK
-- ============================================

-- Feedback this week
SELECT
  'Feedback Received (This Week)' as metric,
  COUNT(*) as value
FROM feedback
WHERE created_at >= '2026-01-26'::timestamptz
  AND created_at < '2026-02-02'::timestamptz;

-- Average rating this week
SELECT
  'Average Feedback Rating' as metric,
  ROUND(AVG(rating), 2) as value
FROM feedback
WHERE created_at >= '2026-01-26'::timestamptz
  AND created_at < '2026-02-02'::timestamptz
  AND rating IS NOT NULL;

-- ============================================
-- 7. DAILY BREAKDOWN (This Week)
-- ============================================

SELECT
  date,
  COUNT(DISTINCT m.user_id) as users_with_mood,
  COUNT(DISTINCT hc.user_id) as users_with_habits,
  COUNT(m.*) as mood_entries,
  COUNT(hc.*) as habit_completions
FROM generate_series('2026-01-26'::date, '2026-02-01'::date, '1 day'::interval) as date
LEFT JOIN moods m ON m.date = date::date
LEFT JOIN habit_completions hc ON hc.date = date::date
GROUP BY date
ORDER BY date;

-- ============================================
-- 8. RETENTION (Users active multiple days)
-- ============================================

SELECT
  days_active,
  COUNT(*) as users
FROM (
  SELECT
    user_id,
    COUNT(DISTINCT date) as days_active
  FROM (
    SELECT user_id, date FROM moods WHERE date >= '2026-01-26' AND date <= '2026-02-01'
    UNION ALL
    SELECT user_id, date FROM habit_completions WHERE date >= '2026-01-26' AND date <= '2026-02-01'
  ) all_activity
  GROUP BY user_id
) user_days
GROUP BY days_active
ORDER BY days_active;

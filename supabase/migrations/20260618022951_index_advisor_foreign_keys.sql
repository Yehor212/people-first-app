-- Advisor performance hardening: add covering indexes for unindexed foreign keys.
-- Source: Supabase Performance Advisor 0001_unindexed_foreign_keys.
-- Scope: index-only DDL; no table rewrites, grants, policies, or data changes.

CREATE INDEX IF NOT EXISTS challenges_user_id_idx ON public.challenges (user_id);
CREATE INDEX IF NOT EXISTS challenges_habit_id_idx ON public.challenges (habit_id);
CREATE INDEX IF NOT EXISTS design_flags_updated_by_idx ON public.design_flags (updated_by);
CREATE INDEX IF NOT EXISTS habit_reminders_habit_id_idx ON public.habit_reminders (habit_id);
CREATE INDEX IF NOT EXISTS mystery_boxes_user_id_idx ON public.mystery_boxes (user_id);
CREATE INDEX IF NOT EXISTS sync_tombstones_deleted_event_id_idx ON public.sync_tombstones (deleted_event_id);

NOTIFY pgrst, 'reload schema';

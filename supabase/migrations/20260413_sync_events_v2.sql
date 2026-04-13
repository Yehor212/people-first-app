-- =============================================
-- Migration: sync_events V2 enhancement
-- Created: 2026-04-13
-- Adds idempotency_key + version for Telegram-style sync engine V2
--
-- Rollback:
--   ALTER TABLE public.sync_events DROP COLUMN IF EXISTS idempotency_key;
--   ALTER TABLE public.sync_events DROP COLUMN IF EXISTS version;
--   DROP INDEX IF EXISTS sync_events_entity_type_seq_idx;
-- =============================================

-- Idempotency key: prevents duplicate event application across retries
ALTER TABLE public.sync_events
  ADD COLUMN IF NOT EXISTS idempotency_key UUID DEFAULT gen_random_uuid();

-- Version: schema version for forward-compatible payload parsing
ALTER TABLE public.sync_events
  ADD COLUMN IF NOT EXISTS version INTEGER NOT NULL DEFAULT 1;

-- Index for per-entity-type delta pulls (used by syncCursor per-entity seq tracking)
CREATE INDEX IF NOT EXISTS sync_events_entity_type_seq_idx
  ON public.sync_events (user_id, entity_type, seq ASC);

-- Unique constraint on idempotency_key per user (prevents duplicate events)
CREATE UNIQUE INDEX IF NOT EXISTS sync_events_idempotency_idx
  ON public.sync_events (user_id, idempotency_key);

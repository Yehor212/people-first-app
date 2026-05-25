-- Keep generated Supabase Insert types aligned with the trigger-owned sync seq.
--
-- `trg_assign_sync_seq` remains the ordering authority and overwrites NEW.seq
-- before insert. This harmless default tells Supabase type generation that
-- clients do not provide `seq` themselves.

ALTER TABLE public.sync_events
  ALTER COLUMN seq SET DEFAULT 0;

-- Account deletion must not be blocked by device installations or by audit
-- attribution on global rollout flags.
--
-- push_device_tokens are owned by one auth user, so deleting the owner deletes
-- every installation. design_flags are global configuration and must survive;
-- only their optional author reference is cleared.

ALTER TABLE public.push_device_tokens
  DROP CONSTRAINT IF EXISTS push_device_tokens_user_id_fkey;

ALTER TABLE public.push_device_tokens
  ADD CONSTRAINT push_device_tokens_user_id_fkey
  FOREIGN KEY (user_id)
  REFERENCES auth.users(id)
  ON DELETE CASCADE;

ALTER TABLE public.design_flags
  DROP CONSTRAINT IF EXISTS design_flags_updated_by_fkey;

ALTER TABLE public.design_flags
  ADD CONSTRAINT design_flags_updated_by_fkey
  FOREIGN KEY (updated_by)
  REFERENCES auth.users(id)
  ON DELETE SET NULL;

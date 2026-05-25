-- Revoke default PUBLIC execute on the SECURITY DEFINER weekly summary RPC.
-- The reconciliation migration now includes this line for fresh environments;
-- this tiny follow-up records the same live hardening for the already-linked
-- project where 20260525225407 had been applied before CodeRabbit review.

REVOKE ALL ON FUNCTION public.get_user_weekly_summary(date) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_user_weekly_summary(date) TO authenticated;

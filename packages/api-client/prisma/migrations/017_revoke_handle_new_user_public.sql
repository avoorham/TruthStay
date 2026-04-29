-- Migration 017: Revoke public EXECUTE on handle_new_user trigger function
-- ─────────────────────────────────────────────────────────────────────────────
-- handle_new_user is a trigger function invoked by the auth.users INSERT
-- trigger. It should never be callable directly via /rest/v1/rpc/handle_new_user.
-- Migration 016 revoked from anon + authenticated but PUBLIC (the catch-all
-- role they inherit from) still held the grant — revoke that too.

REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM PUBLIC;

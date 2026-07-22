-- MINDWEAVE dedicated Supabase project only.
-- REVIEW AND APPLY MANUALLY only to reverse 20260718020000.
-- This does not change data, RLS, auth.users, or Supabase system schemas.

BEGIN;

REVOKE SELECT, INSERT, UPDATE, DELETE ON TABLE public.collective_knowledge FROM service_role;
REVOKE SELECT, INSERT, UPDATE, DELETE ON TABLE public.guest_tokens FROM service_role;
REVOKE SELECT, INSERT, UPDATE, DELETE ON TABLE public.reactions FROM service_role;
REVOKE SELECT, INSERT, UPDATE, DELETE ON TABLE public.notes FROM service_role;
REVOKE SELECT, INSERT, UPDATE, DELETE ON TABLE public.meeting_participants FROM service_role;
REVOKE SELECT, INSERT, UPDATE, DELETE ON TABLE public.meetings FROM service_role;
REVOKE SELECT, INSERT, UPDATE, DELETE ON TABLE public.app_admins FROM service_role;
REVOKE SELECT, INSERT, UPDATE, DELETE ON TABLE public.users FROM service_role;

REVOKE EXECUTE ON FUNCTION public.mindweave_set_updated_at() FROM service_role;

COMMIT;

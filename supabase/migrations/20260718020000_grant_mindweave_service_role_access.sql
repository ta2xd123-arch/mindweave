-- MINDWEAVE dedicated Supabase project only.
-- REVIEW AND APPLY MANUALLY after 20260718010000_mindweave_initial_schema.sql.
-- This grants the server-only service_role the table privileges required to
-- bypass RLS after Next.js API routes validate the authenticated session.

BEGIN;

GRANT USAGE ON SCHEMA public TO service_role;

GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.users TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.app_admins TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.meetings TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.meeting_participants TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.notes TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.reactions TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.guest_tokens TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.collective_knowledge TO service_role;

REVOKE ALL ON FUNCTION public.mindweave_set_updated_at() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.mindweave_set_updated_at() TO service_role;

COMMIT;

-- MINDWEAVE dedicated Supabase project only.
-- Do not run this file against the shared Pattern project or an existing MINDWEAVE database.
-- This reverses objects created by 20260718010000_mindweave_initial_schema.sql.
-- auth.users and Supabase system schemas are intentionally untouched.

BEGIN;

DROP TRIGGER IF EXISTS mindweave_collective_knowledge_set_updated_at ON public.collective_knowledge;
DROP TRIGGER IF EXISTS mindweave_notes_set_updated_at ON public.notes;

DROP INDEX IF EXISTS public.collective_knowledge_meeting_status_created_at_idx;
DROP INDEX IF EXISTS public.guest_tokens_meeting_id_idx;
DROP INDEX IF EXISTS public.reactions_note_id_idx;
DROP INDEX IF EXISTS public.notes_meeting_id_created_at_idx;
DROP INDEX IF EXISTS public.meeting_participants_user_id_meeting_id_idx;
DROP INDEX IF EXISTS public.meetings_created_by_created_at_idx;

DROP TABLE IF EXISTS public.collective_knowledge;
DROP TABLE IF EXISTS public.guest_tokens;
DROP TABLE IF EXISTS public.reactions;
DROP TABLE IF EXISTS public.notes;
DROP TABLE IF EXISTS public.meeting_participants;
DROP TABLE IF EXISTS public.meetings;
DROP TABLE IF EXISTS public.app_admins;
DROP TABLE IF EXISTS public.users;

DROP FUNCTION IF EXISTS public.mindweave_set_updated_at();

-- Extensions and the extensions schema are not dropped. They may predate this
-- schema or be used by other objects in the dedicated Supabase project.

COMMIT;

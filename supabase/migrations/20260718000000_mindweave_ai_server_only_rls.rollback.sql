-- REVIEW ONLY: do not apply automatically.
-- This rollback intentionally does not restore permissive legacy policies.
-- Restoring them would reopen data in a Supabase project shared with Pattern.
-- RLS remains enabled; the service-role server client continues to function.

DROP INDEX IF EXISTS public.collective_knowledge_meeting_status_created_at_idx;

-- Remove this line only after confirming no generated analysis needs provenance.
-- ALTER TABLE public.collective_knowledge DROP COLUMN IF EXISTS created_by;

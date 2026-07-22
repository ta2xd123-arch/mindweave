-- MINDWEAVE serves application data exclusively through Next.js API routes.
-- REVIEW ONLY: do not apply automatically.
-- The production server uses SUPABASE_SERVICE_ROLE_KEY, which bypasses RLS.
-- Scope is limited to MINDWEAVE meeting data. Shared Pattern tables are excluded.

DO $$
DECLARE
  policy_record RECORD;
BEGIN
  FOR policy_record IN
    SELECT policyname, tablename
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename IN (
        'meetings', 'meeting_participants', 'notes', 'reactions', 'ai_reports',
        'knowledge_items', 'knowledge_sources', 'guest_tokens', 'collective_knowledge'
      )
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', policy_record.policyname, policy_record.tablename);
  END LOOP;
END $$;

ALTER TABLE public.meetings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.meeting_participants ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.reactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ai_reports ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.knowledge_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.knowledge_sources ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.guest_tokens ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.collective_knowledge ENABLE ROW LEVEL SECURITY;

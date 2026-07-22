-- REVIEW ONLY: do not apply automatically.
-- Scope is intentionally limited to MINDWEAVE meeting and AI tables. Generic
-- shared tables (users, groups, profiles, app_admins) are deliberately excluded.
-- Next.js server routes use the service-role client, which bypasses RLS.

DO $$
DECLARE
  table_name text;
  policy_record record;
BEGIN
  FOREACH table_name IN ARRAY ARRAY[
    'meetings', 'meeting_participants', 'notes', 'reactions', 'ai_reports',
    'knowledge_items', 'knowledge_sources', 'guest_tokens', 'collective_knowledge'
  ]
  LOOP
    IF to_regclass(format('public.%I', table_name)) IS NOT NULL THEN
      FOR policy_record IN
        SELECT policyname
        FROM pg_policies
        WHERE schemaname = 'public' AND tablename = table_name
      LOOP
        EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', policy_record.policyname, table_name);
      END LOOP;
      EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', table_name);
    END IF;
  END LOOP;
END $$;

-- Provenance for newly generated analysis. Existing rows remain nullable.
ALTER TABLE IF EXISTS public.collective_knowledge
  ADD COLUMN IF NOT EXISTS created_by uuid REFERENCES auth.users(id);

CREATE INDEX IF NOT EXISTS collective_knowledge_meeting_status_created_at_idx
  ON public.collective_knowledge (meeting_id, status, created_at DESC);

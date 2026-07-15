-- Create ai_reports table
CREATE TABLE IF NOT EXISTS public.ai_reports (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  meeting_id UUID NOT NULL REFERENCES public.meetings(id) ON DELETE CASCADE,
  created_by UUID NOT NULL REFERENCES public.users(id),
  summary TEXT NOT NULL,
  core_topics JSONB NOT NULL DEFAULT '[]'::jsonb,
  common_ideas JSONB NOT NULL DEFAULT '[]'::jsonb,
  different_ideas JSONB NOT NULL DEFAULT '[]'::jsonb,
  new_questions JSONB NOT NULL DEFAULT '[]'::jsonb,
  action_items JSONB NOT NULL DEFAULT '[]'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(meeting_id)
);

-- Create knowledge_items table
CREATE TABLE IF NOT EXISTS public.knowledge_items (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  meeting_id UUID NOT NULL REFERENCES public.meetings(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  content TEXT NOT NULL,
  created_by UUID NOT NULL REFERENCES public.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Create knowledge_sources table
CREATE TABLE IF NOT EXISTS public.knowledge_sources (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  knowledge_item_id UUID NOT NULL REFERENCES public.knowledge_items(id) ON DELETE CASCADE,
  note_id UUID REFERENCES public.notes(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE public.ai_reports ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.knowledge_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.knowledge_sources ENABLE ROW LEVEL SECURITY;

-- Drop existing bad policies from init.sql and secure_rls.sql
DROP POLICY IF EXISTS "meetings_select_anon" ON public.meetings;
DROP POLICY IF EXISTS "meetings_all_anon" ON public.meetings;
DROP POLICY IF EXISTS "participants_select_anon" ON public.meeting_participants;
DROP POLICY IF EXISTS "participants_all_anon" ON public.meeting_participants;
DROP POLICY IF EXISTS "notes_select_anon" ON public.notes;
DROP POLICY IF EXISTS "notes_all_anon" ON public.notes;
DROP POLICY IF EXISTS "reactions_select_anon" ON public.reactions;
DROP POLICY IF EXISTS "reactions_all_anon" ON public.reactions;
DROP POLICY IF EXISTS "meetings_insert_anon" ON public.meetings;
DROP POLICY IF EXISTS "meetings_update_anon" ON public.meetings;
DROP POLICY IF EXISTS "meetings_delete_creator" ON public.meetings;
DROP POLICY IF EXISTS "participants_insert_anon" ON public.meeting_participants;
DROP POLICY IF EXISTS "notes_insert_anon" ON public.notes;
DROP POLICY IF EXISTS "notes_update_author" ON public.notes;
DROP POLICY IF EXISTS "notes_delete_author" ON public.notes;
DROP POLICY IF EXISTS "reactions_insert_anon" ON public.reactions;
DROP POLICY IF EXISTS "reactions_delete_anon" ON public.reactions;
DROP POLICY IF EXISTS "users_anon_upsert" ON public.users;

-- RLS: users
CREATE POLICY "users_insert" ON public.users FOR INSERT WITH CHECK (auth.uid() = id);
CREATE POLICY "users_select" ON public.users FOR SELECT USING (true);

-- RLS: meetings
CREATE POLICY "meetings_select" ON public.meetings FOR SELECT USING (
  created_by = auth.uid() OR 
  EXISTS (SELECT 1 FROM public.meeting_participants mp WHERE mp.meeting_id = id AND mp.user_id = auth.uid())
);
CREATE POLICY "meetings_insert" ON public.meetings FOR INSERT WITH CHECK (auth.uid() = created_by);
CREATE POLICY "meetings_update" ON public.meetings FOR UPDATE USING (auth.uid() = created_by);
CREATE POLICY "meetings_delete" ON public.meetings FOR DELETE USING (auth.uid() = created_by);

-- RLS: meeting_participants
CREATE POLICY "participants_select" ON public.meeting_participants FOR SELECT USING (
  EXISTS (SELECT 1 FROM public.meeting_participants mp WHERE mp.meeting_id = meeting_participants.meeting_id AND mp.user_id = auth.uid()) OR
  EXISTS (SELECT 1 FROM public.meetings m WHERE m.id = meeting_participants.meeting_id AND m.created_by = auth.uid())
);
CREATE POLICY "participants_insert" ON public.meeting_participants FOR INSERT WITH CHECK (auth.uid() = user_id);

-- RLS: notes
CREATE POLICY "notes_select" ON public.notes FOR SELECT USING (
  EXISTS (SELECT 1 FROM public.meeting_participants mp WHERE mp.meeting_id = notes.meeting_id AND mp.user_id = auth.uid())
);
CREATE POLICY "notes_insert" ON public.notes FOR INSERT WITH CHECK (
  auth.uid() = author_id AND
  EXISTS (SELECT 1 FROM public.meeting_participants mp WHERE mp.meeting_id = notes.meeting_id AND mp.user_id = auth.uid())
);
CREATE POLICY "notes_update" ON public.notes FOR UPDATE USING (auth.uid() = author_id);
CREATE POLICY "notes_delete" ON public.notes FOR DELETE USING (auth.uid() = author_id);

-- RLS: reactions
CREATE POLICY "reactions_select" ON public.reactions FOR SELECT USING (
  EXISTS (SELECT 1 FROM public.notes n JOIN public.meeting_participants mp ON n.meeting_id = mp.meeting_id WHERE n.id = reactions.note_id AND mp.user_id = auth.uid())
);
CREATE POLICY "reactions_insert" ON public.reactions FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "reactions_delete" ON public.reactions FOR DELETE USING (auth.uid() = user_id);

-- RLS: ai_reports
CREATE POLICY "ai_reports_select" ON public.ai_reports FOR SELECT USING (
  EXISTS (SELECT 1 FROM public.meeting_participants mp WHERE mp.meeting_id = ai_reports.meeting_id AND mp.user_id = auth.uid())
);
CREATE POLICY "ai_reports_insert" ON public.ai_reports FOR INSERT WITH CHECK (auth.uid() = created_by);
CREATE POLICY "ai_reports_update" ON public.ai_reports FOR UPDATE USING (
  EXISTS (SELECT 1 FROM public.meeting_participants mp WHERE mp.meeting_id = ai_reports.meeting_id AND mp.user_id = auth.uid())
);

-- RLS: knowledge_items
CREATE POLICY "knowledge_select" ON public.knowledge_items FOR SELECT USING (
  EXISTS (SELECT 1 FROM public.meeting_participants mp WHERE mp.meeting_id = knowledge_items.meeting_id AND mp.user_id = auth.uid())
);
CREATE POLICY "knowledge_insert" ON public.knowledge_items FOR INSERT WITH CHECK (auth.uid() = created_by);

-- RLS: knowledge_sources
CREATE POLICY "sources_select" ON public.knowledge_sources FOR SELECT USING (
  EXISTS (
    SELECT 1 FROM public.knowledge_items ki 
    JOIN public.meeting_participants mp ON ki.meeting_id = mp.meeting_id 
    WHERE ki.id = knowledge_sources.knowledge_item_id AND mp.user_id = auth.uid()
  )
);
CREATE POLICY "sources_insert" ON public.knowledge_sources FOR INSERT WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.knowledge_items ki 
    WHERE ki.id = knowledge_sources.knowledge_item_id AND ki.created_by = auth.uid()
  )
);

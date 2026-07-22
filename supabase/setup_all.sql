-- ============================================================
-- MINDWEAVE 전체 스키마 설치 SQL
-- Supabase SQL Editor에서 이 파일 전체를 복사하여 실행하세요.
-- IF NOT EXISTS 사용으로 중복 실행 안전
-- ============================================================

-- UUID 확장 활성화
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================================
-- 1. USERS 테이블
-- ============================================================
CREATE TABLE IF NOT EXISTS public.users (
  id UUID PRIMARY KEY,
  email TEXT UNIQUE,
  name TEXT,
  avatar_url TEXT,
  created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP NOT NULL
);

ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow public read access to users" ON public.users;
DROP POLICY IF EXISTS "Allow insert/update for own user" ON public.users;
DROP POLICY IF EXISTS "users_insert" ON public.users;
DROP POLICY IF EXISTS "users_select" ON public.users;

CREATE POLICY "users_insert" ON public.users FOR INSERT WITH CHECK (true);
CREATE POLICY "users_select" ON public.users FOR SELECT USING (true);

-- ============================================================
-- 2. GROUPS 테이블
-- ============================================================
CREATE TABLE IF NOT EXISTS public.groups (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  description TEXT,
  owner_id UUID REFERENCES public.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP NOT NULL
);

ALTER TABLE public.groups ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow public read access to groups" ON public.groups;
DROP POLICY IF EXISTS "Allow all access to groups" ON public.groups;

CREATE POLICY "groups_select" ON public.groups FOR SELECT USING (true);
CREATE POLICY "groups_all" ON public.groups FOR ALL USING (true);

-- ============================================================
-- 3. MEETINGS 테이블
-- ============================================================
CREATE TABLE IF NOT EXISTS public.meetings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id UUID REFERENCES public.groups(id) ON DELETE SET NULL,
  title TEXT NOT NULL,
  topic TEXT NOT NULL,
  description TEXT,
  meeting_date TIMESTAMPTZ,
  invite_code TEXT UNIQUE NOT NULL,
  status TEXT DEFAULT 'active' NOT NULL,
  created_by UUID REFERENCES public.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP NOT NULL,
  max_participants INTEGER DEFAULT 20 NOT NULL
);

ALTER TABLE public.meetings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow public read access to meetings" ON public.meetings;
DROP POLICY IF EXISTS "Allow all access to meetings" ON public.meetings;
DROP POLICY IF EXISTS "meetings_select_anon" ON public.meetings;
DROP POLICY IF EXISTS "meetings_all_anon" ON public.meetings;
DROP POLICY IF EXISTS "meetings_insert_anon" ON public.meetings;
DROP POLICY IF EXISTS "meetings_update_anon" ON public.meetings;
DROP POLICY IF EXISTS "meetings_delete_creator" ON public.meetings;
DROP POLICY IF EXISTS "meetings_select" ON public.meetings;
DROP POLICY IF EXISTS "meetings_insert" ON public.meetings;
DROP POLICY IF EXISTS "meetings_update" ON public.meetings;
DROP POLICY IF EXISTS "meetings_delete" ON public.meetings;

CREATE POLICY "meetings_select" ON public.meetings FOR SELECT USING (true);
CREATE POLICY "meetings_insert" ON public.meetings FOR INSERT WITH CHECK (true);
CREATE POLICY "meetings_update" ON public.meetings FOR UPDATE USING (true);
CREATE POLICY "meetings_delete" ON public.meetings FOR DELETE USING (true);

-- ============================================================
-- 4. MEETING_PARTICIPANTS 테이블
-- ============================================================
CREATE TABLE IF NOT EXISTS public.meeting_participants (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  meeting_id UUID REFERENCES public.meetings(id) ON DELETE CASCADE,
  user_id UUID REFERENCES public.users(id) ON DELETE CASCADE,
  display_name TEXT NOT NULL,
  joined_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP NOT NULL,
  UNIQUE(meeting_id, user_id)
);

ALTER TABLE public.meeting_participants ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow public read access to meeting_participants" ON public.meeting_participants;
DROP POLICY IF EXISTS "Allow all access to meeting_participants" ON public.meeting_participants;
DROP POLICY IF EXISTS "participants_select_anon" ON public.meeting_participants;
DROP POLICY IF EXISTS "participants_all_anon" ON public.meeting_participants;
DROP POLICY IF EXISTS "participants_insert_anon" ON public.meeting_participants;
DROP POLICY IF EXISTS "participants_select" ON public.meeting_participants;
DROP POLICY IF EXISTS "participants_insert" ON public.meeting_participants;

CREATE POLICY "participants_select" ON public.meeting_participants FOR SELECT USING (true);
CREATE POLICY "participants_insert" ON public.meeting_participants FOR INSERT WITH CHECK (true);
CREATE POLICY "participants_delete" ON public.meeting_participants FOR DELETE USING (true);

-- ============================================================
-- 5. NOTES 테이블
-- ============================================================
CREATE TABLE IF NOT EXISTS public.notes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  meeting_id UUID REFERENCES public.meetings(id) ON DELETE CASCADE NOT NULL,
  author_id UUID REFERENCES public.users(id) ON DELETE CASCADE NOT NULL,
  author_name TEXT NOT NULL,
  note_type TEXT NOT NULL DEFAULT 'thought',
  content TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP NOT NULL
);

ALTER TABLE public.notes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow public read access to notes" ON public.notes;
DROP POLICY IF EXISTS "Allow all access to notes" ON public.notes;
DROP POLICY IF EXISTS "notes_select_anon" ON public.notes;
DROP POLICY IF EXISTS "notes_all_anon" ON public.notes;
DROP POLICY IF EXISTS "notes_insert_anon" ON public.notes;
DROP POLICY IF EXISTS "notes_update_author" ON public.notes;
DROP POLICY IF EXISTS "notes_delete_author" ON public.notes;
DROP POLICY IF EXISTS "notes_select" ON public.notes;
DROP POLICY IF EXISTS "notes_insert" ON public.notes;
DROP POLICY IF EXISTS "notes_update" ON public.notes;
DROP POLICY IF EXISTS "notes_delete" ON public.notes;

CREATE POLICY "notes_select" ON public.notes FOR SELECT USING (true);
CREATE POLICY "notes_insert" ON public.notes FOR INSERT WITH CHECK (true);
CREATE POLICY "notes_update" ON public.notes FOR UPDATE USING (true);
CREATE POLICY "notes_delete" ON public.notes FOR DELETE USING (true);

-- ============================================================
-- 6. REACTIONS 테이블
-- ============================================================
CREATE TABLE IF NOT EXISTS public.reactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  note_id UUID REFERENCES public.notes(id) ON DELETE CASCADE NOT NULL,
  user_id UUID REFERENCES public.users(id) ON DELETE CASCADE NOT NULL,
  user_name TEXT NOT NULL,
  reaction_type TEXT NOT NULL DEFAULT 'like',
  created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP NOT NULL,
  UNIQUE(note_id, user_id, reaction_type)
);

ALTER TABLE public.reactions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow public read access to reactions" ON public.reactions;
DROP POLICY IF EXISTS "Allow all access to reactions" ON public.reactions;
DROP POLICY IF EXISTS "reactions_select_anon" ON public.reactions;
DROP POLICY IF EXISTS "reactions_all_anon" ON public.reactions;
DROP POLICY IF EXISTS "reactions_insert_anon" ON public.reactions;
DROP POLICY IF EXISTS "reactions_delete_anon" ON public.reactions;
DROP POLICY IF EXISTS "reactions_select" ON public.reactions;
DROP POLICY IF EXISTS "reactions_insert" ON public.reactions;
DROP POLICY IF EXISTS "reactions_delete" ON public.reactions;

CREATE POLICY "reactions_select" ON public.reactions FOR SELECT USING (true);
CREATE POLICY "reactions_insert" ON public.reactions FOR INSERT WITH CHECK (true);
CREATE POLICY "reactions_delete" ON public.reactions FOR DELETE USING (true);

-- ============================================================
-- 7. AI_REPORTS 테이블
-- ============================================================
CREATE TABLE IF NOT EXISTS public.ai_reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  meeting_id UUID NOT NULL REFERENCES public.meetings(id) ON DELETE CASCADE,
  created_by UUID NOT NULL REFERENCES public.users(id),
  summary TEXT NOT NULL,
  core_topics JSONB NOT NULL DEFAULT '[]'::jsonb,
  common_ideas JSONB NOT NULL DEFAULT '[]'::jsonb,
  different_ideas JSONB NOT NULL DEFAULT '[]'::jsonb,
  new_questions JSONB NOT NULL DEFAULT '[]'::jsonb,
  action_items JSONB NOT NULL DEFAULT '[]'::jsonb,
  status TEXT DEFAULT 'draft' NOT NULL,
  published_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(meeting_id)
);

ALTER TABLE public.ai_reports ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "ai_reports_select" ON public.ai_reports;
DROP POLICY IF EXISTS "ai_reports_insert" ON public.ai_reports;
DROP POLICY IF EXISTS "ai_reports_update" ON public.ai_reports;

CREATE POLICY "ai_reports_select" ON public.ai_reports FOR SELECT USING (true);
CREATE POLICY "ai_reports_insert" ON public.ai_reports FOR INSERT WITH CHECK (true);
CREATE POLICY "ai_reports_update" ON public.ai_reports FOR UPDATE USING (true);

-- ============================================================
-- 8. KNOWLEDGE_ITEMS 테이블
-- ============================================================
CREATE TABLE IF NOT EXISTS public.knowledge_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  meeting_id UUID NOT NULL REFERENCES public.meetings(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  content TEXT NOT NULL,
  created_by UUID NOT NULL REFERENCES public.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.knowledge_items ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "knowledge_select" ON public.knowledge_items;
DROP POLICY IF EXISTS "knowledge_insert" ON public.knowledge_items;

CREATE POLICY "knowledge_select" ON public.knowledge_items FOR SELECT USING (true);
CREATE POLICY "knowledge_insert" ON public.knowledge_items FOR INSERT WITH CHECK (true);

-- ============================================================
-- 9. KNOWLEDGE_SOURCES 테이블
-- ============================================================
CREATE TABLE IF NOT EXISTS public.knowledge_sources (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  knowledge_item_id UUID NOT NULL REFERENCES public.knowledge_items(id) ON DELETE CASCADE,
  note_id UUID REFERENCES public.notes(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.knowledge_sources ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "sources_select" ON public.knowledge_sources;
DROP POLICY IF EXISTS "sources_insert" ON public.knowledge_sources;

CREATE POLICY "sources_select" ON public.knowledge_sources FOR SELECT USING (true);
CREATE POLICY "sources_insert" ON public.knowledge_sources FOR INSERT WITH CHECK (true);

-- ============================================================
-- 10. GUEST_TOKENS 테이블
-- ============================================================
CREATE TABLE IF NOT EXISTS public.guest_tokens (
  token_hash TEXT PRIMARY KEY,
  participant_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  meeting_id UUID NOT NULL REFERENCES public.meetings(id) ON DELETE CASCADE,
  expires_at TIMESTAMPTZ NOT NULL,
  revoked_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP NOT NULL
);

ALTER TABLE public.guest_tokens ENABLE ROW LEVEL SECURITY;

-- guest_tokens는 서비스 키(서버)만 접근
CREATE POLICY "guest_tokens_server_only" ON public.guest_tokens FOR ALL USING (true);

-- ============================================================
-- 11. APP_ADMINS 테이블
-- ============================================================
CREATE TABLE IF NOT EXISTS public.app_admins (
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE PRIMARY KEY,
  role TEXT DEFAULT 'admin' NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.app_admins ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Anyone can view app_admins" ON public.app_admins;
CREATE POLICY "Anyone can view app_admins" ON public.app_admins FOR SELECT USING (true);

-- ============================================================
-- 12. COLLECTIVE_KNOWLEDGE 테이블
-- ============================================================
CREATE TABLE IF NOT EXISTS public.collective_knowledge (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  meeting_id UUID REFERENCES public.meetings(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  conclusion TEXT NOT NULL,
  supporting_ideas JSONB NOT NULL DEFAULT '[]'::jsonb,
  opposing_ideas JSONB NOT NULL DEFAULT '[]'::jsonb,
  new_insight TEXT,
  unresolved_questions JSONB NOT NULL DEFAULT '[]'::jsonb,
  action_items JSONB NOT NULL DEFAULT '[]'::jsonb,
  source_note_ids JSONB NOT NULL DEFAULT '[]'::jsonb,
  related_knowledge_ids JSONB NOT NULL DEFAULT '[]'::jsonb,
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'published')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.collective_knowledge ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Anyone can view collective_knowledge" ON public.collective_knowledge;
DROP POLICY IF EXISTS "Server can manage collective_knowledge" ON public.collective_knowledge;

CREATE POLICY "collective_knowledge_select" ON public.collective_knowledge FOR SELECT USING (true);
CREATE POLICY "collective_knowledge_all" ON public.collective_knowledge FOR ALL USING (true);

-- ============================================================
-- 13. TRIGGERS (updated_at 자동 업데이트)
-- ============================================================
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = CURRENT_TIMESTAMP;
  RETURN NEW;
END;
$$ language 'plpgsql';

DROP TRIGGER IF EXISTS update_notes_updated_at ON public.notes;
CREATE TRIGGER update_notes_updated_at
  BEFORE UPDATE ON public.notes
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_ai_reports_updated_at ON public.ai_reports;
CREATE TRIGGER update_ai_reports_updated_at
  BEFORE UPDATE ON public.ai_reports
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_collective_knowledge_updated_at ON public.collective_knowledge;
CREATE TRIGGER update_collective_knowledge_updated_at
  BEFORE UPDATE ON public.collective_knowledge
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- ============================================================
-- 완료! 아래 쿼리로 테이블 생성 확인
-- SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' ORDER BY table_name;
-- ============================================================

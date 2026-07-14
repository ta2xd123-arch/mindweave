-- ============================================================
-- MINDWEAVE: 2단계 보안 강화 마이그레이션 (엄격한 RLS 적용)
-- 취약점 해결: anon(비인증) 사용자의 무분별한 INSERT/UPDATE/DELETE 차단
-- ============================================================

-- 1. public.meetings
DROP POLICY IF EXISTS "meetings_update_anon" ON public.meetings;
DROP POLICY IF EXISTS "meetings_insert_anon" ON public.meetings;

-- 2. public.notes
DROP POLICY IF EXISTS "notes_insert_anon" ON public.notes;

-- 3. public.reactions
DROP POLICY IF EXISTS "reactions_insert_anon" ON public.reactions;
DROP POLICY IF EXISTS "reactions_delete_anon" ON public.reactions;

-- 4. public.meeting_participants
DROP POLICY IF EXISTS "participants_insert_anon" ON public.meeting_participants;

-- 5. public.users
DROP POLICY IF EXISTS "users_anon_upsert" ON public.users;

-- 이제 서버(API Routes)에서 SUPABASE_SERVICE_ROLE_KEY를 사용하여 데이터를 관리해야 합니다.
-- 클라이언트에서 직접 데이터를 쓰거나 수정하는 것은 차단됩니다.
